"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Save, CheckCircle2 } from "lucide-react";

// 🌟 ปุ่มสำหรับการบันทึกการแก้ไขข้อมูลทั่วไป
export function SaveEditButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs sm:text-sm text-white transition shadow-sm flex items-center justify-center gap-2 ${
        pending
          ? "bg-blue-400 cursor-not-allowed opacity-80"
          : "bg-blue-600 hover:bg-blue-700 active:scale-95 cursor-pointer"
      }`}
    >
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-white" />
          <span>กำลังบันทึก...</span>
        </>
      ) : (
        <>
          <Save className="w-4 h-4" />
          <span>บันทึกการแก้ไขข้อมูล</span>
        </>
      )}
    </button>
  );
}

// 🌟 ปุ่มสำหรับการยืนยันปรับสต็อกด่วน
export function AdjustStockButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white transition shadow-sm flex items-center justify-center gap-2 flex-shrink-0 ${
        pending
          ? "bg-slate-500 cursor-not-allowed opacity-80"
          : "bg-slate-900 hover:bg-slate-800 active:scale-95 cursor-pointer"
      }`}
    >
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-white" />
          <span>กำลังบันทึก...</span>
        </>
      ) : (
        <>
          <CheckCircle2 className="w-4 h-4" />
          <span>ยืนยันการปรับสต็อก</span>
        </>
      )}
    </button>
  );
}