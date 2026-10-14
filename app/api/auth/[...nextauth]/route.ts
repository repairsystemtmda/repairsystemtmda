import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

// ขยาย Type ของ NextAuth ให้รู้จัก id, username, isActive และ role เพิ่มเติม
declare module "next-auth" {
  interface User {
    id: string;
    username?: string | null;
    role?: string;
    isActive?: boolean;
  }
  interface Session {
    user: {
      id: string;
      username?: string | null;
      name?: string | null;
      email?: string | null;
      role?: string;
      isActive?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string | null;
    role?: string;
    isActive?: boolean;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("กรุณากรอกอีเมล/ชื่อผู้ใช้งานและรหัสผ่าน");
        }

        // ค้นหาผู้ใช้จากฐานข้อมูลด้วย Email หรือ Username
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: credentials.email },
              { username: credentials.email },
            ],
          },
        });

        if (!user || !user.password) {
          throw new Error("ไม่พบผู้ใช้งานนี้ในระบบ");
        }

        // ตรวจสอบรหัสผ่าน (รองรับทั้ง bcrypt และข้อความธรรมดา)
        let isPasswordValid = false;
        if (user.password.startsWith("$2b$") || user.password.startsWith("$2a$")) {
          isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          );
        } else {
          isPasswordValid = user.password === credentials.password;
        }

        if (!isPasswordValid) {
          throw new Error("รหัสผ่านไม่ถูกต้อง");
        }

        // ตรวจสอบว่าบัญชีได้รับอนุมัติหรือยัง (isActive ต้องเป็น true)
        if (!user.isActive) {
          throw new Error("บัญชีของคุณยังไม่ได้รับอนุมัติจากผู้ดูแลระบบ");
        }

        // ส่งข้อมูลผู้ใช้พร้อม CUID id, username, role และ isActive กลับไปสร้าง Session
        return {
          id: user.id,
          name: user.name || user.username || "User",
          email: user.email,
          username: user.username,
          role: user.role,
          isActive: user.isActive,
        };
      },
    }),
  ],
  callbacks: {
    // นำ id (CUID), username, role และ isActive ใส่ลงใน JWT Token
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
        token.isActive = user.isActive;
      }
      return token;
    },
    // นำข้อมูลจาก Token ส่งต่อให้ Session ฝั่ง Client/Server ใช้งาน
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = (token.id || token.sub) as string;
        session.user.username = token.username;
        session.user.role = token.role;
        session.user.isActive = token.isActive;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };