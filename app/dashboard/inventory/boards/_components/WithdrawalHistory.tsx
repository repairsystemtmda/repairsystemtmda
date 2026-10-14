'use client';

import React, { useState, useMemo } from 'react';
import { WithdrawnPart } from '@/types/inventory';

export interface HistoryRecord extends WithdrawnPart {
  type: 'WITHDRAW' | 'RESTOCK';
  jobNo?: string | null;
  customerName?: string | null;
  recordedBy?: string | null;
}

interface WithdrawalHistoryProps {
  records?: HistoryRecord[];
}

export default function WithdrawalHistory({ records = [] }: WithdrawalHistoryProps) {
  const [filterType, setFilterType] = useState<'ALL' | 'WITHDRAW' | 'RESTOCK'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      // กรองประเภท
      if (filterType !== 'ALL' && item.type !== filterType) return false;

      // กรองคำค้นหา
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (item.sparePartName && item.sparePartName.toLowerCase().includes(q)) ||
        (item.sparePartCode && item.sparePartCode.toLowerCase().includes(q)) ||
        (item.customerName && item.customerName.toLowerCase().includes(q)) ||
        (item.jobNo && item.jobNo.toLowerCase().includes(q))
      );
    });
  }, [records, filterType, searchQuery]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">ประวัติการทำรายการเบิก-คืน</h2>
          <p className="text-xs text-slate-500 mt-0.5">ตรวจสอบประวัติการเบิกและคืนบอร์ดอะไหล่ย้อนหลัง</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* ปุ่มสลับประเภท */}
          <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-medium">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filterType === 'ALL' ? 'bg-white text-slate-800 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ทั้งหมด
            </button>
            <button
              onClick={() => setFilterType('WITHDRAW')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filterType === 'WITHDRAW' ? 'bg-blue-600 text-white shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              การเบิก
            </button>
            <button
              onClick={() => setFilterType('RESTOCK')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filterType === 'RESTOCK' ? 'bg-emerald-600 text-white shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              การคืน
            </button>
          </div>

          {/* ช่องค้นหา */}
          <input
            type="text"
            placeholder="ค้นหาอะไหล่, งานซ่อม..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <th className="py-3 px-4">วัน-เวลา</th>
              <th className="py-3 px-4">ประเภท</th>
              <th className="py-3 px-4">รายการบอร์ดอะไหล่</th>
              <th className="py-3 px-4">งานซ่อม / ลูกค้า</th>
              <th className="py-3 px-4 text-center">จำนวน</th>
              <th className="py-3 px-4 text-center">รูปภาพ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400">
                  ไม่พบประวัติรายการ
                </td>
              </tr>
            ) : (
              filteredRecords.map((item, idx) => {
                const dateStr = item.createdAt
                  ? new Date(item.createdAt).toLocaleString('th-TH', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })
                  : '-';

                return (
                  <tr key={item.stockLogId || idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono">{dateStr}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          item.type === 'WITHDRAW'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {item.type === 'WITHDRAW' ? 'ตัดเบิก' : 'คืนเข้าคลัง'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-800">{item.sparePartName}</p>
                      <p className="text-[11px] text-slate-400 font-mono">โค้ด: {item.sparePartCode || '-'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-800">{item.customerName || 'เบิกทั่วไป'}</p>
                      {item.jobNo && <p className="text-[11px] text-slate-400 font-mono">Job: {item.jobNo}</p>}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800 text-sm">
                      {item.quantity}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center items-center gap-1">
                        {item.boardImageUrl ? (
                          <a
                            href={item.boardImageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded transition-colors"
                          >
                            บอร์ด
                          </a>
                        ) : null}
                        {item.qrImageUrl ? (
                          <a
                            href={item.qrImageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded transition-colors"
                          >
                            QR
                          </a>
                        ) : null}
                        {!item.boardImageUrl && !item.qrImageUrl && <span className="text-slate-300">-</span>}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}