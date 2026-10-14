'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';

export async function updateJobAction(formData: FormData) {
  try {
    const jobId = formData.get('jobId') as string;
    if (!jobId) throw new Error('ไม่พบรหัสใบงาน (Job ID)');

    // 1. ดึงข้อมูลผู้ใช้งานปัจจุบัน (Audit Trail)
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
    } catch (e) {}

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

    const finalReceiverName = currentUserName || 'adminTMDA';

    // 2. รับค่าข้อมูลจากฟอร์ม
    const status = formData.get('status') as string;
    const customerName = formData.get('customerName') as string;
    const phone = formData.get('phone') as string;
    const rawCategory = formData.get('category') as string;
    
    // แปลงหมวดหมู่ให้เป็นภาษาไทยเสมอ[cite: 11]
    let category = rawCategory || 'อินเวอร์เตอร์';
    if (category === 'INVERTER' || category === 'Inv' || category === 'Inverter') {
      category = 'อินเวอร์เตอร์';
    }

    const brandId = formData.get('brandId') as string;
    const model = formData.get('model') as string;
    const serialNumber = formData.get('serialNumber') as string;
    const productNo = formData.get('productNo') as string;
    const backupDeviceId = formData.get('backupDeviceId') as string;
    const note = formData.get('note') as string;

    const wifiDongleSn = formData.get('wifiDongleSn') as string;
    const hasBox = formData.get('hasBox') === 'true';
    const hasWifiDongle = formData.get('hasWifiDongle') === 'true';

    // ดึงข้อมูล Job เดิมพร้อมรูปภาพ[cite: 11]
    const existingJob = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        images: true,
        backupDevice: true,
        stockLogs: {
          include: { images: true }
        }
      }
    });

    // อัปเดตข้อมูล Job[cite: 11]
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status,
        customerName,
        phone,
        category,
        brandId: brandId || null,
        model,
        serialNumber,
        productNo,
        backupDeviceId: backupDeviceId || null,
        note,
        wifiDongleSn: wifiDongleSn || null,
        hasBox,
        hasWifiDongle,
      },
    });

    // จัดการไฟล์อัปโหลด[cite: 11]
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (e) {}

    const saveFileToDisk = async (file: File): Promise<string | null> => {
      if (!file || file.size === 0) return null;
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const filename = `${uniqueSuffix}-${file.name.replace(/\s+/g, '_')}`;
      const filepath = path.join(uploadDir, filename);
      await writeFile(filepath, buffer);
      return `/uploads/${filename}`;
    };

    const nameplateFile = formData.get('nameplateImages') as File;
    let newImageUrl: string | null = null;
    if (nameplateFile && nameplateFile instanceof File && nameplateFile.size > 0) {
      const fileUrl = await saveFileToDisk(nameplateFile);
      if (fileUrl) {
        newImageUrl = fileUrl;
        await prisma.jobImage.create({
          data: {
            url: fileUrl,
            type: 'NAMEPLATE',
            jobId: jobId,
          },
        });
      }
    }

    // ตรวจสอบความถูกต้องของ userId สำหรับ Foreign Key[cite: 11]
    let validUserId: string | null = null;
    if (currentUserId) {
      const checkUser = await prisma.user.findUnique({ where: { id: currentUserId } });
      if (checkUser) validUserId = checkUser.id;
    }

    // 🌟 3. จัดการกรณีสถานะเป็น 'SWAPPED_BACKUP_DEVICE' (ยืมเครื่องสำรองชั่วคราว - ห้ามย้ายข้อมูลถาวร)[cite: 11]
    if (status === 'SWAPPED_BACKUP_DEVICE' && backupDeviceId) {
      await prisma.backupDevice.update({
        where: { id: backupDeviceId },
        data: { 
          status: 'SWAPPED',
          customerName: customerName || existingJob?.customerName,
          phone: phone || existingJob?.phone,
        },
      });
    }

    // 🌟 4. จัดการกรณีสถานะเป็น 'SWAPPED_PERMANENT' หรือ 'FINAL_SWAPPED_PERMANENT' (สลับเปลี่ยนถาวร)[cite: 11]
    if (status === 'SWAPPED_PERMANENT' || status === 'FINAL_SWAPPED_PERMANENT') {
      let targetBackupDevice: any = null;

      if (backupDeviceId) {
        targetBackupDevice = await prisma.backupDevice.findUnique({
          where: { id: backupDeviceId }
        });
      }

      if (!targetBackupDevice && serialNumber) {
        targetBackupDevice = await prisma.backupDevice.findFirst({
          where: { serialNumber: serialNumber }
        });
      }

      const primaryImage = newImageUrl || existingJob?.images?.find(img => img.type?.includes('NAMEPLATE'))?.url || targetBackupDevice?.imageUrl || null;

      if (!targetBackupDevice) {
        targetBackupDevice = await prisma.backupDevice.create({
          data: {
            status: 'SWAPPED_PERMANENT', // 👈 แก้ไขเป็นสถานะถาวรถูกต้อง
            category: category,
            brandId: brandId || existingJob?.brandId || null,
            model: model || existingJob?.model || 'ไม่ระบุรุ่น',
            serialNumber: serialNumber || `SWAP-${Date.now()}`,
            productNo: productNo || existingJob?.productNo || null,
            customerName: customerName || existingJob?.customerName || null,
            phone: phone || existingJob?.phone || null,
            note: note ? `สลับเปลี่ยนถาวรจากใบงาน: ${jobId} - ${note}` : `สลับเปลี่ยนถาวรจากใบงาน: ${jobId}`,
            hasBox: hasBox,
            hasWifiDongle: hasWifiDongle,
            wifiDongleSn: wifiDongleSn || existingJob?.wifiDongleSn || null,
            imageUrl: primaryImage,
            userId: validUserId,
            receiverId: validUserId,
            receiverName: finalReceiverName, // 👈 บันทึกชื่อผู้ทำรายการ (adminTMDA)
          }
        });

        await prisma.job.update({
          where: { id: jobId },
          data: { backupDeviceId: targetBackupDevice.id }
        });
      } else {
        await prisma.backupDevice.update({
          where: { id: targetBackupDevice.id },
          data: {
            status: 'SWAPPED_PERMANENT', // 👈 แก้ไขเป็นสถานะถาวรถูกต้อง
            category: category,
            brandId: brandId || existingJob?.brandId || targetBackupDevice.brandId,
            model: model || existingJob?.model || targetBackupDevice.model,
            serialNumber: serialNumber || targetBackupDevice.serialNumber,
            productNo: productNo || existingJob?.productNo || targetBackupDevice.productNo,
            customerName: customerName || existingJob?.customerName || targetBackupDevice.customerName,
            phone: phone || existingJob?.phone || targetBackupDevice.phone,
            hasBox: hasBox,
            hasWifiDongle: hasWifiDongle,
            wifiDongleSn: wifiDongleSn || existingJob?.wifiDongleSn || targetBackupDevice.wifiDongleSn,
            ...(primaryImage ? { imageUrl: primaryImage } : {}),
            userId: validUserId || targetBackupDevice.userId || null,
            receiverId: validUserId || targetBackupDevice.receiverId || null,
            receiverName: finalReceiverName, // 👈 บันทึกชื่อผู้ทำรายการ (adminTMDA)
          }
        });
      }

      // โอนย้ายรูปภาพสภาพเครื่องทั้งหมดจาก Job ไปยัง BackupDeviceImage (กรองเฉพาะรูปที่ไม่ใช่ NAMEPLATE และไม่ใช่ STOCK)[cite: 11]
      const allJobImages = await prisma.jobImage.findMany({
        where: { jobId: jobId }
      });

      for (const img of allJobImages) {
        if (img.url && !img.type?.includes('NAMEPLATE') && !img.type?.startsWith('STOCK_')) {
          const existingImg = await prisma.backupDeviceImage.findFirst({
            where: { backupDeviceId: targetBackupDevice.id, url: img.url }
          });
          if (!existingImg) {
            await prisma.backupDeviceImage.create({
              data: {
                url: img.url,
                type: 'CONDITION',
                backupDeviceId: targetBackupDevice.id,
              }
            });
          }
        }
      }
    }

    revalidatePath(`/dashboard/jobs/${jobId}`);
    revalidatePath('/dashboard/jobs');
    revalidatePath('/dashboard/inventory/backups');
    revalidatePath('/dashboard');

    return { success: true, message: 'บันทึกข้อมูลสำเร็จ' };
  } catch (error: any) {
    console.error('Error updating job:', error);
    return { success: false, error: error.message };
  }
}