"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, X, ChevronDown } from "lucide-react";

interface BoardTypeItem {
  id: string;
  name: string;
  category?: string | null;
}

export default function InventoryFilterForm({
  initialQuery,
  initialCategory,
  initialBoardType,
  initialFilter,
}: {
  initialQuery: string;
  initialCategory: string;
  initialBoardType: string;
  initialFilter: string;
}) {
  const router = useRouter();

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [boardType, setBoardType] = useState(initialBoardType);
  const [boardTypesData, setBoardTypesData] = useState<BoardTypeItem[]>([]);

  // 📌 ดึงข้อมูลประเภทบอร์ดจากตารางกลางเมื่อโหลดคอมโพเนนต์[cite: 8]
  useEffect(() => {
    const fetchBoardTypes = async () => {
      try {
        const res = await fetch('/api/admin/board-types');
        const data = await res.json();
        if (Array.isArray(data)) {
          setBoardTypesData(data);
        }
      } catch (err) {
        console.error("Error fetching board types for filter:", err);
      }
    };
    fetchBoardTypes();
  }, []);

  // ฟังก์ชันจัดการเมื่อเปลี่ยนหมวดหมู่หลัก[cite: 8]
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCategory = e.target.value;
    setCategory(newCategory);
    setBoardType(""); // รีเซ็ตประเภทบอร์ดเมื่อเปลี่ยนหมวดหมู่[cite: 8]
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (category) params.set("category", category);
    if (boardType) params.set("boardType", boardType);
    if (initialFilter) params.set("filter", initialFilter);

    router.push(`/dashboard/inventory/boards?${params.toString()}`);
  };

  const handleClear = () => {
    setQuery("");
    setCategory("");
    setBoardType("");
    router.push(`/dashboard/inventory/boards${initialFilter ? `?filter=${initialFilter}` : ""}`);
  };

  // 📌 ระบบกรองประเภทบอร์ดให้สัมพันธ์กับหมวดหมู่ที่เลือกอย่างแม่นยำ[cite: 8]
  const filteredBoardTypes = boardTypesData.filter(item => {
    if (!category) return true;
    if (!item.category) return true;

    const dbCat = item.category.trim().toLowerCase();
    const selCat = category.trim().toLowerCase();

    // 1. ตรงกันโดยตรง[cite: 8]
    if (dbCat === selCat) return true;

    // 2. เช็คกลุ่มไมโครอินเวอร์เตอร์ (Micro Inverter) ก่อนเสมอเพื่อไม่ให้ชนกับอินเวอร์เตอร์ทั่วไป[cite: 8]
    const isDbMicro = dbCat.includes("ไมโคร") || dbCat.includes("micro");
    const isSelMicro = selCat.includes("ไมโคร") || selCat.includes("micro");
    if (isDbMicro || isSelMicro) {
      return isDbMicro && isSelMicro;
    }

    // 3. เช็คกลุ่มอินเวอร์เตอร์ทั่วไป (Inverter)[cite: 8]
    const isDbInv = dbCat.includes("อินเวอร์เตอร์") || dbCat.includes("inverter");
    const isSelInv = selCat.includes("อินเวอร์เตอร์") || selCat.includes("inverter");
    const isDbPump = dbCat.includes("ปั๊มน้ำ") || dbCat.includes("pump");
    const isSelPump = selCat.includes("ปั๊มน้ำ") || selCat.includes("pump");

    if (isDbInv && isSelInv && (!isDbPump && !isSelPump)) return true;

    // 4. เช็คกลุ่มออปติไมเซอร์ (Optimizer)[cite: 8]
    if ((dbCat.includes("ออปติไมเซอร์") || dbCat.includes("optimizer")) && 
        (selCat.includes("ออปติไมเซอร์") || selCat.includes("optimizer"))) return true;

    // 5. เช็คกลุ่มแบตเตอรี่ (Battery)[cite: 8]
    if ((dbCat.includes("แบตเตอรี่") || dbCat.includes("battery")) && 
        (selCat.includes("แบตเตอรี่") || selCat.includes("battery"))) return true;

    // 6. เช็คกลุ่มอินเวอร์เตอร์ปั๊มน้ำ (Solar Pump)[cite: 8]
    if ((dbCat.includes("ปั๊มน้ำ") || dbCat.includes("pump")) && 
        (selCat.includes("ปั๊มน้ำ") || selCat.includes("pump"))) return true;

    return false;
  });

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col lg:flex-row items-center gap-3">
      <div className="relative flex-1 w-full">
        <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาด้วยรหัสรุ่นบอร์ด, ชื่อบอร์ด หรือรุ่นเครื่องที่รองรับ..."
          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-gray-900 placeholder:text-gray-400 placeholder:font-normal"
        />
      </div>
      
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
        
        {/* ช่องที่ 1: กรองหมวดหมู่อุปกรณ์หลัก */}
        <div className="relative w-full sm:w-56">
          <select
            value={category}
            onChange={handleCategoryChange}
            className="w-full px-4 py-2.5 appearance-none bg-gray-50 border border-gray-200 rounded-xl text-base sm:text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-gray-900 cursor-pointer"
          >
            <option value="">หมวดหมู่หลักทั้งหมด</option>
            <option value="Inverter">อินเวอร์เตอร์ (Inverter)</option>
            <option value="Optimizer">ออปติไมเซอร์ (Optimizer)</option>
            <option value="Micro Inverter">ไมโครอินเวอร์เตอร์ (Micro Inverter)</option>
            <option value="Battery">แบตเตอรี่ (Battery)</option>
            <option value="Solar Pump">อินเวอร์เตอร์ปั๊มน้ำ (Solar Pump)</option>
          </select>
          <div className="absolute right-3.5 top-3 pointer-events-none text-gray-500">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

        {/* ช่องที่ 2: กรองประเภทบอร์ด (ดึงข้อมูลแบบไดนามิกจากฐานข้อมูล) */}
        <div className="relative w-full sm:w-64">
          <select
            value={boardType}
            onChange={(e) => setBoardType(e.target.value)}
            className="w-full px-4 py-2.5 appearance-none bg-gray-50 border border-gray-200 rounded-xl text-base sm:text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-gray-900 cursor-pointer"
          >
            <option value="">ประเภทบอร์ดทั้งหมด</option>
            {filteredBoardTypes.map((typeObj) => (
              <option key={typeObj.id} value={typeObj.name}>
                {typeObj.name}
              </option>
            ))}
            <option value="OTHER">OTHER (อื่นๆ / กำหนดเอง)</option>
          </select>
          <div className="absolute right-3.5 top-3 pointer-events-none text-gray-500">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="submit"
            className="flex-1 sm:flex-none px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white text-sm font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Search className="w-4 h-4" /> ค้นหา
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-bold rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
          >
            <X className="w-4 h-4 text-gray-600" /> ล้าง
          </button>
        </div>
      </div>
    </form>
  );
}