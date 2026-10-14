export const dynamic = 'force-dynamic';

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  FileSpreadsheet, 
  X, 
  Clock, 
  FileText, 
  Box, 
  Wifi,
  Wrench,
  CheckCircle2,
  Send,
  Truck,
  RefreshCw,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  User
} from 'lucide-react';
import { JOB_STATUSES, getStatusLabel } from '@/lib/constants';
import { isInternalOrBackupJob } from '@/lib/jobUtils';

interface Job {
  id: string;
  jobNo: string;
  status: string;
  category?: string;
  brand?: {
    id?: string;
    name?: string;
    category?: string;
  };
  customerName?: string;
  phone?: string;
  model?: string;
  serialNumber?: string;
  hasBox?: boolean;
  hasWifiDongle?: boolean | string;
  wifiDongleSn?: string;
  createdAt: string;
  user?: {
    name?: string;
    username?: string;
    email?: string;
  };
  createdBy?: string;
  receiverName?: string;
}

interface Brand {
  id: string;
  name: string;
  category?: string;
}

const STANDARD_CATEGORIES = [
  'อินเวอร์เตอร์',
  'ออปติไมเซอร์',
  'ไมโครอินเวอร์เตอร์',
  'แบตเตอรี่',
  'อินเวอร์เตอร์ปั๊มน้ำ'
];

export default function JobsPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get('status');

  const [jobs, setJobs] = useState<Job[]>([]);
  const [brandsList, setBrandsList] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(statusParam || 'ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [brandFilter, setBrandFilter] = useState('ALL');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportBrand, setExportBrand] = useState<'deye' | 'invt'>('deye');
  const [datePreset, setDatePreset] = useState<'7days' | '15days' | 'thisMonth' | 'lastMonth' | 'custom'>('15days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    fetchJobs();
    fetchBrands();
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  useEffect(() => {
    if (statusParam) {
      setStatusFilter(statusParam);
    }
  }, [statusParam]);

  useEffect(() => {
    setBrandFilter('ALL');
    setCurrentPage(1);
  }, [categoryFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [submittedQuery, statusFilter, brandFilter]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/jobs');
      const data = await res.json();
      
      if (res.ok) {
        const jobList = Array.isArray(data) ? data : (data.jobs || []);
        setJobs(jobList);
      } else {
        setJobs([]);
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBrands = async () => {
    try {
      const res = await fetch('/api/admin/brands');
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setBrandsList(data);
      } else if (data.brands && Array.isArray(data.brands)) {
        setBrandsList(data.brands);
      }
    } catch (err) {
      console.error('Failed to fetch brands:', err);
    }
  };

  const normalizeCategory = (cat?: string) => {
    if (!cat) return '';
    const c = cat.toLowerCase().trim();
    if (c.includes('inverter') || c.includes('อินเวอร์เตอร์')) {
      if (c.includes('pump') || c.includes('ปั๊มน้ำ')) return 'อินเวอร์เตอร์ปั๊มน้ำ';
      if (c.includes('micro') || c.includes('ไมโคร')) return 'ไมโครอินเวอร์เตอร์';
      return 'อินเวอร์เตอร์';
    }
    if (c.includes('optimizer') || c.includes('ออปติไมเซอร์')) return 'ออปติไมเซอร์';
    if (c.includes('battery') || c.includes('แบตเตอรี่')) return 'แบตเตอรี่';
    return c;
  };

  const filteredBrandsList = brandsList.filter((brand) => {
    if (categoryFilter === 'ALL') return true;
    if (!brand.category || brand.category.trim() === '') return true; 
    return normalizeCategory(brand.category) === normalizeCategory(categoryFilter);
  }).filter((brand, index, self) => 
    index === self.findIndex((b) => b.name === brand.name)
  );

  const handleDeleteJob = async (id: string, jobNo: string) => {
    if (!confirm(`คุณต้องการลบใบงาน ${jobNo} ใช่หรือไม่?`)) return;

    try {
      const res = await fetch(`/api/jobs/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok) {
        alert('ลบใบงานสำเร็จ');
        fetchJobs();
      } else {
        alert(data.error || 'เกิดข้อผิดพลาดในการลบข้อมูล');
      }
    } catch (err) {
      console.error('Failed to delete job:', err);
      alert('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    }
  };

  const handleConfirmExport = () => {
    const now = new Date();
    let startDate = '';
    let endDate = now.toISOString().split('T')[0];

    if (datePreset === '7days') {
      const d = new Date();
      d.setDate(now.getDate() - 7);
      startDate = d.toISOString().split('T')[0];
    } else if (datePreset === '15days') {
      const d = new Date();
      d.setDate(now.getDate() - 15);
      startDate = d.toISOString().split('T')[0];
    } else if (datePreset === 'thisMonth') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = d.toISOString().split('T')[0];
    } else if (datePreset === 'lastMonth') {
      const startD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endD = new Date(now.getFullYear(), now.getMonth(), 0);
      startDate = startD.toISOString().split('T')[0];
      endDate = endD.toISOString().split('T')[0];
    } else if (datePreset === 'custom') {
      startDate = customStartDate;
      endDate = customEndDate;
      if (!startDate || !endDate) {
        alert('กรุณาเลือกวันที่เริ่มต้นและสิ้นสุดให้ครบถ้วน');
        return;
      }
    }

    let exportUrl = exportBrand === 'deye' 
      ? `/api/export-deye?startDate=${startDate}&endDate=${endDate}`
      : `/api/export-dashboard?startDate=${startDate}&endDate=${endDate}`;

    window.open(exportUrl, '_blank');
    setIsExportModalOpen(false);
  };

  const calculatePendingDays = (createdAt: string) => {
    if (!createdAt) return 0;
    const createdDate = new Date(createdAt);
    const today = new Date();
    createdDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - createdDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
    return diffDays >= 0 ? diffDays : 0;
  };

  const isJobCompleted = (status: string) => {
    const completedStatuses = [
      'COMPLETED', 'COMPLETED_BY_DEYE', 'RETURNED_CUSTOMER_PICKUP',
      'RETURNED_SHIPPED', 'RETURN_BACKUP_AND_DELIVER', 'SWAPPED_PERMANENT',
      'FINAL_SWAPPED_PERMANENT',
      'CLOSED', 'SUCCESS', 'DELIVERED', 'CUSTOMER_PICKED_UP', 'RETURNED', 'CANCELLED',
      'ซ่อมเสร็จสิ้น', 'ส่งมอบคืนลูกค้า', 'ปิดงานแล้ว'
    ];
    return completedStatuses.includes(status);
  };

  const getCustomStatusLabel = (status: string) => {
    switch ((status || '').toUpperCase()) {
      case 'IN_PROGRESS': return 'กำลังดำเนินการซ่อม';
      case 'CLAIM_NEW_MACHINE': return 'เคลมเครื่องใหม่';
      case 'SWAPPED_PERMANENT':
      case 'FINAL_SWAPPED_PERMANENT': 
        return 'สลับเปลี่ยนเครื่องสำรองให้ถาวร';
      default: return getStatusLabel(status);
    }
  };

  const getStatusBadgeConfig = (status: string) => {
    switch ((status || '').toUpperCase()) {
      case 'PENDING':
      case 'WAITING_FOR_REPAIR':
        return { style: 'bg-amber-500 text-white font-bold shadow-xs', Icon: Clock };
      case 'WAITING_FOR_APPROVAL':
        return { style: 'bg-orange-500 text-white font-bold shadow-xs', Icon: AlertCircle };
      case 'DIAGNOSE':
        return { style: 'bg-sky-500 text-white font-bold shadow-xs', Icon: Search };
      case 'IN_REPAIR':
      case 'IN_PROGRESS':
      case 'REPAIRING':
      case 'กำลังซ่อม':
        return { style: 'bg-blue-600 text-white font-bold shadow-xs', Icon: Wrench };
      case 'CLAIM_NEW_MACHINE':
        return { style: 'bg-slate-700 text-white font-bold shadow-xs', Icon: RefreshCw };
      case 'SWAPPED_BACKUP_DEVICE':
        return { style: 'bg-purple-600 text-white font-bold shadow-xs', Icon: RefreshCw };
      case 'WAITING_DEYE_SEND':
        return { style: 'bg-indigo-500 text-white font-bold shadow-xs', Icon: Clock };
      case 'SENT_TO_DEYE':
        return { style: 'bg-violet-600 text-white font-bold shadow-xs', Icon: Send };
      case 'WAITING_DEYE_RETURN':
        return { style: 'bg-cyan-600 text-white font-bold shadow-xs', Icon: Clock };
      case 'COMPLETED_BY_DEYE':
      case 'COMPLETED':
      case 'SUCCESS':
        return { style: 'bg-emerald-600 text-white font-bold shadow-xs', Icon: CheckCircle2 };
      case 'RETURNED_CUSTOMER_PICKUP':
      case 'RETURNED_SHIPPED':
      case 'RETURN_BACKUP_AND_DELIVER':
      case 'SWAPPED_PERMANENT':
      case 'FINAL_SWAPPED_PERMANENT':
        return { style: 'bg-slate-600 text-white font-bold shadow-xs', Icon: Truck };
      case 'CANCELLED':
        return { style: 'bg-red-600 text-white font-bold shadow-xs', Icon: XCircle };
      default:
        return { style: 'bg-gray-600 text-white font-medium shadow-xs', Icon: FileText };
    }
  };

  const matchJobStatusCustom = (jobStatus: string, filter: string) => {
    if (filter === 'ALL') return true;
    const upperJobStatus = (jobStatus || '').toUpperCase();
    const upperFilter = (filter || '').toUpperCase();

    if (upperFilter === 'PENDING') {
      return upperJobStatus === 'PENDING' || upperJobStatus === 'WAITING_FOR_REPAIR';
    }
    if (upperFilter === 'IN_PROGRESS' || upperFilter === 'IN_REPAIR' || upperFilter === 'REPAIRING') {
      return ['IN_PROGRESS', 'IN_REPAIR', 'REPAIRING', 'กำลังซ่อม'].includes(upperJobStatus);
    }
    if (upperFilter === 'RETURNED' || upperFilter === 'RETURNED_CUSTOMER_PICKUP') {
      return ['RETURNED', 'RETURNED_CUSTOMER_PICKUP', 'RETURNED_SHIPPED', 'RETURN_BACKUP_AND_DELIVER', 'DELIVERED', 'CLOSED'].includes(upperJobStatus);
    }
    return upperJobStatus === upperFilter;
  };

  const filteredJobs = jobs.filter((job) => {
    if (isInternalOrBackupJob(job)) return false;

    const q = submittedQuery.toLowerCase();
    const customerName = (job.customerName || '').toLowerCase();
    const matchSearch =
      q === '' ||
      (job.jobNo || '').toLowerCase().includes(q) ||
      customerName.includes(q) ||
      (job.model || '').toLowerCase().includes(q) ||
      (job.serialNumber || '').toLowerCase().includes(q);

    const matchStatus = matchJobStatusCustom(job.status, statusFilter);
    const matchCategory = categoryFilter === 'ALL' || normalizeCategory(job.category) === normalizeCategory(categoryFilter);
    const matchBrand = brandFilter === 'ALL' || (job.brand?.name || '').toLowerCase() === brandFilter.toLowerCase();

    return matchSearch && matchStatus && matchCategory && matchBrand;
  }).sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); 
  });

  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentJobs = filteredJobs.slice(indexOfFirstItem, indexOfLastItem);

  const userRole = (session?.user as any)?.role;
  const isAdmin = userRole === 'ADMIN';
  const isManager = userRole === 'MANAGER';

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-gray-900">รายการแจ้งซ่อม</h1>
            <p className="text-xs sm:text-sm font-bold text-gray-500 mt-0.5">ติดตามและจัดการสถานะใบงานแจ้งซ่อมทั้งหมดของลูกค้า</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {isAdmin && (
            <button
              onClick={() => { setExportBrand('deye'); setIsExportModalOpen(true); }}
              className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-sm transition cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" /> 
              <span>Export Deye/TMDA</span>
            </button>
          )}

          {(isAdmin || isManager) && (
            <button
              onClick={() => { setExportBrand('invt'); setIsExportModalOpen(true); }}
              className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-sm transition cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" /> 
              <span>Export อื่นๆ</span>
            </button>
          )}

          <Link
            href="/dashboard/jobs/new"
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full text-xs sm:text-sm shadow-md transition no-underline whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" /> 
            <span>เปิดใบงานใหม่</span>
          </Link>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col lg:flex-row items-center gap-3 w-full">
        <div className="relative flex-1 w-full lg:w-auto">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, หรือ S/N..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setSubmittedQuery(searchQuery); }}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-blue-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:border-blue-500 transition w-full sm:w-36 shadow-sm cursor-pointer"
          >
            <option value="ALL">สถานะทั้งหมด</option>
            {JOB_STATUSES.map((st) => (
              <option key={st.value} value={st.value}>{st.label}</option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:border-blue-500 transition w-full sm:w-44 shadow-sm cursor-pointer"
          >
            <option value="ALL">หมวดหมู่ทั้งหมด</option>
            {STANDARD_CATEGORIES.map((cat, index) => (
              <option key={index} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:border-blue-500 transition w-full sm:w-36 shadow-sm cursor-pointer"
          >
            <option value="ALL">แบรนด์ทั้งหมด</option>
            {filteredBrandsList.map((brand) => (
              <option key={brand.id} value={brand.name}>{brand.name}</option>
            ))}
          </select>

          <button
            onClick={() => setSubmittedQuery(searchQuery)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gray-900 hover:bg-black text-white font-black text-sm rounded-xl transition shadow-sm cursor-pointer shrink-0"
          >
            <Search className="w-4 h-4 shrink-0" /> ค้นหา
          </button>

          <button
            onClick={() => { setSearchQuery(''); setSubmittedQuery(''); setStatusFilter('ALL'); setCategoryFilter('ALL'); setBrandFilter('ALL'); }}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-sm rounded-xl transition shadow-sm cursor-pointer shrink-0"
          >
            <X className="w-4 h-4 shrink-0 text-gray-500" /> ล้าง
          </button>
        </div>
      </div>

      <div className="w-full space-y-4">
        {loading ? (
          <div className="w-full space-y-3">
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3 animate-pulse">
                  <div className="flex justify-between">
                    <div className="w-24 h-4 bg-gray-200 rounded"></div>
                    <div className="w-20 h-5 bg-gray-200 rounded-full"></div>
                  </div>
                  <div className="w-36 h-5 bg-gray-200 rounded"></div>
                  <div className="bg-gray-50 p-2.5 rounded-xl space-y-2">
                    <div className="w-full h-4 bg-gray-200 rounded"></div>
                    <div className="w-3/4 h-4 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-10 bg-gray-200 rounded-xl w-full"></div>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div key={n} className="h-12 bg-gray-100 rounded-lg w-full"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : filteredJobs.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {currentJobs.map((job) => {
                const brandName = job.brand?.name ? `(${job.brand.name})` : '';
                const categoryText = job.category ? job.category : '-';
                
                const creatorName = job.user?.name || job.user?.username || job.user?.email || job.receiverName || job.createdBy || '-';
                const { style, Icon } = getStatusBadgeConfig(job.status);

                const hasBoxChecked = String(job.hasBox) === 'true';
                const hasWifiChecked = String(job.hasWifiDongle) === 'true';

                return (
                  <div key={job.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                          {categoryText} {brandName}
                        </span>
                        <h3 className="text-base font-black text-gray-900 mt-1">{job.customerName || '-'}</h3>
                        <p className="text-xs font-bold text-gray-500">โทร: {job.phone || '-'}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[11px] inline-flex items-center gap-1 shrink-0 ${style}`}>
                        <Icon className="w-3 h-3 shrink-0 text-white" />
                        {getCustomStatusLabel(job.status)}
                      </span>
                    </div>

                    <div className="bg-gray-50 p-2.5 rounded-xl text-xs space-y-1.5 border border-gray-100">
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-bold">รุ่น (Model):</span>
                        <span className="font-bold text-gray-900">{job.model || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-bold">Serial Number:</span>
                        <span className="font-bold text-gray-900">{job.serialNumber || '-'}</span>
                      </div>
                      
                      <div className="flex justify-between items-center pt-1.5 border-t border-gray-200">
                        <span className="text-gray-500 font-bold">อุปกรณ์เสริม:</span>
                        <div className="flex items-center gap-1.5">
                          <span title={hasBoxChecked ? "มีกล่อง" : "ไม่มีกล่อง"} className={`px-2 py-0.5 rounded text-[11px] font-bold border inline-flex items-center gap-1 ${hasBoxChecked ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-gray-100 text-gray-300 border-gray-200'}`}>
                            <Box className="w-3 h-3" /> กล่อง
                          </span>
                          <span title={hasWifiChecked ? "มี WiFi" : "ไม่มี WiFi"} className={`px-2 py-0.5 rounded text-[11px] font-bold border inline-flex items-center gap-1 ${hasWifiChecked ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-100 text-gray-300 border-gray-200'}`}>
                            <Wifi className="w-3 h-3" /> WiFi
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between pt-1.5 border-t border-gray-200">
                        <span className="text-gray-500 font-bold">ผู้เปิดใบงาน:</span>
                        <span className="font-bold text-blue-600 flex items-center gap-1">
                          <User className="w-3 h-3" /> {creatorName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-xs">
                      <div className="text-gray-500 font-bold">แจ้งเมื่อ: {job.createdAt ? new Date(job.createdAt).toLocaleDateString('th-TH') : '-'}</div>
                      <div className="flex items-center gap-1.5">
                        <Link href={`/dashboard/jobs/${job.id}`} className="p-2 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-xl transition shadow-sm">
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button onClick={() => handleDeleteJob(job.id, job.jobNo)} className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition shadow-sm cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden w-full">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1200px]">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold text-gray-700 uppercase tracking-wider">
                      <th className="py-4 px-6">ชื่อลูกค้า</th>
                      <th className="py-4 px-6">เบอร์ติดต่อ</th>
                      <th className="py-4 px-6">ชื่อโมเดล</th>
                      <th className="py-4 px-6">หมายเลข SN</th>
                      <th className="py-4 px-6">หมวด / ยี่ห้อ</th>
                      <th className="py-4 px-6 text-center">อุปกรณ์เสริม</th>
                      <th className="py-4 px-6">ผู้เปิดใบงาน</th>
                      <th className="py-4 px-6">สถานะ</th>
                      <th className="py-4 px-6">วันที่แจ้ง</th>
                      <th className="py-4 px-6 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {currentJobs.map((job) => {
                      const completed = isJobCompleted(job.status);
                      const pendingDays = calculatePendingDays(job.createdAt);
                      const isOverdue = !completed && pendingDays > 14;
                      const brandName = job.brand?.name ? `(${job.brand.name})` : '';
                      const categoryText = job.category ? job.category : '-';
                      
                      const creatorName = job.user?.name || job.user?.username || job.user?.email || job.receiverName || job.createdBy || '-';
                      const { style, Icon } = getStatusBadgeConfig(job.status);

                      const hasBoxChecked = String(job.hasBox) === 'true';
                      const hasWifiChecked = String(job.hasWifiDongle) === 'true';

                      return (
                        <tr key={job.id} className="hover:bg-gray-50/80 transition">
                          <td className="py-4 px-6 font-bold text-gray-900">{job.customerName || '-'}</td>
                          <td className="py-4 px-6 font-bold text-gray-900">{job.phone || '-'}</td>
                          <td className="py-4 px-6 font-bold text-gray-900 whitespace-nowrap">{job.model || '-'}</td>
                          <td className="py-4 px-6 font-bold text-gray-900">{job.serialNumber || '-'}</td>
                          <td className="py-4 px-6 font-bold text-gray-800">
                            {categoryText} <span className="text-gray-700 font-bold">{brandName}</span>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span title={hasBoxChecked ? "มีกล่อง" : "ไม่มีกล่อง"} className={`p-1.5 rounded-lg border ${hasBoxChecked ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-gray-100 text-gray-300 border-gray-200'}`}>
                                <Box className="w-4 h-4" />
                              </span>
                              <span title={hasWifiChecked ? "มี WiFi" : "ไม่มี WiFi"} className={`p-1.5 rounded-lg border ${hasWifiChecked ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-100 text-gray-300 border-gray-200'}`}>
                                <Wifi className="w-4 h-4" />
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-6 font-bold text-blue-600 text-xs">
                            <div className="inline-flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                              <User className="w-3.5 h-3.5 shrink-0" />
                              <span>{creatorName}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-3.5 py-1.5 rounded-full text-xs inline-flex items-center gap-1.5 ${style}`}>
                              <Icon className="w-3.5 h-3.5 shrink-0 text-white" />
                              {getCustomStatusLabel(job.status)}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-bold text-gray-900 text-xs">
                            <div>{job.createdAt ? new Date(job.createdAt).toLocaleDateString('th-TH') : '-'}</div>
                            <div className="mt-1">
                              {!completed ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${isOverdue ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                  {isOverdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                  ค้าง {pendingDays} วัน
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  เสร็จสิ้น ({pendingDays} วัน)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Link href={`/dashboard/jobs/${job.id}`} className="p-2 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-lg transition shadow-sm">
                                <Edit className="w-4 h-4" />
                              </Link>
                              <button onClick={() => handleDeleteJob(job.id, job.jobNo)} className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition shadow-sm cursor-pointer">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs font-bold text-gray-500">
                  แสดงหน้า <span className="text-blue-600">{currentPage}</span> จากทั้งหมด <span className="text-gray-900">{totalPages}</span> หน้า (รวม {filteredJobs.length} รายการ)
                </span>

                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1} className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 font-bold rounded-xl text-xs transition cursor-pointer">
                    <ChevronLeft className="w-4 h-4" /> ก่อนหน้า
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      if (totalPages <= 5 || page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                        return (
                          <button key={page} onClick={() => setCurrentPage(page)} className={`w-9 h-9 rounded-xl text-xs font-bold transition cursor-pointer ${currentPage === page ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'}`}>
                            {page}
                          </button>
                        );
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return <span key={page} className="text-gray-400 px-1">...</span>;
                      }
                      return null;
                    })}
                  </div>

                  <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 font-bold rounded-xl text-xs transition cursor-pointer">
                    ถัดไป <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center text-gray-400 font-medium">
            ไม่พบข้อมูลใบงานซ่อมในระบบ
          </div>
        )}
      </div>

      {isExportModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900">
                Export รายงาน ({exportBrand === 'deye' ? 'Deye/TMDA' : 'อื่นๆ'})
              </h3>
              <button onClick={() => setIsExportModalOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-gray-700 block">ช่วงเวลา</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setDatePreset('7days')} className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${datePreset === '7days' ? 'bg-blue-50 border-blue-500 text-blue-600' : 'border-gray-200 text-gray-700'}`}>ย้อนหลัง 7 วัน</button>
                <button type="button" onClick={() => setDatePreset('15days')} className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${datePreset === '15days' ? 'bg-blue-50 border-blue-500 text-blue-600' : 'border-gray-200 text-gray-700'}`}>ย้อนหลัง 15 วัน</button>
                <button type="button" onClick={() => setDatePreset('thisMonth')} className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${datePreset === 'thisMonth' ? 'bg-blue-50 border-blue-500 text-blue-600' : 'border-gray-200 text-gray-700'}`}>เดือนนี้</button>
                <button type="button" onClick={() => setDatePreset('lastMonth')} className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${datePreset === 'lastMonth' ? 'bg-blue-50 border-blue-500 text-blue-600' : 'border-gray-200 text-gray-700'}`}>เดือนที่แล้ว</button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
              <button type="button" onClick={() => setIsExportModalOpen(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs">ยกเลิก</button>
              <button type="button" onClick={handleConfirmExport} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm">ดาวน์โหลดรายงาน Excel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}