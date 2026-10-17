"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Loader2, Save, CheckCircle2, Edit3, X } from "lucide-react";

// 🌟 ปุ่มสลับโหมด "แก้ไขข้อมูล" พร้อมสถานะกำลังโหลดที่ถูกต้อง
export function EditModeToggleButton({ partId, isEditing }: { partId: string; isEditing: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (isEditing) {
      // เมื่ออยู่ในโหมดแก้ไข แล้วกดปุ่ม ให้ยกเลิกการแก้ไข
      router.push(`/dashboard/inventory/boards/${partId}`);
    } else {
      // เมื่ออยู่ในโหมดดูปกติ แล้วกดปุ่ม ให้เปิดโหมดแก้ไข
      router.push(`/dashboard/inventory/boards/${partId}?edit=true`);
    }
  };

  if (isEditing) {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full sm:w-auto px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-gray-700" />
            <span>กำลังยกเลิก...</span>
          </>
        ) : (
          <>
            <X className="w-4 h-4" />
            <span>ยกเลิกการแก้ไข</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-white" />
          <span>กำลังเปิดฟอร์ม...</span>
        </>
      ) : (
        <>
          <Edit3 className="w-4 h-4" />
          <span>แก้ไขข้อมูล</span>
        </>
      )}
    </button>
  );
}

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