'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

interface InventoryFilterProps {
  categories?: string[];
}

export default function InventoryFilter({ categories = [] }: InventoryFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSearch = searchParams.get('q') || '';
  const currentStatus = searchParams.get('status') || 'ALL';

  const handleSearchChange = (term: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (term) {
      params.set('q', term);
    } else {
      params.delete('q');
    }
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const handleStatusChange = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (status && status !== 'ALL') {
      params.set('status', status);
    } else {
      params.delete('status');
    }
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
      {/* ช่องค้นหาขยายเต็มพื้นที่ */}
      <div className="relative w-full flex-1">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
          🔍
        </span>
        <input
          type="text"
          defaultValue={currentSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="ค้นหารหัสเครื่อง, ชื่อรุ่น, หรือ Serial Number..."
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* ดรอปดาวน์เลือกสถานะทางขวา */}
      <div className="flex items-center gap-3 w-full md:w-auto">
        <select
          value={currentStatus}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 w-full md:w-auto"
        >
          <option value="ALL">สถานะทั้งหมด</option>
          <option value="AVAILABLE">พร้อมใช้งาน</option>
          <option value="IN_USE">ถูกใช้งานอยู่</option>
          <option value="SWAPPED">สลับถาวร</option>
          <option value="COMPLETED_BY_DEYE">รับคืนจาก Deye</option>
          <option value="MAINTENANCE">ส่งซ่อมบำรุง</option>
        </select>
      </div>
    </div>
  );
}