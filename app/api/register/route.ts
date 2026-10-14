import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt"; // ใช้ bcrypt ตามที่ NextAuth คุณเรียกใช้

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    // ตรวจสอบว่ากรอกข้อมูลครบถ้วนหรือไม่
    if (!email || !password) {
      return NextResponse.json(
        { message: "กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน" },
        { status: 400 }
      );
    }

    // ตรวจสอบว่ามีอีเมลนี้ในระบบฐานข้อมูลแล้วหรือยัง
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "อีเมลนี้ถูกใช้งานในระบบแล้ว กรุณาใช้อีเมลอื่น" },
        { status: 400 }
      );
    }

    // เข้ารหัสรหัสผ่านก่อนบันทึก
    const hashedPassword = await bcrypt.hash(password, 10);

    // บันทึกผู้ใช้งานใหม่ลงในฐานข้อมูล Prisma 
    // พร้อมกำหนดให้ isActive เป็น false (ยังไม่อนุมัติ) และ role เป็น PENDING หรือ TECHNICIAN ตามที่คุณต้องการ
    const user = await prisma.user.create({
      data: {
        name: name || "",
        email,
        password: hashedPassword,
        role: "TECHNICIAN", // หรือ "PENDING" ตามที่ระบบจัดการผู้ใช้ของคุณใช้
        isActive: false,    // 👈 จุดสำคัญ: บังคับให้เป็น false เพื่อรอแอดมินอนุมัติ
      },
    });

    return NextResponse.json(
      { 
        message: "สมัครสมาชิกสำเร็จ กรุณารอผู้ดูแลระบบอนุมัติบัญชีก่อนเข้าใช้งาน", 
        user: { id: user.id, email: user.email, name: user.name } 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register Error:", error);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์" },
      { status: 500 }
    );
  }
}