import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // 1. สร้างบัญชี Admin เริ่มต้น
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@inverter.com' },
    update: {},
    create: {
      email: 'admin@inverter.com',
      name: 'System Admin',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });
  console.log('Admin user ready:', admin.email);

  // 2. สร้างแบรนด์เริ่มต้นสำหรับจับคู่เครื่องและอะไหล่
  const brandNames = ['Deye', 'Huawei', 'Growatt', 'Solis', 'Sungrow'];
  const createdBrands: Record<string, string> = {};

  for (const name of brandNames) {
    const brand = await prisma.brand.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    createdBrands[name] = brand.id;
  }
  console.log('Brands seeded:', Object.keys(createdBrands));

  // 3. สร้างตัวอย่างเครื่องสำรอง (Backup Devices)
  const backupDevice = await prisma.backupDevice.upsert({
    where: { serialNumber: 'BK-DEYE-5K-001' },
    update: {},
    create: {
      brandId: createdBrands['Deye'],
      model: 'SUN-5K-SG04LP1-EU',
      category: 'INVERTER',
      serialNumber: 'BK-DEYE-5K-001',
      status: 'AVAILABLE',
    },
  });

  // 4. สร้างตัวอย่างอะไหล่ / บอร์ดซ่อม (Spare Parts)
  const sparePart = await prisma.sparePart.upsert({
    where: { boardSerialNumber: 'BOARD-DEYE-MAIN-01' },
    update: {},
    create: {
      code: 'SP-DEYE-MAIN-5K',
      name: 'Main Board Deye 5kW Hybrid',
      model: 'SUN-5K-SG04LP1-EU',
      boardSerialNumber: 'BOARD-DEYE-MAIN-01',
      brandId: createdBrands['Deye'],
      category: 'MAIN_BOARD',
      stock: 10,
      minQuantity: 2,
    },
  });

  // 5. สร้างใบแจ้งซ่อมตัวอย่าง (Sample Job)
  const sampleJob = await prisma.job.upsert({
    where: { jobNo: 'JOB-202609-001' },
    update: {},
    create: {
      jobNo: 'JOB-202609-001',
      status: 'PENDING',
      category: 'INVERTER',
      brandId: createdBrands['Deye'],
      model: 'SUN-5K-SG04LP1-EU',
      serialNumber: '2301158001',
      productNo: 'PROD-DEYE-5K',
      isWarranty: true,
      customerName: 'คุณสมชาย ใจดี',
      phone: '0812345678',
      receiverName: 'ช่างต้อม',
      note: 'หน้าจอขึ้น Error F56 เครื่องดับเองขณะใช้งาน',
      hasBox: true,
      hasWifiDongle: true,
      wifiDongleSn: 'WIFI-2301158001',
    },
  });

  console.log('Sample Job seeded:', sampleJob.jobNo);
  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });