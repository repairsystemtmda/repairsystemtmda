"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wrench, User, Mail, Lock, ArrowRight, CheckCircle2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false); // เพิ่มตัวแปรเช็คสถานะสำเร็จ
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "เกิดข้อผิดพลาดในการสมัครสมาชิก");
      }

      // สมัครสำเร็จ เปลี่ยนสถานะเป็น true เพื่อแสดงข้อความแจ้งเตือนให้รอแอดมินอนุมัติ
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-8">
        
        {/* Header Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 text-amber-500 mb-4 border border-amber-500/20">
            <Wrench className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            สมัครสมาชิก
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            ระบบบริหารจัดการงานซ่อมอุปกรณ์โซล่าเซลล์
          </p>
        </div>

        {/* Success Alert (กรณีสมัครสำเร็จ) */}
        {success ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-emerald-400 font-bold text-lg">ลงทะเบียนสำเร็จ!</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              บัญชีของคุณถูกสร้างเรียบร้อยแล้ว <span className="text-amber-400 font-semibold">กรุณารอผู้ดูแลระบบอนุมัติบัญชี</span> ก่อนจึงจะสามารถเข้าสู่ระบบได้
            </p>
            <Link
              href="/login"
              className="inline-block w-full mt-2 py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg transition-colors text-center shadow-lg shadow-amber-500/10"
            >
              กลับสู่หน้าเข้าสู่ระบบ
            </Link>
          </div>
        ) : (
          <>
            {/* Error Alert */}
            {error && (
              <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            {/* Form Register */}
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  ชื่อ-นามสกุล
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-5 h-5" />
                  </span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ชื่อของคุณ หรือ แอดมิน"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  อีเมล
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-5 h-5" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@inverter.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-5 h-5" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg transition-colors flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/10 disabled:opacity-50"
              >
                <span>{loading ? "กำลังลงทะเบียน..." : "ลงทะเบียน"}</span>
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            {/* Link to Login */}
            <div className="text-center mt-6">
              <span className="text-slate-400 text-sm">มีบัญชีอยู่แล้ว? </span>
              <Link
                href="/login"
                className="text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors hover:underline"
              >
                เข้าสู่ระบบ
              </Link>
            </div>
          </>
        )}

      </div>
    </div>
  );
}