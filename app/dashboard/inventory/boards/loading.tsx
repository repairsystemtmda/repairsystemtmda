import { Package } from "lucide-react";

export default function InventoryLoading() {
  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-5 pb-24 animate-pulse">
      
      {/* ส่วนหัวหน้าเว็บ Skeleton */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-64 bg-gray-200 rounded-lg"></div>
          <div className="h-4 w-96 bg-gray-100 rounded-lg"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-28 bg-gray-200 rounded-xl"></div>
          <div className="h-10 w-28 bg-gray-200 rounded-xl"></div>
        </div>
      </div>

      {/* Filter Form Skeleton */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 h-24"></div>

      {/* Table / Cards Skeleton */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden p-5 space-y-4">
        <div className="h-10 bg-gray-100 rounded-xl w-full"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-50 rounded-xl w-full flex items-center justify-between px-4">
              <div className="h-4 w-28 bg-gray-200 rounded"></div>
              <div className="h-4 w-40 bg-gray-200 rounded"></div>
              <div className="h-4 w-24 bg-gray-200 rounded"></div>
              <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}