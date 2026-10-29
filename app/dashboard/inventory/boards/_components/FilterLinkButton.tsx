"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

interface FilterLinkButtonProps {
  href: string;
  label: string;
  icon?: React.ReactNode; // ปรับให้เป็นตัวเลือกเสริม (ไม่บังคับใส่)
  className: string;
  loadingText?: string;
}

export function FilterLinkButton({ href, label, icon, className, loadingText = "กำลังโหลด..." }: FilterLinkButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  // รีเซ็ตสถานะ loading ทันทีเมื่อ path หรือ searchParams เปลี่ยนแปลง (โหลดหน้าเสร็จแล้ว)
  useEffect(() => {
    setIsLoading(false);
  }, [pathname, searchParams]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsLoading(true);
    router.push(href);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`${className} cursor-pointer disabled:opacity-70`}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          {icon}
          <span>{label}</span>
        </>
      )}
    </button>
  );
}