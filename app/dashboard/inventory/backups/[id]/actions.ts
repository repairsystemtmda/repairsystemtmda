'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { writeFile } from 'fs/promises';
import path from 'path';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';

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

    const imageFile = formData.get('image') as File | null;
    let imageUrlUpdate = {};
    if (imageFile && imageFile.size > 0) {
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filename = `${Date.now()}-${imageFile.name.replaceAll(' ', '_')}`;
      const uploadDir = path.join(process.cwd(), 'public/uploads');
      await writeFile(path.join(uploadDir, filename), buffer);
      imageUrlUpdate = { imageUrl: filename };
    }

    // 🌟 กำหนดค่าอัปเดตข้อมูลเครื่องสำรอง พร้อมบันทึกชื่อผู้ทำรายการเป็น adminTMDA
    const updateData: any = {
      status,
      category, // ใช้ค่าภาษาไทยที่แปลงแล้ว
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
      updateData.receiverName = currentUserName || 'adminTMDA'; // 👈 บันทึกชื่อผู้บันทึก
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

    const sparePartId = formData.get('sparePartId') as string;
    const rawQuantity = parseInt(formData.get('quantity') as string || '1', 10);
    const quantity = -Math.abs(rawQuantity);
    const note = formData.get('note') as string;

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

    const stockLog = await prisma.stockLog.create({
      data: {
        jobId: targetJobId,
        sparePartId,
        quantity: quantity,
        type: 'REPAIR_DEDUCT',
        note,
        userId: currentUserId,
      }
    });

    const imageFiles = formData.getAll('images') as File[];
    for (const imgFile of imageFiles) {
      if (imgFile && imgFile.size > 0) {
        const bytes = await imgFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const filename = `${Date.now()}-${imgFile.name.replaceAll(' ', '_')}`;
        const uploadDir = path.join(process.cwd(), 'public/uploads');
        await writeFile(path.join(uploadDir, filename), buffer);

        await prisma.jobImage.create({
          data: {
            jobId: targetJobId,
            stockLogId: stockLog.id,
            url: filename,
            type: 'STOCK_LOG',
          }
        });
      }
    }

    const currentPart = await prisma.sparePart.findUnique({
      where: { id: sparePartId }
    });

    if (currentPart) {
      const newStock = currentPart.stock - Math.abs(rawQuantity);
      await prisma.sparePart.update({
        where: { id: sparePartId },
        data: {
          stock: newStock >= 0 ? newStock : 0
        }
      });
    }

    revalidatePath(`/dashboard/inventory/backups/${deviceId}`);
    revalidatePath('/dashboard/inventory/logs');
    return { success: true };
  } catch (error: any) {
    console.error('Add stock log error:', error);
    throw new Error(error.message || 'เบิกอะไหล่ไม่สำเร็จ');
  }
}