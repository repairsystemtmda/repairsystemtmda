'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Box, Wifi, Upload, FileText, X, ScanLine, Tag, Loader2, AlertTriangle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// กำหนดค่า Supabase Client สำหรับอัปโหลดตรงฝั่งหน้าบ้าน
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface BrandItem {
  id: string;
  name: string;
  category?: string | null;
}

export default function AddBackupDevicePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('กำลังเตรียมข้อมูล...');

  // State สำหรับจัดการ Modal แจ้งเตือนรูปแนวตั้ง
  const [orientationAlert, setOrientationAlert] = useState<{ show: boolean; message: string }>({
    show: false,
    message: '',
  });

  const [category, setCategory] = useState("อินเวอร์เตอร์");
  const [brandsList, setBrandsList] = useState<BrandItem[]>([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [hasBox, setHasBox] = useState(false);
  const [hasWifiDongle, setHasWifiDongle] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState("AVAILABLE");

  const [nameplateFile, setNameplateFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const [currentUser, setCurrentUser] = useState({
    id: "admin-id-01",
    name: "adminTMDA",
  });

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('username') || localStorage.getItem('userName');
      if (storedUser) {
        setCurrentUser({
          id: storedUser,
          name: storedUser,
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const res = await fetch('/api/admin/brands');
        const text = await res.text();
        const data = text ? JSON.parse(text) : [];

        if (res.ok && Array.isArray(data)) {
          setBrandsList(data);
          const filtered = data.filter((b: any) => (b.category || "อินเวอร์เตอร์") === category);
          if (filtered.length > 0) {
            setSelectedBrand(filtered[0].name);
          } else {
            setSelectedBrand("OTHER");
          }
        }
      } catch (err) {
        console.error('Failed to fetch brands:', err);
      }
    };
    fetchBrands();
  }, []);

  const filteredBrands = brandsList.filter((b) => (b.category || "อินเวอร์เตอร์") === category);

  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    if (newCat !== "อินเวอร์เตอร์" && newCat !== "Inverter") {
      setHasWifiDongle(false);
    }
    const matched = brandsList.filter((b) => (b.category || "อินเวอร์เตอร์") === newCat);
    if (matched.length > 0) {
      setSelectedBrand(matched[0].name);
    } else {
      setSelectedBrand("OTHER");
    }
  };

  const getEffectiveBrand = () => {
    if (selectedBrand === "OTHER") return customBrand.trim();
    return selectedBrand;
  };

  // ฟังก์ชันตรวจสอบรูปภาพว่าเป็น "แนวนอน" หรือไม่ (Width ต้องมากกว่า Height)
  const handleNameplateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        // เช็กว่าหากความกว้างน้อยกว่าหรือเท่ากับความสูง (แนวตั้ง หรือ จัตุรัส)
        if (img.width <= img.height) {
          setOrientationAlert({
            show: true,
            message: `รูปเนมเพลท (${file.name}) ที่คุณเลือกเป็น "แนวตั้งหรือจัตุรัส" กรุณาหมุนโทรศัพท์และถ่ายภาพใน "แนวนอน" เท่านั้นครับ`,
          });
          e.target.value = ''; //รีเซ็ตค่า input file
        } else {
          // ผ่านเงื่อนไข เป็นแนวนอน
          setNameplateFile(file);
          e.target.value = '';
        }
      };
    };
  };

  const resizeImage = (file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.7): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const resizedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(resizedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            quality
          );
        };
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const currentBrand = getEffectiveBrand();
    if (!currentBrand) {
      alert("กรุณาระบุชื่อแบรนด์อุปกรณ์");
      return;
    }

    const requiresNameplate = (category === "อินเวอร์เตอร์" || category === "Inverter") && (currentBrand.toLowerCase() === 'deye' || currentBrand.toLowerCase() === 'tmda');
    
    if (requiresNameplate && !nameplateFile) {
      alert("กรุณาแนบรูปถ่ายเนมเพลท (Nameplate / ป้าย S/N) ในแนวนอน");
      return;
    }

    try {
      setLoading(true);
      setUploadProgress(10);
      setLoadingText("กำลังตรวจสอบข้อมูลฟอร์ม...");

      const formElement = e.currentTarget;
      const formDataObj = new FormData(formElement);

      const model = String(formDataObj.get("model") || "").trim();
      const serialNumber = String(formDataObj.get("serialNumber") || "").trim();
      const productNo = String(formDataObj.get("productNo") || "").trim();
      const wifiDongleSn = String(formDataObj.get("wifiDongleSn") || "").trim();
      const note = String(formDataObj.get("note") || "").trim();

      if (!model || !serialNumber) {
        alert("กรุณากรอกรุ่น (Model) และ Serial Number ให้ครบถ้วน");
        setLoading(false);
        setUploadProgress(0);
        return;
      }

      let imageUrl: string | null = null;
      const uploadedImages: string[] = [];

      // 1. อัปโหลดรูปเนมเพลทตรงไปยัง Supabase Storage (ถ้ามี)
      if (nameplateFile) {
        setUploadProgress(30);
        setLoadingText("กำลังบีบอัดและอัปโหลดรูปเนมเพลท...");
        const compressedNameplate = await resizeImage(nameplateFile, 1200, 1200, 0.7);
        const fileName = `backup-nameplate-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("repair-images")
          .upload(fileName, compressedNameplate, { contentType: "image/jpeg" });

        if (uploadError) {
          throw new Error("อัปโหลดรูปเนมเพลทไม่สำเร็จ: " + uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from("repair-images")
          .getPublicUrl(fileName);

        imageUrl = publicUrlData.publicUrl;
      }

      // 2. อัปโหลดรูปภาพสภาพเครื่องเพิ่มเติมตรงไปยัง Supabase Storage แบบ Parallel Upload (พร้อมกันทีเดียว)
      if (selectedFiles.length > 0) {
        setUploadProgress(50);
        setLoadingText("กำลังบีบอัดและอัปโหลดรูปภาพหลักฐาน...");

        const uploadPromises = selectedFiles.map(async (file, i) => {
          const compressed = await resizeImage(file, 1200, 1200, 0.7);
          const fileName = `backup-image-${Date.now()}-${i}-${Math.round(Math.random() * 1e9)}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from("repair-images")
            .upload(fileName, compressed, { contentType: "image/jpeg" });

          if (uploadError) {
            throw new Error(`อัปโหลดรูปที่ ${i + 1} ไม่สำเร็จ: ` + uploadError.message);
          }

          const { data: publicUrlData } = supabase.storage
            .from("repair-images")
            .getPublicUrl(fileName);

          return publicUrlData.publicUrl;
        });

        const results = await Promise.all(uploadPromises);
        uploadedImages.push(...results);
      }

      setUploadProgress(80);
      setLoadingText("กำลังบันทึกข้อมูลเข้าสู่ระบบ...");

      const payload = {
        status: deviceStatus,
        category,
        brand: currentBrand,
        model,
        serialNumber,
        productNo,
        hasBox,
        hasWifiDongle: (category === "อินเวอร์เตอร์" || category === "Inverter") && hasWifiDongle,
        wifiDongleSn,
        note,
        receiverId: currentUser.id,
        receiverName: currentUser.name,
        imageUrl,
        images: uploadedImages,
      };

      const res = await fetch('/api/inventory/backups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await res.text();
      let data: any = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        data = { error: responseText || 'เกิดข้อผิดพลาดในการประมวลผลข้อมูลจากเซิร์ฟเวอร์' };
      }

      if (res.ok) {
        setUploadProgress(100);
        setLoadingText("บันทึกสำเร็จ กำลังพาท่านกลับหน้าหลัก...");
        setTimeout(() => {
          window.location.href = '/dashboard/inventory/backups';
        }, 500);
      } else {
        alert(data.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        setLoading(false);
        setUploadProgress(0);
      }
    } catch (err: any) {
      console.error('Failed to create backup device:', err);
      alert(err.message || 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const activeBrand = getEffectiveBrand();
  const isDeyeOrTmdaInverter = (category === "อินเวอร์เตอร์" || category === "Inverter") && (activeBrand.toLowerCase() === 'deye' || activeBrand.toLowerCase() === 'tmda');

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-3 sm:p-6 w-full font-sans relative">
      
      {/* Modal แจ้งเตือนเมื่อพบรูปแนวตั้ง */}
      {orientationAlert.show && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 sm:p-8 w-full max-w-sm text-center space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="w-20 h-20 mx-auto bg-amber-50 rounded-full flex items-center justify-center border border-amber-100 shadow-inner">
              <AlertTriangle className="w-10 h-10 text-amber-500 animate-bounce" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">ตรวจพบรูปแนวตั้ง!</h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed px-1">
                {orientationAlert.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOrientationAlert({ show: false, message: '' })}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl text-sm transition shadow-lg shadow-amber-500/30 cursor-pointer"
            >
              รับทราบ / ถ่ายใหม่
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
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

      <div className="w-full max-w-5xl mx-auto space-y-4 sm:space-y-6">
        
        <div className="flex items-center gap-3 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200">
          <Link
            href="/dashboard/inventory/backups"
            className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition shadow-sm text-gray-600 no-underline shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 leading-tight">เพิ่มเครื่องสำรองใหม่</h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                บันทึกข้อมูลเครื่องสำรองเข้าคลัง
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl text-xs text-blue-800 font-medium self-start sm:self-auto">
              ผู้บันทึกข้อมูล: <span className="font-bold">{currentUser.name}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            <input type="hidden" name="receiverId" value={currentUser.id} />
            <input type="hidden" name="receiverName" value={currentUser.name} />

            <div className="p-3.5 sm:p-4 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2.5">
              <label className="block text-xs sm:text-sm font-semibold text-amber-900">
                สถานะเครื่องสำรองในคลัง (Device Status) *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                
                <label className={`flex flex-col p-3 border rounded-xl cursor-pointer transition ${deviceStatus === 'AVAILABLE' ? 'bg-white border-amber-500 ring-2 ring-amber-400/20 shadow-sm' : 'bg-white/60 border-gray-200 hover:bg-white'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="status"
                      value="AVAILABLE"
                      checked={deviceStatus === 'AVAILABLE'}
                      onChange={(e) => setDeviceStatus(e.target.value)}
                      className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-xs font-bold text-gray-800">AVAILABLE</span>
                  </div>
                  <span className="text-[11px] text-gray-500 pl-6">พร้อมใช้งาน (เครื่องใหม่หรือคืนสภาพดี)</span>
                </label>

                <label className={`flex flex-col p-3 border rounded-xl cursor-pointer transition ${deviceStatus === 'MAINTENANCE' ? 'bg-white border-amber-500 ring-2 ring-amber-400/20 shadow-sm' : 'bg-white/60 border-gray-200 hover:bg-white'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="status"
                      value="MAINTENANCE"
                      checked={deviceStatus === 'MAINTENANCE'}
                      onChange={(e) => setDeviceStatus(e.target.value)}
                      className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-xs font-bold text-gray-800">MAINTENANCE</span>
                  </div>
                  <span className="text-[11px] text-gray-500 pl-6">กำลังซ่อมบำรุง / เครื่องเสีย</span>
                </label>

              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                  หมวดหมู่อุปกรณ์ *
                </label>
                <select
                  name="category"
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-3.5 py-3 bg-white text-gray-900 font-bold border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
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
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full px-3.5 py-3 bg-white text-gray-900 font-bold border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                >
                  {filteredBrands.length > 0 ? (
                    filteredBrands.map((b) => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))
                  ) : (
                    <option value="" disabled>-- ไม่มีแบรนด์ในหมวดนี้ --</option>
                  )}
                  <option value="OTHER">อื่นๆ (ระบุชื่อแบรนด์)</option>
                </select>
              </div>
            </div>

            {selectedBrand === "OTHER" && (
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
                  className="w-full px-3.5 py-3 bg-white text-gray-900 font-bold border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                  รุ่นเครื่อง (Model) *
                </label>
                <input
                  type="text"
                  name="model"
                  required
                  placeholder="เช่น SUN-5K-SG04LP1-EU"
                  className="w-full px-3.5 py-3 bg-white text-gray-900 font-bold border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
                  <span>Serial Number (S/N) *</span>
                  <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                    <ScanLine className="w-3.5 h-3.5" /> รองรับการสแกน
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="serialNumber"
                    required
                    placeholder="สแกนหรือระบุ S/N..."
                    className="w-full pl-3.5 pr-10 py-3 bg-white text-gray-900 font-bold border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none transition"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <ScanLine className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>

            {isDeyeOrTmdaInverter && (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
                  <span>Product No. (สำหรับ Export Deye/TMDA) *</span>
                  <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                    <ScanLine className="w-3.5 h-3.5" /> รองรับการสแกน
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="productNo"
                    required={isDeyeOrTmdaInverter}
                    placeholder="กรอกหรือสแกน Product No...."
                    className="w-full pl-3.5 pr-10 py-3 bg-white text-gray-900 font-bold border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none transition"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
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
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-xs sm:text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    <Box className="w-4 h-4 text-amber-600 shrink-0" /> มีกล่องอุปกรณ์มาด้วย
                  </span>
                </label>

                {(category === "อินเวอร์เตอร์" || category === "Inverter") && (
                  <label className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition shadow-sm">
                    <input
                      type="checkbox"
                      checked={hasWifiDongle}
                      onChange={(e) => setHasWifiDongle(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-xs sm:text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                      <Wifi className="w-4 h-4 text-emerald-600 shrink-0" /> มี WiFi Dongle มาด้วย
                    </span>
                  </label>
                )}
              </div>

              {(category === "อินเวอร์เตอร์" || category === "Inverter") && hasWifiDongle && (
                <div className="pt-1">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
                    <span>S/N ของ WiFi Dongle *</span>
                    <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                      <ScanLine className="w-3.5 h-3.5" /> รองรับการสแกน
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="wifiDongleSn"
                      required={hasWifiDongle}
                      placeholder="สแกนหรือระบุ S/N WiFi Dongle..."
                      className="w-full pl-3.5 pr-10 py-2.5 bg-white text-gray-900 font-bold border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none transition"
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <ScanLine className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ส่วนอัปโหลดรูปเนมเพลท พร้อมตรวจสอบแนวนอน (เปลี่ยนข้อความตามต้องการ) */}
            {isDeyeOrTmdaInverter && (
              <div className="p-3.5 sm:p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-2.5">
                <label className="block text-xs sm:text-sm font-semibold text-indigo-900 flex items-center gap-1.5 leading-snug">
                  <Tag className="w-4 h-4 text-indigo-600 shrink-0" /> 
                  <span>รูปเนมเพลท (Nameplate / ป้าย S/N) <span className="text-red-500">* (ถ่ายรูปแนวนอนเท่านั้น)</span></span>
                </label>
                
                {!nameplateFile ? (
                  <label className="border-2 border-dashed border-indigo-300 bg-white rounded-xl p-4 text-center hover:bg-indigo-50/30 transition cursor-pointer block">
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="sr-only"
                      onChange={handleNameplateChange}
                    />
                    <div className="flex flex-col items-center justify-center space-y-1 pointer-events-none">
                      <Upload className="w-5 h-5 text-indigo-600" />
                      <div className="text-xs font-semibold text-indigo-900">
                        <span>แตะเพื่อถ่ายรูป หรืออัปโหลดเนมเพลท (ถ่ายรูปแนวนอนเท่านั้น)</span>
                      </div>
                    </div>
                  </label>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-600">รูปเนมเพลทที่เลือก (ผ่านตรวจสอบแนวนอนแล้ว):</span>
                    </div>
                    <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-200 text-xs shadow-sm">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className="font-semibold text-gray-900 truncate">{nameplateFile.name}</span>
                        <span className="text-gray-500 text-[10px]">({(nameplateFile.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNameplateFile(null)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded transition shrink-0"
                        title="ลบไฟล์นี้"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-blue-600 shrink-0" /> 
                <span>รูปถ่ายสภาพเครื่องและหลักฐานเพิ่มเติม</span>
              </label>
              
              <label className="border-2 border-dashed border-gray-300 rounded-2xl p-5 text-center hover:bg-gray-50 transition cursor-pointer block">
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files) {
                      const newFiles = Array.from(e.target.files);
                      setSelectedFiles((prev) => [...prev, ...newFiles]);
                      e.target.value = ""; 
                    }
                  }}
                />
                <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-gray-700">
                    {selectedFiles.length > 0 ? (
                      <span className="text-emerald-600 font-semibold">เลือกแล้วรวม {selectedFiles.length} รูป (แตะเพื่อเลือกเพิ่มได้)</span>
                    ) : (
                      <span className="text-gray-600">แตะเพื่อเลือกรูปภาพ (เลือกสะสมได้หลายรูป)</span>
                    )}
                  </div>
                </div>
              </label>

              {selectedFiles.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600">รายการรูป ({selectedFiles.length} ไฟล์):</span>
                    <button
                      type="button"
                      onClick={() => setSelectedFiles([])}
                      className="text-xs text-red-600 hover:text-red-700 font-medium py-1 px-2"
                    >
                      ลบทั้งหมด
                    </button>
                  </div>
                  <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                      <li key={index} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-200 text-xs shadow-sm">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                          <span className="font-semibold text-gray-900 truncate">{file.name}</span>
                          <span className="text-gray-500 text-[10px]">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 rounded transition shrink-0"
                          title="ลบไฟล์นี้"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                หมายเหตุเพิ่มเติม / รายละเอียดเครื่องสำรอง
              </label>
              <textarea
                name="note"
                rows={3}
                placeholder="ระบุรายละเอียดเพิ่มเติม..."
                className="w-full px-3.5 py-2.5 bg-white text-gray-900 font-bold border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
              <Link 
                href="/dashboard/inventory/backups"
                className="w-1/3 py-3 border border-gray-300 text-gray-700 text-center text-sm font-medium rounded-xl hover:bg-gray-100 transition shadow-sm no-underline"
              >
                ยกเลิก
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="w-2/3 inline-flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {loading ? 'กำลังบันทึก...' : 'บันทึกเครื่องสำรอง'}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}