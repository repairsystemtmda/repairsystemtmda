// app/actions/workflow.ts
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';

export async function updateJobStatus(jobId: string, status: string) {
  try {
    // 🌟 1. ดึงข้อมูลผู้ใช้งานปัจจุบันสำหรับบันทึก Audit Trail / ผู้บันทึก
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

    const updateData: any = { status };

    if (status === 'COMPLETED') {
      updateData.closedAt = new Date();
    }

    // อัปเดตสถานะ Job
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: updateData,
      include: { backupDevice: true }
    });

    // 🌟 2. หาก Job นี้ผูกกับ BackupDevice อยู่ ให้ซิงค์อัปเดตผู้บันทึก (receiverName) ไปที่ BackupDevice ด้วยทันที
    if (updatedJob.backupDeviceId) {
      await prisma.backupDevice.update({
        where: { id: updatedJob.backupDeviceId },
        data: {
          receiverId: currentUserId || null,
          receiverName: finalReceiverName,
        }
      });
    }

    revalidatePath(`/jobs/${jobId}`);
    revalidatePath('/jobs');
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/inventory/backups');
    return { success: true };
  } catch (error) {
    console.error('Update status error:', error);
    return { error: 'ไม่สามารถอัปเดตสถานะได้' };
  }
}