import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { 
  Package, 
  ArrowLeft, 
  History, 
  CheckCircle2, 
  SlidersHorizontal, 
  Tag, 
  Cpu, 
  MapPin, 
  Layers, 
  Edit3, 
  X,
  Boxes
} from 'lucide-react';

// รายการประเภทบอร์ดสำหรับ Inverter[cite: 7]
const INVERTER_BOARD_TYPES = [
  { value: 'MAIN_BOARD', label: 'MAIN_BOARD (เมนบอร์ด)' },
  { value: 'AC_BOARD', label: 'AC_BOARD (บอร์ด AC)' },
  { value: 'POWER_BOARD', label: 'POWER_BOARD (บอร์ดพาวเวอร์)' },
  { value: 'IGBT_BOARD', label: 'IGBT_BOARD (บอร์ด IGBT)' },
  { value: 'CONTROL_BOARD', label: 'CONTROL_BOARD (บอร์ดควบคุม)' },
  { value: 'LCD_BOARD', label: 'LCD_BOARD (บอร์ดหน้าจอแสดงผล)' },
  { value: 'COMMUNICATION_BOARD', label: 'COMMUNICATION_BOARD (บอร์ดการสื่อสาร)' },
  { value: 'FILTER_BOARD', label: 'FILTER_BOARD (บอร์ดกรองไฟ)' },
  { value: 'RELAY_BOARD', label: 'RELAY_BOARD (บอร์ดรีเลย์)' },
  { value: 'CAPACITOR_BOARD', label: 'CAPACITOR_BOARD (บอร์ดคาปาซิเตอร์)' },
  { value: 'WIFI_BOARD', label: 'WIFI_BOARD (บอร์ดไวไฟ)' },
  { value: 'INV_BOARD', label: 'INV_BOARD (บอร์ดอินเวอร์เตอร์)' },
  { value: 'IND_BOARD', label: 'IND_BOARD (บอร์ดอินดักเตอร์)' },
  { value: 'GEN_BOARD', label: 'GEN_BOARD (บอร์ดเจนเนอเรเตอร์)' },
  { value: 'PID_BOARD', label: 'PID_BOARD (บอร์ด PID)' },
  { value: 'PV_BOARD', label: 'PV_BOARD (บอร์ด PV)' },
  { value: 'ARC_BOARD', label: 'ARC_BOARD (บอร์ด ARC)' },
];

export default async function SparePartDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; stockSuccess?: string; edit?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const id = resolvedParams.id;
  const isSuccess = resolvedSearchParams?.success === 'true';
  const isStockSuccess = resolvedSearchParams?.stockSuccess === 'true';
  const isEditing = resolvedSearchParams?.edit === 'true';

  // ตรวจสอบ Session และสิทธิ์ผู้ใช้งานปัจจุบัน[cite: 7]
  const session = await getServerSession();
  const currentUserEmail = session?.user?.email;
  
  const currentUser = currentUserEmail 
    ? await prisma.user.findUnique({ where: { email: currentUserEmail } })
    : null;

  const isAdmin = currentUser?.role === 'ADMIN';

  // ดึงข้อมูลอะไหล่จากฐานข้อมูล[cite: 7]
  const part = await prisma.sparePart.findUnique({
    where: { id },
  });

  if (!part) {
    notFound();
  }

  // ดึงประวัติการทำรายการ (ดึงเฉพาะเมื่อเป็น ADMIN)[cite: 7]
  const logs = isAdmin ? await prisma.stockLog.findMany({
    where: { sparePartId: id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  }) : [];

  // Server Action สำหรับอัปเดตข้อมูลรายละเอียดอะไหล่ทั่วไป (เฉพาะ Admin)[cite: 7]
  async function updateSparePart(formData: FormData) {
    'use server';
    const sessionCheck = await getServerSession();
    const userCheck = sessionCheck?.user?.email 
      ? await prisma.user.findUnique({ where: { email: sessionCheck.user.email } }) 
      : null;

    if (userCheck?.role !== 'ADMIN') return;

    const name = formData.get('name') as string;
    const boardModelCode = formData.get('boardModelCode') as string;
    const category = formData.get('category') as string;
    const boardType = formData.get('boardType') as string;
    const model = formData.get('model') as string;
    const location = formData.get('location') as string;
    const minQuantity = parseInt(formData.get('minQuantity') as string) || 0;

    if (!name) return;

    try {
      await prisma.sparePart.update({
        where: { id },
        data: {
          name,
          boardModelCode,
          category,
          boardType,
          model,
          location,
          minQuantity,
        },
      });

      revalidatePath(`/dashboard/inventory/boards/${id}`);
      revalidatePath('/dashboard/inventory/boards');
    } catch (error) {
      console.error('Failed to update spare part:', error);
    }

    redirect(`/dashboard/inventory/boards/${id}?success=true`);
  }

  // Server Action สำหรับแอดมินปรับเพิ่ม/ลดสต็อกโดยตรง พร้อมบันทึก Log (เฉพาะ Admin)[cite: 7]
  async function adjustStock(formData: FormData) {
    'use server';
    const sessionCheck = await getServerSession();
    const userCheck = sessionCheck?.user?.email 
      ? await prisma.user.findUnique({ where: { email: sessionCheck.user.email } }) 
      : null;

    if (userCheck?.role !== 'ADMIN') return;

    const actionType = formData.get('actionType') as 'ADD' | 'DEDUCT';
    const amount = parseInt(formData.get('amount') as string) || 0;
    const note = formData.get('note') as string;

    if (amount <= 0) return;

    const currentPart = await prisma.sparePart.findUnique({ where: { id } });
    if (!currentPart) return;

    const quantityChange = actionType === 'ADD' ? amount : -amount;
    const newStock = currentPart.stock + quantityChange;

    if (newStock < 0) {
      return;
    }

    try {
      await prisma.$transaction([
        prisma.sparePart.update({
          where: { id },
          data: { stock: newStock },
        }),
        prisma.stockLog.create({
          data: {
            sparePartId: id,
            type: actionType === 'ADD' ? 'RESTOCK' : 'ADJUST_OUT',
            quantity: quantityChange,
            note: note ? `[Admin ปรับสต็อก] ${note}` : '[Admin ปรับสต็อกโดยตรง]',
          },
        }),
      ]);

      revalidatePath(`/dashboard/inventory/boards/${id}`);
      revalidatePath('/dashboard/inventory/boards');
    } catch (error) {
      console.error('Failed to adjust stock:', error);
    }

    redirect(`/dashboard/inventory/boards/${id}?stockSuccess=true`);
  }

  // ค้นหา Label สำหรับแสดงผลในโหมดดูข้อมูลปกติ (Read-only)[cite: 7]
  const currentBoardTypeObj = INVERTER_BOARD_TYPES.find(
    (t) => t.value === (part as any).boardType
  );
  const displayBoardType = currentBoardTypeObj
    ? currentBoardTypeObj.label
    : (part as any).boardType || '-';

  return (
    <div className="p-3 sm:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6 pb-24">
      
      {/* ส่วนหัว และปุ่มย้อนกลับ[cite: 7] */}
      <div className="flex items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href="/dashboard/inventory/boards"
            className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-700 transition shadow-xs flex-shrink-0"
            title="ย้อนกลับ"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-base sm:text-2xl font-bold text-gray-900 flex items-center gap-1.5 truncate">
              <Package className="w-5 h-5 sm:w-7 sm:h-7 text-blue-600 flex-shrink-0" /> <span className="truncate">รายละเอียดบอร์ดอะไหล่</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 truncate">ข้อมูลเชิงลึกและตำแหน่งจัดเก็บ</p>
          </div>
        </div>
      </div>

      {/* แถบแจ้งเตือนเมื่อบันทึกสำเร็จ[cite: 7] */}
      {isSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-sm text-xs sm:text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>บันทึกการแก้ไขข้อมูลอะไหล่เรียบร้อยแล้ว!</span>
        </div>
      )}

      {isStockSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-sm text-xs sm:text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>ปรับปรุงจำนวนสต็อกและบันทึกประวัติสำเร็จ!</span>
        </div>
      )}

      {/* การ์ดแสดงข้อมูลทั่วไป[cite: 7] */}
      <div className="bg-white p-4 sm:p-8 rounded-2xl shadow-sm border border-gray-200 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-4 gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600 flex-shrink-0" /> รายละเอียดและสถานะ
            </h2>
            <span className={`text-xs px-2.5 py-1 font-bold rounded-xl border shadow-xs ${
              part.stock > part.minQuantity 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
            }`}>
              สถานะ: {part.stock > part.minQuantity ? 'ปกติ' : 'เหลือน้อย'}
            </span>
          </div>

          {/* ปุ่มสลับโหมด แก้ไขข้อมูล (แสดงเฉพาะ ADMIN เท่านั้น)[cite: 7] */}
          <div>
            {isAdmin && (
              isEditing ? (
                <Link
                  href={`/dashboard/inventory/boards/${id}`}
                  className="w-full sm:w-auto px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
                >
                  <X className="w-4 h-4" /> ยกเลิกการแก้ไข
                </Link>
              ) : (
                <Link
                  href={`/dashboard/inventory/boards/${id}?edit=true`}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-1.5"
                >
                  <Edit3 className="w-4 h-4" /> แก้ไขข้อมูล
                </Link>
              )
            )}
          </div>
        </div>

        {/* ฟอร์ม / แสดงข้อมูล[cite: 7] */}
        <form action={updateSparePart} className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5 sm:mb-2 flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-blue-600" /> ชื่อบอร์ดอะไหล่ *
            </label>
            <input
              type="text"
              name="name"
              defaultValue={part.name}
              required
              disabled={!isEditing}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition outline-none ${
                isEditing
                  ? 'bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs'
                  : 'bg-gray-50/80 border border-transparent text-gray-900 select-none'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5 sm:mb-2 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-blue-600" /> รหัสรุ่นบอร์ด (BOARD MODEL CODE)
            </label>
            <input
              type="text"
              name="boardModelCode"
              defaultValue={part.boardModelCode || ''}
              disabled={!isEditing}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold transition outline-none ${
                isEditing
                  ? 'bg-white border border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs'
                  : 'bg-gray-50/80 border border-transparent text-blue-600 select-none'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5 sm:mb-2 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-600" /> หมวดหมู่
            </label>
            {isEditing ? (
              // เพิ่ม appearance-none และ text-base เพื่อแก้ปัญหาช่องดรอปดาวน์เล็กบน iOS
              <select
                name="category"
                defaultValue={part.category || 'Inverter'}
                className="w-full px-3.5 py-2.5 appearance-none bg-white border border-gray-300 rounded-xl text-base sm:text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition shadow-xs"
              >
                <option value="Inverter">Inverter</option>
                <option value="Battery">Battery</option>
                <option value="Accessories">Accessories</option>
              </select>
            ) : (
              <input
                type="text"
                value={part.category || '-'}
                disabled
                className="w-full px-3.5 py-2.5 bg-gray-50/80 border border-transparent rounded-xl text-xs sm:text-sm font-bold text-gray-900 select-none"
              />
            )}
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5 sm:mb-2 flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-blue-600" /> ประเภทบอร์ด
            </label>
            {isEditing ? (
              // เพิ่ม appearance-none และ text-base เพื่อแก้ปัญหาช่องดรอปดาวน์เล็กบน iOS
              <select
                name="boardType"
                defaultValue={(part as any).boardType || ''}
                className="w-full px-3.5 py-2.5 appearance-none bg-white border border-gray-300 rounded-xl text-base sm:text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition shadow-xs"
              >
                <option value="">-- เลือกประเภทบอร์ด --</option>
                {INVERTER_BOARD_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={displayBoardType}
                disabled
                className="w-full px-3.5 py-2.5 bg-gray-50/80 border border-transparent rounded-xl text-xs sm:text-sm font-bold text-gray-900 select-none truncate"
              />
            )}
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5 sm:mb-2 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-blue-600" /> รุ่นเครื่องที่รองรับ
            </label>
            <input
              type="text"
              name="model"
              defaultValue={part.model || ''}
              disabled={!isEditing}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition outline-none ${
                isEditing
                  ? 'bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs'
                  : 'bg-gray-50/80 border border-transparent text-gray-900 select-none'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5 sm:mb-2 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-blue-600" /> ตำแหน่งจัดเก็บ (LOCATION)
            </label>
            <input
              type="text"
              name="location"
              defaultValue={part.location || ''}
              disabled={!isEditing}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition outline-none ${
                isEditing
                  ? 'bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs'
                  : 'bg-gray-50/80 border border-transparent text-gray-900 select-none'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5 sm:mb-2 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-blue-600" /> จำนวนแจ้งเตือนขั้นต่ำ (Min Quantity)
            </label>
            <input
              type="number"
              name="minQuantity"
              defaultValue={part.minQuantity}
              min="0"
              disabled={!isEditing}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition outline-none ${
                isEditing
                  ? 'bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs'
                  : 'bg-gray-50/80 border border-transparent text-gray-900 select-none'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5 sm:mb-2">
              จำนวนคงเหลือปัจจุบันในคลัง[cite: 7]
            </label>
            <div className="w-full px-3.5 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-xs sm:text-sm font-extrabold text-emerald-700 flex items-center justify-between">
              <span>{part.stock} ชิ้น</span>
              <span className="text-[11px] text-gray-500 font-normal">*(ยอดปัจจุบัน)*</span>
            </div>
          </div>

          {/* ปุ่มบันทึกข้อมูลทั่วไป[cite: 7] */}
          {isAdmin && isEditing && (
            <div className="md:col-span-2 flex justify-end pt-2">
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-2"
              >
                บันทึกการแก้ไขข้อมูล
              </button>
            </div>
          )}
        </form>
      </div>

      {/* ส่วนสำหรับ Admin ปรับเพิ่ม/ลดสต็อก (แสดงเฉพาะ ADMIN เท่านั้น)[cite: 7] */}
      {isAdmin && (
        <div className="bg-white p-4 sm:p-8 rounded-2xl shadow-sm border border-gray-200 space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <SlidersHorizontal className="w-5 h-5 text-slate-700 flex-shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-gray-900">จัดการสต็อกด่วน (Admin Adjustment)</h2>
          </div>
          
          <form action={adjustStock} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5 sm:mb-2">
                  ประเภทการปรับสต็อก *
                </label>
                {/* เพิ่ม appearance-none และ text-base เพื่อแก้ปัญหาช่องดรอปดาวน์เล็กบน iOS */}
                <select
                  name="actionType"
                  required
                  className="w-full px-3.5 py-2.5 appearance-none bg-white border border-gray-300 rounded-xl text-base sm:text-sm font-bold text-gray-900 focus:ring-2 focus:ring-slate-500/20 outline-none transition shadow-xs"
                >
                  <option value="ADD">➕ เพิ่มสต็อก (Restock / รับเข้า)</option>
                  <option value="DEDUCT">➖ ลดสต็อก (Adjust Out / ตัดออก)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5 sm:mb-2">
                  จำนวน (ชิ้น) *[cite: 7]
                </label>
                <input
                  type="number"
                  name="amount"
                  min="1"
                  required
                  placeholder="ระบุจำนวน..."
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-bold text-gray-900 focus:ring-2 focus:ring-slate-500/20 outline-none transition shadow-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5 sm:mb-2">
                หมายเหตุ / เหตุผลในการปรับ[cite: 7]
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  name="note"
                  placeholder="เช่น ตรวจนับสต็อกประจำเดือน..."
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm text-gray-900 focus:ring-2 focus:ring-slate-500/20 outline-none transition shadow-xs"
                />
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition flex-shrink-0"
                >
                  ยืนยันการปรับสต็อก
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ประวัติการเบิก-จ่าย ล่าสุด (แสดงเฉพาะ ADMIN เท่านั้น)[cite: 7] */}
      {isAdmin && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden space-y-3">
          <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-gray-900">ประวัติการเคลื่อนไหวล่าสุด</h2>
          </div>
          
          {/* 📱 มุมมองมือถือ: แสดงผลแบบ Card แนวตั้ง[cite: 7] */}
          <div className="grid grid-cols-1 gap-3 p-4 sm:hidden">
            {logs.length > 0 ? (
              logs.map((log) => (
                <div key={log.id} className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">{new Date(log.createdAt).toLocaleString('th-TH')}</span>
                    <span className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                      log.quantity > 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {log.type}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-200/60 pt-2 text-xs">
                    <span className="text-gray-600 font-medium">จำนวน: <strong className={`font-black ${log.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{log.quantity > 0 ? `+${log.quantity}` : log.quantity} ชิ้น</strong></span>
                  </div>
                  {log.note && (
                    <div className="text-xs text-gray-600 bg-white p-2 rounded-lg border border-gray-200">
                      <span className="font-bold text-gray-700">หมายเหตุ:</span> {log.note}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400 italic text-xs">
                ยังไม่มีประวัติการเคลื่อนไหวของอะไหล่นี้
              </div>
            )}
          </div>

          {/* 💻 มุมมองคอมพิวเตอร์ (Desktop): แสดงผลเป็นตาราง[cite: 7] */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-200 text-xs uppercase text-gray-600 font-bold tracking-wider">
                  <th className="p-4">วันที่/เวลา</th>
                  <th className="p-4">ประเภท</th>
                  <th className="p-4">จำนวน</th>
                  <th className="p-4">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-800 font-medium">
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition">
                      <td className="p-4 text-gray-600 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('th-TH')}
                      </td>
                      <td className="p-4 font-bold">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                          log.quantity > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {log.type}
                        </span>
                      </td>
                      <td className={`p-4 font-extrabold whitespace-nowrap ${log.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {log.quantity > 0 ? `+${log.quantity}` : log.quantity}
                      </td>
                      <td className="p-4 text-gray-600">
                        {log.note || '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-gray-400 italic font-normal">
                      ยังไม่มีประวัติการเคลื่อนไหวของอะไหล่นี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}