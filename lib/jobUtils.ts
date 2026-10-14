export function isInternalOrBackupJob(job: any): boolean {
  const customerName = (job.customerName || '').toLowerCase();
  return customerName.includes('ซ่อมบำรุงในคลัง') || customerName.includes('เครื่องสำรอง');
}

export function matchJobStatus(job: any, statusFilter: string): boolean {
  const currentStatus = (job.status || '').toUpperCase();

  if (statusFilter === 'ALL') return true;

  // กรองเฉพาะสถานะรอดำเนินการแบบตรงตัวจริงๆ เท่านั้น ป้องกันสถานะส่งมอบหรือคืนเครื่องสำรองหลุดเข้ามา
  if (statusFilter === 'PENDING') {
    return (
      currentStatus === 'PENDING' ||
      currentStatus === 'WAITING_FOR_REPAIR' ||
      currentStatus === 'WAITING' ||
      currentStatus === 'NEW'
    );
  }

  if (statusFilter === 'COMPLETED') {
    return (
      currentStatus === 'COMPLETED' || 
      currentStatus === 'SUCCESS' || 
      currentStatus === 'COMPLETED_BY_DEYE'
    );
  }

  // สำหรับฟิลเตอร์อื่นๆ ให้เทียบแบบตรงตัวกับค่า status
  return currentStatus === statusFilter.toUpperCase() || currentStatus.includes(statusFilter.toUpperCase());
}