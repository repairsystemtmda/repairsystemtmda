'use client';

import { useState, useEffect } from 'react';
import { 
  Edit3, 
  CheckCircle2, 
  X, 
  Trash2, 
  Image as ImageIcon, 
  Camera, 
  User, 
  Phone, 
  Tag, 
  Cpu, 
  FileText, 
  Layers, 
  Box, 
  AlertCircle,
  Wifi,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Loader2
} from 'lucide-react';

const CLEANED_STATUS_OPTIONS = [
  { value: 'PENDING', label: '1. PENDING - รอดำเนินการ' },
  { value: 'DIAGNOSE', label: '2. DIAGNOSE - กำลังประเมินอาการ' },
  { value: 'WAITING_FOR_APPROVAL', label: '3. WAITING_FOR_APPROVAL - รอลูกค้าอนุมัติราคา' },
  { value: 'IN_REPAIR', label: '4. IN_REPAIR - กำลังซ่อมบำรุง' },
  { value: 'SWAPPED_BACKUP_DEVICE', label: '5. SWAPPED_BACKUP_DEVICE - ยืมเครื่องสำรองระหว่างซ่อม' },
  { value: 'WAITING_DEYE_SEND', label: '6. WAIT_DEYE_SEND - รอส่งศูนย์ Deye' },
  { value: 'SENT_TO_DEYE', label: '7. SENT_TO_DEYE - ส่งเครื่องไป Deye แล้ว' },
  { value: 'COMPLETED_BY_DEYE', label: '8. COMPLETED_BY_DEYE - Deye ซ่อมเสร็จส่งกลับมาแล้ว' },
  { value: 'COMPLETED', label: '9. COMPLETED - ซ่อมเสร็จสิ้น (รอส่งมอบ)' },
  { value: 'RETURNED_CUSTOMER_PICKUP', label: '10. RETURNED_CUSTOMER_PICKUP - ส่งมอบคืนลูกค้า (ลูกค้ารับเอง)' },
  { value: 'RETURNED_SHIPPED', label: '11. RETURNED_SHIPPED - ส่งมอบคืนลูกค้า (จัดส่งขนส่ง)' },
  { value: 'RETURN_BACKUP_AND_DELIVER', label: '12. RETURN_BACKUP_AND_DELIVER - คืนเครื่องสำรอง + ส่งมอบเครื่องลูกค้า' },
  { value: 'SWAPPED_PERMANENT', label: '13. SWAPPED_PERMANENT - สลับเปลี่ยนเครื่องสำรองให้ถาวร' },
  { value: 'CLAIM_NEW_MACHINE', label: '14. CLAIM_NEW_MACHINE - เคลมเครื่องใหม่' },
  { value: 'CANCELLED', label: '15. CANCELLED - ยกเลิกใบงาน' },
];

const FIXED_CATEGORIES = [
  'อินเวอร์เตอร์',
  'ออปติไมเซอร์',
  'ไมโครอินเวอร์เตอร์',
  'แบตเตอรี่',
  'อินเวอร์เตอร์ปั๊มน้ำ'
];

export default function JobEditForm({ job, brands, categories = [], backupDevices, statusLabels = {}, updateJobAction }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(job.status);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const finishedStatuses = [
      'COMPLETED', 
      'COMPLETED_BY_DEYE',
      'RETURNED_CUSTOMER_PICKUP', 
      'RETURNED_SHIPPED', 
      'RETURN_BACKUP_AND_DELIVER', 
      'SWAPPED_PERMANENT'
    ];
    
    const isFinishedStatus = finishedStatuses.includes(selectedStatus);
    const hasWithdrawnParts = job.stockLogs && job.stockLogs.length > 0;

    if (isFinishedStatus && !hasWithdrawnParts) {
      e.preventDefault();
      alert('⚠️ ไม่สามารถเปลี่ยนสถานะเป็น "ซ่อมเสร็จสิ้น" หรือสถานะส่งมอบได้ เนื่องจากยังไม่มีประวัติการเบิกอะไหล่ กรุณาเบิกอะไหล่อย่างน้อย 1 รายการก่อนครับ');
      return;
    }

    setIsSubmitting(true);
  };

  const [hasBox, setHasBox] = useState(job.hasBox ?? false);
  const [hasWifiDongle, setHasWifiDongle] = useState(job.hasWifiDongle ?? false);
  const [wifiDongleSn, setWifiDongleSn] = useState(job.wifiDongleSn || '');

  const [selectedCategory, setSelectedCategory] = useState(job.category || '');
  const [selectedBrandId, setSelectedBrandId] = useState(job.brandId || '');

  useEffect(() => {
    setSelectedStatus(job.status);
    setHasBox(job.hasBox ?? false);
    setHasWifiDongle(job.hasWifiDongle ?? false);
    setWifiDongleSn(job.wifiDongleSn || '');
    setSelectedCategory(job.category || '');
    setSelectedBrandId(job.brandId || '');
    setIsSubmitting(false);
  }, [job.status, job.hasBox, job.hasWifiDongle, job.wifiDongleSn, job.category, job.brandId]);

  const filteredBrands = brands?.filter((b: any) => {
    if (!selectedCategory) return true;
    return (
      b.category === selectedCategory ||
      b.categoryName === selectedCategory ||
      String(b.categoryId) === String(selectedCategory)
    );
  }) || [];

  const currentBrand = brands?.find((b: any) => b.id === job.brandId);
  const brandName = job.brand?.name || currentBrand?.name || '';
  const isInvt = brandName.toLowerCase() === 'invt';

  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const [allGalleryImages, setAllGalleryImages] = useState<{ url: string; label?: string }[]>([]);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);
  const [newNameplatePreview, setNewNameplatePreview] = useState<string | null>(null);
  const [newOtherPreviews, setNewOtherPreviews] = useState<string[]>([]);
  const [newStockLogPreviews, setNewStockLogPreviews] = useState<{ [key: string]: string }>({});

  const recordedByName = job.user?.name || job.user?.username || job.user?.email || job.receiverName || 'adminTMDA';

  const handleNameplateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewNameplatePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveNewNameplate = () => {
    setNewNameplatePreview(null);
  };

  const handleOtherChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setNewOtherPreviews((prev) => [...prev, ...filesArray.map(f => URL.createObjectURL(f))]);
    }
  };

  const handleRemoveNewOther = (index: number) => {
    setNewOtherPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleDeleteOldImage = (imageId: string) => {
    setDeletedImageIds((prev) =>
      prev.includes(imageId) ? prev.filter((id) => id !== imageId) : [...prev, imageId]
    );
  };

  const getSafeImageUrl = (url: string) => {
    if (!url || typeof url !== 'string') return '';
    if (
      url.startsWith('data:image/') || 
      url.startsWith('http://') || 
      url.startsWith('https://') || 
      url.startsWith('blob:') || 
      url.startsWith('/')
    ) {
      return url;
    }
    return `/uploads/${url}`;
  };

  const allJobImages = job.images && job.images.length > 0 
    ? job.images.filter((img: any) => img && img.url && typeof img.url === 'string' && img.url.trim() !== '') 
    : [];
  
  const nonStockImages = allJobImages.filter((img: any) => {
    if (img.stockLogId) return false;
    const isInStockLog = job.stockLogs?.some((log: any) => 
      log.images?.some((logImg: any) => logImg.id === img.id || logImg.url === img.url)
    );
    return !isInStockLog;
  });

  // กรองเฉพาะรูปที่เป็นเนมเพลทจริงๆ
  const explicitNameplate = nonStockImages.filter((img: any) => {
    const t = (img.type || '').toLowerCase();
    const c = (img.category || '').toLowerCase();
    return t.includes('nameplate') || c.includes('nameplate') || img.isNameplate === true || t.includes('serial') || c.includes('serial');
  });

  // ป้องกันกรณีข้อมูลเก่าไม่มี type ให้เช็คว่าเป็นรูปแรกสุดเฉพาะตอนไม่มี explicit type และไม่มีรูปอื่นปน หรือใช้เงื่อนไขตรงตามฐานข้อมูล
  const finalNameplateImages = explicitNameplate.length > 0 
    ? explicitNameplate 
    : (nonStockImages.length > 0 && !nonStockImages.some((img: any) => img.type && img.type.trim() !== '')) 
      ? [nonStockImages[0]] 
      : [];

  const finalOtherImages = nonStockImages.filter((img: any) => {
    if (!img || !img.url || typeof img.url !== 'string' || img.url.trim() === '') {
      return false;
    }
    const t = (img.type || '').toLowerCase();
    const c = (img.category || '').toLowerCase();
    const isNameplate = t.includes('nameplate') || c.includes('nameplate') || img.isNameplate === true || t.includes('serial') || c.includes('serial');
    
    if (explicitNameplate.length > 0) {
      return !isNameplate;
    } else {
      return img.id !== finalNameplateImages[0]?.id && img.url !== finalNameplateImages[0]?.url;
    }
  });

  const sparePartLogs = job.stockLogs || [];

  const collectAllImagesForGallery = () => {
    const list: { url: string; label?: string }[] = [];
    if (!isInvt) {
      finalNameplateImages.forEach((img: any) => {
        const u = getSafeImageUrl(img.url);
        if (u) list.push({ url: u, label: 'รูปถ่ายเนมเพลท' });
      });
    }
    finalOtherImages.forEach((img: any) => {
      const u = getSafeImageUrl(img.url);
      if (u) list.push({ url: u, label: 'รูปสภาพเครื่อง / หลักฐานอื่นๆ' });
    });
    sparePartLogs.forEach((log: any) => {
      if (log.images) {
        log.images.filter((img: any) => img && img.url && typeof img.url === 'string' && img.url.trim() !== '').forEach((img: any, idx: number) => {
          const u = getSafeImageUrl(img.url);
          const imgTypeLabel = idx === 0 ? 'บอร์ดตัวเก่าเต็มใบ' : 'QR Code / S/N';
          if (u) list.push({ url: u, label: `หลักฐานการเบิก: ${log.sparePart?.name || 'อะไหล่'} (${imgTypeLabel})` });
        });
      }
    });
    return list;
  };

  const openGalleryAt = (imageUrl: string) => {
    const allItems = collectAllImagesForGallery();
    setAllGalleryImages(allItems);
    const index = allItems.findIndex(item => item.url === imageUrl);
    setActiveImageIndex(index !== -1 ? index : 0);
    setZoomLevel(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  const handlePrevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setZoomLevel(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    if (activeImageIndex !== null && allGalleryImages.length > 0) {
      setActiveImageIndex(prev => (prev! > 0 ? prev! - 1 : allGalleryImages.length - 1));
    }
  };

  const handleNextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setZoomLevel(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    if (activeImageIndex !== null && allGalleryImages.length > 0) {
      setActiveImageIndex(prev => (prev! < allGalleryImages.length - 1 ? prev! + 1 : 0));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeImageIndex === null) return;
      if (e.key === 'ArrowLeft') {
        setZoomLevel(1);
        setRotation(0);
        setPan({ x: 0, y: 0 });
        setActiveImageIndex(prev => (prev! > 0 ? prev! - 1 : allGalleryImages.length - 1));
      } else if (e.key === 'ArrowRight') {
        setZoomLevel(1);
        setRotation(0);
        setPan({ x: 0, y: 0 });
        setActiveImageIndex(prev => (prev! < allGalleryImages.length - 1 ? prev! + 1 : 0));
      } else if (e.key === 'Escape') {
        setActiveImageIndex(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeImageIndex, allGalleryImages.length]);

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomLevel(prev => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomLevel(prev => {
      const newZoom = Math.max(prev - 0.5, 1);
      if (newZoom === 1) setPan({ x: 0, y: 0 });
      return newZoom;
    });
  };

  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleDownloadImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeImageIndex === null) return;
    const currentUrl = allGalleryImages[activeImageIndex]?.url;
    if (!currentUrl) return;

    const link = document.createElement('a');
    link.href = currentUrl;
    link.download = `repair-image-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    setPan({ x: newX, y: newY });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const getCurrentStatusLabel = (st: string) => {
    const found = CLEANED_STATUS_OPTIONS.find(o => o.value === st);
    return found ? found.label : statusLabels[st] || st;
  };

  return (
    <div className="bg-white p-3 sm:p-6 rounded-none sm:rounded-2xl shadow-none sm:shadow-sm border-0 sm:border border-gray-200 space-y-6 relative w-full max-w-full overflow-x-hidden box-border">
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-blue-600 shrink-0" /> รายละเอียดและสถานะใบงาน
        </h2>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs px-3 py-1.5 font-bold rounded-xl border bg-blue-50 text-blue-700 border-blue-200 text-center sm:text-left">
            สถานะ: {getCurrentStatusLabel(job.status)}
          </span>
          
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer border border-blue-500"
            >
              <Edit3 className="w-4 h-4 shrink-0" /> แก้ไขข้อมูล
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setIsSubmitting(false);
                setSelectedStatus(job.status);
                setHasBox(job.hasBox ?? false);
                setHasWifiDongle(job.hasWifiDongle ?? false);
                setWifiDongleSn(job.wifiDongleSn || '');
                setSelectedCategory(job.category || '');
                setSelectedBrandId(job.brandId || '');
                setDeletedImageIds([]);
                setNewNameplatePreview(null);
                setNewOtherPreviews([]);
                setNewStockLogPreviews({});
              }}
              className="w-full sm:w-auto px-3.5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-red-200 shadow-xs"
            >
              <X className="w-4 h-4 shrink-0" /> ยกเลิก
            </button>
          )}
        </div>
      </div>

      <form 
        id="job-edit-form" 
        onSubmit={handleSubmit} 
        action={updateJobAction} 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full"
      >
        <input type="hidden" name="jobId" value={job.id} />
        <input type="hidden" name="deletedImageIds" value={JSON.stringify(deletedImageIds)} />

        <div className="md:col-span-1 lg:col-span-2 w-full">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">
            <Layers className="w-4 h-4 text-gray-700 shrink-0" /> สถานะงานซ่อม
          </label>
          <select
            name="status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            disabled={!isEditing}
            className={`w-full px-4 py-3 border rounded-xl text-base sm:text-sm font-semibold transition appearance-none bg-no-repeat bg-[length:16px_16px] bg-[position:right_1rem_center] ${
              isEditing ? 'bg-gray-50 border-gray-300 text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500/25 outline-none' : 'bg-gray-100 text-gray-600 border-gray-200 cursor-not-allowed'
            }`}
          >
            {CLEANED_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1 lg:col-span-1 w-full">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">
            <User className="w-4 h-4 text-gray-700 shrink-0" /> ผู้บันทึก / ผู้ทำรายการ
          </label>
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base sm:text-sm font-semibold text-gray-900">
            <User className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="truncate">{recordedByName}</span>
          </div>
        </div>

        <div className="w-full">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">
            <User className="w-4 h-4 text-gray-700 shrink-0" /> ชื่อลูกค้า
          </label>
          <input 
            type="text" 
            name="customerName" 
            defaultValue={job.customerName || ''} 
            disabled={!isEditing}
            className={`w-full px-4 py-3 border rounded-xl text-base sm:text-sm font-semibold transition ${
              isEditing ? 'bg-gray-50 border-gray-300 text-gray-900 focus:bg-white outline-none' : 'bg-gray-100 text-gray-600 border-gray-200 cursor-not-allowed'
            }`} 
          />
        </div>

        <div className="w-full">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">
            <Phone className="w-4 h-4 text-gray-700 shrink-0" /> เบอร์โทรศัพท์
          </label>
          <input 
            type="text" 
            name="phone" 
            defaultValue={job.phone || ''} 
            disabled={!isEditing}
            className={`w-full px-4 py-3 border rounded-xl text-base sm:text-sm font-semibold transition ${
              isEditing ? 'bg-gray-50 border-gray-300 text-gray-900 focus:bg-white outline-none' : 'bg-gray-100 text-gray-600 border-gray-200 cursor-not-allowed'
            }`} 
          />
        </div>

        <div className="w-full">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">
            <Box className="w-4 h-4 text-gray-700 shrink-0" /> ประเภทอุปกรณ์
          </label>
          <select 
            name="category" 
            value={selectedCategory} 
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSelectedBrandId(''); 
            }}
            disabled={!isEditing}
            className={`w-full px-4 py-3 border rounded-xl text-base sm:text-sm font-semibold transition appearance-none ${
              isEditing ? 'bg-gray-50 border-gray-300 text-gray-900 focus:bg-white outline-none' : 'bg-gray-100 text-gray-600 border-gray-200 cursor-not-allowed'
            }`}
          >
            <option value="">-- เลือกประเภทอุปกรณ์ --</option>
            
            {selectedCategory && !FIXED_CATEGORIES.includes(selectedCategory) && (
              <option value={selectedCategory}>{selectedCategory}</option>
            )}

            {FIXED_CATEGORIES.map((catName, idx) => (
              <option key={idx} value={catName}>
                {catName}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">
            <Tag className="w-4 h-4 text-gray-700 shrink-0" /> ยี่ห้อ (Brand)
          </label>
          <select 
            name="brandId" 
            value={selectedBrandId} 
            onChange={(e) => setSelectedBrandId(e.target.value)}
            disabled={!isEditing}
            className={`w-full px-4 py-3 border rounded-xl text-base sm:text-sm font-semibold transition appearance-none ${
              isEditing ? 'bg-gray-50 border-gray-300 text-gray-900 focus:bg-white outline-none' : 'bg-gray-100 text-gray-600 border-gray-200 cursor-not-allowed'
            }`}
          >
            <option value="">-- เลือกยี่ห้อ --</option>
            {filteredBrands?.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="w-full">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">
            <Cpu className="w-4 h-4 text-gray-700 shrink-0" /> รุ่น (Model)
          </label>
          <input 
            type="text" 
            name="model" 
            defaultValue={job.model || ''} 
            disabled={!isEditing}
            className={`w-full px-4 py-3 border rounded-xl text-base sm:text-sm font-semibold transition ${
              isEditing ? 'bg-gray-50 border-gray-300 text-gray-900 focus:bg-white outline-none' : 'bg-gray-100 text-gray-600 border-gray-200 cursor-not-allowed'
            }`} 
          />
        </div>

        <div className="w-full">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">
            <Cpu className="w-4 h-4 text-gray-700 shrink-0" /> Serial Number (S/N)
          </label>
          <input 
            type="text" 
            name="serialNumber" 
            defaultValue={job.serialNumber || ''} 
            disabled={!isEditing}
            className={`w-full px-4 py-3 border rounded-xl text-base sm:text-sm font-mono font-bold transition ${
              isEditing ? 'bg-blue-50/40 border-blue-300 text-blue-600 focus:bg-white outline-none' : 'bg-gray-100 text-blue-600 border-gray-200 cursor-not-allowed'
            }`} 
          />
        </div>

        <div className="w-full">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">
            <FileText className="w-4 h-4 text-gray-700 shrink-0" /> Product No.
          </label>
          <input 
            type="text" 
            name="productNo" 
            defaultValue={job.productNo || ''} 
            disabled={!isEditing}
            className={`w-full px-4 py-3 border rounded-xl text-base sm:text-sm font-mono font-semibold transition ${
              isEditing ? 'bg-gray-50 border-gray-300 text-gray-900 focus:bg-white outline-none' : 'bg-gray-100 text-gray-600 border-gray-200 cursor-not-allowed'
            }`} 
          />
        </div>

        <div className="w-full">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">
            <Box className="w-4 h-4 text-gray-700 shrink-0" /> เครื่องสำรองที่ยืม
          </label>
          <select 
            name="backupDeviceId" 
            defaultValue={job.backupDeviceId || ''} 
            disabled={!isEditing}
            className={`w-full px-4 py-3 border rounded-xl text-base sm:text-sm font-semibold transition appearance-none ${
              isEditing ? 'bg-gray-50 border-gray-300 text-gray-900 focus:bg-white outline-none' : 'bg-gray-100 text-gray-600 border-gray-200 cursor-not-allowed'
            }`}
          >
            <option value="">-- ไม่มีการยืมเครื่องสำรอง --</option>
            {backupDevices?.map((dev: any) => (
              <option key={dev.id} value={dev.id}>{dev.model} (S/N: {dev.serialNumber})</option>
            ))}
          </select>
        </div>

        {hasWifiDongle && (
          <div className="w-full">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">
              <Wifi className="w-4 h-4 text-gray-700 shrink-0" /> S/N WIFI DONGLE
            </label>
            <input 
              type="text" 
              name="wifiDongleSn" 
              value={wifiDongleSn} 
              onChange={(e) => setWifiDongleSn(e.target.value)}
              disabled={!isEditing}
              className={`w-full px-4 py-3 border rounded-xl text-base sm:text-sm font-mono font-semibold transition ${
                isEditing ? 'bg-gray-50 border-gray-300 text-gray-900 focus:bg-white outline-none' : 'bg-gray-100 text-gray-600 border-gray-200 cursor-not-allowed'
              }`} 
            />
          </div>
        )}

        <div className="md:col-span-2 lg:col-span-3 flex flex-col sm:flex-row items-start sm:items-center gap-4 py-3 px-4 bg-gray-50 rounded-xl border border-gray-200 w-full">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input 
              type="checkbox" 
              name="hasBox" 
              value="true"
              checked={Boolean(hasBox)}
              onChange={(e) => setHasBox(e.target.checked)}
              disabled={!isEditing}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-sm font-semibold text-gray-800">📦 มีกล่องอุปกรณ์ครบ</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input 
              type="checkbox" 
              name="hasWifiDongle" 
              value="true"
              checked={Boolean(hasWifiDongle)}
              onChange={(e) => setHasWifiDongle(e.target.checked)}
              disabled={!isEditing}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-sm font-semibold text-gray-800">🛜 มี WiFi Dongle</span>
          </label>
        </div>

        <div className="md:col-span-2 lg:col-span-3 w-full">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">
            <AlertCircle className="w-4 h-4 text-gray-700 shrink-0" /> อาการเสีย / หมายเหตุ
          </label>
          <textarea 
            name="note" 
            rows={3} 
            defaultValue={job.note || ''} 
            disabled={!isEditing}
            className={`w-full px-4 py-3 border rounded-xl text-base sm:text-sm font-semibold transition ${
              isEditing ? 'bg-gray-50 border-gray-300 text-gray-900 focus:bg-white outline-none' : 'bg-gray-100 text-gray-600 border-gray-200 cursor-not-allowed'
            }`} 
          />
        </div>

        <div className="md:col-span-2 lg:col-span-3 space-y-6 pt-2 w-full">
          
          {!isInvt && (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3 w-full">
              <label className="flex items-center gap-2.5 text-xs sm:text-sm font-extrabold text-gray-900 uppercase tracking-wide">
                <ImageIcon className="w-5 h-5 text-gray-700 shrink-0" /> รูปถ่ายเนมเพลท (Nameplate / ป้าย S/N)
              </label>

              {!newNameplatePreview && finalNameplateImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {finalNameplateImages.map((img: any) => {
                    const isMarkedForDelete = deletedImageIds.includes(img.id);
                    const imageUrl = getSafeImageUrl(img.url);
                    return (
                      <div key={img.id} className={`relative rounded-lg overflow-hidden border-2 bg-white ${isMarkedForDelete ? 'border-red-500 opacity-40' : 'border-gray-200'}`}>
                        <div onClick={() => openGalleryAt(imageUrl)} className="cursor-pointer group relative block">
                          <img src={imageUrl} alt="Nameplate" className="w-full h-24 object-cover group-hover:opacity-90 transition" />
                        </div>
                        {isEditing && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleDeleteOldImage(img.id); }}
                            className={`absolute top-1 right-1 p-1.5 rounded-md text-white text-xs flex items-center gap-1 z-10 ${isMarkedForDelete ? 'bg-blue-600' : 'bg-red-600 hover:bg-red-700'}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> {isMarkedForDelete ? 'ยกเลิก' : 'ลบ'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {newNameplatePreview && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-blue-600">📌 รูปใหม่ที่เลือก:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="relative rounded-lg overflow-hidden border-2 border-blue-400 bg-white">
                      <img src={newNameplatePreview} alt="New Preview" className="w-full h-24 object-cover" />
                      <button 
                        type="button" 
                        onClick={handleRemoveNewNameplate} 
                        className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-md text-xs cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isEditing && (
                <div className="pt-2">
                  <input
                    type="file"
                    name="nameplateImages"
                    accept="image/*"
                    onChange={handleNameplateChange}
                    className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                </div>
              )}
            </div>
          )}

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3 w-full">
            <label className="flex items-center gap-2.5 text-xs sm:text-sm font-extrabold text-gray-900 uppercase tracking-wide">
              <Camera className="w-5 h-5 text-gray-700 shrink-0" /> รูปถ่ายสภาพเครื่องและหลักฐานอื่นๆ
            </label>

            {finalOtherImages.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {finalOtherImages.map((img: any) => {
                  const isMarkedForDelete = deletedImageIds.includes(img.id);
                  const imageUrl = getSafeImageUrl(img.url);
                  return (
                    <div key={img.id} className={`relative rounded-lg overflow-hidden border-2 bg-white ${isMarkedForDelete ? 'border-red-500 opacity-40' : 'border-gray-200'}`}>
                      <div onClick={() => openGalleryAt(imageUrl)} className="cursor-pointer group relative block">
                        <img src={imageUrl} alt="Other" className="w-full h-24 object-cover group-hover:opacity-90 transition" />
                      </div>
                      {isEditing && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleDeleteOldImage(img.id); }}
                          className={`absolute top-1 right-1 p-1.5 rounded-md text-white text-xs flex items-center gap-1 z-10 ${isMarkedForDelete ? 'bg-blue-600' : 'bg-red-600 hover:bg-red-700'}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {isMarkedForDelete ? 'ยกเลิก' : 'ลบ'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">ยังไม่มีรูปถ่ายอื่นๆ เพิ่มเติม</p>
            )}

            {isEditing && (
              <div className="pt-2 space-y-3">
                <input
                  type="file"
                  name="otherImages"
                  multiple
                  accept="image/*"
                  onChange={handleOtherChange}
                  className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                {newOtherPreviews.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {newOtherPreviews.map((src, idx) => (
                      <div key={idx} className="relative rounded-lg overflow-hidden border border-blue-300 bg-white">
                        <img src={src} alt="Preview" className="w-full h-24 object-cover" />
                        <button type="button" onClick={() => handleRemoveNewOther(idx)} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-md cursor-pointer">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4 w-full">
            <label className="flex items-center gap-2.5 text-xs sm:text-sm font-extrabold text-gray-900 uppercase tracking-wide">
              <Layers className="w-5 h-5 text-blue-600 shrink-0" /> ประวัติการเบิกอะไหล่และรูปหลักฐาน
            </label>

            {sparePartLogs.length > 0 ? (
              <div className="space-y-6">
                {sparePartLogs.map((log: any, index: number) => {
                  const logKey = log.id || `log-${index}`;
                  const logImages = log.images ? log.images.filter((img: any) => img && img.url && typeof img.url === 'string' && img.url.trim() !== '') : [];
                  const fullBoardOldImg = logImages[0]; 
                  const qrCodeOldImg = logImages[1];    

                  const isFullBoardDeleted = fullBoardOldImg && deletedImageIds.includes(fullBoardOldImg.id);
                  const isQrCodeDeleted = qrCodeOldImg && deletedImageIds.includes(qrCodeOldImg.id);

                  const fullBoardPreview = newStockLogPreviews[`${logKey}_full`];
                  const qrCodePreview = newStockLogPreviews[`${logKey}_qr`];

                  const boardModelCode = log.sparePart?.boardModelCode || log.sparePart?.qrModelCode || log.sparePart?.code || '-';

                  return (
                    <div key={logKey} className="p-3 sm:p-4 bg-white rounded-xl border border-gray-200 space-y-4 shadow-xs w-full">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-2.5 py-1 font-bold rounded-lg bg-blue-100 text-blue-700">
                            {log.sparePart?.name || 'อะไหล่'}
                          </span>
                          
                          <span className="text-xs font-bold text-gray-800 bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200">
                            รหัสบอร์ด: <strong className="text-indigo-700">{boardModelCode}</strong>
                          </span>

                          <span className="text-xs font-semibold text-gray-600">
                            จำนวน: {log.quantity} ชิ้น
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString('th-TH') : ''}
                        </span>
                      </div>

                      {log.note && (
                        <p className="text-xs text-gray-600">
                          <span className="font-bold">หมายเหตุ:</span> {log.note}
                        </p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        
                        <div className="p-3 bg-gray-50 rounded-xl border border-dashed border-gray-300 space-y-2">
                          <p className="text-xs font-bold text-gray-700">รูปบอร์ดตัวเก่าเต็มใบ</p>
                          
                          {fullBoardOldImg && !fullBoardPreview && (
                            <div className={`relative rounded-lg overflow-hidden border ${isFullBoardDeleted ? 'border-red-500 opacity-40' : 'border-gray-200'}`}>
                              <div onClick={() => openGalleryAt(getSafeImageUrl(fullBoardOldImg.url))} className="cursor-pointer">
                                <img src={getSafeImageUrl(fullBoardOldImg.url)} alt="Full Board" className="w-full h-32 object-cover" />
                              </div>
                              {isEditing && (
                                <button type="button" onClick={() => toggleDeleteOldImage(fullBoardOldImg.id)} className={`absolute top-1 right-1 px-2 py-1 rounded text-white text-xs ${isFullBoardDeleted ? 'bg-blue-600' : 'bg-red-600'}`}>
                                  {isFullBoardDeleted ? 'ยกเลิก' : 'ลบ'}
                                </button>
                              )}
                            </div>
                          )}

                          {fullBoardPreview && (
                            <div className="relative rounded-lg overflow-hidden border border-blue-400 bg-white">
                              <img src={fullBoardPreview} alt="Preview Full" className="w-full h-32 object-cover" />
                              <button type="button" onClick={() => setNewStockLogPreviews(prev => ({ ...prev, [`${logKey}_full`]: '' }))} className="absolute top-1 right-1 bg-red-600 text-white px-2 py-1 rounded text-xs cursor-pointer">ยกเลิก</button>
                            </div>
                          )}

                          {!fullBoardOldImg && !fullBoardPreview && isEditing && (
                            <label className="flex flex-col items-center justify-center border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/50 hover:bg-blue-50 rounded-xl p-4 cursor-pointer transition text-center group">
                              <Camera className="w-8 h-8 text-blue-500 mb-1 group-hover:scale-110 transition" />
                              <span className="text-xs font-bold text-blue-700">ถ่ายรูป / เลือกรูปเต็มบอร์ด</span>
                              <span className="text-[10px] text-gray-500 mt-0.5">กดเพื่อเลือกจากอัลบั้มหรือเปิดกล้อง</span>
                              <input 
                                type="file" 
                                name={`fullBoardImages_${log.id || logKey}`} 
                                accept="image/*" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setNewStockLogPreviews(prev => ({ ...prev, [`${logKey}_full`]: URL.createObjectURL(file) }));
                                  }
                                }}
                                className="hidden" 
                              />
                            </label>
                          )}

                          {!fullBoardOldImg && !fullBoardPreview && !isEditing && (
                            <p className="text-xs text-gray-400 italic">ไม่มีรูปภาพ</p>
                          )}

                          {fullBoardOldImg && !fullBoardPreview && isEditing && !isFullBoardDeleted && (
                            <div className="pt-1">
                              <label className="text-[11px] text-blue-600 font-semibold cursor-pointer hover:underline block text-center">
                                เปลี่ยนรูปใหม่ (เลือกจากอัลบั้ม/กล้อง)
                                <input 
                                  type="file" 
                                  name={`fullBoardImages_${log.id || logKey}`} 
                                  accept="image/*" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setNewStockLogPreviews(prev => ({ ...prev, [`${logKey}_full`]: URL.createObjectURL(file) }));
                                    }
                                  }}
                                  className="hidden" 
                                />
                              </label>
                            </div>
                          )}
                        </div>

                        <div className="p-3 bg-gray-50 rounded-xl border border-dashed border-gray-300 space-y-2">
                          <p className="text-xs font-bold text-gray-700">รูป QR Code / ป้าย S/N ตัวเก่า</p>
                          
                          {qrCodeOldImg && !qrCodePreview && (
                            <div className={`relative rounded-lg overflow-hidden border ${isQrCodeDeleted ? 'border-red-500 opacity-40' : 'border-gray-200'}`}>
                              <div onClick={() => openGalleryAt(getSafeImageUrl(qrCodeOldImg.url))} className="cursor-pointer">
                                <img src={getSafeImageUrl(qrCodeOldImg.url)} alt="QR Code" className="w-full h-32 object-cover" />
                              </div>
                              {isEditing && (
                                <button type="button" onClick={() => toggleDeleteOldImage(qrCodeOldImg.id)} className={`absolute top-1 right-1 px-2 py-1 rounded text-white text-xs ${isQrCodeDeleted ? 'bg-blue-600' : 'bg-red-600'}`}>
                                  {isQrCodeDeleted ? 'ยกเลิก' : 'ลบ'}
                                </button>
                              )}
                            </div>
                          )}

                          {qrCodePreview && (
                            <div className="relative rounded-lg overflow-hidden border border-blue-400 bg-white">
                              <img src={qrCodePreview} alt="Preview QR" className="w-full h-32 object-cover" />
                              <button type="button" onClick={() => setNewStockLogPreviews(prev => ({ ...prev, [`${logKey}_qr`]: '' }))} className="absolute top-1 right-1 bg-red-600 text-white px-2 py-1 rounded text-xs cursor-pointer">ยกเลิก</button>
                            </div>
                          )}

                          {!qrCodeOldImg && !qrCodePreview && isEditing && (
                            <label className="flex flex-col items-center justify-center border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/50 hover:bg-blue-50 rounded-xl p-4 cursor-pointer transition text-center group">
                              <Camera className="w-8 h-8 text-blue-500 mb-1 group-hover:scale-110 transition" />
                              <span className="text-xs font-bold text-blue-700">ถ่ายรูป / เลือกรูป QR Code</span>
                              <span className="text-[10px] text-gray-500 mt-0.5">กดเพื่อเลือกจากอัลบั้มหรือเปิดกล้อง</span>
                              <input 
                                type="file" 
                                name={`qrCodeImages_${log.id || logKey}`} 
                                accept="image/*" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setNewStockLogPreviews(prev => ({ ...prev, [`${logKey}_qr`]: URL.createObjectURL(file) }));
                                  }
                                }}
                                className="hidden" 
                              />
                            </label>
                          )}

                          {!qrCodeOldImg && !qrCodePreview && !isEditing && (
                            <p className="text-xs text-gray-400 italic">ไม่มีรูปภาพ</p>
                          )}

                          {qrCodeOldImg && !qrCodePreview && isEditing && !isQrCodeDeleted && (
                            <div className="pt-1">
                              <label className="text-[11px] text-blue-600 font-semibold cursor-pointer hover:underline block text-center">
                                เปลี่ยนรูปใหม่ (เลือกจากอัลบั้ม/กล้อง)
                                <input 
                                  type="file" 
                                  name={`qrCodeImages_${log.id || logKey}`} 
                                  accept="image/*" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setNewStockLogPreviews(prev => ({ ...prev, [`${logKey}_qr`]: URL.createObjectURL(file) }));
                                    }
                                  }}
                                  className="hidden" 
                                />
                              </label>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">ยังไม่มีประวัติการเบิกอะไหล่</p>
            )}
          </div>

        </div>

        {isEditing && (
          <div className="md:col-span-2 lg:col-span-3 flex items-center justify-end gap-3 pt-4 border-t border-gray-100 w-full">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>บันทึกการเปลี่ยนแปลง</span>
                </>
              )}
            </button>
          </div>
        )}
      </form>

      {activeImageIndex !== null && allGalleryImages.length > 0 && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center select-none overflow-hidden"
          onClick={() => setActiveImageIndex(null)}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
        >
          <div 
            className="absolute top-0 left-0 right-0 h-16 bg-black/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-50 text-white border-b border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
              <span className="text-xs sm:text-sm font-semibold tracking-wide text-white whitespace-nowrap">
                รูปที่ {activeImageIndex + 1} จาก {allGalleryImages.length}
              </span>
              {allGalleryImages[activeImageIndex]?.label && (
                <span className="text-[10px] sm:text-xs text-gray-300 bg-white/10 px-2.5 py-1 rounded-lg border border-white/10 truncate max-w-[150px] sm:max-w-none">
                  {allGalleryImages[activeImageIndex].label}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <button 
                type="button" 
                onClick={handleZoomIn} 
                className="p-2 hover:bg-white/10 rounded-xl transition cursor-pointer text-gray-200 hover:text-white"
                title="ซูมเข้า"
              >
                <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button 
                type="button" 
                onClick={handleZoomOut} 
                className="p-2 hover:bg-white/10 rounded-xl transition cursor-pointer text-gray-200 hover:text-white"
                title="ซูมออก"
              >
                <ZoomOut className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button 
                type="button" 
                onClick={handleRotate} 
                className="p-2 hover:bg-white/10 rounded-xl transition cursor-pointer text-gray-200 hover:text-white"
                title="หมุนรูปภาพ"
              >
                <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button 
                type="button" 
                onClick={handleDownloadImage} 
                className="p-2 hover:bg-white/10 rounded-xl transition cursor-pointer text-gray-200 hover:text-white"
                title="ดาวน์โหลดรูปภาพ"
              >
                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button 
                type="button" 
                onClick={() => setActiveImageIndex(null)} 
                className="p-2 hover:bg-red-600/80 rounded-xl transition cursor-pointer text-gray-200 hover:text-white ml-1"
                title="ปิด"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>

          {allGalleryImages.length > 1 && (
            <button
              type="button"
              onClick={handlePrevImage}
              className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 p-2 sm:p-3.5 bg-black/50 hover:bg-black/80 text-white rounded-full transition z-50 cursor-pointer backdrop-blur-sm border border-white/10"
              title="รูปก่อนหน้า"
            >
              <ChevronLeft className="w-5 h-5 sm:w-7 sm:h-7" />
            </button>
          )}

          <div 
            className="relative max-w-[90vw] max-h-[80vh] flex items-center justify-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={handleMouseDown}
          >
            <img
              src={allGalleryImages[activeImageIndex]?.url}
              alt="Gallery Preview"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel}) rotate(${rotation}deg)`,
                cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                transition: isDragging ? 'none' : 'transform 0.2s ease-out'
              }}
              className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg shadow-2xl select-none"
              draggable={false}
            />
          </div>

          {allGalleryImages.length > 1 && (
            <button
              type="button"
              onClick={handleNextImage}
              className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 p-2 sm:p-3.5 bg-black/50 hover:bg-black/80 text-white rounded-full transition z-50 cursor-pointer backdrop-blur-sm border border-white/10"
              title="รูปถัดไป"
            >
              <ChevronRight className="w-5 h-5 sm:w-7 sm:h-7" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}