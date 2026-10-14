'use client';

import React, { useState, useMemo } from 'react';
import { Job, SparePart, WithdrawnPart } from '@/types/inventory';

interface SearchPartModalProps {
  isOpen: boolean;
  onClose: () => void;
  spareParts: SparePart[];
  selectedJob?: Job | null;
  actionType: 'WITHDRAW' | 'RESTOCK';
  onSelectPart: (part: SparePart) => void;
}

export default function SearchPartModal({
  isOpen,
  onClose,
  spareParts = [],
  selectedJob,
  actionType,
  onSelectPart,
}: SearchPartModalProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');

  // กรองอะไหล่กรณี RESTOCK (แสดงเฉพาะบอร์ดที่เคยถูกเบิกไปใน Job นี้)
  const availableParts = useMemo(() => {
    if (actionType === 'RESTOCK' && selectedJob?.withdrawnParts && selectedJob.withdrawnParts.length > 0) {
      const withdrawnPartIds = selectedJob.withdrawnParts.map((p: WithdrawnPart) => p.sparePartId);
      return spareParts.filter((part: SparePart) => withdrawnPartIds.includes(part.id));
    }
    return spareParts;
  }, [actionType, selectedJob, spareParts]);

  // ค้นหาตามคำค้นหา
  const filteredParts = useMemo(() => {
    if (!searchQuery) return availableParts;
    const q = searchQuery.toLowerCase();
    return availableParts.filter(
      (part: SparePart) =>
        (part.name && part.name.toLowerCase().includes(q)) ||
        (part.code && part.code.toLowerCase().includes(q)) ||
        (part.boardModelCode && part.boardModelCode.toLowerCase().includes(q)) ||
        (part.location && part.location.toLowerCase().includes(q))
    );
  }, [availableParts, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-lg text-slate-800">
              {actionType === 'WITHDRAW' ? 'เลือกบอร์ดอะไหล่' : 'เลือกบอร์ดที่ต้องการคืน'}
            </h3>
            {actionType === 'RESTOCK' && selectedJob && (
              <p className="text-xs text-emerald-600 mt-0.5">
                แสดงรายการบอร์ดที่เคยเบิกไปในงานของคุณ {selectedJob.customerName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* ช่องค้นหา */}
        <input
          type="text"
          placeholder="ค้นหาด้วยชื่อบอร์ด, รหัสโค้ด, รุ่น หรือตำแหน่งจัดเก็บ..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          autoFocus
        />

        {/* รายการอะไหล่ */}
        <div className="max-h-80 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {filteredParts.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              {actionType === 'RESTOCK' && availableParts.length === 0
                ? 'ไม่พบประวัติการเบิกบอร์ดในใบงานนี้'
                : 'ไม่พบบอร์ดอะไหล่ที่ค้นหา'}
            </div>
          ) : (
            filteredParts.map((part: SparePart) => (
              <div
                key={part.id}
                onClick={() => {
                  onSelectPart(part);
                  onClose();
                }}
                className="p-3.5 border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 cursor-pointer transition-all flex justify-between items-center group"
              >
                <div className="space-y-1">
                  <p className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">
                    {part.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    โค้ด: <span className="font-mono text-slate-700">{part.code || '-'}</span> | ตำแหน่ง:{' '}
                    <span className="font-medium text-slate-700">{part.location || '-'}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-block text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                    คงเหลือ: {part.stock}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}