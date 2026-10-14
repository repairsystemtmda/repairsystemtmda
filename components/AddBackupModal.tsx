'use client';

import { useState } from 'react';
import { createBackupDevice } from '@/app/actions/inventory';
import { Plus, X } from 'lucide-react';

export default function AddBackupModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const res = await createBackupDevice(formData);
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
        <Plus className="w-4 h-4" /> เพิ่มเครื่องสำรอง
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

            <h2 className="text-xl font-bold text-slate-800 mb-4">เพิ่มเครื่องสำรองใหม่</h2>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <form action={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Serial Number (S/N)</label>
                <input name="serialNumber" required placeholder="เช่น BKP-SUN2000-003" className="w-full border rounded-lg p-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ยี่ห้อ (Brand)</label>
                  <input name="brand" required placeholder="เช่น Huawei" className="w-full border rounded-lg p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">รุ่น (Model)</label>
                  <input name="model" required placeholder="เช่น SUN2000-5KTL" className="w-full border rounded-lg p-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">หมวดหมู่</label>
                <select name="category" className="w-full border rounded-lg p-2 text-sm bg-white">
                  <option value="Inverter">Inverter</option>
                  <option value="Optimizer">Optimizer</option>
                  <option value="Micro Inverter">Micro Inverter</option>
                  <option value="Battery / BMS">Battery / BMS</option>
                </select>
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