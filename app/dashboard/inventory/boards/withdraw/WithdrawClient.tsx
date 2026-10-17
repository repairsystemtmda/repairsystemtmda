'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Layers, Package, Search, X, Upload, Image as ImageIcon, AlertTriangle, Loader2 } from 'lucide-react';

interface SparePart {
  id: string;
  code: string | null;
  boardModelCode: string | null;
  model: string | null;
  partNo?: string | null;
  sku?: string | null;
  name: string;
  location: string | null;
  stock: number;
}

interface Job {
  id: string;
  jobNo: string;
  customerName: string | null;
  model: string | null;
  serialNumber: string | null;
  serialNumberLast4?: string | null;
  status: string | null;
  withdrawnParts?: {
    stockLogId: string;
    sparePartId: string;
    sparePartName: string;
    sparePartCode: string | null;
    quantity: number;
  }[];
}

interface WithdrawClientProps {
  spareParts?: SparePart[];
  jobs?: Job[];
  actionHandler: (formData: FormData) => Promise<void>;
}

export default function WithdrawClient({ spareParts = [], jobs = [], actionHandler }: WithdrawClientProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // State สำหรับจัดการ Popup เตือนรูปแนวตั้ง
  const [warningModalMsg, setWarningModalMsg] = useState<string | null>(null);
  
  const actionType = 'WITHDRAW'; 
  const [purposeType, setPurposeType] = useState<'JOB' | 'GENERAL'>('JOB');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartId, setSelectedPartId] = useState('');
  const [isOpenModal, setIsOpenModal] = useState(false);

  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [isOpenJobModal, setIsOpenJobModal] = useState(false);

  const [boardImagePreview, setBoardImagePreview] = useState<string | null>(null);
  const [qrImagePreview, setQrImagePreview] = useState<string | null>(null);

  const handlePurposeTypeChange = (pType: 'JOB' | 'GENERAL') => {
    setPurposeType(pType);
    setSelectedPartId('');
    setSelectedJobId('');
    setErrorMsg('');
  };

  const filteredParts = useMemo(() => {
    const listToFilter = spareParts;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return listToFilter;

    return listToFilter.filter((part) => {
      const name = (part.name || '').toLowerCase();
      const code = (part.code || '').toLowerCase();
      const boardModelCode = (part.boardModelCode || '').toLowerCase();
      const model = (part.model || '').toLowerCase();
      const partNo = (part.partNo || '').toLowerCase();
      const sku = (part.sku || '').toLowerCase();

      return (
        name.includes(query) ||
        code.includes(query) ||
        boardModelCode.includes(query) ||
        model.includes(query) ||
        partNo.includes(query) ||
        sku.includes(query)
      );
    });
  }, [spareParts, searchQuery]);

  const filteredJobs = useMemo(() => {
    const query = jobSearchQuery.trim().toLowerCase();

    return jobs.filter((job) => {
      if (!job) return false;

      const rawStatus = (job.status || '').trim().toUpperCase();
      const customerName = (job.customerName || '').trim().toLowerCase();

      if (
        rawStatus.includes('DELETED') || 
        rawStatus.includes('CANCEL') || 
        rawStatus.includes('CANCELED') ||
        rawStatus.includes('REMOVE') ||
        rawStatus.includes('EXCLUDED') ||
        rawStatus.includes('INACTIVE') ||
        rawStatus === 'AVAILABLE'
      ) {
        return false;
      }

      const isRepairing = 
        rawStatus.includes('IN_REPAIR') || 
        rawStatus.includes('MAINTENANCE') || 
        rawStatus.includes('REPAIR') ||
        rawStatus.includes('BACKUP') ||
        rawStatus.includes('ซ่อมบำรุง') ||
        rawStatus.includes('กำลังซ่อม');

      if (!isRepairing) return false;

      if (!query) return true;

      const model = (job.model || '').toLowerCase();
      const serialNumber = (job.serialNumber || '').toLowerCase();
      const serialNumberLast4 = (job.serialNumberLast4 || '').toLowerCase();

      return (
        customerName.includes(query) ||
        model.includes(query) ||
        serialNumber.includes(query) ||
        serialNumberLast4.includes(query)
      );
    });
  }, [jobs, jobSearchQuery]);

  const selectedPart = spareParts.find((p) => p.id === selectedPartId);
  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'board' | 'qr') => {
    const file = e.target.files?.[0];
    if (file) {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = async () => {
        URL.revokeObjectURL(objectUrl);
        if (img.width <= img.height) {
          const targetName = type === 'board' ? 'รูปที่ 1 (เต็มบอร์ด)' : 'รูปที่ 2 (QR Code / S/N)';
          const msg = `${targetName} ที่คุณเลือกเป็น "แนวตั้งหรือจัตุรัส" กรุณาหมุนโทรศัพท์และถ่ายภาพใน "แนวนอน" เท่านั้นครับ`;
          setWarningModalMsg(msg);
          if (type === 'board') {
            setBoardImagePreview(null);
          } else {
            setQrImagePreview(null);
          }
        } else {
          try {
            setErrorMsg('');
            const compressedBase64 = await resizeImage(file);
            if (type === 'board') {
              setBoardImagePreview(compressedBase64);
            } else {
              setQrImagePreview(compressedBase64);
            }
          } catch (err) {
            console.error('Error compressing image:', err);
            setErrorMsg('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ กรุณาลองใหม่อีกครั้ง');
          }
        }
      };
      img.src = objectUrl;
    }
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (purposeType === 'JOB' && !selectedJobId) {
      setErrorMsg('กรุณาเลือกข้อมูลเครื่อง/ใบงานซ่อม');
      return;
    }
    if (!selectedPartId) {
      setErrorMsg('กรุณาเลือกบอร์ดอะไหล่ที่ต้องการทำรายการ');
      return;
    }

    if (purposeType === 'JOB' && (!boardImagePreview || !qrImagePreview)) {
      setErrorMsg('กรุณาอัปโหลดไฟล์หลักฐานทั้ง 2 ไฟล์ (รูปเต็มบอร์ด และ รูป QR Code)');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const formData = new FormData(event.currentTarget);
      
      const rawQty = formData.get('quantity');
      const parsedQty = parseInt(String(rawQty || '1'), 10);
      if (isNaN(parsedQty) || parsedQty <= 0) {
        throw new Error('จำนวนต้องมากกว่า 0');
      }
      formData.set('quantity', String(parsedQty));

      formData.set('sparePartId', selectedPartId);
      formData.set('actionType', actionType);
      formData.set('purposeType', purposeType);

      if (purposeType === 'JOB' && selectedJobId) {
        formData.set('jobId', selectedJobId);
      } else {
        formData.delete('jobId');
      }

      if (boardImagePreview) {
        formData.set('boardImageBase64', boardImagePreview);
      }
      if (qrImagePreview) {
        formData.set('qrImageBase64', qrImagePreview);
      }

      await actionHandler(formData);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      setLoading(false);
    }
  }

  return (
    <div className="p-3 sm:p-6 max-w-3xl mx-auto space-y-4 sm:space-y-6 pb-24">
      
      {/* Modal แจ้งเตือนเมื่อรูปไม่ใช่แนวนอน */}
      {warningModalMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-gray-100 p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900">ตรวจพบรูปแนวตั้ง!</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{warningModalMsg}</p>
            </div>
            <button
              type="button"
              onClick={() => setWarningModalMsg(null)}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-2xl shadow-md transition cursor-pointer"
            >
              รับทราบ / ถ่ายใหม่
            </button>
          </div>
        </div>
      )}

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
              <Layers className="w-4 h-4 sm:w-7 sm:h-7 text-blue-600 flex-shrink-0" /> 
              <span className="truncate">ตัดเบิกอะไหล่</span>
            </h1>
            <p className="text-[11px] sm:text-sm font-bold text-gray-500 truncate">บันทึกการเบิกใช้อุปกรณ์อะไหล่สำหรับงานซ่อมและส่งสาขา</p>
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
                onClick={() => handlePurposeTypeChange('JOB')}
                className={`py-2.5 px-3 rounded-xl text-[11px] sm:text-sm font-extrabold border transition flex items-center justify-center gap-1.5 ${
                  purposeType === 'JOB'
                    ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs ring-2 ring-blue-500/20'
                    : 'bg-gray-50 border-gray-200 text-gray-800 hover:bg-gray-100'
                }`}
              >
                <span className="truncate">ผูกกับเครื่องซ่อม</span>
              </button>
              <button
                type="button"
                onClick={() => handlePurposeTypeChange('GENERAL')}
                className={`py-2.5 px-3 rounded-xl text-[11px] sm:text-sm font-extrabold border transition flex items-center justify-center gap-1.5 ${
                  purposeType === 'GENERAL'
                    ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs ring-2 ring-blue-500/20'
                    : 'bg-gray-50 border-gray-200 text-gray-800 hover:bg-gray-100'
                }`}
              >
                <span className="truncate">เบิกส่งสาขา / ทั่วไป</span>
              </button>
            </div>
          </div>

          {purposeType === 'JOB' && (
            <div>
              <label className="block text-xs sm:text-sm font-black text-gray-800 tracking-wide mb-1.5 sm:mb-2">
                เลือกเครื่องซ่อม <span className="text-red-500">*</span>
              </label>
              
              <div 
                onClick={() => {
                  setErrorMsg('');
                  setIsOpenJobModal(true);
                }}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-900 cursor-pointer flex items-center justify-between hover:border-blue-400 transition shadow-xs"
              >
                <span className={selectedJob ? 'text-gray-900 font-extrabold truncate pr-2' : 'text-gray-400 font-bold truncate pr-2'}>
                  {selectedJob ? `${selectedJob.customerName || 'ไม่ระบุชื่อ'} ${selectedJob.model ? `(${selectedJob.model})` : ''} ${selectedJob.serialNumber ? `[SN: ${selectedJob.serialNumber}]` : ''}` : '-- คลิกเลือกเครื่องซ่อม --'}
                </span>
                <Search className="w-4 h-4 text-gray-500 font-bold shrink-0" />
              </div>

              {isOpenJobModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm">
                  <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-gray-200 p-4 sm:p-6 space-y-3.5 max-h-[90vh] flex flex-col">
                    <div className="flex items-center justify-between border-b pb-2.5">
                      <h3 className="text-sm sm:text-lg font-black text-gray-900 truncate">
                        ค้นหาเครื่องซ่อม (ชื่อ, โมเดล, SN)
                      </h3>
                      <button
                        type="button"
                        onClick={() => setIsOpenJobModal(false)}
                        className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition flex-shrink-0"
                      >
                        <X className="w-4 h-4 font-bold" />
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="พิมพ์ชื่อลูกค้า, โมเดล หรือเลข SN 4 ตัวท้าย..."
                        value={jobSearchQuery}
                        onChange={(e) => setJobSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm outline-none focus:border-blue-500 font-bold text-gray-900 shadow-inner"
                        autoFocus
                      />
                    </div>

                    <div className="overflow-y-auto space-y-2.5 pr-1 flex-1">
                      {filteredJobs.length === 0 ? (
                        <div className="p-6 text-center text-xs sm:text-sm font-bold text-gray-500">
                          ไม่พบรายการเครื่องซ่อมที่ตรงกับเงื่อนไข
                        </div>
                      ) : (
                        filteredJobs.map((job) => {
                          const customerName = (job.customerName || '').trim();
                          const rawStatus = (job.status || '').trim().toUpperCase();

                          let statusText = 'กำลังซ่อม';
                          let statusClass = 'bg-blue-50 text-blue-700 border-blue-200';

                          if (rawStatus.includes('BACKUP') || customerName.startsWith('[')) {
                            statusText = 'กำลังซ่อมบำรุง';
                            statusClass = 'bg-amber-50 text-amber-800 border-amber-200';
                          }

                          return (
                            <div
                              key={job.id}
                              onClick={() => {
                                setSelectedJobId(job.id);
                                setIsOpenJobModal(false);
                                setJobSearchQuery('');
                              }}
                              className="p-3 rounded-xl text-xs sm:text-sm flex justify-between items-center gap-3 transition border cursor-pointer hover:bg-blue-50/50 hover:border-blue-300 text-gray-900 border-gray-200 bg-white shadow-xs"
                            >
                              <div className="min-w-0">
                                <div className="font-black text-xs sm:text-base text-gray-900 truncate">
                                  {customerName || 'ไม่ระบุชื่อลูกค้า'}
                                </div>
                                <div className="text-[11px] sm:text-xs font-bold text-gray-500 flex items-center gap-1.5 mt-0.5 truncate">
                                  <span>รุ่น: <strong className="text-gray-800 font-black">{job.model || '-'}</strong></span>
                                  <span>•</span>
                                  <span>SN: <strong className="text-blue-600 font-black">{job.serialNumber || '-'}</strong></span>
                                </div>
                              </div>

                              <span className={`text-[10px] sm:text-xs font-extrabold px-2.5 py-1 rounded-full shrink-0 border ${statusClass}`}>
                                {statusText}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs sm:text-sm font-black text-gray-800 tracking-wide mb-1.5 sm:mb-2">
              เลือกบอร์ดอะไหล่ที่ต้องการตัดเบิก <span className="text-red-500">*</span>
            </label>
            
            <div 
              onClick={() => {
                setErrorMsg('');
                setIsOpenModal(true);
              }}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-900 cursor-pointer flex items-center justify-between hover:border-amber-400 transition shadow-xs"
            >
              <span className={selectedPart ? 'text-gray-900 font-extrabold truncate pr-2' : 'text-gray-400 font-bold truncate pr-2'}>
                {selectedPart ? `[${selectedPart.code || selectedPart.boardModelCode || selectedPart.model || '-'}] ${selectedPart.name} (สต็อก: ${selectedPart.stock})` : '-- คลิกเลือกบอร์ดอะไหล่ --'}
              </span>
              <Search className="w-4 h-4 text-gray-500 font-bold shrink-0" />
            </div>

            {isOpenModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm">
                <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-gray-200 p-4 sm:p-6 space-y-3.5 max-h-[90vh] flex flex-col">
                  
                  {/* หัวข้อ Modal ค้นหา */}
                  <div className="flex items-center justify-between border-b pb-2.5">
                    <h3 className="text-sm sm:text-lg font-black text-gray-900 flex items-center gap-1.5 truncate">
                      <Search className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 shrink-0" /> ค้นหาและเลือกอะไหล่
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsOpenModal(false)}
                      className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition flex-shrink-0"
                    >
                      <X className="w-4 h-4 font-bold" />
                    </button>
                  </div>

                  {/* ช่องพิมพ์ค้นหา */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="พิมพ์รหัสรุ่นบอร์ด, ชื่อบอร์ดอะไหล่ หรือ รุ่นเครื่อง..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-amber-400 rounded-xl text-xs sm:text-sm outline-none focus:border-amber-600 font-bold text-gray-900 shadow-sm"
                      autoFocus
                    />
                  </div>

                  {/* รายการอะไหล่ที่ค้นหา */}
                  <div className="overflow-y-auto space-y-3 pr-1 flex-1 bg-gray-50/50 p-1">
                    {filteredParts.length === 0 ? (
                      <div className="py-12 text-center text-xs text-gray-400 font-bold">
                        ไม่พบรายการอะไหล่ที่คุณค้นหา
                      </div>
                    ) : (
                      filteredParts.map((part) => {
                        const displayCode = part.code || part.boardModelCode || part.model || '';

                        return (
                          <div
                            key={part.id}
                            onClick={() => {
                              setSelectedPartId(part.id);
                              setIsOpenModal(false);
                              setSearchQuery('');
                            }}
                            className="p-4 bg-white border-2 border-gray-200 hover:border-amber-500 rounded-2xl shadow-sm cursor-pointer transition flex items-center justify-between group"
                          >
                            <div className="space-y-1 min-w-0 pr-2">
                              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                {displayCode && (
                                  <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg font-bold text-xs shrink-0">
                                    {displayCode}
                                  </span>
                                )}
                                <span className="font-extrabold text-gray-900 text-sm group-hover:text-amber-600 transition truncate">
                                  {part.name}
                                </span>
                              </div>
                              
                              <div className="text-xs text-gray-500 font-semibold flex items-center space-x-3 flex-wrap">
                                {part.model && (
                                  <span>รุ่นเครื่อง: <strong className="text-gray-700">{part.model}</strong></span>
                                )}
                                {part.location && (
                                  <span>ตำแหน่ง: <strong className="text-gray-700">{part.location}</strong></span>
                                )}
                              </div>
                            </div>

                            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-xs shrink-0">
                              คงเหลือ: {part.stock}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-black text-gray-800 tracking-wide mb-1.5 sm:mb-2">
              จำนวนที่ใช้ <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="quantity"
              defaultValue={1}
              min={1}
              required
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-black text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-black text-gray-800 tracking-wide mb-1.5 sm:mb-2">
              หมายเหตุการเบิก / อาการซ่อม
            </label>
            <textarea
              name="note"
              rows={2}
              placeholder="ระบุรายละเอียดการเบิกอะไหล่..."
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition shadow-xs"
            />
          </div>

          {/* ส่วนอัปโหลดรูปถ่ายหลักฐาน 2 ช่อง */}
          {purposeType === 'JOB' && (
            <div className="space-y-2.5 pt-2 border-t border-gray-100">
              <label className="block text-xs sm:text-sm font-black text-gray-800 tracking-wide flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-blue-600 flex-shrink-0" /> รูปถ่ายหลักฐาน <span className="text-red-500 text-[11px] font-black">(บังคับอัปโหลดทั้ง 2 ไฟล์)</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* ช่องที่ 1: รูปถ่ายเต็มบอร์ด */}
                <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-2 text-center transition bg-gray-50/50 flex flex-col items-center justify-center min-h-[160px] overflow-hidden shadow-xs hover:border-blue-500">
                  {boardImagePreview ? (
                    <div className="relative w-full h-40 flex items-center justify-center">
                      <img src={boardImagePreview} alt="Board Preview" className="w-full h-full object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={() => setBoardImagePreview(null)}
                        className="absolute top-1.5 right-1.5 p-1 bg-red-600 text-white rounded-full shadow-md hover:bg-red-700 transition cursor-pointer"
                        title="ลบรูปภาพ"
                      >
                        <X className="w-3.5 h-3.5 font-bold" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center py-2">
                      <Upload className="w-5 h-5 text-blue-600 mb-1" />
                      <span className="text-[11px] sm:text-xs font-black text-gray-800">รูปที่ 1: ถ่ายเต็มบอร์ด *</span>
                      <span className="text-[11px] text-red-600 font-bold mt-0.5">(ถ่ายรูปแนวนอนเท่านั้น)</span>
                      <span className="text-[10px] font-bold text-gray-400 mt-1">คลิกเพื่อเลือกหรือถ่ายรูป</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleImageChange(e, 'board')} 
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>

                {/* ช่องที่ 2: รูปถ่าย QR Code / S/N อะไหล่ */}
                <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-2 text-center transition bg-gray-50/50 flex flex-col items-center justify-center min-h-[160px] overflow-hidden shadow-xs hover:border-blue-500">
                  {qrImagePreview ? (
                    <div className="relative w-full h-40 flex items-center justify-center">
                      <img src={qrImagePreview} alt="QR Preview" className="w-full h-full object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={() => setQrImagePreview(null)}
                        className="absolute top-1.5 right-1.5 p-1 bg-red-600 text-white rounded-full shadow-md hover:bg-red-700 transition cursor-pointer"
                        title="ลบรูปภาพ"
                      >
                        <X className="w-3.5 h-3.5 font-bold" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center py-2">
                      <Upload className="w-5 h-5 text-blue-600 mb-1" />
                      <span className="text-[11px] sm:text-xs font-black text-gray-800">รูปที่ 2: ถ่าย QR Code / S/N *</span>
                      <span className="text-[11px] text-red-600 font-bold mt-0.5">(ถ่ายรูปแนวนอนเท่านั้น)</span>
                      <span className="text-[10px] font-bold text-gray-400 mt-1">คลิกเพื่อเลือกหรือถ่ายรูป</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleImageChange(e, 'qr')} 
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* ปุ่มด้านล่าง */}
          <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-gray-100">
            <Link
              href="/dashboard/inventory/boards"
              className="py-2.5 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 font-extrabold text-xs sm:text-sm rounded-xl transition flex items-center justify-center shadow-xs text-center"
            >
              ยกเลิก
            </Link>
            <button
              type="submit"
              disabled={loading}
              className={`py-2.5 rounded-xl font-black text-xs sm:text-sm text-white shadow-sm transition flex items-center gap-1.5 justify-center text-center ${
                loading
                  ? 'bg-amber-300 cursor-not-allowed opacity-80'
                  : 'bg-amber-500 hover:bg-amber-600 active:scale-95 cursor-pointer'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
                  <span className="truncate">กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Package className="w-4 h-4 font-bold shrink-0" /> 
                  <span className="truncate">ยืนยันการเบิกอะไหล่</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>

    </div>
  );
}