"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Camera, Upload, Box, Wifi, Activity, Cpu, FileText, X, ScanLine, Tag, Loader2, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// กำหนดค่า Supabase Client สำหรับอัปโหลดตรงฝั่งหน้าบ้าน
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
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
            if (!blob) {
              reject(new Error('Canvas is empty'));
              return;
            }
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          0.7
        );
      };
      img.onerror = (error) => reject(error);
    };
  });
}

export default function NewJobPage() {
  const router = useRouter();
  
  const [category, setCategory] = useState("อินเวอร์เตอร์");
  const [brandsList, setBrandsList] = useState<{ id: string; name: string; category?: string | null }[]>([]);
  const [brand, setBrand] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [hasBox, setHasBox] = useState(false);
  const [hasWifiDongle, setHasWifiDongle] = useState(false);
  const [initialStatus, setInitialStatus] = useState("PENDING");
  
  const [backupCategoryFilter, setBackupCategoryFilter] = useState("อินเวอร์เตอร์");
  const [backupBrandFilter, setBackupBrandFilter] = useState("");
  const [allBackupDevices, setAllBackupDevices] = useState<any[]>([]);
  const [selectedBackupDevice, setSelectedBackupDevice] = useState("");
  
  const [nameplateFile, setNameplateFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loadingText, setLoadingText] = useState("กำลังเตรียมข้อมูล...");

  const [currentUser, setCurrentUser] = useState({
    id: "",
    name: "กำลังโหลด...",
  });

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((session) => {
        if (session?.user) {
          const u = session.user as any;
          const userName = u.name || u.username || u.email || "adminTMDA";
          const userId = u.id || userName;
          setCurrentUser({
            id: userId,
            name: userName,
          });
        }
      })
      .catch((err) => {
        console.error("Failed to fetch session:", err);
      });

    fetch("/api/admin/brands")
      .then(async (res) => {
        if (!res.ok) throw new Error("API Error");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setBrandsList(data);
          const filtered = data.filter((b: any) => (b.category || "อินเวอร์เตอร์") === category);
          if (filtered.length > 0) {
            setBrand(filtered[0].name);
          } else {
            setBrand("OTHER");
          }
        }
      })
      .catch((err) => {
        console.error("Error fetching brands:", err);
      });

    fetch("/api/inventory/backups")
      .then(async (res) => {
        if (res.ok) return res.json();
        return fetch("/api/backups").then(r => r.json());
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setAllBackupDevices(data);
        } else if (data && Array.isArray(data.devices)) {
          setAllBackupDevices(data.devices);
        }
      })
      .catch((err) => {
        console.error("Error fetching backup devices:", err);
      });
  }, []);

  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    const filtered = brandsList.filter((b) => (b.category || "อินเวอร์เตอร์") === newCat);
    if (filtered.length > 0) {
      setBrand(filtered[0].name);
    } else {
      setBrand("OTHER");
    }
    
    if (newCat !== "อินเวอร์เตอร์" && newCat !== "Inverter") {
      setHasWifiDongle(false);
    }
  };

  const filteredBackupDevices = allBackupDevices.filter((dev) => {
    const statusUpper = (dev.status || '').toUpperCase();
    const isAvailable = statusUpper === 'AVAILABLE' || statusUpper === 'READY';
    if (!isAvailable) return false;

    let matchCat = true;
    if (backupCategoryFilter) {
      const selectedCatClean = backupCategoryFilter.split(' ')[0].trim().toLowerCase();
      const devCatClean = (dev.category || '').split(' ')[0].trim().toLowerCase();
      matchCat = !devCatClean || devCatClean.includes(selectedCatClean) || selectedCatClean.includes(devCatClean);
    }

    let matchBrand = true;
    if (backupBrandFilter) {
      const devBrandName = typeof dev.brand === 'object' ? dev.brand?.name : (dev.brandName || dev.brand || dev.brandId || '');
      matchBrand = !devBrandName || String(devBrandName).toLowerCase() === String(backupBrandFilter).toLowerCase();
    }

    return matchCat && matchBrand;
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formElement = e.currentTarget;
    const isDirectLoan = initialStatus === "IN_USE_BACKUP";

    if (isDirectLoan) {
      if (!selectedBackupDevice) {
        alert("กรุณาเลือกเครื่องสำรองที่จะปล่อยให้ยืม");
        return;
      }
    } else {
      const actualBrand = brand === "OTHER" ? (formElement.elements.namedItem("customBrand") as HTMLInputElement)?.value.trim() : brand;
      if (!actualBrand) {
        alert("กรุณาระบุชื่อแบรนด์อุปกรณ์");
        return;
      }

      const requiresNameplate = (category === "อินเวอร์เตอร์" || category === "Inverter") && (actualBrand === "Deye" || actualBrand === "TMDA");
      if (requiresNameplate && !nameplateFile) {
        alert("กรุณาแนบรูปถ่ายเนมเพลท (Nameplate / ป้าย S/N) สำหรับออกรายงาน Deye/TMDA");
        return;
      }

      if (selectedFiles.length === 0) {
        alert("กรุณาแนบรูปถ่ายสภาพเครื่องและหลักฐานทั่วไปอย่างน้อย 1 รูปก่อนบันทึกเปิดใบงาน");
        return;
      }
    }

    setIsSubmitting(true);
    setUploadProgress(10);
    setLoadingText("กำลังตรวจสอบข้อมูลฟอร์ม...");

    try {
      const formDataObj = new FormData(formElement);
      const actualBrand = brand === "OTHER" ? String(formDataObj.get("customBrand") || "").trim() : brand;

      const payload: any = {
        status: initialStatus,
        category,
        brand: actualBrand,
        customerName: String(formDataObj.get("customerName") || ""),
        phone: String(formDataObj.get("phone") || ""),
        model: String(formDataObj.get("model") || ""),
        serialNumber: String(formDataObj.get("serialNumber") || ""),
        productNo: String(formDataObj.get("productNo") || ""),
        newSerialNumber: String(formDataObj.get("newSerialNumber") || ""),
        wifiDongleSn: String(formDataObj.get("wifiDongleSn") || ""),
        note: String(formDataObj.get("note") || ""),
        hasBox,
        hasWifiDongle: (category === "อินเวอร์เตอร์" || category === "Inverter") && hasWifiDongle,
        userId: currentUser.id,
        userName: currentUser.name,
        receiverName: currentUser.name,
        backupDeviceId: isDirectLoan ? selectedBackupDevice : undefined,
        imageUrl: null,
        images: [],
      };

      if (!isDirectLoan) {
        // 1. อัปโหลดรูปเนมเพลทไปยัง Supabase Storage (ถ้ามี)
        if (nameplateFile) {
          setUploadProgress(30);
          setLoadingText("กำลังอัปโหลดรูปเนมเพลทไปยัง Supabase Storage...");
          const compressedNameplate = await compressImage(nameplateFile);
          const fileName = `nameplate-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
          
          const { error: uploadError } = await supabase.storage
            .from("repair-images")
            .upload(fileName, compressedNameplate, { contentType: "image/jpeg" });

          if (uploadError) {
            throw new Error("อัปโหลดรูปเนมเพลทไม่สำเร็จ: " + uploadError.message);
          }

          const { data: publicUrlData } = supabase.storage
            .from("repair-images")
            .getPublicUrl(fileName);

          payload.imageUrl = publicUrlData.publicUrl;
        }

        // 2. อัปโหลดรูปภาพหลักฐานอื่นๆ ไปยัง Supabase Storage
        if (selectedFiles.length > 0) {
          setUploadProgress(50);
          setLoadingText("กำลังบีบอัดและอัปโหลดรูปภาพหลักฐาน...");

          const uploadedUrls: string[] = [];
          for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const compressed = await compressImage(file);
            const fileName = `job-${Date.now()}-${i}-${Math.round(Math.random() * 1e9)}.jpg`;

            const { error: uploadError } = await supabase.storage
              .from("repair-images")
              .upload(fileName, compressed, { contentType: "image/jpeg" });

            if (uploadError) {
              throw new Error(`อัปโหลดรูปที่ ${i + 1} ไม่สำเร็จ: ` + uploadError.message);
            }

            const { data: publicUrlData } = supabase.storage
              .from("repair-images")
              .getPublicUrl(fileName);

            uploadedUrls.push(publicUrlData.publicUrl);
          }
          payload.images = uploadedUrls;
        }
      }
      
      setUploadProgress(80);
      setLoadingText("กำลังบันทึกข้อมูลเข้าสู่ระบบ...");

      // ส่งข้อมูลแบบ JSON ไปยัง API
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      setUploadProgress(100);
      setLoadingText("บันทึกสำเร็จ กำลังพาท่านไปหน้าหลัก...");

      if (response.ok) {
        setTimeout(() => {
          window.location.href = isDirectLoan ? "/dashboard/inventory/backups" : "/dashboard/jobs";
        }, 500);
      } else {
        const text = await response.text();
        let errorMsg = "เกิดข้อผิดพลาดในการบันทึกข้อมูล";
        try {
          const errorData = JSON.parse(text);
          errorMsg = errorData.error || errorMsg;
        } catch {
          errorMsg = text || errorMsg;
        }
        alert(errorMsg);
        setIsSubmitting(false);
        setUploadProgress(0);
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const effectiveBrand = brand === "OTHER" ? customBrand : brand;
  const isDeyeOrTmdaInverter = (category === "อินเวอร์เตอร์" || category === "Inverter") && (effectiveBrand === "Deye" || effectiveBrand === "TMDA");
  const filteredBrands = brandsList.filter((b) => (b.category || "อินเวอร์เตอร์") === category);
  const backupFilteredBrands = brandsList.filter((b) => (b.category || "อินเวอร์เตอร์") === backupCategoryFilter);

  const isDirectLoanMode = initialStatus === "IN_USE_BACKUP";

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-3 sm:p-6 pb-24 w-full relative">
      
      {isSubmitting && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-8 w-full max-w-md text-center space-y-5">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
              <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
              <Loader2 className="w-6 h-6 text-blue-600 animate-pulse" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">{loadingText}</h3>
              <p className="text-xs sm:text-sm text-gray-500">กรุณารอสักครู่ ระบบกำลังอัปโหลดรูปภาพและบันทึกข้อมูล</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-blue-600">สถานะการทำงาน</span>
                <span className="text-gray-900">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden p-0.5 border border-gray-200">
                <div 
                  className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-5xl mx-auto space-y-5">
        
        <div className="flex items-center gap-3 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200">
          <Link
            href="/dashboard/jobs"
            className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition shadow-sm text-gray-600 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 leading-tight">
                {isDirectLoanMode ? "เปิดรายการยืมเครื่องสำรอง (Direct Loan / VVVIP)" : "เปิดใบงานซ่อมใหม่ (New Repair Job)"}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                {isDirectLoanMode ? "บันทึกข้อมูลการปล่อยยืมเครื่องสำรองให้ลูกค้าโดยตรง" : "ระบบบันทึกข้อมูลเครื่องส่งซ่อมและการเคลมอุปกรณ์"}
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl text-xs text-blue-800 font-medium self-start sm:self-auto">
              ผู้ทำรายการ: <span className="font-bold">{currentUser.name}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            <input type="hidden" name="userId" value={currentUser.id} />
            <input type="hidden" name="receiverName" value={currentUser.name} />

            <div className="p-3.5 sm:p-4 bg-amber-50/50 border border-amber-200 rounded-xl space-y-3">
              <label className="block text-xs sm:text-sm font-semibold text-amber-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-600 shrink-0" /> ประเภทรายการ / สถานะเริ่มต้น (Job Status) *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                
                <label className={`flex flex-col p-3 border rounded-xl cursor-pointer transition ${initialStatus === 'PENDING' ? 'bg-white border-amber-500 ring-2 ring-amber-400/20 shadow-sm' : 'bg-white/60 border-gray-200 hover:bg-white'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="status"
                      value="PENDING"
                      checked={initialStatus === 'PENDING'}
                      onChange={(e) => setInitialStatus(e.target.value)}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-xs font-bold text-gray-800">PENDING</span>
                  </div>
                  <span className="text-[11px] text-gray-500 pl-5">รอซ่อม / รับเรื่องใหม่</span>
                </label>

                <label className={`flex flex-col p-3 border rounded-xl cursor-pointer transition ${initialStatus === 'IN_USE_BACKUP' ? 'bg-white border-amber-500 ring-2 ring-amber-400/20 shadow-sm' : 'bg-white/60 border-gray-200 hover:bg-white'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="status"
                      value="IN_USE_BACKUP"
                      checked={initialStatus === 'IN_USE_BACKUP'}
                      onChange={(e) => setInitialStatus(e.target.value)}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-xs font-bold text-gray-800">IN_USE_BACKUP</span>
                  </div>
                  <span className="text-[11px] text-gray-500 pl-5">ยืมเครื่องสำรองชั่วคราว (VVVIP)</span>
                </label>

                <label className={`flex flex-col p-3 border rounded-xl cursor-pointer transition ${initialStatus === 'COMPLETED_BY_DEYE' ? 'bg-white border-amber-500 ring-2 ring-amber-400/20 shadow-sm' : 'bg-white/60 border-gray-200 hover:bg-white'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="status"
                      value="COMPLETED_BY_DEYE"
                      checked={initialStatus === 'COMPLETED_BY_DEYE'}
                      onChange={(e) => setInitialStatus(e.target.value)}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-xs font-bold text-gray-800">COMPLETED_BY_DEYE</span>
                  </div>
                  <span className="text-[11px] text-gray-500 pl-5">รับเครื่องซ่อมเสร็จจาก Deye</span>
                </label>

                <label className={`flex flex-col p-3 border rounded-xl cursor-pointer transition ${initialStatus === 'CLAIM_NEW_MACHINE' ? 'bg-white border-amber-500 ring-2 ring-amber-400/20 shadow-sm' : 'bg-white/60 border-gray-200 hover:bg-white'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="status"
                      value="CLAIM_NEW_MACHINE"
                      checked={initialStatus === 'CLAIM_NEW_MACHINE'}
                      onChange={(e) => setInitialStatus(e.target.value)}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-xs font-bold text-gray-800">CLAIM_NEW_MACHINE</span>
                  </div>
                  <span className="text-[11px] text-gray-500 pl-5">เคลมเครื่องใหม่</span>
                </label>

              </div>
            </div>

            {isDirectLoanMode ? (
              <div className="space-y-4 border-2 border-blue-200 bg-blue-50/30 p-4 sm:p-6 rounded-2xl">
                
                <div className="p-4 bg-white border border-blue-200 rounded-xl space-y-3 shadow-sm">
                  <label className="block text-xs sm:text-sm font-semibold text-blue-900 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-blue-600 shrink-0" /> เลือกเครื่องสำรองที่พร้อมใช้งาน *
                  </label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">กรองตามหมวดหมู่:</label>
                      <select
                        value={backupCategoryFilter}
                        onChange={(e) => {
                          setBackupCategoryFilter(e.target.value);
                          setBackupBrandFilter("");
                        }}
                        className="w-full px-3 py-2 bg-gray-50 text-gray-900 border border-gray-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">-- แสดงทุกหมวดหมู่ --</option>
                        <option value="อินเวอร์เตอร์">อินเวอร์เตอร์ (Inverter)</option>
                        <option value="ออปติไมเซอร์">ออปติไมเซอร์ (Optimizer)</option>
                        <option value="ไมโครอินเวอร์เตอร์">ไมโครอินเวอร์เตอร์ (Micro Inverter)</option>
                        <option value="แบตเตอรี่">แบตเตอรี่ (Battery)</option>
                        <option value="อินเวอร์เตอร์ปั๊มน้ำ">อินเวอร์เตอร์ปั๊มน้ำ (Solar Pump)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">กรองตามแบรนด์:</label>
                      <select
                        value={backupBrandFilter}
                        onChange={(e) => setBackupBrandFilter(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 text-gray-900 border border-gray-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">-- แสดงทุกแบรนด์ --</option>
                        {backupFilteredBrands.map((b) => (
                          <option key={b.id} value={b.name}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">เลือกเครื่องสำรองจากผลการกรอง (พร้อมใช้งาน {filteredBackupDevices.length} รายการ) *:</label>
                    <select
                      name="backupDeviceId"
                      required
                      value={selectedBackupDevice}
                      onChange={(e) => setSelectedBackupDevice(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white text-gray-900 border border-blue-400 rounded-xl text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">-- กรุณาเลือกเครื่องสำรอง --</option>
                      {filteredBackupDevices.map((device) => (
                        <option key={device.id} value={device.id}>
                          [{device.serialNumber || device.code || 'ไม่มี S/N'}] - {device.model} ({typeof device.brand === 'object' ? device.brand?.name : (device.brand || 'ไม่ระบุแบรนด์')})
                        </option>
                      ))}
                    </select>
                    {filteredBackupDevices.length === 0 && (
                      <p className="text-[11px] text-red-600 mt-1 font-semibold">
                        ❌ ไม่พบเครื่องสำรองที่พร้อมใช้งานในคลัง กรุณาตรวจสอบสถานะเครื่องสำรองในเมนูเครื่องสำรอง
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-blue-200 space-y-3 shadow-sm">
                  <label className="block text-xs sm:text-sm font-semibold text-blue-900 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-600 shrink-0" /> ข้อมูลผู้ยืม (แสดงผลที่หน้ารายการเครื่องสำรอง)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        ชื่อลูกค้าผู้ยืม *
                      </label>
                      <input
                        type="text"
                        name="customerName"
                        required
                        placeholder="เช่น คุณสมชาย (VVVIP)"
                        className="w-full px-3.5 py-3 bg-white text-gray-900 border border-gray-300 rounded-xl text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        เบอร์โทรศัพท์ติดต่อ *
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        required
                        placeholder="เช่น 0812345678"
                        className="w-full px-3.5 py-3 bg-white text-gray-900 border border-gray-300 rounded-xl text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    หมายเหตุเพิ่มเติม (ถ้ามี)
                  </label>
                  <textarea
                    name="note"
                    rows={2}
                    placeholder="ระบุเหตุผลหรือหมายเหตุการยืม..."
                    className="w-full px-3.5 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-xl text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition"
                  />
                </div>

              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                      หมวดหมู่อุปกรณ์ *
                    </label>
                    <select
                      name="category"
                      value={category}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full px-3.5 py-3 bg-white text-gray-900 border border-gray-300 rounded-xl text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition"
                    >
                      <option value="อินเวอร์เตอร์">☀️ อินเวอร์เตอร์ (Inverter)</option>
                      <option value="ออปติไมเซอร์">🎛️ ออปติไมเซอร์ (Optimizer)</option>
                      <option value="ไมโครอินเวอร์เตอร์">🔆 ไมโครอินเวอร์เตอร์ (Micro Inverter)</option>
                      <option value="แบตเตอรี่">🔋 แบตเตอรี่ (Battery)</option>
                      <option value="อินเวอร์เตอร์ปั๊มน้ำ">💧 อินเวอร์เตอร์ปั๊มน้ำ (Solar Pump)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                      แบรนด์อุปกรณ์ *
                    </label>
                    <select
                      name="brand"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="w-full px-3.5 py-3 bg-white text-gray-900 border border-gray-300 rounded-xl text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition"
                    >
                      {filteredBrands.length > 0 ? (
                        filteredBrands.map((b) => (
                          <option key={b.id} value={b.name}>
                            {b.name}
                          </option>
                        ))
                      ) : (
                        <option value="" disabled>-- ยังไม่มีแบรนด์ในหมวดหมู่นี้ --</option>
                      )}
                      <option value="OTHER">อื่นๆ (ระบุชื่อแบรนด์)</option>
                    </select>
                  </div>
                </div>

                {brand === "OTHER" && (
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                      ระบุชื่อแบรนด์อื่นๆ *
                    </label>
                    <input
                      type="text"
                      name="customBrand"
                      value={customBrand}
                      onChange={(e) => setCustomBrand(e.target.value)}
                      required
                      placeholder="กรุณากรอกชื่อแบรนด์..."
                      className="w-full px-3.5 py-3 bg-white text-gray-900 border border-gray-300 rounded-xl text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                      ชื่อลูกค้า / ผู้ส่งซ่อม *
                    </label>
                    <input
                      type="text"
                      name="customerName"
                      required
                      placeholder="เช่น คุณสมชาย ใจดี"
                      className="w-full px-3.5 py-3 bg-white text-gray-900 border border-gray-300 rounded-xl text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                      เบอร์โทรศัพท์ติดต่อ
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      placeholder="เช่น 0812345678"
                      className="w-full px-3.5 py-3 bg-white text-gray-900 border border-gray-300 rounded-xl text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                      รุ่นเครื่อง (Model)
                    </label>
                    <input
                      type="text"
                      name="model"
                      placeholder="เช่น SUN2000-5KTL"
                      className="w-full px-3.5 py-3 bg-white text-gray-900 border border-gray-300 rounded-xl text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
                      <span>
                        {(category === "ออปติไมเซอร์" || initialStatus === "CLAIM_NEW_MACHINE")
                          ? "Serial Number (S/N) ตัวเก่าที่เสีย *"
                          : "Serial Number (S/N) *"}
                      </span>
                      <span className="text-[11px] text-blue-600 font-medium flex items-center gap-1">
                        <ScanLine className="w-3.5 h-3.5" /> รองรับสแกน
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        name="serialNumber"
                        required
                        placeholder="สแกนหรือระบุ S/N..."
                        className="w-full pl-3.5 pr-10 py-3 bg-white text-gray-900 border border-gray-300 rounded-xl text-xs sm:text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                        <ScanLine className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>

                {(category === "อินเวอร์เตอร์") && (effectiveBrand === "Deye" || effectiveBrand === "TMDA") && (
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
                      <span>Product No. (สำหรับ Export ข้อมูล) *</span>
                      <span className="text-[11px] text-blue-600 font-medium flex items-center gap-1">
                        <ScanLine className="w-3.5 h-3.5" /> รองรับสแกน
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        name="productNo"
                        required
                        placeholder="กรอกหรือสแกน Product No...."
                        className="w-full pl-3.5 pr-10 py-3 bg-white text-gray-900 border border-gray-300 rounded-xl text-xs sm:text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                        <ScanLine className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                )}

                {(category === "ออปติไมเซอร์" || initialStatus === "CLAIM_NEW_MACHINE") && (
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
                      <span>Serial Number (S/N) ตัวใหม่ที่เคลมให้ *</span>
                      <span className="text-[11px] text-blue-600 font-medium flex items-center gap-1">
                        <ScanLine className="w-3.5 h-3.5" /> รองรับสแกน
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        name="newSerialNumber"
                        required
                        placeholder="สแกน S/N ตัวใหม่..."
                        className="w-full pl-3.5 pr-10 py-3 bg-white text-gray-900 border border-gray-300 rounded-xl text-xs sm:text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                        <ScanLine className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3 p-3.5 sm:p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700">
                    อุปกรณ์เสริมที่ติดมากับเครื่อง
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition shadow-sm">
                      <input
                        type="checkbox"
                        checked={hasBox}
                        onChange={(e) => setHasBox(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 shrink-0"
                      />
                      <span className="text-xs sm:text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                        <Box className="w-4 h-4 text-amber-600 shrink-0" /> มีกล่องอุปกรณ์มาด้วย
                      </span>
                    </label>

                    {category === "อินเวอร์เตอร์" && (
                      <label className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition shadow-sm">
                        <input
                          type="checkbox"
                          checked={hasWifiDongle}
                          onChange={(e) => setHasWifiDongle(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 shrink-0"
                        />
                        <span className="text-xs sm:text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                          <Wifi className="w-4 h-4 text-emerald-600 shrink-0" /> มี WiFi Dongle มาด้วย
                        </span>
                      </label>
                    )}
                  </div>

                  {category === "อินเวอร์เตอร์" && hasWifiDongle && (
                    <div className="pt-2">
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
                        <span>Serial Number ของ WiFi Dongle *</span>
                        <span className="text-[11px] text-blue-600 font-medium flex items-center gap-1">
                          <ScanLine className="w-3.5 h-3.5" /> รองรับสแกน
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          name="wifiDongleSn"
                          required={hasWifiDongle}
                          placeholder="สแกนหรือระบุ S/N WiFi Dongle..."
                          className="w-full pl-3.5 pr-10 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-xl text-xs sm:text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none transition"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                          <ScanLine className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {isDeyeOrTmdaInverter && (
                  <div className="p-3.5 sm:p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-3">
                    <label className="block text-xs sm:text-sm font-semibold text-indigo-900 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-indigo-600 shrink-0" /> รูปถ่ายเนมเพลท (Nameplate) <span className="text-red-500">*</span>
                    </label>
                    
                    {!nameplateFile ? (
                      <label className="border-2 border-dashed border-indigo-300 bg-white rounded-xl p-4 text-center hover:bg-indigo-50/30 transition cursor-pointer block">
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="sr-only"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setNameplateFile(e.target.files[0]);
                            }
                          }}
                        />
                        <div className="flex flex-col items-center justify-center space-y-1.5 pointer-events-none">
                          <Upload className="w-5 h-5 text-indigo-600" />
                          <div className="text-xs font-semibold text-indigo-900">
                            <span>คลิกเพื่ออัปโหลดรูปเนมเพลทเครื่อง</span>
                          </div>
                        </div>
                      </label>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-600">รูปเนมเพลท (1 ไฟล์):</span>
                          <button
                            type="button"
                            onClick={() => setNameplateFile(null)}
                            className="text-xs text-red-600 hover:text-red-700 font-medium"
                          >
                            ลบไฟล์
                          </button>
                        </div>
                        <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-200 text-xs shadow-sm">
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                            <span className="font-semibold text-gray-900 truncate">{nameplateFile.name}</span>
                            <span className="text-gray-500 text-[10px]">({(nameplateFile.size / 1024).toFixed(1)} KB)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNameplateFile(null)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded transition"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-blue-600 shrink-0" /> รูปถ่ายสภาพเครื่องและหลักฐานอื่นๆ <span className="text-red-500">*</span>
                  </label>
                  
                  <label className="border-2 border-dashed border-gray-300 rounded-2xl p-5 text-center hover:bg-gray-50 transition cursor-pointer block relative">
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*" 
                      className="sr-only"
                      onChange={(e) => {
                        if (e.target.files) {
                          const newFiles = Array.from(e.target.files);
                          setSelectedFiles((prevFiles) => [...prevFiles, ...newFiles]);
                        }
                      }}
                    />
                    <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                      <div className="p-2.5 bg-blue-50 text-blue-600 rounded-full">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="text-xs sm:text-sm font-medium text-gray-700">
                        {selectedFiles.length > 0 ? (
                          <span className="text-emerald-600 font-semibold">เลือกรูปภาพทั่วไปแล้ว {selectedFiles.length} ไฟล์ (คลิกเพื่อเลือกเพิ่มได้อีก)</span>
                        ) : (
                          <span className="text-red-600 font-medium">คลิกเพื่อเลือกรูปภาพหลักฐาน (อย่างน้อย 1 รูป)</span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400">เลือกเพิ่มทีละรูปหรือเลือกหลายรูปพร้อมกันได้ (ระบบจะสะสมรายการให้ทั้งหมด)</div>
                    </div>
                  </label>

                  {selectedFiles.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-600">รายการไฟล์ทั้งหมด ({selectedFiles.length} ไฟล์):</span>
                        <button
                          type="button"
                          onClick={() => setSelectedFiles([])}
                          className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          ลบทั้งหมด
                        </button>
                      </div>
                      <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                        {selectedFiles.map((file, index) => (
                          <li key={index} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-200 text-xs shadow-sm">
                            <div className="flex items-center gap-2 truncate">
                              <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                              <span className="font-semibold text-gray-900 truncate">{file.name}</span>
                              <span className="text-gray-500 text-[10px]">({(file.size / 1024).toFixed(1)} KB)</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 rounded transition"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    อาการเสีย / หมายเหตุเพิ่มเติม
                  </label>
                  <textarea
                    name="note"
                    rows={3}
                    placeholder="ระบุอาการเสียเบื้องต้น หรือหมายเหตุ..."
                    className="w-full px-3.5 py-3 bg-white text-gray-900 border border-gray-300 rounded-xl text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition"
                  />
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
              <Link 
                href="/dashboard/jobs"
                className="w-1/3 sm:w-auto text-center px-4 py-3 border border-gray-300 text-gray-700 text-xs sm:text-sm font-medium rounded-xl hover:bg-gray-100 transition shadow-sm"
              >
                ยกเลิก
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-2/3 sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer font-bold"
              >
                <CheckCircle2 className="w-4 h-4" /> 
                {isSubmitting ? "กำลังประมวลผล..." : isDirectLoanMode ? "บันทึกการให้ยืมเครื่องสำรอง" : "บันทึกเปิดใบงาน"}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}