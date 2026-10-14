import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const jobs = await prisma.job.findMany();
    
    // ดึง StockLog พร้อมข้อมูลอะไหล่ และข้อมูลผู้ใช้ (ช่างที่ทำการเบิก)
    const stockLogs = await prisma.stockLog.findMany({
      include: {
        sparePart: true,
        user: true, // หรือ user / technician ที่บันทึกการเบิก
      },
    });

    let totalJobs = jobs.length;
    let completedCount = 0;
    let waitingCount = 0;
    let thisMonthCompletedCount = 0;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const brandStats: { [key: string]: { completed: number; waiting: number; total: number } } = {};
    const categoryStats: { [key: string]: number } = {};
    const sparePartUsage: { [key: string]: { name: string; boardModelCode: string; count: number } } = {};
    const technicianStats: { [key: string]: { completed: number; total: number } } = {};

    // 1. วิเคราะห์ข้อมูลใบงาน (Jobs)
    jobs.forEach((job: any) => {
      const status = (job.status || '').trim().toUpperCase();
      const isCompleted = 
        status.includes('COMPLETE') || 
        status.includes('RETURN') || 
        status.includes('SWAPPED') || 
        status.includes('SUCCESS') ||
        status.includes('DONE');

      const jobBrand = job.brand || (job.model ? job.model.split(' ')[0] : 'ทั่วไป');
      const category = job.category || 'ไม่ระบุหมวดหมู่';

      if (!brandStats[jobBrand]) {
        brandStats[jobBrand] = { completed: 0, waiting: 0, total: 0 };
      }
      brandStats[jobBrand].total += 1;
      categoryStats[category] = (categoryStats[category] || 0) + 1;

      if (isCompleted) {
        completedCount += 1;
        brandStats[jobBrand].completed += 1;

        const jobDate = new Date(job.createdAt);
        if (!isNaN(jobDate.getTime()) && jobDate.getMonth() === currentMonth && jobDate.getFullYear() === currentYear) {
          thisMonthCompletedCount += 1;
        }
      } else {
        waitingCount += 1;
        brandStats[jobBrand].waiting += 1;
      }
    });

    // 2. วิเคราะห์ประวัติการเบิกอะไหล่ (StockLogs) หาบอร์ดที่ใช้บ่อย & KPI ช่างจากคนเบิก
    stockLogs.forEach((log: any) => {
      // ดึงชื่อช่างจากคนเบิกอะไหล่ (ปรับตามฟิลด์จริง เช่น log.user?.name หรือ log.technicianName)
      const techName = log.user?.name || log.technicianName || log.userName || 'ช่างทั่วไป';

      if (!technicianStats[techName]) {
        technicianStats[techName] = { completed: 0, total: 0 };
      }
      technicianStats[techName].total += 1;
      
      // ถ้ารายการเบิกนี้เป็นการซ่อมเสร็จหรือตัดสต็อกออก
      if (log.type === 'WITHDRAW' || log.change < 0) {
        technicianStats[techName].completed += 1;
      }

      // นับสถิติอะไหล่/บอร์ดที่ถูกเบิก
      if (log.sparePart) {
        const id = log.sparePartId;
        const name = log.sparePart.name;
        const boardModelCode = log.sparePart.boardModelCode || '-';

        if (!sparePartUsage[id]) {
          sparePartUsage[id] = { name, boardModelCode, count: 0 };
        }
        
        sparePartUsage[id].count += Math.abs(log.change || 1);
      }
    });

    // เรียงลำดับ 5 อันดับบอร์ดที่ถูกเบิกใช้บ่อยสุด
    const topSpareParts = Object.values(sparePartUsage)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      summary: {
        totalJobs,
        completedCount,
        waitingCount,
        thisMonthCompletedCount,
      },
      brandStats,
      categoryStats,
      topSpareParts,
      technicianStats,
    });
  } catch (error) {
    console.error('Analytics Error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}