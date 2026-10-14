import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const device = await prisma.backupDevice.findUnique({
      where: { id },
      include: {
        brand: true,
        jobs: true,
      },
    });

    if (!device) {
      return NextResponse.json({ message: 'ไม่พบข้อมูลเครื่องสำรอง' }, { status: 404 });
    }

    return NextResponse.json({ device });
  } catch (error: any) {
    console.error('Error fetching backup device detail:', error);
    return NextResponse.json({ message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}

// แยกฟังก์ชันการอัปเดตออกมาเพื่อรองรับทั้ง POST, PUT และ PATCH ป้องกันปัญหา Method ไม่ตรงกัน
async function handleUpdate(request: Request, id: string) {
  try {
    const formData = await request.formData();

    const status = formData.get('status') as string;
    const category = formData.get('category') as string;
    const brandId = formData.get('brandId') as string;
    const model = formData.get('model') as string;
    const serialNumber = formData.get('serialNumber') as string;
    const productNo = formData.get('productNo') as string;

    // ถ้าย้ายกลับมาสถานะ AVAILABLE ให้เคลียร์ชื่อลูกค้าและเบอร์โทรออก แต่ถ้าเป็นสถานะอื่นให้รับค่าที่ส่งมาตามจริง
    const customerName = status === 'AVAILABLE' ? null : (formData.get('customerName') as string) || null;
    const phone = status === 'AVAILABLE' ? null : (formData.get('phone') as string) || null;

    // แก้ไขการรับค่า Checkbox จาก FormData ให้รองรับทั้ง 'on' และ 'true'
    const hasBox = formData.get('hasBox') === 'on' || formData.get('hasBox') === 'true';
    const hasWifiDongle = formData.get('hasWifiDongle') === 'on' || formData.get('hasWifiDongle') === 'true';
    
    const wifiDongleSn = formData.get('wifiDongleSn') as string;
    const note = formData.get('note') as string;

    const existingDevice = await prisma.backupDevice.findUnique({
      where: { id },
    });

    if (!existingDevice) {
      return NextResponse.json({ message: 'ไม่พบข้อมูลเครื่องสำรองที่ต้องการแก้ไข' }, { status: 404 });
    }

    const updatedDevice = await prisma.backupDevice.update({
      where: { id },
      data: {
        status,
        category,
        brandId: brandId === '' ? null : brandId,
        model,
        serialNumber,
        productNo: productNo || null,
        customerName,
        phone,
        hasBox,
        hasWifiDongle,
        wifiDongleSn: hasWifiDongle ? (wifiDongleSn || null) : null,
        note: note || null,
      },
    });

    return NextResponse.json({ success: true, message: 'บันทึกข้อมูลเครื่องสำรองสำเร็จ', device: updatedDevice });
  } catch (error: any) {
    console.error('Error updating backup device:', error);
    // ส่ง error.message กลับไปด้วยเพื่อให้เห็นรายละเอียดที่แท้จริงหากเกิดข้อผิดพลาด
    return NextResponse.json({ message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  return handleUpdate(request, resolvedParams.id);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  return handleUpdate(request, resolvedParams.id);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  return handleUpdate(request, resolvedParams.id);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const existingDevice = await prisma.backupDevice.findUnique({
      where: { id },
    });

    if (!existingDevice) {
      return NextResponse.json({ message: 'ไม่พบข้อมูลเครื่องสำรองที่ต้องการลบ' }, { status: 404 });
    }

    // 1. เคลียร์ความสัมพันธ์ในตาราง Job (ตั้งค่า backupDeviceId เป็น null) เพื่อป้องกันข้อผิดพลาด Foreign Key
    await prisma.job.updateMany({
      where: { backupDeviceId: id },
      data: { backupDeviceId: null },
    });

    // 2. ลบข้อมูลเครื่องสำรองออกจากระบบ
    await prisma.backupDevice.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'ลบข้อมูลเครื่องสำรองสำเร็จ' });
  } catch (error: any) {
    console.error('Error deleting backup device:', error);
    return NextResponse.json({ message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}