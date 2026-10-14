import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: ดึงค่าตั้งค่าปัจจุบัน
export async function GET() {
  try {
    let setting = await prisma.systemSetting.findUnique({
      where: { id: 'default' },
    });

    if (!setting) {
      setting = await prisma.systemSetting.create({
        data: { id: 'default', lineOaSaveVideo: true },
      });
    }

    return NextResponse.json({ success: true, setting });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ success: false, message: 'ไม่สามารถโหลดข้อมูลตั้งค่าได้' }, { status: 500 });
  }
}

// POST: อัปเดตค่าตั้งค่า
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lineOaSaveVideo } = body;

    const setting = await prisma.systemSetting.upsert({
      where: { id: 'default' },
      update: { lineOaSaveVideo },
      create: { id: 'default', lineOaSaveVideo },
    });

    return NextResponse.json({ success: true, setting });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json({ success: false, message: 'ไม่สามารถบันทึกค่าตั้งค่าได้' }, { status: 500 });
  }
}