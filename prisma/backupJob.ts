import 'dotenv/config';
import nodemailer from 'nodemailer';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';

console.log('🔄 เริ่มต้นสคริปต์แบ็คอัพฐานข้อมูล...');

// ตั้งค่าตัวส่งอีเมล
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 10000,
  socketTimeout: 10000,
});

export async function sendDatabaseBackup() {
  try {
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
    const backupDir = path.join(process.cwd(), 'prisma', 'backups');

    // 1. ตรวจสอบว่ามีไฟล์ฐานข้อมูลต้นฉบับไหม
    if (!fs.existsSync(dbPath)) {
      console.error('❌ ไม่พบไฟล์ฐานข้อมูล dev.db สำหรับแบ็คอัพ');
      return;
    }

    // 2. สร้างโฟลเดอร์ backups ถ้ายังไม่มี
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 3. ทำ Local Backup (ก๊อปปี้ไฟล์เก็บไว้ในเครื่อง)
    const todayStr = new Date().toISOString().split('T')[0];
    const backupFileName = `dev-${todayStr}.db`;
    const backupFilePath = path.join(backupDir, backupFileName);

    fs.copyFileSync(dbPath, backupFilePath);
    console.log(`💾 บันทึกไฟล์สำรองในเครื่องสำเร็จ: ${backupFilePath}`);

    // 4. พยายามส่งอีเมล (ครอบด้วย try/catch แยก เพื่อไม่ให้ติดขัดเรื่องเน็ตแล้วหยุดทำงาน)
    try {
      const mailOptions = {
        from: process.env.EMAIL_SERVER_USER,
        to: process.env.EMAIL_ADMIN_RECIPIENT,
        subject: `[Inverter System] 💾 Automated Database Backup - ${todayStr}`,
        text: 'ระบบได้ทำการแบ็คอัพฐานข้อมูล SQLite (dev.db) เรียบร้อยแล้ว รายละเอียดไฟล์ฐานข้อมูลแนบมาพร้อมกับอีเมลฉบับนี้ครับ',
        attachments: [
          {
            filename: backupFileName,
            path: backupFilePath,
          },
        ],
      };

      console.log('⏳ กำลังส่งอีเมลแจ้งเตือนพร้อมไฟล์แนบ...');
      const info = await transporter.sendMail(mailOptions);
      console.log('✅ ส่งอีเมลแบ็คอัพสำเร็จเรียบร้อยแล้ว! Response:', info.response);
    } catch (emailError) {
      console.warn('⚠️ ไม่สามารถส่งอีเมลได้ (เครือข่าย/พอร์ตอาจถูกบล็อก) แต่ไฟล์ถูกสำรองเก็บไว้ในโฟลเดอร์ backups เรียบร้อยแล้ว');
    }

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในกระบวนการแบ็คอัพ:', error);
  }
}

// 📌 สั่งรันฟังก์ชันทันทีเพื่อทดสอบระบบ
sendDatabaseBackup();

// ตั้งเวลา Cron Job: ทำงานทุกวันตอนเที่ยงคืน (00:00 น.)
cron.schedule('0 0 * * *', () => {
  console.log('🕒 ถึงเวลาเที่ยงคืน! เริ่มต้นกระบวนการแบ็คอัพอัตโนมัติ...');
  sendDatabaseBackup();
});

console.log('🚀 ระบบ Cron Job และ Local Backup เริ่มต้นทำงานเรียบร้อยแล้ว');