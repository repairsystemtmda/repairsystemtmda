import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        brand: true,
        backupDevice: true,
        images: true,
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

    const getStatusText = (status: string) => {
      const map: { [key: string]: string } = {
        PENDING: 'รอดำเนินการ',
        IN_REPAIR: 'กำลังซ่อม',
        COMPLETED: 'ซ่อมเสร็จแล้ว',
        CANCELLED: 'ยกเลิก',
      };
      return map[status] || status;
    };

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/1999/xlink">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Calibri', 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 20px; background-color: #ffffff; }
          table { border-collapse: collapse; width: 100%; }
          .report-title {
            background-color: #1e3a8a;
            color: #ffffff;
            font-size: 14pt;
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
            padding: 14px 10px;
          }
          .report-subtitle {
            background-color: #f1f5f9;
            color: #475569;
            font-size: 10pt;
            text-align: center;
            font-style: italic;
            padding: 8px 10px;
            border-bottom: 2px solid #cbd5e1;
          }
          .section-header {
            background-color: #dbeafe;
            color: #1e40af;
            font-size: 11pt;
            font-weight: bold;
            padding: 8px 10px;
            border: 1px solid #94a3b8;
          }
          .table-header {
            background-color: #2563eb;
            color: #ffffff;
            font-size: 10pt;
            font-weight: bold;
            text-align: center;
            padding: 8px 10px;
            border: 1px solid #1d4ed8;
          }
          .label-cell {
            background-color: #f8fafc;
            color: #334155;
            font-weight: bold;
            font-size: 10pt;
            padding: 7px 12px;
            border: 1px solid #cbd5e1;
          }
          .value-cell {
            color: #0f172a;
            font-size: 10pt;
            padding: 7px 12px;
            border: 1px solid #cbd5e1;
          }
          .data-cell {
            font-size: 10pt;
            padding: 7px 12px;
            border: 1px solid #cbd5e1;
            text-align: left;
          }
          .data-cell-center {
            font-size: 10pt;
            padding: 7px 12px;
            border: 1px solid #cbd5e1;
            text-align: center;
          }
          .badge-status {
            color: #2563eb;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <table>
          <colgroup>
            <col style="width: 240px;" />
            <col style="width: 180px;" />
            <col style="width: 100px;" />
            <col style="width: 240px;" />
          </colgroup>

          <!-- Title Banner -->
          <tr>
            <td colspan="4" class="report-title">ใบรายงานสรุปการเคลมและซ่อมบำรุง<br><span style="font-size: 10pt; font-weight: normal;">(Claim & Repair Summary Report)</span></td>
          </tr>
          <tr>
            <td colspan="4" class="report-subtitle">เลขที่ใบงาน: <b>${job.jobNo}</b> &nbsp;|&nbsp; วันที่พิมพ์: ${new Date().toLocaleDateString('th-TH')}</td>
          </tr>
          <tr><td colspan="4" style="height: 12px;"></td></tr>

          <!-- Section 1 Header -->
          <tr>
            <td colspan="4" class="section-header">📌 ส่วนที่ 1: ข้อมูลใบงานและตัวเครื่อง (Job & Device Info)</td>
          </tr>

          <!-- Section 1 Rows -->
          <tr>
            <td class="label-cell">เลขที่ใบงาน (Job No.)</td>
            <td colspan="3" class="value-cell"><b>${job.jobNo}</b></td>
          </tr>
          <tr>
            <td class="label-cell">สถานะงานซ่อม</td>
            <td colspan="3" class="value-cell"><span class="badge-status">${getStatusText(job.status)}</span></td>
          </tr>
          <tr>
            <td class="label-cell">ประเภทอุปกรณ์ / แบรนด์</td>
            <td colspan="3" class="value-cell">${job.category || '-'} / ${job.brand?.name || '-'}</td>
          </tr>
          <tr>
            <td class="label-cell">รุ่น (Model)</td>
            <td colspan="3" class="value-cell">${job.model || '-'}</td>
          </tr>
          <tr>
            <td class="label-cell">Serial Number (S/N)</td>
            <td colspan="3" class="value-cell" style="font-family: monospace; font-weight: bold;">${job.serialNumber || '-'}</td>
          </tr>
          <tr>
            <td class="label-cell">Product No. (สำหรับ Deye)</td>
            <td colspan="3" class="value-cell" style="font-family: monospace;">${job.productNo || '-'}</td>
          </tr>
          <tr>
            <td class="label-cell">ชื่อลูกค้า / เบอร์โทร</td>
            <td colspan="3" class="value-cell">${job.customerName || '-'} (${job.phone || '-'})</td>
          </tr>
          <tr>
            <td class="label-cell">อาการเสีย / หมายเหตุ</td>
            <td colspan="3" class="value-cell">${job.note || '-'}</td>
          </tr>

          <tr><td colspan="4" style="height: 15px;"></td></tr>

          <!-- Section 2 Header -->
          <tr>
            <td colspan="4" class="section-header">📦 ส่วนที่ 2: ประวัติการเบิกอะไหล่ / บอร์ดซ่อม (Spare Parts & Stock Logs)</td>
          </tr>

          <!-- Table Headers -->
          <tr>
            <td class="table-header">ชื่ออะไหล่ / บอร์ด</td>
            <td class="table-header">รหัสอะไหล่</td>
            <td class="table-header">จำนวน</td>
            <td class="table-header">ประเภทการเบิก</td>
          </tr>

          <!-- Stock Logs Data -->
          ${
            job.stockLogs && job.stockLogs.length > 0
              ? job.stockLogs
                  .map(
                    (log) => `
              <tr>
                <td class="data-cell"><b>${log.sparePart?.name || 'อะไหล่ทั่วไป'}</b></td>
                <td class="data-cell" style="font-family: monospace;">${log.sparePart?.code || '-'}</td>
                <td class="data-cell-center" style="font-weight: bold; color: ${log.quantity < 0 ? '#dc2626' : '#2563eb'};">${log.quantity}</td>
                <td class="data-cell">${log.type || '-'}</td>
              </tr>
            `
                  )
                  .join('')
              : `
              <tr>
                <td colspan="4" class="data-cell-center" style="color: #64748b; font-style: italic; padding: 15px;">ยังไม่มีการเบิกอะไหล่ในใบงานนี้</td>
              </tr>
            `
          }
        </table>
      </body>
      </html>
    `;

    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
        'Content-Disposition': `attachment; filename=Claim_Report_${job.jobNo}.xls`,
      },
    });
  } catch (error) {
    console.error('Export Claim Excel Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}