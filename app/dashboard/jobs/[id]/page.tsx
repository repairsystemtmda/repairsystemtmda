import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { Wrench, ArrowLeft, CheckCircle2, Layers, Printer, FileSpreadsheet, ArrowRight, Send, GitCommit, PlayCircle, ShieldAlert, ShieldCheck, AlertCircle, PackageCheck, Laptop, User } from 'lucide-react';
import JobEditForm from './_components/JobEditForm';
import { JobSubmitButton, JobLinkButton } from './_components/JobActionButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'รอดำเนินการ',
  DIAGNOSE: 'กำลังประเมินอาการ',
  WAITING_FOR_APPROVAL: 'รอลูกค้าอนุมัติราคา',
  IN_PROGRESS: 'กำลังดำเนินการ',
  IN_REPAIR: 'กำลังซ่อมบำรุง',
  SWAPPED_BACKUP_DEVICE: 'ยืมเครื่องสำรองใช้งานระหว่างซ่อม',
  WAITING_DEYE_SEND: 'รอส่งศูนย์ Deye',
  SENT_TO_DEYE: 'ส่งเครื่องไป Deye แล้ว',
  COMPLETED_BY_DEYE: 'Deye ซ่อมเสร็จส่งกลับมาแล้ว',
  COMPLETED: 'ซ่อมเสร็จสิ้น (รอส่งมอบ)',
  RETURNED_CUSTOMER_PICKUP: 'ส่งมอบเครื่องคืนลูกค้า (ลูกค้ารับเอง)',
  RETURNED_SHIPPED: 'ส่งมอบเครื่องคืนลูกค้า (จัดส่งขนส่ง)',
  RETURN_BACKUP_AND_DELIVER: 'คืนเครื่องสำรอง + ส่งมอบเครื่องลูกค้า',
  SWAPPED_PERMANENT: 'สลับเปลี่ยนเครื่องสำรองให้ถาวร',
  CLAIM_NEW_MACHINE: 'เคลมเครื่องใหม่',
  CANCELLED: 'ยกเลิกใบงาน',
};

const COMPLETED_STATUSES = [
  'SWAPPED_PERMANENT',
  'RETURNED_CUSTOMER_PICKUP',
  'RETURNED_SHIPPED',
  'RETURN_BACKUP_AND_DELIVER',
  'COMPLETED',
  'COMPLETED_BY_DEYE'
];

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; showSwapModal?: string }>;
}

export default async function JobDetailPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const id = resolvedParams.id;
  const isSuccess = resolvedSearchParams?.success === 'true';
  const showSwapModal = resolvedSearchParams?.showSwapModal === 'true';

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      brand: true,
      backupDevice: true,
      user: true, 
      images: true,
      stockLogs: {
        include: {
          sparePart: true,
          images: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!job) {
    notFound();
  }

  const backupDevices = await prisma.backupDevice.findMany({
    where: {
      OR: [
        { status: 'AVAILABLE' },
        { id: job.backupDeviceId || '' }
      ]
    }
  });

  const brands = await prisma.brand.findMany({
    orderBy: { name: 'asc' },
  });

  const hasSpareParts = job.stockLogs && job.stockLogs.length > 0;
  const isReadyForDelivery = job.status === 'COMPLETED' || job.status === 'COMPLETED_BY_DEYE';
  const isFinalClosed = COMPLETED_STATUSES.includes(job.status);

  const brandName = job.brand?.name || '';
  const isDeyeOrTmda = brandName === 'Deye' || brandName === 'TMDA';

  async function quickUpdateStatus(newStatus: string) {
    'use server';
    try {
      const currentJob = await prisma.job.findUnique({
        where: { id },
        include: { stockLogs: true, backupDevice: true, images: true, user: true },
      });

      if (!currentJob) return;

      const isFinishedStatus = COMPLETED_STATUSES.includes(newStatus);
      if (isFinishedStatus && (!currentJob.stockLogs || currentJob.stockLogs.length === 0)) {
        console.error('Cannot update status without spare parts log.');
        return;
      }

      let finalReceiverName = currentJob.user?.name || 'adminTMDA';
      let validUserId = currentJob.userId || null;

      const isPermanentSwapStatus = newStatus === 'SWAPPED_PERMANENT';

      await prisma.$transaction(async (tx) => {
        await tx.job.update({
          where: { id },
          data: {
            status: newStatus,
            closedAt: isFinishedStatus ? new Date() : null,
          },
        });

        if (
          (newStatus === 'RETURNED_CUSTOMER_PICKUP' || 
           newStatus === 'RETURNED_SHIPPED' || 
           newStatus === 'RETURN_BACKUP_AND_DELIVER') && 
          currentJob.backupDeviceId
        ) {
          await tx.backupDevice.update({
            where: { id: currentJob.backupDeviceId },
            data: { 
              status: 'AVAILABLE',
              customerName: null,
              phone: null,
              currentJobId: null
            },
          });
        }

        if (isPermanentSwapStatus && currentJob.backupDeviceId) {
          await tx.backupDevice.update({
            where: { id: currentJob.backupDeviceId },
            data: { 
              status: 'SWAPPED_PERMANENT',
              customerName: currentJob.customerName || null,
              phone: currentJob.phone || null,
              receiverName: finalReceiverName,
              userId: validUserId,
              receiverId: validUserId,
            },
          });

          let formattedCategory = currentJob.category || 'อินเวอร์เตอร์';
          if (formattedCategory === 'INVERTER' || formattedCategory === 'Inv' || formattedCategory.toLowerCase() === 'inverter') {
            formattedCategory = 'อินเวอร์เตอร์';
          }

          const primaryImage = currentJob.images.find(img => !img.stockLogId && (img.type === 'NAMEPLATE' || img.type === 'nameplate'))?.url || null;

          const newCustomerBackupDevice = await tx.backupDevice.create({
            data: {
              status: 'AVAILABLE',
              category: formattedCategory,
              model: currentJob.model || '',
              brandId: currentJob.brandId || null,
              serialNumber: currentJob.serialNumber || `CUST-${Date.now()}`,
              productNo: (currentJob as any).productNo || null,
              customerName: null,
              phone: null,
              receiverName: finalReceiverName,
              userId: validUserId,
              receiverId: validUserId,
              imageUrl: primaryImage,
              hasBox: currentJob.hasBox || false,
              hasWifiDongle: currentJob.hasWifiDongle || false,
              wifiDongleSn: (currentJob as any).wifiDongleSn || null,
            },
          });

          await tx.job.update({
            where: { id },
            data: {
              backupDeviceId: newCustomerBackupDevice.id,
            },
          });

          for (const img of currentJob.images) {
            const isNameplate = img.type === 'NAMEPLATE' || img.type === 'nameplate';
            const isStockRelated = Boolean(img.stockLogId) || img.type?.startsWith('STOCK_');

            if (img.url && !isNameplate && !isStockRelated) {
              const existingImg = await tx.backupDeviceImage.findFirst({
                where: { backupDeviceId: newCustomerBackupDevice.id, url: img.url }
              });
              if (!existingImg) {
                await tx.backupDeviceImage.create({
                  data: {
                    url: img.url,
                    type: 'CONDITION',
                    backupDeviceId: newCustomerBackupDevice.id,
                  }
                });
              }
            }
          }
        }
      });

      revalidatePath(`/dashboard/jobs/${id}`);
      revalidatePath('/dashboard/jobs');
      revalidatePath('/dashboard/inventory/backups');
    } catch (error) {
      console.error('Failed to quick update status:', error);
    }
  }

  async function assignBackupDeviceAndSwap(formData: FormData) {
    'use server';
    const backupDeviceId = formData.get('backupDeviceId') as string;
    if (!backupDeviceId) return;

    try {
      const currentJob = await prisma.job.findUnique({
        where: { id },
      });

      if (!currentJob) return;

      if (currentJob.backupDeviceId && currentJob.backupDeviceId !== backupDeviceId) {
        await prisma.backupDevice.update({
          where: { id: currentJob.backupDeviceId },
          data: { 
            status: 'AVAILABLE',
            customerName: null,
            phone: null,
          },
        });
      }

      await prisma.backupDevice.update({
        where: { id: backupDeviceId },
        data: { 
          status: 'IN_USE',
          customerName: currentJob.customerName,
          phone: currentJob.phone,
        },
      });

      await prisma.job.update({
        where: { id },
        data: {
          backupDeviceId,
          status: 'SWAPPED_BACKUP_DEVICE',
        },
      });

      revalidatePath(`/dashboard/jobs/${id}`);
      revalidatePath('/dashboard/jobs');
      revalidatePath('/dashboard/inventory/backups');
    } catch (error) {
      console.error('Failed to assign backup device:', error);
    }

    redirect(`/dashboard/jobs/${id}?success=true`);
  }

  async function updateJob(formData: FormData) {
    'use server';
    const jobId = formData.get('jobId') as string || id;
    const status = formData.get('status') as string;
    const category = formData.get('category') as string;
    const brandId = formData.get('brandId') as string;
    const model = formData.get('model') as string;
    const serialNumber = formData.get('serialNumber') as string;
    const productNo = formData.get('productNo') as string;
    const customerName = formData.get('customerName') as string;
    const phone = formData.get('phone') as string;
    const note = formData.get('note') as string;
    const backupDeviceId = formData.get('backupDeviceId') as string;
    const wifiDongleSn = formData.get('wifiDongleSn') as string;
    
    const hasBox = formData.get('hasBox') === 'on' || formData.get('hasBox') === 'true' || formData.get('hasBox') === 'yes';
    const hasWifiDongle = formData.get('hasWifiDongle') === 'on' || formData.get('hasWifiDongle') === 'true' || formData.get('hasWifiDongle') === 'yes';

    const deletedImageIdsJson = formData.get('deletedImageIds') as string;

    try {
      const currentJob = await prisma.job.findUnique({
        where: { id: jobId },
        include: { stockLogs: true, images: true, user: true },
      });

      if (!currentJob) return;

      const isFinishedStatus = COMPLETED_STATUSES.includes(status);
      if (isFinishedStatus && (!currentJob.stockLogs || currentJob.stockLogs.length === 0)) {
        console.error('Cannot update job to finished status without spare parts log.');
        return;
      }

      if (currentJob.backupDeviceId !== backupDeviceId) {
        if (currentJob.backupDeviceId) {
          await prisma.backupDevice.update({
            where: { id: currentJob.backupDeviceId },
            data: { 
              status: 'AVAILABLE',
              customerName: null,
              phone: null,
            },
          });
        }
        if (backupDeviceId) {
          await prisma.backupDevice.update({
            where: { id: backupDeviceId },
            data: { 
              status: 'IN_USE',
              customerName,
              phone,
            },
          });
        }
      } else if (backupDeviceId) {
        await prisma.backupDevice.update({
          where: { id: backupDeviceId },
          data: {
            customerName,
            phone,
          },
        });
      }

      const isPermanentSwapStatus = status === 'SWAPPED_PERMANENT';

      if (isPermanentSwapStatus && currentJob.backupDeviceId) {
        let finalReceiverName = currentJob.user?.name || 'adminTMDA';
        let validUserId = currentJob.userId || null;

        await prisma.backupDevice.update({
          where: { id: currentJob.backupDeviceId },
          data: { 
            status: 'SWAPPED_PERMANENT',
            customerName: customerName || null,
            phone: phone || null,
            receiverName: finalReceiverName,
            userId: validUserId,
            receiverId: validUserId,
          },
        });

        if (serialNumber) {
          let formattedCategory = category || 'อินเวอร์เตอร์';
          const primaryImage = currentJob.images.find(img => !img.stockLogId && (img.type === 'NAMEPLATE' || img.type === 'nameplate'))?.url || null;

          const newCustomerBackupDevice = await prisma.backupDevice.create({
            data: {
              model: model || 'Unknown Model',
              serialNumber: serialNumber,
              category: formattedCategory,
              brandId: brandId === '' ? null : brandId,
              status: 'AVAILABLE',
              imageUrl: primaryImage,
              receiverName: finalReceiverName,
              userId: validUserId,
              receiverId: validUserId,
              hasBox: Boolean(hasBox),
              hasWifiDongle: Boolean(hasWifiDongle),
              wifiDongleSn: wifiDongleSn || null,
            },
          });

          await prisma.job.update({
            where: { id: jobId },
            data: {
              backupDeviceId: newCustomerBackupDevice.id,
            },
          });
        }
      }

      if (
        (status === 'RETURNED_CUSTOMER_PICKUP' || status === 'RETURNED_SHIPPED' || status === 'RETURN_BACKUP_AND_DELIVER') && 
        currentJob.backupDeviceId
      ) {
        await prisma.backupDevice.update({
          where: { id: currentJob.backupDeviceId },
          data: { 
            status: 'AVAILABLE',
            customerName: null,
            phone: null,
          },
        });
      }

      if (deletedImageIdsJson && deletedImageIdsJson.trim() !== '') {
        try {
          const deletedIds: string[] = JSON.parse(deletedImageIdsJson);
          if (Array.isArray(deletedIds) && deletedIds.length > 0) {
            await prisma.jobImage.deleteMany({
              where: {
                id: { in: deletedIds },
                jobId: jobId,
              },
            });
          }
        } catch (e) {
          console.error('Failed to parse deletedImageIds:', e);
        }
      }

      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      try {
        await mkdir(uploadDir, { recursive: true });
      } catch (e) {}

      const saveFileAndGetUrl = async (file: File): Promise<string | null> => {
        if (!file || file.size === 0) return null;
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const filename = `${uniqueSuffix}-${file.name.replace(/\s+/g, '_')}`;
        const filepath = path.join(uploadDir, filename);
        await writeFile(filepath, buffer);
        return `/uploads/${filename}`;
      };

      const nameplateFile = formData.get('nameplateImages') as File;
      if (nameplateFile && nameplateFile instanceof File && nameplateFile.size > 0) {
        await prisma.jobImage.deleteMany({
          where: {
            jobId: jobId,
            type: { in: ['NAMEPLATE', 'nameplate'] },
          },
        });

        const url = await saveFileAndGetUrl(nameplateFile);
        if (url) {
          await prisma.jobImage.create({
            data: {
              url,
              type: 'NAMEPLATE',
              jobId: jobId,
            },
          });
        }
      }

      for (const [key, value] of formData.entries()) {
        if (value instanceof File && value.size > 0) {
          if (key.includes('nameplateImages') || key.toLowerCase().includes('nameplate')) {
            continue;
          }

          const url = await saveFileAndGetUrl(value);
          if (url) {
            let imageType = 'OTHER';
            let stockLogId: string | null = null;

            if (key.includes('otherImages')) {
              imageType = 'OTHER';
            } else if (key.includes('fullBoardImages_')) {
              imageType = 'FULL_BOARD';
              stockLogId = key.replace('fullBoardImages_', '');
            } else if (key.includes('qrCodeImages_')) {
              imageType = 'QR_CODE';
              stockLogId = key.replace('qrCodeImages_', '');
            }

            await prisma.jobImage.create({
              data: {
                url,
                type: imageType,
                jobId: jobId,
                stockLogId: stockLogId,
              },
            });
          }
        }
      }

      await prisma.job.update({
        where: { id: jobId },
        data: {
          status,
          category,
          model,
          serialNumber,
          productNo,
          customerName,
          phone,
          note,
          wifiDongleSn,
          hasBox: Boolean(hasBox),
          hasWifiDongle: Boolean(hasWifiDongle),
          brandId: brandId === '' ? null : brandId,
          backupDeviceId: backupDeviceId === '' ? null : backupDeviceId,
          closedAt: COMPLETED_STATUSES.includes(status) ? new Date() : null,
        },
      });

      revalidatePath(`/dashboard/jobs/${jobId}`);
      revalidatePath('/dashboard/jobs');
      revalidatePath('/dashboard/inventory/backups');
    } catch (error) {
      console.error('Failed to update job:', error);
    }

    redirect(`/dashboard/jobs/${jobId}?success=true`);
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 relative">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/jobs"
            className="p-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-700 transition shadow-sm no-underline shrink-0"
            title="ย้อนกลับ"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2 flex-wrap">
              <User className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 shrink-0" /> 
              <span>{job.customerName || 'ไม่ระบุชื่อลูกค้า'}</span>
            </h1>
            <span className="inline-block mt-1 text-xs sm:text-sm font-normal text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200">
              เลขที่ใบงาน: {job.jobNo}
            </span>
            <p className="text-xs text-gray-400 mt-1">สร้างเมื่อ: {new Date(job.createdAt).toLocaleString('th-TH')}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <Link
            href={`/dashboard/jobs/${id}/print`}
            target="_blank"
            className="justify-center px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs sm:text-sm rounded-xl shadow-sm transition flex items-center gap-2 no-underline"
          >
            <Printer className="w-4 h-4" /> พิมพ์ใบเคลม (A4)
          </Link>

          {isDeyeOrTmda && (
            <a
              href={`/api/export-claims?jobId=${job.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="justify-center px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs sm:text-sm rounded-xl shadow-sm transition flex items-center gap-2 no-underline"
            >
              <FileSpreadsheet className="w-4 h-4" /> Export Excel เคลม
            </a>
          )}
        </div>
      </div>

      {isSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-sm font-semibold">บันทึกข้อมูลเรียบร้อยแล้ว!</span>
        </div>
      )}

      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-4 sm:p-5 rounded-2xl shadow-lg border border-indigo-900/30 text-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 border border-blue-400/30 rounded-xl text-blue-400 shrink-0">
              <GitCommit className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">ระบบควบคุมขั้นตอนงานซ่อม</h3>
              <p className="text-xs text-indigo-200">คลิกปุ่มด้านล่างเพื่อจัดการอะไหล่และเปลี่ยนสถานะใบงาน</p>
            </div>
          </div>
          <div className="text-xs bg-white/10 px-3 py-2 rounded-xl text-blue-100 border border-white/15 flex items-center justify-between sm:justify-start gap-2 backdrop-blur-md">
            <span className="text-slate-300">สถานะปัจจุบัน:</span> 
            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/25 text-emerald-300 font-semibold border border-emerald-500/40 text-center">
              {STATUS_LABELS[job.status] || job.status}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-1">
          {job.status === 'PENDING' && (
            <form action={async () => { 'use server'; await quickUpdateStatus('DIAGNOSE'); }}>
              <JobSubmitButton 
                loadingText="กำลังบันทึก..." 
                className="w-full sm:w-auto justify-center px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition flex items-center gap-2 cursor-pointer border border-indigo-400/35"
              >
                <PlayCircle className="w-4 h-4 text-indigo-200" /> เริ่มต้นประเมินอาการ <ArrowRight className="w-4 h-4" />
              </JobSubmitButton>
            </form>
          )}

          {job.status === 'DIAGNOSE' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <form action={async () => { 'use server'; await quickUpdateStatus('WAITING_FOR_APPROVAL'); }} className="w-full sm:w-auto">
                <JobSubmitButton 
                  loadingText="กำลังบันทึก..." 
                  className="w-full justify-center px-4 py-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition flex items-center gap-2 cursor-pointer border border-orange-400/35"
                >
                  <ShieldAlert className="w-4 h-4 text-orange-200 shrink-0" /> ไม่อยู่ในประกัน (รอลูกค้าอนุมัติ)
                </JobSubmitButton>
              </form>
              <form action={async () => { 'use server'; await quickUpdateStatus('IN_REPAIR'); }} className="w-full sm:w-auto">
                <JobSubmitButton 
                  loadingText="กำลังบันทึก..." 
                  className="w-full justify-center px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition flex items-center gap-2 cursor-pointer border border-blue-400/35"
                >
                  <ShieldCheck className="w-4 h-4 text-blue-200 shrink-0" /> อยู่ในประกัน (เริ่มซ่อมได้เลย)
                </JobSubmitButton>
              </form>
            </div>
          )}

          {job.status === 'WAITING_FOR_APPROVAL' && (
            <form action={async () => { 'use server'; await quickUpdateStatus('IN_REPAIR'); }}>
              <JobSubmitButton 
                loadingText="กำลังบันทึก..." 
                className="w-full sm:w-auto justify-center px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition flex items-center gap-2 cursor-pointer border border-blue-400/35"
              >
                🛠 ลูกค้าอนุมัติราคาแล้ว เริ่มซ่อมเลย <ArrowRight className="w-4 h-4" />
              </JobSubmitButton>
            </form>
          )}

          {(job.status === 'IN_PROGRESS' || job.status === 'IN_REPAIR' || job.status === 'SWAPPED_BACKUP_DEVICE') && (
            <div className={`flex flex-col items-start gap-3 p-4 rounded-xl border w-full backdrop-blur-md ${
              !hasSpareParts ? 'bg-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-950/50' : 'bg-amber-500/10 border-amber-500/30'
            }`}>
              <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                {!hasSpareParts ? (
                  <div className="text-xs sm:text-sm text-amber-200 font-medium flex items-start gap-2 leading-relaxed">
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" /> 
                    <div>
                      <strong className="text-amber-300 font-bold underline decoration-amber-400/60 decoration-2">⚠️ คำเตือนสำคัญ:</strong> ใบงานนี้ยังไม่มีประวัติการเบิกอะไหล่! กรุณากดปุ่มเบิกอะไหล่ก่อน จึงจะสามารถกดซ่อมเสร็จสิ้นได้
                    </div>
                  </div>
                ) : (
                  <div className="text-xs sm:text-sm text-emerald-200 font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> 
                    <span>บันทึกเบิกอะไหล่เรียบร้อยแล้ว สามารถกดซ่อมเสร็จหรือจัดการต่อได้เลย</span>
                  </div>
                )}

                <JobLinkButton
                  href={`/dashboard/jobs/${id}/restock`} 
                  loadingText="กำลังโหลด..."
                  className="w-full sm:w-auto justify-center px-4 py-3 font-bold text-xs sm:text-sm rounded-xl shadow-lg transition flex items-center gap-2 no-underline bg-amber-500 hover:bg-amber-600 text-white ring-4 ring-amber-400/20 shrink-0"
                >
                  <Layers className="w-4 h-4" /> ⚡ เบิกอะไหล่และแนบหลักฐาน {!hasSpareParts && '(จำเป็น)'}
                </JobLinkButton>
              </div>

              <div className="w-full flex flex-col gap-2.5 pt-1">
                <div className="text-xs text-indigo-200 font-medium">
                  ดำเนินการขั้นตอนถัดไป:
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-wrap">
                  {!job.backupDeviceId && (
                    <JobLinkButton
                      href={`/dashboard/jobs/${id}?showSwapModal=true`}
                      loadingText="กำลังเปิดหน้าต่าง..."
                      className="w-full sm:w-auto justify-center px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-sm transition flex items-center gap-2 no-underline border border-indigo-400/30"
                    >
                      🔄 ให้ยืมเครื่องสำรองระหว่างซ่อม
                    </JobLinkButton>
                  )}

                  {hasSpareParts && (
                    <form action={async () => { 'use server'; await quickUpdateStatus('COMPLETED'); }} className="w-full sm:w-auto">
                      <JobSubmitButton 
                        loadingText="กำลังบันทึก..." 
                        className="w-full sm:w-auto justify-center px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-sm transition flex items-center gap-2 cursor-pointer border border-emerald-400/30"
                      >
                        ✅ ซ่อมเครื่องเสร็จสิ้น (COMPLETED)
                      </JobSubmitButton>
                    </form>
                  )}

                  {isDeyeOrTmda && (
                    <form action={async () => { 'use server'; await quickUpdateStatus('WAITING_DEYE_SEND'); }} className="w-full sm:w-auto">
                      <JobSubmitButton 
                        loadingText="กำลังบันทึก..." 
                        className="w-full sm:w-auto justify-center px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-sm transition flex items-center gap-2 cursor-pointer border border-purple-400/30"
                      >
                        <Send className="w-4 h-4" /> รอส่ง Deye
                      </JobSubmitButton>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}

          {job.status === 'WAITING_DEYE_SEND' && (
            <form action={async () => { 'use server'; await quickUpdateStatus('SENT_TO_DEYE'); }}>
              <JobSubmitButton 
                loadingText="กำลังบันทึก..." 
                className="w-full sm:w-auto justify-center px-5 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition flex items-center gap-2 cursor-pointer border border-purple-400/35"
              >
                🚚 ส่งเครื่องไป Deye แล้ว <ArrowRight className="w-4 h-4" />
              </JobSubmitButton>
            </form>
          )}

          {job.status === 'SENT_TO_DEYE' && (
            <form action={async () => { 'use server'; await quickUpdateStatus('COMPLETED_BY_DEYE'); }}>
              <JobSubmitButton 
                loadingText="กำลังบันทึก..." 
                className="w-full sm:w-auto justify-center px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition flex items-center gap-2 cursor-pointer border border-purple-400/35"
              >
                ✅ Deye ซ่อมเสร็จส่งกลับมาแล้ว (COMPLETED_BY_DEYE) <CheckCircle2 className="w-4 h-4" />
              </JobSubmitButton>
            </form>
          )}

          {isReadyForDelivery && (
            <div className="w-full p-4 bg-emerald-500/15 border border-emerald-500/40 rounded-xl space-y-3">
              <p className="text-xs sm:text-sm font-bold text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> เครื่องซ่อมเสร็จแล้ว! กรุณาเลือกวิธีส่งมอบเพื่อปิดเคส:
              </p>

              {job.backupDeviceId ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <form action={async () => { 'use server'; await quickUpdateStatus('SWAPPED_PERMANENT'); }} className="w-full sm:w-auto">
                    <JobSubmitButton 
                      loadingText="กำลังบันทึก..." 
                      className="w-full sm:w-auto justify-center px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs sm:text-sm shadow transition cursor-pointer flex items-center gap-2 border border-purple-400/30"
                    >
                      🔄 ทางเลือก 1: เปลี่ยนเครื่องสำรองให้ถาวร
                    </JobSubmitButton>
                  </form>
                  <form action={async () => { 'use server'; await quickUpdateStatus('RETURN_BACKUP_AND_DELIVER'); }} className="w-full sm:w-auto">
                    <JobSubmitButton 
                      loadingText="กำลังบันทึก..." 
                      className="w-full sm:w-auto justify-center px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs sm:text-sm shadow transition cursor-pointer flex items-center gap-2 border border-purple-400/30"
                    >
                      👤 ทางเลือก 2: คืนเครื่องสำรอง + ส่งมอบเครื่องลูกค้า
                    </JobSubmitButton>
                  </form>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <form action={async () => { 'use server'; await quickUpdateStatus('RETURNED_CUSTOMER_PICKUP'); }} className="w-full sm:w-auto">
                    <JobSubmitButton 
                      loadingText="กำลังบันทึก..." 
                      className="w-full sm:w-auto justify-center px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs sm:text-sm shadow transition cursor-pointer flex items-center gap-2 border border-purple-400/30"
                    >
                      🏢 ลูกค้ามารับเครื่องคืนเองที่ร้าน
                    </JobSubmitButton>
                  </form>
                  <form action={async () => { 'use server'; await quickUpdateStatus('RETURNED_SHIPPED'); }} className="w-full sm:w-auto">
                    <JobSubmitButton 
                      loadingText="กำลังบันทึก..." 
                      className="w-full sm:w-auto justify-center px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs sm:text-sm shadow transition cursor-pointer flex items-center gap-2 border border-purple-400/30"
                    >
                      🚚 จัดส่งเครื่องคืนลูกค้าผ่านระบบขนส่ง
                    </JobSubmitButton>
                  </form>
                </div>
              )}
            </div>
          )}

          {isFinalClosed && (
            <div className="w-full p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-emerald-200">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
                <PackageCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>ปิดการดำเนินการเรียบร้อยด้วยสถานะ: <span className="text-white underline">{STATUS_LABELS[job.status] || job.status}</span></span>
              </div>
              {job.closedAt && (
                <span className="text-xs text-emerald-300/80">ปิดเมื่อ: {new Date(job.closedAt).toLocaleString('th-TH')}</span>
              )}
            </div>
          )}

          {job.status !== 'CANCELLED' && !isFinalClosed && (
            <div className="w-full flex justify-end pt-1">
              <form action={async () => { 'use server'; await quickUpdateStatus('CANCELLED'); }}>
                <JobSubmitButton 
                  loadingText="กำลังบันทึก..." 
                  className="w-full sm:w-auto justify-center px-4 py-2.5 bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-800/40 font-semibold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  ❌ ยกเลิกใบงาน
                </JobSubmitButton>
              </form>
            </div>
          )}
        </div>
      </div>

      {showSwapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 border border-gray-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Laptop className="w-5 h-5 text-indigo-600" /> เลือกเครื่องสำรองให้ลูกค้าใช้งาน
              </h3>
              <Link
                href={`/dashboard/jobs/${id}`}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold p-1 rounded-lg no-underline"
              >
                ✕
              </Link>
            </div>

            <form action={assignBackupDeviceAndSwap} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                  เลือกเครื่องสำรองจากคลัง
                </label>
                <select
                  name="backupDeviceId"
                  required
                  defaultValue={job.backupDeviceId || ''}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/25 outline-none transition"
                >
                  <option value="">-- กรุณาเลือกเครื่องสำรอง --</option>
                  {backupDevices.map((dev) => (
                    <option key={dev.id} value={dev.id}>
                      {dev.model} (S/N: {dev.serialNumber}) [{dev.status}]
                    </option>
                  ))}
                </select>
                {backupDevices.length === 0 && (
                  <p className="text-xs text-red-500 mt-1.5">⚠️ ไม่มีเครื่องสำรองว่างในขณะนี้ กรุณาเพิ่มเครื่องสำรองในเมนูเครื่องสำรองก่อน</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Link
                  href={`/dashboard/jobs/${id}`}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm rounded-xl transition no-underline"
                >
                  ยกเลิก
                </Link>
                <JobSubmitButton
                  loadingText="กำลังบันทึก..."
                  disabled={backupDevices.length === 0}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow transition cursor-pointer flex items-center gap-2"
                >
                  ยืนยันให้ยืมเครื่องสำรอง
                </JobSubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}

      <JobEditForm 
        job={job}
        brands={brands}
        backupDevices={backupDevices}
        statusLabels={STATUS_LABELS}
        updateJobAction={updateJob}
      />
    </div>
  );
}