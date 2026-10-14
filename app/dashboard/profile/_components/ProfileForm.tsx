'use client';

import { useState } from 'react';
import { updateProfile } from '../actions';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ProfileForm({
  initialName,
  initialUsername,
  email,
}: {
  initialName: string;
  initialUsername: string;
  email: string;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const res = await updateProfile(formData);

    setLoading(false);
    setMessage({ success: res.success, text: res.message });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message && (
        <div className={`p-3 rounded-xl text-sm font-semibold flex items-center gap-2 ${message.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.success ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          {message.text}
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">อีเมล (ไม่สามารถเปลี่ยนได้)</label>
        <input
          type="email"
          value={email}
          disabled
          className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-medium text-gray-500 cursor-not-allowed"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">ชื่อ-นามสกุล</label>
        <input
          type="text"
          name="name"
          defaultValue={initialName}
          required
          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:bg-white focus:border-blue-500 outline-none transition"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">ชื่อผู้ใช้งาน (Username)</label>
        <input
          type="text"
          name="username"
          defaultValue={initialUsername}
          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:bg-white focus:border-blue-500 outline-none transition"
        />
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          บันทึกข้อมูลส่วนตัว
        </button>
      </div>
    </form>
  );
}