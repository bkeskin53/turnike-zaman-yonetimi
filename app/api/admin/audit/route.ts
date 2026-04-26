import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/auth/http";
import { prisma } from "@/src/repositories/prisma";

async function requireSystemAdmin() {
  return await requireRole(["SYSTEM_ADMIN"]);
}

export async function GET(req: NextRequest) {
  try {
    await requireSystemAdmin();
  } catch (err) {
    const r = authErrorResponse(err);
    if (r) return r;
    throw err;
  }

  const url = new URL(req.url);
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? "200"), 1), 500);

  const items = await prisma.auditLog.findMany({
    take,
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      createdAt: true,
      actorUserId: true,
      actorRole: true,
      action: true,
      targetType: true,
      targetId: true,
      endpoint: true,
      method: true,
      sourceIp: true,
      userAgent: true,
      details: true,
      actor: { select: { email: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    items: items.map((x) => ({
      id: x.id,
      createdAt: x.createdAt.toISOString(),
      actorUserId: x.actorUserId,
      actorEmail: x.actor?.email ?? null,
      actorRole: x.actorRole,
      action: x.action,
      targetType: x.targetType,
      targetId: x.targetId,
      endpoint: x.endpoint,
      method: x.method,
      sourceIp: x.sourceIp,
      userAgent: x.userAgent,
      details: x.details,
    })),
  });
}