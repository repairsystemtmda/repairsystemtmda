"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface FilterLinkButtonProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  className: string;
  loadingText?: string;
}

export function FilterLinkButton({ href, label, icon, className, loadingText = "กำลังโหลด..." }: FilterLinkButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

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