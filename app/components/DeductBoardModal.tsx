'use client';



import { useState } from 'react';

import { submitRepairWithInventoryDeduction } from '@/app/actions/repairActions';



interface SparePartItem {

  id: string;

  name: string;

  model: string | null;

  stock: number;

}



interface DeductBoardModalProps {

  jobId: string;

  spareParts: SparePartItem[];

  technicianName: string;

  onSuccess?: () => void;

}



export default function DeductBoardModal({

  jobId,

  spareParts,

  technicianName,

  onSuccess,

}: DeductBoardModalProps) {

  const [isOpen, setIsOpen] = useState(false);

  const [selectedPartId, setSelectedPartId] = useState('');

 

  // State สำหรับรองรับรูปหลักฐาน 2 รูป (Dual-Image Evidence Policy)

  const [image1, setImage1] = useState<File | null>(null);

  const [image2, setImage2] = useState<File | null>(null);



  const [loading, setLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');



  const handleDeduct = async (e: React.FormEvent) => {

    e.preventDefault();

   

    if (!selectedPartId) {

      setErrorMessage('กรุณาเลือกอะไหล่ที่ต้องการเบิก');

      return;

    }



    // 🔒 กฎบังคับ Phase 2: ต้องมีรูปหลักฐานครบ 2 รูป

    if (!image1 || !image2) {

      setErrorMessage('⚠️ กฎ Phase 2: กรุณาแนบรูปหลักฐานบังคับจำนวน 2 รูป');

      return;

    }



    setLoading(true);

    setErrorMessage('');



    try {

      const formData = new FormData();

      formData.append('jobId', jobId);

      formData.append('sparePartId', selectedPartId);

      formData.append('technicianName', technicianName);

      formData.append('image1', image1);

      formData.append('image2', image2);



      // เรียกใช้งาน Server Action

      const res = await submitRepairWithInventoryDeduction(formData);



      if (res.success) {

        setIsOpen(false);

        if (onSuccess) onSuccess();

        window.location.reload(); // รีเฟรชหน้าจอเพื่อแสดงสถานะล่าสุด

      } else {

        setErrorMessage(res.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');

      }



    } catch (err: any) {

      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');

    } finally {

      setLoading(false);

    }

  };



  return (

    <>

      <button

        onClick={() => setIsOpen(true)}

        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm flex items-center gap-1.5"

      >

        <span>🛠️</span> เบิกอะไหล่และแนบหลักฐาน (Phase 2)

      </button>



      {isOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">

          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100">

            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">

              <h3 className="font-bold text-slate-800">เบิกอะไหล่ + ยืนยันรูปหลักฐาน (Dual-Image)</h3>

              <button

                type="button"

                onClick={() => setIsOpen(false)}

                className="text-slate-400 hover:text-slate-600 text-lg font-bold"

              >

                ✕

              </button>

            </div>



            <form onSubmit={handleDeduct} className="p-6 space-y-4">

              {errorMessage && (

                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">

                  {errorMessage}

                </div>

              )}



              {/* เลือกอะไหล่ */}

              <div>

                <label className="block text-sm font-medium text-slate-700 mb-1">

                  เลือกอะไหล่จากคลัง (Strict Stock Guard)

                </label>

                <select

                  value={selectedPartId}

                  onChange={(e) => setSelectedPartId(e.target.value)}

                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"

                  required

                >

                  <option value="">-- กรุณาเลือกรายการอะไหล่ --</option>

                  {spareParts.map((part) => (

                    <option

                      key={part.id}

                      value={part.id}

                      disabled={part.stock <= 0}

                    >

                      {part.name} ({part.model || 'N/A'}) - คงเหลือ: {part.stock} ชิ้น {part.stock <= 0 ? '(หมด)' : ''}

                    </option>

                  ))}

                </select>

              </div>



              {/* ช่องอัปโหลดรูปที่ 1 */}

              <div>

                <label className="block text-sm font-medium text-slate-700 mb-1">

                  📸 รูปหลักฐานที่ 1: ถ่ายรูปเต็มบอร์ด (บอร์ดเดิมที่เสีย)

                </label>

                <input

                  type="file"

                  accept="image/*"

                  onChange={(e) => setImage1(e.target.files?.[0] || null)}

                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-200 rounded-lg"

                  required

                />

              </div>



              {/* ช่องอัปโหลดรูปที่ 2 */}

              <div>

                <label className="block text-sm font-medium text-slate-700 mb-1">

                  📸 รูปหลักฐานที่ 2: ถ่ายรูปตรง QR Code บอร์ดเดิมที่เสีย

                </label>

                <input

                  type="file"

                  accept="image/*"

                  onChange={(e) => setImage2(e.target.files?.[0] || null)}

                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-200 rounded-lg"

                  required

                />

              </div>



              <div className="pt-2 flex justify-end gap-3 border-t">

                <button

                  type="button"

                  onClick={() => setIsOpen(false)}

                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"

                >

                  ยกเลิก

                </button>

                <button

                  type="submit"

                  disabled={loading}

                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"

                >

                  {loading ? 'กำลังอัปโหลดและตัดสต็อก...' : 'ยืนยันเบิกอะไหล่ (Dual-Image)'}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </>

  );

} 