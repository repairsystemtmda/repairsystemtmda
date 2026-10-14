export const JOB_STATUSES = [
  { value: 'PENDING', label: 'รอดำเนินการ' },
  { value: 'DIAGNOSE', label: 'กำลังประเมินอาการ' },
  { value: 'WAITING_FOR_APPROVAL', label: 'รอลูกค้าอนุมัติราคา' },
  { value: 'IN_REPAIR', label: 'กำลังซ่อมบำรุง' },
  { value: 'SWAPPED_BACKUP_DEVICE', label: 'ยืมเครื่องสำรองระหว่างซ่อม' },
  { value: 'WAITING_DEYE_SEND', label: 'รอส่งศูนย์ Deye' },
  { value: 'SENT_TO_DEYE', label: 'ส่งเครื่องไป Deye แล้ว' },
  { value: 'COMPLETED_BY_DEYE', label: 'Deye ซ่อมเสร็จส่งกลับมาแล้ว' },
  { value: 'COMPLETED', label: 'ซ่อมเสร็จสิ้น (รอส่งมอบ)' },
  { value: 'RETURNED_CUSTOMER_PICKUP', label: 'ส่งมอบคืนลูกค้า (ลูกค้ารับเอง)' },
  { value: 'RETURNED_SHIPPED', label: 'ส่งมอบคืนลูกค้า (จัดส่งขนส่ง)' },
  { value: 'RETURN_BACKUP_AND_DELIVER', label: 'คืนเครื่องสำรอง + ส่งมอบเครื่องลูกค้า' },
  { value: 'SWAPPED_PERMANENT', label: 'สลับเปลี่ยนเครื่องสำรองให้ถาวร' },
  { value: 'CLAIM_NEW_MACHINE', label: 'เคลมเครื่องใหม่' },
  { value: 'CANCELLED', label: 'ยกเลิกใบงาน' },
];

export const getStatusLabel = (statusValue: string) => {
  const found = JOB_STATUSES.find((s) => s.value === statusValue);
  return found ? found.label : statusValue;
};