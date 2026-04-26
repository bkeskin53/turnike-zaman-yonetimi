import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import { prisma } from "@/src/repositories/prisma";

export async function requirePayrollMappingWriteSession() {
  const session = await getSessionOrNull();
  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    };
  }

  if (!["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"].includes((session as any).role)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }),
    };
  }

  return {
    ok: true as const,
    session,
  };
}

export async function resolvePayrollMappingActorUserId(
  session: any
): Promise<string | null> {
  const candidateValues = [
    session?.userId,
    session?.user?.id,
    session?.user?.userId,
    session?.id,
  ];

  for (const value of candidateValues) {
    const id = typeof value === "string" ? value.trim() : "";
    if (!id) continue;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (user?.id) {
      return user.id;
    }
  }

  return null;
}