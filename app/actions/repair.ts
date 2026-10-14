'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function createRepairJob(formData: FormData) {
  const customerName = (formData.get('customerName') as string) || '';
  const serialNumber = (formData.get('serialNumber') as string) || '';
  const category = (formData.get('category') as string) || 'INVERTER';
  const symptom = (formData.get('issueDescription') as string) || '';

  if (!customerName || !serialNumber) {
    return { error: 'กรุณากรอกชื่อลูกค้าและ Serial Number ให้ครบถ้วน' };
  }

  try {
    const count = await prisma.job.count();
    const currentYear = new Date().getFullYear();
    const jobNo = `JOB-${currentYear}-${String(count + 1).padStart(3, '0')}`;

    await prisma.job.create({
      data: {
        jobNo,
        customerName,
        serialNumber,
        category,
        note: symptom, // บันทึกลงฟิลด์ note (ตาม Prisma Schema ของตาราง Job)
        status: 'RECEIVED',
      },
    });

    revalidatePath('/jobs');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('Prisma Error:', error);
    return { error: `ไม่สามารถบันทึกได้: ${error?.message || 'ข้อผิดพลาดไม่ทราบสาเหตุ'}` };
  }
}