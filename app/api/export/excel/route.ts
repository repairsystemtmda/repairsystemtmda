import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // ใช้ (prisma as any) เพื่อป้องกัน Error เรื่อง Property ของโมเดลใน TypeScript
    const jobs = await (prisma as any).repairJob.findMany({
      include: {
        requisitions: {
          include: { board: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // สร้างคอลัมน์ CSV Header
    const headers = [
      'Job ID',
      'Category',
      'Brand/Model',
      'Serial Number (S/N)',
      'Product Number',
      'Dongle S/N',
      'Requisition Boards',
      'Status',
      'Reported Date',
    ];

    const rows = jobs.map((job: any) => {
      const boardList = job.requisitions
        .map((r: any) => `${r.board.code} (${r.quantityRequested})`)
        .join('; ');

      return [
        job.jobNo || '',
        job.category || '',
        `"${job.brand || ''} ${job.model || ''}"`,
        `"${job.serialNumber || ''}"`,
        `"${job.productNumber || '-'}"`,
        `"${job.wifiDongleSn || '-'}"`,
        `"${boardList || '-'}"`,
        job.status || '',
        job.reportedDate ? new Date(job.reportedDate).toISOString().split('T')[0] : '',
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=repair-summary-${new Date().toISOString().split('T')[0]}.csv`,
      },
    });
  } catch (error) {
    console.error('Export Error:', error);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}