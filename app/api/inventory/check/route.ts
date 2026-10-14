import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code")?.trim();

    if (!code) {
      return NextResponse.json({ message: "กรุณาระบุรหัสที่ต้องการตรวจสอบ" }, { status: 400 });
    }

    // 1. ลองค้นหาแบบตรงกันเป๊ะก่อน (Exact match)
    let part = await prisma.sparePart.findFirst({
      where: { boardModelCode: code },
    });

    // 2. ถ้าไม่เจอแบบตรงเป๊ะ และรหัสมีความยาวน้อยกว่าหรือเท่ากับ 6 ตัว 
    // ให้ลองค้นหาเฉพาะ "4 ตัวท้าย" (หรือตัวท้ายสุดที่พิมพ์มา)
    if (!part) {
      part = await prisma.sparePart.findFirst({
        where: {
          boardModelCode: {
            endsWith: code, // ค้นหาตัวที่ลงท้ายด้วยข้อความที่ผู้ใช้พิมพ์
          },
        },
      });
    }

    if (part) {
      return NextResponse.json({ exists: true, part });
    } else {
      return NextResponse.json({ exists: false, part: null });
    }
  } catch (error: any) {
    console.error("Check API Error:", error);
    return NextResponse.json({ message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}