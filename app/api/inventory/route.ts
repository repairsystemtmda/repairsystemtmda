import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: ดึงรายการเครื่องสำรองทั้งหมด
export async function GET() {
  try {
    const backupDevices = await prisma.backupDevice.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ backupDevices }, { status: 200 });
  } catch (error: any) {
    console.error("Fetch Backup Devices Error:", error);
    return NextResponse.json({ message: "ไม่สามารถดึงข้อมูลเครื่องสำรองได้", error: error.message }, { status: 500 });
  }
}

// POST: เพิ่มเครื่องสำรองใหม่
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { serialNumber, model, brand, category, status } = body;

    if (!serialNumber || !model) {
      return NextResponse.json({ message: "กรุณากรอก Serial Number และรุ่นเครื่อง" }, { status: 400 });
    }

    // ตรวจสอบว่ามี Serial Number นี้ในระบบเครื่องสำรองหรือยัง
    const existingDevice = await prisma.backupDevice.findUnique({
      where: { serialNumber },
    });

    if (existingDevice) {
      return NextResponse.json({ message: "ไม่สามารถบันทึกข้อมูลได้ (S/N อาจซ้ำในระบบ)" }, { status: 400 });
    }

    const newBackupDevice = await prisma.backupDevice.create({
      data: {
        serialNumber,
        model,
        brand: brand || "Deye",
        category: category || "Inverter",
        status: status || "AVAILABLE",
      },
    });

    return NextResponse.json({ message: "เพิ่มเครื่องสำรองสำเร็จ", backupDevice: newBackupDevice }, { status: 201 });
  } catch (error: any) {
    console.error("Create Backup Device Error:", error);
    return NextResponse.json({ message: "เกิดข้อผิดพลาดในการบันทึก", error: error.message }, { status: 500 });
  }
}