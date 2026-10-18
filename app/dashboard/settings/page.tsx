"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { HardDrive, Download, CheckCircle2, AlertCircle, Tags, Package, ChevronRight, Video, RefreshCw, Clock, BellRing } from "lucide-react";

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  
  // สถานะเปิด-ปิดบันทึกวิดีโอ LINE OA
  const [lineOaSaveVideo, setLineOaSaveVideo] = useState(true);
  const [savingToggle, setSavingToggle] = useState(false);

  // 📌 [เพิ่มใหม่] สถานะเปิด-ปิดแจ้งเตือนการเบิกอะไหล่ LINE OA
  const [lineOaAlertEnabled, setLineOaAlertEnabled] = useState(true);
  const [savingAlertToggle, setSavingAlertToggle] = useState(false);

  // สถานะสำหรับเก็บรายการไฟล์แบ็คอัพ
  const [backupFiles, setBackupFiles] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);

  // ฟังก์ชันสำหรับดึงรายชื่อไฟล์แบ็คอัพจาก API
  const fetchBackupFiles = async () => {
    setLoadingBackups(true);
    try {
      const res = await fetch("/api/backups");
      const data = await res.json();
      if (data.success) {
        setBackupFiles(data.files || []);
      }
    } catch (err) {
      console.error("Failed to load backup files", err);
    } finally {
      setLoadingBackups(false);
    }
  };

  // ดึงค่าตั้งค่าปัจจุบันและรายการแบ็คอัพเมื่อโหลดหน้าจอ
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.setting) {
          setLineOaSaveVideo(data.setting.lineOaSaveVideo);
          // 📌 [เพิ่มใหม่] โหลดค่าแจ้งเตือน
          if (data.setting.lineOaAlertEnabled !== undefined) {
            setLineOaAlertEnabled(data.setting.lineOaAlertEnabled);
          }
        }
      })
      .catch((err) => console.error("Failed to load settings", err));

    fetchBackupFiles();
  }, []);

  const handleToggleChange = async (checked: boolean) => {
    setLineOaSaveVideo(checked);
    setSavingToggle(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineOaSaveVideo: checked }),
      });
      const data = await res.json();
      if (!data.success) {
        alert("บันทึกค่าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        setLineOaSaveVideo(!checked);
      }
    } catch (err) {
      console.error(err);
      setLineOaSaveVideo(!checked);
    } finally {
      setSavingToggle(false);
    }
  };

  // 📌 [เพิ่มใหม่] ฟังก์ชันกดเปลี่ยนสวิตช์แจ้งเตือนการเบิกอะไหล่
  const handleAlertToggleChange = async (checked: boolean) => {
    setLineOaAlertEnabled(checked);
    setSavingAlertToggle(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineOaAlertEnabled: checked }),
      });
      const data = await res.json();
      if (!data.success) {
        alert("บันทึกค่าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        setLineOaAlertEnabled(!checked);
      }
    } catch (err) {
      console.error(err);
      setLineOaAlertEnabled(!checked);
    } finally {
      setSavingAlertToggle(false);
    }
  };

  const handleBackup = async () => {
    if (!confirm("คุณต้องการสำรองข้อมูลฐานข้อมูลตอนนี้ใช่หรือไม่?")) return;
    
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/backups", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        setIsSuccess(true);
        setMessage(`สำรองข้อมูลสำเร็จ! ไฟล์: ${data.filename}`);
        fetchBackupFiles();
      } else {
        setIsSuccess(false);
        setMessage(`เกิดข้อผิดพลาด: ${data.message}`);
      }
    } catch (err) {
      setIsSuccess(false);
      setMessage("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ตั้งค่าระบบ (System Settings)</h1>
        <p className="text-sm text-gray-500 mt-1">จัดการระบบสำรองข้อมูล แบรนด์สินค้า รายการอะไหล่ และการทำงานของระบบ</p>
      </div>
      
      {/* ส่วนจัดการแบรนด์และอะไหล่ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        <Link href="/dashboard/settings/brands" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:border-blue-300 transition group flex items-center justify-between no-underline">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
              <Tags className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800 group-hover:text-blue-600 transition">จัดการแบรนด์</h2>
              <p className="text-xs text-gray-500 mt-0.5">เพิ่ม/แก้ไขแบรนด์แยกตามหมวดหมู่</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link href="/dashboard/settings/spare-parts" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-300 transition group flex items-center justify-between no-underline">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800 group-hover:text-indigo-600 transition">จัดการอะไหล่</h2>
              <p className="text-xs text-gray-500 mt-0.5">กำหนดรายการอะไหล่และขั้นต่ำสต็อก</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
        </Link>

      </div>

      {/* ส่วนตั้งค่า LINE OA Video Saving */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800">บันทึกวิดีโอทดสอบจาก LINE OA</h2>
            <p className="text-xs text-gray-500 mt-0.5">เปิด/ปิด การดาวน์โหลดและบันทึกไฟล์วิดีโออัตโนมัติเมื่อลูกค้าส่งผ่านไลน์</p>
          </div>
        </div>
        
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            checked={lineOaSaveVideo}
            disabled={savingToggle}
            onChange={(e) => handleToggleChange(e.target.checked)}
            className="sr-only peer" 
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
        </label>
      </div>

      {/* 📌 [เพิ่มใหม่] ส่วนตั้งค่าเปิด-ปิด แจ้งเตือนยังไม่ได้เบิกอะไหล่ผ่าน LINE OA */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800">แจ้งเตือนยังไม่ได้เบิกอะไหล่ผ่าน LINE OA</h2>
            <p className="text-xs text-gray-500 mt-0.5">เปิด/ปิด การส่งข้อความแจ้งเตือนอัตโนมัติเมื่อส่งคลิปแล้วแต่ยังไม่เบิกอะไหล่</p>
          </div>
        </div>
        
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            checked={lineOaAlertEnabled}
            disabled={savingAlertToggle}
            onChange={(e) => handleAlertToggleChange(e.target.checked)}
            className="sr-only peer" 
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
        </label>
      </div>

      {/* ส่วนสำรองข้อมูล */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800">สำรองข้อมูลฐานข้อมูล (Database Backup)</h2>
            <p className="text-xs text-gray-500">สร้างไฟล์สำรอง (.db) เก็บไว้ในโฟลเดอร์ backups ทันที ป้องกันข้อมูลสูญหาย</p>
          </div>
        </div>
        
        <div className="pt-2">
          <button
            onClick={handleBackup}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-medium transition disabled:bg-gray-300 shadow-sm text-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {loading ? "กำลังสำรองข้อมูล..." : "สำรองข้อมูลทันที"}
          </button>
        </div>

        {message && (
          <div className={`mt-3 p-3.5 rounded-xl text-sm flex items-center gap-2.5 ${isSuccess ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            {isSuccess ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
            <span className="font-medium">{message}</span>
          </div>
        )}
      </div>

      {/* ส่วนตารางแสดงประวัติไฟล์สำรองข้อมูล (Backup History) */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800">ประวัติไฟล์สำรองข้อมูล (Backup History)</h2>
              <p className="text-xs text-gray-500">ตรวจสอบไฟล์ฐานข้อมูล (.db) ที่ระบบแบ็คอัพอัตโนมัติและแบ็คอัพด้วยตนเอง</p>
            </div>
          </div>
          
          <button
            onClick={fetchBackupFiles}
            disabled={loadingBackups}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-xl transition border border-gray-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingBackups ? 'animate-spin' : ''}`} />
            รีเฟรช
          </button>
        </div>

        {backupFiles.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
            ยังไม่พบไฟล์สำรองข้อมูลในระบบ
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">ชื่อไฟล์</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">ขนาดไฟล์</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">วันที่ / เวลาที่สำรอง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {backupFiles.map((file, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-mono text-xs text-gray-800 font-medium">{file.filename}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{(file.size / 1024).toFixed(2)} KB</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {new Date(file.createdAt).toLocaleString("th-TH", {
                        dateStyle: "medium",
                        timeStyle: "medium",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}