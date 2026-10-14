'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import Link from 'next/link';

const STANDARD_CATEGORIES = [
  'อินเวอร์เตอร์',
  'ออปติไมเซอร์',
  'ไมโครอินเวอร์เตอร์',
  'แบตเตอรี่',
  'อินเวอร์เตอร์ปั๊มน้ำ'
];

export default function BackupFilterForm({ allBrands }: { allBrands: any[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const query = searchParams.get('query') || '';
  const status = searchParams.get('status') || '';
  const category = searchParams.get('category') || '';
  const brand = searchParams.get('brand') || '';

  const normalizeCategory = (cat?: string) => {
    if (!cat) return '';
    const c = cat.toLowerCase().trim();
    
    if (c.includes('ปั๊มน้ำ') || c.includes('pump') || c.includes('solar pump')) {
      return 'อินเวอร์เตอร์ปั๊มน้ำ';
    }
    if (c.includes('ไมโคร') || c.includes('micro')) {
      return 'ไมโครอินเวอร์เตอร์';
    }
    if (c.includes('ออปติไมเซอร์') || c.includes('optimizer')) {
      return 'ออปติไมเซอร์';
    }
    if (c.includes('แบตเตอรี่') || c.includes('battery')) {
      return 'แบตเตอรี่';
    }
    if (c.includes('อินเวอร์เตอร์') || c.includes('inverter') || c === 'inv') {
      return 'อินเวอร์เตอร์';
    }
    return c;
  };

  const filteredBrandsList = allBrands.filter((b) => {
    if (!category) return true;
    if (!b.category) return false;
    return normalizeCategory(b.category) === normalizeCategory(category);
  });

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCategory = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (selectedCategory) {
      params.set('category', selectedCategory);
    } else {
      params.delete('category');
    }
    params.delete('brand');
    params.set('page', '1');
    router.push(`/dashboard/inventory/backups?${params.toString()}`);
  };

  return (
    <form method="GET" className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col lg:flex-row items-center gap-3 w-full">
      
      <div className="relative flex-1 w-full lg:w-auto">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
        <input
          type="text"
          name="query"
          defaultValue={query}
          placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, หรือ S/N..."
          className="w-full pl-10 pr-4 py-2.5 bg-white text-gray-900 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition"
        />
      </div>

      <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap">
        <select
          name="status"
          defaultValue={status}
          className="px-4 py-2.5 bg-white text-gray-900 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition w-full sm:w-40 shadow-sm cursor-pointer"
        >
          <option value="">สถานะทั้งหมด</option>
          <option value="AVAILABLE">AVAILABLE (พร้อมใช้งาน)</option>
          <option value="IN_USE">IN_USE (กำลังยืมใช้งาน)</option>
          <option value="MAINTENANCE">MAINTENANCE (ซ่อมบำรุง)</option>
          <option value="WAITING_DEYE_SEND">รอส่ง Deye</option>
          <option value="SENT_TO_DEYE">ส่ง Deye แล้ว</option>
          <option value="COMPLETED_BY_DEYE">Deye ซ่อมเสร็จ</option>
          {/* เพิ่มตัวเลือกสถานะสลับเปลี่ยนเครื่องสำรองถาวรที่นี่ */}
          <option value="SWAPPED_PERMANENT">สลับเปลี่ยนเครื่องถาวร</option>
        </select>

        <select
          name="category"
          defaultValue={category}
          onChange={handleCategoryChange}
          className="px-4 py-2.5 bg-white text-gray-900 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition w-full sm:w-44 shadow-sm cursor-pointer"
        >
          <option value="">หมวดหมู่ทั้งหมด</option>
          {STANDARD_CATEGORIES.map((cat, index) => (
            <option key={index} value={cat}>{cat}</option>
          ))}
        </select>

        <select
          name="brand"
          defaultValue={brand}
          className="px-4 py-2.5 bg-white text-gray-900 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition w-full sm:w-36 shadow-sm cursor-pointer"
        >
          <option value="">แบรนด์ทั้งหมด</option>
          {filteredBrandsList.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <button
          type="submit"
          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gray-900 hover:bg-black text-white font-black text-sm rounded-xl transition shadow-sm cursor-pointer shrink-0"
        >
          <Search className="w-4 h-4 shrink-0" /> ค้นหา
        </button>

        <Link
          href="/dashboard/inventory/backups"
          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-sm rounded-xl transition shadow-sm cursor-pointer shrink-0 no-underline"
        >
          <X className="w-4 h-4 shrink-0 text-gray-500" /> ล้าง
        </Link>
      </div>

    </form>
  );
}