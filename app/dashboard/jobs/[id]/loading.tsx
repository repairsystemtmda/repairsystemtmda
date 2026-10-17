import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-500">
      <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      <p className="text-sm font-semibold">กำลังโหลดข้อมูลงานซ่อม...</p>
    </div>
  );
}