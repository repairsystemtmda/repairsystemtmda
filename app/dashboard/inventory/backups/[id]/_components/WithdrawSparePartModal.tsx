'use client';

import React, { useState } from 'react';
import { X, Search, Camera } from 'lucide-react';

interface SparePart {
  id: string;
  name: string;
  code?: string | null;
  boardModelCode?: string | null;
  qrModelCode?: string | null;
  stock: number;
  model?: string | null;
  location?: string | null;
}

interface WithdrawSparePartModalProps {
  isOpen: boolean;
  onClose: () => void;
  spareParts: SparePart[];
  onSubmit: (formData: FormData) => Promise<void>;
  isSubmitting: boolean;
}

export default function WithdrawSparePartModal({
  isOpen,
  onClose,
  spareParts,
  onSubmit,
  isSubmitting,
}: WithdrawSparePartModalProps) {
  const [selectedSparePart, setSelectedSparePart] = useState<SparePart | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  
  const [boardImageFile, setBoardImageFile] = useState<File | null>(null);
  const [boardImagePreview, setBoardImagePreview] = useState<string | null>(null);
  const [qrImageFile, setQrImageFile] = useState<File | null>(null);
  const [qrImagePreview, setQrImagePreview] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredSpareParts = spareParts.filter((sp) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = sp.name.toLowerCase().includes(q);
    const codeStr = (sp.qrModelCode || sp.boardModelCode || sp.code || '').toLowerCase();
    const modelStr = (sp.model || '').toLowerCase();
    return nameMatch || codeStr.includes(q) || modelStr.includes(q);
  });

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSparePart) {
      alert('กรุณาเลือกรายการอะไหล่');
      return;
    }

    const formData = new FormData();
    formData.append('sparePartId', selectedSparePart.id);
    
    // บังคับแปลงจำนวนให้เป็นค่าติดลบเสมอ เพื่อให้หน้า Audit Logs แสดงผลเป็นลบและตัดสต็อกถูกต้อง
    const rawQty = parseInt(quantity || '1', 10);
    const negativeQty = -Math.abs(rawQty).toString();
    formData.append('quantity', negativeQty.toString());

    formData.append('notes', notes);
    if (boardImageFile) formData.append('images', boardImageFile);
    if (qrImageFile) formData.append('images', qrImageFile);

    await onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-amber-100 text-amber-700 rounded-xl font-bold">⚡</span>
            <h3 className="font-bold text-gray-900 text-sm sm:text-base">เบิกอะไหล่และแนบหลักฐาน</h3>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/50 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* ช่องเลือกอะไหล่แบบบังคับเปิด Modal ค้นหา */}
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1.5">
              ค้นหาและเลือกอะไหล่ (พิมพ์ชื่อ หรือเลขท้ายรหัส) *
            </label>
            <div
              onClick={() => setIsSearchModalOpen(true)}
              className="w-full px-4 py-3 bg-amber-50/40 border-2 border-amber-400 rounded-xl text-xs sm:text-sm font-bold text-gray-700 flex items-center justify-between cursor-pointer hover:bg-amber-50 transition shadow-sm"
            >
              <span className={selectedSparePart ? "text-gray-900 font-extrabold" : "text-gray-500"}>
                {selectedSparePart 
                  ? `${selectedSparePart.name} (${selectedSparePart.qrModelCode || selectedSparePart.boardModelCode || selectedSparePart.code || ''})` 
                  : "🔍 คลิกที่นี่เพื่อค้นหาและเลือกอะไหล่..."}
              </span>
              <Search className="w-4 h-4 text-amber-600 shrink-0" />
            </div>
          </div>

          {/* จำนวนที่ใช้ */}
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1.5">จำนวนที่ใช้ *</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-xl text-xs sm:text-sm font-bold text-gray-900 focus:border-amber-500 outline-none shadow-sm"
              required
            />
          </div>

          {/* หมายเหตุ */}
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1.5">หมายเหตุการเบิก / อาการซ่อม</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ระบุรายละเอียดการเบิกอะไหล่..."
              className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-xl text-xs sm:text-sm font-bold text-gray-900 focus:border-amber-500 outline-none shadow-sm resize-none"
            />
          </div>

          {/* รูปถ่ายหลักฐาน */}
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1.5">
              📸 รูปถ่ายหลักฐาน (จำเป็นต้องถ่าย 2 รูป เพื่อใช้บันทึกและ Export ข้อมูล)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              
              {/* รูปที่ 1 */}
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center relative hover:border-amber-500 transition bg-gray-50/50 cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setBoardImageFile(file);
                      setBoardImagePreview(URL.createObjectURL(file));
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                {boardImagePreview ? (
                  <div className="relative h-24 w-full">
                    <img src={boardImagePreview} alt="Board" className="h-full w-full object-cover rounded-lg" />
                    <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">เปลี่ยนรูป</span>
                  </div>
                ) : (
                  <div className="py-4 space-y-1">
                    <Camera className="w-8 h-8 mx-auto text-gray-400" />
                    <div className="text-xs font-bold text-gray-700">รูปที่ 1: เต็มบอร์ดอะไหล่ *</div>
                    <div className="text-[10px] text-gray-500">กดเพื่อเปิดกล้อง/เลือกรูป</div>
                  </div>
                )}
              </div>

              {/* รูปที่ 2 */}
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center relative hover:border-amber-500 transition bg-gray-50/50 cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setQrImageFile(file);
                      setQrImagePreview(URL.createObjectURL(file));
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                {qrImagePreview ? (
                  <div className="relative h-24 w-full">
                    <img src={qrImagePreview} alt="QR" className="h-full w-full object-cover rounded-lg" />
                    <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">เปลี่ยนรูป</span>
                  </div>
                ) : (
                  <div className="py-4 space-y-1">
                    <Camera className="w-8 h-8 mx-auto text-gray-400" />
                    <div className="text-xs font-bold text-gray-700">รูปที่ 2: QR Code / S/N *</div>
                    <div className="text-[10px] text-gray-500">กดเพื่อเปิดกล้อง/เลือกรูป</div>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ปุ่มด้านล่าง */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-lg shadow-amber-500/20 transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันเบิกอะไหล่'}
            </button>
          </div>

        </form>
      </div>

      {/* --- Pop-up ค้นหาอะไหล่ย่อย --- */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-amber-50">
              <div className="flex items-center space-x-2 text-amber-700">
                <Search className="w-5 h-5" />
                <h3 className="font-bold text-gray-900 text-sm sm:text-base">ค้นหาและเลือกอะไหล่</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsSearchModalOpen(false)}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-amber-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="พิมพ์รหัสรุ่นบอร์ด, ชื่อบอร์ดอะไหล่ หรือ รุ่นเครื่อง..."
                  className="w-full pl-10 pr-4 py-3 bg-white border-2 border-amber-400 rounded-xl text-xs sm:text-sm font-bold text-gray-900 focus:border-amber-600 outline-none shadow-sm"
                />
              </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 bg-gray-50/50">
              {filteredSpareParts.length > 0 ? (
                filteredSpareParts.map((sp) => {
                  const displayCode = sp.qrModelCode || sp.boardModelCode || sp.code;
                  return (
                    <div
                      key={sp.id}
                      onClick={() => {
                        setSelectedSparePart(sp);
                        setIsSearchModalOpen(false);
                        setSearchQuery('');
                      }}
                      className="p-4 bg-white border-2 border-gray-200 hover:border-amber-500 rounded-2xl shadow-sm cursor-pointer transition flex items-center justify-between group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          {displayCode && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg font-bold text-xs">
                              {displayCode}
                            </span>
                          )}
                          <span className="font-extrabold text-gray-900 text-sm group-hover:text-amber-600 transition">
                            {sp.name}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 font-semibold flex items-center space-x-3">
                          {sp.model && <span>รุ่นเครื่อง: <strong className="text-gray-700">{sp.model}</strong></span>}
                          {sp.location && <span>ตำแหน่ง: <strong className="text-gray-700">{sp.location}</strong></span>}
                        </div>
                      </div>

                      <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-xs shrink-0">
                        คงเหลือ: {sp.stock}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-xs text-gray-400 font-bold">
                  ไม่พบรายการอะไหล่ที่คุณค้นหา
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}