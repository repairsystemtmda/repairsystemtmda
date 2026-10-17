import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="min-h-[70vh] w-full flex flex-col items-center justify-center space-y-3">
      <div className="relative w-12 h-12 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
        <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
        <Loader2 className="w-5 h-5 text-blue-600 animate-pulse" />
      </div>
      <p className="text-xs sm:text-sm font-bold text-gray-600 animate-pulse">กำลังโหลด...</p>
    </div>
  );
}