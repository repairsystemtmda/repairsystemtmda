import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getToken } from 'next-auth/jwt';
import { createClient } from '@supabase/supabase-js';

// 🌟 ตั้งค่า Supabase Client สำหรับจัดการอัปโหลดไฟล์เข้า Storage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = 'repair-images';

// Helper แปลงสถานะสำหรับไฟล์ Export
function formatStatusForExport(status: string): string {
  const statusMap: Record<string, string> = {
    PENDING: 'รอประเมิน',
    DIAGNOSE: 'กำลังประเมิน',
    WAITING_FOR_APPROVAL: 'รออนุมัติราคา',
    IN_PROGRESS: 'กำลังซ่อม',
    WAITING_DEYE_SEND: 'รอส่ง Deye',
    SENT_TO_DEYE: 'ส่ง Deye แล้ว',
    WAITING_DEYE_RETURN: 'รอ Deye ส่งกลับ',
    COMPLETED_BY_DEYE: 'Deye ซ่อมเสร็จ',
    COMPLETED: 'ซ่อมเสร็จสิ้น',
    SWAPPED_BACKUP_DEVICE: 'ยืมเครื่องสำรองระหว่างซ่อม',
    SWAPPED_PERMANENT: 'สลับเปลี่ยนเครื่องสำรองให้ถาวร',
    FINAL_SWAPPED_PERMANENT: 'สลับเปลี่ยนเครื่องสำรองให้ถาวร',
    RETURNED_CUSTOMER_PICKUP: 'ลูกค้ารับคืนแล้ว',
    RETURNED_SHIPPED: 'จัดส่งคืนแล้ว',
    CANCELLED: 'ยกเลิก',
  };
  return statusMap[status] || status || 'รอประเมิน';
}

// GET: ดึงรายการใบงานซ่อมทั้งหมด
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || searchParams.get('q') || '';
    const status = searchParams.get('status') || '';
    const category = searchParams.get('category') || '';

    const where: any = {};

    if (query) {
      where.OR = [
        { jobNo: { contains: query } },
        { customerName: { contains: query } },
        { serialNumber: { contains: query } },
        { phone: { contains: query } },
        { model: { contains: query } },
      ];
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (category && category !== 'ALL') {
      where.category = category;
    }

    const jobs = await prisma.job.findMany({
      where,
      include: {
        brand: true,
        backupDevice: true,
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ jobs }, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch jobs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Helper ฟังก์ชันอัปโหลดไฟล์ไปยัง Supabase Storage
async function uploadFileToSupabase(file: File, folderPrefix: string): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const sanitizeName = file.name ? file.name.replaceAll(' ', '_') : 'unnamed.jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${sanitizeName}`;
  const filePath = `jobs/${folderPrefix}/${filename}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, buffer, {
      contentType: file.type || 'image/jpeg',
      upsert: true,
    });

  if (uploadError) {
    console.error('Supabase Storage Upload Error:', uploadError);
    throw new Error(`ไม่สามารถอัปโหลดรูปภาพได้: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

// POST: สร้างใบงานซ่อมใหม่
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let bodyData: any = {};
    const structuredImages: { url: string; type: string }[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      
      formData.forEach((value, key) => {
        if (key !== 'images' && key !== 'files' && key !== 'nameplateImage') {
          bodyData[key] = value;
        }
      });

      // 🌟 1. แยกอัปโหลดและระบุ Type เป็น 'NAMEPLATE' โดยตรง
      const nameplateFile = formData.get('nameplateImage') as File | null;
      if (nameplateFile && nameplateFile.size > 0 && nameplateFile.size < 10 * 1024 * 1024) {
        const publicUrl = await uploadFileToSupabase(nameplateFile, 'nameplates');
        structuredImages.push({ url: publicUrl, type: 'NAMEPLATE' });
      }

      // 🌟 2. อัปโหลดรูปภาพประกอบอื่นๆ และระบุ Type เป็น 'OTHER' โดยตรง
      const files = formData.getAll('images') as File[];
      for (const file of files) {
        if (file && file.size > 0 && file.size < 10 * 1024 * 1024) {
          const publicUrl = await uploadFileToSupabase(file, 'boards');
          structuredImages.push({ url: publicUrl, type: 'OTHER' });
        }
      }
    } else {
      bodyData = await request.json();

      // 🌟 รองรับกรณีส่งข้อมูลแบบ JSON (รับ imageUrl เป็น Nameplate และ images เป็นรูปอื่นๆ)
      if (bodyData.imageUrl && typeof bodyData.imageUrl === 'string' && bodyData.imageUrl.trim() !== '') {
        structuredImages.push({ url: bodyData.imageUrl, type: 'NAMEPLATE' });
      }

      if (Array.isArray(bodyData.images)) {
        bodyData.images.forEach((url: string) => {
          if (url && typeof url === 'string' && url.trim() !== '') {
            structuredImages.push({ url, type: 'OTHER' });
          }
        });
      }
    }

    // 1. ค้นหาผู้ใช้งานจริงแบบยืดหยุ่น (Exact Match + Partial Match)
    let resolvedUserId: string | null = null;
    let resolvedReceiverName: string | null = bodyData.receiverName || bodyData.userName || null;

    try {
      const session = await getServerSession(authOptions);
      const sessionUser = session?.user as any;
      const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });

      const candidateIdentifiers = [
        bodyData.userId,
        bodyData.userName,
        sessionUser?.id,
        sessionUser?.email,
        sessionUser?.username,
        sessionUser?.name,
        token?.sub,
        (token as any)?.id,
        (token as any)?.username,
        (token as any)?.email,
        (token as any)?.name,
      ].filter(Boolean);

      for (const rawId of candidateIdentifiers) {
        const strId = String(rawId).trim();
        if (!strId) continue;

        let foundUser = await prisma.user.findFirst({
          where: {
            OR: [
              { id: strId },
              { username: strId },
              { email: strId },
              { name: strId }
            ]
          }
        });

        if (!foundUser) {
          foundUser = await prisma.user.findFirst({
            where: {
              OR: [
                { username: { contains: strId } },
                { name: { contains: strId } },
                { email: { contains: strId } }
              ]
            }
          });
        }

        if (foundUser) {
          resolvedUserId = foundUser.id;
          resolvedReceiverName = foundUser.name || foundUser.username || resolvedReceiverName;
          break;
        }
      }
    } catch (e) {
      console.warn('Auth resolution warning:', e);
    }

    const {
      jobNo: customJobNo,
      customerName,
      category,
      serialNumber,
      productNo,
      wifiDongleSn,
      note,
      brand,
      brandName,
      brandId: inputBrandId,
      model,
      phone,
      hasBox,
      hasWifiDongle,
      isWarranty,
      status: inputStatus,
      backupDeviceId,
    } = bodyData;

    // 🌟 ตรวจสอบว่าเป็นเคสปล่อยยืมเครื่องสำรองชั่วคราว (IN_USE_BACKUP) หรือไม่
    const isDirectLoan = inputStatus === 'IN_USE_BACKUP' && backupDeviceId;

    if (!isDirectLoan && (!customerName || !serialNumber)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 🌟 หากเป็นการปล่อยยืมเครื่องสำรอง ให้ทำการอัปเดตสถานะของเครื่องสำรองในคลังโดยตรง
    if (isDirectLoan) {
      let verifiedUserId: string | null = null;
      if (resolvedUserId && String(resolvedUserId).trim() !== '') {
        const userExists = await prisma.user.findUnique({ where: { id: String(resolvedUserId) } });
        if (userExists) verifiedUserId = userExists.id;
      }

      const updatedBackup = await prisma.backupDevice.update({
        where: { id: String(backupDeviceId).trim() },
        data: {
          status: 'IN_USE',
          customerName: customerName ? String(customerName) : null,
          phone: phone ? String(phone) : null,
          note: note ? String(note) : null,
          receiverName: resolvedReceiverName,
          ...(verifiedUserId && { userId: verifiedUserId }),
        },
      });

      return NextResponse.json({ success: true, backupDevice: updatedBackup }, { status: 201 });
    }

    // 2. จัดการ Brand ID (สำหรับเคสเปิดใบงานซ่อมปกติ)
    let targetBrandId = inputBrandId && String(inputBrandId).trim() !== '' ? String(inputBrandId) : null;
    const targetBrandName = brandName || brand;

    if (!targetBrandId && targetBrandName && typeof targetBrandName === 'string' && targetBrandName.trim() !== '') {
      let brandObj = await prisma.brand.findFirst({
        where: { name: { equals: targetBrandName.trim() } },
      });
      if (!brandObj) {
        brandObj = await prisma.brand.create({
          data: { name: targetBrandName.trim() },
        });
      }
      targetBrandId = brandObj.id;
    }

    let verifiedBrandId: string | null = null;
    if (targetBrandId) {
      const brandExists = await prisma.brand.findUnique({ where: { id: targetBrandId } });
      if (brandExists) verifiedBrandId = brandExists.id;
    }

    // 3. จัดการ Backup Device ID
    let verifiedBackupId: string | null = null;
    const rawBackupId = backupDeviceId ? String(backupDeviceId).trim() : '';
    if (rawBackupId && rawBackupId !== 'undefined' && rawBackupId !== 'null' && rawBackupId !== '') {
      const backupExists = await prisma.backupDevice.findUnique({ 
        where: { id: rawBackupId } 
      });
      if (backupExists) {
        verifiedBackupId = backupExists.id;
      }
    }

    // 4. ตรวจสอบ User ID ก่อนบันทึก
    let verifiedUserId: string | null = null;
    if (resolvedUserId && String(resolvedUserId).trim() !== '') {
      const userExists = await prisma.user.findUnique({ where: { id: String(resolvedUserId) } });
      if (userExists) {
        verifiedUserId = userExists.id;
      }
    }

    // 5. รันเลขที่ใบงานอัตโนมัติ
    let finalJobNo = customJobNo;
    if (!finalJobNo || String(finalJobNo).trim() === '') {
      const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
      
      const latestJob = await prisma.job.findFirst({
        where: { jobNo: { startsWith: `JOB-${dateStr}-` } },
        orderBy: { createdAt: 'desc' },
      });

      let nextRunning = 1;
      if (latestJob && latestJob.jobNo) {
        const parts = latestJob.jobNo.split('-');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) nextRunning = lastNum + 1;
      }

      finalJobNo = `JOB-${dateStr}-${String(nextRunning).padStart(3, '0')}`;
    }

    const isWarrantyBoolean = String(isWarranty) === 'true' || isWarranty === true;
    const jobStatus = inputStatus ? String(inputStatus) : 'PENDING';

    // 6. บันทึกใบงานซ่อมลงฐานข้อมูล
    const newJob = await prisma.job.create({
      data: {
        jobNo: String(finalJobNo),
        customerName: String(customerName),
        category: category ? String(category) : null,
        serialNumber: String(serialNumber),
        productNo: productNo ? String(productNo) : null,
        wifiDongleSn: wifiDongleSn ? String(wifiDongleSn) : null,
        note: note ? String(note) : null,
        model: model ? String(model) : null,
        phone: phone ? String(phone) : null,
        receiverName: resolvedReceiverName,
        hasBox: String(hasBox) === 'true' || hasBox === 'on',
        hasWifiDongle: String(hasWifiDongle) === 'true' || hasWifiDongle === 'on',
        isWarranty: isWarrantyBoolean,
        status: jobStatus,
        ...(verifiedBrandId && { brandId: verifiedBrandId }),
        ...(verifiedBackupId && { backupDeviceId: verifiedBackupId }),
        ...(verifiedUserId && { userId: verifiedUserId }),
        ...(structuredImages.length > 0 && {
          images: {
            create: structuredImages.map((img) => ({ 
              url: img.url, 
              type: img.type // 🌟 บันทึกประเภท NAMEPLATE และ OTHER อย่างแม่นยำ
            })),
          },
        }),
      },
    });

    // 🌟 7. เงื่อนไขอัตโนมัติ: หากเป็น CLAIM_NEW_MACHINE และหมวดหมู่เป็น อินเวอร์เตอร์ หรือ แบตเตอรี่
    const cleanCategory = category ? String(category).trim().toLowerCase() : '';
    const isTargetCategory = 
      cleanCategory.includes('อินเวอร์เตอร์') || 
      cleanCategory.includes('inverter') || 
      cleanCategory.includes('แบตเตอรี่') || 
      cleanCategory.includes('battery');

    if (jobStatus === 'CLAIM_NEW_MACHINE' && isTargetCategory && serialNumber) {
      try {
        const existingBackup = await prisma.backupDevice.findFirst({
          where: { serialNumber: String(serialNumber).trim() }
        });

        if (!existingBackup) {
          const nameplateImgObj = structuredImages.find(img => img.type === 'NAMEPLATE');
          const nameplateUrl = nameplateImgObj ? nameplateImgObj.url : (structuredImages.length > 0 ? structuredImages[0].url : null);

          const newBackupDevice = await prisma.backupDevice.create({
            data: {
              category: String(category),
              brandId: verifiedBrandId || null,
              model: model ? String(model) : 'ไม่ระบุรุ่น',
              serialNumber: String(serialNumber).trim(),
              productNo: productNo ? String(productNo) : null,
              status: 'MAINTENANCE',
              customerName: null,
              phone: null,
              note: `รับเข้าจากเคสเคลมเครื่องใหม่ (ลูกค้าเดิม: ${customerName} - โทร: ${phone || 'ไม่ระบุ'} | Job No: ${newJob.jobNo})`,
              hasBox: String(hasBox) === 'true' || hasBox === 'on',
              hasWifiDongle: String(hasWifiDongle) === 'true' || hasWifiDongle === 'on',
              wifiDongleSn: wifiDongleSn ? String(wifiDongleSn) : null,
              imageUrl: nameplateUrl,
              receiverName: resolvedReceiverName,
              ...(verifiedUserId && { userId: verifiedUserId, receiverId: verifiedUserId }),
            }
          });

          if (structuredImages.length > 0) {
            await prisma.backupDeviceImage.createMany({
              data: structuredImages.map((img) => ({
                backupDeviceId: newBackupDevice.id,
                url: img.url,
                type: img.type,
              }))
            });
          }
        }
      } catch (backupErr) {
        console.error('Failed to auto-create backup device from claim:', backupErr);
      }
    }

    return NextResponse.json({ success: true, jobId: newJob.id, jobNo: newJob.jobNo }, { status: 201 });
  } catch (error) {
    console.error('Failed to create job:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}