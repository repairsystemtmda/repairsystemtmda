'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Menu, X, Plus, Home, FileText, Cpu, HardDrive, ShieldAlert, LogOut, Wrench, Laptop, ChevronDown, Settings } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // ซ่อน Navbar ในหน้า login หรือ register
  if (pathname === '/login' || pathname === '/register') {
    return null;
  }

  // ปิดดรอปดาวน์เมื่อคลิกพื้นที่ด้านนอก
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setActionMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAdmin = session?.user?.email === 'adminTMDA@inverter.com' || (session?.user as any)?.role === 'ADMIN';

  return (
    <header className="bg-slate-900 text-white shadow-md border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex justify-between items-center">
        
        {/* โลโก้ / ชื่อระบบ และปุ่มเมนูมือถือ */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white focus:outline-none"
            aria-label="Toggle Menu"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link href="/dashboard" className="font-bold text-sm sm:text-lg flex items-center gap-1.5 hover:opacity-90 no-underline text-white whitespace-nowrap">
            🛠️ <span className="truncate max-w-[150px] sm:max-w-none">Inverter Repair</span>
          </Link>
        </div>

        {/* เมนูนำทางหลักสำหรับจอคอม (Desktop) */}
        <nav className="hidden md:flex space-x-4 text-sm items-center">
          <Link href="/dashboard" className={`hover:text-blue-400 transition no-underline text-white whitespace-nowrap ${pathname === '/dashboard' ? 'text-blue-400 font-semibold' : ''}`}>หน้าแรก</Link>
          <Link href="/dashboard/jobs" className={`hover:text-blue-400 transition no-underline text-white whitespace-nowrap ${pathname.startsWith('/dashboard/jobs') && pathname !== '/dashboard/jobs/new' ? 'text-blue-400 font-semibold' : ''}`}>ใบงานซ่อม</Link>
          <Link href="/dashboard/inventory/boards" className={`hover:text-blue-400 transition no-underline text-white whitespace-nowrap ${pathname.includes('/inventory/boards') ? 'text-blue-400 font-semibold' : ''}`}>คลังอะไหล่บอร์ด</Link>
          <Link href="/dashboard/inventory/backups" className={`hover:text-blue-400 transition no-underline text-white whitespace-nowrap ${pathname.includes('/inventory/backups') ? 'text-blue-400 font-semibold' : ''}`}>เครื่องสำรอง</Link>
          
          {isAdmin && (
            <>
              <Link href="/admin/users" className="text-amber-400 hover:text-amber-300 font-medium transition flex items-center gap-1 no-underline whitespace-nowrap">
                👑 จัดการผู้ใช้งาน
              </Link>
              <Link href="/dashboard/settings" className={`hover:text-blue-400 transition no-underline flex items-center gap-1 whitespace-nowrap ${pathname.startsWith('/dashboard/settings') ? 'text-blue-400 font-semibold' : 'text-slate-300'}`}>
                ⚙️ ตั้งค่าระบบ
              </Link>
            </>
          )}
        </nav>

        {/* ข้อมูลผู้ใช้งาน และปุ่มเปิดงานดรอปดาวน์พร้อมออกจากระบบ */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          
          {/* ปุ่มเปิดงานแบบ Dropdown */}
          <div className="relative" ref={actionMenuRef}>
            <button
              onClick={() => setActionMenuOpen(!actionMenuOpen)}
              className="bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition flex items-center gap-1.5 cursor-pointer text-white shadow-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">เปิดงานใหม่</span>
              <span className="sm:hidden">เปิดงาน</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${actionMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* เมนูดรอปดาวน์ */}
            {actionMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <Link
                  href="/dashboard/jobs/new"
                  onClick={() => setActionMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition no-underline"
                >
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <span>เปิดใบงานซ่อมแซม</span>
                </Link>

                <Link
                  href="/dashboard/inventory/backups/add"
                  onClick={() => setActionMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-amber-50 hover:text-amber-600 transition no-underline border-t border-gray-50"
                >
                  <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <span>เพิ่มเครื่องสำรองใหม่</span>
                </Link>
              </div>
            )}
          </div>

          {status === 'loading' ? (
            <div className="text-xs text-slate-400">กำลังโหลด...</div>
          ) : session ? (
            <div className="flex items-center gap-2">
              <Link 
                href="/dashboard/profile"
                className="text-xs text-slate-200 hover:text-blue-400 font-medium transition hidden sm:flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-md border border-slate-700 no-underline whitespace-nowrap"
              >
                👤 {session.user?.name || session.user?.email}
              </Link>
              
              {/* ปุ่มออกจากระบบ ( Desktop ) */}
              <button 
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer flex items-center gap-1 whitespace-nowrap"
              >
                ออก
              </button>
            </div>
          ) : (
            <Link href="/login" className="bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md text-xs font-medium transition no-underline text-white whitespace-nowrap">
              เข้าสู่ระบบ
            </Link>
          )}
        </div>
      </div>

      {/* เมนูแบบ Dropdown สำหรับมือถือ */}
      {isOpen && (
        <div className="md:hidden bg-slate-800 border-t border-slate-700 px-4 pt-2 pb-4 space-y-2 text-sm shadow-lg">
          <Link 
            href="/dashboard" 
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-slate-700 text-slate-200 no-underline"
          >
            <Home className="w-4 h-4 text-blue-400" /> หน้าแรก
          </Link>
          <Link 
            href="/dashboard/jobs" 
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-slate-700 text-slate-200 no-underline"
          >
            <FileText className="w-4 h-4 text-blue-400" /> ใบงานซ่อม
          </Link>
          <Link 
            href="/dashboard/inventory/boards" 
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-slate-700 text-slate-200 no-underline"
          >
            <Cpu className="w-4 h-4 text-blue-400" /> คลังอะไหล่บอร์ด
          </Link>
          <Link 
            href="/dashboard/inventory/backups" 
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-slate-700 text-slate-200 no-underline"
          >
            <HardDrive className="w-4 h-4 text-blue-400" /> เครื่องสำรอง
          </Link>

          {isAdmin && (
            <>
              <Link 
                href="/admin/users" 
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-slate-700 text-amber-400 font-medium no-underline"
              >
                <ShieldAlert className="w-4 h-4" /> จัดการผู้ใช้งาน
              </Link>
              <Link 
                href="/dashboard/settings" 
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-slate-700 text-blue-400 font-medium no-underline"
              >
                <Settings className="w-4 h-4" /> ตั้งค่าระบบ
              </Link>
            </>
          )}
          
          {session?.user && (
            <>
              <Link 
                href="/dashboard/profile" 
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 py-2 px-3 rounded-md bg-slate-900/50 text-slate-300 border border-slate-700 text-xs no-underline"
              >
                👤 โปรไฟล์: {session.user?.name || session.user?.email}
              </Link>
              
              <button 
                onClick={() => {
                  setIsOpen(false);
                  signOut({ callbackUrl: '/login' });
                }}
                className="w-full flex items-center gap-2 py-2 px-3 rounded-md bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white text-xs font-medium transition text-left cursor-pointer"
              >
                <LogOut className="w-4 h-4" /> ออกจากระบบ
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
}