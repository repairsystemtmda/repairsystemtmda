import { Laptop, Plus } from "lucide-react";

export default function BackupsLoading() {
  return (
    <div className="py-2 px-0 sm:px-6 w-full space-y-4 md:space-y-6">
      
      {/* ส่วนหัวหน้าเว็บ (แสดงนิ่งๆ ไม่กกระพริบ เพื่อความรู้สึกว่าเว็บไว) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Laptop className="w-6 h-6 md:w-7 md:h-7 text-blue-600 shrink-0" /> เครื่องสำรอง (Backup Inverters)
          </h1>
          <p className="text-xs md:text-sm font-semibold text-gray-500 mt-1">ติดตามและจัดการสถานะเครื่องสำรองสำหรับการสับเปลี่ยนให้ลูกค้า</p>
        </div>
        
        <div className="w-full sm:w-auto">
          <div className="h-10 w-36 bg-blue-100 rounded-xl animate-pulse"></div>
        </div>
      </div>

      {/* ส่วนฟอร์มกรองข้อมูล */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 h-20 animate-pulse bg-gray-50"></div>

      {/* ส่วนตารางรายการที่จะให้วิ่งเป็นโครงกระดูก (Skeleton) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden p-5 space-y-4 animate-pulse">
        <div className="h-8 bg-gray-100 rounded-xl w-1/4"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-50 rounded-xl w-full flex items-center justify-between px-4">
              <div className="space-y-2">
                <div className="h-4 w-32 bg-gray-200 rounded"></div>
                <div className="h-3 w-20 bg-gray-100 rounded"></div>
              </div>
              <div className="h-4 w-40 bg-gray-200 rounded hidden sm:block"></div>
              <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}