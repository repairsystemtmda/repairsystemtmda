export interface WithdrawnPart {
  stockLogId: string;
  sparePartId: string;
  sparePartName: string;
  sparePartCode: string | null;
  quantity: number;
  boardImageUrl?: string | null;
  qrImageUrl?: string | null;
  createdAt?: string | Date;
}

export interface Job {
  id: string;
  jobNo: string;
  customerName: string | null;
  model: string | null;
  serialNumber: string | null;
  serialNumberLast4?: string | null;
  status: string | null;
  withdrawnParts?: WithdrawnPart[];
}

export interface SparePart {
  id: string;
  code: string | null;
  boardModelCode: string | null;
  model: string | null;
  partNo?: string | null;
  sku?: string | null;
  name: string;
  location: string | null;
  stock: number;
}