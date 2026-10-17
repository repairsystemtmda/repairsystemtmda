'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Pencil, ScanLine, Server, User, Phone, Tag, Layers, FileText, Camera, Image as ImageIcon, Layers as LayersIcon, X, Plus, Trash2, CameraIcon, Wifi, Download, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight, Loader2, ShieldCheck, ArrowRight, RefreshCw, Zap, Truck, Search 
} from 'lucide-react';

interface Brand {
  id: string;
  name: string;
  category?: string | null;
}

interface BackupDeviceImage {
  id: string;
  url: string;
  type?: string | null;
  category?: string | null;
  isNameplate?: boolean;
}

interface StockLogImage {
  id: string;
  url: string;
  type?: string | null;
}

interface StockLog {
  id: string;
  sparePartId: string;
  quantity: number;
  type?: string;
  note?: string | null;
  createdAt: string | Date;
  sparePart: { 
    name: string; 
    code: string | null; 
    qrModelCode: string | null;
    boardModelCode: string | null;
    boardSerialNumber?: string | null;
  };
  images: StockLogImage[];
}

interface JobItem {
  id: string;
  jobNo: string;
  customerName: string | null;
  phone: string | null;
  createdAt: string | Date;
  stockLogs: StockLog[];
}

interface BackupDeviceData {
  id: string;
  category: string | null;
  brandId: string | null;
  brand: Brand | null;
  model: string;
  serialNumber: string;
  productNo?: string | null;
  status: string;
  customerName: string | null;
  phone: string | null;
  note: string | null;
  hasBox?: boolean;
  hasWifiDongle?: boolean;
  wifiDongleSn?: string | null;
  imageUrl?: string | null;
  receiverName?: string | null;
  images?: BackupDeviceImage[];
  jobs?: JobItem[];
}

export default function BackupDeviceFormClient({ 
  device, 
  brands, 
  statusLabels,
  updateAction
}: { 
  device: BackupDeviceData; 
  brands: Brand[]; 
  statusLabels: Record<string, string>;
  updateAction: (id: string, formData: FormData) => Promise<any>;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState(device.status);
  const [category, setCategory] = useState(device.category || 'อินเวอร์เตอร์');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const currentCustomerName = device.customerName || device.jobs?.[0]?.customerName || '';
  const currentPhone = device.phone || device.jobs?.[0]?.phone || '';

  const getInitialBrandId = () => {
    if (device.brandId) return device.brandId;
    if (device.brand?.name) {
      const found = brands.find(
        b => b.name.toLowerCase() === device.brand?.name?.toLowerCase()
      );
      if (found) return found.id;
    }
    return brands.length > 0 ? brands[0].id : '';
  };

  const [brandId, setBrandId] = useState(getInitialBrandId());

  useEffect(() => {
    const matchedId = getInitialBrandId();
    if (matchedId && !brandId) {
      setBrandId(matchedId);
    }
  }, [device, brands]);

  const getFilteredBrands = () => {
    const uniqueBrandsMap = new Map();
    brands.forEach(b => {
      if (!b.category || b.category.trim() === category.trim()) {
        const nameKey = (b.name || '').trim().toLowerCase();
        if (!uniqueBrandsMap.has(nameKey)) {
          uniqueBrandsMap.set(nameKey, b);
        }
      }
    });

    return Array.from(uniqueBrandsMap.values());
  };

  const filteredBrands = getFilteredBrands();

  useEffect(() => {
    if (filteredBrands.length > 0) {
      if (!filteredBrands.some(b => b.id === brandId)) {
        setBrandId(filteredBrands[0].id);
      }
    } else {
      setBrandId('');
    }
  }, [category]);

  const [hasBox, setHasBox] = useState(device.hasBox || false);
  const [hasWifiDongle, setHasWifiDongle] = useState(device.hasWifiDongle || false);

  const [newOtherImages, setNewOtherImages] = useState<File[]>([]);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);
  const [deletedStockLogImageIds, setDeletedStockLogImageIds] = useState<string[]>([]);

  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const [allGalleryImages, setAllGalleryImages] = useState<string[]>([]);
  
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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

  const collectAllImagesForGallery = () => {
    const list: string[] = [];
    if (device.imageUrl) {
      const u = getSafeImageUrl(device.imageUrl);
      if (u) list.push(u);
    }
    if (device.images) {
      device.images.forEach(img => {
        if (!deletedImageIds.includes(img.id)) {
          const u = getSafeImageUrl(img.url);
          if (u) list.push(u);
        }
      });
    }
    newOtherImages.forEach(file => {
      list.push(URL.createObjectURL(file));
    });
    if (device.jobs) {
      device.jobs.forEach(job => {
        job.stockLogs?.forEach(log => {
          log.images?.forEach(img => {
            if (!deletedStockLogImageIds.includes(img.id)) {
              const u = getSafeImageUrl(img.url);
              if (u) list.push(u);
            }
          });
        });
      });
    }
    return list;
  };

  const openGalleryAt = (imageUrl: string) => {
    const allUrls = collectAllImagesForGallery();
    setAllGalleryImages(allUrls);
    const index = allUrls.indexOf(imageUrl);
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
    setRotation(prev => (prev + 90) % 360);
  };

  const handleDownloadImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeImageIndex === null) return;
    const currentUrl = allGalleryImages[activeImageIndex];
    if (!currentUrl) return;

    const link = document.createElement('a');
    link.href = currentUrl;
    link.download = `backup-device-image-${Date.now()}.jpg`;
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

  const selectedBrandObj = brands.find(b => b.id === brandId);
  const brandName = selectedBrandObj?.name || device.brand?.name || '';
  const brandLower = brandName.toLowerCase().trim();
  const isInvt = brandLower === 'invt';
  const supportsWifi = brandLower === 'invt' || brandLower === 'deye';

  const getDynamicStatusLabel = (st: string) => {
    switch (st) {
      case 'WAITING_DEYE_SEND':
        return 'รอส่ง Deye';
      case 'SENT_TO_DEYE':
        return 'ส่งเครื่องไป Deye แล้ว';
      case 'COMPLETED_BY_DEYE':
        return 'Deye ซ่อมเสร็จกลับมาแล้ว';
      case 'SWAPPED_PERMANENT':
        return 'สลับเปลี่ยนเครื่องสำรองให้ถาวร';
      default:
        return statusLabels[st] || st;
    }
  };

  const handleQuickStatusUpdate = async (nextStatus: string) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('status', nextStatus);
      formData.append('category', category);
      formData.append('brandId', brandId);
      formData.append('model', device.model);
      formData.append('serialNumber', device.serialNumber);
      if (!isInvt && device.productNo) formData.append('productNo', device.productNo);
      
      if (nextStatus === 'AVAILABLE') {
        formData.append('customerName', '');
        formData.append('phone', '');
      } else {
        if (currentCustomerName) formData.append('customerName', currentCustomerName);
        if (currentPhone) formData.append('phone', currentPhone);
      }

      if (device.note) formData.append('note', device.note);
      formData.append('hasBox', hasBox ? 'on' : '');
      formData.append('hasWifiDongle', hasWifiDongle ? 'on' : '');
      if (supportsWifi && hasWifiDongle && device.wifiDongleSn) formData.append('wifiDongleSn', device.wifiDongleSn);
      formData.append('deletedImageIds', JSON.stringify(deletedImageIds));
      formData.append('deletedStockLogImageIds', JSON.stringify(deletedStockLogImageIds));

      await updateAction(device.id, formData);
      setStatus(nextStatus);
    } catch (error: any) {
      console.error('Quick status update failed:', error);
      alert('บันทึกไม่สำเร็จ: ' + (error?.message || 'เกิดข้อผิดพลาด'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtherImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setNewOtherImages((prev) => [...prev, ...filesArray]);
    }
  };

  const removeNewOtherImage = (index: number) => {
    setNewOtherImages((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleDeleteImage = (id: string) => {
    setDeletedImageIds((prev) => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleDeleteStockLogImage = (id: string) => {
    setDeletedStockLogImageIds((prev) =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const otherImagesList = device.images?.filter((img) => {
    const t = (img.type || '').toLowerCase();
    const c = (img.category || '').toLowerCase();
    const isNameplate = t.includes('nameplate') || c.includes('nameplate') || img.isNameplate === true || t.includes('serial') || c.includes('serial');
    return !isNameplate && img.url !== device.imageUrl;
  }) || [];

  if (!isMounted) {
    return null;
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-12">
      
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/inventory/backups"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs md:text-sm font-semibold rounded-xl border border-gray-200 shadow-xs transition"
        >
          <ChevronLeft className="w-4 h-4" /> กลับไปหน้าตารางเครื่องสำรอง
        </Link>
      </div>

      <div className="bg-[#0f172a] rounded-2xl shadow-xl p-4 md:p-6 text-white space-y-4 border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/30 border border-indigo-500/30 rounded-xl text-indigo-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-bold text-white">ระบบควบคุมขั้นตอนเครื่องสำรอง</h2>
              <p className="text-xs text-slate-400">เปลี่ยนสถานะไปยังขั้นตอนถัดไปทันที</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold shadow-inner">
            <span className="text-slate-400">สถานะ:</span>
            <span className="text-emerald-400 font-bold">{getDynamicStatusLabel(status)}</span>
          </div>
        </div>

        <div className="pt-1 flex flex-col sm:flex-row flex-wrap gap-2.5 items-stretch sm:items-center">
          
          {status === 'AVAILABLE' && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleQuickStatusUpdate('MAINTENANCE')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs md:text-sm transition shadow-md cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>กำลังบันทึกส่งซ่อม...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>บันทึกส่งซ่อมบำรุง / เครื่องเสีย (MAINTENANCE)</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          )}

          {status === 'IN_USE' && (
            <>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleQuickStatusUpdate('AVAILABLE')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs md:text-sm transition shadow-md cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>รับเครื่องคืน / พร้อมใช้งาน (AVAILABLE)</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleQuickStatusUpdate('MAINTENANCE')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs md:text-sm transition shadow-md cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>รับเครื่องคืน / ส่งซ่อมบำรุง (MAINTENANCE)</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </>
          )}

          {status === 'MAINTENANCE' && (
            <>
              <Link
                href={`/dashboard/inventory/backups/${device.id}/withdraw`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs md:text-sm transition shadow-md"
              >
                <Zap className="w-4 h-4 text-slate-950" /> เบิกอะไหล่และแนบหลักฐาน
              </Link>

              {(() => {
                const hasWithdrawnParts = device.jobs?.some(job => 
                  job.stockLogs && job.stockLogs.filter((log: any) => log.type !== 'RETURN' && (!log.quantity || log.quantity < 0)).length > 0
                ) || false;

                if (hasWithdrawnParts) {
                  return (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleQuickStatusUpdate('AVAILABLE')}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs md:text-sm transition shadow-md cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>กำลังบันทึก...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>ซ่อมเสร็จ / พร้อมใช้ (AVAILABLE)</span>
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </>
                      )}
                    </button>
                  );
                }
                return null;
              })()}

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleQuickStatusUpdate('WAITING_DEYE_SEND')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs md:text-sm transition shadow-md cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>กำลังเปลี่ยนสถานะ...</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4" />
                    <span>รอส่ง Deye</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </>
          )}

          {status === 'WAITING_DEYE_SEND' && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleQuickStatusUpdate('SENT_TO_DEYE')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs md:text-sm transition shadow-md cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4" />
                  <span>ส่งเครื่องไป Deye แล้ว</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          )}

          {status === 'SENT_TO_DEYE' && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleQuickStatusUpdate('COMPLETED_BY_DEYE')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs md:text-sm transition shadow-md cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Deye ซ่อมเสร็จกลับมาแล้ว</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          )}

          {status === 'COMPLETED_BY_DEYE' && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleQuickStatusUpdate('AVAILABLE')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs md:text-sm transition shadow-md cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>กำลังนำเข้าคลัง...</span>
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  <span>นำเข้าคลังพร้อมใช้ (AVAILABLE)</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          )}

          {status === 'SWAPPED_PERMANENT' && (
            <span className="text-xs text-slate-300 italic bg-slate-800 px-4 py-3 rounded-xl w-full text-center">เครื่องนี้ถูกสลับเปลี่ยนถาวรให้ลูกค้าเรียบร้อยแล้ว</span>
          )}

        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-8">
        <form 
          onSubmit={async (e) => {
            e.preventDefault();

            const hasWithdrawnParts = device.jobs?.some(job => 
              job.stockLogs && job.stockLogs.filter((log: any) => log.type !== 'RETURN' && (!log.quantity || log.quantity < 0)).length > 0
            ) || false;

            if (status === 'AVAILABLE' && !hasWithdrawnParts) {
              alert('⚠️ ไม่สามารถเปลี่ยนสถานะเป็น "ซ่อมเสร็จ / พร้อมใช้" ได้ เนื่องจากยังไม่มีประวัติการเบิกอะไหล่ กรุณาเบิกอะไหล่อย่างน้อย 1 รายการก่อนครับ');
              return;
            }

            setIsSubmitting(true);
            try {
              const formData = new FormData(e.currentTarget);
              await updateAction(device.id, formData);
              
              setNewOtherImages([]);
              setDeletedImageIds([]);
              setDeletedStockLogImageIds([]);
              setIsEditing(false);
              alert('บันทึกข้อมูลสำเร็จ');
            } catch (err: any) {
              console.error(err);
              alert('เกิดข้อผิดพลาดในการบันทึก: ' + (err?.message || ''));
            } finally {
              setIsSubmitting(false);
            }
          }}
          className="space-y-5 md:space-y-6"
        >
          <input type="hidden" name="deletedImageIds" value={JSON.stringify(deletedImageIds)} />
          <input type="hidden" name="deletedStockLogImageIds" value={JSON.stringify(deletedStockLogImageIds)} />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4">
            <h3 className="text-sm md:text-base font-bold text-gray-900 flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-600 shrink-0" /> ข้อมูลรายละเอียดเครื่องสำรอง
            </h3>
            
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs px-3 py-1 font-semibold rounded-lg border bg-blue-50 text-blue-700 border-blue-200">
                สถานะ: {getDynamicStatusLabel(status)}
              </span>

              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer border border-blue-500"
                >
                  <Pencil className="w-4 h-4" /> แก้ไขข้อมูล
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setNewOtherImages([]);
                    setDeletedImageIds([]);
                    setDeletedStockLogImageIds([]);
                  }}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl border border-red-200 transition flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <X className="w-4 h-4" /> ยกเลิก
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">สถานะเครื่องสำรอง</label>
              <select
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={!isEditing}
                className={`w-full px-4 py-3 appearance-none border rounded-xl text-base sm:text-xs md:text-sm font-semibold transition ${
                  isEditing ? 'bg-white border-gray-300 text-black focus:bg-white outline-none' : 'bg-gray-100 text-gray-800 border-gray-200 cursor-not-allowed'
                }`}
              >
                {Object.entries(statusLabels)
                  .filter(([key]) => key !== 'WAITING_DEYE_RETURN')
                  .map(([key, label]) => (
                    <option key={key} value={key} className="text-black">
                      {key} ({label})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">หมวดหมู่อุปกรณ์</label>
              <select
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={!isEditing}
                className={`w-full px-4 py-3 appearance-none border rounded-xl text-base sm:text-xs md:text-sm font-semibold transition ${
                  isEditing ? 'bg-white border-gray-300 text-black focus:bg-white outline-none' : 'bg-gray-100 text-gray-800 border-gray-200 cursor-not-allowed'
                }`}
              >
                <option value="อินเวอร์เตอร์" className="text-black">อินเวอร์เตอร์</option>
                <option value="ออปติไมเซอร์" className="text-black">ออปติไมเซอร์</option>
                <option value="ไมโครอินเวอร์เตอร์" className="text-black">ไมโครอินเวอร์เตอร์</option>
                <option value="แบตเตอรี่" className="text-black">แบตเตอรี่</option>
                <option value="อินเวอร์เตอร์ปั๊มน้ำ" className="text-black">อินเวอร์เตอร์ปั๊มน้ำ</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">ยี่ห้อ (BRAND)</label>
              <select
                name="brandId"
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                disabled={!isEditing}
                className={`w-full px-4 py-3 appearance-none border rounded-xl text-base sm:text-xs md:text-sm font-semibold transition ${
                  isEditing ? 'bg-white border-gray-300 text-black focus:bg-white outline-none' : 'bg-gray-100 text-gray-800 border-gray-200 cursor-not-allowed'
                }`}
              >
                <option value="" className="text-black">-- เลือกยี่ห้อ --</option>
                {filteredBrands.map(b => (
                  <option key={b.id} value={b.id} className="text-black">{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">รุ่น (MODEL)</label>
              <input
                type="text"
                name="model"
                defaultValue={device.model}
                required
                disabled={!isEditing}
                className={`w-full px-4 py-3 border rounded-xl text-xs md:text-sm font-semibold transition ${
                  isEditing ? 'bg-white border-gray-300 text-black focus:bg-white outline-none' : 'bg-gray-100 text-gray-800 border-gray-200 cursor-not-allowed'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">SERIAL NUMBER (S/N)</label>
              <input
                type="text"
                name="serialNumber"
                defaultValue={device.serialNumber}
                required
                disabled={!isEditing}
                className={`w-full px-4 py-3 border rounded-xl text-xs md:text-sm font-mono font-bold transition ${
                  isEditing ? 'bg-white border-blue-300 text-blue-600 focus:bg-white outline-none' : 'bg-gray-100 text-blue-600 border-gray-200 cursor-not-allowed'
                }`}
              />
            </div>

            {!isInvt && (
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Product No.</label>
                <input
                  type="text"
                  name="productNo"
                  defaultValue={device.productNo || ''}
                  disabled={!isEditing}
                  className={`w-full px-4 py-3 border rounded-xl text-xs md:text-sm font-mono font-semibold transition ${
                    isEditing ? 'bg-white border-gray-300 text-black focus:bg-white outline-none' : 'bg-gray-100 text-gray-800 border-gray-200 cursor-not-allowed'
                  }`}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">ชื่อลูกค้าผู้ยืม</label>
              <input
                type="text"
                name="customerName"
                defaultValue={currentCustomerName}
                disabled={!isEditing}
                className={`w-full px-4 py-3 border rounded-xl text-xs md:text-sm font-semibold transition ${
                  isEditing ? 'bg-white border-gray-300 text-black focus:bg-white outline-none' : 'bg-gray-100 text-gray-800 border-gray-200 cursor-not-allowed'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">เบอร์โทรศัพท์ติดต่อ</label>
              <input
                type="text"
                name="phone"
                defaultValue={currentPhone}
                disabled={!isEditing}
                className={`w-full px-4 py-3 border rounded-xl text-xs md:text-sm font-semibold transition ${
                  isEditing ? 'bg-white border-gray-300 text-black focus:bg-white outline-none' : 'bg-gray-100 text-gray-800 border-gray-200 cursor-not-allowed'
                }`}
              />
            </div>

            {device.receiverName && (
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">ผู้บันทึก / ผู้ทำรายการ</label>
                <div className="w-full px-4 py-3 border rounded-xl text-xs md:text-sm font-semibold bg-gray-100 text-gray-800 border-gray-200 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{device.receiverName}</span>
                </div>
              </div>
            )}

            {supportsWifi && hasWifiDongle && (
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">SERIAL NUMBER WIFI DONGLE</label>
                <input
                  type="text"
                  name="wifiDongleSn"
                  defaultValue={device.wifiDongleSn || ''}
                  disabled={!isEditing}
                  className={`w-full px-4 py-3 border rounded-xl text-xs md:text-sm font-mono font-semibold transition ${
                    isEditing ? 'bg-white border-gray-300 text-black focus:bg-white outline-none' : 'bg-gray-100 text-gray-800 border-gray-200 cursor-not-allowed'
                  }`}
                />
              </div>
            )}

            <div className="md:col-span-2 lg:col-span-3 flex flex-wrap gap-4 pt-1">
              <label className={`flex items-center gap-2 text-xs md:text-sm font-bold text-gray-800 ${!isEditing ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  name="hasBox"
                  checked={hasBox}
                  disabled={!isEditing}
                  onChange={(e) => setHasBox(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                📦 มีกล่องอุปกรณ์ครบ
              </label>

              {supportsWifi && (
                <label className={`flex items-center gap-2 text-xs md:text-sm font-bold text-gray-800 ${!isEditing ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    name="hasWifiDongle"
                    checked={hasWifiDongle}
                    disabled={!isEditing}
                    onChange={(e) => setHasWifiDongle(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  🛜 มี WiFi Dongle
                </label>
              )}
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">หมายเหตุ / อาการเสีย</label>
              <textarea
                name="note"
                rows={3}
                defaultValue={device.note || ''}
                disabled={!isEditing}
                className={`w-full px-4 py-3 border rounded-xl text-xs md:text-sm font-semibold transition ${
                  isEditing ? 'bg-white border-gray-300 text-black focus:bg-white outline-none' : 'bg-gray-100 text-gray-800 border-gray-200 cursor-not-allowed'
                }`}
              />
            </div>

            {!isInvt && (
              <div className="md:col-span-2 lg:col-span-3 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                <label className="block text-xs md:text-sm font-extrabold text-gray-900 uppercase tracking-wide">
                  🖼️ รูปถ่ายเนมเพลท / ป้าย S/N เครื่องสำรอง
                </label>
                {device.imageUrl ? (
                  <div className="relative rounded-lg overflow-hidden border-2 border-gray-200 bg-white max-w-xs">
                    <div onClick={() => openGalleryAt(getSafeImageUrl(device.imageUrl!))} className="cursor-pointer group relative block">
                      <img src={getSafeImageUrl(device.imageUrl)} alt="Nameplate" className="w-full h-36 object-cover group-hover:opacity-90 transition" />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">ไม่มีรูปถ่ายเนมเพลท / ป้าย S/N</p>
                )}
              </div>
            )}

            <div className="md:col-span-2 lg:col-span-3 space-y-4 pt-2">
              
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                <label className="block text-xs md:text-sm font-extrabold text-gray-900 uppercase tracking-wide">
                  📸 รูปถ่ายสภาพเครื่องและหลักฐานอื่นๆ
                </label>

                {otherImagesList.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {otherImagesList.map((img) => {
                      const isDeleted = deletedImageIds.includes(img.id);
                      const imageUrl = getSafeImageUrl(img.url);
                      return (
                        <div key={img.id} className={`relative rounded-lg overflow-hidden border-2 bg-white ${isDeleted ? 'border-red-500 opacity-40' : 'border-gray-200'}`}>
                          <div onClick={() => openGalleryAt(imageUrl)} className="cursor-pointer group relative block">
                            <img src={imageUrl} alt="Other" className="w-full h-28 object-cover group-hover:opacity-90 transition" />
                          </div>
                          {isEditing && (
                            <button
                              type="button"
                              onClick={() => toggleDeleteImage(img.id)}
                              className={`absolute top-1 right-1 p-1 rounded-md text-white text-xs flex items-center gap-1 z-10 ${isDeleted ? 'bg-blue-600' : 'bg-red-600 hover:bg-red-700'}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" /> {isDeleted ? 'ยกเลิก' : 'ลบ'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">ไม่มีรูปถ่ายสภาพเครื่องหรือหลักฐานอื่นๆ เพิ่มเติม</p>
                )}

                {isEditing && (
                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">เพิ่มรูปภาพอื่นๆ</label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleOtherImageChange}
                      className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 cursor-pointer"
                    />
                    {newOtherImages.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                        {newOtherImages.map((file, idx) => (
                          <div key={idx} className="relative rounded-lg overflow-hidden border border-blue-300">
                            <img src={URL.createObjectURL(file)} alt="New Other" className="w-full h-28 object-cover" />
                            <button type="button" onClick={() => removeNewOtherImage(idx)} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-md cursor-pointer">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                <label className="block text-xs md:text-sm font-extrabold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-600 shrink-0" /> ประวัติการเบิกอะไหล่และรูปหลักฐานการซ่อม
                </label>

                {device.jobs && device.jobs.length > 0 ? (
                  <div className="space-y-4">
                    {device.jobs.map((job) => (
                      <div key={job.id} className="space-y-4">
                        {job.stockLogs?.map((log, index) => {
                          const logKey = log.id || `log-${index}`;
                          const logImages = log.images || [];
                          const fullBoardImg = logImages[0];
                          const qrCodeImg = logImages[1];

                          const isFullBoardDeleted = fullBoardImg && deletedStockLogImageIds.includes(fullBoardImg.id);
                          const isQrCodeDeleted = qrCodeImg && deletedStockLogImageIds.includes(qrCodeImg.id);

                          const boardModelCode = log.sparePart?.boardModelCode || log.sparePart?.qrModelCode || log.sparePart?.code || '-';

                          return (
                            <div key={logKey} className="p-3.5 sm:p-4 bg-white rounded-xl border border-gray-200 space-y-3 shadow-xs">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs px-2.5 py-1 font-bold rounded-lg bg-blue-100 text-blue-700">
                                    {log.sparePart?.name || 'อะไหล่'}
                                  </span>
                                  
                                  <span className="text-xs font-bold text-gray-800 bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200">
                                    รหัส: <strong className="text-blue-600">{boardModelCode}</strong>
                                  </span>

                                  <span className="text-xs font-semibold text-gray-700">
                                    จำนวน: {log.quantity} ชิ้น
                                  </span>
                                </div>
                                <span className="text-[11px] text-gray-400">
                                  {log.createdAt ? new Date(log.createdAt).toLocaleString('th-TH') : ''}
                                </span>
                              </div>

                              {log.note && (
                                <p className="text-xs text-gray-600">
                                  <span className="font-bold">หมายเหตุ:</span> {log.note}
                                </p>
                              )}

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                
                                <div className="p-3 bg-gray-50 rounded-xl border border-dashed border-gray-300 space-y-2">
                                  <span className="block text-xs font-bold text-gray-800">
                                    รูปที่ 1: เต็มบอร์ดอะไหล่
                                  </span>

                                  {fullBoardImg && !isFullBoardDeleted ? (
                                    <div className={`relative rounded-lg overflow-hidden border-2 bg-white ${isFullBoardDeleted ? 'border-red-500 opacity-40' : 'border-gray-200'}`}>
                                      <div onClick={() => openGalleryAt(getSafeImageUrl(fullBoardImg.url))} className="cursor-pointer group relative block">
                                        <img src={getSafeImageUrl(fullBoardImg.url)} alt="Full Board" className="w-full h-28 object-cover group-hover:opacity-90 transition" />
                                      </div>
                                      {isEditing && (
                                        <button
                                          type="button"
                                          onClick={() => toggleDeleteStockLogImage(fullBoardImg.id)}
                                          className={`absolute top-1 right-1 p-1 rounded-md text-white text-xs flex items-center gap-1 z-10 ${isFullBoardDeleted ? 'bg-blue-600' : 'bg-red-600 hover:bg-red-700'}`}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" /> {isFullBoardDeleted ? 'ยกเลิก' : 'ลบ'}
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-gray-400 italic">ไม่มีรูปถ่ายเต็มบอร์ด</p>
                                  )}
                                </div>

                                <div className="p-3 bg-gray-50 rounded-xl border border-dashed border-gray-300 space-y-2">
                                  <span className="block text-xs font-bold text-gray-800">
                                    รูปที่ 2: QR Code / S/N
                                  </span>

                                  {qrCodeImg && !isQrCodeDeleted ? (
                                    <div className={`relative rounded-lg overflow-hidden border-2 bg-white ${isQrCodeDeleted ? 'border-red-500 opacity-40' : 'border-gray-200'}`}>
                                      <div onClick={() => openGalleryAt(getSafeImageUrl(qrCodeImg.url))} className="cursor-pointer group relative block">
                                        <img src={getSafeImageUrl(qrCodeImg.url)} alt="QR Code" className="w-full h-28 object-cover group-hover:opacity-90 transition" />
                                      </div>
                                      {isEditing && (
                                        <button
                                          type="button"
                                          onClick={() => toggleDeleteStockLogImage(qrCodeImg.id)}
                                          className={`absolute top-1 right-1 p-1 rounded-md text-white text-xs flex items-center gap-1 z-10 ${isQrCodeDeleted ? 'bg-blue-600' : 'bg-red-600 hover:bg-red-700'}`}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" /> {isQrCodeDeleted ? 'ยกเลิก' : 'ลบ'}
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-gray-400 italic">ไม่มีรูปถ่าย QR Code/SN</p>
                                  )}
                                </div>

                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">ยังไม่มีประวัติการเบิกอะไหล่ซ่อมเครื่องสำรองนี้</p>
                )}
              </div>

            </div>

          </div>

          {isEditing && (
            <div className="flex flex-col sm:flex-row justify-end gap-2.5 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setNewOtherImages([]);
                  setDeletedImageIds([]);
                  setDeletedStockLogImageIds([]);
                }}
                className="w-full sm:w-auto px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs md:text-sm font-semibold rounded-xl transition cursor-pointer text-center"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs md:text-sm font-semibold rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer border border-blue-500"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                บันทึกการแก้ไข
              </button>
            </div>
          )}
        </form>
      </div>

      {activeImageIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col select-none"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
        >
          <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-3 md:px-6 py-3 bg-gradient-to-b from-black/90 to-transparent text-white">
            <div className="text-xs md:text-sm font-bold">
              {activeImageIndex + 1} / {allGalleryImages.length}
            </div>
            <div className="flex items-center gap-1.5 md:gap-3">
              <button type="button" onClick={handleZoomIn} className="p-2 hover:bg-white/10 rounded-lg transition cursor-pointer" title="ซูมเข้า">
                <ZoomIn className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              <button type="button" onClick={handleZoomOut} className="p-2 hover:bg-white/10 rounded-lg transition cursor-pointer" title="ซูมออก">
                <ZoomOut className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              <button type="button" onClick={handleRotate} className="p-2 hover:bg-white/10 rounded-lg transition cursor-pointer" title="หมุน">
                <RotateCw className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              <button type="button" onClick={handleDownloadImage} className="p-2 hover:bg-white/10 rounded-lg transition cursor-pointer" title="ดาวน์โหลด">
                <Download className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              <button type="button" onClick={() => setActiveImageIndex(null)} className="p-2 hover:bg-red-600/80 rounded-lg transition ml-2 cursor-pointer" title="ปิด">
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center overflow-hidden relative p-4 md:p-12" onMouseDown={handleMouseDown}>
            <div
              className="relative transition-transform duration-75 ease-out cursor-grab active:cursor-grabbing flex items-center justify-center"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel}) rotate(${rotation}deg)`,
                maxWidth: '100vw',
                maxHeight: '80vh',
              }}
            >
              <img
                src={allGalleryImages[activeImageIndex]}
                alt="Fullview"
                className="max-h-[75vh] max-w-[95vw] object-contain rounded-lg shadow-2xl pointer-events-none"
              />
            </div>

            {allGalleryImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrevImage}
                  className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 p-2.5 md:p-3 rounded-full bg-black/60 text-white hover:bg-black/80 transition z-40 cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
                </button>
                <button
                  type="button"
                  onClick={handleNextImage}
                  className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 p-2.5 md:p-3 rounded-full bg-black/60 text-white hover:bg-black/80 transition z-40 cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}