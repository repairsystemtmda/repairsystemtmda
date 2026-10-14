import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const jobId = resolvedParams.id;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        brand: true, // หากที่ Schema ตั้งความสัมพันธ์ brand ไว้ ให้ใช้ include แบบนี้เพื่อให้ดึงข้อมูลแบรนด์มาได้
        backupDevice: true,
        stockLogs: {
          include: {
            sparePart: true,
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // สร้างข้อมูลสำหรับ Export
    const csvRows = [
      ['Job No', job.jobNo],
      ['Status', job.status],
      ['Customer Name', job.customerName || ''],
      ['Phone', job.phone || ''],
      ['Category', job.category || ''],
      // ปรับแก้ตรงนี้ให้ดึงชื่อแบรนด์จากความสัมพันธ์ (เช่น job.brand?.name หรือปรับตามฟิลด์จริงในฐานข้อมูลของคุณ)
      ['Brand', (job as any).brand?.name || job.brand || ''], 
      ['Model', job.model || ''],
      ['Serial Number', job.serialNumber || ''],
      ['Product No', job.productNo || ''],
      ['Receiver / Technician', job.receiverName || ''],
      ['Created At', new Date(job.createdAt).toLocaleString('th-TH')],
      ['---', '---'],
      ['Spare Parts Used:', 'Quantity'],
    ];

    job.stockLogs.forEach((log) => {
      csvRows.push([log.sparePart?.name || 'Unknown Part', String(log.quantity)]);
    });

    // แปลงข้อมูลเป็น CSV Format พร้อมรองรับภาษาไทย (UTF-8 BOM)
    const csvContent = '\uFEFF' + csvRows.map((e) => e.join(',')).join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="Job-${job.jobNo}-Report.csv"`,
      },
    });
  } catch (error) {
    console.error('API Export error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}