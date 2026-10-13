import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('123654789', 10);

  const user = await prisma.user.upsert({
    where: { email: 'adminTMDA@inverter.com' },
    update: {
      username: 'adminTMDA',
      name: 'adminTMDA',
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      email: 'adminTMDA@inverter.com',
      username: 'adminTMDA',
      name: 'adminTMDA',
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('✅ ตั้งค่าบัญชีสำเร็จ:', user.id, user.email);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());