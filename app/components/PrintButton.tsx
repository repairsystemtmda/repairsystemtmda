'use client';

interface PrintButtonProps {
  job?: {
    id: any;
    [key: string]: any;
  };
}

export default function PrintButton({ job }: PrintButtonProps) {
  const handlePrint = () => {
    if (job?.id) {
      window.open(`/jobs/${job.id}/print`, "_blank");
    } else {
      window.print();
    }
  };

  return (
    <button
      onClick={handlePrint}
      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-sm shadow transition flex items-center gap-2"
    >
      🖨️ พิมพ์ใบรับซ่อม / บันทึก PDF
    </button>
  );
}