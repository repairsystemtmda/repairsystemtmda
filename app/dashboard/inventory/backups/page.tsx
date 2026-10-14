import prisma from '@/lib/prisma';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { 
  Plus, 
  Laptop, 
  CheckCircle2, 
  ArrowRightLeft, 
  Wrench, 
  Send, 
  RotateCcw, 
  Clock, 
  Truck,
  Box,
  Wifi,
  Edit3,
  User
} from 'lucide-react';
import DeleteButton from './../boards/_components/DeleteButton';
import BackupFilterForm from './BackupFilterForm';
import { 
  isBackupAvailable, 
  isBackupBorrowed, 
  isBackupInRepair, 
  isBackupSwappedPermanent 
} from '@/lib/backupUtils';

export const dynamic = 'force-dynamic';

export default async function BackupInvertersPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; status?: string; category?: string; brand?: string; page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams?.query || '';
  const status = resolvedSearchParams?.status || '';
  const category = resolvedSearchParams?.category || '';
  const brand = resolvedSearchParams?.brand || '';
  
  const page = parseInt(resolvedSearchParams?.page || '1', 10);
  const pageSize = 10;
  const skip = (page - 1) * pageSize;

  const getCategoryCondition = (cat: string) => {
    if (!cat) return {};
    const c = cat.toLowerCase();
    
    if (c.includes('ปั๊มน้ำ') || c.includes('pump')) {
      return { in: ['อินเวอร์เตอร์ปั๊มน้ำ', 'INVERTER_SOLAR_PUMP', 'SOLAR PUMP'] };
    }
    if (c.includes('ไมโคร') || c.includes('micro')) {
      return { in: ['ไมโครอินเวอร์เตอร์', 'MICRO_INVERTER'] };
    }
    if (c.includes('ออปติไมเซอร์') || c.includes('optimizer')) {
      return { in: ['ออปติไมเซอร์', 'OPTIMIZER'] };
    }
    if (c.includes('แบตเตอรี่') || c.includes('battery')) {
      return { in: ['แบตเตอรี่', 'BATTERY'] };
    }
    if (c.includes('อินเวอร์เตอร์') || c.includes('inverter') || c === 'inv') {
      return { in: ['อินเวอร์เตอร์', 'INVERTER', 'Inv', 'Inverter', 'อินเวอร์เตอร์ (Inverter)'] };
    }
    
    return { equals: cat };
  };

  const categoryCondition = category ? getCategoryCondition(category) : undefined;

  let brandWhere: any = {};
  if (category) {
    const categoryConditionForBrands = getCategoryCondition(category);
    brandWhere = { category: categoryConditionForBrands };
  }

  const rawBrands = await prisma.brand.findMany({
    where: brandWhere,
    orderBy: { name: 'asc' },
  });

  const allBrands = Array.from(
    new Map(rawBrands.map(item => [item.name, item])).values()
  );

  let brandCondition = {};
  if (brand) {
    const matchingBrands = await prisma.brand.findMany({
      where: {
        OR: [
          { id: brand },
          { name: brand },
        ],
      },
      select: { id: true, name: true },
    });

    const brandIds = matchingBrands.map((b) => b.id);
    const brandNames = matchingBrands.map((b) => b.name);

    brandCondition = {
      OR: [
        { brandId: { in: brandIds } },
        { brandId: { in: brandNames } },
        { brand: { name: { in: brandNames } } },
      ],
    };
  }

  // 🌟 ปรับปรุงเงื่อนไข Status ให้รองรับการค้นหาตามกลุ่มจาก backupUtils อย่างครอบคลุม
  let statusCondition = {};
  if (status) {
    const upperStatus = status.toUpperCase();
    if (upperStatus === 'SWAPPED_PERMANENT' || upperStatus === 'SWAPPED') {
      statusCondition = {
        OR: [
          { status: 'SWAPPED_PERMANENT' },
          { status: 'FINAL_SWAPPED_PERMANENT' },
          { status: 'SWAPPED' },
          { status: { contains: 'สลับเปลี่ยน' } },
          { status: { contains: 'ถาวร' } },
        ],
      };
    } else if (upperStatus === 'IN_USE' || upperStatus === 'BORROWED') {
      statusCondition = {
        OR: [
          { status: 'IN_USE' },
          { status: 'BORROWED' },
          { status: { contains: 'ยืม' } },
          { status: { contains: 'ใช้งานอยู่' } },
        ],
      };
    } else if (upperStatus === 'AVAILABLE' || upperStatus === 'READY') {
      statusCondition = {
        OR: [
          { status: 'AVAILABLE' },
          { status: 'READY' },
          { status: { contains: 'พร้อมใช้งาน' } },
        ],
      };
    } else if (upperStatus === 'MAINTENANCE' || upperStatus === 'IN_REPAIR') {
      statusCondition = {
        OR: [
          { status: 'MAINTENANCE' },
          { status: 'IN_REPAIR' },
          { status: { contains: 'ซ่อมบำรุง' } },
          { status: { contains: 'กำลังซ่อม' } },
        ],
      };
    } else {
      statusCondition = { status: status };
    }
  }

  const whereCondition = {
    AND: [
      query
        ? {
            OR: [
              { serialNumber: { contains: query } },
              { model: { contains: query } },
              { customerName: { contains: query } },
              { phone: { contains: query } },
            ],
          }
        : {},
      statusCondition,
      categoryCondition ? { category: categoryCondition } : {},
      brandCondition,
    ],
  };

  const [backups, totalCount] = await Promise.all([
    prisma.backupDevice.findMany({
      where: whereCondition,
      include: {
        brand: true,
        user: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: skip,
      take: pageSize,
    }),
    prisma.backupDevice.count({ where: whereCondition }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  async function deleteBackup(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    if (!id) return;

    try {
      await prisma.job.updateMany({
        where: { backupDeviceId: id },
        data: { backupDeviceId: null },
      });

      await prisma.backupDevice.delete({
        where: { id },
      });

      revalidatePath('/dashboard/inventory/backups');
      revalidatePath('/dashboard/inventory/withdraws');
    } catch (error) {
      console.error('Failed to delete backup device:', error);
    }
  }

  const getStatusBadge = (st: string) => {
    switch (st?.toUpperCase()) {
      case 'AVAILABLE':
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600 text-white shadow-xs whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            พร้อมใช้งาน
          </span>
        );
      case 'IN_USE':
      case 'BORROWED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-600 text-white shadow-xs whitespace-nowrap">
            <ArrowRightLeft className="w-3 h-3 shrink-0" />
            กำลังยืมใช้งาน
          </span>
        );
      case 'MAINTENANCE':
      case 'IN_REPAIR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-600 text-white shadow-xs whitespace-nowrap">
            <Wrench className="w-3 h-3 shrink-0" />
            ซ่อมบำรุง
          </span>
        );
      case 'WAITING_DEYE_SEND':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-500 text-white shadow-xs whitespace-nowrap">
            <Truck className="w-3 h-3 shrink-0" />
            รอส่ง Deye
          </span>
        );
      case 'SENT_TO_DEYE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-600 text-white shadow-xs whitespace-nowrap">
            <Send className="w-3 h-3 shrink-0" />
            ส่ง Deye แล้ว
          </span>
        );
      case 'COMPLETED_BY_DEYE':
      case 'DEYE_REPAIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-600 text-white shadow-xs whitespace-nowrap">
            <RotateCcw className="w-3 h-3 shrink-0" />
            Deye ซ่อมเสร็จ
          </span>
        );
      case 'SWAPPED':
      case 'SWAPPED_PERMANENT':
      case 'FINAL_SWAPPED_PERMANENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-700 text-white shadow-xs whitespace-nowrap">
            <ArrowRightLeft className="w-3 h-3 shrink-0" />
            สลับเปลี่ยนเครื่องสำรองให้ถาวร
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500 text-white shadow-xs whitespace-nowrap">
            <Clock className="w-3 h-3 shrink-0" />
            {st || 'รอดำเนินการ'}
          </span>
        );
    }
  };

  const formatCategoryDisplay = (cat: string) => {
    if (!cat) return 'อินเวอร์เตอร์';
    const lower = cat.toLowerCase();
    if (lower === 'inverter' || lower === 'inv' || lower === 'inverter (inverter)') {
      return 'อินเวอร์เตอร์';
    }
    return cat;
  };

  return (
    <div className="py-2 px-0 sm:px-6 w-full space-y-4 md:space-y-6">
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Laptop className="w-6 h-6 md:w-7 md:h-7 text-blue-600 shrink-0" /> เครื่องสำรอง (Backup Inverters)
          </h1>
          <p className="text-xs md:text-sm font-semibold text-gray-500 mt-1">ติดตามและจัดการสถานะเครื่องสำรองสำหรับการสับเปลี่ยนให้ลูกค้า</p>
        </div>
        
        <div className="w-full sm:w-auto">
          <Link
            href="/dashboard/inventory/backups/add"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition no-underline"
          >
            <Plus className="w-4 h-4" /> เพิ่มเครื่องสำรอง
          </Link>
        </div>
      </div>

      <BackupFilterForm allBrands={allBrands} />

      {backups.length > 0 ? (
        <>
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-200 text-xs uppercase text-gray-900 font-extrabold tracking-wider">
                    <th className="py-4 px-4">ชื่อลูกค้าผู้ยืม</th>
                    <th className="py-4 px-3">เบอร์ติดต่อ</th>
                    <th className="py-4 px-3">ชื่อโมเดล</th>
                    <th className="py-4 px-3">หมายเลข SN</th>
                    <th className="py-4 px-3">หมวด / ยี่ห้อ</th>
                    <th className="py-4 px-3">ผู้บันทึก</th>
                    <th className="py-4 px-2 text-center">อุปกรณ์เสริม</th>
                    <th className="py-4 px-3">สถานะ</th>
                    <th className="py-4 px-3">วันที่แจ้ง</th>
                    <th className="py-4 px-4 text-center whitespace-nowrap">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm text-gray-900">
                  {backups.map((item: any) => {
                    const statusUpper = item.status?.toUpperCase() || '';
                    const isMaintenance = statusUpper === 'MAINTENANCE' || statusUpper === 'IN_REPAIR';

                    const customerDisplay = isMaintenance 
                      ? '-' 
                      : item.customerName
                      ? item.customerName
                      : item.status === 'IN_USE'
                      ? 'กำลังยืมใช้งาน (ไม่ระบุชื่อ)'
                      : '-';

                    const phoneDisplay = isMaintenance ? '-' : (item.phone || '-');

                    const hasBox = item.hasBox ?? item.hasPackage ?? item.hasBoxContainer ?? false;
                    const hasWifi = item.hasWifiDongle ?? item.hasWifi ?? item.hasWifiPlug ?? false;
                    const formattedDate = new Date(item.createdAt).toLocaleDateString('th-TH');
                    
                    const recordedByName = item.user?.name || item.receiverName;
                    const displayCategory = formatCategoryDisplay(item.category);

                    return (
                      <tr key={`backup-desk-${item.id}`} className="hover:bg-gray-50/80 transition">
                        <td className="py-4 px-4 font-bold text-gray-900">
                          {customerDisplay}
                        </td>
                        <td className="py-4 px-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                          {phoneDisplay}
                        </td>
                        <td className="py-4 px-3 font-bold text-gray-900">
                          {item.model}
                        </td>
                        <td className="py-4 px-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                          {item.serialNumber}
                        </td>
                        <td className="py-4 px-3 font-bold text-gray-900 whitespace-nowrap">
                          {displayCategory} {item.brand?.name ? `(${item.brand.name})` : ''}
                        </td>
                        
                        <td className="py-4 px-3 whitespace-nowrap">
                          {recordedByName ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100 shadow-2xs">
                              <User className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                              {recordedByName}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>

                        <td className="py-4 px-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <div 
                              title={hasBox ? "มีกล่องบรรจุภัณฑ์" : "ไม่มีกล่องบรรจุภัณฑ์"}
                              className={`p-1.5 rounded-lg border ${
                                hasBox 
                                  ? 'bg-amber-50 text-amber-600 border-amber-200/80' 
                                  : 'bg-gray-50 text-gray-300 border-gray-100 opacity-40'
                              }`}
                            >
                              <Box className="w-4 h-4" />
                            </div>
                            <div 
                              title={hasWifi ? "มี WiFi Plug" : "ไม่มี WiFi Plug"}
                              className={`p-1.5 rounded-lg border ${
                                hasWifi 
                                  ? 'bg-blue-50 text-blue-600 border-blue-200/80' 
                                  : 'bg-gray-50 text-gray-300 border-gray-100 opacity-40'
                              }`}
                            >
                              <Wifi className="w-4 h-4" />
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-3 whitespace-nowrap">
                          {getStatusBadge(item.status)}
                        </td>

                        <td className="py-4 px-3 whitespace-nowrap">
                          <div className="font-bold text-gray-900 text-xs">{formattedDate}</div>
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center justify-center gap-2">
                            <Link
                              href={`/dashboard/inventory/backups/${item.id}`}
                              className="p-2 bg-sky-50 hover:bg-sky-100 text-blue-600 border border-blue-200 rounded-xl transition shadow-sm no-underline flex items-center justify-center"
                              title="ดูรายละเอียด / แก้ไข"
                            >
                              <Edit3 className="w-4 h-4" />
                            </Link>

                            <DeleteButton 
                              id={item.id} 
                              name={`S/N: ${item.serialNumber}`} 
                              deleteAction={deleteBackup} 
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="block md:hidden space-y-3.5">
            {backups.map((item: any) => {
              const statusUpper = item.status?.toUpperCase() || '';
              const isMaintenance = statusUpper === 'MAINTENANCE' || statusUpper === 'IN_REPAIR';

              const customerDisplay = isMaintenance 
                ? '-' 
                : item.customerName
                ? item.customerName
                : item.status === 'IN_USE'
                ? 'กำลังยืมใช้งาน (ไม่ระบุชื่อ)'
                : '-';

              const phoneDisplay = isMaintenance ? '-' : (item.phone || '-');

              const hasBox = item.hasBox ?? item.hasPackage ?? item.hasBoxContainer ?? false;
              const hasWifi = item.hasWifiDongle ?? item.hasWifi ?? item.hasWifiPlug ?? false;
              const formattedDate = new Date(item.createdAt).toLocaleDateString('th-TH');
              const recordedByName = item.user?.name || item.receiverName;
              const displayCategory = formatCategoryDisplay(item.category);

              return (
                <div key={`backup-mob-${item.id}`} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200/95 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100">
                      {displayCategory} {item.brand?.name ? `(${item.brand.name})` : ''}
                    </span>
                    <div>{getStatusBadge(item.status)}</div>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-gray-400 uppercase">ชื่อลูกค้าผู้ยืม</span>
                    <div className="text-base font-extrabold text-gray-900">{customerDisplay}</div>
                    <div className="text-xs font-bold text-gray-500 mt-0.5">โทร: {phoneDisplay}</div>
                  </div>

                  <div className="bg-gray-50/85 rounded-xl p-3 border border-gray-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 font-bold">รุ่น (Model):</span>
                      <span className="font-bold text-gray-900">{item.model}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 font-bold">Serial Number:</span>
                      <span className="font-mono font-bold text-gray-900">{item.serialNumber}</span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-t border-b border-gray-200">
                      <span className="text-gray-500 font-bold">อุปกรณ์เสริม:</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${hasBox ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-100 text-gray-300 border-gray-200 opacity-50'}`}>
                          <Box className="w-3 h-3" /> กล่อง
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${hasWifi ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-300 border-gray-200 opacity-50'}`}>
                          <Wifi className="w-3 h-3" /> WIFI
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 font-bold">ผู้บันทึก:</span>
                      <span className="font-bold text-blue-600 flex items-center gap-1">
                        <User className="w-3.5 h-3.5" /> {recordedByName || '-'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                    <span className="text-gray-500 font-bold">แจ้งเมื่อ: {formattedDate}</span>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/inventory/backups/${item.id}`}
                        className="p-2 bg-sky-50 hover:bg-sky-100 text-blue-600 border border-blue-200 rounded-xl transition shadow-2xs flex items-center justify-center no-underline"
                        title="แก้ไข"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Link>
                      <DeleteButton 
                        id={item.id} 
                        name={`S/N: ${item.serialNumber}`} 
                        deleteAction={deleteBackup} 
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between bg-white px-4 py-3 rounded-2xl shadow-sm border border-gray-200 gap-3">
              <div className="text-xs font-bold text-gray-500">
                แสดงหน้า <span className="text-gray-900">{page}</span> จาก <span className="text-gray-900">{totalPages}</span> (ทั้งหมด {totalCount} รายการ)
              </div>
              
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <Link
                  scroll={true}
                  href={`/dashboard/inventory/backups?query=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&category=${encodeURIComponent(category)}&brand=${encodeURIComponent(brand)}&page=${page - 1}`}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition no-underline ${
                    page <= 1 
                      ? 'pointer-events-none bg-gray-100 text-gray-300 border-gray-200' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  ก่อนหน้า
                </Link>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                  const isCurrent = p === page;
                  return (
                    <Link
                      key={`page-${p}`}
                      scroll={true}
                      href={`/dashboard/inventory/backups?query=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&category=${encodeURIComponent(category)}&brand=${encodeURIComponent(brand)}&page=${p}`}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition no-underline ${
                        isCurrent 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </Link>
                  );
                })}

                <Link
                  scroll={true}
                  href={`/dashboard/inventory/backups?query=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&category=${encodeURIComponent(category)}&brand=${encodeURIComponent(brand)}&page=${page + 1}`}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition no-underline ${
                    page >= totalPages 
                      ? 'pointer-events-none bg-gray-100 text-gray-300 border-gray-200' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  ถัดไป
                </Link>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-500 font-bold italic border border-gray-200 shadow-sm">
          ไม่พบรายการเครื่องสำรองในระบบ
        </div>
      )}

    </div>
  );
}