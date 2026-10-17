"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search, PlusCircle, AlertTriangle, CheckCircle2, Package, RefreshCw, Edit3, Loader2 } from "lucide-react";

interface PartData {
  boardModelCode: string;
  name: string;
  version: string;
  category: string;
  boardType: string;
  customOtherBoardType: string;
  model: string;
  location: string;
  stock: string;
  minQuantity: string;
  [key: string]: any;
}

interface BoardTypeItem {
  id: string;
  name: string;
  category?: string | null;
}

export default function RestockPage() {
  const router = useRouter();
  const [step, setStep] = useState<"input" | "restock" | "register">("input");
  const [codeQuery, setCodeQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 📌 เก็บรายการประเภทบอร์ดทั้งหมดจากฐานข้อมูล
  const [boardTypesData, setBoardTypesData] = useState<BoardTypeItem[]>([]);

  const [existingPart, setExistingPart] = useState<any>(null);
  const [formData, setFormData] = useState<PartData>({
    boardModelCode: "",
    name: "",
    version: "",
    category: "",
    boardType: "",
    customOtherBoardType: "",
    model: "",
    location: "",
    stock: "1",
    minQuantity: "5",
  });

  // 📌 ดึงข้อมูลประเภทบอร์ดจากตารางกลาง BoardType เมื่อโหลดหน้า
  useEffect(() => {
    const fetchBoardTypes = async () => {
      try {
        const res = await fetch('/api/admin/board-types');
        const data = await res.json();
        if (Array.isArray(data)) {
          setBoardTypesData(data);
        }
      } catch (err) {
        console.error("Error fetching board types for dropdown:", err);
      }
    };
    fetchBoardTypes();
  }, []);

  const handleCheckCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeQuery.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/inventory/check?code=${encodeURIComponent(codeQuery.trim())}`);
      const data = await res.json();

      if (res.ok && data.exists) {
        setExistingPart(data.part);
        const existingBoardType = data.part.boardType || "";
        const category = data.part.category || "";
        
        // เช็คว่ามีอยู่ในรายการมาตรฐานจากฐานข้อมูลไหม ถ้าไม่มีถือว่าเป็น OTHER
        const standardNames = boardTypesData.map(b => b.name);
        const isOther = existingBoardType && !standardNames.includes(existingBoardType);
        
        setFormData({
          boardModelCode: data.part.boardModelCode || codeQuery,
          name: data.part.name || "",
          version: data.part.version || "",
          category: category,
          boardType: isOther ? "OTHER" : (existingBoardType || ""),
          customOtherBoardType: isOther ? existingBoardType : "",
          model: data.part.model || "",
          location: data.part.location || "",
          stock: "1",
          minQuantity: data.part.minQuantity?.toString() || "5",
        });
        setStep("restock");
      } else {
        setFormData({
          boardModelCode: codeQuery.trim(),
          name: "",
          version: "",
          category: "",
          boardType: "",
          customOtherBoardType: "",
          model: "",
          location: "",
          stock: "1",
          minQuantity: "5",
        });
        setStep("register");
      }
    } catch {
      setErrorMsg("ไม่สามารถเชื่อมต่อกับระบบตรวจสอบได้");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "category") {
      setFormData({ ...formData, category: value, boardType: "", customOtherBoardType: "" });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const endpoint = step === "restock" ? "/api/inventory/restock" : "/api/inventory/register";

    const finalBoardType = 
      formData.boardType === "OTHER" 
        ? formData.customOtherBoardType 
        : formData.boardType;

    const payload = {
      ...formData,
      boardType: finalBoardType,
    };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }

      setSuccessMsg("✅ บันทึกข้อมูลสำเร็จเรียบร้อย!");
      setTimeout(() => {
        router.push("/dashboard/inventory/boards");
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "ไม่สามารถเชื่อมต่อกับระบบได้");
    } finally {
      setLoading(false);
    }
  };

  // 📌 ระบบกรองประเภทบอร์ดแยกหมวดหมู่อย่างแม่นยำ
  const filteredBoardTypes = boardTypesData.filter(item => {
    if (!formData.category) return true;
    if (!item.category) return true;

    const dbCat = item.category.trim().toLowerCase();
    const selCat = formData.category.trim().toLowerCase();

    // 1. ตรงกันโดยตรง
    if (dbCat === selCat) return true;

    // 2. เช็คกลุ่มไมโครอินเวอร์เตอร์ (Micro Inverter) ก่อนเสมอเพื่อไม่ให้ชนกับอินเวอร์เตอร์ทั่วไป
    const isDbMicro = dbCat.includes("ไมโคร") || dbCat.includes("micro");
    const isSelMicro = selCat.includes("ไมโคร") || selCat.includes("micro");
    if (isDbMicro || isSelMicro) {
      return isDbMicro && isSelMicro;
    }

    // 3. เช็คกลุ่มอินเวอร์เตอร์ทั่วไป (Inverter)
    const isDbInv = dbCat.includes("อินเวอร์เตอร์") || dbCat.includes("inverter");
    const isSelInv = selCat.includes("อินเวอร์เตอร์") || selCat.includes("inverter");
    const isDbPump = dbCat.includes("ปั๊มน้ำ") || dbCat.includes("pump");
    const isSelPump = selCat.includes("ปั๊มน้ำ") || selCat.includes("pump");

    if (isDbInv && isSelInv && (!isDbPump && !isSelPump)) return true;

    // 4. เช็คกลุ่มออปติไมเซอร์ (Optimizer)
    if ((dbCat.includes("ออปติไมเซอร์") || dbCat.includes("optimizer")) && 
        (selCat.includes("ออปติไมเซอร์") || selCat.includes("optimizer"))) return true;

    // 5. เช็คกลุ่มแบตเตอรี่ (Battery)
    if ((dbCat.includes("แบตเตอรี่") || dbCat.includes("battery")) && 
        (selCat.includes("แบตเตอรี่") || selCat.includes("battery"))) return true;

    // 6. เช็คกลุ่มอินเวอร์เตอร์ปั๊มน้ำ (Solar Pump)
    if ((dbCat.includes("ปั๊มน้ำ") || dbCat.includes("pump")) && 
        (selCat.includes("ปั๊มน้ำ") || selCat.includes("pump"))) return true;

    return false;
  });

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-3 sm:p-6 pb-24 text-black">
      <div className="max-w-2xl mx-auto space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/inventory/boards" className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition text-gray-600 no-underline flex items-center justify-center">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <Package className="w-6 h-6 text-blue-600 flex-shrink-0" /> เติมสต็อก / ลงทะเบียน
              </h1>
              <p className="text-xs sm:text-sm font-bold text-gray-500 mt-0.5">ระบบจัดการอะไหล่และบอร์ดอัตโนมัติ</p>
            </div>
          </div>
          {step !== "input" && (
            <button
              onClick={() => { setStep("input"); setCodeQuery(""); }}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition cursor-pointer shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" /> เปลี่ยนรหัส
            </button>
          )}
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 px-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold ${step === "input" ? "bg-blue-600 text-white" : "bg-emerald-100 text-emerald-800"}`}>
            <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
            ตรวจสอบรหัส
          </div>
          <div className="w-6 h-0.5 bg-gray-300"></div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold ${step !== "input" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"}`}>
            <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
            {step === "restock" ? "เติมสต็อก" : "ลงทะเบียน"}
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 text-sm font-bold shadow-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-700 text-sm font-black shadow-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Step 1: Input / Search */}
        {step === "input" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-8 space-y-5">
            <div className="p-4 bg-blue-50/80 border border-blue-100 rounded-xl text-blue-900 text-xs sm:text-sm space-y-1.5 font-bold leading-relaxed">
              <p className="flex items-center gap-1.5">💡 คำแนะนำการใช้งาน</p>
              <p>• พิมพ์หรือสแกนรหัสรุ่นบอร์ด / QR Code</p>
              <p>• ระบบจะตรวจสอบให้อัตโนมัติว่าเป็นบอร์ดเดิมหรือบอร์ดใหม่</p>
            </div>

            <form onSubmit={handleCheckCode} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-900">
                  รหัสรุ่นบอร์ด / รหัสอะไหล่ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={codeQuery}
                  onChange={(e) => setCodeQuery(e.target.value)}
                  placeholder="เช่น 20110101100361"
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-base focus:bg-white focus:border-blue-600 outline-none font-mono font-bold text-gray-900 shadow-2xs"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl shadow-md transition ${
                  loading ? "bg-blue-400 cursor-not-allowed opacity-80" : "bg-blue-600 hover:bg-blue-700 cursor-pointer"
                } text-white font-extrabold text-base`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>กำลังตรวจสอบระบบ...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    <span>ตรวจสอบรหัส</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Step 2.1: Restock (Existing Part) */}
        {step === "restock" && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-8 space-y-6">
            <div className="p-4 rounded-xl text-sm font-black bg-amber-50 text-amber-900 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
              <span>📦 พบบอร์ดนี้ในคลังแล้ว</span>
              <span className="text-xs bg-amber-200/80 px-3 py-1.5 rounded-lg font-mono font-black w-fit">
                คงเหลือปัจจุบัน: {existingPart?.stock || 0} ชิ้น
              </span>
            </div>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2.5 text-sm font-bold text-gray-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><span className="text-gray-500">รหัสรุ่น:</span> <span className="font-mono font-black text-gray-900">{formData.boardModelCode}</span></div>
                <div><span className="text-gray-500">ชื่อบอร์ด:</span> <span className="font-black text-gray-900">{formData.name}</span></div>
                <div><span className="text-gray-500">หมวดหมู่:</span> <span className="font-black text-gray-900">{formData.category || "-"}</span></div>
                <div><span className="text-gray-500">ตำแหน่งจัดเก็บ:</span> <span className="font-black text-gray-900">{formData.location || "-"}</span></div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-900">
                จำนวนที่ต้องการเพิ่มเข้าคลัง <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="stock"
                required
                min="1"
                value={formData.stock}
                onChange={handleChange}
                className="w-full px-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-xl focus:bg-white focus:border-blue-600 outline-none text-gray-900 font-black text-center shadow-2xs"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl shadow-md transition ${
                loading ? "bg-amber-400 cursor-not-allowed opacity-80" : "bg-amber-600 hover:bg-amber-700 cursor-pointer"
              } text-white font-extrabold text-base`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-5 h-5" />
                  <span>ยืนยันเติมสต็อกเข้าคลัง</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Step 2.2: Register (New Part) */}
        {step === "register" && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-8 space-y-5">
            <div className="p-4 rounded-xl text-sm font-black bg-blue-50 text-blue-900 border border-blue-200 shadow-2xs">
              ✨ ไม่พบรหัสนี้ในระบบ (กรอกข้อมูลเพื่อลงทะเบียนใหม่)
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-900">
                  รหัสรุ่นบอร์ดใช้งานจริง <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="boardModelCode"
                  required
                  value={formData.boardModelCode}
                  onChange={handleChange}
                  placeholder="เลขบอร์ด QR code บรรทัดที่ 2"
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-mono font-bold text-gray-900 focus:border-blue-600 outline-none shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-900">
                  ชื่อบอร์ดอะไหล่ (ตั้งชื่ออิสระได้ตามต้องการ) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="เช่น Main Control Board ซ่อมพิเศษ"
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:border-blue-600 outline-none shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-900">เวอร์ชัน (Version)</label>
                <input
                  type="text"
                  name="version"
                  value={formData.version}
                  onChange={handleChange}
                  placeholder="เช่น V1.2"
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:border-blue-600 outline-none shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-900">
                  หมวดหมู่อุปกรณ์ <span className="text-red-500">*</span>
                </label>
                <select
                  name="category"
                  required
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:border-blue-600 outline-none shadow-2xs"
                >
                  <option value="">-- กรุณาเลือกหมวดหมู่ --</option>
                  <option value="Inverter">อินเวอร์เตอร์ (Inverter)</option>
                  <option value="Optimizer">ออปติไมเซอร์ (Optimizer)</option>
                  <option value="Micro Inverter">ไมโครอินเวอร์เตอร์ (Micro Inverter)</option>
                  <option value="Battery">แบตเตอรี่ (Battery)</option>
                  <option value="Solar Pump">อินเวอร์เตอร์ปั๊มน้ำ (Solar Pump)</option>
                </select>
              </div>

              {/* Board Type Selection (Dropdown ทุกหมวดหมู่) */}
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-900">ประเภทบอร์ดมาตรฐาน (Board Type)</label>
                <div className="space-y-2">
                  <select
                    name="boardType"
                    required
                    value={formData.boardType}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:border-blue-600 outline-none shadow-2xs"
                  >
                    <option value="">-- เลือกประเภทบอร์ดมาตรฐาน --</option>
                    {filteredBoardTypes.map((typeObj) => (
                      <option key={typeObj.id} value={typeObj.name}>{typeObj.name}</option>
                    ))}
                    <option value="OTHER">OTHER (บอร์ดเสริม / อื่นๆ / กำหนดเอง)</option>
                  </select>

                  {formData.boardType === "OTHER" && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="p-2 bg-blue-50 border border-blue-200 rounded-xl text-blue-600 flex-shrink-0">
                        <Edit3 className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        name="customOtherBoardType"
                        required
                        value={formData.customOtherBoardType}
                        onChange={handleChange}
                        placeholder="กรอกชื่อประเภทบอร์ดอื่นๆ..."
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:border-blue-600 outline-none shadow-2xs"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-900">รุ่นเครื่องที่รองรับ</label>
                <input
                  type="text"
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                  placeholder="เช่น SUN-5K-SG05LP1-EU-SM2"
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:border-blue-600 outline-none shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-900">ตำแหน่งจัดเก็บ</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="เช่น A-01, Shelf 2"
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:border-blue-600 outline-none shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-gray-900">
                    จำนวนเริ่มต้น <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="stock"
                    required
                    min="1"
                    value={formData.stock}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-black text-gray-900 focus:border-blue-600 outline-none shadow-2xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-gray-900">แจ้งเตือนขั้นต่ำ</label>
                  <input
                    type="number"
                    name="minQuantity"
                    required
                    min="0"
                    value={formData.minQuantity}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-black text-gray-900 focus:border-blue-600 outline-none shadow-2xs"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl shadow-md mt-4 transition ${
                loading ? "bg-blue-400 cursor-not-allowed opacity-80" : "bg-blue-600 hover:bg-blue-700 cursor-pointer"
              } text-white font-extrabold text-base`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-5 h-5" />
                  <span>บันทึกข้อมูลลงคลัง</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}