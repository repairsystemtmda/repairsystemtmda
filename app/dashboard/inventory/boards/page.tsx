import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { Package, PlusCircle, MinusCircle, RotateCcw, History, Eye, AlertTriangle, Layers, MapPin, ChevronLeft, ChevronRight, X, Download } from 'lucide-react';
import DeleteButton from './_components/DeleteButton';
import InventoryFilterForm from './_components/InventoryFilterForm';
import { FilterLinkButton } from './_components/FilterLinkButton';

export const dynamic = 'force-dynamic';

const STANDARD_BOARD_TYPES = [
  "MAIN_BOARD", "AC_BOARD", "POWER_BOARD", "IGBT_BOARD", "CONTROL_BOARD", 
  "LCD_BOARD", "COMMUNICATION_BOARD", "FILTER_BOARD", "RELAY_BOARD", 
  "CAPACITOR_BOARD", "WIFI_BOARD", "INV_BOARD", "IND_BOARD", "GEN_BOARD", 
  "PID_BOARD", "PV_BOARD", "ARC_BOARD", "BMS"
];

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; category?: string; boardType?: string; filter?: string; page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams?.query || '';
  const category = resolvedSearchParams?.category || '';
  const boardType = resolvedSearchParams?.boardType || '';
  const filter = resolvedSearchParams?.filter || '';
  const page = Number(resolvedSearchParams?.page) || 1;
  const limit = 10;
  const skip = (page - 1) * limit;

  const session = await getServerSession(authOptions);
  const currentUserEmail = session?.user?.email;
  const currentUser = currentUserEmail 
    ? await prisma.user.findUnique({ where: { email: currentUserEmail } }) 
    : null;

  const isAdmin = currentUser?.role === 'ADMIN';

  const allPartsForCount = await prisma.sparePart.findMany({
    select: { stock: true, minQuantity: true },
  });
  const lowStockTotal = allPartsForCount.filter((part) => part.stock <= part.minQuantity).length;

  let boardTypeCondition = {};
  if (boardType === 'OTHER') {
    boardTypeCondition = {
      boardType: {
        notIn: STANDARD_BOARD_TYPES,
      },
    };
  } else if (boardType) {
    boardTypeCondition = { boardType: boardType };
  }

  const whereCondition: any = {
    AND: [
      query ? {
        OR: [
          { name: { contains: query } },
          { boardModelCode: { contains: query } },
          { model: { contains: query } },
          { qrModelCode: { contains: query } },
        ],
      } : {},
      category ? { category: category } : {},
      boardTypeCondition,
    ],
  };

  let spareParts: any[] = [];
  let totalItems = 0;

  if (filter === 'low' && isAdmin) {
    const allFiltered = await prisma.sparePart.findMany({
      where: whereCondition,
      orderBy: { createdAt: 'desc' },
    });
    const lowStockParts = allFiltered.filter((part) => part.stock <= part.minQuantity);
    totalItems = lowStockParts.length;
    spareParts = lowStockParts.slice(skip, skip + limit);
  } else {
    const [fetchedParts, countResult] = await Promise.all([
      prisma.sparePart.findMany({
        where: whereCondition,
        orderBy: { createdAt: 'desc' },
        skip: skip,
        take: limit,
      }),
      prisma.sparePart.count({ where: whereCondition }),
    ]);
    spareParts = fetchedParts;
    totalItems = countResult;
  }

  const totalPages = Math.ceil(totalItems / limit) || 1;

  async function deleteSparePart(formData: FormData) {
    'use server';
    const sessionCheck = await getServerSession(authOptions);
    const userCheck = sessionCheck?.user?.email 
      ? await prisma.user.findUnique({ where: { email: sessionCheck.user.email } }) 
      : null;

    if (userCheck?.role !== 'ADMIN') return;

    const id = formData.get('id') as string;
    if (!id) return;

    try {
      await prisma.stockLog.deleteMany({
        where: { sparePartId: id },
      });

      await prisma.sparePart.delete({
        where: { id },
      });

      revalidatePath('/dashboard/inventory/boards');
    } catch (error) {
      console.error('Failed to delete spare part:', error);
    }
  }

  return (
    <div className="p-3 sm:p-6 max-w-[96rem] mx-auto space-y-5 pb-24">
      
      {/* ส่วนหัวหน้าเว็บ ขยายความกว้างและจัดระเบียบปุ่มให้อยู่ในแถวเดียวกัน */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col 2xl:flex-row 2xl:items-center 2xl:justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 flex-shrink-0" /> ระบบจัดการคลังอะไหล่ (Inventory)
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1 font-medium">จัดการสต็อก ตรวจสอบบอร์ด และบันทึกความเคลื่อนไหว</p>
        </div>
        
        {/* ส่วนปุ่มควบคุมด้านขวา */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {isAdmin && (
            <FilterLinkButton
              href={`/dashboard/inventory/boards?query=${query}&category=${category}&boardType=${boardType}&filter=low`}
              label={`อะไหล่เหลือน้อย (${lowStockTotal})`}
              icon={<AlertTriangle className="w-4 h-4 flex-shrink-0" />}
              loadingText="กำลังโหลด..."
              className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl shadow-sm transition whitespace-nowrap ${
                filter === 'low' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
              }`}
            />
          )}

          {/* ปุ่มควบคุมการทำงาน */}
          <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:flex-row sm:w-auto items-center">
            
            {/* ปุ่มเติมสต็อก/ลงทะเบียนบอร์ดใหม่ */}
            <Link
              href="/dashboard/inventory/boards/restock"
              className="col-span-2 sm:col-span-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition text-center whitespace-nowrap"
            >
              <PlusCircle className="w-4 h-4 flex-shrink-0" /> 
              <span>เติมสต็อก/ลงทะเบียนบอร์ดใหม่</span>
            </Link>

            {/* ปุ่มเบิกอะไหล่ */}
            <Link
              href="/dashboard/inventory/boards/withdraw"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition text-center whitespace-nowrap"
            >
              <MinusCircle className="w-4 h-4 flex-shrink-0" /> 
              <span>เบิกอะไหล่</span>
            </Link>

            {/* ปุ่มคืนอะไหล่ */}
            <Link
              href="/dashboard/inventory/boards/job-restock"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition text-center whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4 flex-shrink-0" /> 
              <span>คืนอะไหล่</span>
            </Link>

            {/* 🌟 ปุ่ม Export Excel (แสดงเฉพาะ Admin) */}
            {isAdmin && (
              <a
                href="/api/inventory/boards/export"
                download
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition text-center whitespace-nowrap"
              >
                <Download className="w-4 h-4 flex-shrink-0" /> 
                <span>ส่งออก Excel</span>
              </a>
            )}

            {/* ปุ่มประวัติ (เฉพาะ Admin) */}
            {isAdmin && (
              <Link
                href="/dashboard/inventory/logs"
                className="col-span-2 sm:col-span-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs sm:text-sm font-bold rounded-xl transition text-center whitespace-nowrap shadow-xs"
              >
                <History className="w-4 h-4 flex-shrink-0" /> 
                <span>ประวัติ</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {isAdmin && filter === 'low' && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm shadow-sm font-semibold">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            กำลังแสดงเฉพาะรายการอะไหล่ที่เหลือน้อย (Stock ≤ Min Quantity)
          </div>
          <FilterLinkButton
            href={`/dashboard/inventory/boards?query=${query}&category=${category}&boardType=${boardType}`}
            label="ล้างตัวกรอง (แสดงทั้งหมด)"
            icon={<X className="w-3.5 h-3.5" />}
            loadingText="กำลังล้าง..."
            className="text-xs bg-white border border-red-300 hover:bg-red-100 px-3 py-1.5 rounded-lg font-bold transition text-red-700 text-center inline-flex items-center justify-center gap-1"
          />
        </div>
      )}

      <InventoryFilterForm
        initialQuery={query}
        initialCategory={category}
        initialBoardType={boardType}
        initialFilter={filter}
      />

      <div className="space-y-3.5">
        {spareParts.length > 0 ? (
          <>
            {/* มุมมองมือถือ */}
            <div className="grid grid-cols-1 gap-3.5 sm:hidden">
              {spareParts.map((part) => (
                <div key={part.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100">
                        {part.boardModelCode || 'ไม่มีรหัสรุ่น'}
                      </span>
                      <h2 className="text-base font-bold text-gray-900 mt-1.5">{part.name}</h2>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold shadow-xs flex-shrink-0 ${
                      part.stock > part.minQuantity 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-rose-600 text-white animate-pulse'
                    }`}>
                      {part.stock} ชิ้น
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 border-t border-gray-100 pt-2 font-medium">
                    <div>
                      <span className="text-gray-400 block">หมวดหมู่หลัก:</span>
                      <span className="text-gray-800 font-semibold">{part.category || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">ประเภทบอร์ด:</span>
                      <span className="text-gray-800 font-semibold">{part.boardType || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">เวอร์ชัน (Version):</span>
                      <span className="text-blue-600 font-bold">{part.version || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">รุ่นที่รองรับ:</span>
                      <span className="text-gray-800 font-semibold">{part.model || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">ตำแหน่งเก็บ:</span>
                      <span className="text-gray-800 font-semibold flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" /> {part.location || '-'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-gray-100">
                    <span className="text-[11px] text-gray-400 font-medium">ขั้นต่ำกำหนด: {part.minQuantity} ชิ้น</span>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/inventory/boards/${part.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-blue-600 border border-blue-200 rounded-xl text-xs font-bold transition shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" /> ดูรายละเอียด
                      </Link>
                      {isAdmin && (
                        <DeleteButton 
                          id={part.id} 
                          name={part.name} 
                          deleteAction={deleteSparePart} 
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* มุมมอง Desktop ตารางขยายกว้างเต็มพื้นที่ */}
            <div className="hidden sm:block bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1100px]">
                  <thead>
                    <tr className="bg-gray-50/75 border-b border-gray-200 text-xs uppercase text-gray-600 font-bold tracking-wider">
                      <th className="p-4">รหัสรุ่นบอร์ด</th>
                      <th className="p-4">ชื่อบอร์ดอะไหล่</th>
                      <th className="p-4">หมวดหมู่หลัก</th>
                      <th className="p-4">ประเภทบอร์ด</th>
                      <th className="p-4">เวอร์ชัน</th>
                      <th className="p-4">รุ่นเครื่องที่รองรับ</th>
                      <th className="p-4">ตำแหน่ง (Location)</th>
                      <th className="p-4">คงเหลือ</th>
                      <th className="p-4 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm text-gray-900 font-medium">
                    {spareParts.map((part) => (
                      <tr key={part.id} className="hover:bg-gray-50/50 transition">
                        <td className="p-4 font-mono font-bold text-gray-900">
                          {part.boardModelCode || '-'}
                        </td>
                        <td className="p-4 font-bold text-gray-900">
                          {part.name}
                        </td>
                        <td className="p-4 text-gray-700 font-semibold">
                          {part.category || '-'}
                        </td>
                        <td className="p-4">
                          {part.boardType && part.boardType !== 'GENERAL' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 text-white rounded-full text-xs font-bold shadow-sm">
                              <Layers className="w-3.5 h-3.5" />
                              {part.boardType}
                            </span>
                          ) : (
                            <span className="text-gray-400 font-normal">-</span>
                          )}
                        </td>
                        <td className="p-4 text-blue-600 font-bold">
                          {part.version || '-'}
                        </td>
                        <td className="p-4 text-gray-800 font-semibold">
                          {part.model || '-'}
                        </td>
                        <td className="p-4">
                          {part.location ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-bold border border-slate-200">
                              <MapPin className="w-3.5 h-3.5 text-slate-600" />
                              {part.location}
                            </span>
                          ) : (
                            <span className="text-gray-400 font-normal">-</span>
                          )}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
                            part.stock > part.minQuantity 
                              ? 'bg-emerald-600 text-white' 
                              : 'bg-rose-600 text-white animate-pulse'
                          }`}>
                            {part.stock} ชิ้น (ขั้นต่ำ: {part.minQuantity})
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2.5">
                            <Link
                              href={`/dashboard/inventory/boards/${part.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-blue-600 border border-blue-200 rounded-xl text-xs font-bold transition shadow-sm no-underline"
                              title="ดูรายละเอียด"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-600" /> ดูรายละเอียด
                            </Link>

                            {isAdmin && (
                              <DeleteButton 
                                id={part.id} 
                                name={part.name} 
                                deleteAction={deleteSparePart} 
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Footer - ปรับเปลี่ยนมาใช้ FilterLinkButton เพื่อรองรับ Loading State ทันทีที่กด */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs font-extrabold text-gray-700">
                แสดงหน้า <strong className="text-gray-900 font-black">{page}</strong> จากทั้งหมด <strong className="text-gray-900 font-black">{totalPages}</strong> หน้า (พบรายการทั้งหมด {totalItems} รายการ)
              </div>
              
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
                <FilterLinkButton
                  href={`/dashboard/inventory/boards?query=${query}&category=${category}&boardType=${boardType}&filter=${filter}&page=${Math.max(page - 1, 1)}`}
                  label="ก่อนหน้า"
                  icon={<ChevronLeft className="w-4 h-4 font-bold" />}
                  loadingText="..."
                  className={`px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-extrabold text-gray-800 hover:bg-gray-100 transition flex items-center gap-1 shadow-xs no-underline whitespace-nowrap ${page <= 1 ? 'pointer-events-none opacity-40' : ''}`}
                />

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <FilterLinkButton
                    key={pageNum}
                    href={`/dashboard/inventory/boards?query=${query}&category=${category}&boardType=${boardType}&filter=${filter}&page=${pageNum}`}
                    label={`${pageNum}`}
                    loadingText="..."
                    className={`w-9 h-9 flex items-center justify-center rounded-xl text-xs font-black transition no-underline flex-shrink-0 ${
                      page === pageNum
                        ? 'bg-blue-600 text-white shadow-sm pointer-events-none'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  />
                ))}
                
                <FilterLinkButton
                  href={`/dashboard/inventory/boards?query=${query}&category=${category}&boardType=${boardType}&filter=${filter}&page=${Math.min(page + 1, totalPages)}`}
                  label="ถัดไป"
                  icon={<ChevronRight className="w-4 h-4 font-bold text-right" />}
                  loadingText="..."
                  className={`px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-extrabold text-gray-800 hover:bg-gray-100 transition flex items-center gap-1 shadow-xs no-underline whitespace-nowrap ${page >= totalPages ? 'pointer-events-none opacity-40' : ''}`}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl p-12 text-center text-gray-500 font-medium italic border border-gray-200 shadow-sm space-y-3">
            <Package className="w-12 h-12 text-gray-300 mx-auto" />
            <p>ไม่พบรายการอะไหล่ในระบบ</p>
          </div>
        )}
      </div>

    </div>
  );
}