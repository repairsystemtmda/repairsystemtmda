'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, RotateCcw, Search, CheckCircle2, Building2, Wrench, Loader2 } from 'lucide-react';

interface SparePart {
  id: string;
  code: string | null;
  boardModelCode: string | null;
  model: string | null;
  name: string;
  stock: number;
  location?: string | null;
}

interface Job {
  id: string;
  jobNo: string;
  customerName: string | null;
  model: string | null;
  serialNumber: string | null;
  status: string | null;
  withdrawnParts?: {
    stockLogId: string;
    sparePartId: string;
    sparePartName: string;
    sparePartCode: string | null;
    quantity: number;
  }[];
}

interface JobRestockClientProps {
  spareParts?: SparePart[];
  jobs?: Job[];
  actionHandler: (formData: FormData) => Promise<void>;
}

export default function JobRestockClient({ spareParts = [], jobs = [], actionHandler }: JobRestockClientProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [purposeType, setPurposeType] = useState<'JOB' | 'GENERAL'>('JOB');

  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [isOpenJobModal, setIsOpenJobModal] = useState(false);

  const [partSearchQuery, setPartSearchQuery] = useState('');
  const [selectedPartId, setSelectedPartId] = useState('');
  const [isOpenPartModal, setIsOpenPartModal] = useState(false);

  const getStatusText = (job: Job) => {
    const statusStr = (job.status || '').toUpperCase().trim();
    const customerName = (job.customerName || '').toLowerCase();
    
    if (customerName.includes('ซ่อมบำรุง') || statusStr.includes('BACKUP') || statusStr.includes('AVAILABLE')) {
      return 'พร้อมใช้งาน';
    }

    return 'ซ่อมเสร็จแล้ว';
  };

  const validJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (!job) return false;
      
      const statusStr = (job.status || '').toUpperCase().trim();
      const customerName = (job.customerName || '').toLowerCase();
      
      const isCompleted = statusStr.includes('COMP') || statusStr.includes('COMPLETED');
      const isAvailable = customerName.includes('ซ่อมบำรุง') || statusStr.includes('BACKUP') || statusStr.includes('AVAILABLE');
      
      if (!isCompleted && !isAvailable) {
        return false;
      }

      const hasWithdrawnParts = job.withdrawnParts && job.withdrawnParts.length > 0;
      if (!hasWithdrawnParts) {
        return false;
      }

      return true;
    });
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const query = jobSearchQuery.trim().toLowerCase();
    return validJobs.filter((job) => {
      const customerName = (job.customerName || '').toLowerCase();
      const model = (job.model || '').toLowerCase();
      const serialNumber = (job.serialNumber || '').toLowerCase();
      if (!query) return true;
      return customerName.includes(query) || model.includes(query) || serialNumber.includes(query);
    });
  }, [validJobs, jobSearchQuery]);

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  const availableParts = useMemo(() => {
    if (purposeType === 'JOB' && selectedJobId) {
      const targetJob = jobs.find(j => j.id === selectedJobId);
      if (targetJob && targetJob.withdrawnParts && targetJob.withdrawnParts.length > 0) {
        return targetJob.withdrawnParts.map(wp => {
          const matchedPart = spareParts.find(p => p.id === wp.sparePartId);
          return {
            id: wp.sparePartId,
            code: wp.sparePartCode,
            boardModelCode: matchedPart?.boardModelCode || null,
            model: matchedPart?.model || null,
            name: wp.sparePartName,
            stock: wp.quantity,
            location: matchedPart?.location || null,
            isWithdrawnView: true
          };
        });
      }
      return [];
    }
    return spareParts;
  }, [purposeType, selectedJobId, jobs, spareParts]);

  const filteredParts = useMemo(() => {
    const query = partSearchQuery.trim().toLowerCase();
    return availableParts.filter((part) => {
      const code = (part.code || part.boardModelCode || '').toLowerCase();
      const name = (part.name || '').toLowerCase();
      const model = (part.model || '').toLowerCase();
      if (!query) return true;
      return code.includes(query) || name.includes(query) || model.includes(query);
    });
  }, [availableParts, partSearchQuery]);

  const selectedPart = useMemo(() => {
    if (!selectedPartId) return undefined;
    if (purposeType === 'JOB') {
      const targetJob = jobs.find(j => j.id === selectedJobId);
      const wp = targetJob?.withdrawnParts?.find(p => p.sparePartId === selectedPartId);
      if (wp) {
        const matchedPart = spareParts.find(p => p.id === selectedPartId);
        return {
          id: wp.sparePartId,
          code: wp.sparePartCode,
          boardModelCode: matchedPart?.boardModelCode || null,
          model: matchedPart?.model || null,
          name: wp.sparePartName,
          stock: wp.quantity,
          location: matchedPart?.location || null
        };
      }
    }
    return spareParts.find((p) => p.id === selectedPartId);
  }, [purposeType, selectedJobId, selectedPartId, jobs, spareParts]);

  const currentWithdrawnInfo = useMemo(() => {
    if (purposeType === 'JOB' && selectedJobId && selectedPartId) {
      const targetJob = jobs.find(j => j.id === selectedJobId);
      const matchPart = targetJob?.withdrawnParts?.find(p => p.sparePartId === selectedPartId);
      return {
        stockLogId: matchPart?.stockLogId || '',
        maxQty: matchPart?.quantity || 999999
      };
    }
    return { stockLogId: '', maxQty: 999999 };
  }, [purposeType, selectedJobId, selectedPartId, jobs]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (purposeType === 'JOB' && !selectedJobId) {
      setErrorMsg('กรุณาเลือกเครื่องซ่อมที่ต้องการคืนอะไหล่');
      return;
    }
    if (!selectedPartId) {
      setErrorMsg('กรุณาเลือกบอร์ดอะไหล่ที่ต้องการคืนเข้าคลัง');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const formData = new FormData(event.currentTarget);
      formData.set('sparePartId', selectedPartId);
      formData.set('actionType', 'RESTOCK');
      formData.set('purposeType', purposeType);
      
      if (purposeType === 'JOB') {
        formData.set('jobId', selectedJobId);
        if (currentWithdrawnInfo.stockLogId) {
          formData.set('stockLogId', currentWithdrawnInfo.stockLogId);
        }
      }

      await actionHandler(formData);
    } catch (err: any) {
      if (err.message?.includes('NEXT_REDIRECT') || err.digest?.includes('NEXT_REDIRECT')) {
        return;
      }

      console.error(err);
      setErrorMsg(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      setLoading(false);
    }
  }

  return (
    <div className="p-3 sm:p-6 max-w-3xl mx-auto space-y-4 sm:space-y-6 pb-24">
      {/* ส่วนหัว และปุ่มย้อนกลับ */}
      <div className="flex items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href="/dashboard/inventory/boards"
            className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-700 transition shadow-xs flex-shrink-0"
            title="ย้อนกลับ"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 font-bold" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-2xl font-black text-gray-900 flex items-center gap-1.5 truncate">
              <RotateCcw className="w-4 h-4 sm:w-7 sm:h-7 text-emerald-600 flex-shrink-0" /> 
              <span className="truncate">คืนอะไหล่เข้าคลัง</span>
            </h1>
            <p className="text-[11px] sm:text-sm font-bold text-gray-500 truncate">บันทึกคืนบอร์ดอะไหล่กลับเข้าคลังสต็อก</p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs">
          {errorMsg}
        </div>
      )}

      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200">
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          
          <div>
            <label className="block text-xs sm:text-sm font-black text-gray-800 tracking-wide mb-2">
              วัตถุประสงค์ / ปลายทางในการทำรายการ <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setPurposeType('JOB');
                  setSelectedJobId('');
                  setSelectedPartId('');
                  setErrorMsg('');
                }}
                className={`py-2.5 px-3 rounded-xl text-[11px] sm:text-sm font-black transition flex items-center justify-center gap-1.5 border shadow-xs ${
                  purposeType === 'JOB'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Wrench className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">ผูกกับเครื่องซ่อม</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPurposeType('GENERAL');
                  setSelectedJobId('');
                  setSelectedPartId('');
                  setErrorMsg('');
                }}
                className={`py-2.5 px-3 rounded-xl text-[11px] sm:text-sm font-black transition flex items-center justify-center gap-1.5 border shadow-xs ${
                  purposeType === 'GENERAL'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">คืนจากสาขา / ทั่วไป</span>
              </button>
            </div>
          </div>

          {purposeType === 'JOB' && (
            <div>
              <label className="block text-xs sm:text-sm font-black text-gray-800 tracking-wide mb-1.5 sm:mb-2">
                เลือกเครื่องซ่อม <span className="text-red-500">*</span>
              </label>
              <div 
                onClick={() => { setErrorMsg(''); setIsOpenJobModal(true); }}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-900 cursor-pointer flex items-center justify-between hover:border-emerald-400 transition shadow-xs"
              >
                <span className={selectedJob ? 'text-gray-900 font-extrabold truncate pr-2' : 'text-gray-400 font-bold truncate pr-2'}>
                  {selectedJob ? `${selectedJob.customerName || 'ไม่ระบุชื่อ'} (${selectedJob.model || '-'}) [SN: ${selectedJob.serialNumber || '-'}]` : '-- คลิกเลือกเครื่องซ่อมที่เคยเบิกอะไหล่ --'}
                </span>
                <Search className="w-4 h-4 text-gray-500 font-bold shrink-0" />
              </div>

              {isOpenJobModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm">
                  <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-gray-200 p-4 sm:p-6 space-y-3.5 max-h-[90vh] flex flex-col">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-2.5">
                      <h3 className="text-sm sm:text-lg font-black text-gray-900 truncate">ค้นหาเครื่องซ่อม (ชื่อ, โมเดล, SN)</h3>
                      <button
                        type="button"
                        onClick={() => setIsOpenJobModal(false)}
                        className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition flex-shrink-0"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="พิมพ์ชื่อลูกค้า, โมเดล หรือเลข SN..."
                        value={jobSearchQuery}
                        onChange={(e) => setJobSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-emerald-400 focus:ring-2 focus:ring-emerald-100 rounded-xl text-xs sm:text-sm outline-none font-bold text-gray-900 transition shadow-xs"
                        autoFocus
                      />
                    </div>

                    <div className="overflow-y-auto space-y-2.5 pr-1 flex-1">
                      {filteredJobs.map((job) => {
                        const statusStr = (job.status || '').toUpperCase();
                        const customerName = (job.customerName || '').toLowerCase();
                        const isBackup = customerName.includes('ซ่อมบำรุง') || statusStr.includes('BACKUP') || statusStr.includes('AVAILABLE');
                        
                        return (
                          <div
                            key={job.id}
                            onClick={() => {
                              setSelectedJobId(job.id);
                              setSelectedPartId('');
                              setIsOpenJobModal(false);
                              setJobSearchQuery('');
                            }}
                            className="p-3 rounded-xl text-xs sm:text-sm flex justify-between items-center gap-3 transition border border-gray-200 cursor-pointer hover:bg-emerald-50/50 hover:border-emerald-300 bg-white shadow-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-black text-gray-900 text-xs sm:text-base truncate">{job.customerName || 'ไม่ระบุชื่อ'}</div>
                              <div className="text-[11px] sm:text-xs text-gray-500 font-bold mt-0.5 truncate">
                                รุ่น: <span className="text-gray-800">{job.model || '-'}</span> <span className="mx-1 text-gray-300">•</span> SN: <span className="text-blue-600 font-extrabold">{job.serialNumber || '-'}</span>
                              </div>
                            </div>
                            <span className={`text-[10px] sm:text-xs font-black px-2.5 py-1 rounded-full border shrink-0 ${
                              isBackup 
                                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                : 'bg-blue-50 text-blue-600 border-blue-100'
                            }`}>
                              {getStatusText(job)}
                            </span>
                          </div>
                        );
                      })}
                      {filteredJobs.length === 0 && (
                        <div className="text-center py-6 text-gray-400 font-bold text-xs sm:text-sm">
                          ไม่พบรายการเครื่องซ่อมที่ตรงกับการค้นหา
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs sm:text-sm font-black text-gray-800 tracking-wide mb-1.5 sm:mb-2">
              เลือกบอร์ดอะไหล่ที่ต้องการคืนเข้าคลัง <span className="text-red-500">*</span>
            </label>
            <div 
              onClick={() => {
                if (purposeType === 'JOB' && !selectedJobId) {
                  setErrorMsg('กรุณาเลือกเครื่องซ่อมก่อนเลือกบอร์ดอะไหล่');
                  return;
                }
                setErrorMsg('');
                setIsOpenPartModal(true);
              }}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-900 cursor-pointer flex items-center justify-between hover:border-emerald-400 transition shadow-xs"
            >
              <span className={selectedPart ? 'text-gray-900 font-extrabold truncate pr-2' : 'text-gray-400 font-bold truncate pr-2'}>
                {selectedPart ? `[${selectedPart.code || selectedPart.boardModelCode || '-'}] ${selectedPart.name}` : '-- คลิกเลือกบอร์ดอะไหล่ --'}
              </span>
              <Search className="w-4 h-4 text-gray-500 font-bold shrink-0" />
            </div>

            {isOpenPartModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm">
                <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-gray-200 p-4 sm:p-6 space-y-3.5 max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2.5">
                    <h3 className="text-sm sm:text-lg font-black text-amber-600 truncate">
                      {purposeType === 'JOB' ? 'เลือกอะไหล่ที่เคยเบิกไปของเครื่องนี้' : 'ค้นหาและเลือกอะไหล่'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsOpenPartModal(false)}
                      className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                    <input
                      type="text"
                      placeholder="พิมพ์รหัสรุ่นบอร์ด หรือชื่อบอร์ดอะไหล่..."
                      value={partSearchQuery}
                      onChange={(e) => setPartSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-amber-400 focus:ring-2 focus:ring-amber-100 rounded-xl text-xs sm:text-sm outline-none font-bold text-gray-900 transition shadow-xs"
                      autoFocus
                    />
                  </div>

                  <div className="overflow-y-auto space-y-2.5 pr-1 flex-1">
                    {filteredParts.map((part) => (
                      <div
                        key={part.id}
                        onClick={() => {
                          setSelectedPartId(part.id);
                          setIsOpenPartModal(false);
                          setPartSearchQuery('');
                        }}
                        className="p-3 rounded-xl text-xs sm:text-sm flex justify-between items-center gap-3 transition border border-gray-200 cursor-pointer hover:bg-amber-50/50 hover:border-amber-300 bg-white shadow-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                              {part.code || part.boardModelCode || '-'}
                            </span>
                            <span className="font-black text-gray-900 text-xs sm:text-base truncate">{part.name}</span>
                          </div>
                          <div className="text-[11px] sm:text-xs text-gray-500 font-bold mt-1 truncate">
                            รุ่นเครื่อง: <span className="text-gray-800">{part.model || '-'}</span> {part.location ? `• ตำแหน่ง: ${part.location}` : ''}
                          </div>
                        </div>
                        <span className={`text-[10px] sm:text-xs font-black px-2.5 py-1 rounded-full border shrink-0 ${
                          purposeType === 'JOB' 
                            ? 'bg-blue-50 text-blue-700 border-blue-200' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {purposeType === 'JOB' ? `เบิกไป: ${part.stock}` : `คงเหลือ: ${part.stock}`}
                        </span>
                      </div>
                    ))}
                    {filteredParts.length === 0 && (
                      <div className="text-center py-6 text-gray-400 font-bold text-xs sm:text-sm">
                        {purposeType === 'JOB' ? 'เครื่องซ่อมนี้ยังไม่มีประวัติการเบิกอะไหล่' : 'ไม่พบรายการอะไหล่ที่ค้นหา'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-black text-gray-800 tracking-wide mb-1.5 sm:mb-2">
              จำนวน <span className="text-red-500">*</span>
              {purposeType === 'JOB' && selectedPartId && (
                <span className="text-[11px] text-blue-600 ml-1.5 font-bold">(สูงสุดที่เบิกไป: {currentWithdrawnInfo.maxQty} ชิ้น)</span>
              )}
            </label>
            <input
              type="number"
              name="quantity"
              defaultValue={1}
              min={1}
              max={currentWithdrawnInfo.maxQty}
              required
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-black text-gray-900 outline-none shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-black text-gray-800 tracking-wide mb-1.5 sm:mb-2">หมายเหตุเพิ่มเติม</label>
            <textarea
              name="note"
              rows={2}
              placeholder="รายละเอียดเพิ่มเติม หรือสภาพบอร์ดในการคืน..."
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-900 outline-none shadow-xs"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-gray-100">
            <Link
              href="/dashboard/inventory/boards"
              className="w-full sm:w-auto px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-extrabold text-xs sm:text-sm rounded-xl transition text-center"
            >
              ยกเลิก
            </Link>
            <button
              type="submit"
              disabled={loading}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm text-white transition shadow-sm flex items-center justify-center gap-1.5 ${
                loading
                  ? 'bg-emerald-400 cursor-not-allowed opacity-80'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 cursor-pointer'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 font-bold" />
                  <span>ยืนยันคืนเข้าคลัง</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}