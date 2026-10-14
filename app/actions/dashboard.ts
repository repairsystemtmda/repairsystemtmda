'use server';

import { prisma } from '@/lib/prisma';

export async function getDashboardStats() {
  const [
    totalJobs,
    pendingJobs,
    inProgressJobs,
    completedJobs,
    boards,
    recentJobs,
  ] = await Promise.all([
    prisma.repairJob.count(),
    prisma.repairJob.count({ where: { status: 'PENDING' } }),
    prisma.repairJob.count({ where: { status: { in: ['IN_PROGRESS', 'WAITING_BOARD'] } } }),
    prisma.repairJob.count({ where: { status: 'COMPLETED' } }),
    prisma.board.findMany(),
    prisma.repairJob.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // ค้นหาบอร์ดที่สต็อกน้อยกว่าหรือเท่ากับเกณฑ์ขั้นต่ำ (Low Stock)
  const lowStockBoards = boards.filter((board) => board.quantity <= board.minThreshold);

  return {
    totalJobs,
    pendingJobs,
    inProgressJobs,
    completedJobs,
    totalBoardTypes: boards.length,
    lowStockCount: lowStockBoards.length,
    lowStockBoards,
    recentJobs,
  };
}