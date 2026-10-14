import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';

// GET: ดึงรายละเอียดใบงานรายตัวตาม ID พร้อมสต็อกและรูปภาพ
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        brand: true,
        stockLogs: {
          include: {
            sparePart: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        },
        images: true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({ job }, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch job detail:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT: อัปเดตข้อมูลใบงาน
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    
    const body = await request.json();
    const {
      status,
      customerName,
      phone,
      category,
      brandId,
      model,
      serialNumber,
      productNo,
      wifiDongleSn,
      note,
      backupDeviceId,
      hasBox,
      hasWifiDongle,
    } = body;

    // 🌟 0. ดึงข้อมูลผู้ใช้งานปัจจุบัน สำหรับบันทึก Audit Trail / ผู้บันทึก
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

    // 1. อัปเดตข้อมูลใบงานหลัก
    const updatedJob = await prisma.job.update({
      where: { id },
      data: {
        status: status || undefined,
        customerName: customerName || undefined,
        phone: phone || undefined,
        category: category || undefined,
        brandId: brandId || undefined,
        model: model || undefined,
        serialNumber: serialNumber || undefined,
        productNo: productNo || undefined,
        wifiDongleSn: wifiDongleSn || undefined,
        note: note !== undefined ? note : undefined,
        backupDeviceId: backupDeviceId !== undefined ? backupDeviceId : undefined,
        hasBox: hasBox !== undefined ? (hasBox === true || hasBox === 'true') : false,
        hasWifiDongle: hasWifiDongle !== undefined ? (hasWifiDongle === true || hasWifiDongle === 'true') : false,
      },
    });

    // 2. ถ้ามีการเลือกเครื่องสำรอง ให้บันทึกข้อมูล
    if (backupDeviceId) {
      await prisma.backupDevice.update({
        where: { id: backupDeviceId },
        data: {
          status: 'IN_USE',
          customerName: customerName || updatedJob.customerName,
          phone: phone || updatedJob.phone,
        },
      });
    }

    // 🌟 3.1 ถ้าเปลี่ยนสถานะเป็นการสลับเปลี่ยนเครื่องสำรองถาวร ให้บันทึกผู้บันทึกเป็น adminTMDA พร้อมดึงรูปภาพ
    const permanentSwapStatuses = ['SWAPPED_PERMANENT', 'FINAL_SWAPPED_PERMANENT'];
    if (status && permanentSwapStatuses.includes(status)) {
      const currentJobData = await prisma.job.findUnique({ 
        where: { id },
        include: { images: true }
      });
      
      if (currentJobData?.backupDeviceId) {
        const primaryImage = currentJobData.images.find(img => img.type?.includes('NAMEPLATE'))?.url || null;

        await prisma.backupDevice.update({
          where: { id: currentJobData.backupDeviceId },
          data: {
            status: 'SWAPPED_PERMANENT',
            receiverName: finalReceiverName, // 👈 บันทึกชื่อผู้บันทึกตรงนี้
            userId: validUserId,
            receiverId: validUserId,
            ...(primaryImage ? { imageUrl: primaryImage } : {}),
          },
        });

        // โอนย้ายรูปภาพสภาพเครื่องจาก Job ไปยัง BackupDeviceImage
        for (const img of currentJobData.images) {
          if (img.url && !img.type?.includes('NAMEPLATE')) {
            const existingImg = await prisma.backupDeviceImage.findFirst({
              where: { backupDeviceId: currentJobData.backupDeviceId, url: img.url }
            });
            if (!existingImg) {
              await prisma.backupDeviceImage.create({
                data: {
                  url: img.url,
                  type: 'CONDITION',
                  backupDeviceId: currentJobData.backupDeviceId,
                }
              });
            }
          }
        }
      }
    }

    // 3.2 หากเปลี่ยนสถานะเป็นปิดงาน/สำเร็จ/คืนเครื่องปกติ
    const completedStatuses = ['COMPLETED', 'SUCCESS', 'RETURNED', 'CLOSED', 'CANCELLED', 'COMPLETED_BY_DEYE', 'RETURNED_CUSTOMER_PICKUP', 'RETURNED_SHIPPED', 'RETURN_BACKUP_AND_DELIVER'];
    if (status && completedStatuses.includes(status)) {
      const currentJobData = await prisma.job.findUnique({ where: { id } });
      if (currentJobData?.backupDeviceId) {
        const targetBackup = await prisma.backupDevice.findUnique({ where: { id: currentJobData.backupDeviceId } });
        if (targetBackup?.status !== 'SWAPPED_PERMANENT') {
          await prisma.backupDevice.update({
            where: { id: currentJobData.backupDeviceId },
            data: {
              status: 'AVAILABLE',
              customerName: null,
              phone: null,
            },
          });
        }
      }
    }

    return NextResponse.json({ job: updatedJob }, { status: 200 });
  } catch (error) {
    console.error('Failed to update job:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE: ลบใบงาน
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const jobToDelete = await prisma.job.findUnique({ where: { id } });
    if (jobToDelete?.backupDeviceId) {
      await prisma.backupDevice.update({
        where: { id: jobToDelete.backupDeviceId },
        data: {
          status: 'AVAILABLE',
          customerName: null,
          phone: null,
        },
      });
    }

    await prisma.job.delete({
      where: { id },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Failed to delete job:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}