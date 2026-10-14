import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // 📌 ปรับ Path ให้ตรงกับโปรเจกต์ของคุณ

export async function POST(request: Request) {
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

    const body = await request.json();
    const { action, sparePartId, quantity, boardModelCode, name, model, minQuantity, boardSerialNumber } = body;

    if (action === "RESTOCK") {
      if (!sparePartId || !quantity) {
        return NextResponse.json({ error: "กรุณาระบุข้อมูลอะไหล่และจำนวนที่ต้องการเติม" }, { status: 400 });
      }

      const part = await prisma.sparePart.findUnique({ where: { id: sparePartId } });
      if (!part) return NextResponse.json({ error: "ไม่พบข้อมูลอะไหล่ในระบบ" }, { status: 404 });

      const addQty = parseInt(quantity, 10) || 0;
      const newStock = part.stock + addQty;

      await prisma.$transaction([
        prisma.sparePart.update({
          where: { id: sparePartId },
          data: { stock: newStock },
        }),
        prisma.stockLog.create({
          data: {
            sparePartId,
            quantity: addQty,
            type: "RESTOCK",
            note: `เติมสต็อกเข้าคลัง`,
            userId: validUserId, // 📌 ใช้ validUserId ที่ผ่านการตรวจสอบแล้ว ป้องกัน Error
          },
        }),
      ]);

      return NextResponse.json({ success: true, message: "เติมสต็อกสำเร็จ" });

    } else if (action === "NEW") {
      if (!boardModelCode || !name) {
        return NextResponse.json({ error: "กรุณาระบุรหัสรุ่นและชื่ออะไหล่" }, { status: 400 });
      }

      const initialStock = parseInt(quantity, 10) || 0;

      await prisma.$transaction(async (tx) => {
        const newPart = await tx.sparePart.create({
          data: {
            code: boardModelCode,
            boardModelCode,
            boardSerialNumber: boardSerialNumber || null,
            name,
            model: model || null,
            stock: initialStock,
            minQuantity: parseInt(minQuantity, 10) || 0,
          },
        });

        await tx.stockLog.create({
          data: {
            sparePartId: newPart.id,
            quantity: initialStock,
            type: "RESTOCK",
            note: `ลงทะเบียนอะไหล่ใหม่เข้าคลัง`,
            userId: validUserId, // 📌 ใช้ validUserId ที่ผ่านการตรวจสอบแล้ว
          },
        });
      });

      return NextResponse.json({ success: true, message: "ลงทะเบียนอะไหล่ใหม่สำเร็จ" });
    }

    return NextResponse.json({ error: "Action ไม่ถูกต้อง" }, { status: 400 });
  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json({ error: err.message || "Server Error" }, { status: 500 });
  }
}