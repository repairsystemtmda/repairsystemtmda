'use client';

import { useState, useEffect } from 'react';

interface BoardType {
  id: string;
  name: string;
  category?: string | null;
}

export default function BoardTypesManagementPage() {
  const [boardTypes, setBoardTypes] = useState<BoardType[]>([]);
  const [boardTypeName, setBoardTypeName] = useState('');
  const [category, setCategory] = useState('อินเวอร์เตอร์');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin/board-types');
      const data = await res.json();
      if (Array.isArray(data)) setBoardTypes(data);
    } catch (err) {
      console.error('Error fetching board types:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardTypeName.trim()) return;

    setLoading(true);
    try {
      const endpoint = editingId ? `/api/admin/board-types?id=${editingId}` : '/api/admin/board-types';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: boardTypeName.trim().toUpperCase(),
          category: category,
        }),
      });

      if (res.ok) {
        setEditingId(null);
        setBoardTypeName('');
        setCategory('อินเวอร์เตอร์');
        fetchData();
      } else {
        let errorMessage = 'ไม่สามารถบันทึกข้อมูลได้';
        try {
          const err = await res.json();
          if (err && err.error) errorMessage = err.error;
        } catch (e) {
          // กรณีที่ Response ไม่ได้ส่งกลับมาเป็น JSON
        }
        alert(errorMessage);
      }
    } catch (err) {
      console.error('Error saving board type:', err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (item: BoardType) => {
    setEditingId(item.id);
    setBoardTypeName(item.name);
    setCategory(item.category || 'อินเวอร์เตอร์');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setBoardTypeName('');
    setCategory('อินเวอร์เตอร์');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('คุณต้องการลบประเภทบอร์ดนี้ใช่หรือไม่?')) return;

    try {
      const res = await fetch(`/api/admin/board-types?id=${id}`, {
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
      console.error('Error deleting board type:', err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-black">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">จัดการประเภทบอร์ดมาตรฐาน (Board Types)</h1>
      </div>

      {/* ฟอร์มเพิ่ม / แก้ไขประเภทบอร์ด */}
      <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-end">
        
        <div className="w-full md:w-72">
          <label className="block text-xs font-bold mb-1.5 text-gray-700 uppercase tracking-wide">
            หมวดหมู่อุปกรณ์ *
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border-2 border-gray-200 px-3 py-2.5 rounded-xl w-full bg-white text-gray-900 font-bold focus:border-blue-600 outline-none transition shadow-2xs"
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
            {editingId ? 'แก้ไขชื่อประเภทบอร์ด *' : 'พิมพ์ชื่อประเภทบอร์ดมาตรฐานใหม่ *'}
          </label>
          <input
            type="text"
            value={boardTypeName}
            onChange={(e) => setBoardTypeName(e.target.value)}
            placeholder="เช่น WIFI_BOARD, MAIN_BOARD"
            className="border-2 border-gray-200 px-3.5 py-2.5 rounded-xl w-full bg-white text-gray-900 font-bold focus:border-blue-600 outline-none transition shadow-2xs"
            required
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2.5 rounded-xl cursor-pointer font-bold text-sm shadow-sm transition"
            >
              ยกเลิก
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className={`${editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-6 py-2.5 rounded-xl disabled:opacity-50 cursor-pointer w-full md:w-auto font-extrabold text-sm shadow-sm transition`}
          >
            {loading ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : '+ เพิ่มประเภทบอร์ด'}
          </button>
        </div>
      </form>

      {/* ตารางแสดงรายการประเภทบอร์ด */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-700 font-black uppercase tracking-wider">
              <th className="py-4 px-5 text-left">หมวดหมู่อุปกรณ์</th>
              <th className="py-4 px-5 text-left">ชื่อประเภทบอร์ดมาตรฐาน</th>
              <th className="py-4 px-5 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {boardTypes.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-12 text-gray-500 font-bold italic">
                  ยังไม่มีข้อมูลประเภทบอร์ด สามารถพิมพ์เพิ่มจากฟอร์มด้านบนได้เลยครับ
                </td>
              </tr>
            ) : (
              boardTypes.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/75 transition">
                  <td className="py-4 px-5">
                    <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-black bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs">
                      {item.category || 'อินเวอร์เตอร์'}
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}