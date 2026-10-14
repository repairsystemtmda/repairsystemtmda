import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // 📌 แก้ไข Path ให้ตรงกับโครงสร้าง NextAuth ของโปรเจกต์

// POST: คืนอะไหล่เข้าคลัง
export async function POST(req: Request) {
  try {
    // 📌 ดึงข้อมูลผู้ใช้งานที่กำลังล็อกอินอยู่จริง
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    const body = await req.json();
    const { sparePartId, jobId, quantity, note } = body;

    const qty = parseInt(quantity);
    if (!sparePartId || isNaN(qty) || qty <= 0) {
      return NextResponse.json({ message: "ข้อมูลไม่ครบถ้วนหรือจำนวนไม่ถูกต้อง" }, { status: 400 });
    }

    // ใช้ Prisma Transaction เพื่อความปลอดภัยของข้อมูลคลังและประวัติ
    const result = await prisma.$transaction(async (tx) => {
      // 1. เพิ่มจำนวนสต็อกกลับเข้าคลัง
      const updatedPart = await tx.sparePart.update({
        where: { id: sparePartId },
        data: { stock: { increment: qty } },
      });

      // 2. บันทึกประวัติลง StockLog พร้อมระบุ userId ของผู้ใช้ปัจจุบัน
      const stockLog = await tx.stockLog.create({
        data: {
          sparePartId,
          jobId: jobId || null,
          quantity: qty,
          type: "RESTOCK",
          note: note || "คืนอะไหล่เข้าคลังจากงานซ่อม",
          userId: userId || null, // 📌 บันทึกไอดีผู้ทำรายการจริง
        },
      });

      return { updatedPart, stockLog };
    });

    return NextResponse.json({ message: "คืนอะไหล่สำเร็จ", result }, { status: 200 });
  } catch (error: any) {
    console.error("Return Error:", error);
    return NextResponse.json({ message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์", error: error.message }, { status: 500 });
  }
}