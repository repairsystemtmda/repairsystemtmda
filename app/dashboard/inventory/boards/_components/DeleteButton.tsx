'use client';

import { Trash2 } from 'lucide-react';
import { useTransition } from 'react';

interface DeleteButtonProps {
  id: string;
  name: string;
  deleteAction: (formData: FormData) => Promise<void>;
}

export default function DeleteButton({ id, name, deleteAction }: DeleteButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={deleteAction}
      onSubmit={(e) => {
        if (!confirm(`คุณต้องการลบอะไหล่ "${name}" ใช่หรือไม่?`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium transition cursor-pointer disabled:opacity-50"
        title="ลบรายการ"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </form>
  );
}