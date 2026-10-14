import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const spareParts = await prisma.sparePart.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        boardTypeRelation: true,
      },
    });
    return NextResponse.json(spareParts);
  } catch (error) {
    console.error('Error fetching spare parts:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลอะไหล่ได้' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ไม่พบรหัสอะไหล่ที่ต้องการลบ' }, { status: 400 });
    }

    const existingPart = await prisma.sparePart.findUnique({
      where: { id },
    });

    if (!existingPart) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลอะไหล่นี้ในระบบ' }, { status: 404 });
    }

    await prisma.sparePart.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'ลบรายการอะไหล่สำเร็จ' });
  } catch (error) {
    console.error('Error deleting spare part:', error);
    return NextResponse.json({ error: 'ไม่สามารถลบรายการอะไหล่นี้ได้ เนื่องจากอาจมีข้อมูลที่เกี่ยวข้องอยู่' }, { status: 500 });
  }
}