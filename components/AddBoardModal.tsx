'use client';

import { useState } from 'react';
import { createNewBoard } from '@/app/actions/inventory';
import { Plus, X } from 'lucide-react';

export default function AddBoardModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
  setError(null);
  const res = await createNewBoard(formData); // เปลี่ยนเป็น createNewBoard
  if (res?.error) {
    setError(res.error);
  } else {
    setIsOpen(false);
  }
}
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
      >
        <Plus className="w-4 h-4" /> เพิ่มบอร์ดใหม่
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl relative">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-slate-800 mb-4">เพิ่มบอร์ดอะไหล่ใหม่</h2>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <form action={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">รหัสบอร์ด (Code)</label>
                  <input name="code" required placeholder="เช่น BRD-INV-03" className="w-full border rounded-lg p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">หมวดหมู่</label>
                  <select name="category" className="w-full border rounded-lg p-2 text-sm bg-white">
                    <option value="INVERTER">INVERTER</option>
                    <option value="OPTIMIZER">OPTIMIZER</option>
                    <option value="MICRO_INVERTER">MICRO_INVERTER</option>
                    <option value="BATTERY">BATTERY</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อรายการ (Name)</label>
                <input name="name" required placeholder="เช่น Main Control Board 10KW" className="w-full border rounded-lg p-2 text-sm" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">จำนวนเริ่มต้น</label>
                  <input name="quantity" type="number" defaultValue="0" min="0" className="w-full border rounded-lg p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">จุดเตือนสต็อกต่ำ</label>
                  <input name="minThreshold" type="number" defaultValue="5" min="0" className="w-full border rounded-lg p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ราคาต่อหน่วย (฿)</label>
                  <input name="unitPrice" type="number" defaultValue="0" min="0" className="w-full border rounded-lg p-2 text-sm" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}