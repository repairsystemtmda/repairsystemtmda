import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';

// 🌟 ฟังก์ชัน GET เพื่อให้หน้าเปิดใบงานสามารถดึงรายการเครื่องสำรองมาแสดงใน Dropdown ได้
export async function GET(request: Request) {
  try {
    const backups = await prisma.backupDevice.findMany({
      include: {
        brand: true,
        images: true,
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
    // รับข้อมูลแบบ JSON จากฝั่ง Client (ที่อัปโหลดรูปผ่าน Supabase Storage เรียบร้อยแล้ว)
    const bodyData = await request.json();
    
    const status = bodyData.status || 'AVAILABLE';
    const rawCategory = bodyData.category || 'อินเวอร์เตอร์';
    
    // 🌟 แปลงหมวดหมู่ให้แสดงผลเป็นภาษาไทยเสมอ
    let category = rawCategory;
    if (category === 'INVERTER' || category === 'Inv' || category === 'Inverter') {
      category = 'อินเวอร์เตอร์';
    }
    
    let receiverName = bodyData.receiverName || 'adminTMDA';
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

    if (!receiverName) {
      receiverName = 'adminTMDA';
    }

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
    const backupDeviceIdFromForm = bodyData.backupDeviceId || '';
    const customerName = bodyData.customerName || '';
    const phone = bodyData.phone || '';
    const note = bodyData.note || '';

    if (status === 'IN_USE_BACKUP' && backupDeviceIdFromForm) {
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
    const rawBrandId = bodyData.brandId;
    const rawBrandName = bodyData.brand || bodyData.customBrand;
    
    const model = bodyData.model;
    const serialNumber = bodyData.serialNumber;
    const productNo = bodyData.productNo;
    
    const hasBox = Boolean(bodyData.hasBox);
    const hasWifiDongle = Boolean(bodyData.hasWifiDongle);
    const wifiDongleSn = bodyData.wifiDongleSn;

    if (!model || !serialNumber) {
      return NextResponse.json({ error: 'กรุณากรอกรุ่นและ Serial Number ให้ครบถ้วน' }, { status: 400 });
    }

    let resolvedBrandId: string | null = null;

    if (rawBrandId && String(rawBrandId).trim() !== '') {
      resolvedBrandId = String(rawBrandId);
    } else if (rawBrandName && String(rawBrandName).trim() !== '') {
      const cleanName = String(rawBrandName).trim();
      
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

    // รับลิงก์ URL รูปภาพที่อัปโหลดตรงมาจากฝั่ง Client (Supabase Storage)
    const imageUrl = bodyData.imageUrl || null;
    const additionalImages: string[] = Array.isArray(bodyData.images) ? bodyData.images : [];

    // 🌟 บันทึกข้อมูลเครื่องสำรองใหม่ลงฐานข้อมูล
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
        ...(additionalImages.length > 0 && {
          images: {
            create: additionalImages.map((url) => ({
              url,
              type: 'CONDITION',
            })),
          },
        }),
      },
      include: {
        brand: true,
        images: true,
      }
    });

    return NextResponse.json({ success: true, backupDevice });
  } catch (error: any) {
    console.error('Failed to create backup device:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}