import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/lib/auth";     

export async function POST(req: Request) {
  try {
    // 📌 1. ดึงข้อมูลผู้ใช้งานจาก Session
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.id;
    const sessionUserEmail = session?.user?.email;

    // 📌 2. ตรวจสอบว่ามีผู้ใช้นี้อยู่ในฐานข้อมูลจริงหรือไม่ เพื่อป้องกัน Foreign Key Violation
    let validUserId: string | null = null;
    if (sessionUserId) {
      const userInDb = await prisma.user.findUnique({
        where: { id: sessionUserId },
      });
      if (userInDb) {
        validUserId = userInDb.id;
      }
    } else if (sessionUserEmail) {
      const userInDb = await prisma.user.findUnique({
        where: { email: sessionUserEmail },
      });
      if (userInDb) {
        validUserId = userInDb.id;
      }
    }

    const body = await req.json();
    const { boardModelCode, stock } = body;

    if (!boardModelCode) {
      return NextResponse.json({ message: "กรุณาระบุรหัสรุ่นบอร์ด" }, { status: 400 });
    }

    const addStock = parseInt(stock) || 1;

    const existingPart = await prisma.sparePart.findFirst({
      where: { boardModelCode },
    });

    if (!existingPart) {
      return NextResponse.json(
        { message: "ไม่พบข้อมูลอะไหล่นี้ในระบบคลัง กรุณาลงทะเบียนใหม่" },
        { status: 404 }
      );
    }

    // 📌 3. ใช้ Transaction เพื่อความปลอดภัย (ถ้าบันทึก Log ไม่ผ่าน จะดึงสต็อกกลับอัตโนมัติ ไม่ให้ยอดเพี้ยน)
    const [updatedPart] = await prisma.$transaction([
      prisma.sparePart.update({
        where: { id: existingPart.id },
        data: {
          stock: existingPart.stock + addStock,
        },
      }),
      prisma.stockLog.create({
        data: {
          sparePartId: existingPart.id,
          quantity: addStock,
          type: 'IMPORT', 
          note: 'เติมสต็อกบอร์ดเข้าคลัง',
          userId: validUserId, // ป้องกัน Error กรณีไอดีผู้ใช้ไม่ตรงกับฐานข้อมูล
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "เติมสต็อกสำเร็จเรียบร้อย",
      data: updatedPart,
    });
  } catch (error: any) {
    console.error("Restock API Error:", error);
    return NextResponse.json(
      { message: error.message || "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" },
      { status: 500 }
    );
  }
}