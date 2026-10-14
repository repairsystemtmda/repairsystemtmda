import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import AuthSessionProvider from "@/components/AuthSessionProvider"; // เรียกใช้ผ่าน Client Component ที่เราเพิ่งสร้าง

export const metadata: Metadata = {
  title: "Inverter Repair System",
  description: "ระบบบริหารจัดการงานซ่อมอุปกรณ์โซล่าเซลล์",
};

// 🌟 เพิ่มการตั้งค่า Viewport เพื่อบังคับให้มือถือจัดขนาดพอดีหน้าจอ ไม่ยืดหรือล้น
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className="h-full">
      <body className="h-full bg-slate-950 text-slate-100 antialiased overflow-x-hidden">
        <AuthSessionProvider>
          <div className="min-h-full flex flex-col w-full">
            <Navbar />
            {/* ปรับแก้ตรงนี้: เอา max-w-7xl และ mx-auto ออก ให้เหลือ w-full */}
            <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4">
              {children}
            </main>
          </div>
        </AuthSessionProvider>
      </body>
    </html>
  );
}