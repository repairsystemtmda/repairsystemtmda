import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

// GET: ดึงรายการไฟล์สำรองข้อมูลทั้งหมดในเครื่อง
export async function GET() {
  try {
    const backupDir = path.join(process.cwd(), "prisma", "backups");

    if (!fs.existsSync(backupDir)) {
      return NextResponse.json({ success: true, files: [] });
    }

    const filenames = fs.readdirSync(backupDir);
    const files = filenames
      .filter((file) => file.endsWith('.json')) // รองรับไฟล์ JSON ที่สำรองจาก Supabase
      .map((file) => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          createdAt: stats.birthtime || stats.mtime,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ success: true, files });
  } catch (error: any) {
    console.error('Error fetching backup files:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: ดึงข้อมูลจาก Supabase มาสร้างไฟล์สำรอง (JSON) เก็บไว้ในคอมพิวเตอร์
export async function POST() {
  try {
    // 1. ดึงข้อมูลหลักทั้งหมดจาก Supabase ผ่าน Prisma
    const jobs = await prisma.job.findMany({ 
      include: { 
        images: true, 
        stockLogs: { include: { sparePart: true, images: true } },
        brand: true,
        backupDevice: true,
        user: true
      } 
    });
    const backupDevices = await prisma.backupDevice.findMany();
    const brands = await prisma.brand.findMany();

    const backupData = {
      exportedAt: new Date().toISOString(),
      jobs,
      backupDevices,
      brands,
    };

    // 2. เตรียมโฟลเดอร์สำหรับเก็บไฟล์สำรองในเครื่องคอมพิวเตอร์
    const backupDir = path.join(process.cwd(), "prisma", "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-CA");
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "-");
    const backupFileName = `supabase-backup-${dateStr}_${timeStr}.json`;
    const backupPath = path.join(backupDir, backupFileName);

    // 3. เขียนข้อมูลลงไฟล์ JSON
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      message: "สำรองข้อมูลจาก Supabase สำเร็จ",
      filename: backupFileName,
    });
  } catch (error: any) {
    console.error("Backup error:", error);
    return NextResponse.json(
      { success: false, message: "เกิดข้อผิดพลาดในการสำรองข้อมูล", error: error.message },
      { status: 500 }
    );
  }
}