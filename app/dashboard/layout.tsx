import React from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col w-full">
      <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 w-full">
        {children}
      </main>
    </div>
  );
}