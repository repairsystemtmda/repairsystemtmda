import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: ดึงรายการประเภทบอร์ดทั้งหมด
export async function GET() {
  try {
    const boardTypes = await prisma.boardType.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        spareParts: true,
      },
    });
    return NextResponse.json(boardTypes);
  } catch (error) {
    console.error('Error fetching board types:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลประเภทบอร์ดได้' }, { status: 500 });
  }
}

// POST: เพิ่มประเภทบอร์ดใหม่
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, category } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อประเภทบอร์ด' }, { status: 400 });
    }

    const trimmedName = name.trim().toUpperCase();

    const existing = await prisma.boardType.findFirst({
      where: { name: trimmedName },
    });

    if (existing) {
      return NextResponse.json({ error: 'มีประเภทบอร์ดนี้อยู่ในระบบแล้ว' }, { status: 400 });
    }

    const newBoardType = await prisma.boardType.create({
      data: {
        name: trimmedName,
        category: category || 'อินเวอร์เตอร์',
      },
    });

    return NextResponse.json(newBoardType, { status: 201 });
  } catch (error) {
    console.error('Error creating board type:', error);
    return NextResponse.json({ error: 'ไม่สามารถเพิ่มประเภทบอร์ดได้' }, { status: 500 });
  }
}

// PUT: แก้ไขชื่อประเภทบอร์ดและหมวดหมู่
export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ไม่พบรหัสประเภทบอร์ดที่ต้องการแก้ไข' }, { status: 400 });
    }

    const body = await request.json();
    const { name, category } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อประเภทบอร์ด' }, { status: 400 });
    }

    const trimmedName = name.trim().toUpperCase();

    const updated = await prisma.boardType.update({
      where: { id },
      data: {
        name: trimmedName,
        category: category || 'อินเวอร์เตอร์',
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating board type:', error);
    return NextResponse.json({ error: 'ไม่สามารถแก้ไขข้อมูลได้' }, { status: 500 });
  }
}

// DELETE: ลบประเภทบอร์ด
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ไม่พบรหัสประเภทบอร์ดที่ต้องการลบ' }, { status: 400 });
    }

    await prisma.boardType.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'ลบประเภทบอร์ดสำเร็จ' });
  } catch (error) {
    console.error('Error deleting board type:', error);
    return NextResponse.json({ error: 'ไม่สามารถลบรายการนี้ได้ เนื่องจากมีข้อมูลที่เกี่ยวข้องอยู่' }, { status: 500 });
  }
}