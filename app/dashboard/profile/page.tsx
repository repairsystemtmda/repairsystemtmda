import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { User, Lock, Mail, Shield, Calendar } from 'lucide-react';
import ProfileForm from './_components/ProfileForm';
import PasswordForm from './_components/PasswordForm';

export default async function ProfilePage() {
  const session = await getServerSession();
  const email = session?.user?.email;

  const currentUser = email
    ? await prisma.user.findUnique({ where: { email } })
    : null;

  if (!currentUser) {
    return <div className="p-6 text-center text-gray-500">กรุณาเข้าสู่ระบบใหม่</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* ส่วนหัว */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <User className="w-7 h-7 text-blue-600" /> โปรไฟล์ผู้ใช้งาน (User Profile)
          </h1>
          <p className="text-sm text-gray-600 mt-1 font-medium">จัดการข้อมูลส่วนตัวและเปลี่ยนรหัสผ่านบัญชีของคุณ</p>
        </div>
        <div className="hidden sm:flex flex-col items-end">
          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-200">
            {currentUser.role}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ข้อมูลสรุปด้านซ้าย */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4 h-fit">
          <div className="flex flex-col items-center text-center pb-4 border-b border-gray-100">
            <div className="w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold shadow-md mb-3">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-lg font-bold text-gray-900">{currentUser.name}</h2>
            <p className="text-xs text-gray-500 font-medium">{currentUser.email}</p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between text-gray-600">
              <span className="flex items-center gap-2"><Shield className="w-4 h-4 text-gray-400" /> สิทธิ์ระบบ:</span>
              <span className="font-bold text-gray-900">{currentUser.role}</span>
            </div>
            <div className="flex items-center justify-between text-gray-600">
              <span className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" /> เป็นสมาชิกตั้งแต่:</span>
              <span className="font-bold text-gray-900">
                {new Date(currentUser.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* ฟอร์มแก้ไขด้านขวา */}
        <div className="md:col-span-2 space-y-6">
          {/* ฟอร์มแก้ไขข้อมูลส่วนตัว */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" /> แก้ไขข้อมูลส่วนตัว
            </h3>
            <ProfileForm 
              initialName={currentUser.name} 
              initialUsername={currentUser.username || ''} 
              email={currentUser.email} 
            />
          </div>

          {/* ฟอร์มเปลี่ยนรหัสผ่าน */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-600" /> เปลี่ยนรหัสผ่าน
            </h3>
            <PasswordForm />
          </div>
        </div>
      </div>
    </div>
  );
}