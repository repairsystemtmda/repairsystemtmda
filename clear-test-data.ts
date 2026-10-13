import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('กำลังเริ่มเคลียร์ข้อมูลทดสอบ...');

  // 1. ลบรูปภาพและประวัติที่ผูกกับเครื่องสำรองและงานซ่อมก่อน (ตารางลูก)
  await prisma.backupDeviceImage.deleteMany({});
  console.log('✔ ลบรูปภาพเครื่องสำรองเรียบร้อย');

  await prisma.jobImage.deleteMany({});
  console.log('✔ ลบรูปภาพใบงานเรียบร้อย');

  await prisma.stockLog.deleteMany({});
  console.log('✔ ลบประวัติสต็อกเรียบร้อย');

  // 2. ลบข้อมูลหลัก (งานซ่อม และ เครื่องสำรอง)
  await prisma.job.deleteMany({});
  console.log('✔ ลบรายการซ่อมทั้งหมดเรียบร้อย');

  await prisma.backupDevice.deleteMany({});
  console.log('✔ ลบรายการเครื่องสำรองทั้งหมดเรียบร้อย');

  console.log('🎉 เคลียร์ข้อมูลทดสอบสำเร็จ! บัญชีผู้ใช้ (Admin) ยังอยู่ครบถ้วน');
}

main()
  .catch((e) => {
    console.error('เกิดข้อผิดพลาดในการเคลียร์ข้อมูล:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });