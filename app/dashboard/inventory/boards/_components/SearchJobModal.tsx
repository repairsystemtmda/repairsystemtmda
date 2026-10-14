'use client';

import React, { useState, useMemo } from 'react';
import { Job } from '@/types/inventory';

interface SearchJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: Job[];
  actionType: 'WITHDRAW' | 'RESTOCK';
  onSelectJob: (job: Job) => void;
}

export default function SearchJobModal({
  isOpen,
  onClose,
  jobs = [],
  actionType,
  onSelectJob,
}: SearchJobModalProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');

  // กรองรายการเครื่องซ่อมตามสถานะจริงและคำค้นหา
  const filteredJobs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return jobs.filter((job: Job) => {
      if (!job) return false;

      const rawStatus = (job.status || '').trim().toUpperCase();
      const customerName = (job.customerName || '').trim().toLowerCase();
      const modelName = (job.model || '').toLowerCase();
      const serialNumber = (job.serialNumber || '').toLowerCase();
      const jobNo = (job.jobNo || '').toLowerCase();

      // 1. เงื่อนไขการกรองตามโหมด (WITHDRAW หรือ RESTOCK)
      if (actionType === 'WITHDRAW') {
        // ตัดงานที่ยกเลิกหรือเสร็จสิ้นไปแล้วออก
        if (
          rawStatus.includes('DELETED') ||
          rawStatus.includes('CANCEL') ||
          rawStatus.includes('COMPLETED') ||
          rawStatus.includes('CLOSED') ||
          rawStatus.includes('SUCCESS') ||
          rawStatus.includes('AVAILABLE')
        ) {
          return false;
        }

        // ต้องเป็นสถานะที่กำลังซ่อมหรือซ่อมบำรุง
        const isRepairing =
          rawStatus.includes('IN_REPAIR') ||
          rawStatus.includes('REPAIR') ||
          rawStatus.includes('MAINTENANCE') ||
          rawStatus.includes('DIAGNOSE') ||
          rawStatus.includes('WAITING') ||
          rawStatus.includes('SENT_TO_DEYE') ||
          rawStatus.includes('กำลังซ่อม') ||
          rawStatus.includes('ซ่อมบำรุง');

        if (!isRepairing) return false;
      } else {
        // โหมด RESTOCK (คืนอะไหล่)
        const isAvailableOrCompleted =
          rawStatus.includes('AVAILABLE') ||
          rawStatus.includes('COMPLETED') ||
          rawStatus.includes('CLOSED') ||
          rawStatus.includes('SUCCESS') ||
          rawStatus.includes('RETURNED');

        if (!isAvailableOrCompleted) return false;
      }

      // 2. กรองตามคำค้นหา (ถ้ามีพิมพ์ค้นหา)
      if (!query) return true;

      return (
        customerName.includes(query) ||
        modelName.includes(query) ||
        serialNumber.includes(query) ||
        jobNo.includes(query)
      );
    });
  }, [jobs, actionType, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-lg text-slate-800">
              {actionType === 'WITHDRAW' ? 'เลือกงานซ่อม / เครื่องสำรอง' : 'เลือกใบงานเพื่อคืนอะไหล่'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {actionType === 'WITHDRAW'
                ? 'แสดงเฉพาะงานที่กำลังซ่อม หรือเครื่องสำรองที่กำลังซ่อมบำรุง'
                : 'แสดงเฉพาะงานที่เสร็จสิ้น (Completed) หรือเครื่องสำรองพร้อมใช้'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Input ช่องค้นหา */}
        <div className="relative">
          <input
            type="text"
            placeholder="พิมพ์ชื่อลูกค้า, โมเดล, เลข SN หรือ Job No..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            autoFocus
          />
        </div>

        {/* รายการผลลัพธ์ */}
        <div className="max-h-80 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {filteredJobs.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm font-semibold">
              ไม่พบรายการที่ตรงตามเงื่อนไขสถานะระบบ
            </div>
          ) : (
            filteredJobs.map((job: Job) => {
              return (
                <div
                  key={job.id}
                  onClick={() => {
                    onSelectJob(job);
                    onClose();
                  }}
                  className="p-3.5 border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 cursor-pointer transition-all flex justify-between items-center group"
                >
                  <div className="space-y-1">
                    <p className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">
                      {job.customerName || 'ไม่ระบุชื่อลูกค้า'}
                    </p>
                    <p className="text-xs text-slate-500">
                      รุ่น: <span className="font-medium text-slate-700">{job.model || '-'}</span> | SN:{' '}
                      <span className="font-medium text-slate-700">{job.serialNumber || '-'}</span>
                    </p>
                    {job.jobNo && (
                      <span className="inline-block text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        Job: {job.jobNo}
                      </span>
                    )}
                  </div>
                  {/* แสดงป้ายสถานะตรงตามค่าจริงในฐานข้อมูล */}
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 shrink-0">
                    {job.status || 'กำลังดำเนินการ'}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}