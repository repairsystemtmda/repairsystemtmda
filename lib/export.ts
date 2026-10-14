import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';

export async function buildRepairReportExcelBuffer() {
  const jobs = await prisma.repairJob.findMany({
    include: {
      usedBoards: {
        include: {
          board: true,
        },
      },
      backupDevice: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const reportData = jobs.map((job) => {
    // รวบรวมรายการบอร์ดที่เบิกใช้งาน
    const requisitionBoards = job.usedBoards.length > 0
      ? job.usedBoards.map((u) => `${u.board.code} (x${u.quantity})`).join(', ')
      : '-';

    // ลำดับคอลัมน์ตรงตามโจทย์ Phase 6
    return {
      'Job ID': job.jobNo,
      'Category': job.category,
      'Brand/Model': job.backupDevice ? `${job.backupDevice.brand} ${job.backupDevice.model}` : '-',
      'Serial Number': job.serialNumber,
      'Product Number': job.productNumber || '-',
      'Dongle S/N': job.hasWifiDongle ? (job.wifiDongleSn || 'Yes') : '-',
      'Requisition Boards': requisitionBoards,
      'Status': job.status,
      'Reported Date': new Date(job.reportedDate).toISOString().split('T')[0],
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(reportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Repair Report');

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
}