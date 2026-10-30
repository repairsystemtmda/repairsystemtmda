import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: Request) {
  try {
    // 📌 ดึงข้อมูลผู้ใช้งานที่กำลังล็อกอินอยู่
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id; // ไอดีของผู้ใช้งานระบบ

    const body = await req.json();
    const { boardModelCode, name, version, category, boardType, model, location, stock, minQuantity, boardSerialNumber } = body;

    if (!name || !boardModelCode) {
      return NextResponse.json({ message: "กรุณากรอกชื่อและรหัสรุ่นบอร์ด" }, { status: 400 });
    }

    const addStock = parseInt(stock) || 0;

    // ตรวจสอบว่ามีรหัสรุ่นบอร์ดนี้อยู่แล้วหรือไม่
    const existingPart = await prisma.sparePart.findFirst({
      where: { boardModelCode },
    });

    let resultPart;
    let logType = "IMPORT"; // ค่าเริ่มต้นสำหรับเติมสต็อก

    if (existingPart) {
      // ถ้ามีอยู่แล้ว ให้บวกจำนวนสต็อกเพิ่มเข้าไป พร้อมอัปเดตชื่อ ประเภทบอร์ด และเวอร์ชัน
      resultPart = await prisma.sparePart.update({
        where: { id: existingPart.id },
        data: {
          stock: existingPart.stock + addStock,
          name: name || existingPart.name,
          version: version !== undefined ? version : existingPart.version, // 📌 เพิ่มการอัปเดตเวอร์ชัน
          location: location || existingPart.location,
          model: model || existingPart.model,
          boardType: boardType || existingPart.boardType,
        },
      });
      logType = "IMPORT"; // ประเภทเติมสต็อก
    } else {
      // ถ้ายังไม่มี ให้สร้างรายการใหม่ พร้อมบันทึกชื่อ boardType และเวอร์ชัน
      resultPart = await prisma.sparePart.create({
        data: {
          boardModelCode,
          name,
          version: version || null, // 📌 บันทึกค่าเวอร์ชันลงฐานข้อมูล
          category: category || "Inverter",
          boardType: boardType || null,
          model: model || "",
          location: location || "",
          stock: addStock,
          minQuantity: parseInt(minQuantity) || 5,
          boardSerialNumber: boardSerialNumber || null,
        },
      });
      logType = "REGISTER"; // ประเภทลงทะเบียนใหม่
    }

    // 📌 ตรวจสอบความถูกต้องของ userId ในฐานข้อมูลก่อนบันทึก ป้องกัน Foreign Key พัง (P2003)
    let validUserId = null;
    if (userId) {
      const userExists = await prisma.user.findUnique({
        where: { id: userId },
      });
      if (userExists) {
        validUserId = userExists.id;
      }
    }

    // บันทึกประวัติลงตาราง StockLog พร้อมใส่ userId ที่ตรวจสอบแล้ว
    await prisma.stockLog.create({
      data: {
        sparePartId: resultPart.id,
        quantity: addStock,
        type: logType,
        note: existingPart ? 'เติมสต็อกบอร์ดเข้าคลัง' : 'ลงทะเบียนบอร์ดใหม่เข้าคลัง',
        userId: validUserId,
      },
    });

    return NextResponse.json({ message: "บันทึกสต็อกสำเร็จ", part: resultPart }, { status: 201 });
  } catch (error: any) {
    console.error("Register Inventory Error:", error);
    return NextResponse.json({ message: "เกิดข้อผิดพลาดในการบันทึก", error: error.message }, { status: 500 });
  }
}