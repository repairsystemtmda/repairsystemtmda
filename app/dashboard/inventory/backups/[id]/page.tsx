import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import BackupDeviceFormClient from './_components/BackupDeviceFormClient';
import { revalidatePath } from 'next/cache';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function BackupDeviceDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;

  // 1. ดึงข้อมูล device เบื้องต้นก่อนเพื่อเช็คสถานะ
  const initialDevice = await prisma.backupDevice.findUnique({
    where: { id }
  });

  if (!initialDevice) {
    notFound();
  }

  // 🌟 2. เช็คสถานะ: หากเครื่องเป็น IN_USE หรือ SWAPPED_PERMANENT
  let device: any = null;

  if (initialDevice.status === 'IN_USE' || initialDevice.status === 'SWAPPED_PERMANENT') {
    device = await prisma.backupDevice.findUnique({
      where: { id },
      include: {
        brand: true,
        images: true,
        jobs: false
      }
    });
    if (device) {
      device.jobs = [];
    }
  } else {
    const rawDevice = await prisma.backupDevice.findUnique({
      where: { id },
      include: {
        brand: true,
        images: true,
        jobs: {
          where: {
            OR: [
              { backupDeviceId: id },
              { status: 'SWAPPED_PERMANENT' },
              { status: 'FINAL_SWAPPED_PERMANENT' },
              { customerName: { contains: 'ซ่อมบำรุงในคลัง' } }
            ]
          },
          include: {
            stockLogs: {
              include: {
                sparePart: true,
                images: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    device = rawDevice;
  }

  if (!device) {
    notFound();
  }

  const brands = await prisma.brand.findMany({
    orderBy: { name: 'asc' }
  });

  const spareParts = await prisma.sparePart.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      qrModelCode: true,
      boardModelCode: true,
      boardSerialNumber: true,
      stock: true,
    },
    orderBy: { name: 'asc' }
  });

  const statusLabels: Record<string, string> = {
    AVAILABLE: 'พร้อมใช้งาน (ในคลัง)',
    IN_USE: 'กำลังถูกยืมใช้งาน',
    MAINTENANCE: 'กำลังซ่อมบำรุง / เครื่องเสีย',
    WAITING_DEYE_SEND: 'รอส่ง Deye',
    SENT_TO_DEYE: 'ส่งเครื่องไป Deye แล้ว',
    WAITING_DEYE_RETURN: 'รอส่งเครื่องกลับ',
    COMPLETED_BY_DEYE: 'ซ่อมเสร็จกลับมาแล้ว',
    SWAPPED_PERMANENT: 'สลับเปลี่ยนเครื่องสำรองให้ถาวร'
  };

  async function updateAction(deviceId: string, formData: FormData) {
    'use server';
    
    const status = formData.get('status') as string;

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

    // 🌟 ดึงข้อมูลสถานะล่าสุดจาก DB โดยตรงเพื่อป้องกันค่า null และเช็กเงื่อนไขเฉพาะ MAINTENANCE
    const currentDeviceDb = await prisma.backupDevice.findUnique({
      where: { id: deviceId },
      select: { status: true }
    });

    if (status === 'AVAILABLE' && currentDeviceDb?.status === 'MAINTENANCE') {
      const deviceWithLogs = await prisma.backupDevice.findUnique({
        where: { id: deviceId },
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

    const rawCategory = formData.get('category') as string;
    
    let category = rawCategory || 'อินเวอร์เตอร์';
    if (category === 'INVERTER' || category === 'Inv' || category === 'Inverter') {
      category = 'อินเวอร์เตอร์';
    }

    const brandId = formData.get('brandId') as string;
    const model = formData.get('model') as string;
    const serialNumber = formData.get('serialNumber') as string;
    const productNo = formData.get('productNo') as string;
    const customerName = formData.get('customerName') as string;
    const phone = formData.get('phone') as string;
    const note = formData.get('note') as string;
    const hasBox = formData.get('hasBox') === 'on';
    const hasWifiDongle = formData.get('hasWifiDongle') === 'on';
    const wifiDongleSn = formData.get('wifiDongleSn') as string;
    const deletedImageIdsStr = formData.get('deletedImageIds') as string;
    const deletedStockLogImageIdsStr = formData.get('deletedStockLogImageIds') as string;

    let deletedImageIds: string[] = [];
    try {
      if (deletedImageIdsStr) deletedImageIds = JSON.parse(deletedImageIdsStr);
    } catch (e) {}

    let deletedStockLogImageIds: string[] = [];
    try {
      if (deletedStockLogImageIdsStr) deletedStockLogImageIds = JSON.parse(deletedStockLogImageIdsStr);
    } catch (e) {}

    if (deletedImageIds.includes('nameplate')) {
      await prisma.backupDevice.update({
        where: { id: deviceId },
        data: { imageUrl: null }
      });
    }

    if (deletedImageIds.length > 0) {
      await prisma.backupDeviceImage.deleteMany({
        where: {
          id: { in: deletedImageIds.filter(item => item !== 'nameplate') },
          backupDeviceId: deviceId
        }
      });
    }

    if (deletedStockLogImageIds.length > 0) {
      await prisma.jobImage.deleteMany({
        where: {
          id: { in: deletedStockLogImageIds }
        }
      });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (e) {}

    const imageFile = formData.get('image') as File | null;
    let newImageUrl: string | undefined = undefined;
    if (imageFile && imageFile.size > 0) {
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const uniqueSuffix = crypto.randomUUID();
      const filename = `${Date.now()}-${uniqueSuffix}-${imageFile.name.replace(/\s+/g, '_')}`;
      try {
        await writeFile(path.join(uploadDir, filename), buffer);
        newImageUrl = filename;
      } catch (err) {
        console.error('File upload error:', err);
      }
    }

    const updateData: any = {
      status,
      category,
      brandId: brandId || null,
      model,
      serialNumber,
      productNo: productNo || null,
      customerName: customerName || null,
      phone: phone || null,
      note: note || null,
      hasBox,
      hasWifiDongle,
      wifiDongleSn: wifiDongleSn || null,
      userId: currentUserId || null,
      receiverId: currentUserId || null,
      receiverName: currentUserName || 'adminTMDA',
      ...(newImageUrl ? { imageUrl: newImageUrl } : {})
    };

    await prisma.backupDevice.update({
      where: { id: deviceId },
      data: updateData
    });

    revalidatePath(`/dashboard/inventory/backups/${deviceId}`);
    revalidatePath('/dashboard/inventory/backups');
  }

  async function addStockLogAction(deviceId: string, formData: FormData) {
    'use server';

    const sparePartId = formData.get('sparePartId') as string;
    const quantity = parseInt(formData.get('quantity') as string) || 1;
    const note = formData.get('note') as string;
    const imageFiles = formData.getAll('images') as File[];

    try {
      const result = await prisma.$transaction(async (tx) => {
        const sparePart = await tx.sparePart.findUnique({ where: { id: sparePartId } });
        if (!sparePart || sparePart.stock < quantity) {
          throw new Error('อะไหล่ในคลังไม่เพียงพอ');
        }

        let deviceRecord = await tx.backupDevice.findUnique({
          where: { id: deviceId },
          include: { jobs: true }
        });

        let targetJobId = deviceRecord?.jobs?.[0]?.id;

        if (!targetJobId) {
          const newJob = await tx.job.create({
            data: {
              jobNo: `MAINT-${Math.floor(100000 + Math.random() * 900000)}`,
              customerName: deviceRecord?.customerName || `ซ่อมบำรุงในคลัง: ${deviceRecord?.model}`,
              phone: deviceRecord?.phone || '-',
              status: 'IN_REPAIR',
              backupDeviceId: deviceId,
            }
          });
          targetJobId = newJob.id;
        }

        await tx.sparePart.update({
          where: { id: sparePartId },
          data: { stock: { decrement: quantity } }
        });

        const stockLog = await tx.stockLog.create({
          data: {
            jobId: targetJobId,
            sparePartId,
            quantity,
            type: 'USE_FOR_REPAIR',
            note: note || 'เบิกอะไหล่ซ่อมเครื่องสำรอง',
          }
        });

        return { targetJobId, stockLogId: stockLog.id };
      });

      if (imageFiles && imageFiles.length > 0) {
        for (const file of imageFiles) {
          if (file && file.size > 0) {
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);
            const uniqueSuffix = crypto.randomUUID();
            const filename = `${Date.now()}-${uniqueSuffix}-${file.name.replace(/\s+/g, '_')}`;
            const uploadDir = path.join(process.cwd(), 'public', 'uploads');
            try {
              await writeFile(path.join(uploadDir, filename), buffer);
              await prisma.jobImage.create({
                data: {
                  jobId: result.targetJobId,
                  stockLogId: result.stockLogId,
                  url: filename,
                  type: 'STOCK_LOG',
                }
              });
            } catch (err) {
              console.error('JobImage upload error:', err);
            }
          }
        }
      }

      revalidatePath(`/dashboard/inventory/backups/${deviceId}`);
      revalidatePath('/dashboard/inventory/backups');
      revalidatePath('/dashboard/inventory/boards');
    } catch (error: any) {
      console.error('Add stock log error:', error);
      throw new Error(error.message || 'เกิดข้อผิดพลาดในการเบิกอะไหล่');
    }
  }

  return (
    <div className="py-4 px-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <BackupDeviceFormClient 
        device={device}
        brands={brands}
        statusLabels={statusLabels}
        updateAction={updateAction}
      />
    </div>
  );
}