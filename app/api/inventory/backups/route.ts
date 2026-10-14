import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';

// 🌟 เพิ่มฟังก์ชัน GET เพื่อให้หน้าเปิดใบงานสามารถดึงรายการเครื่องสำรองมาแสดงใน Dropdown ได้
export async function GET(request: Request) {
  try {
    const backups = await prisma.backupDevice.findMany({
      include: {
        brand: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(backups);
  } catch (error: any) {
    console.error('Failed to fetch backup devices:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    const status = (formData.get('status') as string) || 'AVAILABLE';
    const rawCategory = (formData.get('category') as string) || 'อินเวอร์เตอร์';
    
    // 🌟 แปลงหมวดหมู่ให้แสดงผลเป็นภาษาไทยเสมอ
    let category = rawCategory;
    if (category === 'INVERTER' || category === 'Inv' || category === 'Inverter') {
      category = 'อินเวอร์เตอร์';
    }
    
    // รับข้อมูลผู้บันทึกจากฟอร์ม (ถ้ามี)
    let receiverId = formData.get('receiverId') as string;
    let receiverName = formData.get('receiverName') as string;
    let currentUserId: string | null = null;
    
    // 🌟 ค้นหาและตรวจสอบ User ปัจจุบันอย่างปลอดภัย
    const cookieStore = await cookies();
    try {
      const session = await getServerSession();
      if (session?.user) {
        const sessionIdentifier = (session.user as any).id || session.user.email || session.user.name;
        if (sessionIdentifier) {
          const foundAuthUser = await prisma.user.findFirst({
            where: {
              OR: [
                { id: sessionIdentifier },
                { email: sessionIdentifier },
                { username: sessionIdentifier },
                { name: sessionIdentifier }
              ]
            }
          });
          if (foundAuthUser) {
            currentUserId = foundAuthUser.id;
            receiverName = foundAuthUser.name || foundAuthUser.username || 'adminTMDA';
          }
        }
      }
    } catch (e) {}

    if (!currentUserId) {
      const userCookie = 
        cookieStore.get('userId')?.value || 
        cookieStore.get('user')?.value || 
        cookieStore.get('username')?.value ||
        cookieStore.get('session')?.value ||
        cookieStore.get('token')?.value;

      if (userCookie) {
        const foundUser = await prisma.user.findFirst({
          where: {
            OR: [
              { id: userCookie },
              { username: userCookie },
              { name: userCookie }
            ]
          }
        });
        if (foundUser) {
          currentUserId = foundUser.id;
          receiverName = foundUser.name || foundUser.username || 'adminTMDA';
        }
      }
    }

    // หากยังไม่มี User ให้ใช้ค่าสำรอง แต่ไม่บังคับผูก Foreign Key ถ้าหาไม่เจอจริงๆ
    if (!receiverName) {
      receiverName = 'adminTMDA';
    }

    // ตรวจสอบว่า currentUserId มีอยู่จริงในตาราง User หรือไม่ เพื่อป้องกัน Foreign Key Error
    let validUserId: string | null = null;
    if (currentUserId) {
      const checkUser = await prisma.user.findUnique({
        where: { id: currentUserId }
      });
      if (checkUser) {
        validUserId = checkUser.id;
      }
    }

    // 🌟 ตรวจสอบว่าเป็นกรณีการเลือกยืมเครื่องสำรองชั่วคราว (IN_USE_BACKUP) จากหน้าเปิดใบงานหรือไม่
    const backupDeviceIdFromForm = (formData.get('backupDeviceId') as string) || '';
    const customerName = (formData.get('customerName') as string) || '';
    const phone = (formData.get('phone') as string) || '';
    const note = (formData.get('note') as string) || '';

    if (status === 'IN_USE_BACKUP' && backupDeviceIdFromForm) {
      // ทำการอัปเดตสถานะของเครื่องสำรองตัวนั้นในคลังโดยตรง
      const updatedDevice = await prisma.backupDevice.update({
        where: { id: backupDeviceIdFromForm },
        data: {
          status: 'IN_USE',
          customerName: customerName || null,
          phone: phone || null,
          note: note || null,
          userId: validUserId,
          receiverName: receiverName,
        },
        include: {
          brand: true,
        }
      });

      return NextResponse.json({ success: true, backupDevice: updatedDevice });
    }

    // รับค่าแบรนด์ (สำหรับกรณีเพิ่มเครื่องสำรองใหม่ปกติ)
    const rawBrandId = formData.get('brandId') as string;
    const rawBrandName = (formData.get('brand') || formData.get('customBrand')) as string;
    
    const model = formData.get('model') as string;
    const serialNumber = formData.get('serialNumber') as string;
    const productNo = formData.get('productNo') as string;
    
    const hasBox = formData.get('hasBox') === 'true' || formData.get('hasBox') === 'on';
    const hasWifiDongle = formData.get('hasWifiDongle') === 'true' || formData.get('hasWifiDongle') === 'on';
    const wifiDongleSn = formData.get('wifiDongleSn') as string;

    if (!model || !serialNumber) {
      return NextResponse.json({ error: 'กรุณากรอกรุ่นและ Serial Number ให้ครบถ้วน' }, { status: 400 });
    }

    let resolvedBrandId: string | null = null;

    if (rawBrandId && rawBrandId.trim() !== '') {
      resolvedBrandId = rawBrandId;
    } else if (rawBrandName && rawBrandName.trim() !== '') {
      const cleanName = rawBrandName.trim();
      
      const allBrands = await prisma.brand.findMany();
      let brandRecord = allBrands.find(
        (b) => b.name.toLowerCase().trim() === cleanName.toLowerCase()
      );

      if (!brandRecord) {
        brandRecord = await prisma.brand.create({
          data: { name: cleanName },
        });
      }

      resolvedBrandId = brandRecord.id;
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (e) {}

    const saveFileAndGetUrl = async (file: File): Promise<string | null> => {
      if (!file || !(file instanceof File) || file.size === 0) return null;
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const filename = `${uniqueSuffix}-${file.name.replace(/\s+/g, '_')}`;
      const filepath = path.join(uploadDir, filename);
      await writeFile(filepath, buffer);
      return `/uploads/${filename}`;
    };

    let imageUrl: string | null = null;
    const nameplateFile = (formData.get('image') || formData.get('nameplate') || formData.get('nameplateImage')) as File;
    if (nameplateFile && nameplateFile instanceof File && nameplateFile.size > 0) {
      imageUrl = await saveFileAndGetUrl(nameplateFile);
    }

    // 🌟 บันทึกข้อมูลเครื่องสำรองใหม่
    const backupDevice = await prisma.backupDevice.create({
      data: {
        status,
        category,
        brandId: resolvedBrandId,
        model,
        serialNumber,
        productNo: productNo || null,
        customerName: customerName || null,
        phone: phone || null,
        note: note || null,
        hasBox,
        hasWifiDongle,
        wifiDongleSn: wifiDongleSn || null,
        imageUrl,
        userId: validUserId, 
        receiverId: validUserId,
        receiverName: receiverName,
      },
      include: {
        brand: true,
      }
    });

    for (const [key, value] of formData.entries()) {
      if (value instanceof File && value.size > 0 && (key.includes('otherImages') || key.includes('images'))) {
        if (nameplateFile && value.name === nameplateFile.name) continue;

        const url = await saveFileAndGetUrl(value);
        if (url) {
          await prisma.backupDeviceImage.create({
            data: {
              url,
              type: 'CONDITION',
              backupDeviceId: backupDevice.id,
            },
          });
        }
      }
    }

    return NextResponse.json({ success: true, backupDevice });
  } catch (error: any) {
    console.error('Failed to create backup device:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
