'use client';

import React, { useState } from 'react';
import WithdrawSparePartModal from './WithdrawSparePartModal';
// นำเข้าไอคอนหรือคอมโพเนนต์ส่วนอื่นๆ ตามเดิมของคุณ[cite: 8]

export default function BackupClientPage({ 
  backupData, 
  spareParts, 
  updateAction 
}: { 
  backupData: any; 
  spareParts: any[]; 
  updateAction: (id: string, formData: FormData) => Promise<any> 
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ฟังก์ชันจัดการการเบิกอะไหล่ที่เปิดการทำงาน Server Action เรียบร้อยแล้ว[cite: 8]
  const handleSparePartSubmit = async (formData: FormData) => {
    try {
      setIsSubmitting(true);
      
      // ส่งข้อมูลไปยัง Server Action พร้อมระบุ ID ของเครื่องสำรอง[cite: 8]
      await updateAction(backupData.id, formData);
      
      setIsModalOpen(false);
      alert('บันทึกข้อมูลการเบิกอะไหล่สำเร็จ');
      window.location.reload(); // รีเฟรชหน้าจอเพื่อแสดงข้อมูลล่าสุด
    } catch (error: any) {
      console.error(error);
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + (error?.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* ส่วนควบคุมสถานะด่วนด้านบน[cite: 8] */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-gray-500">สถานะปัจจุบัน</span>
          <h2 className="text-lg font-extrabold text-gray-900">{backupData.status}</h2>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center space-x-2 cursor-pointer"
        >
          <span>⚡ เบิกอะไหล่และแนบหลักฐาน</span>
        </button>
      </div>

      {/* ส่วนฟอร์มรายละเอียดเครื่องสำรองและข้อมูลอื่นๆ[cite: 8] */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-900 mb-4">ข้อมูลรายละเอียดเครื่องสำรอง</h3>
        {/* โค้ดแสดงผลข้อมูลฟอร์มเดิมของคุณ[cite: 8] */}
      </div>

      {/* Modal เบิกอะไหล่ถูกแยกออกมาเป็นระเบียบ[cite: 8] */}
      <WithdrawSparePartModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        spareParts={spareParts}
        onSubmit={handleSparePartSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}