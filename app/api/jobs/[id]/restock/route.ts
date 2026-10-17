import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";

// สร้าง Supabase Client สำหรับอัปโหลดไฟล์ไปที่ Storage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = "repair-images";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = await props.params;
    const jobId = params.id;

    if (!jobId) {
      return NextResponse.json({ error: "ไม่พบรหัสใบงาน (Job ID)" }, { status: 400 });
    }

    // 📌 1. ดึงข้อมูลผู้ใช้งานจาก Session
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.id;
    const sessionUserEmail = session?.user?.email;

    // 📌 2. ตรวจสอบว่ามีผู้ใช้นี้อยู่ในฐานข้อมูลจริงหรือไม่ เพื่อป้องกัน Foreign Key Violation
    let validUserId: string | null = null;
    if (sessionUserId) {
      const userInDb = await prisma.user.findUnique({
        where: { id: sessionUserId },
      });
      if (userInDb) {
        validUserId = userInDb.id;
      }
    } else if (sessionUserEmail) {
      const userInDb = await prisma.user.findUnique({
        where: { email: sessionUserEmail },
      });
      if (userInDb) {
        validUserId = userInDb.id;
      }
    }

    const formData = await request.formData();
    const sparePartId = formData.get("sparePartId") as string;
    const quantityStr = formData.get("quantity") as string;
    const note = formData.get("note") as string;
    
    const image1 = formData.get("image1") as File | null;
    const image2 = formData.get("image2") as File | null;

    const quantity = quantityStr ? parseInt(quantityStr, 10) : 1;

    if (!sparePartId) {
      return NextResponse.json({ error: "กรุณาเลือกรายการอะไหล่" }, { status: 400 });
    }

    const existingJob = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!existingJob) {
      return NextResponse.json({ error: "ไม่พบใบงานนี้ในระบบ" }, { status: 404 });
    }

    let image1Path = null;
    let image2Path = null;

    // ฟังก์ชันช่วยอัปโหลดไฟล์ขึ้น Supabase Storage
    const uploadToSupabase = async (file: File, prefix: string) => {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filename = `${Date.now()}-${prefix}-${file.name.replaceAll(" ", "_")}`;
      const filePath = `restock/${jobId}/${filename}`;

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: true,
        });

      if (error) {
        throw new Error(`ไม่สามารถอัปโหลดรูปภาพได้: ${error.message}`);
      }

      // ดึง Public URL ของรูปที่อัปโหลด
      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    };

    if (image1 && image1.size > 0) {
      image1Path = await uploadToSupabase(image1, "1");
    }

    if (image2 && image2.size > 0) {
      image2Path = await uploadToSupabase(image2, "2");
    }

    const result = await prisma.$transaction(async (tx) => {
      const part = await tx.sparePart.findUnique({
        where: { id: sparePartId },
      });

      if (!part || part.stock < quantity) {
        throw new Error(`อะไหล่ ${part?.name || ""} ในคลังไม่เพียงพอสำหรับตัดสต็อก`);
      }

      await tx.sparePart.update({
        where: { id: sparePartId },
        data: { stock: { decrement: quantity } },
      });

      // 1. สร้าง StockLog สำหรับบันทึกประวัติการเบิกอะไหล่
      const stockLog = await tx.stockLog.create({
        data: {
          sparePartId: sparePartId,
          jobId: jobId,
          quantity: -quantity,
          type: "USE_FOR_REPAIR",
          note: note ? `เบิกอะไหล่สำหรับซ่อม: ${note}` : `ตัดสต็อกอัตโนมัติสำหรับการซ่อมบำรุง`,
          userId: validUserId,
        },
      });

      // 2. บันทึก URL รูปภาพลงตาราง JobImage
      if (image1Path) {
        await tx.jobImage.create({
          data: {
            url: image1Path,
            type: "DUAL_IMAGE",
            jobId: jobId,
            stockLogId: stockLog.id,
          },
        });
      }

      if (image2Path) {
        await tx.jobImage.create({
          data: {
            url: image2Path,
            type: "DUAL_IMAGE",
            jobId: jobId,
            stockLogId: stockLog.id,
          },
        });
      }

      // 3. แก้ไขสถานะเป็น IN_REPAIR
      const updatedJob = await tx.job.update({
        where: { id: jobId },
        data: {
          status: "IN_REPAIR",
        },
      });

      return updatedJob;
    });

    return NextResponse.json({
      success: true,
      message: "เบิกอะไหล่และบันทึกข้อมูลเรียบร้อยแล้ว",
      data: result,
    });

  } catch (error: any) {
    console.error("Error in restock API:", error);
    return NextResponse.json(
      { error: error.message || "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" },
      { status: 500 }
    );
  }
}