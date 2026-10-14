'use client';

import { Printer } from 'lucide-react';

export default function PrintTrigger() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm"
    >
      <Printer className="w-4 h-4" />
      พิมพ์เอกสาร / บันทึก PDF (A4)
    </button>
  );
}