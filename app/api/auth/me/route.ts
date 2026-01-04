import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import { prisma } from "@/src/repositories/prisma";

export async function GET() {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ user: null });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) return NextResponse.json({ user: null });
  return NextResponse.json({ user });
}
