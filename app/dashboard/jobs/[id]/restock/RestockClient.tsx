'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Search, X, AlertTriangle } from 'lucide-react';

interface SparePart {
  id: string;
  code: string | null;
  boardModelCode: string | null;
  name: string;
  model: string | null;
  location: string | null;
  stock: number;
}

interface RestockClientProps {
  params?: { id: string };
  job?: {
    id: string;
    jobNo: string;
    customerName?: string;
    customer?: {
      name?: string;
    };
  };
  spareParts?: SparePart[];
}

export default function RestockJobClient({ params, job, spareParts = [] }: RestockClientProps) {
  const router = useRouter();
  const urlParams = useParams();
  
  const jobId = job?.id || params?.id || (urlParams?.id as string);
  const customerName = job?.customerName || job?.customer?.name || 'ไม่ระบุชื่อลูกค้า';

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // State สำหรับจัดการ Popup เตือนรูปแนวตั้ง
  const [warningModalMsg, setWarningModalMsg] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartId, setSelectedPartId] = useState('');
  const [isOpenModal, setIsOpenModal] = useState(false);

  const [image1File, setImage1File] = useState<File | null>(null);
  const [image1Preview, setImage1Preview] = useState<string | null>(null);

  const [image2File, setImage2File] = useState<File | null>(null);
  const [image2Preview, setImage2Preview] = useState<string | null>(null);

  const filteredParts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return spareParts;

    return spareParts.filter((part) => {
      const nameMatch = part.name.toLowerCase().includes(query);
      const codeMatch = part.code?.toLowerCase().includes(query) || false;
      const boardCodeMatch = part.boardModelCode?.toLowerCase().includes(query) || false;
      const modelMatch = part.model?.toLowerCase().includes(query) || false;
      const numbersInName = part.name.replace(/[^0-9]/g, '');
      const numberMatch = numbersInName.includes(query);

      return nameMatch || codeMatch || boardCodeMatch || modelMatch || numberMatch;
    });
  }, [spareParts, searchQuery]);

  const selectedPart = spareParts.find((p) => p.id === selectedPartId);

  // ฟังก์ชันตรวจสอบรูปที่ 1
  const handleImage1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        if (img.width <= img.height) {
          const msg = 'รูปที่ 1 ที่คุณเลือกเป็น "แนวตั้งหรือจัตุรัส" กรุณาหมุนโทรศัพท์และถ่ายภาพใน "แนวนอน" เท่านั้นครับ';
          setWarningModalMsg(msg);
          setImage1File(null);
          setImage1Preview(null);
        } else {
          setErrorMsg('');
          setImage1File(file);
          setImage1Preview(URL.createObjectURL(file));
        }
      };
      img.src = objectUrl;
    }
  };

  // ฟังก์ชันตรวจสอบรูปที่ 2
  const handleImage2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        if (img.width <= img.height) {
          const msg = 'รูปที่ 2 ที่คุณเลือกเป็น "แนวตั้งหรือจัตุรัส" กรุณาหมุนโทรศัพท์และถ่ายภาพใน "แนวนอน" เท่านั้นครับ';
          setWarningModalMsg(msg);
          setImage2File(null);
          setImage2Preview(null);
        } else {
          setErrorMsg('');
          setImage2File(file);
          setImage2Preview(URL.createObjectURL(file));
        }
      };
      img.src = objectUrl;
    }
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    
    if (!jobId) {
      setErrorMsg('ไม่พบรหัสใบงาน (Job ID) กรุณาลองรีเฟรชหน้าใหม่อีกครั้ง');
      return;
    }

    if (!selectedPartId) {
      setErrorMsg('กรุณาเลือกรายการอะไหล่');
      return;
    }

    if (!image1File || !image2File) {
      setErrorMsg('กรุณาแนบรูปถ่ายแนวนอนทั้ง 2 รูป (รูปเต็มบอร์ด และรูป QR Code / S/N)');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const formElement = event.currentTarget;
    const formData = new FormData();
    formData.set('sparePartId', selectedPartId);
    
    const quantity = (formElement.elements.namedItem('quantity') as HTMLInputElement)?.value || '1';
    const note = (formElement.elements.namedItem('note') as HTMLTextAreaElement)?.value || '';
    
    formData.set('quantity', quantity);
    formData.set('note', note);
    
    if (image1File) {
      formData.set('image1', image1File);
    }
    if (image2File) {
      formData.set('image2', image2File);
    }

    try {
      const response = await fetch(`/api/jobs/${jobId}/restock`, {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get('content-type');
      let resultData: any = {};
      if (contentType && contentType.includes('application/json')) {
        resultData = await response.json();
      }

      if (!response.ok) {
        throw new Error(resultData.error || `เกิดข้อผิดพลาดในการบันทึกข้อมูล (Status: ${response.status})`);
      }

      window.location.href = `/dashboard/jobs/${jobId}?success=true`;
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดที่ไม่สามารถระบุได้ กรุณาลองใหม่อีกครั้ง');
      setLoading(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      
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

      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/jobs/${jobId || ''}`}
          className="p-2.5 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-700 transition shadow-sm"
          title="ย้อนกลับ"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>📦</span> เบิกอะไหล่และแนบหลักฐานสำหรับซ่อมเครื่อง
          </h1>
          <p className="text-xs sm:text-sm text-gray-500">ชื่อลูกค้า: {customerName}</p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm font-medium shadow-sm">
          {errorMsg}
        </div>
      )}

      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-900 mb-2">
              ค้นหาและเลือกอะไหล่ (พิมพ์ชื่อ หรือเลขท้ายรหัส) *
            </label>
            
            <div 
              onClick={() => setIsOpenModal(true)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 cursor-pointer flex items-center justify-between hover:border-amber-400 transition"
            >
              <span className={`truncate mr-2 ${selectedPart ? 'text-gray-900 font-semibold' : 'text-gray-400'}`}>
                {selectedPart ? `[${selectedPart.code || selectedPart.boardModelCode || selectedPart.model || '-'}] ${selectedPart.name} (คงเหลือ: ${selectedPart.stock} ชิ้น)` : 'พิมพ์ชื่อ หรือเลข 4 ตัวท้ายของรหัส'}
              </span>
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
            </div>

            {isOpenModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
                <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-gray-100 flex flex-col max-h-[85vh] overflow-hidden">
                  
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <Search className="w-5 h-5 text-amber-500" /> ค้นหาและเลือกอะไหล่
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsOpenModal(false)}
                      className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-4 sm:px-6 pt-4">
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-4 top-3.5" />
                      <input
                        type="text"
                        placeholder="พิมพ์รหัสรุ่นบอร์ด, ชื่อบอร์ดอะไหล่ หรือ รุ่นเครื่อง..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-amber-400 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20 font-medium text-gray-900"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="p-4 sm:px-6 pb-6 overflow-y-auto space-y-3 flex-1">
                    {filteredParts.length === 0 ? (
                      <div className="p-8 text-center text-sm text-gray-400">ไม่พบรายการอะไหล่ที่ตรงกัน</div>
                    ) : (
                      filteredParts.map((part) => {
                        const displayCode = part.code || part.boardModelCode || part.model || 'ไม่มีรหัส';
                        const isOutOfStock = part.stock <= 0;

                        return (
                          <div
                            key={part.id}
                            onClick={() => {
                              if (!isOutOfStock) {
                                setSelectedPartId(part.id);
                                setIsOpenModal(false);
                                setSearchQuery('');
                              }
                            }}
                            className={`p-4 rounded-2xl border transition flex items-center justify-between gap-3 bg-white shadow-xs ${
                              isOutOfStock 
                                ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200' 
                                : 'border-gray-200 hover:border-amber-400 hover:shadow-md cursor-pointer'
                            }`}
                          >
                            <div className="flex flex-col space-y-1.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-amber-900 bg-amber-50/80 px-2.5 py-0.5 rounded-lg text-xs border border-amber-200/60">
                                  {displayCode}
                                </span>
                                <span className="font-bold text-gray-900 text-sm truncate">{part.name}</span>
                              </div>

                              <div className="text-xs font-semibold text-gray-500">
                                รุ่นเครื่อง: <span className="font-bold text-gray-900">{part.model || 'ทุกรุ่น'}</span>
                              </div>

                              {part.location && (
                                <div className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                                  <span>ตำแหน่ง:</span>
                                  <span className="font-bold text-gray-900">{part.location}</span>
                                </div>
                              )}
                            </div>

                            <span className={`text-xs px-3 py-2 rounded-xl shrink-0 font-bold ${!isOutOfStock ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                              คงเหลือ: {part.stock} {isOutOfStock ? '(หมด)' : ''}
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
            <label className="block text-xs sm:text-sm font-bold text-gray-900 mb-2">
              จำนวนที่ใช้ *
            </label>
            <input
              type="number"
              name="quantity"
              defaultValue={1}
              min={1}
              max={selectedPart ? selectedPart.stock : undefined}
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-900 mb-2">
              หมายเหตุการเบิก / อาการซ่อม
            </label>
            <textarea
              name="note"
              rows={3}
              placeholder="ระบุรายละเอียดการเบิกอะไหล่..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs sm:text-sm font-bold text-gray-900">
                📷 รูปถ่ายหลักฐาน
              </label>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl transition overflow-hidden min-h-[180px] ${image1Preview ? 'border-amber-500 bg-black/5 p-1' : 'border-gray-300 hover:border-amber-500 bg-gray-50 hover:bg-amber-50/50 p-5'}`}>
                {image1Preview ? (
                  <div className="relative w-full h-48 flex items-center justify-center">
                    <img src={image1Preview} alt="Preview 1" className="w-full h-full object-cover rounded-xl" />
                    <button
                      type="button"
                      onClick={() => {
                        setImage1File(null);
                        setImage1Preview(null);
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full transition shadow-md z-10 cursor-pointer"
                      title="ลบรูปภาพ"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center text-center p-4">
                    <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm mb-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold text-gray-800">รูปที่ 1: ถ่ายเต็มบอร์ดอะไหล่ *</span>
                    <span className="text-[11px] text-red-600 font-bold mt-0.5">(ถ่ายรูปแนวนอนเท่านั้น)</span>
                    <span className="text-[10px] text-gray-400 mt-1">คลิกเพื่อเลือกหรือถ่ายรูปภาพ</span>
                    <input type="file" name="image1" accept="image/*" className="hidden" onChange={handleImage1Change} />
                  </label>
                )}
              </div>

              <div className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl transition overflow-hidden min-h-[180px] ${image2Preview ? 'border-amber-500 bg-black/5 p-1' : 'border-gray-300 hover:border-amber-500 bg-gray-50 hover:bg-amber-50/50 p-5'}`}>
                {image2Preview ? (
                  <div className="relative w-full h-48 flex items-center justify-center">
                    <img src={image2Preview} alt="Preview 2" className="w-full h-full object-cover rounded-xl" />
                    <button
                      type="button"
                      onClick={() => {
                        setImage2File(null);
                        setImage2Preview(null);
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full transition shadow-md z-10 cursor-pointer"
                      title="ลบรูปภาพ"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center text-center p-4">
                    <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm mb-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold text-gray-800">รูปที่ 2: ถ่าย QR Code / S/N *</span>
                    <span className="text-[11px] text-red-600 font-bold mt-0.5">(ถ่ายรูปแนวนอนเท่านั้น)</span>
                    <span className="text-[10px] text-gray-400 mt-1">คลิกเพื่อเลือกหรือถ่ายรูปภาพ</span>
                    <input type="file" name="image2" accept="image/*" className="hidden" onChange={handleImage2Change} />
                  </label>
                )}
              </div>

            </div>
          </div>

          <div className="flex flex-row items-center gap-3 pt-4 border-t border-gray-100">
            <Link
              href={`/dashboard/jobs/${jobId || ''}`}
              className="flex-1 py-3 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-bold text-sm rounded-xl transition flex items-center justify-center shadow-xs text-center"
            >
              ยกเลิก
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center cursor-pointer text-center"
            >
              {loading ? 'กำลังบันทึกข้อมูล...' : 'ยืนยันการเบิกอะไหล่'}
            </button>
          </div>

        </form>
      </div>

    </div>
  );
}