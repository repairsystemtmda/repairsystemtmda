'use client';

import { useState, useEffect } from 'react';

interface Brand {
  id: string;
  name: string;
  category?: string | null;
}

export default function BrandsManagementPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandName, setBrandName] = useState('');
  const [category, setCategory] = useState('อินเวอร์เตอร์'); // ตั้งค่าเริ่มต้นเป็นภาษาไทย
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ฟังก์ชันแปลงค่าหมวดหมู่ให้อยู่ในรูปภาษาไทยเสมอ (รองรับข้อมูลเก่าที่เป็นอังกฤษด้วย)
  const formatCategoryToThai = (cat?: string | null) => {
    switch (cat) {
      case 'Inverter':
      case 'อินเวอร์เตอร์':
        return 'อินเวอร์เตอร์';
      case 'Optimizer':
      case 'ออปติไมเซอร์':
        return 'ออปติไมเซอร์';
      case 'Micro Inverter':
      case 'ไมโครอินเวอร์เตอร์':
        return 'ไมโครอินเวอร์เตอร์';
      case 'Battery':
      case 'แบตเตอรี่':
        return 'แบตเตอรี่';
      case 'Solar Pump':
      case 'อินเวอร์เตอร์ปั๊มน้ำ':
        return 'อินเวอร์เตอร์ปั๊มน้ำ';
      default:
        return cat || 'อินเวอร์เตอร์';
    }
  };

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin/brands');
      const data = await res.json();
      if (Array.isArray(data)) setBrands(data);
    } catch (err) {
      console.error('Error fetching brands:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim()) return;

    setLoading(true);
    try {
      const endpoint = editingId ? `/api/admin/brands?id=${editingId}` : '/api/admin/brands';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: brandName.trim(),
          category: category,
        }),
      });

      if (res.ok) {
        setEditingId(null);
        setBrandName('');
        setCategory('อินเวอร์เตอร์');
        fetchData();
      } else {
        let errorMessage = 'ไม่สามารถบันทึกข้อมูลได้';
        try {
          const err = await res.json();
          if (err && err.error) errorMessage = err.error;
        } catch (e) {}
        alert(errorMessage);
      }
    } catch (err) {
      console.error('Error saving brand:', err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (item: Brand) => {
    setEditingId(item.id);
    setBrandName(item.name);
    setCategory(formatCategoryToThai(item.category));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setBrandName('');
    setCategory('อินเวอร์เตอร์');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('คุณต้องการลบแบรนด์นี้ใช่หรือไม่?')) return;

    try {
      const res = await fetch(`/api/admin/brands?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchData();
      } else {
        let errorMessage = 'ไม่สามารถลบรายการนี้ได้';
        try {
          const err = await res.json();
          if (err && err.error) errorMessage = err.error;
        } catch (e) {}
        alert(errorMessage);
      }
    } catch (err) {
      console.error('Error deleting brand:', err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 text-black">
      <div className="flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">จัดการแบรนด์อินเวอร์เตอร์ / อุปกรณ์</h1>
      </div>

      {/* ฟอร์มเพิ่ม / แก้ไขแบรนด์ */}
      <form onSubmit={handleSubmit} className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-end">
        <div className="w-full md:w-72">
          <label className="block text-xs font-bold mb-1.5 text-gray-700 uppercase tracking-wide">
            หมวดหมู่อุปกรณ์ *
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border-2 border-gray-200 px-3 py-2.5 rounded-xl w-full bg-white text-gray-900 font-bold focus:border-blue-600 outline-none transition shadow-2xs text-sm"
          >
            <option value="อินเวอร์เตอร์">อินเวอร์เตอร์ (Inverter)</option>
            <option value="ออปติไมเซอร์">ออปติไมเซอร์ (Optimizer)</option>
            <option value="ไมโครอินเวอร์เตอร์">ไมโครอินเวอร์เตอร์ (Micro Inverter)</option>
            <option value="แบตเตอรี่">แบตเตอรี่ (Battery)</option>
            <option value="อินเวอร์เตอร์ปั๊มน้ำ">อินเวอร์เตอร์ปั๊มน้ำ (Solar Pump)</option>
          </select>
        </div>

        <div className="flex-1 w-full">
          <label className="block text-xs font-bold mb-1.5 text-gray-700 uppercase tracking-wide">
            {editingId ? 'แก้ไขชื่อแบรนด์ *' : 'พิมพ์ชื่อแบรนด์ใหม่ *'}
          </label>
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="เช่น Deye, Huawei, TMDA..."
            className="border-2 border-gray-200 px-3.5 py-2.5 rounded-xl w-full bg-white text-gray-900 font-bold focus:border-blue-600 outline-none transition shadow-2xs text-sm"
            required
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2.5 rounded-xl cursor-pointer font-bold text-sm shadow-sm transition flex-1 md:flex-none justify-center"
            >
              ยกเลิก
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className={`${editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-6 py-2.5 rounded-xl disabled:opacity-50 cursor-pointer w-full md:w-auto font-extrabold text-sm shadow-sm transition`}
          >
            {loading ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : '+ เพิ่มแบรนด์'}
          </button>
        </div>
      </form>

      {/* 📱 ส่วนแสดงผลรายการ: แปลงเป็น Card บนมือถือ และเป็น Table บนจอใหญ่ */}
      {brands.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-500 font-bold italic shadow-sm">
          ยังไม่มีข้อมูลแบรนด์ สามารถพิมพ์เพิ่มจากฟอร์มด้านบนได้เลยครับ
        </div>
      ) : (
        <>
          {/* มุมมองมือถือ: แสดงเป็น Card แนวตั้ง */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {brands.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-black bg-slate-100 text-slate-800 border border-slate-200">
                    {formatCategoryToThai(item.category)}
                  </span>
                  <span className="inline-flex items-center px-3.5 py-1 rounded-xl text-xs font-black bg-blue-50 text-blue-800 border border-blue-100">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => handleEditClick(item)}
                    className="flex-1 bg-amber-500 text-white py-2 rounded-xl text-xs font-bold hover:bg-amber-600 cursor-pointer text-center shadow-xs transition"
                  >
                    แก้ไข
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="flex-1 bg-rose-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-rose-700 cursor-pointer text-center shadow-xs transition"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* มุมมองจอคอมพิวเตอร์ (Desktop): แสดงเป็น Table ปกติ */}
          <div className="hidden md:block border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-700 font-black uppercase tracking-wider">
                  <th className="py-4 px-5 text-left">หมวดหมู่อุปกรณ์</th>
                  <th className="py-4 px-5 text-left">ชื่อแบรนด์</th>
                  <th className="py-4 px-5 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {brands.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/75 transition">
                    <td className="py-4 px-5">
                      <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-black bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs">
                        {formatCategoryToThai(item.category)}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <span className="inline-flex items-center px-3.5 py-1 rounded-xl text-xs font-black bg-blue-50 text-blue-800 border border-blue-100 tracking-wide shadow-2xs">
                        {item.name}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleEditClick(item)}
                        className="bg-amber-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold hover:bg-amber-600 cursor-pointer shadow-xs transition"
                      >
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="bg-rose-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold hover:bg-rose-700 cursor-pointer shadow-xs transition"
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}