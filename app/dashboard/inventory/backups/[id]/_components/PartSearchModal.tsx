'use client';

import { useState, useMemo, useEffect } from 'react';

interface SparePart {
  id: string;
  name: string;
  code?: string | null;
  qrModelCode?: string | null;
  boardModelCode?: string | null;
  stock?: number;
  location?: string | null;
  model?: string | null;
}

interface PartSearchModalProps {
  spareParts: SparePart[];
}

export default function PartSearchModal({ spareParts }: PartSearchModalProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPart, setSelectedPart] = useState<SparePart | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const getDisplayCode = (part: SparePart) => {
    return part.code || part.qrModelCode || part.boardModelCode || 'NO-CODE';
  };

  const filteredParts = useMemo(() => {
    if (!searchQuery.trim()) return spareParts;
    const q = searchQuery.toLowerCase();
    return spareParts.filter((p) => {
      const code = (p.code || '').toLowerCase();
      const qr = (p.qrModelCode || '').toLowerCase();
      const board = (p.boardModelCode || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      const model = (p.model || '').toLowerCase();
      return (
        code.includes(q) ||
        qr.includes(q) ||
        board.includes(q) ||
        name.includes(q) ||
        model.includes(q)
      );
    });
  }, [spareParts, searchQuery]);

  if (!isMounted) {
    return (
      <div className="w-full px-4 py-3.5 border border-gray-300 rounded-xl bg-white text-sm text-gray-500">
        🔍 คลิกเพื่อค้นหาและเลือกอะไหล่...
      </div>
    );
  }

  return (
    <div className="relative">
      {/* ปุ่มกดเปิด Modal */}
      <div
        onClick={() => setIsOpen(true)}
        className="w-full px-4 py-3.5 border border-gray-300 rounded-xl bg-white cursor-pointer flex items-center justify-between text-sm font-medium hover:border-amber-500 transition shadow-2xs text-gray-900"
      >
        <span className="truncate pr-2">
          {selectedPart
            ? `${selectedPart.name} (${getDisplayCode(selectedPart)}) - คงเหลือ: ${selectedPart.stock ?? 0}`
            : '🔍 คลิกเพื่อค้นหาและเลือกอะไหล่...'}
        </span>
        <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {selectedPart && (
        <input type="hidden" name="sparePartId" value={selectedPart.id} />
      )}

      {/* Modal Popup */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Header Modal */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 text-amber-600 font-bold text-base sm:text-lg">
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>ค้นหาและเลือกอะไหล่</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 transition cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Search Input Box */}
            <div className="p-4 border-b border-gray-100 bg-white">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="พิมพ์รหัสรุ่นบอร์ด หรือชื่อบอร์ดอะไหล่..."
                  autoFocus
                  className="w-full pl-11 pr-4 py-3 border border-amber-400 rounded-2xl bg-white focus:ring-2 focus:ring-amber-500 outline-none text-sm text-gray-900 shadow-2xs font-medium"
                />
              </div>
            </div>

            {/* List of Spare Parts */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1 bg-white">
              {filteredParts.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm">
                  ไม่พบรายการอะไหล่ที่ค้นหา
                </div>
              ) : (
                filteredParts.map((part) => {
                  const displayCode = getDisplayCode(part);
                  return (
                    <div
                      key={part.id}
                      onClick={() => {
                        setSelectedPart(part);
                        setIsOpen(false);
                      }}
                      className="p-3.5 border border-gray-200 hover:border-amber-500 hover:bg-amber-50/20 rounded-2xl cursor-pointer transition shadow-2xs flex items-center justify-between bg-white gap-3"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold shrink-0">
                            {displayCode}
                          </span>
                          <span className="font-bold text-gray-900 text-sm truncate">
                            {part.name}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 flex items-center gap-1.5 flex-wrap font-medium">
                          <span>รุ่นเครื่อง: <strong className="text-gray-900">{part.model || '-'}</strong></span>
                          <span className="text-gray-400">•</span>
                          <span>ตำแหน่ง: <strong className="text-gray-900">{part.location || '-'}</strong></span>
                        </div>
                      </div>

                      <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold shrink-0">
                        คงเหลือ: {part.stock ?? 0}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}