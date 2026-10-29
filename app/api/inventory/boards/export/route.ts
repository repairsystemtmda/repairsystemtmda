import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export async function GET() {
  try {
    const spareParts = await prisma.sparePart.findMany({
      select: {
        code: true,
        boardModelCode: true,
        qrModelCode: true,
        name: true,
        category: true,
        boardType: true,
        version: true, // เพิ่มการดึงฟิลด์ version
        model: true,
        location: true,
        stock: true,
        minQuantity: true,
      },
      orderBy: { name: 'asc' },
    });

    const rows: any[][] = [
      // ขยับหัวข้อรายงานให้กึ่งกลางตามจำนวนคอลัมน์ใหม่ (รวม 11 คอลัมน์ A ถึง K)
      ['', '', '', '', 'รายงานสรุปสต็อกบอร์ดและอะไหล่ (Inventory Stock Report)'], 
      [   // แถวที่ 2: หัวตาราง (เพิ่มคอลัมน์ 'เวอร์ชัน')
        'ลำดับ',
        'รหัสรุ่นบอร์ด',
        'ชื่อบอร์ดอะไหล่',
        'หมวดหมู่หลัก',
        'ประเภทบอร์ด',
        'เวอร์ชัน',
        'รุ่นเครื่องที่รองรับ',
        'ตำแหน่งจัดเก็บ (Location)',
        'คงเหลือ (ชิ้น)',
        'ขั้นต่ำ',
        'สถานะสต็อก'
      ]
    ];

    spareParts.forEach((item, index) => {
      const displayCode = item.code || item.boardModelCode || item.qrModelCode || '-';
      const minStock = item.minQuantity ?? 0;
      let status = 'ปกติ';

      if (item.stock <= 0) {
        status = 'สินค้าหมด';
      } else if (item.stock <= minStock) {
        status = 'อะไหล่เหลือน้อย';
      }

      rows.push([
        index + 1,
        displayCode,
        item.name,
        item.category || '-',
        item.boardType || '-',
        item.version || '-', // เพิ่มข้อมูลเวอร์ชันในแถว
        item.model || '-',
        item.location || '-',
        Number(item.stock),
        Number(minStock),
        status,
      ]);
    });

    const lastRow = rows.length;
    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    // กำหนดความกว้างคอลัมน์ให้พอดีสวยงาม (เพิ่มคอลัมน์สำหรับเวอร์ชัน)
    worksheet['!cols'] = [
      { wch: 8 },  { wch: 20 }, { wch: 25 }, { wch: 18 }, { wch: 18 }, 
      { wch: 12 }, { wch: 22 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 18 },
    ];

    // กำหนดขอบเขตและเปิดใช้งาน Auto-Filter ที่หัวตารางแถวที่ 2 (ช่วง A ถึง K)
    worksheet['!ref'] = `A1:K${lastRow}`;
    worksheet['!autofilter'] = { ref: `A2:K${lastRow}` };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'สต็อกบอร์ดอะไหล่');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    const filename = `Stock_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Export Excel Error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้างไฟล์ Export' }, { status: 500 });
  }
}