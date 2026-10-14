// src/lib/backupUtils.ts

/**
 * ตรวจสอบว่าสถานะของเครื่องสำรองเป็น "พร้อมใช้งาน" หรือไม่
 */
export function isBackupAvailable(status?: string): boolean {
  const st = (status || '').trim().toUpperCase();
  return (
    st === 'AVAILABLE' ||
    st === 'READY' ||
    st.includes('พร้อมใช้งาน') ||
    (!st && true) // กรณีไม่ได้ระบุสถานะ ให้ตีเป็นพร้อมใช้งาน
  );
}

/**
 * ตรวจสอบว่าสถานะของเครื่องสำรองเป็น "ถูกยืมใช้งาน" หรือไม่
 */
export function isBackupBorrowed(status?: string): boolean {
  const st = (status || '').trim().toUpperCase();
  return (
    st === 'IN_USE' ||
    st === 'BORROWED' ||
    st.includes('ยืม') ||
    st.includes('ใช้งานอยู่')
  );
}

/**
 * ตรวจสอบว่าสถานะของเครื่องสำรองเป็น "ซ่อมบำรุง / กำลังซ่อม" หรือไม่
 */
export function isBackupInRepair(status?: string): boolean {
  const st = (status || '').trim().toUpperCase();
  return (
    st === 'MAINTENANCE' ||
    st === 'IN_REPAIR' ||
    st.includes('ซ่อมบำรุง') ||
    st.includes('กำลังซ่อม')
  );
}

/**
 * ตรวจสอบว่าสถานะของเครื่องสำรองเป็น "สลับเปลี่ยนเครื่องถาวร" หรือไม่
 */
export function isBackupSwappedPermanent(status?: string): boolean {
  const st = (status || '').trim().toUpperCase();
  return (
    st === 'SWAPPED' ||
    st === 'SWAPPED_PERMANENT' ||
    st === 'FINAL_SWAPPED_PERMANENT' ||
    st.includes('สลับเปลี่ยน') ||
    st.includes('ถาวร')
  );
}

/**
 * ฟังก์ชันจัดกลุ่มสถานะเครื่องสำรองเพื่อใช้แสดงผลป้ายสถานะ (Badge) หรือนับจำนวน
 */
export function getBackupStatusCategory(status?: string): string {
  const st = (status || '').trim().toUpperCase();

  if (isBackupBorrowed(st)) return 'BORROWED';
  if (isBackupInRepair(st)) return 'MAINTENANCE';
  if (isBackupSwappedPermanent(st)) return 'SWAPPED_PERMANENT';
  
  if (st === 'WAITING_DEYE_SEND' || st.includes('รอส่ง')) return 'WAITING_DEYE';
  if (st === 'SENT_TO_DEYE' || st.includes('ส่ง DEYE')) return 'SENT_TO_DEYE';
  if (st === 'COMPLETED_BY_DEYE' || st === 'DEYE_REPAIRED' || st.includes('DEYE ซ่อมเสร็จ')) return 'COMPLETED_BY_DEYE';

  return 'AVAILABLE'; // ค่าเริ่มต้น
}