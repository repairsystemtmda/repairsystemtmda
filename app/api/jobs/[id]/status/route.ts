import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id;
    const body = await request.json();
    const { status, sparePartId, quantity } = body;

    if (!status) {
      return NextResponse.json(
        { error: "กรุณาระบุสถานะที่ต้องการเปลี่ยน" },
        { status: 400 }
      );
    }

    const existingJob = await prisma.job.findUnique({
      where: { id: jobId },
      include: { backupDevice: true, images: true, stockLogs: true },
    });

    if (!existingJob) {
      return NextResponse.json(
        { error: "ไม่พบใบงานซ่อมนี้ในระบบ" },
        { status: 404 }
      );
    }

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

    let formattedCategory = existingJob.category || 'อินเวอร์เตอร์';
    if (formattedCategory === 'INVERTER' || formattedCategory === 'Inv' || formattedCategory === 'Inverter' || formattedCategory.toLowerCase() === 'inverter') {
      formattedCategory = 'อินเวอร์เตอร์';
    }

    const isPermanentSwapStatus = 
      status === "SWAPPED_PERMANENT" || 
      status === "FINAL_SWAPPED_PERMANENT" || 
      status.includes("PERMANENT") ||
      status.includes("ถาวร");

    const result = await prisma.$transaction(async (tx) => {
      const updatedJob = await tx.job.update({
        where: { id: jobId },
        data: { 
          status: status,
          ...((
            status === "RETURNED_CUSTOMER_PICKUP" || 
            status === "RETURNED_SHIPPED" || 
            status === "SWAPPED_BACKUP_DEVICE" || 
            isPermanentSwapStatus ||
            status === "CANCELLED"
          ) && {
            closedAt: new Date(),
          })
        },
      });

      if (status === "COMPLETED" && sparePartId) {
        const qtyToDeduct = quantity || 1;

        const part = await tx.sparePart.findUnique({
          where: { id: sparePartId },
        });

        if (!part || part.stock < qtyToDeduct) {
          throw new Error(`อะไหล่ ${part?.name || ""} ในคลังไม่เพียงพอสำหรับตัดสต็อก`);
        }

        await tx.sparePart.update({
          where: { id: sparePartId },
          data: { stock: { decrement: qtyToDeduct } },
        });

        await tx.stockLog.create({
          data: {
            sparePartId: sparePartId,
            jobId: jobId,
            quantity: -qtyToDeduct,
            type: "USE_FOR_REPAIR",
            note: `ตัดสต็อกอัตโนมัติจากใบงาน ${existingJob.jobNo}`,
          },
        });
      }

      if (
        (status === "BACKUP_RETURNED" || 
         status === "RETURNED_CUSTOMER_PICKUP" || 
         status === "RETURNED_SHIPPED") && 
        existingJob.backupDeviceId
      ) {
        await tx.backupDevice.update({
          where: { id: existingJob.backupDeviceId },
          data: { 
            status: "AVAILABLE",
            currentJobId: null
          },
        });
      }

      if (status === "SWAPPED_BACKUP_DEVICE" && existingJob.backupDeviceId) {
        await tx.backupDevice.update({
          where: { id: existingJob.backupDeviceId },
          data: { 
            status: "SWAPPED",
          },
        });
      }

      if (isPermanentSwapStatus && existingJob.backupDeviceId) {
        // 1. อัปเดตเครื่องสำรองตัวเดิมเป็น SWAPPED_PERMANENT
        await tx.backupDevice.update({
          where: { id: existingJob.backupDeviceId },
          data: { 
            status: "SWAPPED_PERMANENT",
            customerName: existingJob.customerName || null,
            phone: existingJob.phone || null,
            receiverName: finalReceiverName, 
            userId: validUserId,
            receiverId: validUserId,
          },
        });

        const primaryImage = existingJob.images.find(img => !img.stockLogId && (img.type === 'NAMEPLATE' || img.type === 'nameplate'))?.url || null;

        // 2. สร้างเครื่องใหม่ในคลังสำหรับเครื่องของลูกค้า พร้อมโอนย้ายสถานะกล่องและ WiFi
        const newCustomerBackupDevice = await tx.backupDevice.create({
          data: {
            status: "AVAILABLE",
            category: formattedCategory,
            model: existingJob.model || '',
            brandId: existingJob.brandId || null,
            serialNumber: existingJob.serialNumber || `CUST-${Date.now()}`,
            productNo: (existingJob as any).productNo || null,
            customerName: null,
            phone: null,
            receiverName: finalReceiverName,
            userId: validUserId,
            receiverId: validUserId,
            imageUrl: primaryImage,
            hasBox: existingJob.hasBox || false,
            hasWifiDongle: existingJob.hasWifiDongle || false,
            wifiDongleSn: (existingJob as any).wifiDongleSn || null,
          },
        });

        // 🌟 3. อัปเดตโยกย้าย backupDeviceId ของใบงานนี้ ให้มาผูกกับเครื่องใหม่ในคลังทันที
        await tx.job.update({
          where: { id: jobId },
          data: {
            backupDeviceId: newCustomerBackupDevice.id,
          },
        });

        // 4. โอนย้ายรูปภาพสภาพเครื่องไปยังเครื่องใหม่
        for (const img of existingJob.images) {
          const isNameplate = img.type === 'NAMEPLATE' || img.type === 'nameplate';
          const isStockRelated = Boolean(img.stockLogId) || img.type?.startsWith('STOCK_');

          if (img.url && !isNameplate && !isStockRelated) {
            const existingImg = await tx.backupDeviceImage.findFirst({
              where: { backupDeviceId: newCustomerBackupDevice.id, url: img.url }
            });
            if (!existingImg) {
              await tx.backupDeviceImage.create({
                data: {
                  url: img.url,
                  type: 'CONDITION',
                  backupDeviceId: newCustomerBackupDevice.id,
                }
              });
            }
          }
        }
      }

      return updatedJob;
    });

    return NextResponse.json({
      success: true,
      message: "อัปเดตสถานะและจัดการสต็อกเรียบร้อยแล้ว",
      data: result,
    });

  } catch (error: any) {
    console.error("Error updating job status:", error);
    return NextResponse.json(
      { error: error.message || "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" },
      { status: 500 }
    );
  }
}