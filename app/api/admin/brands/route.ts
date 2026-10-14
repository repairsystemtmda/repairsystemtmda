import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: ดึงรายการแบรนด์ทั้งหมด
export async function GET() {
  try {
    const brands = await prisma.brand.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(brands);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch brands' }, { status: 500 });
  }
}

// POST: เพิ่มแบรนด์ใหม่
export async function POST(request: Request) {
  try {
    const { name, category } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Brand name is required' }, { status: 400 });
    }

    const brandCategory = category || 'อินเวอร์เตอร์';
    const trimmedName = name.trim();

    // ตรวจสอบว่ามีแบรนด์ชื่อนี้ในหมวดหมู่เดียวกันอยู่แล้วหรือไม่
    const existingBrand = await prisma.brand.findFirst({
      where: {
        name: trimmedName,
        category: brandCategory,
      },
    });

    if (existingBrand) {
      return NextResponse.json(
        { error: `มีแบรนด์ "${trimmedName}" ในหมวดหมู่นี้อยู่แล้ว` },
        { status: 400 }
      );
    }

    const newBrand = await prisma.brand.create({
      data: { 
        name: trimmedName, 
        category: brandCategory 
      },
    });

    return NextResponse.json(newBrand, { status: 201 });
  } catch (error) {
    console.error('Error creating brand:', error);
    return NextResponse.json({ error: 'Failed to create brand.' }, { status: 500 });
  }
}

// PUT: แก้ไขข้อมูลแบรนด์
export async function PUT(request: Request) {
  try {
    const { id, name, category } = await request.json();
    if (!id || !name) {
      return NextResponse.json({ error: 'ID and Name are required' }, { status: 400 });
    }

    const brandCategory = category || 'อินเวอร์เตอร์';
    const trimmedName = name.trim();

    // ตรวจสอบการซ้ำในหมวดหมู่เดียวกัน (ยกเว้น ID ตัวเอง)
    const existingBrand = await prisma.brand.findFirst({
      where: {
        name: trimmedName,
        category: brandCategory,
        NOT: { id: id },
      },
    });

    if (existingBrand) {
      return NextResponse.json(
        { error: `มีแบรนด์ "${trimmedName}" ในหมวดหมู่นี้อยู่แล้ว` },
        { status: 400 }
      );
    }

    const updatedBrand = await prisma.brand.update({
      where: { id },
      data: { 
        name: trimmedName, 
        category: brandCategory 
      },
    });

    return NextResponse.json(updatedBrand);
  } catch (error) {
    console.error('Error updating brand:', error);
    return NextResponse.json({ error: 'Failed to update brand' }, { status: 500 });
  }
}

// DELETE: ลบแบรนด์
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Brand ID is required' }, { status: 400 });
    }

    await prisma.brand.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete brand (It might be in use)' }, { status: 500 });
  }
}