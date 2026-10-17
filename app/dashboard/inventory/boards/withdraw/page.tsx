export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import WithdrawClient from './WithdrawClient';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

// สร้าง Supabase Client สำหรับอัปโหลดไฟล์ไปที่ Storage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = "repair-images";

async function handleWithdrawAction(formData: FormData) {
  'use server';
  
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id; 

  let validUserId: string | null = null;
  if (sessionUserId) {
    const userInDb = await prisma.user.findUnique({
      where: { id: String(sessionUserId) },
      select: { id: true }
    });
    if (userInDb) {
      validUserId = userInDb.id;
    }
  }

  const actionType = formData.get('actionType') as string;
  const purposeType = formData.get('purposeType') as string;
  const sparePartId = formData.get('sparePartId') as string;
  const quantityStr = formData.get('quantity') as string;
  const note = formData.get('note') as string;

  if (!sparePartId || !quantityStr) {
    throw new Error('กรุณาเลือกอะไหล่และระบุจำนวน');
  }

  const quantity = parseInt(quantityStr, 10);
  if (quantity <= 0) {
    throw new Error('จำนวนต้องมากกว่า 0');
  }

  // 1. กรณีเลือก "คืนเข้าคลัง" (RESTOCK)
  if (actionType === 'RESTOCK') {
    await prisma.$transaction(async (tx) => {
      if (purposeType === 'JOB') {
        const stockLogId = formData.get('stockLogId') as string;
        if (!stockLogId) throw new Error('กรุณาเลือกรายการประวัติการเบิกที่ต้องการคืน');

        const log = await tx.stockLog.findUnique({ where: { id: stockLogId } });
        if (!log) throw new Error('ไม่พบประวัติการเบิกนี้ในระบบ');

        const maxQty = Math.abs(log.quantity);
        if (quantity > maxQty) {
          throw new Error(`ไม่สามารถคืนเกินจำนวนที่เคยเบิกไปได้ (${maxQty} ชิ้น)`);
        }

        await tx.sparePart.update({
          where: { id: log.sparePartId },
          data: { stock: { increment: quantity } },
        });

        if (quantity === maxQty) {
          await tx.jobImage.deleteMany({ where: { stockLogId: stockLogId } });
          await tx.stockLog.delete({ where: { id: stockLogId } });
        } else {
          await tx.stockLog.update({
            where: { id: stockLogId },
            data: { 
              quantity: log.quantity + quantity,
              userId: validUserId || log.userId 
            }
          });
        }
      } else {
        await tx.sparePart.update({
          where: { id: sparePartId },
          data: { stock: { increment: quantity } },
        });

        await tx.stockLog.create({
          data: {
            sparePartId,
            quantity: quantity,
            type: 'RESTOCK',
            note: note || 'คืนอะไหล่เข้าคลัง (ทั่วไป)',
            userId: validUserId, 
          },
        });
      }
    });

    redirect('/dashboard/inventory/boards');
  }

  // 2. กรณีเลือก "ตัดเบิกใช้งาน" (WITHDRAW)
  const jobId = formData.get('jobId') as string;
  const boardImageBase64 = formData.get('boardImageBase64') as string;
  const qrImageBase64 = formData.get('qrImageBase64') as string;

  if (purposeType === 'JOB' && (!boardImageBase64 || !qrImageBase64)) {
    throw new Error('กรุณาถ่ายรูปเต็มบอร์ดและรูปถ่าย QR Code ให้ครบถ้วนก่อนทำการเบิกอะไหล่');
  }

  const uploadedImageUrls: string[] = [];
  if (purposeType === 'JOB' && (boardImageBase64 || qrImageBase64)) {
    
    // ฟังก์ชันช่วยอัปโหลด Base64 ขึ้น Supabase Storage
    async function uploadBase64ToSupabase(base64Str: string, prefix: string) {
      if (!base64Str || !base64Str.includes('base64,')) return null;
      const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) return null;
      
      const buffer = Buffer.from(matches[2], 'base64');
      const ext = matches[1].split('/')[1] || 'jpg';
      const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
      const filePath = `board-withdraws/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, buffer, {
          contentType: matches[1],
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`ไม่สามารถอัปโหลดรูปภาพได้: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    }

    if (boardImageBase64) {
      const savedUrl = await uploadBase64ToSupabase(boardImageBase64, 'board');
      if (savedUrl) uploadedImageUrls.push(savedUrl);
    }
    if (qrImageBase64) {
      const savedUrl = await uploadBase64ToSupabase(qrImageBase64, 'qr');
      if (savedUrl) uploadedImageUrls.push(savedUrl);
    }
  }

  // ระบบอัจฉริยะตรวจสอบและหา Job ID รองรับทั้ง Job ปกติและ BackupDevice ID
  let validJobId: string | null = null;
  if (purposeType === 'JOB' && jobId && jobId.trim() !== '') {
    const cleanId = jobId.trim();
    
    const jobInDb = await prisma.job.findUnique({
      where: { id: cleanId },
      select: { id: true }
    });

    if (jobInDb) {
      validJobId = jobInDb.id;
    } else {
      const backupInDb = await prisma.backupDevice.findUnique({
        where: { id: cleanId },
        include: { jobs: { orderBy: { createdAt: 'desc' } } }
      });

      if (backupInDb) {
        if (backupInDb.jobs.length > 0) {
          validJobId = backupInDb.jobs[0].id;
        } else {
          const newJob = await prisma.job.create({
            data: {
              jobNo: `BK-${backupInDb.serialNumber || Date.now()}`,
              customerName: '[ซ่อมบำรุงในคลัง]',
              model: backupInDb.model || '-',
              serialNumber: backupInDb.serialNumber || '',
              status: 'IN_REPAIR',
              backupDeviceId: backupInDb.id,
            }
          });
          validJobId = newJob.id;
        }
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    const part = await tx.sparePart.findUnique({ where: { id: sparePartId } });
    if (!part) throw new Error('ไม่พบข้อมูลอะไหล่');

    if (part.stock < quantity) {
      throw new Error('อะไหล่ในคลังมีไม่พอเบิก');
    }

    await tx.sparePart.update({
      where: { id: sparePartId },
      data: { stock: part.stock - quantity },
    });

    const stockLog = await tx.stockLog.create({
      data: {
        jobId: validJobId,
        sparePartId: sparePartId,
        quantity: -quantity,
        type: purposeType === 'JOB' ? 'USE_FOR_REPAIR' : 'GENERAL_WITHDRAW',
        note: note || (purposeType === 'JOB' ? 'เบิกอะไหล่ซ่อมพร้อมหลักฐาน' : 'เบิกส่งสาขา/หน้างานทั่วไป'),
        userId: validUserId,
      },
    });

    if (validJobId && uploadedImageUrls.length > 0) {
      for (const url of uploadedImageUrls) {
        await tx.jobImage.create({
          data: {
            url: url,
            jobId: validJobId,
            stockLogId: stockLog.id,
          },
        });
      }
    }
  });

  redirect('/dashboard/inventory/boards');
}

export default async function WithdrawPage() {
  const spareParts = await prisma.sparePart.findMany({
    orderBy: { name: 'asc' },
  });

  const jobsFromDb = await prisma.job.findMany({
    where: {
      status: { 
        notIn: [
          'DELETED', 'CANCEL', 'CANCELED', 'REMOVE', 'EXCLUDED', 'INACTIVE',
          'COMPLETED', 'SUCCESS', 'CLOSED', 'DELIVERED', 'FINISH', 'DONE',
          'IN_USE', 'BORROWED'
        ] 
      },
      NOT: {
        OR: [
          { customerName: { contains: 'เครื่องสำรอง' } },
          { customerName: { contains: 'ซ่อมบำรุงในคลัง' } },
          { customerName: { startsWith: '[' } },
          { status: { contains: 'BACKUP' } }
        ]
      }
    },
    orderBy: { createdAt: 'desc' },
    include: {
      stockLogs: {
        include: {
          sparePart: true,
        }
      }
    }
  });

  const formattedJobs = jobsFromDb.map(job => {
    const fullSn = job.serialNumber || '';
    const snLast4 = fullSn.length >= 4 ? fullSn.slice(-4) : fullSn;

    return {
      id: job.id,
      jobNo: job.jobNo,
      customerName: job.customerName || 'ไม่ระบุชื่อลูกค้า',
      model: job.model || '-',
      serialNumber: fullSn,
      serialNumberLast4: snLast4,
      status: job.status, 
      withdrawnParts: job.stockLogs.map(log => ({
        stockLogId: log.id,
        sparePartId: log.sparePartId,
        sparePartName: log.sparePart.name,
        sparePartCode: log.sparePart.code,
        quantity: Math.abs(log.quantity)
      }))
    };
  });

  const backupsFromDb = await prisma.backupDevice.findMany({
    where: {
      status: {
        in: ['MAINTENANCE', 'IN_REPAIR']
      },
      serialNumber: {
        not: ''
      }
    },
    orderBy: { createdAt: 'desc' },
    include: {
      jobs: {
        orderBy: { createdAt: 'desc' },
        include: {
          stockLogs: {
            include: {
              sparePart: true
            }
          }
        }
      }
    }
  });

  const formattedBackups = backupsFromDb
    .filter(backup => backup.serialNumber && backup.serialNumber.trim() !== '' && backup.serialNumber !== '-')
    .map(backup => {
      const fullSn = backup.serialNumber || '';
      const snLast4 = fullSn.length >= 4 ? fullSn.slice(-4) : fullSn;
      const associatedStockLogs = backup.jobs.flatMap(j => j.stockLogs);
      const targetId = backup.jobs[0]?.id || backup.id;

      return {
        id: targetId,
        jobNo: `BACKUP-${fullSn}`,
        customerName: '[ซ่อมบำรุงในคลัง]',
        model: backup.model || '-',
        serialNumber: fullSn,
        serialNumberLast4: snLast4,
        status: `BACKUP_${backup.status}`, 
        withdrawnParts: associatedStockLogs.map(log => ({
          stockLogId: log.id,
          sparePartId: log.sparePartId,
          sparePartName: log.sparePart.name,
          sparePartCode: log.sparePart.code,
          quantity: Math.abs(log.quantity)
        }))
      };
    });

  const allJobs = [...formattedJobs, ...formattedBackups];

  return (
    <WithdrawClient 
      spareParts={spareParts} 
      jobs={allJobs} 
      actionHandler={handleWithdrawAction} 
    />
  );
}