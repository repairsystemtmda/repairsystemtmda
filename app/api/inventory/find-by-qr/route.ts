import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const qrCode = searchParams.get("qrCode");

  if (!qrCode) return NextResponse.json({ found: false });

  const part = await prisma.sparePart.findFirst({
    where: { qrModelCode: qrCode },
  });

  if (part) {
    return NextResponse.json({ found: true, part });
  }
  return NextResponse.json({ found: false });
}