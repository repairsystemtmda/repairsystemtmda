import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import PrintTrigger from '@/app/components/PrintTrigger';
import { Box, Wifi } from 'lucide-react';

interface PrintPageProps {
  params: Promise<{ id: string }>;
}

export default async function PrintJobPage({ params }: PrintPageProps) {
  const { id } = await params;

  // ดึงข้อมูลใบงานพร้อมภาพถ่ายทั่วไป ประวัติการเบิกอะไหล่ และข้อมูล User ผู้บันทึก
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      user: true, // 🌟 เพิ่มการดึงข้อมูล User เพื่อหาชื่อผู้ทำการซ่อม/รับเรื่อง
      images: true, // รูปภาพทั้งหมดของใบงาน
      stockLogs: {
        include: {
          sparePart: true, // ข้อมูลบอร์ดอะไหล่ (รหัส 14 หลัก, ชื่อบอร์ด)
          images: true,    // รูปหลักฐานคู่กับการเบิก (รูปเต็มบอร์ด, รูปซูม QR Code)
        },
      },
    },
  });

  if (!job) {
    notFound();
  }

  // คัดกรองรูปภาพ: แยกรูปทั่วไปของใบงาน ออกจากรูปที่อยู่ใน StockLog
  const stockLogImageIds = new Set(
    job.stockLogs.flatMap((log) => log.images.map((img) => img.id))
  );
  const generalImages = job.images.filter((img) => !stockLogImageIds.has(img.id));

  // ค้นหารูปเนมเพลทแบบเฉพาะเจาะจง (ถ้าไม่มีค่อยใช้รูปแรก)
  const nameplateImage = 
    generalImages.find((img) => img.type === 'NAMEPLATE' || img.type === 'nameplate')?.url || 
    generalImages?.[0]?.url || 
    null; // 1. รูปถ่ายเนมเพลทเครื่อง

  const inverterSerialNumber = job.serialNumber || '-';      // 2. S/N เครื่อง
  const inverterProductCode = job.model || '-';              // 3. รหัส Products เครื่อง
  
  // 8. ผู้ทำการซ่อม / ผู้เปิดใบงาน (ดึงจาก user.name -> user.username -> receiverName)
  const technicianName = job.user?.name || job.user?.username || job.receiverName || 'ไม่ระบุ'; 
  
  // 9. วันที่ซ่อมเสร็จ
  const repairedDate = job.closedAt 
    ? new Date(job.closedAt).toLocaleDateString('th-TH') 
    : (job.createdAt ? new Date(job.createdAt).toLocaleDateString('th-TH') : '-');

  return (
    <div className="bg-white min-h-screen text-slate-900 p-6 max-w-[210mm] mx-auto font-sans print:p-0">
      
      {/* ส่วนควบคุม (ซ่อนเวลาสั่งพิมพ์ผ่าน Printer) */}
      <div className="flex justify-between items-center mb-6 print:hidden bg-slate-50 p-4 rounded-xl border border-slate-200">
        <a
          href={`/dashboard/jobs/${job.id}`}
          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-semibold transition"
        >
          ← กลับหน้ารายละเอียดใบงาน
        </a>
        <PrintTrigger />
      </div>

      {/* 📄 เอกสารรายงานขนาด A4 */}
      <div className="space-y-6 text-xs leading-relaxed border border-slate-300 p-8 rounded-2xl print:border-none print:p-0">
        
        {/* Header เอกสาร */}
        <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-tight">ใบรายงานเบิก/เคลมอะไหล่บอร์ด</h1>
            <p className="text-xs text-slate-500">Spare Part Claim & Warranty Report</p>
          </div>
          <div className="text-right space-y-1">
            <div className="text-base font-mono font-bold text-blue-600">CLM-{job.jobNo}</div>
            <div className="text-xs text-slate-500">วันที่พิมพ์: {new Date().toLocaleDateString('th-TH')}</div>
          </div>
        </div>

        {/* [ส่วนที่ 1: ข้อมูลการซ่อมและตัวเครื่อง (Inverter Info)] */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
            [ส่วนที่ 1: ข้อมูลการซ่อมและตัวเครื่อง (Inverter Info)]
          </h2>
          
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 px-2">
            <p><strong>ผู้ทำการซ่อม (รายการ 8):</strong> {technicianName}</p>
            <p><strong>วันที่ซ่อมเสร็จ (รายการ 9):</strong> {repairedDate}</p>
            <p><strong>รหัส Products (รายการ 3):</strong> {inverterProductCode}</p>
            <p><strong>รหัส S/N เครื่อง (รายการ 2):</strong> <span className="font-mono">{inverterSerialNumber}</span></p>
            
            {/* แสดงผล S/N WiFi Dongle ถ้ามี */}
            {job.wifiDongleSn && (
              <p className="col-span-2"><strong>S/N WiFi Dongle:</strong> <span className="font-mono">{job.wifiDongleSn}</span></p>
            )}
            
            <div className="col-span-2 flex items-center gap-6 pt-1">
              {job.hasBox === true && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  📦 มีกล่องอุปกรณ์ครบ
                </span>
              )}
              {job.hasWifiDongle === true && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                  🛜 มี WiFi Dongle
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 px-2">
            <p className="font-semibold mb-1 text-slate-700">📷 รูปถ่ายเนมเพลทเครื่อง (รายการ 1):</p>
            <div className="w-full h-44 bg-slate-50 border border-slate-300 rounded-lg overflow-hidden flex items-center justify-center">
              {nameplateImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={nameplateImage} alt="Nameplate" className="object-contain h-full w-full" />
              ) : (
                <span className="text-slate-400">ไม่มีรูปถ่ายเนมเพลทเครื่อง</span>
              )}
            </div>
          </div>
        </div>

        {/* [ส่วนที่ 2: รายการบอร์ดเดิมที่เสียและขอเคลม (Defective Board Claims)] */}
        <div className="space-y-3 pt-2">
          <h2 className="text-xs font-bold uppercase tracking-wider bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
            [ส่วนที่ 2: รายการบอร์ดเดิมที่เสียและขอเคลม (Defective Board Claims)]
          </h2>

          {job.stockLogs.length === 0 ? (
            <div className="p-4 text-center text-slate-400 border border-dashed rounded-lg">
              ไม่มีรายการเปลี่ยนอะไหล่บอร์ดในใบงานนี้
            </div>
          ) : (
            job.stockLogs.map((log, idx: number) => {
              const boardName = log.sparePart?.name || '-'; // 6. ชื่อบอร์ด
              const boardModelCode = log.sparePart?.boardModelCode || log.sparePart?.code || '-'; // 7. รหัสบอร์ด 14 หลัก
              const oldBoardFullImage = log.images?.[0]?.url || null; // 4. รูปเต็มบอร์ดเดิม
              const oldBoardQrImage = log.images?.[1]?.url || log.images?.[0]?.url || null; // 5. รูปซูม QR Code

              return (
                <div key={log.id} className="border border-slate-200 p-4 rounded-xl space-y-3 page-break-inside-avoid bg-slate-50/50">
                  <p className="font-bold text-blue-700">📌 บอร์ดรายการที่ {idx + 1}</p>
                  
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 px-2">
                    <p><strong>ชื่อบอร์ด (รายการ 6):</strong> {boardName}</p>
                    <p><strong>รหัสบอร์ด 14 หลัก (รายการ 7):</strong> <span className="font-mono">{boardModelCode}</span></p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <p className="font-semibold text-slate-600 mb-1">📷 รูปถ่ายเต็มบอร์ดเดิม (รายการ 4):</p>
                      <div className="w-full h-36 bg-white border border-slate-300 rounded-lg overflow-hidden flex items-center justify-center">
                        {oldBoardFullImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={oldBoardFullImage} alt="Full Board" className="object-contain h-full w-full" />
                        ) : (
                          <span className="text-slate-400">ไม่มีรูปเต็มบอร์ด</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-600 mb-1">📷 รูปถ่ายซูม QR Code (รายการ 5):</p>
                      <div className="w-full h-36 bg-white border border-slate-300 rounded-lg overflow-hidden flex items-center justify-center">
                        {oldBoardQrImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={oldBoardQrImage} alt="QR Code Board" className="object-contain h-full w-full" />
                        ) : (
                          <span className="text-slate-400">ไม่มีรูป QR Code</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* [ส่วนที่ 3: ช่องเซ็นอนุมัติ (Sign-off Section)] */}
        <div className="space-y-4 pt-6 page-break-inside-avoid">
          <h2 className="text-xs font-bold uppercase tracking-wider bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
            [ส่วนที่ 3: ช่องเซ็นอนุมัติ (Sign-off Section)]
          </h2>

          <div className="grid grid-cols-3 gap-6 pt-8 text-center">
            <div className="space-y-8">
              <p className="font-semibold text-slate-700">ผู้แจ้งเบิก / ช่างผู้ซ่อม</p>
              <div className="border-b border-dotted border-slate-400 w-3/4 mx-auto"></div>
              <p className="text-slate-500">วันที่: _____/_____/_____</p>
            </div>
            <div className="space-y-8">
              <p className="font-semibold text-slate-700">ผู้ตรวจสอบคลังสินค้า</p>
              <div className="border-b border-dotted border-slate-400 w-3/4 mx-auto"></div>
              <p className="text-slate-500">วันที่: _____/_____/_____</p>
            </div>
            <div className="space-y-8">
              <p className="font-semibold text-slate-700">ผู้อนุมัติ / จัดซื้อ</p>
              <div className="border-b border-dotted border-slate-400 w-3/4 mx-auto"></div>
              <p className="text-slate-500">วันที่: _____/_____/_____</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}