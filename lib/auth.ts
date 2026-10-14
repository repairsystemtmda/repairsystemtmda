import { NextAuthOptions } from "next-auth";
// นำเข้า Provider ที่คุณใช้งานอยู่ (เช่น CredentialsProvider) และ Prisma Client ตามปกติ

export const authOptions: NextAuthOptions = {
  providers: [
    // ... ใส่ Provider ของคุณตามเดิมตรงนี้
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    // 1. นำข้อมูล id และ role จากตอนล็อกอินมาเก็บไว้ใน JWT Token
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    // 2. ส่งต่อ id และ role จาก Token เข้ามาที่ session.user เพื่อให้หน้าเว็บนำไปใช้งานได้
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};