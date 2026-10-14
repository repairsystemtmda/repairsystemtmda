'use client';

import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import PartSearchModal from './PartSearchModal';
import { X, AlertTriangle } from 'lucide-react';
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

  // State สำหรับจัดการ Popup เตือนรูปแนวตั้ง
  const [warningModalMsg, setWarningModalMsg] = useState<string | null>(null);

  const [image1File, setImage1File] = useState<File | null>(null);
  const [image1Preview, setImage1Preview] = useState<string | null>(null);

  const [image2File, setImage2File] = useState<File | null>(null);
  const [image2Preview, setImage2Preview] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 1 | 2) => {
    const file = e.target.files?.[0];
    if (file) {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = async () => {
        URL.revokeObjectURL(objectUrl);
        if (img.width <= img.height) {
          const targetName = type === 1 ? 'รูปที่ 1 (เต็มบอร์ดอะไหล่)' : 'รูปที่ 2 (QR Code / S/N อะไหล่)';
          const msg = `${targetName} ที่คุณเลือกเป็น "แนวตั้งหรือจัตุรัส" กรุณาหมุนโทรศัพท์และถ่ายภาพใน "แนวนอน" เท่านั้นครับ`;
          setWarningModalMsg(msg);
          if (type === 1) {
            setImage1File(null);
            setImage1Preview(null);
          } else {
            setImage2File(null);
            setImage2Preview(null);
          }
        } else {
          try {
            setErrorMsg(null);
            const compressedFile = await resizeImage(file);
            const previewUrl = URL.createObjectURL(compressedFile);
            if (type === 1) {
              setImage1File(compressedFile);
              setImage1Preview(previewUrl);
            } else {
              setImage2File(compressedFile);
              setImage2Preview(previewUrl);
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formElement = e.currentTarget;
    const formData = new FormData(formElement);

    const rawQty = parseInt((formData.get('quantity') as string) || '1', 10);
    const negativeQty = -Math.abs(rawQty).toString();
    formData.set('quantity', `${negativeQty}`);

    if (session?.user) {
      const userIdentifier = (session.user as any).id || session.user.email || session.user.name || '';
      formData.set('userIdentifier', userIdentifier);
    }

    formData.delete('images');
    if (image1File) {
      formData.append('images', image1File);
    }
    if (image2File) {
      formData.append('images', image2File);
    }

    setErrorMsg(null);

    startTransition(async () => {
      try {
        await submitAction(formData);
      } catch (err: any) {
        setErrorMsg(err.message || 'เกิดข้อผิดพลาด');
      }
    });
  };

  const formattedSpareParts = spareParts.map((p) => ({
    ...p,
    code: p.code ?? undefined,
    qrModelCode: p.qrModelCode ?? undefined,
    boardModelCode: p.boardModelCode ?? undefined,
    location: p.location ?? undefined,
    model: p.model ?? undefined,
  }));

  if (!isMounted) {
    return <div className="max-w-3xl mx-auto py-6 px-4 text-center text-gray-500 text-sm">กำลังโหลดฟอร์ม...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      
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
        
        <div className="space-y-1.5">
          <label className="block text-xs sm:text-sm font-bold text-gray-900">
            ค้นหาและเลือกอะไหล่ (พิมพ์ชื่อ หรือเลข 4 ตัวท้ายของรหัส) *
          </label>
          <PartSearchModal spareParts={formattedSpareParts} />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs sm:text-sm font-bold text-gray-900">
            จำนวนที่ใช้ *
          </label>
          <input
            type="number"
            name="quantity"
            defaultValue={1}
            min={1}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm bg-white font-medium text-gray-900"
          />
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

        <div className="space-y-3">
          <label className="block text-xs sm:text-sm font-bold text-gray-900">
            📸 รูปถ่ายหลักฐาน <span className="text-red-500 text-xs font-bold">(ถ่ายรูปแนวนอนเท่านั้น)</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl transition overflow-hidden min-h-[160px] ${image1Preview ? 'border-amber-500 bg-black/5 p-1' : 'border-gray-300 hover:border-amber-500 bg-gray-50/50 p-4'}`}>
              {image1Preview ? (
                <div className="relative w-full h-40 flex items-center justify-center">
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
                <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center text-center p-2">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm mb-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-gray-900">รูปที่ 1: ถ่ายเต็มบอร์ดอะไหล่ *</p>
                  <p className="text-xs text-red-600 font-bold mt-0.5">(ถ่ายรูปแนวนอนเท่านั้น)</p>
                  <p className="text-[11px] text-gray-500 mt-1">คลิกเพื่อเลือกหรือถ่ายรูปภาพ</p>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageChange(e, 1)}
                  />
                </label>
              )}
            </div>

            <div className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl transition overflow-hidden min-h-[160px] ${image2Preview ? 'border-amber-500 bg-black/5 p-1' : 'border-gray-300 hover:border-amber-500 bg-gray-50/50 p-4'}`}>
              {image2Preview ? (
                <div className="relative w-full h-40 flex items-center justify-center">
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
                <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center text-center p-2">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm mb-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-gray-900">รูปที่ 2: ถ่าย QR Code / S/N อะไหล่ *</p>
                  <p className="text-xs text-red-600 font-bold mt-0.5">(ถ่ายรูปแนวนอนเท่านั้น)</p>
                  <p className="text-[11px] text-gray-500 mt-1">คลิกเพื่อเลือกหรือถ่ายรูปภาพ</p>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageChange(e, 2)}
                  />
                </label>
              )}
            </div>

          </div>
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
            {isPending ? 'กำลังบันทึกข้อมูล...' : 'ยืนยันการเบิกอะไหล่'}
          </button>
        </div>

      </form>
    </div>
  );
}