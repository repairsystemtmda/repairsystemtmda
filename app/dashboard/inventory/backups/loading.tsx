import { Laptop, Plus } from "lucide-react";

export default function BackupsLoading() {
  return (
    <div className="py-2 px-0 sm:px-6 w-full space-y-4 md:space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="space-y-2">
          <div className="h-7 w-64 bg-gray-200 rounded-lg"></div>
          <div className="h-4 w-96 bg-gray-100 rounded-lg"></div>
        </div>
        <div className="h-10 w-36 bg-gray-200 rounded-xl"></div>
      </div>

      {/* Filter Form Skeleton */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 h-20"></div>

      {/* Table Skeleton */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden p-4 space-y-4">
        <div className="h-10 bg-gray-100 rounded-xl w-full"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-50 rounded-xl w-full flex items-center justify-between px-4">
              <div className="h-4 w-32 bg-gray-200 rounded"></div>
              <div className="h-4 w-24 bg-gray-200 rounded"></div>
              <div className="h-4 w-28 bg-gray-200 rounded"></div>
              <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}