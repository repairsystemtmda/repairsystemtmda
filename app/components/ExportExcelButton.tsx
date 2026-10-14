'use client';

import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';

interface ExportDeyeButtonProps {
  jobId?: string;
  className?: string;
}

export default function ExportDeyeButton({ jobId, className }: ExportDeyeButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = () => {
    try {
      setLoading(true);
      
      // บังคับวิ่งไปที่ API ของ Deye 3 ชีตตัวใหม่เท่านั้น (ห้ามใช้ export-claims เด็ดขาด)
      const endpoint = jobId ? `/api/export-deye?jobId=${jobId}` : '/api/export-deye';
      
      // สั่งเปิด URL เพื่อดาวน์โหลดไฟล์ Excel ผ่าน Browser
      window.location.href = endpoint;
    } catch (error) {
      console.error('Export Deye failed:', error);
      alert('เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์ Deye Excel');
    } finally {
      // หน่วงเวลาเล็กน้อยเพื่อให้สถานะ loading กลับมาปกติ
      setTimeout(() => setLoading(false), 1500);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className={className || "px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2 font-medium shadow-sm"}
    >
      <FileSpreadsheet className="w-4 h-4" />
      {loading ? 'กำลังสร้างไฟล์ 3 ชีต...' : 'Export Deye/TMDA'}
    </button>
  );
}