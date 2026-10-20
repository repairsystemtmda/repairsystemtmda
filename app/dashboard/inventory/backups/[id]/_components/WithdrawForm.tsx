'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { X, AlertTriangle, Plus, Trash2, Search, Upload, ImageIcon, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';

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

interface WithdrawItem {
  sparePartId: string;
  quantity: number;
  image1File: File | null;
  image1Preview: string | null;
  image2File: File | null;
  image2Preview: string | null;
}

interface WithdrawFormProps {
  deviceId: string;
  deviceModel: string;
  deviceSerial?: string | null;
  spareParts: SparePart[];
  submitAction: (formData: FormData) => Promise<void>;
}

export default function WithdrawForm({
  deviceId,
  deviceModel,
  deviceSerial,
  spareParts,
  submitAction,
}: WithdrawFormProps) {
  const { data: session } = useSession();
  const [isMounted, setIsMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [warningModalMsg, setWarningModalMsg] = useState<string | null>(null);

  // รองรับหลายรายการเบิก
  const [withdrawItems, setWithdrawItems] = useState<WithdrawItem[]>([
    { sparePartId: '', quantity: 1, image1File: null, image1Preview: null, image2File: null, image2Preview: null }
  ]);

  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpenModal, setIsOpenModal] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const filteredParts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return spareParts;

    return spareParts.filter((part) => {
      const nameMatch = part.name.toLowerCase().includes(query);
      const codeMatch = part.code?.toLowerCase().includes(query) || false;
      const boardCodeMatch = part.boardModelCode?.toLowerCase().includes(query) || false;
      const qrCodeMatch = part.qrModelCode?.toLowerCase().includes(query) || false;
      const modelMatch = part.model?.toLowerCase().includes(query) || false;
      const numbersInName = part.name.replace(/[^0-9]/g, '');
      const numberMatch = numbersInName.includes(query);

      return nameMatch || codeMatch || boardCodeMatch || qrCodeMatch || modelMatch || numberMatch;
    });
  }, [spareParts, searchQuery]);

  const handleAddItemRow = () => {
    setWithdrawItems([
      ...withdrawItems,
      { sparePartId: '', quantity: 1, image1File: null, image1Preview: null, image2File: null, image2Preview: null }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (withdrawItems.length === 1) return;
    setWithdrawItems(withdrawItems.filter((_, i) => i !== index));
  };

  const handleItemQuantityChange = (index: number, qty: number) => {
    const newItems = [...withdrawItems];
    newItems[index].quantity = qty > 0 ? qty : 1;
    setWithdrawItems(newItems);
  };

  const resizeImage = (file: File): Promise<File> => {
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

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.75
          );
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>, itemIndex: number, type: 'image1' | 'image2') => {
    const file = e.target.files?.[0];
    if (file) {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = async () => {
        URL.revokeObjectURL(objectUrl);
        if (img.width <= img.height) {
          const targetName = type === 'image1' ? 'รูปที่ 1 (เต็มบอร์ด)' : 'รูปที่ 2 (QR Code / S/N)';
          const msg = `${targetName} ของรายการที่ ${itemIndex + 1} เป็น "แนวตั้งหรือจัตุรัส" กรุณาหมุนโทรศัพท์และถ่ายภาพใน "แนวนอน" เท่านั้นครับ`;
          setWarningModalMsg(msg);
          
          const newItems = [...withdrawItems];
          if (type === 'image1') {
            newItems[itemIndex].image1File = null;
            newItems[itemIndex].image1Preview = null;
          } else {
            newItems[itemIndex].image2File = null;
            newItems[itemIndex].image2Preview = null;
          }
          setWithdrawItems(newItems);
        } else {
          try {
            setErrorMsg(null);
            const compressedFile = await resizeImage(file);
            const previewUrl = URL.createObjectURL(compressedFile);
            const newItems = [...withdrawItems];
            if (type === 'image1') {
              newItems[itemIndex].image1File = compressedFile;
              newItems[itemIndex].image1Preview = previewUrl;
            } else {
              newItems[itemIndex].image2File = compressedFile;
              newItems[itemIndex].image2Preview = previewUrl;
            }
            setWithdrawItems(newItems);
          } catch (err) {
            console.error('Error compressing image:', err);
            setErrorMsg('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ กรุณาลองใหม่อีกครั้ง');
          }
        }
      };
      img.src = objectUrl;
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    for (let i = 0; i < withdrawItems.length; i++) {
      const item = withdrawItems[i];
      if (!item.sparePartId) {
        setErrorMsg(`กรุณาเลือกรายการอะไหล่ในรายการที่ ${i + 1}`);
        return;
      }
      if (!item.image1File || !item.image2File) {
        setErrorMsg(`กรุณาแนบรูปถ่ายแนวนอนทั้ง 2 รูปในรายการที่ ${i + 1}`);
        return;
      }
    }

    setErrorMsg(null);
    const formElement = e.currentTarget;
    const formData = new FormData(formElement);
    const note = (formElement.elements.namedItem('note') as HTMLTextAreaElement)?.value || '';

    const payloadItems = withdrawItems.map((item, index) => {
      if (item.image1File) formData.append(`image1_${index}`, item.image1File);
      if (item.image2File) formData.append(`image2_${index}`, item.image2File);

      return {
        sparePartId: item.sparePartId,
        quantity: item.quantity,
      };
    });

    formData.set('itemsJson', JSON.stringify(payloadItems));
    formData.set('note', note);

    if (session?.user) {
      const userIdentifier = (session.user as any).id || session.user.email || session.user.name || '';
      formData.set('userIdentifier', userIdentifier);
    }

    startTransition(async () => {
      try {
        await submitAction(formData);
      } catch (err: any) {
        setErrorMsg(err.message || 'เกิดข้อผิดพลาด');
      }
    });
  };

  if (!isMounted) {
    return <div className="max-w-3xl mx-auto py-6 px-4 text-center text-gray-500 text-sm">กำลังโหลดฟอร์ม...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 pb-24">
      
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

      <div className="mb-6 space-y-2">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/inventory/backups/${deviceId}`}
            className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-50 transition shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className="text-base sm:text-xl font-bold text-gray-900 leading-snug">
            เบิกอะไหล่และแนบหลักฐานสำหรับซ่อมเครื่องสำรอง
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-gray-700 pl-13 font-medium">
          รุ่นเครื่องสำรอง: <span className="font-bold text-gray-900">{deviceModel || '-'}</span>
          {deviceSerial ? <span className="text-gray-800"> (S/N: {deviceSerial})</span> : null}
        </p>
      </div>

      {errorMsg && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-6">
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-xs sm:text-sm font-bold text-gray-900">
              รายการบอร์ด/อะไหล่ที่ต้องการตัดเบิก *
            </label>
            <span className="text-xs text-gray-500 font-semibold">สามารถเพิ่มได้หลายรายการ</span>
          </div>

          {withdrawItems.map((item, index) => {
            const currentPart = spareParts.find((p) => p.id === item.sparePartId);

            return (
              <div key={index} className="bg-gray-50/90 p-4 rounded-2xl border-2 border-gray-200 space-y-4 shadow-xs">
                
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-black text-gray-700 bg-gray-200 px-2.5 py-1 rounded-lg">
                    รายการที่ {index + 1}
                  </span>
                  {withdrawItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItemRow(index)}
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border border-red-200 transition flex items-center gap-1 cursor-pointer"
                      title="ลบรายการนี้"
                    >
                      <Trash2 className="w-4 h-4 font-bold" />
                      <span className="text-xs font-bold">ลบรายการนี้</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                  <div 
                    onClick={() => {
                      setActiveItemIndex(index);
                      setErrorMsg(null);
                      setIsOpenModal(true);
                    }}
                    className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-900 cursor-pointer flex items-center justify-between hover:border-amber-400 transition"
                  >
                    <span className={`truncate mr-2 ${currentPart ? 'text-gray-900 font-semibold' : 'text-gray-400'}`}>
                      {currentPart ? `[${currentPart.code || currentPart.boardModelCode || currentPart.model || '-'}] ${currentPart.name} (คงเหลือ: ${currentPart.stock ?? 0} ชิ้น)` : `-- คลิกเลือกอะไหล่ รายการที่ ${index + 1} --`}
                    </span>
                    <Search className="w-4 h-4 text-gray-400 shrink-0" />
                  </div>

                  <div className="w-full sm:w-32 flex items-center gap-1.5">
                    <span className="text-xs text-gray-500 font-bold sm:hidden">จำนวน:</span>
                    <input
                      type="number"
                      value={item.quantity}
                      min={1}
                      max={currentPart?.stock}
                      onChange={(e) => handleItemQuantityChange(index, parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-3 bg-white border border-gray-200 rounded-xl text-sm font-black text-gray-900 text-center outline-none focus:border-amber-500 shadow-xs"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-200">
                  <label className="block text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-blue-600 shrink-0" /> 
                    รูปถ่ายหลักฐานประจำรายการที่ {index + 1} <span className="text-red-500">(บังคับอัปโหลดทั้ง 2 ไฟล์ แนวนอน)</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    
                    <div className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl transition overflow-hidden min-h-[150px] bg-white ${item.image1Preview ? 'border-amber-500 p-1' : 'border-gray-300 hover:border-amber-500 p-3'}`}>
                      {item.image1Preview ? (
                        <div className="relative w-full h-36 flex items-center justify-center">
                          <img src={item.image1Preview} alt="Preview 1" className="w-full h-full object-cover rounded-lg" />
                          <button
                            type="button"
                            onClick={() => {
                              const newItems = [...withdrawItems];
                              newItems[index].image1File = null;
                              newItems[index].image1Preview = null;
                              setWithdrawItems(newItems);
                            }}
                            className="absolute top-1.5 right-1.5 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full transition shadow-md z-10 cursor-pointer"
                            title="ลบรูปภาพ"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center text-center p-2">
                          <Upload className="w-5 h-5 text-blue-600 mb-1" />
                          <span className="text-[11px] font-bold text-gray-800">รูปที่ 1: ถ่ายเต็มบอร์ด *</span>
                          <span className="text-[10px] text-red-600 font-bold">(ถ่ายแนวนอนเท่านั้น)</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageChange(e, index, 'image1')} />
                        </label>
                      )}
                    </div>

                    <div className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl transition overflow-hidden min-h-[150px] bg-white ${item.image2Preview ? 'border-amber-500 p-1' : 'border-gray-300 hover:border-amber-500 p-3'}`}>
                      {item.image2Preview ? (
                        <div className="relative w-full h-36 flex items-center justify-center">
                          <img src={item.image2Preview} alt="Preview 2" className="w-full h-full object-cover rounded-lg" />
                          <button
                            type="button"
                            onClick={() => {
                              const newItems = [...withdrawItems];
                              newItems[index].image2File = null;
                              newItems[index].image2Preview = null;
                              setWithdrawItems(newItems);
                            }}
                            className="absolute top-1.5 right-1.5 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full transition shadow-md z-10 cursor-pointer"
                            title="ลบรูปภาพ"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center text-center p-2">
                          <Upload className="w-5 h-5 text-blue-600 mb-1" />
                          <span className="text-[11px] font-bold text-gray-800">รูปที่ 2: ถ่าย QR Code / S/N *</span>
                          <span className="text-[10px] text-red-600 font-bold">(ถ่ายแนวนอนเท่านั้น)</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageChange(e, index, 'image2')} />
                        </label>
                      )}
                    </div>

                  </div>
                </div>

              </div>
            );
          })}

          <button
            type="button"
            onClick={handleAddItemRow}
            className="w-full py-3 border-2 border-dashed border-blue-400 hover:border-blue-500 text-blue-600 hover:bg-blue-50/50 font-black text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 font-bold" /> เพิ่มรายการเบิก
          </button>

          {/* Modal ค้นหาอะไหล่ */}
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
                      const isOutOfStock = (part.stock ?? 0) <= 0;

                      return (
                        <div
                          key={part.id}
                          onClick={() => {
                            if (!isOutOfStock && activeItemIndex !== null) {
                              const newItems = [...withdrawItems];
                              newItems[activeItemIndex].sparePartId = part.id;
                              setWithdrawItems(newItems);
                              setIsOpenModal(false);
                              setSearchQuery('');
                              setActiveItemIndex(null);
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
                            คงเหลือ: {part.stock ?? 0} {isOutOfStock ? '(หมด)' : ''}
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

        <div className="space-y-1.5">
          <label className="block text-xs sm:text-sm font-bold text-gray-900">
            หมายเหตุการเบิก / อาการซ่อม
          </label>
          <textarea
            name="note"
            rows={3}
            placeholder="ระบุรายละเอียดการเบิกอะไหล่..."
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm bg-white text-gray-900 placeholder-gray-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
          <Link
            href={`/dashboard/inventory/backups/${deviceId}`}
            className="py-3 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-bold text-sm rounded-xl transition flex items-center justify-center shadow-xs text-center"
          >
            ยกเลิก
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center cursor-pointer text-center"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white mr-2" />
                <span>กำลังบันทึกข้อมูล...</span>
              </>
            ) : (
              'ยืนยันการเบิกอะไหล่ทั้งหมด'
            )}
          </button>
        </div>

      </form>
    </div>
  );
}