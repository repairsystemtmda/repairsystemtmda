"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function PeriodFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPeriod = searchParams.get("period") || "all";
  const [isPending, startTransition] = useTransition();

  const handleSelectPeriod = (period: string) => {
    startTransition(() => {
      router.push(`?period=${period}`);
    });
  };

  const periods = [
    { key: "1m", label: "1 เดือน" },
    { key: "3m", label: "3 เดือน" },
    { key: "6m", label: "6 เดือน" },
    { key: "1y", label: "1 ปี" },
    { key: "all", label: "ทั้งหมด" },
  ];

  return (
    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-bold">
      {periods.map((p) => {
        const isActive = currentPeriod === p.key;
        const isLoadingThis = isActive && isPending;

        return (
          <button
            key={p.key}
            onClick={() => handleSelectPeriod(p.key)}
            disabled={isPending}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              isActive
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-gray-600 hover:text-gray-900 bg-transparent"
            } ${isPending ? "opacity-70 cursor-not-allowed" : ""}`}
          >
            {isLoadingThis && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
            <span>{p.label}</span>
          </button>
        );
      })}
    </div>
  );
}