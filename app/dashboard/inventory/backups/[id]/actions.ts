'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';

// 🌟 ตั้งค่า Supabase Client สำหรับจัดการอัปโหลดไฟล์เข้า Storage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = 'repair-images';

// Helper ฟังก์ชันอัปโหลดไฟล์ไปยัง Supabase Storage
async function uploadFileToSupabase(file: File, folderPrefix: string): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const sanitizeName = file.name ? file.name.replaceAll(' ', '_') : 'unnamed.jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${sanitizeName}`;
  const filePath = `backups/${folderPrefix}/${filename}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, buffer, {
      contentType: file.type || 'image/jpeg',
      upsert: true,
    });

  if (uploadError) {
    console.error('Supabase Storage Upload Error:', uploadError);
    throw new Error(`ไม่สามารถอัปโหลดรูปภาพได้: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

export async function updateBackupDevice(id: string, formData: FormData) {
  try {
    const status = formData.get('status') as string;
    const rawCategory = formData.get('category') as string;
    
    // 🌟 แปลงหมวดหมู่ให้แสดงผลเป็นภาษาไทยเสมอ
    let category = rawCategory || 'อินเวอร์เตอร์';
    if (category === 'INVERTER' || category === 'Inv' || category === 'Inverter' || category.toLowerCase() === 'inverter') {
      category = 'อินเวอร์เตอร์';
    }

    const brandId = formData.get('brandId') as string;
    const model = formData.get('model') as string;
    const serialNumber = formData.get('serialNumber') as string;
    const productNo = formData.get('productNo') as string;
    
    const customerName = (formData.get('customerName') as string) || null;
    const phone = (formData.get('phone') as string) || null;
    
    const note = formData.get('note') as string;
    const hasBox = formData.get('hasBox') === 'on';
    const hasWifiDongle = formData.get('hasWifiDongle') === 'on';
    const wifiDongleSn = formData.get('wifiDongleSn') as string;
    const deletedImageIdsStr = formData.get('deletedImageIds') as string;
    const deletedStockLogImageIdsStr = formData.get('deletedStockLogImageIds') as string;

    const cookieStore = await cookies();
    let currentUserId: string | null = null;
    let currentUserName: string | null = null;

    try {
      const session = await getServerSession();
      if (session?.user) {
        const sessionIdentifier = (session.user as any).id || session.user.email || session.user.name;
        if (sessionIdentifier) {
          const foundAuthUser = await prisma.user.findFirst({
            where: {
              OR: [
                { id: sessionIdentifier },
                { email: sessionIdentifier },
                { username: sessionIdentifier },
                { name: sessionIdentifier }
              ]
            }
          });
          if (foundAuthUser) {
            currentUserId = foundAuthUser.id;
            currentUserName = foundAuthUser.name || foundAuthUser.username || null;
          }
        }
      }
    } catch (e) {
      // ข้ามหากไม่ได้ใช้ NextAuth
    }

    if (!currentUserId) {
      const userCookie = 
        cookieStore.get('userId')?.value || 
        cookieStore.get('user')?.value || 
        cookieStore.get('username')?.value ||
        cookieStore.get('session')?.value ||
        cookieStore.get('token')?.value;

      if (userCookie) {
        const foundUser = await prisma.user.findFirst({
          where: {
            OR: [
              { id: userCookie },
              { username: userCookie },
              { name: userCookie }
            ]
          }
        });
        if (foundUser) {
          currentUserId = foundUser.id;
          currentUserName = foundUser.name || foundUser.username || null;
        }
      }
    }

    // 🌟 เงื่อนไขตรวจสอบ: ถ้าเลือกเปลี่ยนสถานะเป็น AVAILABLE (พร้อมใช้ / ซ่อมเสร็จ)
    if (status === 'AVAILABLE') {
      const deviceWithLogs = await prisma.backupDevice.findUnique({
        where: { id },
        include: {
          jobs: {
            include: {
              stockLogs: {
                where: {
                  type: { not: 'RETURN' }
                }
              }
            }
          }
        }
      });

      const totalLogs = deviceWithLogs?.jobs.reduce((acc, job) => acc + (job.stockLogs?.length || 0), 0) || 0;

      if (totalLogs === 0) {
        throw new Error('ไม่สามารถเปลี่ยนสถานะเป็น "ซ่อมเสร็จ / พร้อมใช้" ได้ เนื่องจากยังไม่มีประวัติการเบิกอะไหล่ กรุณาเบิกอะไหล่อย่างน้อย 1 รายการก่อนครับ');
      }
    }

    let deletedImageIds: string[] = [];
    try {
      if (deletedImageIdsStr) deletedImageIds = JSON.parse(deletedImageIdsStr);
    } catch (e) {
      console.error('Failed to parse deletedImageIds', e);
    }

    let deletedStockLogImageIds: string[] = [];
    try {
      if (deletedStockLogImageIdsStr) {
        deletedStockLogImageIds = JSON.parse(deletedStockLogImageIdsStr);
      }
    } catch (e) {
      console.error('Failed to parse deletedStockLogImageIds', e);
    }

    if (deletedImageIds.includes('nameplate')) {
      await prisma.backupDevice.update({
        where: { id },
        data: { imageUrl: null },
      });
    }

    const otherDeletedIds = deletedImageIds.filter(i => i !== 'nameplate');
    if (otherDeletedIds.length > 0) {
      await prisma.backupDeviceImage.deleteMany({
        where: { id: { in: otherDeletedIds } },
      });
    }

    if (deletedStockLogImageIds.length > 0) {
      await prisma.jobImage.deleteMany({
        where: { id: { in: deletedStockLogImageIds } },
      });
    }

    // 🌟 อัปโหลดรูปภาพหลักของเครื่องสำรองขึ้น Supabase Storage
    const imageFile = formData.get('image') as File | null;
    let imageUrlUpdate = {};
    if (imageFile && imageFile.size > 0) {
      const publicUrl = await uploadFileToSupabase(imageFile, 'nameplates');
      imageUrlUpdate = { imageUrl: publicUrl };
    }

    // 🌟 อัปโหลดรูปภาพสภาพเครื่อง/รูปอื่นๆ (`otherImages`) ขึ้น Supabase Storage และบันทึกลงตาราง BackupDeviceImage
    const otherImageFiles = formData.getAll('otherImages') as File[];
    for (const imgFile of otherImageFiles) {
      if (imgFile && imgFile instanceof File && imgFile.size > 0) {
        const publicUrl = await uploadFileToSupabase(imgFile, 'conditions');
        await prisma.backupDeviceImage.create({
          data: {
            url: publicUrl,
            type: 'CONDITION',
            backupDeviceId: id,
          }
        });
      }
    }

    // 🌟 กำหนดค่าอัปเดตข้อมูลเครื่องสำรอง พร้อมบันทึกชื่อผู้ทำรายการเป็น adminTMDA
    const updateData: any = {
      status,
      category, 
      brandId: brandId && brandId !== '' ? brandId : null,
      model,
      serialNumber,
      productNo: productNo || null,
      customerName,
      phone,
      note: note || null,
      hasBox,
      hasWifiDongle,
      wifiDongleSn: hasWifiDongle ? wifiDongleSn : null,
      userId: currentUserId,
      ...imageUrlUpdate,
    };

    if (status) {
      updateData.receiverId = currentUserId;
      updateData.receiverName = currentUserName || 'adminTMDA';
    }

    await prisma.backupDevice.update({
      where: { id },
      data: updateData,
    });

    revalidatePath(`/dashboard/inventory/backups/${id}`);
    revalidatePath('/dashboard/inventory/backups');
    return { success: true };
  } catch (error: any) {
    console.error('Update backup device error:', error);
    throw new Error(error.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
  }
}

export async function addBackupDeviceStockLog(deviceId: string, formData: FormData) {
  try {
    const cookieStore = await cookies();
    
    let currentUserId: string | undefined = undefined;
    try {
      const session = await getServerSession();
      if (session?.user) {
        const sessionIdentifier = (session.user as any).id || session.user.email || session.user.name;
        if (sessionIdentifier) {
          const foundAuthUser = await prisma.user.findFirst({
            where: {
              OR: [
                { id: sessionIdentifier },
                { email: sessionIdentifier },
                { username: sessionIdentifier },
                { name: sessionIdentifier }
              ]
            }
          });
          if (foundAuthUser) {
            currentUserId = foundAuthUser.id;
          }
        }
      }
    } catch (e) {
      // ข้ามหากไม่ได้ใช้ NextAuth
    }

    if (!currentUserId) {
      const userCookie = 
        cookieStore.get('userId')?.value || 
        cookieStore.get('user')?.value || 
        cookieStore.get('username')?.value ||
        cookieStore.get('session')?.value ||
        cookieStore.get('token')?.value;

      if (userCookie) {
        const foundUser = await prisma.user.findFirst({
          where: {
            OR: [
              { id: userCookie },
              { username: userCookie },
              { name: userCookie }
            ]
          }
        });
        if (foundUser) {
          currentUserId = foundUser.id;
        }
      }
    }

    if (!currentUserId) {
      const fallbackUser = await prisma.user.findFirst();
      currentUserId = fallbackUser?.id;
    }

    const note = formData.get('note') as string;
    const itemsJson = formData.get('itemsJson') as string;

    if (!itemsJson) {
      throw new Error('กรุณาระบุรายการอะไหล่ที่ต้องการเบิก');
    }

    let items: { sparePartId: string; quantity: number }[] = [];
    try {
      items = JSON.parse(itemsJson);
    } catch (e) {
      throw new Error('รูปแบบข้อมูลรายการอะไหล่ไม่ถูกต้อง');
    }

    if (!items || items.length === 0) {
      throw new Error('กรุณาเลือกรายการอะไหล่อย่างน้อย 1 รายการ');
    }

    const device = await prisma.backupDevice.findUnique({
      where: { id: deviceId },
      include: { jobs: true }
    });

    if (!device) throw new Error('ไม่พบข้อมูลเครื่องสำรอง');

    let targetJobId = device.jobs?.[0]?.id;

    if (!targetJobId) {
      const newJob = await prisma.job.create({
        data: {
          jobNo: `BK-${Date.now().toString().slice(-6)}`,
          customerName: `ซ่อมบำรุงในคลัง: ${device.model}`,
          phone: '-',
          status: 'IN_REPAIR',
          backupDeviceId: deviceId,
          userId: currentUserId, 
        }
      });
      targetJobId = newJob.id;
    }

    // 🌟 ทำงานผ่าน Prisma Transaction เพื่อความถูกต้องและปลอดภัยของข้อมูล
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const sparePart = await tx.sparePart.findUnique({ where: { id: item.sparePartId } });
        
        if (!sparePart || sparePart.stock < item.quantity) {
          throw new Error(`อะไหล่ "${sparePart?.name || 'ไม่ระบุ'}" ในคลังมีไม่พอเบิก (คงเหลือ ${sparePart?.stock || 0} ชิ้น)`);
        }

        const image1 = formData.get(`image1_${i}`) as File | null;
        const image2 = formData.get(`image2_${i}`) as File | null;

        if (!image1 || !image2 || image1.size === 0 || image2.size === 0) {
          throw new Error(`กรุณาแนบรูปถ่ายหลักฐานทั้ง 2 รูป (เต็มบอร์ด และ QR Code) ในรายการที่ ${i + 1}`);
        }

        // ตัดสต็อกอะไหล่
        const newStock = sparePart.stock - Math.abs(item.quantity);
        await tx.sparePart.update({
          where: { id: item.sparePartId },
          data: { stock: newStock >= 0 ? newStock : 0 }
        });

        // สร้าง Log การเบิก (บันทึกจำนวนเป็นค่าติดลบ)
        const stockLog = await tx.stockLog.create({
          data: {
            jobId: targetJobId,
            sparePartId: item.sparePartId,
            quantity: -Math.abs(item.quantity),
            type: 'REPAIR_DEDUCT',
            note: note || 'เบิกอะไหล่ซ่อมเครื่องสำรองพร้อมหลักฐาน',
            userId: currentUserId,
          }
        });

        // อัปโหลดและบันทึกรูปภาพคู่ประจำรายการนี้
        const url1 = await uploadFileToSupabase(image1, 'stock-logs');
        const url2 = await uploadFileToSupabase(image2, 'stock-logs');

        await tx.jobImage.createMany({
          data: [
            { jobId: targetJobId, stockLogId: stockLog.id, url: url1, type: 'STOCK_LOG' },
            { jobId: targetJobId, stockLogId: stockLog.id, url: url2, type: 'STOCK_LOG' },
          ]
        });
      }
    });

    revalidatePath(`/dashboard/inventory/backups/${deviceId}`);
    revalidatePath('/dashboard/inventory/logs');
    return { success: true };
  } catch (error: any) {
    console.error('Add stock log error:', error);
    throw new Error(error.message || 'เบิกอะไหล่ไม่สำเร็จ');
  }
}