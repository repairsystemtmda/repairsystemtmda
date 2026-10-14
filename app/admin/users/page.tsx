import { prisma } from "@/lib/prisma";
import { Shield, Mail, Calendar, Trash2, CheckCircle, XCircle } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import RoleSelector from "./_components/RoleSelector";
import { revalidatePath } from "next/cache";

export default async function AdminUsersManagementPage() {
  const session = await getServerSession(authOptions);
  const currentUserId = (session?.user as any)?.id;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });

  // 1. Server Action สำหรับอัปเดตสิทธิ์ผู้ใช้
  async function updateRoleAction(userId: string, newRole: string) {
    'use server';
    await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });
    revalidatePath("/admin/users");
  }

  // 2. Server Action สำหรับสลับสถานะอนุมัติบัญชี (Active / Inactive)
  async function toggleActiveAction(userId: string, currentStatus: boolean) {
    'use server';
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: !currentStatus },
    });
    revalidatePath("/admin/users");
  }

  // 3. Server Action สำหรับลบผู้ใช้
  async function deleteUserAction(userId: string) {
    'use server';
    if (userId === currentUserId) return; // ป้องกันลบตัวเอง

    await prisma.user.delete({
      where: { id: userId },
    });
    revalidatePath("/admin/users");
  }

  return (
    <div className="min-h-screen bg-gray-50/50 py-4 px-3 sm:p-6 text-gray-900 font-sans">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        
        {/* Header Section (เอาปุ่มเพิ่มพนักงานใหม่ออกแล้ว) */}
        <div className="bg-white border border-gray-200 p-4 sm:p-6 rounded-2xl shadow-sm">
          <div>
            <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-gray-900">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 shrink-0" /> 
              <span>จัดการผู้ใช้งานระบบ</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              จัดการสิทธิ์และอนุมัติบัญชีผู้ใช้งานทั้งหมดในระบบ
            </p>
          </div>
        </div>

        {/* Users Cards List */}
        <div className="space-y-3 sm:space-y-4">
          {users.length > 0 ? (
            users.map((user) => {
              const isSelf = user.id === currentUserId;

              return (
                <div 
                  key={user.id} 
                  className="bg-white border border-gray-200 p-4 sm:p-5 rounded-2xl shadow-sm hover:shadow-md transition space-y-3"
                >
                  {/* แถวบน: ชื่อ และ Dropdown เปลี่ยนสิทธิ์ */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[11px] text-gray-400 font-medium">ชื่อ-นามสกุล / พนักงาน</span>
                      <h2 className="font-bold text-gray-900 text-sm sm:text-base mt-0.5">{user.name}</h2>
                    </div>
                    
                    <div className="shrink-0">
                      <RoleSelector
                        userId={user.id}
                        currentRole={user.role}
                        isSelf={isSelf}
                        updateRoleAction={updateRoleAction}
                      />
                    </div>
                  </div>

                  {/* แถวกลาง: ข้อมูลอีเมล และ วันที่สร้าง */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                    <div>
                      <span className="text-gray-400 text-[11px] block">อีเมล (Email)</span>
                      <div className="flex items-center gap-1.5 text-gray-800 font-medium mt-0.5 truncate">
                        <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{user.email}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[11px] block">วันที่สร้างบัญชี</span>
                      <div className="flex items-center gap-1.5 text-gray-800 font-medium mt-0.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>
                          {new Date(user.createdAt).toLocaleDateString("th-TH", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Username ถ้ามี */}
                  {user.username && (
                    <div className="text-[11px] text-gray-500 pt-1">
                      <span className="text-gray-400">Username:</span> {user.username}
                    </div>
                  )}

                  {/* แถวล่างสุด: สถานะ (อนุมัติ/รออนุมัติ) และ ปุ่มควบคุม */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div>
                      {user.isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                          <CheckCircle className="w-3.5 h-3.5" /> บัญชีใช้งานปกติ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 font-semibold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
                          <XCircle className="w-3.5 h-3.5" /> รอการอนุมัติ
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* ปุ่มกดเปิด/ปิดสถานะอนุมัติ */}
                      <form action={async () => { 'use server'; await toggleActiveAction(user.id, user.isActive); }}>
                        <button
                          type="submit"
                          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                            user.isActive 
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200' 
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm'
                          }`}
                        >
                          {user.isActive ? "ระงับการใช้งาน" : "อนุมัติบัญชี"}
                        </button>
                      </form>

                      {/* ปุ่มลบผู้ใช้งาน */}
                      <form action={async () => { 'use server'; await deleteUserAction(user.id); }}>
                        <button
                          type="submit"
                          disabled={isSelf}
                          className={`p-1.5 rounded-xl border transition ${isSelf ? 'opacity-40 cursor-not-allowed bg-gray-50 text-gray-400 border-gray-200' : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200'}`}
                          title={isSelf ? "ไม่สามารถลบบัญชีตัวเองได้" : "ลบผู้ใช้งาน"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </form>
                    </div>
                  </div>

                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-gray-400 text-xs bg-white border border-gray-200 rounded-2xl">
              ยังไม่มีข้อมูลพนักงานในระบบ
            </div>
          )}
        </div>

      </div>
    </div>
  );
}