import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';

export async function GET(request: Request) {
  try {
    const urlObj = new URL(request.url);
    const startDateStr = urlObj.searchParams.get('startDate');
    const endDateStr = urlObj.searchParams.get('endDate');
    const brandFilter = urlObj.searchParams.get('brand');

    const dateFilter: any = {};
    if (startDateStr && endDateStr) {
      const start = new Date(startDateStr);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDateStr);
      end.setHours(23, 59, 59, 999);
      dateFilter.createdAt = {
        gte: start,
        lte: end,
      };
    }

    if (brandFilter && brandFilter !== 'all') {
      dateFilter.model = { contains: brandFilter, mode: 'insensitive' };
    }

    const jobs = await prisma.job.findMany({
      where: dateFilter,
      orderBy: { createdAt: 'desc' },
    });

    const brandStats: Record<string, { completed: number; inRepair: number; completedThisMonth: number; total: number }> = {};

    for (const job of jobs) {
      const brand = (job as any).brand || (job.model?.includes('SUN') || job.model?.includes('Deye') ? 'Deye' : 'INVT');
      
      if (!brandStats[brand]) {
        brandStats[brand] = { completed: 0, inRepair: 0, completedThisMonth: 0, total: 0 };
      }

      const status = job.status;
      const isCompleted = status === 'COMPLETE' || status === 'COMPLETED' || status === 'CLOSED';
      const isInRepair = status === 'IN_REPAIR' || status === 'PENDING' || status === 'PROCESSING';

      if (isCompleted) {
        brandStats[brand].completed++;
        if (job.closedAt) {
          const closedDate = new Date(job.closedAt);
          const now = new Date();
          if (closedDate.getMonth() === now.getMonth() && closedDate.getFullYear() === now.getFullYear()) {
            brandStats[brand].completedThisMonth++;
          }
        }
      } else if (isInRepair) {
        brandStats[brand].inRepair++;
      }
      brandStats[brand].total++;
    }

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Brand Summary Dashboard');

    ws.mergeCells('A1:E1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'รายงานสรุปสถิติการซ่อมแยกตามแบรนด์ (Repair Summary Dashboard)';
    titleCell.font = { name: 'Calibri', size: 14, bold: true };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(1).height = 30;

    ws.mergeCells('A2:E2');
    const dateRangeText = startDateStr && endDateStr ? `ช่วงเวลาข้อมูล: ${startDateStr} ถึง ${endDateStr}` : `ช่วงเวลาข้อมูล: ทั้งหมด`;
    const subCell = ws.getCell('A2');
    subCell.value = dateRangeText;
    subCell.font = { name: 'Calibri', size: 11, italic: true };
    subCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(2).height = 22;

    ws.addRow([]);

    const headers = [
      'แบรนด์ / ยี่ห้อ',
      'ซ่อมเสร็จแล้ว (เครื่อง)',
      'รอซ่อม / ดำเนินการ (เครื่อง)',
      'ซ่อมเสร็จในเดือนนี้ (เครื่อง)',
      'รวมทั้งหมด (Total)'
    ];
    const headerRow = ws.addRow(headers);
    headerRow.height = 25;

    for (let c = 1; c <= 5; c++) {
      const cell = headerRow.getCell(c);
      cell.font = { name: 'Calibri', size: 11, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    }

    ws.columns = [
      { key: 'brand', width: 22 },
      { key: 'completed', width: 24 },
      { key: 'inRepair', width: 24 },
      { key: 'completedMonth', width: 26 },
      { key: 'total', width: 18 },
    ];

    let totalCompleted = 0;
    let totalInRepair = 0;
    let totalCompletedMonth = 0;
    let grandTotal = 0;

    const brands = Object.keys(brandStats);
    if (brands.length === 0) {
      const r = ws.addRow(['Deye', 0, 0, 0, 0]);
      r.height = 20;
      for (let c = 1; c <= 5; c++) {
        const cell = r.getCell(c);
        cell.font = { name: 'Calibri', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      }
    } else {
      for (const brand of brands) {
        const stats = brandStats[brand];
        totalCompleted += stats.completed;
        totalInRepair += stats.inRepair;
        totalCompletedMonth += stats.completedThisMonth;
        grandTotal += stats.total;

        const r = ws.addRow([brand, stats.completed, stats.inRepair, stats.completedThisMonth, stats.total]);
        r.height = 20;
        for (let c = 1; c <= 5; c++) {
          const cell = r.getCell(c);
          cell.font = { name: 'Calibri', size: 10 };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        }
      }
    }

    const totalRow = ws.addRow(['รวมทั้งหมด (Total)', totalCompleted, totalInRepair, totalCompletedMonth, grandTotal]);
    totalRow.height = 22;
    for (let c = 1; c <= 5; c++) {
      const cell = totalRow.getCell(c);
      cell.font = { name: 'Calibri', size: 10, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="Repair_Summary_Dashboard_${Date.now()}.xlsx"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });

  } catch (error) {
    console.error('Export Dashboard Error:', error);
    return NextResponse.json({ error: 'Failed to export dashboard excel' }, { status: 500 });
  }
}