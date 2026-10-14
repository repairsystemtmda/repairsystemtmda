import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import JobRestockClient from './JobRestockClient';

async function handleJobRestockAction(formData: FormData) {
  'use server';
  
  // 📌 ดึงข้อมูลผู้ใช้งานที่กำลังล็อกอินอยู่
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

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

  await prisma.$transaction(async (tx) => {
    if (purposeType === 'JOB') {
      const stockLogId = formData.get('stockLogId') as string;
      if (!stockLogId) throw new Error('กรุณาเลือกรายการประวัติการเบิกที่ต้องการคืน');

      const log = await tx.stockLog.findUnique({ 
        where: { id: stockLogId },
        include: { images: true } 
      });
      if (!log) throw new Error('ไม่พบประวัติการเบิกนี้ในระบบ');

      const maxQty = Math.abs(log.quantity);
      if (quantity > maxQty) {
        throw new Error(`ไม่สามารถคืนเกินจำนวนที่เคยเบิกไปได้ (${maxQty} ชิ้น)`);
      }

      // 1. เพิ่มจำนวนสต็อกกลับเข้าคลังอะไหล่
      await tx.sparePart.update({
        where: { id: log.sparePartId },
        data: { stock: { increment: quantity } },
      });

      // 2. บันทึกประวัติการคืนลงใน Audit Logs พร้อมใส่ userId
      const newRestockLog = await tx.stockLog.create({
        data: {
          sparePartId: log.sparePartId,
          jobId: log.jobId,
          quantity: quantity, 
          type: 'RESTOCK',
          note: note ? `คืนจากงานซ่อม: ${note}` : 'คืนอะไหล่เข้าคลังจากงานซ่อม',
          userId: userId || null, // 📌 บันทึกไอดีผู้ทำรายการจริง
        },
      });

      // 3. ย้ายหรือคัดลอกรูปภาพหลักฐานเดิมมาผูกกับ Log การคืน
      if (log.images && log.images.length > 0) {
        for (const img of log.images) {
          const typedImg = img as {
            jobId?: string | null;
            url?: string | null;
            imageUrl?: string | null;
            path?: string | null;
            type?: string | null;
            imageType?: string | null;
          };
          
          const imageUrl = typedImg.url || typedImg.imageUrl || typedImg.path || '';
          if (imageUrl && typedImg.jobId) {
            await tx.jobImage.create({
              data: {
                jobId: typedImg.jobId,
                stockLogId: newRestockLog.id, 
                url: imageUrl,
                type: typedImg.type || typedImg.imageType || 'STOCK_LOG',
              },
            });
          }
        }
      }

      // 4. ปรับลดจำนวนใน Log การเบิกเดิม โดยไม่ลบทิ้ง เพื่อคงประวัติและรูปภาพไว้
      const remainingQty = maxQty - quantity;
      if (remainingQty <= 0) {
        await tx.stockLog.update({
          where: { id: stockLogId },
          data: { quantity: 0 }
        });
      } else {
        await tx.stockLog.update({
          where: { id: stockLogId },
          data: { quantity: log.quantity < 0 ? -remainingQty : remainingQty }
        });
      }
    } else {
      await tx.sparePart.update({
        where: { id: sparePartId },
        data: { stock: { increment: quantity } },
      });

      // บันทึกประวัติกรณีทั่วไป พร้อมใส่ userId
      await tx.stockLog.create({
        data: {
          sparePartId,
          quantity: quantity,
          type: 'RESTOCK',
          note: note || 'คืนอะไหล่เข้าคลัง (ทั่วไป)',
          userId: userId || null, // 📌 บันทึกไอดีผู้ทำรายการจริง
        },
      });
    }
  });

  redirect('/dashboard/inventory/boards');
}

export default async function JobRestockPage() {
  const spareParts = await prisma.sparePart.findMany({
    orderBy: { name: 'asc' },
  });

  const jobsFromDb = await prisma.job.findMany({
    where: {
      stockLogs: {
        some: {
          quantity: { not: 0 } 
        } 
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
        where: { quantity: { not: 0 } }, 
        include: { sparePart: true }
      }
    }
  });

  const formattedJobs = jobsFromDb.map(job => {
    const fullSn = job.serialNumber || '';
    const snLast4 = fullSn.length >= 4 ? fullSn.slice(-4) : fullSn;

    return {
      id: `job-${job.id}`, // 👈 เติม prefix ป้องกัน id ชนกัน
      jobNo: job.jobNo,
      customerName: job.customerName || 'ไม่ระบุชื่อลูกค้า',
      model: job.model || '-',
      serialNumber: fullSn,
      serialNumberLast4: snLast4,
      status: job.status || 'กำลังซ่อม', 
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
      status: { in: ['READY', 'AVAILABLE'] },
      serialNumber: { not: '' },
      jobs: {
        some: {
          stockLogs: { some: { quantity: { not: 0 } } }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    include: {
      jobs: {
        include: {
          stockLogs: {
            where: { quantity: { not: 0 } },
            include: { sparePart: true }
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

      return {
        id: `backup-${backup.id}`, // 👈 เติม prefix ป้องกัน id ชนกัน
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

  const allRestockJobs = [...formattedJobs, ...formattedBackups];

  return (
    <JobRestockClient 
      spareParts={spareParts} 
      jobs={allRestockJobs} 
      actionHandler={handleJobRestockAction} 
    />
  );
}