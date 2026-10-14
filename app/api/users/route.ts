import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET: ดึงรายชื่อพนักงานทั้งหมด (เฉพาะ ADMIN หรือ MANAGER)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role === "TECHNICIAN") {
      return NextResponse.json({ message: "ไม่มีสิทธิ์เข้าถึงข้อมูลนี้" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(users, { status: 200 });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ message: "เกิดข้อผิดพลาดในเซิร์ฟเวอร์" }, { status: 500 });
  }
}

// POST: เพิ่มพนักงานใหม่ (เฉพาะ ADMIN เท่านั้น)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ message: "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเพิ่มพนักงานได้" }, { status: 403 });
    }

    const { name, email, username, password, role } = await request.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ message: "กรุณากรอกข้อมูลสำคัญให้ครบถ้วน" }, { status: 400 });
    }

    // ตรวจสอบว่ามีอีเมลซ้ำไหม
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ message: "อีเมลนี้ถูกใช้งานในระบบแล้ว" }, { status: 400 });
    }

    // เข้ารหัสรหัสผ่าน
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        username: username || null,
        password: hashedPassword,
        role: role, // "ADMIN", "MANAGER", หรือ "TECHNICIAN"
      },
    });

    return NextResponse.json({ message: "สร้างบัญชีผู้ใช้สำเร็จ", userId: newUser.id }, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ message: "เกิดข้อผิดพลาดในการสร้างบัญชี" }, { status: 500 });
  }
}