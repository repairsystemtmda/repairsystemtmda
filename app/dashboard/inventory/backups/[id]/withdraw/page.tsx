import prisma from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import WithdrawForm from '../_components/WithdrawForm';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// สร้าง Supabase Client สำหรับอัปโหลดไฟล์ไปที่ Storage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = "repair-images";

export default async function BackupWithdrawPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;

  const device = await prisma.backupDevice.findUnique({
    where: { id },
    include: {
      brand: true,
      jobs: true,
    }
  });

  if (!device) {
    notFound();
  }

  const currentDevice = device;

  const spareParts = await prisma.sparePart.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      qrModelCode: true,
      boardModelCode: true,
      stock: true,
      location: true,
      model: true,
    },
    orderBy: { name: 'asc' }
  });

  async function submitWithdrawAction(formData: FormData) {
    'use server';

    const sparePartId = formData.get('sparePartId') as string;
    // 1. แปลงค่า quantity ให้เป็นค่าติดลบเสมอ เพื่อให้ถูกต้องกับการตัดสต็อกและบันทึก Log
    const rawQuantity = parseInt(formData.get('quantity') as string || '1', 10);
    const quantity = -Math.abs(rawQuantity); 
    
    const note = formData.get('note') as string;
    const imageFiles = formData.getAll('images') as File[];

    if (!sparePartId) {
      throw new Error('กรุณาเลือกอะไหล่');
    }

    // ตรวจสอบไฟล์รูปภาพหลักฐาน
    const validImages = imageFiles.filter(file => file && file.size > 0);
    if (validImages.length === 0) {
      throw new Error('กรุณาอัปโหลดรูปภาพหลักฐานก่อนทำการเบิกอะไหล่ (บังคับใส่รูป)');
    }

    // 2. ค้นหา User ปัจจุบันจาก Session เพื่อบันทึกชื่อผู้ทำรายการให้ถูกต้อง
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
      // ข้ามหากเกิดข้อผิดพลาดในการดึง session
    }

    if (!currentUserId) {
      const fallbackUser = await prisma.user.findFirst();
      currentUserId = fallbackUser?.id;
    }

    try {
      // อัปโหลดรูปภาพทั้งหมดขึ้น Supabase Storage ก่อนทำ Transaction
      const uploadedImageUrls: string[] = [];

      for (const file of validImages) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const uniqueSuffix = crypto.randomUUID();
        const filename = `${Date.now()}-${uniqueSuffix}-${file.name.replace(/\s+/g, '_')}`;
        const filePath = `backup-withdraws/${id}/${filename}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filePath, buffer, {
            contentType: file.type,
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`ไม่สามารถอัปโหลดรูปภาพได้: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath);

        uploadedImageUrls.push(publicUrlData.publicUrl);
      }

      await prisma.$transaction(async (tx) => {
        const sparePart = await tx.sparePart.findUnique({ where: { id: sparePartId } });
        // ตรวจสอบสต็อก (ใช้ Math.abs เพราะ quantity ในฐานข้อมูลตัวแปรนี้เก็บเป็นค่าติดลบ)
        if (!sparePart || sparePart.stock < Math.abs(quantity)) {
          throw new Error('อะไหล่ในคลังไม่เพียงพอ');
        }

        let targetJob = currentDevice.jobs?.[0];
        if (!targetJob) {
          targetJob = await tx.job.create({
            data: {
              jobNo: `BK-JOB-${Math.floor(100000 + Math.random() * 900000)}`,
              customerName: currentDevice.customerName || `ซ่อมเครื่องสำรอง: ${currentDevice.model}`,
              phone: currentDevice.phone || '-',
              status: 'IN_REPAIR',
              backupDeviceId: id,
              userId: currentUserId,
            }
          });
        }

        // ตัดสต็อกโดยใช้ค่า decrement ตามจำนวนจริงที่ใส่เข้ามา
        await tx.sparePart.update({
          where: { id: sparePartId },
          data: { stock: { decrement: Math.abs(quantity) } }
        });

        const stockLog = await tx.stockLog.create({
          data: {
            jobId: targetJob.id,
            sparePartId,
            quantity: quantity, // บันทึกเป็นค่าติดลบ
            type: 'USE_FOR_REPAIR',
            note: note || 'เบิกอะไหล่ซ่อมเครื่องสำรอง',
            userId: currentUserId,
          }
        });

        // วนลูปบันทึก URL รูปภาพลงฐานข้อมูล
        for (const imageUrl of uploadedImageUrls) {
          await tx.jobImage.create({
            data: {
              jobId: targetJob.id,
              stockLogId: stockLog.id,
              url: imageUrl,
              type: 'STOCK_LOG',
            }
          });
        }
      });

      revalidatePath(`/dashboard/inventory/backups/${id}`);
      revalidatePath('/dashboard/inventory/backups');
      revalidatePath('/dashboard/inventory/logs');
    } catch (error: any) {
      console.error('Withdraw error:', error);
      throw new Error(error.message || 'เกิดข้อผิดพลาดในการเบิกอะไหล่');
    }

    redirect(`/dashboard/inventory/backups/${id}`);
  }

  return (
    <WithdrawForm
      deviceId={id}
      deviceModel={currentDevice.model}
      deviceSerial={currentDevice.serialNumber}
      spareParts={spareParts}
      submitAction={submitWithdrawAction}
    />
  );
}