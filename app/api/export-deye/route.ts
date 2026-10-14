import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

export async function GET(request: Request) {
  try {
    const urlObj = new URL(request.url);
    const jobId = urlObj.searchParams.get('jobId');

    const whereCondition: any = jobId ? { id: jobId } : {};

    // 1. ดึงข้อมูลงานซ่อมปกติ (Jobs)
    const rawJobs = await prisma.job.findMany({
      where: whereCondition,
      include: {
        brand: true,
        backupDevice: {
          include: {
            brand: true,
          },
        },
        images: true,
        stockLogs: {
          include: {
            sparePart: true,
            images: true,
            user: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. ดึงข้อมูลเครื่องสำรอง (Backup Devices)
    const rawBackupDevices = await prisma.backupDevice.findMany({
      include: {
        brand: true,
        images: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // ดึง StockLogs ทั้งหมดแล้วกรองเฉพาะของเครื่องสำรอง
    const backupDeviceIds = rawBackupDevices.map(d => d.id);
    let backupStockLogs: any[] = [];
    try {
      const allStockLogs = await prisma.stockLog.findMany({
        include: {
          sparePart: true,
          images: true,
          user: true,
        },
      });
      backupStockLogs = allStockLogs.filter((log: any) => backupDeviceIds.includes(log.backupDeviceId));
    } catch (e) {
      backupStockLogs = [];
    }

    // รวม stockLogs เข้ากับ BackupDevice แต่ละตัว
    const backupDevicesWithLogs = rawBackupDevices.map(dev => ({
      ...dev,
      stockLogs: backupStockLogs.filter((log: any) => log.backupDeviceId === dev.id),
    }));

    // แปลง BackupDevice ให้มีโครงสร้างเทียบเท่า Job
    const backupAsJobs = backupDevicesWithLogs.map(dev => ({
      id: dev.id,
      brand: dev.brand,
      backupDevice: dev,
      backupDeviceId: dev.id,
      serialNumber: dev.serialNumber,
      model: dev.model,
      productNo: dev.productNo,
      createdAt: dev.createdAt,
      closedAt: dev.updatedAt,
      imageUrl: dev.imageUrl,
      images: dev.images || [],
      stockLogs: dev.stockLogs || [],
      faultLocation: 'LCD',
      responsibleParty: 'TMDA',
    }));

    // รวมข้อมูลทั้งสองแหล่งเข้าด้วยกัน
    const combinedList = [...rawJobs, ...backupAsJobs];

    // กรองเฉพาะแบรนด์ Deye หรือ TMDA และ "ต้องเคยมีประวัติการเบิกอะไหล่ (hasLogs)" เท่านั้น
    const jobs = combinedList.filter(job => {
      const brandName = job.brand?.name || job.backupDevice?.brand?.name;
      const isDeyeOrTmda = brandName === 'Deye' || brandName === 'TMDA';
      
      const validLogs = job.stockLogs
        ? job.stockLogs.filter((log: any) => log.type !== 'RETURN' && (!log.quantity || log.quantity < 0))
        : [];
      
      const hasLogs = validLogs.length > 0;
      const hasSerial = job.serialNumber || job.backupDevice?.serialNumber;
      
      return isDeyeOrTmda && hasSerial && hasLogs;
    });

    const workbook = new ExcelJS.Workbook();

    // ฟังก์ชัน getImageBuffer: อ่าน EXIF และหมุนภาพออโต้ตามจริง
    const getImageBuffer = async (imgPath: string | null, isNameplate: boolean = false): Promise<Buffer | null> => {
      if (!imgPath || imgPath === '-') return null;
      try {
        let buffer: Buffer | null = null;

        if (imgPath.startsWith('data:image/')) {
          const base64Data = imgPath.split(';base64,').pop();
          if (base64Data) {
            buffer = Buffer.from(base64Data, 'base64');
          }
        } else {
          let cleanPath = imgPath;
          if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
            const parsedUrl = new URL(cleanPath);
            cleanPath = parsedUrl.pathname;
          }

          if (cleanPath.startsWith('/')) {
            cleanPath = cleanPath.slice(1);
          }

          const localPath = path.join(process.cwd(), 'public', cleanPath);
          if (fs.existsSync(localPath)) {
            buffer = fs.readFileSync(localPath);
          } else {
            const uploadFolderXPath = path.join(process.cwd(), 'public', 'uploads', cleanPath);
            if (fs.existsSync(uploadFolderXPath)) {
              buffer = fs.readFileSync(uploadFolderXPath);
            } else {
              const rootPath = path.join(process.cwd(), cleanPath);
              if (fs.existsSync(rootPath)) {
                buffer = fs.readFileSync(rootPath);
              } else if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
                const res = await fetch(imgPath);
                if (res.ok) {
                  const arrayBuffer = await res.arrayBuffer();
                  buffer = Buffer.from(arrayBuffer);
                }
              }
            }
          }
        }

        if (buffer) {
          if (isNameplate) {
            buffer = await sharp(buffer).rotate().toBuffer();
          }
          return buffer;
        }
      } catch (err) {
        console.error('Error processing image buffer:', err);
      }
      return null;
    };

    const getProportionalSize = async (buffer: Buffer, maxWidth: number, maxHeight: number) => {
      const metadata = await sharp(buffer).metadata();
      const origWidth = metadata.width || maxWidth;
      const origHeight = metadata.height || maxHeight;
      const ratio = origWidth / origHeight;

      let width = maxWidth;
      let height = width / ratio;

      if (height > maxHeight) {
        height = maxHeight;
        width = height * ratio;
      }

      return { width: Math.round(width), height: Math.round(height) };
    };

    // ==========================================
    // 1. SHEET 1: Repair Recording
    // ==========================================
    const ws1 = workbook.addWorksheet('Repair Recording');

    ws1.mergeCells('A1:M1');
    const titleCell1 = ws1.getCell('A1');
    titleCell1.value = 'Deye After-Sales Repair Records';
    titleCell1.font = { name: 'Calibri', size: 14, bold: true };
    titleCell1.alignment = { vertical: 'middle', horizontal: 'center' };
    ws1.getRow(1).height = 30;

    const headers1 = [
      'NO.',
      'Customer abbreviation*\n客户名称',
      'Repair Date*\n维修日期',
      'Inverter ID*\n逆变器ID',
      'Inverter Model*\n逆变器型号',
      'Inverter Specification\n逆变器规格',
      'Fault Problem Description*\n故障问题描述',
      'PCBA Serial Number*\n板子编码',
      'Repair Content*\n维修内容',
      'Fault Location*\n故障位置（位号）',
      'Responsible Party*\n责任方',
      'Repair Personnel*\n维修员',
      'Remark\n备注'
    ];
    ws1.addRow(headers1);
    const headerRow1 = ws1.getRow(2);
    headerRow1.height = 35;

    for (let c = 1; c <= 13; c++) {
      const cell = headerRow1.getCell(c);
      cell.font = { name: 'Calibri', size: 10, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    }

    ws1.columns = [
      { key: 'no', width: 8 },
      { key: 'customer', width: 22 },
      { key: 'date', width: 16 },
      { key: 'inverterId', width: 20 },
      { key: 'model', width: 22 },
      { key: 'spec', width: 20 },
      { key: 'fault', width: 24 },
      { key: 'pcbaSn', width: 22 },
      { key: 'content', width: 50 },
      { key: 'location', width: 20 },
      { key: 'party', width: 16 },
      { key: 'personnel', width: 18 },
      { key: 'remark', width: 20 },
    ];

    let rowSeq1 = 1;
    for (const job of jobs) {
      const customer = job.brand?.name || job.backupDevice?.brand?.name || 'Deye';
      const repairDate = job.closedAt 
        ? new Date(job.closedAt).toLocaleDateString('en-GB') 
        : new Date(job.createdAt).toLocaleDateString('en-GB');
      
      const inverterId = job.serialNumber || job.backupDevice?.serialNumber || '-';
      const model = job.model || job.backupDevice?.model || '-';
      const productNo = job.productNo || job.backupDevice?.productNo || '-';

      const spec = '-';
      const fault = 'Not working';
      const location = (job as any).faultLocation || 'LCD';
      const party = (job as any).responsibleParty || 'TMDA';
      
      const validLogs = job.stockLogs
        ? job.stockLogs.filter((log: any) => log.type !== 'RETURN' && (!log.quantity || log.quantity < 0))
        : [];

      const technicianFromLog = validLogs.find((log: any) => log.user?.name)?.user?.name;
      const personnel = technicianFromLog || (job as any).technician || (job as any).repairPersonnel || 'Arnon';
      
      const remark = job.backupDeviceId ? 'Backup Device Repair' : '';

      const content = validLogs.map((log: any) => log.sparePart?.boardType || log.sparePart?.category || log.sparePart?.name || '-').join('/');

      const r = ws1.addRow({
        no: rowSeq1++, 
        customer, 
        date: repairDate, 
        inverterId, 
        model, 
        spec,
        fault, 
        pcbaSn: productNo, 
        content, 
        location, 
        party, 
        personnel, 
        remark,
      });
      r.height = 20;
      for (let col = 1; col <= 13; col++) {
        const cell = r.getCell(col);
        cell.font = { name: 'Calibri', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      }
    }

    const lastDataRow1 = ws1.rowCount;
    if (lastDataRow1 >= 2) {
      ws1.autoFilter = { from: { row: 2, column: 1 }, to: { row: lastDataRow1, column: 13 } };
    }

    // ==========================================
    // 2. SHEET 2: Fault Photo Recording
    // ==========================================
    const ws2 = workbook.addWorksheet('Fault Photo Recording');

    const maxLogs = Math.max(1, ...jobs.map(j => {
      const validLogs = j.stockLogs ? j.stockLogs.filter((log: any) => log.type !== 'RETURN' && (!log.quantity || log.quantity < 0)) : [];
      return validLogs.length > 0 ? validLogs.length : 1;
    }));
    const totalCols = 2 + (maxLogs * 2);

    ws2.getColumn(1).width = 8;
    ws2.getColumn(2).width = 24; 
    for (let c = 3; c <= totalCols; c++) {
      ws2.getColumn(c).width = 26; 
    }

    const headers2: string[] = ['NO.', 'Nameplate\n(铭牌)'];
    for (let i = 1; i <= maxLogs; i++) {
      headers2.push(`Fault Board ${i}\n(故障板 ${i})`);
      headers2.push('');
    }
    ws2.addRow(headers2);
    const headerRow2 = ws2.getRow(1);
    headerRow2.height = 30;

    for (let i = 0; i < maxLogs; i++) {
      const c1 = 3 + (i * 2);
      const c2 = c1 + 1;
      ws2.mergeCells(1, c1, 1, c2);
    }

    for (let c = 1; c <= totalCols; c++) {
      const cell = headerRow2.getCell(c);
      cell.font = { name: 'Calibri', size: 10, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    }

    let photoSeq = 1;
    for (const job of jobs) {
      const inverterId = job.serialNumber || job.backupDevice?.serialNumber || '-';
      const productNo = job.productNo || job.backupDevice?.productNo || '-';
      
      const imagesList = job.images || [];
      const nonBoardImages = imagesList.filter((img: any) => !img.stockLogId && img.type !== 'DUAL_IMAGE');

      const nameplatePath = 
        (job as any).imageUrl || 
        (job as any).backupDevice?.imageUrl || 
        nonBoardImages.find((img: any) => img.type === 'NAMEPLATE' || img.category === 'nameplate' || img.type === 'BACKUP' || img.type === 'SERIAL')?.url ||
        nonBoardImages[0]?.url ||
        imagesList[0]?.url || null;

      const validLogs = job.stockLogs ? job.stockLogs.filter((log: any) => log.type !== 'RETURN' && (!log.quantity || log.quantity < 0)) : [];
      const logs = validLogs.length > 0 ? validLogs : [null];

      const r1 = ws2.rowCount + 1;
      const r2 = r1 + 1;

      ws2.addRow([]);
      ws2.addRow([]);

      ws2.getRow(r1).height = 30;  
      ws2.getRow(r2).height = 140; 

      ws2.mergeCells(`A${r1}:A${r2}`);
      const cellA = ws2.getCell(`A${r1}`);
      cellA.value = photoSeq;
      cellA.alignment = { vertical: 'middle', horizontal: 'center' };
      cellA.font = { name: 'Calibri', size: 10, bold: true };

      const nameplateHeader = `Inverter ID: ${inverterId}\nPCBA SN: ${productNo}`;
      const cellB1 = ws2.getCell(r1, 2);
      cellB1.value = nameplateHeader;
      cellB1.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cellB1.font = { name: 'Calibri', size: 9, bold: true };

      if (nameplatePath) {
        const buf = await getImageBuffer(nameplatePath, true);
        if (buf) {
          // 🌟 ปรับลดขนาดลงมานิดหน่อย (maxWidth: 180, maxHeight: 125) โดยรักษาสัดส่วนเดิมไว้ และจัดตำแหน่งกึ่งกลางตามปกติ
          const proportionalSize = await getProportionalSize(buf, 180, 125);
          const imgId = workbook.addImage({ buffer: buf as any, extension: 'jpeg' });
          ws2.addImage(imgId, { 
            tl: { col: 1.1, row: (r2 - 1) + 0.05 }, 
            ext: proportionalSize 
          });
        }
      }

      for (let i = 0; i < maxLogs; i++) {
        const startCol = 3 + (i * 2);
        const col1 = startCol;
        const col2 = startCol + 1;

        const log = logs[i] || null;
        const sp = log?.sparePart as any;
        const boardSn = sp
          ? (sp.boardSerialNumber || sp.boardModelCode || sp.qrModelCode || sp.code || sp.serialNumber || '-')
          : '-';

        const fullBoardPath = log?.images?.[0]?.url || null;
        const qrBoardPath = log?.images?.[1]?.url || log?.images?.[0]?.url || null;

        const boardHeader = log ? `Inverter ID: ${inverterId}\nPCBA SN: ${boardSn}` : '-';

        ws2.mergeCells(r1, col1, r1, col2);
        const mergedHeaderCell = ws2.getCell(r1, col1);
        mergedHeaderCell.value = boardHeader;
        mergedHeaderCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        mergedHeaderCell.font = { name: 'Calibri', size: 9, bold: true };

        if (log) {
          if (fullBoardPath) {
            const buf = await getImageBuffer(fullBoardPath, false);
            if (buf) {
              const proportionalSize = await getProportionalSize(buf, 205, 135);
              const imgId = workbook.addImage({ buffer: buf as any, extension: 'jpeg' });
              ws2.addImage(imgId, { 
                tl: { col: (col1 - 1) + 0.08, row: (r2 - 1) + 0.05 }, 
                ext: proportionalSize 
              });
            }
          }
          if (qrBoardPath) {
            const buf = await getImageBuffer(qrBoardPath, false);
            if (buf) {
              const proportionalSize = await getProportionalSize(buf, 205, 135);
              const imgId = workbook.addImage({ buffer: buf as any, extension: 'jpeg' });
              ws2.addImage(imgId, { 
                tl: { col: (col2 - 1) + 0.08, row: (r2 - 1) + 0.05 }, 
                ext: proportionalSize 
              });
            }
          }
        }
      }

      for (let rowIdx = r1; rowIdx <= r2; rowIdx++) {
        for (let colIdx = 1; colIdx <= totalCols; colIdx++) {
          const cell = ws2.getCell(rowIdx, colIdx);
          cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
          
          if (rowIdx === r1 && colIdx > 1) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
          }
        }
      }

      photoSeq++;
    }

    // ==========================================
    // 3. SHEET 3: Sheet3
    // ==========================================
    const ws3 = workbook.addWorksheet('Sheet3');

    ws3.addRow(['NO.', 'Brand', 'Model', 'Content', 'SN']);

    ws3.getColumn(1).width = 8;  
    ws3.getColumn(2).width = 16; 
    ws3.getColumn(3).width = 28; 
    ws3.getColumn(4).width = 36; 
    ws3.getColumn(5).width = 22; 

    const headerRow3 = ws3.getRow(1);
    headerRow3.height = 25;
    for (let c = 1; c <= 5; c++) {
      const cell = headerRow3.getCell(c);
      cell.font = { name: 'Calibri', size: 11, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    }

    let rowSeq3 = 1;
    for (const job of jobs) {
      const brand = job.brand?.name || job.backupDevice?.brand?.name || 'Deye';
      const model = job.model || job.backupDevice?.model || '-';

      const validLogs = job.stockLogs ? job.stockLogs.filter((log: any) => log.type !== 'RETURN' && (!log.quantity || log.quantity < 0)) : [];
      const logs = validLogs.length > 0 ? validLogs : [null];
      
      const startRow = ws3.rowCount + 1;
      const endRow = startRow + logs.length - 1;

      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        const content = log?.sparePart 
          ? (log.sparePart.boardType || log.sparePart.category || log.sparePart.name || '-')
          : '-';

        const sp = log?.sparePart as any;
        const sn = sp
          ? (sp.boardSerialNumber || sp.boardModelCode || sp.qrModelCode || sp.code || sp.serialNumber || '-')
          : '-';

        const r = ws3.addRow([rowSeq3, brand, model, content, sn]);
        r.height = 20;

        for (let colIdx = 1; colIdx <= 5; colIdx++) {
          const cell = r.getCell(colIdx);
          cell.font = { name: 'Calibri', size: 10 };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        }
      }

      if (endRow > startRow) {
        ws3.mergeCells(`A${startRow}:A${endRow}`);
        ws3.mergeCells(`B${startRow}:B${endRow}`);
        ws3.mergeCells(`C${startRow}:C${endRow}`);

        ws3.getCell(`A${startRow}`).alignment = { vertical: 'middle', horizontal: 'center' };
        ws3.getCell(`B${startRow}`).alignment = { vertical: 'middle', horizontal: 'center' };
        ws3.getCell(`C${startRow}`).alignment = { vertical: 'middle', horizontal: 'center' };
      }

      rowSeq3++;
    }

    const lastDataRow3 = ws3.rowCount;
    if (lastDataRow3 >= 1) {
      ws3.autoFilter = { from: { row: 1, column: 1 }, to: { row: lastDataRow3, column: 5 } };
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="Warranty_Claim_Report_${Date.now()}.xlsx"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });

  } catch (error) {
    console.error('Export Excel Error:', error);
    return NextResponse.json({ error: 'Failed to export excel' }, { status: 500 });
  }
}