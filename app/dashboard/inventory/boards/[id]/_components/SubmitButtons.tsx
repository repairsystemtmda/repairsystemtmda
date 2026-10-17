"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Loader2, Save, CheckCircle2, Edit3, X } from "lucide-react";

// 🌟 คอมโพเนนต์สำหรับจัดการ Dropdown และซ่อน/แสดงช่องกรอกชื่อประเภทอื่นๆ
export function BoardTypeSelector({ 
  boardTypesFromDb, 
  initialValue 
}: { 
  boardTypesFromDb: any[]; 
  initialValue: string;
}) {
  const isCustomInitial = Boolean(
    initialValue && !boardTypesFromDb.some((bt) => bt.name === initialValue)
  );

  const [selectedValue, setSelectedValue] = useState(
    isCustomInitial ? "OTHER" : initialValue
  );
  const [customValue, setCustomValue] = useState(
    isCustomInitial ? initialValue : ""
  );

  return (
    <div className="space-y-2">
      <select
        name="boardType"
        value={selectedValue}
        onChange={(e) => setSelectedValue(e.target.value)}
        className="w-full px-3.5 py-2.5 appearance-none bg-white border border-gray-300 rounded-xl text-base sm:text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition shadow-xs"
      >
        <option value="">-- เลือกประเภทบอร์ดมาตรฐาน --</option>
        {boardTypesFromDb.map((bt: any) => (
          <option key={bt.id || bt.name} value={bt.name}>
            {bt.name}
          </option>
        ))}
        <option value="OTHER">OTHER (บอร์ดเสริม / อื่นๆ / กำหนดเอง)</option>
      </select>

      {/* จะแสดงช่องกรอกข้อความนี้ก็ต่อเมื่อเลือก "OTHER" เท่านั้น */}
      {selectedValue === "OTHER" && (
        <input
          type="text"
          name="customBoardType"
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          placeholder="กรอกชื่อประเภทบอร์ดอื่นๆ..."
          required
          className="w-full px-3.5 py-2.5 bg-white border border-blue-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs"
        />
      )}
    </div>
  );
}

// 🌟 ปุ่มสลับโหมด "แก้ไขข้อมูล" แบบเคลียร์สถานะอัตโนมัติเมื่อ URL เปลี่ยน
export function EditModeToggleButton({ partId, isEditing }: { partId: string; isEditing: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, [searchParams, isEditing]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (isEditing) {
      router.push(`/dashboard/inventory/boards/${partId}`);
    } else {
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