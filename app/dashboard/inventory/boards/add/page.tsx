import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PackagePlus, ArrowLeft } from 'lucide-react';

export default async function AddSparePartPage() {
  
  // Server Action สำหรับบันทึกอะไหล่ใหม่ลงฐานข้อมูล
  async function handleAddPart(formData: FormData) {
    'use server';

    const boardModelCode = formData.get('boardModelCode') as string;
    const name = formData.get('name') as string;
    const version = formData.get('version') as string;
    const category = formData.get('category') as string;
    const model = formData.get('model') as string;
    const location = formData.get('location') as string;
    const stock = parseInt(formData.get('stock') as string) || 1;
    const minQuantity = parseInt(formData.get('minQuantity') as string) || 5;

    if (!name || !boardModelCode) return;

    try {
      // 1. สร้างรายการอะไหล่ใหม่
      const newPart = await prisma.sparePart.create({
        data: {
          boardModelCode,
          name,
          version,
          category,
          model,
          location,
          stock,
          minQuantity,
        },
      });

      // 2. บันทึกประวัติความเคลื่อนไหว (StockLog) ว่ามีการรับเข้าครั้งแรก
      await prisma.stockLog.create({
        data: {
          sparePartId: newPart.id,
          type: 'RESTOCK', 
          quantity: stock,
          note: 'ลงทะเบียนอะไหล่ใหม่เข้าคลัง',
        },
      });

    } catch (error) {
      console.error('Failed to create spare part:', error);
    }

    // 3. พาผู้ใช้งานกลับไปที่หน้าตารางหลัก
    redirect('/dashboard/inventory/boards');
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      
      {/* ส่วนหัวหน้าเว็บ */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/inventory/boards"
            className="p-2 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <PackagePlus className="w-7 h-7 text-blue-600" /> ลงทะเบียนอะไหล่ใหม่
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">กรอกข้อมูลรายละเอียดบอร์ดและจำนวนเริ่มต้นเพื่อเพิ่มเข้าคลัง</p>
          </div>
        </div>
      </div>

      {/* ฟอร์มกรอกข้อมูล */}
      <form action={handleAddPart} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 space-y-6">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800">
              รหัสรุ่นบอร์ด (Board Model Code) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="boardModelCode"
              required
              placeholder="เช่น 963258741 หรือ 20110101"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-gray-900 font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800">
              ชื่อบอร์ดอะไหล่ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="เช่น main, power board"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-gray-900"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800">เวอร์ชัน (Version)</label>
            <input
              type="text"
              name="version"
              placeholder="เช่น V1.2 หรือ Rev.3"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-gray-900"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800">
              หมวดหมู่อุปกรณ์ <span className="text-red-500">*</span>
            </label>
            {/* เพิ่ม appearance-none และ text-base เพื่อแก้ปัญหาช่องดรอปดาวน์เล็กบน iOS */}
            <select
              name="category"
              required
              defaultValue="Inverter"
              className="w-full px-4 py-3 appearance-none bg-gray-50 border border-gray-200 rounded-xl text-base sm:text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-gray-900"
            >
              <option value="Inverter">อินเวอร์เตอร์ (Inverter)</option>
              <option value="Battery">แบตเตอรี่ (Battery)</option>
              <option value="Accessories">อุปกรณ์เสริม (Accessories)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800">รุ่นเครื่องที่รองรับ (Model)</label>
            <input
              type="text"
              name="model"
              placeholder="เช่น SUN-6K-SG04LP1-EU-SM2"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-gray-900"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800">ตำแหน่งจัดเก็บ (Location)</label>
            <input
              type="text"
              name="location"
              placeholder="เช่น D6, ชั้นวาง A2"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-gray-900"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800">
              จำนวนเริ่มต้นในสต็อก <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="stock"
              required
              min="1"
              defaultValue="1"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-gray-900 font-bold"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800">จุดแจ้งเตือนขั้นต่ำ (Min Quantity)</label>
            <input
              type="number"
              name="minQuantity"
              required
              min="0"
              defaultValue="5"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-gray-900"
            />
          </div>

        </div>

        <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
          <Link
            href="/dashboard/inventory/boards"
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition"
          >
            ยกเลิก
          </Link>
          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
          >
            บันทึกข้อมูลลงคลัง
          </button>
        </div>

      </form>
    </div>
  );
}