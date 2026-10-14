import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { ArrowLeft, History, Package, Image as ImageIcon, Search, X, ChevronLeft, ChevronRight, User } from 'lucide-react';

interface SearchParams {
  search?: string;
  type?: string;
  page?: string;
}

export default async function InventoryLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const searchQuery = (params.search || '').trim();
  const selectedType = params.type || 'ALL';
  const page = Number(params.page) || 1;
  const limit = 10;

  const allLogs = await prisma.stockLog.findMany({
    include: {
      sparePart: true,
      user: true,
      job: {
        include: {
          backupDevice: true,
        },
      },
      images: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const filteredLogs = allLogs.filter((log) => {
    const jobNoStr = (log.job?.jobNo || '').toUpperCase();
    const isBackup = jobNoStr.startsWith('BK-') || jobNoStr.includes('BACKUP') || (log.job?.customerName || '').includes('ซ่อมบำรุงในคลัง');
    
    const customerName = isBackup ? 'เครื่องสำรองในคลัง' : (log.job?.customerName || '');
    const model = log.job?.model || log.job?.backupDevice?.model || '';
    const serialNumber = log.job?.serialNumber || log.job?.backupDevice?.serialNumber || '';
    const snLast4 = serialNumber.slice(-4);
    const sparePartName = (log.sparePart?.name || '').toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchesSearch =
      !query ||
      customerName.toLowerCase().includes(query) ||
      model.toLowerCase().includes(query) ||
      serialNumber.toLowerCase().includes(query) ||
      snLast4.includes(query) ||
      sparePartName.includes(query);

    let matchesType = true;
    if (selectedType !== 'ALL') {
      const t = (log.type || '').toUpperCase();
      const note = (log.note || '').toLowerCase();

      if (selectedType === 'RESTOCK') {
        matchesType = t === 'RESTOCK' || t === 'IMPORT' || t === 'ADD' || t === 'STOCK_IN' || note.includes('คืนอะไหล่') || note.includes('คืนเข้าคลัง');
      } else if (selectedType === 'ADJUST_IN') {
        matchesType = (t.includes('ADJUST') || note.includes('admin ปรับสต็อก') || note.includes('[admin')) && log.quantity > 0;
      } else if (selectedType === 'ADJUST_OUT') {
        matchesType = (t.includes('ADJUST') || note.includes('admin ปรับสต็อก') || note.includes('[admin')) && log.quantity < 0;
      } else {
        matchesType = t === selectedType;
      }
    }

    return matchesSearch && matchesType;
  });

  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const paginatedLogs = filteredLogs.slice((page - 1) * limit, page * limit);

  const getTypeText = (log: any) => {
    const t = (log.type || '').toUpperCase();
    const note = (log.note || '').toLowerCase();
    
    if (note.includes('admin ปรับสต็อก') || note.includes('[admin')) {
      return { 
        text: log.quantity < 0 ? 'แอดมินลดสต็อก' : 'แอดมินเพิ่มสต็อก', 
        class: 'bg-purple-600 text-white font-bold shadow-xs' 
      };
    }
    if (note.includes('คืนอะไหล่') || note.includes('คืนเข้าคลัง')) {
      return { text: 'คืนบอร์ด', class: 'bg-emerald-600 text-white font-bold shadow-xs' };
    }
    if (note.includes('หน้างานวันเสาร์')) {
      return { text: 'เบิกส่งสาขา / หน้างานทั่วไป', class: 'bg-indigo-600 text-white font-bold shadow-xs' };
    }

    if (t === 'USE_FOR_REPAIR' || t === 'REPAIR_DEDUCT') return { text: 'เบิกซ่อม', class: 'bg-blue-600 text-white font-bold shadow-xs' };
    if (t === 'GENERAL_WITHDRAW') return { text: 'เบิกส่งสาขา / หน้างานทั่วไป', class: 'bg-indigo-600 text-white font-bold shadow-xs' };
    if (t === 'RETURN') return { text: 'คืนบอร์ด', class: 'bg-emerald-600 text-white font-bold shadow-xs' };
    if (t === 'IMPORT' || t === 'ADD' || t === 'STOCK_IN' || t === 'RESTOCK') {
      return { text: 'เติมบอร์ด', class: 'bg-teal-600 text-white font-bold shadow-xs' };
    }
    if (t === 'REGISTER' || t === 'BOARD_REGISTER') {
      return { text: 'ลงทะเบียนบอร์ด', class: 'bg-amber-600 text-white font-bold shadow-xs' };
    }
    
    if (t === 'ADJUST_IN' || t === 'ADJUST_OUT' || t === 'ADJUST' || t === 'ADMIN_ADJUST') {
      return { 
        text: log.quantity < 0 ? 'แอดมินลดสต็อก' : 'แอดมินเพิ่มสต็อก', 
        class: 'bg-purple-600 text-white font-bold shadow-xs' 
      };
    }

    return { text: t || 'อื่นๆ', class: 'bg-gray-600 text-white font-bold shadow-xs' };
  };

  const getUserName = (log: any) => {
    if (log.user?.name) return log.user.name;
    if (log.user?.username) return log.user.username;
    return 'adminTMDA';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-3 sm:p-6 pb-24">
      <div className="max-w-7xl mx-auto space-y-5">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <Link 
              href="/dashboard/inventory" 
              className="p-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-700 transition shadow-xs"
              title="กลับไปหน้าคลังอะไหล่"
            >
              <ArrowLeft className="w-5 h-5 font-bold" />
            </Link>
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl text-blue-600 mt-0.5">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900">ประวัติการเคลื่อนไหวและหลักฐาน (Audit Logs)</h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">ตรวจสอบประวัติการเบิกอะไหล่และรูปหลักฐานคู่บอร์ด (Dual-Image) ทั้งหมดในระบบ</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
          <form method="GET" className="flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-gray-400 absolute left-4 top-3.5" />
              <input
                type="text"
                name="search"
                defaultValue={searchQuery}
                placeholder="ค้นหาชื่อลูกค้า, Model, S/N, หรือ S/N 4 ตัวท้าย..."
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-blue-500 shadow-inner"
              />
            </div>

            <div className="w-full md:w-64">
              <select
                name="type"
                defaultValue={selectedType}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-blue-500 shadow-inner cursor-pointer"
              >
                <option value="ALL">สถานะทั้งหมด / ทุกประเภท</option>
                <option value="USE_FOR_REPAIR">เบิกซ่อม</option>
                <option value="GENERAL_WITHDRAW">เบิกส่งสาขา / หน้างานทั่วไป</option>
                <option value="RETURN">คืนบอร์ด (จากงานซ่อม)</option>
                <option value="RESTOCK">เติมบอร์ด / คืนเข้าคลัง</option>
                <option value="REGISTER">ลงทะเบียนบอร์ด</option>
                <option value="ADJUST_IN">แอดมินเพิ่มสต็อก</option>
                <option value="ADJUST_OUT">แอดมินลดสต็อก</option>
              </select>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                type="submit"
                className="flex-1 md:flex-none px-5 py-2.5 bg-gray-900 hover:bg-black text-white font-black text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-xs"
              >
                <Search className="w-4 h-4 font-bold" /> ค้นหา
              </button>
              <Link
                href="/dashboard/inventory/logs"
                className="flex-1 md:flex-none px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-sm rounded-xl transition flex items-center justify-center gap-1 shadow-xs no-underline"
              >
                <X className="w-4 h-4 font-bold" /> ล้าง
              </Link>
            </div>
          </form>
        </div>

        {paginatedLogs.length > 0 ? (
          <>
            <div className="block lg:hidden space-y-3.5">
              {paginatedLogs.map((log) => {
                const typeInfo = getTypeText(log);
                const jobNoStr = (log.job?.jobNo || '').toUpperCase();
                const isBackup = jobNoStr.startsWith('BK-') || jobNoStr.includes('BACKUP') || (log.job?.customerName || '').includes('ซ่อมบำรุงในคลัง');

                const customerName = isBackup ? 'เครื่องสำรองในคลัง' : (log.job?.customerName || '-');
                const model = log.job?.model || log.job?.backupDevice?.model || '-';
                const serialNumber = log.job?.serialNumber || log.job?.backupDevice?.serialNumber || '-';
                const userName = getUserName(log);

                return (
                  <div key={log.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <span className={`inline-block px-3 py-1 text-xs rounded-xl ${typeInfo.class}`}>
                        {typeInfo.text}
                      </span>
                      <span className="text-xs font-semibold text-gray-500">
                        {new Date(log.createdAt).toLocaleString('th-TH')}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center text-xs text-gray-600 pb-1 border-b border-gray-50">
                        <span className="flex items-center gap-1 font-bold"><User className="w-3.5 h-3.5 text-blue-600" /> ผู้ทำรายการ:</span>
                        <span className="font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">{userName}</span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-gray-500 font-medium">ชื่อลูกค้า:</span>
                        <span className="font-black text-gray-900 text-right">{customerName}</span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-gray-500 font-medium">Model:</span>
                        <span className="font-semibold text-gray-800 text-right">{model}</span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-gray-500 font-medium">S/N:</span>
                        <span className="font-mono text-xs text-gray-600 text-right">{serialNumber}</span>
                      </div>

                      <div className="flex justify-between items-start gap-2 pt-2 border-t border-gray-100">
                        <span className="text-gray-500 font-medium">รายการอะไหล่:</span>
                        <span className="font-black text-gray-900 text-right">{log.sparePart?.name || 'อะไหล่ถูกลบ'}</span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-gray-500 font-medium">รุ่นบอร์ด:</span>
                        <span className="text-xs font-mono text-gray-600 text-right">{log.sparePart?.boardModelCode || '-'}</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 font-medium">จำนวน:</span>
                        <span className={`font-black text-lg ${log.quantity < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {log.quantity > 0 ? `+${log.quantity}` : log.quantity}
                        </span>
                      </div>

                      <div className="flex justify-between items-start gap-2 pt-2 border-t border-gray-100">
                        <span className="text-gray-500 font-medium">หมายเหตุ:</span>
                        <span className="text-xs font-semibold text-gray-800 text-right">{log.note || '-'}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-blue-500" /> หลักฐาน Dual-Image:
                        </span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {log.images && log.images.length > 0 ? (
                          log.images.map((img: any, idx: number) => {
                            const imgUrl = img.imageUrl || img.url || '';
                            return (
                              <a key={img.id} href={imgUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                                <img 
                                  src={imgUrl} 
                                  alt={`หลักฐาน ${idx + 1}`} 
                                  className="w-16 h-16 object-cover rounded-xl border border-gray-200 hover:opacity-80 transition bg-white shadow-sm"
                                  title="คลิกเพื่อดูรูปใหญ่"
                                />
                              </a>
                            );
                          })
                        ) : (
                          <span className="text-xs text-gray-400 italic py-1">ไม่มีรูปหลักฐาน</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200 text-xs uppercase text-gray-600 font-extrabold tracking-wider">
                      <th className="p-4">เวลา / ประเภท</th>
                      <th className="p-4">ผู้ทำรายการ</th>
                      <th className="p-4">ชื่อลูกค้า</th>
                      <th className="p-4">MODEL</th>
                      <th className="p-4">S/N</th>
                      <th className="p-4">รายการอะไหล่</th>
                      <th className="p-4">จำนวน</th>
                      <th className="p-4">หลักฐาน DUAL-IMAGE</th>
                      <th className="p-4">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm text-gray-800">
                    {paginatedLogs.map((log) => {
                      const typeInfo = getTypeText(log);
                      const jobNoStr = (log.job?.jobNo || '').toUpperCase();
                      const isBackup = jobNoStr.startsWith('BK-') || jobNoStr.includes('BACKUP') || (log.job?.customerName || '').includes('ซ่อมบำรุงในคลัง');

                      const customerName = isBackup ? 'เครื่องสำรองในคลัง' : (log.job?.customerName || '-');
                      const model = log.job?.model || log.job?.backupDevice?.model || '-';
                      const serialNumber = log.job?.serialNumber || log.job?.backupDevice?.serialNumber || '-';
                      const userName = getUserName(log);

                      return (
                        <tr key={log.id} className="hover:bg-gray-50/60 transition align-middle">
                          <td className="p-4 whitespace-nowrap">
                            <span className={`inline-block px-3 py-1 text-xs rounded-xl mb-1.5 ${typeInfo.class}`}>
                              {typeInfo.text}
                            </span>
                            <p className="text-xs font-semibold text-gray-500">{new Date(log.createdAt).toLocaleString('th-TH')}</p>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className="inline-block px-2.5 py-1 bg-blue-50 border border-blue-100 text-xs font-black text-blue-700 rounded-lg shadow-2xs">
                              {userName}
                            </span>
                          </td>
                          <td className="p-4 font-black text-gray-900 whitespace-nowrap">
                            {customerName}
                          </td>
                          <td className="p-4 font-bold text-gray-800 whitespace-nowrap">
                            {model}
                          </td>
                          <td className="p-4 font-mono text-xs font-bold text-gray-700 whitespace-nowrap">
                            {serialNumber}
                          </td>
                          <td className="p-4 font-black text-gray-900">
                            {log.sparePart?.name || 'อะไหล่ถูกลบ'}
                            <p className="text-xs font-mono font-bold text-gray-500 mt-0.5">รุ่น: {log.sparePart?.boardModelCode || '-'}</p>
                          </td>
                          <td className="p-4 whitespace-nowrap font-black text-base">
                            <span className={log.quantity < 0 ? 'text-red-600' : 'text-emerald-600'}>
                              {log.quantity > 0 ? `+${log.quantity}` : log.quantity}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              {log.images && log.images.length > 0 ? (
                                log.images.map((img: any, idx: number) => {
                                  const imgUrl = img.imageUrl || img.url || '';
                                  return (
                                    <a key={img.id} href={imgUrl} target="_blank" rel="noopener noreferrer">
                                      <img 
                                        src={imgUrl} 
                                        alt={`หลักฐาน ${idx + 1}`} 
                                        className="w-12 h-12 object-cover rounded-xl border border-gray-200 hover:opacity-80 transition bg-white shadow-sm"
                                        title="คลิกเพื่อดูรูปใหญ่"
                                      />
                                    </a>
                                  );
                                })
                              ) : (
                                <span className="text-xs text-gray-400 italic">ไม่มีรูปหลักฐาน</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-xs font-bold text-gray-700">
                            {log.note || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs font-extrabold text-gray-700">
                แสดงหน้า <strong className="text-gray-900 font-black">{page}</strong> จากทั้งหมด <strong className="text-gray-900 font-black">{totalPages}</strong> หน้า (พบรายการทั้งหมด {totalItems} รายการ)
              </div>
              
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/dashboard/inventory/logs?search=${searchQuery}&type=${selectedType}&page=${Math.max(page - 1, 1)}`}
                  className={`px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-extrabold text-gray-800 hover:bg-gray-100 transition flex items-center gap-1 shadow-xs no-underline ${page <= 1 ? 'pointer-events-none opacity-40' : ''}`}
                >
                  <ChevronLeft className="w-4 h-4 font-bold" /> ก่อนหน้า
                </Link>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <Link
                    key={pageNum}
                    href={`/dashboard/inventory/logs?search=${searchQuery}&type=${selectedType}&page=${pageNum}`}
                    className={`w-9 h-9 flex items-center justify-center rounded-xl text-xs font-black transition no-underline ${
                      page === pageNum
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </Link>
                ))}
                
                <Link
                  href={`/dashboard/inventory/logs?search=${searchQuery}&type=${selectedType}&page=${Math.min(page + 1, totalPages)}`}
                  className={`px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-extrabold text-gray-800 hover:bg-gray-100 transition flex items-center gap-1 shadow-xs no-underline ${page >= totalPages ? 'pointer-events-none opacity-40' : ''}`}
                >
                  ถัดไป <ChevronRight className="w-4 h-4 font-bold" />
                </Link>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center space-y-3">
            <Package className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="text-gray-500 font-medium italic">ไม่พบประวัติการเคลื่อนไหวที่ตรงกับเงื่อนไข</p>
          </div>
        )}
      </div>
    </div>
  );
}