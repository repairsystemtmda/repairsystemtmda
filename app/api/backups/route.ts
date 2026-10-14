import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const backupDir = path.join(process.cwd(), "prisma", "backups");

    if (!fs.existsSync(backupDir)) {
      return NextResponse.json({ success: true, files: [] });
    }

    const filenames = fs.readdirSync(backupDir);
    const files = filenames
      .filter((file) => file.endsWith('.db') || file.endsWith('.sqlite'))
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

export async function POST() {
  try {
    const dbPath = path.join(process.cwd(), "prisma", "dev.db");
    const backupDir = path.join(process.cwd(), "prisma", "backups");

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-CA");
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "-");
    const backupFileName = `dev-${dateStr}_${timeStr}.db`;
    const backupPath = path.join(backupDir, backupFileName);

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json(
        { success: false, message: "ไม่พบไฟล์ฐานข้อมูลหลัก" },
        { status: 404 }
      );
    }

    fs.copyFileSync(dbPath, backupPath);

    return NextResponse.json({
      success: true,
      message: "สำรองข้อมูลสำเร็จ",
      filename: backupFileName,
    });
  } catch (error) {
    console.error("Backup error:", error);
    return NextResponse.json(
      { success: false, message: "เกิดข้อผิดพลาดในการสำรองข้อมูล" },
      { status: 500 }
    );
  }
}