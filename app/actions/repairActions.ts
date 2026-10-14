'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function submitRepairWithInventoryDeduction(formData: FormData) {
  try {
    const jobId = formData.get('jobId') as string;
    const sparePartId = formData.get('sparePartId') as string;
    const technicianName = formData.get('technicianName') as string;
    
    const image1 = formData.get('image1') as File | null;
    const image2 = formData.get('image2') as File | null;

    // 1. ตรวจสอบข้อมูลเบื้องต้น
    if (!jobId || !sparePartId) {
      return { success: false, message: 'ข้อมูลใบงานหรือรหัสอะไหล่ไม่ถูกต้อง' };
    }

    // 🔒 2. กฎบังคับ Phase 2: ต้องมีรูปหลักฐานครบ 2 รูป
    if (!image1 || !image2 || image1.size === 0 || image2.size === 0) {
      return { 
        success: false, 
        message: '⚠️ กฎ Phase 2 บังคับ: กรุณาแนบรูปหลักฐานทั้ง 2 รูป (รูปเต็มบอร์ดเดิม และรูป QR Code บอร์ดเดิม)' 
      };
    }

    // 3. ตรวจสอบสต็อกอะไหล่ในฐานข้อมูล
    const sparePart = await prisma.sparePart.findUnique({
      where: { id: sparePartId },
    });

    if (!sparePart || sparePart.stock <= 0) {
      return { success: false, message: 'อะไหล่ที่เลือกหมด หรือไม่พบในคลัง' };
    }

    // 4. บันทึกรูปภาพลงในเซิร์ฟเวอร์ (จัดเก็บใน public/uploads)
    const saveImageToDisk = async (file: File, prefix: string) => {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filename = `${prefix}-${Date.now()}-${file.name.replace(/\s/g, '_')}`;
      const uploadDir = path.join(process.cwd(), 'public/uploads');
      const filepath = path.join(uploadDir, filename);
      
      await writeFile(filepath, buffer);
      return `/uploads/${filename}`;
    };

    const imageUrl1 = await saveImageToDisk(image1, 'repair-phase2-img1');
    const imageUrl2 = await saveImageToDisk(image2, 'repair-phase2-img2');

    // 5. ทำ Transaction อัปเดตฐานข้อมูลและผูก stockLogId กับรูปภาพ
    await prisma.$transaction(async (tx) => {
      // ตัดสต็อกอะไหล่ 1 ชิ้น
      await tx.sparePart.update({
        where: { id: sparePartId },
        data: { stock: { decrement: 1 } },
      });

      // อัปเดตสถานะใบงานเป็น IN_REPAIR
      await tx.job.update({
        where: { id: jobId },
        data: { status: 'IN_REPAIR' },
      });

      // สร้าง StockLog เพื่อเก็บประวัติการเบิก
      const stockLog = await tx.stockLog.create({
        data: {
          sparePartId: sparePartId,
          jobId: jobId,
          quantity: -1,
          type: 'USE_FOR_REPAIR',
          note: `เบิกอะไหล่เข้าใบงานโดยช่าง ${technicianName || 'ไม่ระบุชื่อ'} (Phase 2)`,
        },
      });

      // บันทึกรูปหลักฐานลงในตาราง JobImage โดยผูก stockLogId ไว้ด้วย
      await tx.jobImage.createMany({
        data: [
          { jobId, stockLogId: stockLog.id, url: imageUrl1 },
          { jobId, stockLogId: stockLog.id, url: imageUrl2 },
        ],
      });
    });

    // รีเฟรชหน้าจอ Dashboard และ Job Detail
    revalidatePath(`/dashboard/jobs/${jobId}`);
    revalidatePath('/dashboard/jobs');

    return { success: true, message: 'เบิกอะไหล่และอัปโหลดรูปหลักฐานสำเร็จ' };

  } catch (error: any) {
    console.error('Error in submitRepairWithInventoryDeduction:', error);
    return { success: false, message: error.message || 'เกิดข้อผิดพลาดในการประมวลผล' };
  }
}

// ฟังก์ชันปิดงานซ่อม
export async function completeRepairJob(jobId: string) {
  try {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        closedAt: new Date(),
      },
    });

    revalidatePath(`/dashboard/jobs/${jobId}`);
    revalidatePath('/dashboard/jobs');

    return { success: true, message: 'ปิดงานซ่อมสำเร็จเรียบร้อยแล้ว' };
  } catch (error: any) {
    console.error('Error completing job:', error);
    return { success: false, message: error.message || 'เกิดข้อผิดพลาดในการปิดงานซ่อม' };
  }
}