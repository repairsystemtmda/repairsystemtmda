"use client";

import { Search, X, Plus } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

interface FilterBarProps {
  searchPlaceholder?: string;
  statuses?: { label: string; value: string }[];
  categories?: { label: string; value: string }[];
  actionLabel?: string;
  actionHref?: string;
}

export default function FilterBar({
  searchPlaceholder = "ค้นหา...",
  statuses = [],
  categories = [],
  actionLabel,
  actionHref,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleClear = () => {
    setSearch("");
    setStatus("");
    setCategory("");
    router.push(pathname);
  };

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-4 border rounded-xl shadow-sm">
      <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2 w-full md:w-auto flex-1">
        {/* ช่องค้นหา */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* ตัวกรองสถานะ */}
        {statuses.length > 0 && (
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">สถานะทั้งหมด</option>
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        )}

        {/* ตัวกรองหมวดหมู่ */}
        {categories.length > 0 && (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">หมวดหมู่ทั้งหมด</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        )}

        {/* ปุ่มค้นหา */}
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"
        >
          <Search className="w-4 h-4" /> ค้นหา
        </button>

        {/* ปุ่มล้างค่า */}
        {(search || status || category) && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition"
          >
            <X className="w-4 h-4" /> ล้าง
          </button>
        )}
      </form>

      {/* ปุ่มสร้างรายการใหม่ */}
      {actionLabel && actionHref && (
        <a
          href={actionHref}
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> {actionLabel}
        </a>
      )}
    </div>
  );
}