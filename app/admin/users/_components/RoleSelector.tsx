'use client';

import { useState } from 'react';

interface RoleSelectorProps {
  userId: string;
  currentRole: string;
  isSelf: boolean;
  updateRoleAction: (userId: string, newRole: string) => Promise<void>;
}

export default function RoleSelector({ userId, currentRole, isSelf, updateRoleAction }: RoleSelectorProps) {
  const [role, setRole] = useState(currentRole);
  const [loading, setLoading] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value;
    if (newRole === role) return;

    if (isSelf) {
      alert('ไม่สามารถเปลี่ยนสิทธิ์บัญชีของตัวเองได้');
      return;
    }

    setRole(newRole);
    setLoading(true);
    try {
      await updateRoleAction(userId, newRole);
    } catch (error) {
      console.error('Failed to update role:', error);
      setRole(currentRole);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-block">
      <select
        value={role}
        onChange={handleChange}
        disabled={loading || isSelf}
        className={`px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm outline-none transition cursor-pointer border ${
          role === 'ADMIN'
            ? 'bg-amber-600 text-white border-amber-500'
            : role === 'MANAGER'
            ? 'bg-emerald-600 text-white border-emerald-500'
            : 'bg-indigo-600 text-white border-indigo-500'
        } ${isSelf ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90'}`}
      >
        <option value="ADMIN" className="bg-white text-gray-900 font-bold">ADMIN</option>
        <option value="MANAGER" className="bg-white text-gray-900 font-bold">MANAGER</option>
        <option value="TECHNICIAN" className="bg-white text-gray-900 font-bold">TECHNICIAN</option>
      </select>
      {loading && <span className="absolute -right-6 top-1.5 text-xs text-gray-400">กำลังบันทึก...</span>}
    </div>
  );
}