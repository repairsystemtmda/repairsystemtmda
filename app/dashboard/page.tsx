import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { 
  FileText, 
  Clock, 
  Layers, 
  Package, 
  Wrench, 
  AlertTriangle,
  UserCheck,
  Send,
  RotateCcw,
  FileQuestion,
  Truck,
  Zap,
  CheckCheck,
  UserCheck2,
  HardDrive,
  ArrowRightLeft
} from 'lucide-react';
import { 
  isBackupAvailable, 
  isBackupBorrowed, 
  isBackupInRepair, 
  isBackupSwappedPermanent 
} from '@/lib/backupUtils';
import PeriodFilter from './_components/PeriodFilter';

export const dynamic = 'force-dynamic';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const period = resolvedSearchParams?.period || 'all';

  const session = await getServerSession();
  const currentUserEmail = session?.user?.email;
  
  const currentUser = currentUserEmail 
    ? await prisma.user.findUnique({ where: { email: currentUserEmail } }) 
    : null;

  const role = (currentUser?.role || '').toUpperCase();
  const isAdmin = role === 'ADMIN';
  const isManager = role === 'MANAGER' || role === 'MANGER';
  const isTechnician = !isAdmin && !isManager;

  const rawJobs = await prisma.job.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const jobs = rawJobs.filter(job => {
    const status = (job.status || '').toLowerCase();
    
    if (status.includes('cancelled') || status.includes('ยกเลิก')) {
      return false;
    }

    const customerName = (job.customerName || '').toLowerCase();
    if (customerName.includes('ซ่อมบำรุงในคลัง') || customerName.includes('เครื่องสำรอง')) {
      return false;
    }

    return true;
  });

  const backupDevices = await prisma.backupDevice.findMany();
  const spareParts = await prisma.sparePart.findMany();
  const lowStockCount = spareParts.filter((part) => part.stock <= part.minQuantity).length;

  const stockLogs = await prisma.stockLog.findMany({
    include: {
      sparePart: true,
      user: true,
    },
  });

  const totalJobs = jobs.length;
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let pendingDiagnoseCount = 0;
  let waitingApprovalCount = 0;
  let inRepairCount = 0;
  let waitingDeyeSendCount = 0;
  let sentToDeyeCurrentCount = 0; 
  let completedByDeyeCount = 0;
  let returnedCustomerCount = 0;
  let completedAllCount = 0;
  let thisMonthCompletedCount = 0;
  let todayCompletedCount = 0;

  jobs.forEach(job => {
    const status = (job.status || '').trim();
    const upperStatus = status.toUpperCase();

    if (
      upperStatus === 'RETURN_BACKUP_AND_DELIVER' ||
      upperStatus === 'RETURNED_SHIPPED' ||
      upperStatus === 'RETURNED_CUSTOMER_PICKUP' ||
      upperStatus === 'RETURNED' ||
      upperStatus === 'DELIVERED' ||
      upperStatus === 'CLOSED' ||
      upperStatus === 'PICKUP' ||
      upperStatus === 'DONE' ||
      upperStatus === 'FINISHED' ||
      upperStatus === 'CLAIM_NEW_MACHINE' ||
      upperStatus === 'SWAPPED_PERMANENT' ||
      upperStatus === 'FINAL_SWAPPED_PERMANENT' ||
      status.includes('คืนเครื่องสำรอง') ||
      status.includes('ส่งมอบ') ||
      status.includes('คืน') ||
      status.includes('ปิดงาน') ||
      status.includes('เคลมเครื่องใหม่') ||
      status.includes('สลับเปลี่ยนเครื่องสำรองให้ถาวร') ||
      upperStatus.includes('RETURNED') || 
      upperStatus.includes('PICKUP') || 
      upperStatus.includes('DELIVERED') || 
      upperStatus.includes('CLOSED') || 
      upperStatus.includes('SUCCESS')
    ) {
      returnedCustomerCount += 1;
    } 
    else if (upperStatus === 'COMPLETED_BY_DEYE' || upperStatus.includes('COMPLETED_BY_DEYE') || upperStatus.includes('DEYE ซ่อมเสร็จ') || upperStatus.includes('ซ่อมเสร็จจาก DEYE') || upperStatus.includes('ส่งกลับมาถึงร้าน')) {
      completedByDeyeCount += 1;
    }
    else if (
      upperStatus === 'WAITING_DEYE_SEND' || 
      upperStatus.includes('WAITING_DEYE') || 
      upperStatus.includes('รอส่งเครื่องไป') || 
      upperStatus.includes('รอส่ง DEYE') || 
      upperStatus.includes('รอส่งเคลม')
    ) {
      waitingDeyeSendCount += 1;
    }
    else if (upperStatus === 'SENT_TO_DEYE' || upperStatus.includes('SENT_TO_DEYE') || upperStatus.includes('กำลังค้างอยู่') || upperStatus.includes('ส่งเคลม DEYE อยู่')) {
      sentToDeyeCurrentCount += 1;
    }
    else if (upperStatus === 'COMPLETED' || upperStatus === 'COMPLETE' || status.includes('ซ่อมเสร็จ')) {
      completedAllCount += 1;
    }
    else if (upperStatus.includes('WAITING_FOR_APPROVAL') || upperStatus.includes('APPROVAL') || upperStatus.includes('รออนุมัติ') || upperStatus.includes('ยืนยันราคา')) {
      waitingApprovalCount += 1;
    }
    else if (upperStatus === 'IN_REPAIR' || upperStatus === 'IN_PROGRESS' || upperStatus === 'REPAIRING' || upperStatus === 'กำลังซ่อม') {
      inRepairCount += 1;
    }
    else {
      pendingDiagnoseCount += 1;
    }
  });

  const completedJobsList = jobs.filter(job => {
    const status = (job.status || '').trim();
    const upperStatus = status.toUpperCase();
    const isReturned = (
      upperStatus === 'RETURN_BACKUP_AND_DELIVER' ||
      upperStatus === 'RETURNED_SHIPPED' ||
      upperStatus === 'RETURNED_CUSTOMER_PICKUP' ||
      upperStatus === 'RETURNED' ||
      upperStatus === 'DELIVERED' ||
      upperStatus === 'CLOSED' ||
      upperStatus === 'PICKUP' ||
      upperStatus === 'DONE' ||
      upperStatus === 'FINISHED' ||
      upperStatus === 'CLAIM_NEW_MACHINE' ||
      upperStatus === 'SWAPPED_PERMANENT' ||
      upperStatus === 'FINAL_SWAPPED_PERMANENT' ||
      status.includes('คืนเครื่องสำรอง') ||
      status.includes('ส่งมอบ') ||
      status.includes('คืน') ||
      status.includes('ปิดงาน') ||
      status.includes('เคลมเครื่องใหม่') ||
      status.includes('สลับเปลี่ยนเครื่องสำรองให้ถาวร') ||
      upperStatus.includes('RETURNED') || 
      upperStatus.includes('PICKUP') || 
      upperStatus.includes('DELIVERED') || 
      upperStatus.includes('CLOSED') || 
      upperStatus.includes('SUCCESS')
    );
    const isCompleted = upperStatus === 'COMPLETED' || upperStatus === 'COMPLETE' || status.includes('ซ่อมเสร็จ');
    return isCompleted || isReturned;
  });

  thisMonthCompletedCount = completedJobsList.filter(job => {
    const jobDate = new Date(job.closedAt || job.createdAt);
    return !isNaN(jobDate.getTime()) && jobDate.getMonth() === currentMonth && jobDate.getFullYear() === currentYear;
  }).length;

  todayCompletedCount = completedJobsList.filter(job => {
    const jobDate = new Date(job.closedAt || job.createdAt);
    return !isNaN(jobDate.getTime()) && jobDate.getDate() === currentDay && jobDate.getMonth() === currentMonth && jobDate.getFullYear() === currentYear;
  }).length;

  const monthlyStats: { [key: string]: number } = {};
  const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const mKey = `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
    monthlyStats[mKey] = 0;
  }

  jobs.forEach(job => {
    const jobDate = new Date(job.createdAt);
    if (!isNaN(jobDate.getTime())) {
      const mKey = `${monthNames[jobDate.getMonth()]} ${String(jobDate.getFullYear()).slice(-2)}`;
      if (monthlyStats[mKey] !== undefined) {
        monthlyStats[mKey] += 1;
      }
    }
  });
  const maxMonthlyCount = Math.max(...Object.values(monthlyStats), 1);

  let backupAvailable = 0;
  let backupBorrowed = 0;
  let backupInRepair = 0;
  let backupWaitingDeye = 0;
  let backupSentDeye = 0;
  let backupCompletedDeye = 0;
  let backupSwappedPermanent = 0;

  backupDevices.forEach(device => {
    const st = device.status;
    
    if (isBackupBorrowed(st)) {
      backupBorrowed += 1;
    } else if (isBackupInRepair(st)) {
      backupInRepair += 1;
    } else if (isBackupSwappedPermanent(st)) {
      backupSwappedPermanent += 1;
    } else {
      const upperSt = (st || '').trim().toUpperCase();
      if (upperSt === 'WAITING_DEYE_SEND' || upperSt.includes('WAITING_DEYE') || upperSt.includes('รอส่ง')) {
        backupWaitingDeye += 1;
      } else if (upperSt === 'SENT_TO_DEYE' || upperSt.includes('SENT_TO_DEYE') || upperSt.includes('ส่ง DEYE')) {
        backupSentDeye += 1;
      } else if (upperSt === 'COMPLETED_BY_DEYE' || upperSt.includes('DEYE ซ่อมเสร็จ') || upperSt.includes('ซ่อมเสร็จ')) {
        backupCompletedDeye += 1;
      } else if (isBackupAvailable(st)) {
        backupAvailable += 1;
      }
    }
  });

  const normalizeCategory = (cat?: string) => {
    if (!cat) return 'อินเวอร์เตอร์';
    const c = cat.toLowerCase().trim();
    if (c.includes('inverter') || c.includes('อินเวอร์เตอร์')) {
      if (c.includes('pump') || c.includes('ปั๊มน้ำ')) return 'อินเวอร์เตอร์ปั๊มน้ำ';
      if (c.includes('micro') || c.includes('ไมโคร')) return 'ไมโครอินเวอร์เตอร์';
      return 'อินเวอร์เตอร์';
    }
    if (c.includes('optimizer') || c.includes('ออปติไมเซอร์')) return 'ออปติไมเซอร์';
    if (c.includes('battery') || c.includes('แบตเตอรี่')) return 'แบตเตอรี่';
    return cat;
  };

  const modelStats: { [key: string]: { completed: number; pending: number; total: number } } = {};
  jobs.forEach(job => {
    const modelName = job.model || 'ไม่ระบุ Model';
    if (!modelStats[modelName]) {
      modelStats[modelName] = { completed: 0, pending: 0, total: 0 };
    }
    modelStats[modelName].total += 1;
    const status = (job.status || '').trim();
    const upperStatus = status.toUpperCase();
    const isCompleted = (
      upperStatus === 'RETURN_BACKUP_AND_DELIVER' ||
      upperStatus === 'RETURNED_SHIPPED' ||
      upperStatus === 'RETURNED_CUSTOMER_PICKUP' ||
      upperStatus === 'RETURNED' ||
      upperStatus === 'DELIVERED' ||
      upperStatus === 'CLOSED' ||
      upperStatus === 'PICKUP' ||
      upperStatus === 'DONE' ||
      upperStatus === 'FINISHED' ||
      upperStatus === 'CLAIM_NEW_MACHINE' ||
      upperStatus === 'SWAPPED_PERMANENT' ||
      upperStatus === 'FINAL_SWAPPED_PERMANENT' ||
      status.includes('คืนเครื่องสำรอง') ||
      status.includes('ส่งมอบ') ||
      status.includes('คืน') ||
      status.includes('ปิดงาน') ||
      status.includes('เคลมเครื่องใหม่') ||
      status.includes('สลับเปลี่ยนเครื่องสำรองให้ถาวร') ||
      upperStatus.includes('COMPLETE') || 
      upperStatus.includes('SUCCESS') || 
      upperStatus.includes('RETURNED') || 
      job.closedAt != null
    );
    if (isCompleted) {
      modelStats[modelName].completed += 1;
    } else {
      modelStats[modelName].pending += 1;
    }
  });

  const categoryStats: { [key: string]: number } = {};
  jobs.forEach(job => {
    const rawCat = (job as any).category || 'INVERTER';
    const cat = normalizeCategory(rawCat);
    categoryStats[cat] = (categoryStats[cat] || 0) + 1;
  });

  const backupModelStats: { [key: string]: { available: number; borrowed: number; swapped: number; other: number; total: number } } = {};
  backupDevices.forEach(device => {
    const modelName = device.model || 'ไม่ระบุ Model';
    if (!backupModelStats[modelName]) {
      backupModelStats[modelName] = { available: 0, borrowed: 0, swapped: 0, other: 0, total: 0 };
    }
    backupModelStats[modelName].total += 1;
    const st = device.status;

    if (isBackupBorrowed(st)) {
      backupModelStats[modelName].borrowed += 1;
    } else if (isBackupAvailable(st)) {
      backupModelStats[modelName].available += 1;
    } else if (isBackupSwappedPermanent(st)) {
      backupModelStats[modelName].swapped += 1;
    } else {
      backupModelStats[modelName].other += 1;
    }
  });

  const backupCategoryStats: { [key: string]: number } = {};
  backupDevices.forEach(device => {
    const rawCat = device.category || 'INVERTER';
    const cat = normalizeCategory(rawCat);
    backupCategoryStats[cat] = (backupCategoryStats[cat] || 0) + 1;
  });

  // ตัวกรองช่วงเวลาสำหรับ KPI และประวัติการเบิก
  let cutoffDate = new Date(0);
  if (period === '1m') {
    cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 1);
  } else if (period === '3m') {
    cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 3);
  } else if (period === '6m') {
    cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 6);
  } else if (period === '1y') {
    cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
  }

  const sparePartUsage: { [key: string]: { name: string; boardModelCode: string; category: string; compatibleModel: string; count: number } } = {};
  const technicianStats: { [key: string]: { partsCompleted: number; completedJobs: number; importantActions: number } } = {};

  const getOrCreateTech = (name: string) => {
    if (!technicianStats[name]) {
      technicianStats[name] = { partsCompleted: 0, completedJobs: 0, importantActions: 0 };
    }
    return technicianStats[name];
  };

  stockLogs.forEach((log: any) => {
    const logDate = new Date(log.createdAt);
    if (period !== 'all' && logDate < cutoffDate) return;

    const techName = log.user?.name || log.technicianName || log.userName;
    const logType = (log.type || '').toUpperCase();
    
    const isWithdraw = logType.includes('WITHDRAW') || logType.includes('OUT') || logType.includes('USE') || logType.includes('DEDUCT') || log.change < 0;
    const isRestock = logType.includes('RESTOCK') || logType.includes('IN') || logType.includes('REGISTER');

    if (isWithdraw && !isRestock) {
      if (techName && techName !== 'ช่างทั่วไป') {
        const stats = getOrCreateTech(techName);
        stats.partsCompleted += Math.abs(log.quantity || 1);
      }

      if (log.sparePart) {
        const id = log.sparePartId;
        const name = log.sparePart.name;
        const boardModelCode = log.sparePart.boardModelCode || '-';
        const category = log.sparePart.category || '-';
        const compatibleModel = log.sparePart.compatibleModel || log.sparePart.model || '-';

        if (!sparePartUsage[id]) {
          sparePartUsage[id] = { name, boardModelCode, category, compatibleModel, count: 0 };
        }
        sparePartUsage[id].count += Math.abs(log.quantity || 1);
      }
    }
  });

  jobs.forEach((job: any) => {
    const jobDate = new Date(job.createdAt);
    if (period !== 'all' && jobDate < cutoffDate) return;

    const techName = job.user?.name || job.technicianName || job.receiverName || job.userName;
    if (!techName || techName === 'ช่างทั่วไป') return;

    const stats = getOrCreateTech(techName);
    const status = (job.status || '').trim();
    const upperStatus = status.toUpperCase();

    const isImportantAction = (
      upperStatus === 'PENDING' ||
      upperStatus === 'IN_REPAIR' ||
      upperStatus === 'REPAIRING' ||
      upperStatus === 'WAITING_DEYE_SEND' ||
      upperStatus === 'SENT_TO_DEYE' ||
      upperStatus === 'COMPLETED_BY_DEYE' ||
      upperStatus === 'RETURN_BACKUP_AND_DELIVER' ||
      upperStatus === 'RETURNED_SHIPPED' ||
      upperStatus === 'RETURNED_CUSTOMER_PICKUP' ||
      upperStatus === 'RETURNED' ||
      upperStatus === 'DELIVERED' ||
      upperStatus === 'CLOSED' ||
      upperStatus === 'CLAIM_NEW_MACHINE' ||
      upperStatus === 'SWAPPED_PERMANENT' ||
      upperStatus === 'FINAL_SWAPPED_PERMANENT' ||
      status.includes('เปิดใบงาน') ||
      status.includes('VVVIP') ||
      status.includes('ยืมเครื่องสำรอง') ||
      status.includes('เครื่องสำรอง') ||
      status.includes('พร้อมใช้งาน') ||
      status.includes('รอซ่อม') ||
      status.includes('ส่ง Deye') ||
      status.includes('ส่ง DEYE') ||
      status.includes('Deye ซ่อมเสร็จ') ||
      status.includes('ซ่อมเสร็จจาก DEYE') ||
      status.includes('เครมเครื่องใหม่') ||
      status.includes('เคลมเครื่องใหม่') ||
      status.includes('ส่งมอบ') ||
      status.includes('จัดส่ง') ||
      status.includes('รับเอง') ||
      status.includes('คืน') ||
      status.includes('สลับ')
    );
    if (isImportantAction) {
      stats.importantActions += 1;
    }

    const isCompletedJob = (
      upperStatus === 'COMPLETED' ||
      upperStatus === 'COMPLETE' ||
      upperStatus === 'RETURNED' ||
      upperStatus === 'DELIVERED' ||
      upperStatus === 'CLOSED' ||
      upperStatus === 'SUCCESS' ||
      job.closedAt != null ||
      status.includes('ซ่อมเสร็จ') ||
      status.includes('ปิดงาน') ||
      status.includes('ส่งมอบ')
    );
    if (isCompletedJob) {
      stats.completedJobs += 1;
    }
  });

  const topSpareParts = Object.values(sparePartUsage)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const maxTechTotal = Object.keys(technicianStats).length > 0 
    ? Math.max(...Object.values(technicianStats).flatMap(t => [t.partsCompleted, t.completedJobs, t.importantActions]), 1) 
    : 1;

  return (
    <div className="min-h-screen bg-gray-50/50 pt-4 pb-12 px-3 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">แดชบอร์ดภาพรวมระบบ</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">สรุปสถานะงานซ่อมลูกค้าและการเคลมเครื่องสำรอง</p>
          </div>
          
          {isAdmin && lowStockCount > 0 && (
            <Link href="/dashboard/inventory/boards?filter=low" className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold hover:bg-rose-100 transition no-underline">
              <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse shrink-0" />
              <span>แจ้งเตือน: มีอะไหล่ใกล้หมดสต็อก {lowStockCount} รายการ</span>
            </Link>
          )}
        </div>

        {/* 1. สถานะงานซ่อมของลูกค้า */}
        <div>
          <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" /> สถานะงานซ่อมของลูกค้า (รวมทั้งหมด {totalJobs} เครื่อง)
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            
            <Link href="/dashboard/jobs" className="block no-underline group">
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group-hover:border-blue-300 transition cursor-pointer h-full">
                <div className="space-y-1">
                  <p className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">งานซ่อมทั้งหมด</p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{totalJobs}</h3>
                  <p className="text-[10px] sm:text-xs text-gray-400">รายการในระบบ</p>
                </div>
                <div className="text-blue-500/70 group-hover:scale-110 transition-transform shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
              </div>
            </Link>

            <Link href="/dashboard/jobs?status=PENDING" className="block no-underline group">
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-amber-100 shadow-sm flex items-center justify-between group-hover:border-amber-300 transition cursor-pointer h-full">
                <div className="space-y-1">
                  <p className="text-[10px] sm:text-xs font-semibold text-amber-600 uppercase tracking-wider">รอดำเนินการ</p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-amber-600">{pendingDiagnoseCount}</h3>
                  <p className="text-[10px] sm:text-xs text-gray-400">รอตรวจเช็คอาการ</p>
                </div>
                <div className="text-amber-500/70 group-hover:scale-110 transition-transform shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
            </Link>

            <Link href="/dashboard/jobs?status=WAITING_FOR_APPROVAL" className="block no-underline group">
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-purple-100 shadow-sm flex items-center justify-between group-hover:border-purple-300 transition cursor-pointer h-full">
                <div className="space-y-1">
                  <p className="text-[10px] sm:text-xs font-semibold text-purple-600 uppercase tracking-wider">รอลูกค้าอนุมัติ</p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-purple-700">{waitingApprovalCount}</h3>
                  <p className="text-[10px] sm:text-xs text-gray-400">รอการยืนยันราคา</p>
                </div>
                <div className="text-purple-500/70 group-hover:scale-110 transition-transform shrink-0">
                  <FileQuestion className="w-5 h-5" />
                </div>
              </div>
            </Link>

            <Link href="/dashboard/jobs?status=IN_REPAIR" className="block no-underline group">
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-sky-100 shadow-sm flex items-center justify-between group-hover:border-sky-300 transition cursor-pointer h-full">
                <div className="space-y-1">
                  <p className="text-[10px] sm:text-xs font-semibold text-sky-600 uppercase tracking-wider">กำลังซ่อม</p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-sky-600">{inRepairCount}</h3>
                  <p className="text-[10px] sm:text-xs text-gray-400">อยู่ระหว่างปฏิบัติงาน</p>
                </div>
                <div className="text-sky-500/70 group-hover:scale-110 transition-transform shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
              </div>
            </Link>

            <Link href="/dashboard/jobs?status=COMPLETED" className="block no-underline group col-span-2 lg:col-span-1">
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-between group-hover:border-emerald-300 transition cursor-pointer space-y-2.5 h-full">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs font-semibold text-emerald-600 uppercase tracking-wider">ซ่อมเสร็จทั้งหมด</p>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mt-0.5">{completedAllCount}</h3>
                  </div>
                  <div className="text-emerald-500/70 group-hover:scale-110 transition-transform shrink-0">
                    <CheckCheck className="w-5 h-5" />
                  </div>
                </div>
                <div className="pt-2 border-t border-emerald-50 flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-gray-500">
                  <span>เสร็จวันนี้: <strong className="text-emerald-700">{todayCompletedCount}</strong></span>
                  <span>เสร็จเดือนนี้: <strong className="text-emerald-700">{thisMonthCompletedCount}</strong></span>
                </div>
              </div>
            </Link>

            <Link href="/dashboard/jobs?status=RETURNED" className="block no-underline group">
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-green-100 shadow-sm flex items-center justify-between group-hover:border-green-300 transition cursor-pointer h-full">
                <div className="space-y-1">
                  <p className="text-[10px] sm:text-xs font-semibold text-green-600 uppercase tracking-wider">ส่งมอบคืนแล้ว</p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-green-700">{returnedCustomerCount}</h3>
                  <p className="text-[10px] sm:text-xs text-gray-400">ปิดงานสมบูรณ์</p>
                </div>
                <div className="text-green-500/70 group-hover:scale-110 transition-transform shrink-0">
                  <UserCheck2 className="w-5 h-5" />
                </div>
              </div>
            </Link>

            <Link href="/dashboard/jobs?status=WAITING_DEYE_SEND" className="block no-underline group">
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-orange-100 shadow-sm flex items-center justify-between group-hover:border-orange-300 transition cursor-pointer h-full">
                <div className="space-y-1">
                  <p className="text-[10px] sm:text-xs font-semibold text-orange-600 uppercase tracking-wider">รอส่งไป Deye</p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-orange-700">{waitingDeyeSendCount}</h3>
                  <p className="text-[10px] sm:text-xs text-gray-400">เตรียมส่งเคลมต่างประเทศ</p>
                </div>
                <div className="text-orange-500/70 group-hover:scale-110 transition-transform shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
              </div>
            </Link>

            <Link href="/dashboard/jobs?status=SENT_TO_DEYE" className="block no-underline group">
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-cyan-100 shadow-sm flex items-center justify-between group-hover:border-cyan-300 transition cursor-pointer h-full">
                <div className="space-y-1">
                  <p className="text-[10px] sm:text-xs font-semibold text-cyan-600 uppercase tracking-wider">ค้างอยู่ที่ Deye</p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-cyan-700">{sentToDeyeCurrentCount}</h3>
                  <p className="text-[10px] sm:text-xs text-gray-400">ดำเนินการต่างประเทศ</p>
                </div>
                <div className="text-cyan-500/70 group-hover:scale-110 transition-transform shrink-0">
                  <Send className="w-5 h-5" />
                </div>
              </div>
            </Link>

            <Link href="/dashboard/jobs?status=COMPLETED_BY_DEYE" className="block no-underline group">
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-teal-100 shadow-sm flex items-center justify-between group-hover:border-teal-300 transition cursor-pointer h-full">
                <div className="space-y-1">
                  <p className="text-[10px] sm:text-xs font-semibold text-teal-600 uppercase tracking-wider">Deye ซ่อมเสร็จ</p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-teal-700">{completedByDeyeCount}</h3>
                  <p className="text-[10px] sm:text-xs text-gray-400">ของถึงร้าน รอส่งมอบ</p>
                </div>
                <div className="text-teal-500/70 group-hover:scale-110 transition-transform shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
              </div>
            </Link>

          </div>
        </div>

        {isAdmin && (
          <div className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
              <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" /> สถิติงานซ่อมเครื่องลูกค้า (Model & Category Performance)
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 space-y-4">
                <h3 className="text-xs sm:text-sm font-bold text-gray-800">แยกตาม Model (งานซ่อมลูกค้า)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[320px]">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/70 text-[10px] sm:text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Model</th>
                        <th className="py-2.5 px-3 text-center">ซ่อมเสร็จ</th>
                        <th className="py-2.5 px-3 text-center">รอซ่อม</th>
                        <th className="py-2.5 px-3 text-center">รวมทั้งหมด</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
                      {Object.keys(modelStats).length > 0 ? (
                        Object.entries(modelStats).map(([modelName, stats]) => (
                          <tr key={modelName} className="hover:bg-gray-50/50 transition">
                            <td className="py-2.5 px-3 font-bold text-gray-800">{modelName}</td>
                            <td className="py-2.5 px-3 text-center font-semibold text-emerald-600">{stats.completed}</td>
                            <td className="py-2.5 px-3 text-center font-semibold text-amber-600">{stats.pending}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-gray-900">{stats.total}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={4} className="py-6 text-center text-gray-400">ไม่มีข้อมูล Model เครื่องลูกค้า</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 space-y-4">
                <h3 className="text-xs sm:text-sm font-bold text-gray-800">แยกตามหมวดหมู่ (งานซ่อมลูกค้า)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/70 text-[10px] sm:text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        <th className="py-2.5 px-3">หมวดหมู่สินค้า</th>
                        <th className="py-2.5 px-3 text-right">จำนวน (เครื่อง)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
                      {Object.keys(categoryStats).length > 0 ? (
                        Object.entries(categoryStats).map(([catName, count]) => (
                          <tr key={catName} className="hover:bg-gray-50/50 transition">
                            <td className="py-2.5 px-3 font-bold text-gray-800">{catName}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-gray-900">{count}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={2} className="py-6 text-center text-gray-400">ไม่มีข้อมูลหมวดหมู่เครื่องลูกค้า</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {(isAdmin || isManager) && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 space-y-4">
            <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" /> สถิติรายเดือน
            </h2>
            
            <div className="pt-4">
              <div className="flex items-end justify-around gap-2 sm:gap-4 h-64 border-b border-gray-200 pb-2 px-2">
                {Object.entries(monthlyStats).map(([monthKey, count]) => {
                  const heightPercent = Math.round((count / maxMonthlyCount) * 100);
                  
                  return (
                    <div key={monthKey} className="flex flex-col items-center flex-1 h-full justify-end group relative">
                      <div className="absolute -top-14 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-gray-900 text-white text-[11px] rounded-lg py-1.5 px-3 shadow-xl whitespace-nowrap z-20 pointer-events-none flex flex-col items-center">
                        <span className="font-bold">{monthKey}</span>
                        <span className="text-blue-300 font-semibold">จำนวนแจ้งซ่อม: {count}</span>
                      </div>

                      <span className="text-[10px] sm:text-xs font-bold text-gray-600 mb-1">
                        {count > 0 ? count : ''}
                      </span>

                      <div className="w-full max-w-[45px] sm:max-w-[60px] bg-blue-500 rounded-t-lg transition-all duration-500 hover:bg-blue-600 flex items-end justify-center shadow-sm"
                           style={{ height: `${Math.max(heightPercent, 4)}%` }}>
                      </div>

                      <span className="text-[10px] sm:text-xs font-semibold text-gray-700 mt-2 text-center whitespace-nowrap">
                        {monthKey}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 3. สถานะเครื่องสำรอง */}
        <div>
          <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <HardDrive className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 shrink-0" /> สถานะเครื่องสำรอง (Backup Devices รวม {backupDevices.length} เครื่อง)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            
            <Link href="/dashboard/inventory/backups?status=AVAILABLE" className="block no-underline group">
              <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 shadow-sm space-y-1 group-hover:border-emerald-300 transition cursor-pointer h-full">
                <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">พร้อมใช้งาน</p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-emerald-700">{backupAvailable}</h3>
                <p className="text-[9px] sm:text-[10px] text-gray-400">สต็อกพร้อมยืม</p>
              </div>
            </Link>

            <Link href="/dashboard/inventory/backups?status=IN_USE" className="block no-underline group">
              <div className="bg-white p-3.5 rounded-2xl border border-blue-100 shadow-sm space-y-1 group-hover:border-blue-300 transition cursor-pointer h-full">
                <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">ถูกยืมใช้งาน</p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-blue-700">{backupBorrowed}</h3>
                <p className="text-[9px] sm:text-[10px] text-gray-400">ลูกค้าใช้งานอยู่</p>
              </div>
            </Link>

            <Link href="/dashboard/inventory/backups?status=MAINTENANCE" className="block no-underline group">
              <div className="bg-white p-3.5 rounded-2xl border border-amber-100 shadow-sm space-y-1 group-hover:border-amber-300 transition cursor-pointer h-full">
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">กำลังซ่อม</p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-amber-700">{backupInRepair}</h3>
                <p className="text-[9px] sm:text-[10px] text-gray-400">เครื่องสำรองชำรุด</p>
              </div>
            </Link>

            <Link href="/dashboard/inventory/backups?status=WAITING_DEYE" className="block no-underline group">
              <div className="bg-white p-3.5 rounded-2xl border border-orange-100 shadow-sm space-y-1 group-hover:border-orange-300 transition cursor-pointer h-full">
                <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider">รอส่ง Deye</p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-orange-700">{backupWaitingDeye}</h3>
                <p className="text-[9px] sm:text-[10px] text-gray-400">รอส่งเคลมตปท.</p>
              </div>
            </Link>

            <Link href="/dashboard/inventory/backups?status=SENT_TO_DEYE" className="block no-underline group">
              <div className="bg-white p-3.5 rounded-2xl border border-cyan-100 shadow-sm space-y-1 group-hover:border-cyan-300 transition cursor-pointer h-full">
                <p className="text-[10px] font-semibold text-cyan-600 uppercase tracking-wider">ส่ง Deye แล้ว</p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-cyan-700">{backupSentDeye}</h3>
                <p className="text-[9px] sm:text-[10px] text-gray-400">อยู่ที่ Deye</p>
              </div>
            </Link>

            <Link href="/dashboard/inventory/backups?status=COMPLETED_BY_DEYE" className="block no-underline group">
              <div className="bg-white p-3.5 rounded-2xl border border-teal-100 shadow-sm space-y-1 group-hover:border-teal-300 transition cursor-pointer h-full">
                <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-wider">Deye ซ่อมเสร็จ</p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-teal-700">{backupCompletedDeye}</h3>
                <p className="text-[9px] sm:text-[10px] text-gray-400">ของถึงร้านแล้ว</p>
              </div>
            </Link>

            <Link href="/dashboard/inventory/backups?status=SWAPPED_PERMANENT" className="block no-underline group col-span-2 sm:col-span-1">
              <div className="bg-white p-3.5 rounded-2xl border border-indigo-100 shadow-sm space-y-1 group-hover:border-indigo-300 transition cursor-pointer h-full">
                <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">สลับเปลี่ยนเครื่องถาวร</p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-indigo-700">{backupSwappedPermanent}</h3>
                <p className="text-[9px] sm:text-[10px] text-gray-400">เปลี่ยนให้ลูกค้าถาวร</p>
              </div>
            </Link>

          </div>
        </div>

        {isAdmin && (
          <>
            <div className="space-y-3">
              <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                <HardDrive className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 shrink-0" /> สถิติเครื่องสำรอง (Backup Devices Performance)
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 space-y-4">
                  <h3 className="text-xs sm:text-sm font-bold text-gray-800">แยกตาม Model (เครื่องสำรอง)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[320px]">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/70 text-[10px] sm:text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                          <th className="py-2.5 px-3">Model เครื่องสำรอง</th>
                          <th className="py-2.5 px-3 text-center">พร้อมใช้งาน</th>
                          <th className="py-2.5 px-3 text-center">ถูกยืมใช้งาน</th>
                          <th className="py-2.5 px-3 text-center">สลับเปลี่ยนถาวร</th>
                          <th className="py-2.5 px-3 text-center">สถานะอื่นๆ</th>
                          <th className="py-2.5 px-3 text-center">รวมทั้งหมด</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
                        {Object.keys(backupModelStats).length > 0 ? (
                          Object.entries(backupModelStats).map(([modelName, stats]) => (
                            <tr key={modelName} className="hover:bg-gray-50/50 transition">
                              <td className="py-2.5 px-3 font-bold text-gray-800">{modelName}</td>
                              <td className="py-2.5 px-3 text-center font-semibold text-emerald-600">{stats.available}</td>
                              <td className="py-2.5 px-3 text-center font-semibold text-blue-600">{stats.borrowed}</td>
                              <td className="py-2.5 px-3 text-center font-semibold text-indigo-600">{stats.swapped}</td>
                              <td className="py-2.5 px-3 text-center font-semibold text-amber-600">{stats.other}</td>
                              <td className="py-2.5 px-3 text-center font-bold text-gray-900">{stats.total}</td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={6} className="py-6 text-center text-gray-400">ไม่มีข้อมูล Model เครื่องสำรอง</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 space-y-4">
                  <h3 className="text-xs sm:text-sm font-bold text-gray-800">แยกตามหมวดหมู่ (เครื่องสำรอง)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/70 text-[10px] sm:text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                          <th className="py-2.5 px-3">หมวดหมู่เครื่องสำรอง</th>
                          <th className="py-2.5 px-3 text-right">จำนวน (เครื่อง)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
                        {Object.keys(backupCategoryStats).length > 0 ? (
                          Object.entries(backupCategoryStats).map(([catName, count]) => (
                            <tr key={catName} className="hover:bg-gray-50/50 transition">
                              <td className="py-2.5 px-3 font-bold text-gray-800">{catName}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-gray-900">{count}</td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={2} className="py-6 text-center text-gray-400">ไม่มีข้อมูลหมวดหมู่เครื่องสำรอง</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. 5 อันดับบอร์ดหรืออะไหล่ที่ถูกเบิกใช้บ่อยที่สุด */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 space-y-4">
              <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                <Wrench className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 shrink-0" /> 5 อันดับบอร์ดหรืออะไหล่ที่ถูกเบิกใช้บ่อยที่สุด
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/70 text-[10px] sm:text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3">อันดับ</th>
                      <th className="py-2.5 px-3">รหัสรุ่นบอร์ด</th>
                      <th className="py-2.5 px-3">ชื่อบอร์ด / อะไหล่</th>
                      <th className="py-2.5 px-3">ประเภทบอร์ด</th>
                      <th className="py-2.5 px-3">รุ่นเครื่องที่รองรับ</th>
                      <th className="py-2.5 px-3 text-right">จำนวนที่ถูกเบิก</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
                    {topSpareParts.length > 0 ? (
                      topSpareParts.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50/50 transition">
                          <td className="py-2.5 px-3 font-bold text-gray-500">#{index + 1}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">{item.boardModelCode}</td>
                          <td className="py-2.5 px-3 font-semibold text-gray-800">{item.name}</td>
                          <td className="py-2.5 px-3 text-gray-600">{item.category}</td>
                          <td className="py-2.5 px-3 text-gray-600">{item.compatibleModel}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-gray-900">{item.count} ชิ้น</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-400">ยังไม่มีประวัติการเบิกใช้อะไหล่ในระบบ</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 6. สถิติ KPI ช่างซ่อม (พร้อมปุ่มเลือกช่วงเวลาแบบมีไอคอนโหลด) */}
            <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-4 sm:p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                    <UserCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-gray-900">สถิติ KPI ช่างซ่อม</h2>
                    <p className="text-[11px] sm:text-xs text-gray-500">
                      เปรียบเทียบ 3 มิติ: <span className="text-emerald-600 font-bold">1. อะไหล่ใช้งาน</span> | <span className="text-blue-600 font-bold">2. เครื่องซ่อมเสร็จ</span> | <span className="text-purple-600 font-bold">3. สถานะสำคัญ</span>
                    </p>
                  </div>
                </div>

                {/* คอมโพเนนต์ปุ่มเลือกช่วงเวลาแบบมี Loading Spinner */}
                <PeriodFilter />
              </div>

              <div className="pt-2">
                {Object.keys(technicianStats).length > 0 ? (
                  <div className="flex items-end justify-around gap-2 sm:gap-4 h-60 sm:h-72 border-b border-gray-200 pb-2 px-2 sm:px-4">
                    {Object.keys(technicianStats).map((techName) => {
                      const stats = technicianStats[techName];
                      const p1 = Math.round((stats.partsCompleted / maxTechTotal) * 100);
                      const p2 = Math.round((stats.completedJobs / maxTechTotal) * 100);
                      const p3 = Math.round((stats.importantActions / maxTechTotal) * 100);

                      return (
                        <div key={techName} className="flex flex-col items-center flex-1 h-full justify-end group">
                          <div className="text-[9px] font-bold text-gray-600 mb-1 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                            {stats.partsCompleted} | {stats.completedJobs} | {stats.importantActions}
                          </div>

                          <div className="w-full max-w-[60px] sm:max-w-[75px] flex items-end justify-center gap-0.5 sm:gap-1 h-full bg-gray-50 rounded-t-lg p-1 border-x border-t border-gray-100">
                            <div className="w-1/3 bg-emerald-500 rounded-t transition-all duration-500 hover:bg-emerald-600" style={{ height: `${p1}%` }} title={`อะไหล่ใช้งาน: ${stats.partsCompleted}`}></div>
                            <div className="w-1/3 bg-blue-600 rounded-t transition-all duration-500 hover:bg-blue-700" style={{ height: `${p2}%` }} title={`เครื่องซ่อมเสร็จ: ${stats.completedJobs}`}></div>
                            <div className="w-1/3 bg-purple-600 rounded-t transition-all duration-500 hover:bg-purple-700" style={{ height: `${p3}%` }} title={`สถานะสำคัญ: ${stats.importantActions}`}></div>
                          </div>

                          <span className="text-[11px] sm:text-xs font-semibold text-gray-700 mt-2 truncate max-w-full text-center" title={techName}>
                            {techName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400 text-sm">ไม่มีข้อมูลสถิติช่างในช่วงเวลาที่เลือก</div>
                )}
              </div>
              
              <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-[11px] font-semibold text-gray-600">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-emerald-500 rounded-sm"></div><span>1. อะไหล่ใช้งานจริง</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-600 rounded-sm"></div><span>2. เครื่องซ่อมเสร็จ</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-purple-600 rounded-sm"></div><span>3. สถานะสำคัญ</span></div>
              </div>

            </div>
          </>
        )}

      </div>
    </div>
  );
}