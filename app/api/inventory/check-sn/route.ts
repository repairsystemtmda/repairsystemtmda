import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const serialNumber = searchParams.get("serialNumber");

  if (!serialNumber) return NextResponse.json({ exists: false });

  const existing = await prisma.sparePart.findUnique({
    where: { boardSerialNumber: serialNumber },
  });

  return NextResponse.json({ exists: !!existing });
}