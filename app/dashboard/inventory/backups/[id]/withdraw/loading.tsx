import { Loader2, Package } from 'lucide-react';

export default function Loading() {
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6 flex flex-col items-center justify-center min-h-[60vh]">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 text-center space-y-4 max-w-md w-full">
        <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-amber-100">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-black text-gray-900 tracking-tight">กำลังเตรียมข้อมูลการเบิกอะไหล่</h2>
          <p className="text-xs sm:text-sm font-bold text-gray-500">กรุณารอสักครู่ ระบบกำลังโหลดฟอร์มและรายการอะไหล่...</p>
        </div>
      </div>
    </div>
  );
}