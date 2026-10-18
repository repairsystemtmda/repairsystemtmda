'use client';

import { useState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface JobActionButtonProps {
  children: React.ReactNode;
  loadingText?: string;
  className?: string;
  disabled?: boolean;
}

// 🌟 ปุ่ม Submit สำหรับ Form (แสดง Loader2 + ปิดปุ่มอัตโนมัติเมื่อกดส่ง Form)
export function JobSubmitButton({
  children,
  loadingText = 'กำลังบันทึก...',
  className = '',
  disabled = false,
}: JobActionButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`${className} ${pending || disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
    >
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

// 🌟 ปุ่ม Link Navigation สำหรับลิงก์ไปยังหน้าอื่น (เช่น เบิกอะไหล่)
export function JobLinkButton({
  href,
  children,
  loadingText = 'กำลังดำเนินการ...',
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  loadingText?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // รีเซ็ตสถานะ loading ทันทีเมื่อ URL หรือ Query เปลี่ยนแปลง (เช่น กดยกเลิกปิด Modal)
  useEffect(() => {
    setLoading(false);
  }, [pathname, searchParams]);

  return (
    <Link
      href={href}
      onClick={() => setLoading(true)}
      className={`${className} ${loading ? 'opacity-70 pointer-events-none' : ''}`}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </Link>
  );
}