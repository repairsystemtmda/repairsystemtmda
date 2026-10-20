import prisma from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import WithdrawForm from '../_components/WithdrawForm';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = "repair-images";

interface ItemPayload {
  sparePartId: string;
  quantity: number;
}

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

    const note = formData.get('note') as string;
    const itemsJson = formData.get('itemsJson') as string;

    if (!itemsJson) {
      throw new Error('กรุณาระบุรายการอะไหล่ที่ต้องการเบิก');
    }

    let items: ItemPayload[] = [];
    try {
      items = JSON.parse(itemsJson);
    } catch (e) {
      throw new Error('รูปแบบข้อมูลรายการอะไหล่ไม่ถูกต้อง');
    }

    if (!items || items.length === 0) {
      throw new Error('กรุณาเลือกรายการอะไหล่อย่างน้อย 1 รายการ');
    }

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

    async function uploadFileToSupabase(file: File, prefix: string) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const uniqueSuffix = crypto.randomUUID();
      const filename = `${Date.now()}-${uniqueSuffix}-${file.name.replace(/\s+/g, '_')}`;
      const filePath = `backup-withdraws/${id}/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, buffer, {
          contentType: file.type || 'image/jpeg',
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

    try {
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const sparePart = await tx.sparePart.findUnique({ where: { id: item.sparePartId } });
          if (!sparePart) throw new Error(`ไม่พบข้อมูลอะไหล่ในรายการที่ ${i + 1}`);

          if (sparePart.stock < item.quantity) {
            throw new Error(`อะไหล่ "${sparePart.name}" ในคลังมีไม่พอเบิก (คงเหลือ ${sparePart.stock} ชิ้น)`);
          }

          const image1 = formData.get(`image1_${i}`) as File | null;
          const image2 = formData.get(`image2_${i}`) as File | null;

          if (!image1 || !image2 || image1.size === 0 || image2.size === 0) {
            throw new Error(`กรุณาแนบรูปถ่ายหลักฐานทั้ง 2 รูป (เต็มบอร์ด และ QR Code) ในรายการที่ ${i + 1}`);
          }
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

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const image1 = formData.get(`image1_${i}`) as File;
          const image2 = formData.get(`image2_${i}`) as File;

          await tx.sparePart.update({
            where: { id: item.sparePartId },
            data: { stock: { decrement: item.quantity } }
          });

          const stockLog = await tx.stockLog.create({
            data: {
              jobId: targetJob.id,
              sparePartId: item.sparePartId,
              quantity: -item.quantity,
              type: 'USE_FOR_REPAIR',
              note: note || 'เบิกอะไหล่ซ่อมเครื่องสำรองพร้อมหลักฐาน',
              userId: currentUserId,
            }
          });

          const url1 = await uploadFileToSupabase(image1, 'board');
          const url2 = await uploadFileToSupabase(image2, 'qr');

          await tx.jobImage.createMany({
            data: [
              { jobId: targetJob.id, stockLogId: stockLog.id, url: url1, type: 'STOCK_LOG' },
              { jobId: targetJob.id, stockLogId: stockLog.id, url: url2, type: 'STOCK_LOG' },
            ]
          });
        }
      });

      revalidatePath(`/dashboard/inventory/backups/${id}`);
      revalidatePath('/dashboard/inventory/backups');
      revalidatePath('/dashboard/inventory/logs');
    } catch (error: any) {
      const errString = error?.message || String(error);
      if (errString.includes('NEXT_REDIRECT') || error?.digest?.startsWith('NEXT_REDIRECT')) {
        throw error;
      }

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