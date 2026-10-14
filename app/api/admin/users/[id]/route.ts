import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 1. ตรวจสอบสิทธิ์ว่าเป็น Admin หรือไม่
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const userId = params.id;
    const body = await request.json();
    const { isActive } = body; // รับค่าสถานะใหม่ที่จะเปลี่ยน (true หรือ false)

    // 2. อัปเดตสถานะผู้ใช้ในฐานข้อมูล
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });

    return NextResponse.json(
      { message: "อัปเดตสถานะผู้ใช้สำเร็จ", user: updatedUser },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update User Error:", error);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์" },
      { status: 500 }
    );
  }
}

// 📌 ฟังก์ชัน DELETE สำหรับลบผู้ใช้งาน
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 1. ตรวจสอบสิทธิ์ว่าเป็น Admin หรือไม่
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const userId = params.id;

    // ป้องกันไม่ให้แอดมินเผลอลบไอดีตัวเองที่กำลังล็อกอินอยู่
    if ((session.user as any).id === userId) {
      return NextResponse.json(
        { message: "ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่ได้" },
        { status: 400 }
      );
    }

    // 2. ลบผู้ใช้จากฐานข้อมูล
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json(
      { message: "ลบผู้ใช้งานสำเร็จ" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete User Error:", error);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดในการลบผู้ใช้งาน" },
      { status: 500 }
    );
  }
}