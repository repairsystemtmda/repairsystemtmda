import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // ถ้าพยายามเข้าหน้าจัดการผู้ใช้งาน (/dashboard/users) แต่ไม่ใช่ ADMIN ให้ดีดกลับไปหน้า Dashboard
    if (path.startsWith("/dashboard/users") && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token, // บังคับว่าต้องล็อกอินถึงจะเข้าถึงเส้นทาง /dashboard ทั้งหมดได้
    },
  }
);

// กำหนดเส้นทางที่ต้องการให้ Middleware ตรวจสอบสิทธิ์
export const config = {
  matcher: ["/dashboard/:path*"],
};