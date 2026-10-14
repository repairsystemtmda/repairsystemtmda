import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // 📌 นำเข้าคอนฟิก Auth ให้ถูกต้อง

// POST: เบิกอะไหล่สำหรับใบงานซ่อม
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 📌 ดึงข้อมูลผู้ใช้งานที่กำลังล็อกอินอยู่จริง
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    const jobId = params.id;
    const body = await request.json();
    const { sparePartId, quantity, note } = body;

    if (!sparePartId || !quantity) {
      return NextResponse.json(
        { error: "กรุณาระบุอะไหล่และจำนวนที่ต้องการเบิก" },
        { status: 400 }
      );
    }

    const qty = parseInt(quantity);

    // ใช้ Transaction เพื่อความปลอดภัยของข้อมูลสต็อกและประวัติการเบิก
    const result = await prisma.$transaction(async (tx) => {
      // 1. ตรวจสอบว่ามีอะไหล่ชิ้นนี้และสต็อกพอหรือไม่
      const part = await tx.sparePart.findUnique({
        where: { id: sparePartId },
      });

      if (!part || part.stock < qty) {
        throw new Error(`อะไหล่ ${part?.name || ""} ในคลังไม่เพียงพอสำหรับการเบิก`);
      }

      // 2. ตัดสต็อกอะไหล่ลดลง
      await tx.sparePart.update({
        where: { id: sparePartId },
        data: { stock: { decrement: qty } },
      });

      // 3. บันทึกประวัติการเบิกใน StockLog พร้อมระบุ userId ของผู้ใช้ปัจจุบัน
      const stockLog = await tx.stockLog.create({
        data: {
          sparePartId: sparePartId,
          jobId: jobId,
          quantity: -qty, // ติดลบหมายถึงการเบิกออก
          type: "USE_FOR_REPAIR",
          note: note || `เบิกอะไหล่สำหรับใบงานซ่อม`,
          userId: userId || null, // 📌 บันทึกไอดีผู้ทำรายการจริง
        },
      });

      return stockLog;
    });

    return NextResponse.json({
      success: true,
      message: "เบิกอะไหล่และตัดสต็อกสำเร็จ",
      data: result,
    });

  } catch (error: any) {
    console.error("Error requisitioning spare part:", error);
    return NextResponse.json(
      { error: error.message || "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" },
      { status: 500 }
    );
  }
}

// GET: ดึงประวัติการเบิกอะไหล่ของใบงานนี้
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id;

    const requisitions = await prisma.stockLog.findMany({
      where: { jobId: jobId },
      include: {
        sparePart: true, // ดึงข้อมูลรายละเอียดอะไหล่มาแสดงร่วมด้วย
        user: true,      // (แนะนำเพิ่มเติม) ดึงข้อมูลผู้ใช้งานมาด้วยเผื่อต้องใช้แสดงผล
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: requisitions,
    });

  } catch (error: any) {
    console.error("Error fetching requisitions:", error);
    return NextResponse.json(
      { error: error.message || "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" },
      { status: 500 }
    );
  }
}