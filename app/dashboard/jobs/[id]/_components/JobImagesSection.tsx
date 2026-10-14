'use client';

import { useState, useEffect } from 'react';
import { Image as ImageIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface ImageItem {
  id?: string;
  url?: string;
  filePath?: string;
  imageUrl?: string;
  path?: string;
  type?: string | null;
  [key: string]: any;
}

export default function JobImagesSection({ 
  initialImages, 
  stockLogs 
}: { 
  initialImages: ImageItem[]; 
  stockLogs: any[]; 
}) {
  // ฟังก์ชันช่วยดึง URL ออกมาจากรูปภาพ ไม่ว่าจะเก็บชื่อฟิลด์ไหนใน DB
  const parseImageUrl = (img: any): string => {
    if (!img) return '';
    if (typeof img === 'string') return img;
    return img.url || img.filePath || img.imageUrl || img.path || img.fileUrl || '';
  };

  // แปลงข้อมูลรูปภาพทั้งหมดให้อยู่ในรูปแบบที่ปลอดภัย
  const rawImages = Array.isArray(initialImages) ? initialImages : [];
  
  const safeImages = rawImages.map((img, index) => ({
    id: img?.id || `img-${index}`,
    url: parseImageUrl(img),
    type: img?.type ? String(img.type).toUpperCase().trim() : ''
  })).filter(item => item.url !== '');

  // จัดระเบียบตายตัว: รูปแรกเป็นเนมเพลท รูปที่เหลือเป็นสภาพเครื่อง
  let nameplateImages = safeImages.length > 0 ? [safeImages[0]] : [];
  let generalImages = safeImages.length > 1 ? safeImages.slice(1) : [];

  // รวบรวมรูปภาพทั้งหมดสำหรับ Lightbox (กดดูรูปใหญ่)
  const allImages: { id: string; url: string; label: string }[] = [
    ...nameplateImages.map(img => ({ ...img, label: 'รูปถ่ายเนมเพลท (Nameplate / ป้าย S/N)' })),
    ...generalImages.map(img => ({ ...img, label: 'รูปถ่ายสภาพเครื่องและหลักฐานอื่นๆ' })),
    ...((Array.isArray(stockLogs) ? stockLogs : []).flatMap((log: any) => 
      (log?.images || []).map((img: any, idx: number) => ({
        id: img?.id || `log-${log.id}-${idx}`,
        url: parseImageUrl(img),
        label: `หลักฐานการเบิก: ${log.sparePart?.name || 'อะไหล่'}`
      }))
    )).filter(item => item.url !== '')
  ];

  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const activeImage = currentIndex !== null ? allImages[currentIndex] : null;

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex === null) return;
    setCurrentIndex(currentIndex === 0 ? allImages.length - 1 : currentIndex - 1);
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex === null) return;
    setCurrentIndex(currentIndex === allImages.length - 1 ? 0 : currentIndex + 1);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentIndex === null || allImages.length === 0) return;
      if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev) => (prev === null ? 0 : prev === 0 ? allImages.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex((prev) => (prev === null ? 0 : prev === allImages.length - 1 ? 0 : prev + 1));
      } else if (e.key === 'Escape') {
        setCurrentIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, allImages.length]);

  return (
    <div className="space-y-6">
      
      {/* ส่วนที่ 1: รูปถ่ายเนมเพลท (Nameplate / ป้าย S/N) สำหรับออกรายงาน Deye / TMDA */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-blue-600" /> รูปถ่ายเนมเพลท (Nameplate / ป้าย S/N) สำหรับออกรายงาน Deye / TMDA
          </h2>
        </div>
        {nameplateImages.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto py-2">
            {nameplateImages.map((img) => {
              const globalIndex = allImages.findIndex((item) => item.id === img.id);
              return (
                <img
                  key={img.id}
                  src={img.url}
                  alt="รูปเนมเพลท"
                  onClick={() => setCurrentIndex(globalIndex !== -1 ? globalIndex : 0)}
                  className="w-24 h-24 object-cover rounded-xl border border-gray-200 shadow-sm hover:opacity-80 transition cursor-pointer shrink-0"
                />
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic py-4 text-center">ยังไม่มีรูปเนมเพลท</p>
        )}
      </div>

      {/* ส่วนที่ 2: รูปถ่ายสภาพเครื่องและหลักฐานอื่นๆ (บอร์ดภายใน / ตำหนิ ฯลฯ) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-indigo-600" /> รูปถ่ายสภาพเครื่องและหลักฐานอื่นๆ (บอร์ดภายใน / ตำหนิ ฯลฯ)
          </h2>
        </div>
        {generalImages.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto py-2">
            {generalImages.map((img) => {
              const globalIndex = allImages.findIndex((item) => item.id === img.id);
              return (
                <img
                  key={img.id}
                  src={img.url}
                  alt="รูปสภาพเครื่อง"
                  onClick={() => setCurrentIndex(globalIndex !== -1 ? globalIndex : 0)}
                  className="w-24 h-24 object-cover rounded-xl border border-gray-200 shadow-sm hover:opacity-80 transition cursor-pointer shrink-0"
                />
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic py-4 text-center">ไม่มีรูปถ่ายสภาพเครื่องหรือหลักฐานอื่นๆ เพิ่มเติม</p>
        )}
      </div>

      {/* ส่วนที่ 3: ประวัติการเบิกอะไหล่และรูปหลักฐาน */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          📦 ประวัติการเบิกอะไหล่และรูปหลักฐาน
        </h2>
        {stockLogs && stockLogs.length > 0 ? (
          <div className="space-y-4">
            {stockLogs.map((log: any) => (
              <div key={log.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-lg">{log.sparePart?.name || 'อะไหล่'}</span>
                    <span className="ml-3 text-sm text-gray-700 font-medium">จำนวน: {log.quantity} ชิ้น ({log.type})</span>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString('th-TH')}</span>
                </div>
                {log.note && <p className="text-sm text-gray-600">หมายเหตุ: {log.note}</p>}
                
                {log.images && log.images.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pt-2">
                    {log.images.map((img: any, imgIdx: number) => {
                      const imgId = img?.id || `log-img-${imgIdx}`;
                      const globalIndex = allImages.findIndex((item) => item.id === imgId);
                      const imageUrl = parseImageUrl(img);
                      
                      if (!imageUrl) return null;

                      return (
                        <img
                          key={imgId}
                          src={imageUrl}
                          alt="หลักฐานการเบิก"
                          onClick={() => setCurrentIndex(globalIndex !== -1 ? globalIndex : 0)}
                          className="w-16 h-16 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition cursor-pointer shrink-0"
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic py-6 text-center">ยังไม่มีประวัติการเบิกอะไหล่ในใบงานนี้</p>
        )}
      </div>

      {/* Modal แสดงรูปขนาดใหญ่ */}
      {activeImage && currentIndex !== null && (
        <div 
          onClick={() => setCurrentIndex(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 cursor-zoom-out select-none"
        >
          <button
            onClick={() => setCurrentIndex(null)}
            className="absolute top-5 right-5 text-white bg-black/50 hover:bg-black/80 p-2.5 rounded-full text-sm font-bold cursor-pointer transition z-50"
            title="ปิด (Esc)"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute top-5 left-5 text-white bg-black/50 backdrop-blur-md px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 border border-white/10 z-50">
            <span className="text-blue-400 font-bold">{currentIndex + 1} / {allImages.length}</span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-200">{activeImage.label}</span>
          </div>

          {allImages.length > 1 && (
            <button
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/50 hover:bg-black/80 p-3 rounded-full cursor-pointer transition z-50 shadow-lg border border-white/10"
              title="รูปก่อนหน้า (←)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          <div className="relative max-w-5xl max-h-[85vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={activeImage.url}
              alt="รูปขยาย"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10"
            />
          </div>

          {allImages.length > 1 && (
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/50 hover:bg-black/80 p-3 rounded-full cursor-pointer transition z-50 shadow-lg border border-white/10"
              title="รูปถัดไป (→)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}