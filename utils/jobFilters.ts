import { Job } from '@/types/inventory';

/**
 * ฟังก์ชันสำหรับกรองใบงานหรือเครื่องสำรองตามโหมดการทำรายการ (WITHDRAW / RESTOCK) และคำค้นหา
 */
export function filterJobItem(job: Job, actionType: 'WITHDRAW' | 'RESTOCK', query: string): boolean {
  if (!job) return false;

  const rawStatus = (job.status || '').trim().toUpperCase();
  const customerName = (job.customerName || '').trim().toLowerCase();
  const hasWithdrawnParts = (job.withdrawnParts && job.withdrawnParts.length > 0);

  // 1. ตัดงานที่ถูกยกเลิกหรือลบทิ้งออกเสมอ
  if (rawStatus.includes('DELETED') || rawStatus.includes('CANCEL') || rawStatus.includes('CANCELED')) {
    return false;
  }

  // 2. แยกประเภทเครื่อง: เครื่องสำรอง (Backup) หรือ งานลูกค้า (Customer)
  const isBackupMachine = 
    customerName.includes('เครื่องสำรอง') || 
    customerName.includes('ในคลัง') || 
    rawStatus.includes('BACKUP');

  const isCompletedCustomerJob = 
    rawStatus.includes('COMPLETED') || 
    rawStatus.includes('SUCCESS') || 
    rawStatus.includes('CLOSED');
    
  const isAvailableBackup = 
    rawStatus === 'AVAILABLE' || 
    rawStatus.includes('พร้อมใช้');

  // ==========================================
  // กฎการกรองแยกตามประเภทการทำรายการ (WITHDRAW / RESTOCK)
  // ==========================================
  if (actionType === 'WITHDRAW') {
    if (isBackupMachine) {
      // เครื่องสำรอง: ต้องอยู่ในสถานะ "กำลังซ่อมบำรุง" เท่านั้น (ตัดเครื่องจอดว่างในคลังออก)
      const isMaintenance = 
        rawStatus.includes('MAINTENANCE') || 
        rawStatus.includes('ซ่อมบำรุง') || 
        rawStatus.includes('กำลังซ่อม');
        
      if (!isMaintenance) return false;
    } else {
      // เครื่องลูกค้า: ต้องอยู่ในสถานะกำลังซ่อม (ห้าม Completed)
      if (isCompletedCustomerJob) return false;
    }
  } else {
    // 🔄 โหมดคืนอะไหล่เข้าคลัง (RESTOCK)
    // เงื่อนไข: เครื่องลูกค้าต้อง COMPLETED หรือ เครื่องสำรองต้อง AVAILABLE
    if (isBackupMachine) {
      if (!isAvailableBackup) return false;
    } else {
      if (!isCompletedCustomerJob) return false;
    }
    
    // เงื่อนไขประวัติ: ต้องเคยมีประวัติการเบิกบอร์ดไปแล้วเท่านั้น
    if (!hasWithdrawnParts) return false;
  }

  // ==========================================
  // การค้นหาอัจฉริยะ (รองรับค้นหาจาก SN 4 ตัวท้าย)
  // ==========================================
  if (!query) return true;

  const q = query.toLowerCase();
  const model = (job.model || '').toLowerCase();
  const serialNumber = (job.serialNumber || '').toLowerCase();
  const serialNumberLast4 = (job.serialNumberLast4 || '').toLowerCase();

  return (
    customerName.includes(q) ||
    model.includes(q) ||
    serialNumber.includes(q) ||
    serialNumberLast4.includes(q)
  );
}