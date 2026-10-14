'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { hash, compare } from 'bcryptjs';
import { revalidatePath } from 'next/cache';

// อัปเดตข้อมูลส่วนตัว (ชื่อ และ Username)
export async function updateProfile(formData: FormData) {
  const session = await getServerSession();
  const email = session?.user?.email;

  if (!email) {
    return { success: false, message: 'กรุณาเข้าสู่ระบบใหม่' };
  }

  const name = formData.get('name') as string;
  const username = formData.get('username') as string;

  try {
    await prisma.user.update({
      where: { email },
      data: {
        name,
        username,
      },
    });

    revalidatePath('/dashboard/profile');
    return { success: true, message: 'บันทึกข้อมูลส่วนตัวสำเร็จ' };
  } catch (error) {
    return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
}

// อัปเดตเปลี่ยนรหัสผ่าน
export async function updatePassword(formData: FormData) {
  const session = await getServerSession();
  const email = session?.user?.email;

  if (!email) {
    return { success: false, message: 'กรุณาเข้าสู่ระบบใหม่' };
  }

  const currentPassword = formData.get('currentPassword') as string;
  const newPassword = formData.get('newPassword') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' };
  }

  if (newPassword.length < 6) {
    return { success: false, message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, message: 'รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน' };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      return { success: false, message: 'ไม่พบข้อมูลผู้ใช้งาน' };
    }

    // ตรวจสอบรหัสผ่านเดิมว่าถูกต้องไหม
    const isValid = await compare(currentPassword, user.password);
    if (!isValid) {
      return { success: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' };
    }

    // แฮชรหัสผ่านใหม่แล้วบันทึก
    const hashedPassword = await hash(newPassword, 10);
    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
      },
    });

    return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' };
  } catch (error) {
    return { success: false, message: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน' };
  }
}