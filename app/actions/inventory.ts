'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// 1. เพิ่มบอร์ดอะไหล่ใหม่
export async function createNewBoard(formData: FormData) {
  const code = formData.get('code') as string;
  const name = formData.get('name') as string;
  const category = formData.get('category') as string;
  const quantity = Number(formData.get('quantity')) || 0;
  const minThreshold = Number(formData.get('minThreshold')) || 0;
  const unitPrice = Number(formData.get('unitPrice')) || 0;

  if (!code || !name || !category) {
    return { error: 'กรุณากรอกข้อมูลสำคัญให้ครบถ้วน' };
  }

  try {
    await prisma.sparePart.create({
      data: {
        code,
        name,
        category,
        stock: quantity,
        minQuantity: minThreshold,
      },
    });

    revalidatePath('/dashboard/inventory/boards');
    return { success: true };
  } catch (error) {
    return { error: 'ไม่สามารถบันทึกข้อมูลได้ (รหัสบอร์ดอาจซ้ำ)' };
  }
}

// 2. เติมสต็อกบอร์ดอะไหล่ที่มีอยู่แล้ว
export async function addBoardStock(formData: FormData) {
  const boardId = formData.get('boardId') as string;
  const quantity = Number(formData.get('quantity')) || 0;

  if (!boardId || quantity <= 0) {
    return { error: 'ระบุจำนวนที่ต้องการเพิ่มให้ถูกต้อง' };
  }

  try {
    await prisma.sparePart.update({
      where: { id: boardId },
      data: {
        stock: { increment: quantity },
      },
    });

    revalidatePath('/dashboard/inventory/boards');
    return { success: true };
  } catch (error) {
    return { error: 'ไม่สามารถเพิ่มสต็อกได้' };
  }
}

// 3. เพิ่มเครื่องสำรองใหม่
export async function createBackupDevice(formData: FormData) {
  const serialNumber = formData.get('serialNumber') as string;
  const brand = formData.get('brand') as string;
  const model = formData.get('model') as string;
  const category = formData.get('category') as string;

  if (!serialNumber || !model) {
    return { error: 'กรุณากรอก Serial Number และรุ่นเครื่องให้ครบถ้วน' };
  }

  try {
    const existing = await prisma.backupDevice.findUnique({
      where: { serialNumber },
    });

    if (existing) {
      return { error: 'ไม่สามารถบันทึกข้อมูลได้ (S/N ซ้ำในระบบ)' };
    }

    await prisma.backupDevice.create({
      data: {
        serialNumber,
        // 🌟 แก้ไขจุดที่เกิด Type Error โดยใช้ connect สำหรับ relation field
        brand: brand ? { connect: { id: brand } } : undefined,
        model,
        category: category || null,
        status: 'AVAILABLE',
      },
    });

    revalidatePath('/dashboard/inventory/backups');
    return { success: true };
  } catch (error) {
    console.error('Error creating backup device:', error);
    return { error: 'ไม่สามารถบันทึกข้อมูลได้ (S/N อาจซ้ำในระบบ หรือ Brand ID ไม่ถูกต้อง)' };
  }
}

// 4. ตัดเบิกบอร์ดอะไหล่เข้างานซ่อมหรือทั่วไป (Deduct Stock & Save Images)
export async function deductBoardStock(formData: FormData) {
  const boardId = formData.get('sparePartId') as string || formData.get('boardId') as string;
  const jobId = formData.get('jobId') as string;
  const quantity = Number(formData.get('quantity')) || 1;
  const note = formData.get('note') as string;
  const purposeType = formData.get('purposeType') as string;
  
  const boardImageBase64 = formData.get('boardImageBase64') as string;
  const qrImageBase64 = formData.get('qrImageBase64') as string;

  if (!boardId || quantity <= 0) {
    return { error: 'กรุณาระบุข้อมูลการเบิกให้ถูกต้อง' };
  }

  try {
    const sparePart = await prisma.sparePart.findUnique({ where: { id: boardId } });
    if (!sparePart || sparePart.stock < quantity) {
      return { error: 'จำนวนบอร์ดในคลังมีไม่เพียงพอ' };
    }

    // ทำรายการตัดสต็อกและบันทึก StockLog
    const stockLog = await prisma.$transaction(async (tx) => {
      // ตัดสต็อกอะไหล่
      await tx.sparePart.update({
        where: { id: boardId },
        data: { stock: { decrement: quantity } },
      });

      // บันทึกประวัติ StockLog
      const log = await tx.stockLog.create({
        data: {
          sparePartId: boardId,
          jobId: purposeType === 'JOB' ? jobId : null,
          type: purposeType === 'JOB' ? 'USE_FOR_REPAIR' : 'GENERAL_WITHDRAW',
          quantity: -quantity,
          note: note || 'ตัดเบิกเพื่อใช้งานซ่อม',
        },
      });

      // อัปเดตสถานะ Job เป็น IN_REPAIR อัตโนมัติ (ถ้าผูกกับใบงาน)
      if (purposeType === 'JOB' && jobId) {
        await tx.job.update({
          where: { id: jobId },
          data: { status: 'IN_REPAIR' },
        });
      }

      return log;
    });

    // บันทึกรูปภาพหลักฐานลง Disk และผูกกับ stockLogId (ถ้าผูกกับใบงานและมีรูป)
    if (purposeType === 'JOB' && jobId && (boardImageBase64 || qrImageBase64)) {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      try {
        await mkdir(uploadDir, { recursive: true });
      } catch (e) {}

      const saveBase64ToDisk = async (base64Str: string, prefix: string): Promise<string | null> => {
        if (!base64Str) return null;
        const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return null;
        const buffer = Buffer.from(matches[2], 'base64');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const filename = `${prefix}-${uniqueSuffix}.jpg`;
        const filepath = path.join(uploadDir, filename);
        await writeFile(filepath, buffer);
        return `/uploads/${filename}`;
      };

      if (boardImageBase64) {
        const boardUrl = await saveBase64ToDisk(boardImageBase64, 'fullboard');
        if (boardUrl) {
          await prisma.jobImage.create({
            data: {
              url: boardUrl,
              type: 'FULL_BOARD',
              jobId: jobId,
              stockLogId: stockLog.id,
            },
          });
        }
      }

      if (qrImageBase64) {
        const qrUrl = await saveBase64ToDisk(qrImageBase64, 'qrcode');
        if (qrUrl) {
          await prisma.jobImage.create({
            data: {
              url: qrUrl,
              type: 'QR_CODE',
              jobId: jobId,
              stockLogId: stockLog.id,
            },
          });
        }
      }
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/inventory/boards');
    revalidatePath('/dashboard/jobs');
    if (jobId) {
      revalidatePath(`/dashboard/jobs/${jobId}`);
    }
    return { success: true };
  } catch (error) {
    console.error('Error deducting board stock:', error);
    return { error: 'ไม่สามารถตัดเบิกบอร์ดได้' };
  }
}

// 5. คืนบอร์ดอะไหล่เข้าคลัง (Return Stock) พร้อมลบรูปหลักฐานและประวัติเบิกทิ้ง
export async function returnBoardStock(logId: string, jobId?: string) {
  try {
    const log = await prisma.stockLog.findUnique({ where: { id: logId } });
    if (!log) return { error: 'ไม่พบรายการเบิกนี้' };

    await prisma.$transaction([
      // 1. เพิ่มสต็อกอะไหล่กลับคืน
      prisma.sparePart.update({
        where: { id: log.sparePartId },
        data: { stock: { increment: Math.abs(log.quantity) } },
      }),
      // 2. ลบรูปหลักฐานทั้งหมดที่ผูกอยู่กับ StockLog นี้ออกจากหน้ารายละเอียดใบงานทันที
      prisma.jobImage.deleteMany({
        where: { stockLogId: logId },
      }),
      // 3. ลบประวัติ StockLog ทิ้ง เพื่อให้รายการเบิกหายไปจากหน้าประวัติการเบิกของใบงาน
      prisma.stockLog.delete({
        where: { id: logId },
      }),
    ]);

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/inventory/boards');
    revalidatePath('/dashboard/jobs');
    if (jobId || log.jobId) {
      revalidatePath(`/dashboard/jobs/${jobId || log.jobId}`);
    }
    return { success: true };
  } catch (error) {
    console.error('Error returning board stock:', error);
    return { error: 'ไม่สามารถคืนบอร์ดเข้าคลังได้' };
  }
}

// 6. ฟังก์ชันกลาง (Action Handler) สำหรับรองรับการส่งฟอร์มจากหน้า WithdrawClient.tsx
export async function handleWithdrawAction(formData: FormData) {
  const actionType = formData.get('actionType') as string; // 'WITHDRAW' หรือ 'RESTOCK'

  if (actionType === 'RESTOCK') {
    const stockLogId = formData.get('stockLogId') as string;
    const jobId = formData.get('jobId') as string;
    if (!stockLogId) {
      return { error: 'ไม่พบรหัสประวัติการเบิกที่ต้องการคืน' };
    }
    return await returnBoardStock(stockLogId, jobId);
  } else {
    return await deductBoardStock(formData);
  }
}