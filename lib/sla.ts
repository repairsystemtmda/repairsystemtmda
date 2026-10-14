export type SLAStatus = 'NORMAL' | 'WARNING' | 'CRITICAL';

export interface SLAResult {
  daysActive: number;
  status: SLAStatus;
  badgeColor: string;
  label: string;
}

export function calculateSLA(reportedDate: Date | string): SLAResult {
  const start = new Date(reportedDate);
  const now = new Date();
  
  const diffTime = Math.abs(now.getTime() - start.getTime());
  const daysActive = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (daysActive >= 14) {
    return {
      daysActive,
      status: 'CRITICAL',
      badgeColor: 'bg-red-100 text-red-800 border-red-300',
      label: 'Critical (14+ Days)',
    };
  }

  if (daysActive >= 7) {
    return {
      daysActive,
      status: 'WARNING',
      badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      label: 'Warning (7-13 Days)',
    };
  }

  return {
    daysActive,
    status: 'NORMAL',
    badgeColor: 'bg-green-100 text-green-800 border-green-300',
    label: 'Normal (< 7 Days)',
  };
}