'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';

// 1. ฟังก์ชันสร้าง Job งานซ่อม
export async function createRepairJob(formData: FormData) {
  const customerName = formData.get('customerName') as string;
  const customerPhone = (formData.get('customerPhone') as string) || '';
  const serialNumber = formData.get('serialNumber') as string;
  const category = (formData.get('category') as string) || 'INVERTER';
  const issueDescription = (formData.get('issueDescription') as string) || '';

  if (!customerName || !serialNumber) {
    return { error: 'กรุณากรอกชื่อลูกค้าและ Serial Number' };
  }

  try {
    const count = await prisma.job.count();
    const currentYear = new Date().getFullYear();
    const jobNo = `JOB-${currentYear}-${String(count + 1).padStart(3, '0')}`;

    await prisma.job.create({
      data: {
        jobNo,
        customerName,
        phone: customerPhone,
        serialNumber,
        category,
        note: issueDescription,
        status: 'PENDING',
      },
    });

    revalidatePath('/dashboard/jobs');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Error creating repair job:', error);
    return { error: 'ไม่สามารถสร้าง Job งานซ่อมได้' };
  }
}

// 💡 ฟังก์ชันตัวช่วย: แปลงและบันทึกไฟล์ลง Disk
const saveFileToDisk = async (fileInput: any): Promise<string | null> => {
  if (!fileInput) return null;

  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  try {
    await mkdir(uploadDir, { recursive: true });
  } catch (e) {}

  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);

  if (fileInput instanceof File && fileInput.size > 0) {
    const bytes = await fileInput.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = `${uniqueSuffix}-${fileInput.name.replace(/\s+/g, '_')}`;
    const filepath = path.join(uploadDir, filename);
    await writeFile(filepath, buffer);
    return `/uploads/${filename}`;
  }

  if (typeof fileInput === 'string' && fileInput.startsWith('data:image')) {
    try {
      const matches = fileInput.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) return null;
      
      const type = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      const extension = type.split('/')[1] || 'jpg';
      const filename = `${uniqueSuffix}.${extension}`;
      const filepath = path.join(uploadDir, filename);
      
      await writeFile(filepath, buffer);
      return `/uploads/${filename}`;
    } catch (err) {
      console.error('Error saving base64 to file:', err);
      return null;
    }
  }

  return null;
};

// 2. ฟังก์ชันอัปเดต Job และจัดการสถานะเครื่องสำรอง
export async function updateJobAction(formData: FormData) {
  const jobId = formData.get('jobId') as string;

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

  let validUserId: string | null = null;
  if (currentUserId) {
    const checkUser = await prisma.user.findUnique({ where: { id: currentUserId } });
    if (checkUser) validUserId = checkUser.id;
  }

  // ดึงข้อมูลฟิลด์ทั่วไป
  const status = formData.get('status') as string;
  const customerName = formData.get('customerName') as string;
  const phone = formData.get('phone') as string;
  const rawCategory = formData.get('category') as string;
  
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

  try {
    const existingJob = await prisma.job.findUnique({
      where: { id: jobId },
      include: { images: true, backupDevice: true }
    });

    // 2. อัปเดตข้อมูลทั่วไปของ Job
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status,
        customerName,
        phone,
        category,
        brandId: brandId ? brandId : null,
        model,
        serialNumber,
        productNo,
        backupDeviceId: backupDeviceId ? backupDeviceId : null,
        note,
      }
    });

    // 3. จัดการลบรูปภาพเก่า
    const deletedImageIdsStr = formData.get('deletedImageIds') as string;
    if (deletedImageIdsStr) {
      const deletedImageIds: string[] = JSON.parse(deletedImageIdsStr);
      if (deletedImageIds.length > 0) {
        await prisma.jobImage.deleteMany({
          where: { id: { in: deletedImageIds } }
        });
      }
    }

    let newImageUrl: string | null = null;
    // 4. จัดการรูป Nameplate ใหม่
    const nameplateFile = formData.get('nameplateImages');
    if (nameplateFile) {
      const fileUrl = await saveFileToDisk(nameplateFile);
      if (fileUrl) {
        newImageUrl = fileUrl;
        await prisma.jobImage.create({
          data: {
            url: fileUrl,
            jobId: jobId,
            type: 'NAMEPLATE',
          }
        });
      }
    }

    // 5. จัดการรูปภาพอื่นๆ (Other Images)
    const otherFiles = [...formData.getAll('otherFiles'), ...formData.getAll('otherImages')];
    for (const file of otherFiles) {
      const fileUrl = await saveFileToDisk(file);
      if (fileUrl) {
        await prisma.jobImage.create({
          data: {
            url: fileUrl,
            jobId: jobId,
            type: 'OTHER',
          }
        });
      }
    }

    // 6. จัดการรูปภาพในประวัติการเบิกอะไหล่
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('fullBoardImages_') || key.startsWith('qrCodeImages_')) {
        const fileUrl = await saveFileToDisk(value);
        if (fileUrl) {
          const isFullBoard = key.startsWith('fullBoardImages_');
          const stockLogId = key.replace('fullBoardImages_', '').replace('qrCodeImages_', '');

          await prisma.jobImage.create({
            data: {
              url: fileUrl,
              stockLogId: stockLogId,
              jobId: jobId,
              type: isFullBoard ? 'STOCK_FULLBOARD' : 'STOCK_QR',
            }
          });
        }
      }
    }

    // 🌟 7. จัดการกรณีสถานะเป็น 'SWAPPED_BACKUP_DEVICE' (ยืมเครื่องสำรองชั่วคราว - ห้ามย้ายข้อมูลถาวรและห้ามย้ายรูปภาพ)
    if (status === 'SWAPPED_BACKUP_DEVICE' && backupDeviceId) {
      await prisma.backupDevice.update({
        where: { id: backupDeviceId },
        data: {
          status: 'SWAPPED',
          customerName: customerName || existingJob?.customerName,
          phone: phone || existingJob?.phone,
        }
      });
    }

    // 🌟 8. จัดการกรณีสถานะเป็น 'SWAPPED_PERMANENT' หรือ 'FINAL_SWAPPED_PERMANENT' (สลับเปลี่ยนถาวรเท่านั้นจึงจะย้ายข้อมูลและรูปภาพ)
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

      // ดึงรูปภาพทั้งหมดของ Job นี้
      const allJobImages = await prisma.jobImage.findMany({
        where: { jobId: jobId }
      });

      // ค้นหารูปหลักสำหรับเครื่องสำรอง (Nameplate หรือรูปอื่นๆ)
      const primaryImage = 
        newImageUrl || 
        allJobImages.find(img => img.type === 'NAMEPLATE')?.url || 
        allJobImages.find(img => img.type === 'OTHER')?.url || 
        allJobImages[0]?.url || 
        targetBackupDevice?.imageUrl || 
        null;

      // 📌 แปลงหมวดหมู่ให้เป็นภาษาไทยเสมอ (ป้องกันค้างเป็น INVERTER ภาษาอังกฤษ)
      let formattedCategory = category || 'อินเวอร์เตอร์';
      if (formattedCategory === 'INVERTER' || formattedCategory === 'Inv' || formattedCategory === 'Inverter') {
        formattedCategory = 'อินเวอร์เตอร์';
      }

      if (!targetBackupDevice) {
        // สร้างเครื่องสำรองใหม่ด้วยสถานะ SWAPPED_PERMANENT พร้อมหมวดหมู่ไทยและชื่อผู้บันทึก
        targetBackupDevice = await prisma.backupDevice.create({
          data: {
            status: 'SWAPPED_PERMANENT',
            category: formattedCategory,
            brandId: brandId || existingJob?.brandId || null,
            model: model || existingJob?.model || 'ไม่ระบุรุ่น',
            serialNumber: serialNumber || `SWAP-${Date.now()}`,
            productNo: productNo || existingJob?.productNo || null,
            customerName: customerName || existingJob?.customerName || null,
            phone: phone || existingJob?.phone || null,
            note: note ? `สลับเปลี่ยนถาวรจากใบงาน: ${jobId} - ${note}` : `สลับเปลี่ยนถาวรจากใบงาน: ${jobId}`,
            imageUrl: primaryImage,
            userId: validUserId,
            receiverId: validUserId,
            receiverName: finalReceiverName,
          }
        });

        await prisma.job.update({
          where: { id: jobId },
          data: { backupDeviceId: targetBackupDevice.id }
        });
      } else {
        // อัปเดตเครื่องสำรองที่มีอยู่ พร้อมหมวดหมู่ไทยและชื่อผู้บันทึก
        await prisma.backupDevice.update({
          where: { id: targetBackupDevice.id },
          data: {
            status: 'SWAPPED_PERMANENT',
            category: formattedCategory,
            brandId: brandId || existingJob?.brandId || targetBackupDevice.brandId,
            model: model || existingJob?.model || targetBackupDevice.model,
            serialNumber: serialNumber || targetBackupDevice.serialNumber,
            productNo: productNo || existingJob?.productNo || targetBackupDevice.productNo,
            customerName: customerName || existingJob?.customerName || targetBackupDevice.customerName,
            phone: phone || existingJob?.phone || targetBackupDevice.phone,
            ...(primaryImage ? { imageUrl: primaryImage } : {}),
            userId: validUserId || targetBackupDevice.userId || null,
            receiverId: validUserId || targetBackupDevice.receiverId || null,
            receiverName: finalReceiverName,
          }
        });
      }

      // โอนย้ายรูปภาพสภาพเครื่อง (เฉพาะรูปที่ไม่ใช่ NAMEPLATE และไม่ใช่รูปสต็อกอะไหล่) ไปยัง BackupDeviceImage อย่างถูกต้อง
      for (const img of allJobImages) {
        if (img.url && img.type !== 'NAMEPLATE' && !img.type?.startsWith('STOCK_')) {
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
    return { success: true };
  } catch (error) {
    console.error('Error updating job:', error);
    throw new Error('ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
  }
}