'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BarChart3, CheckCircle2, Clock, FileText, Layers, ShieldAlert, Wrench, UserCheck, AlertTriangle } from 'lucide-react';

interface DashboardData {
  summary: {
    totalJobs: number;
    completedCount: number;
    waitingCount: number;
    thisMonthCompletedCount: number;
  };
  brandStats: {
    [key: string]: { completed: number; waiting: number; total: number };
  };
  categoryStats: {
    [key: string]: number;
  };
  topSpareParts: Array<{
    name: string;
    boardModelCode: string;
    count: number;
  }>;
  technicianStats: {
    [key: string]: { completed: number; total: number };
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // สิทธิ์ Admin สำหรับดู KPI ช่าง
  const [isAdmin, setIsAdmin] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/analytics');
      const result = await res.json();
      if (res.ok) {
        setData(result);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 font-medium animate-pulse">กำลังโหลดข้อมูลหน้าแรกแดชบอร์ด...</div>
      </div>
    );
  }

  const summary = data?.summary || { totalJobs: 0, completedCount: 0, waitingCount: 0, thisMonthCompletedCount: 0 };
  const brandStats = data?.brandStats || {};
  const categoryStats = data?.categoryStats || {};
  const topSpareParts = data?.topSpareParts || [];
  const technicianStats = data?.technicianStats || {};

  const maxTechTotal = Math.max(...Object.values(technicianStats).map(t => t.total), 1);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* หัวข้อหน้าแรก */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-indigo-600" /> แดชบอร์ดภาพรวมระบบ
          </h1>
          <p className="text-sm text-gray-500">สรุปสถานะงานซ่อม สถิติตามแบรนด์ บอร์ดที่ถูกเบิกบ่อย และ KPI ช่างแบบเรียลไทม์</p>
        </div>

        {/* การ์ดสรุปตัวเลขด้านบน */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">งานซ่อมทั้งหมด</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-1">{summary.totalJobs}</h3>
              <p className="text-xs text-gray-500 mt-1">รายการในระบบ</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">ซ่อมเสร็จสิ้นแล้ว</p>
              <h3 className="text-3xl font-bold text-emerald-600 mt-1">{summary.completedCount}</h3>
              <p className="text-xs text-gray-500 mt-1">พร้อมส่งคืนลูกค้า</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">รอดำเนินการ</p>
              <h3 className="text-3xl font-bold text-amber-600 mt-1">{summary.waitingCount}</h3>
              <p className="text-xs text-gray-500 mt-1">อยู่ในคิวซ่อม</p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">ซ่อมเสร็จเดือนนี้</p>
              <h3 className="text-3xl font-bold text-indigo-600 mt-1">{summary.thisMonthCompletedCount}</h3>
              <p className="text-xs text-gray-500 mt-1">เดือนปัจจุบัน</p>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <BarChart3 className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* ตารางสถิติแบรนด์ และ หมวดหมู่ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-gray-900">สถิติแยกตามแบรนด์ (Brand Performance)</h3>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/30 text-[11px] font-semibold text-gray-500 uppercase sticky top-0 bg-white">
                    <th className="py-3 px-6">แบรนด์</th>
                    <th className="py-3 px-4 text-center">ซ่อมเสร็จ</th>
                    <th className="py-3 px-4 text-center">รอซ่อม</th>
                    <th className="py-3 px-6 text-right">รวมทั้งหมด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {Object.keys(brandStats).length > 0 ? (
                    Object.keys(brandStats).map((brandKey) => {
                      const b = brandStats[brandKey];
                      return (
                        <tr key={brandKey} className="hover:bg-gray-50/50 transition">
                          <td className="py-3 px-6 font-semibold text-gray-800">{brandKey}</td>
                          <td className="py-3 px-4 text-center font-medium text-emerald-600">{b.completed}</td>
                          <td className="py-3 px-4 text-center font-medium text-amber-600">{b.waiting}</td>
                          <td className="py-3 px-6 text-right font-bold text-gray-900">{b.total}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-gray-400">ไม่มีข้อมูลแบรนด์</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-gray-900">สถิติแยกตามหมวดหมู่</h3>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/30 text-[11px] font-semibold text-gray-500 uppercase sticky top-0 bg-white">
                    <th className="py-3 px-6">หมวดหมู่</th>
                    <th className="py-3 px-6 text-right">จำนวน (เครื่อง)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {Object.keys(categoryStats).length > 0 ? (
                    Object.keys(categoryStats).map((catKey) => {
                      const count = categoryStats[catKey];
                      return (
                        <tr key={catKey} className="hover:bg-gray-50/50 transition">
                          <td className="py-3 px-6 font-semibold text-gray-800">{catKey}</td>
                          <td className="py-3 px-6 text-right font-bold text-gray-900">{count}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={2} className="py-6 text-center text-gray-400">ไม่มีข้อมูลหมวดหมู่</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 1. 5 อันดับบอร์ดหรืออะไหล่ที่ถูกเบิกใช้บ่อยที่สุด */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-gray-900">5 อันดับบอร์ดหรืออะไหล่ที่ถูกเบิกใช้บ่อยที่สุด</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/30 text-[11px] font-semibold text-gray-500 uppercase">
                  <th className="py-3 px-6">อันดับ</th>
                  <th className="py-3 px-6">รหัสรุ่นบอร์ด</th>
                  <th className="py-3 px-6">ชื่อบอร์ด / อะไหล่</th>
                  <th className="py-3 px-6 text-right">จำนวนที่ถูกเบิก (ชิ้น)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {topSpareParts.length > 0 ? (
                  topSpareParts.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50/50 transition">
                      <td className="py-3.5 px-6 font-bold text-gray-500">อันดับ #{index + 1}</td>
                      <td className="py-3.5 px-6 font-mono font-bold text-indigo-600">{item.boardModelCode}</td>
                      <td className="py-3.5 px-6 font-semibold text-gray-800">{item.name}</td>
                      <td className="py-3.5 px-6 text-right font-bold text-gray-900">{item.count} ชิ้น</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400">ยังไม่มีประวัติการเบิกใช้อะไหล่ในระบบ</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. กราฟแท่งแนวตั้ง KPI ช่าง (คำนวณจากผู้เบิกบอร์ด - เฉพาะ Admin) */}
        {isAdmin && (
          <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden p-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">สถิติ KPI ช่างซ่อม (วิเคราะห์จากประวัติการเบิกอะไหล่)</h3>
                  <p className="text-xs text-gray-500">เปรียบเทียบจำนวนงานและชิ้นส่วนที่ช่างแต่ละท่านเบิกไปปฏิบัติงานจริง</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
                มุมมองผู้ดูแลระบบ (Admin)
              </span>
            </div>

            <div className="pt-4">
              {Object.keys(technicianStats).length > 0 ? (
                <div className="flex items-end justify-around gap-4 h-64 border-b border-gray-200 pb-2 px-4">
                  {Object.keys(technicianStats).map((techName) => {
                    const stats = technicianStats[techName];
                    const totalHeightPercent = Math.round((stats.total / maxTechTotal) * 100);
                    const completedHeightPercent = Math.round((stats.completed / maxTechTotal) * 100);

                    return (
                      <div key={techName} className="flex flex-col items-center flex-1 h-full justify-end group">
                        <div className="text-[11px] font-bold text-gray-600 mb-1 opacity-0 group-hover:opacity-100 transition">
                          เบิกสำเร็จ {stats.completed} / ทั้งหมด {stats.total}
                        </div>

                        <div className="w-full max-w-[50px] flex items-end justify-center gap-1 h-full bg-gray-50 rounded-t-lg p-1 border-x border-t border-gray-100">
                          <div 
                            className="w-1/2 bg-indigo-200 rounded-t transition-all duration-500 hover:bg-indigo-300"
                            style={{ height: `${totalHeightPercent}%` }}
                            title={`รายการเบิกทั้งหมด: ${stats.total}`}
                          ></div>
                          <div 
                            className="w-1/2 bg-emerald-500 rounded-t transition-all duration-500 hover:bg-emerald-600"
                            style={{ height: `${completedHeightPercent}%` }}
                            title={`เบิกซ่อมสำเร็จ: ${stats.completed}`}
                          ></div>
                        </div>

                        <span className="text-xs font-semibold text-gray-700 mt-2 truncate max-w-full text-center" title={techName}>
                          {techName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400 text-sm">ยังไม่มีข้อมูลการเบิกอะไหล่ของช่างในระบบ</div>
              )}

              <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-indigo-200 rounded-sm"></div>
                  <span>รายการเบิกอะไหล่ทั้งหมด</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
                  <span>รายการเบิกใช้งานสำเร็จ</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}