import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // 📌 แก้ไข Path ให้ถูกต้องตามโครงสร้างโปรเจกต์

// POST: ตัดเบิกอะไหล่ (ใช้งานซ่อม)
export async function POST(req: Request) {
  try {
    // 📌 ดึงข้อมูลผู้ใช้งานที่กำลังล็อกอินอยู่จริง
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id; // ไอดีของผู้ใช้งานระบบ

    const body = await req.json();
    const { sparePartId, jobId, quantity, note } = body;

    const qty = parseInt(quantity);
    if (!sparePartId || isNaN(qty) || qty <= 0) {
      return NextResponse.json({ message: "ข้อมูลไม่ครบถ้วนหรือจำนวนไม่ถูกต้อง" }, { status: 400 });
    }

    // ตรวจสอบว่ามีอะไหล่นี้จริงไหม
    const part = await prisma.sparePart.findUnique({
      where: { id: sparePartId },
    });

    if (!part) {
      return NextResponse.json({ message: "ไม่พบข้อมูลอะไหล่นี้ในระบบ" }, { status: 404 });
    }

    if (part.stock < qty) {
      return NextResponse.json({ message: `สต็อกไม่พอเบิก (เหลือในคลัง ${part.stock} ชิ้น)` }, { status: 400 });
    }

    // ใช้ Prisma Transaction เพื่อความปลอดภัยของข้อมูล
    const result = await prisma.$transaction(async (tx) => {
      // 1. ลดจำนวนสต็อกในตาราง SparePart
      const updatedPart = await tx.sparePart.update({
        where: { id: sparePartId },
        data: { stock: { decrement: qty } },
      });

      // 2. บันทึกประวัติลง StockLog พร้อมใส่ userId
      const stockLog = await tx.stockLog.create({
        data: {
          sparePartId,
          jobId: jobId || null,
          quantity: -qty,
          type: "USE_FOR_REPAIR",
          note: note || "ตัดเบิกใช้งานสำหรับงานซ่อม",
          userId: userId || null, // 📌 บันทึกไอดีผู้ทำรายการจริงลงในระบบ
        },
      });

      return { updatedPart, stockLog };
    });

    return NextResponse.json({ message: "ตัดเบิกสำเร็จ", result }, { status: 200 });
  } catch (error: any) {
    console.error("Withdraw Error:", error);
    return NextResponse.json({ message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์", error: error.message }, { status: 500 });
  }
}