import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/auth/http";
import { prisma } from "@/src/repositories/prisma";
import bcrypt from "bcryptjs";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType } from "@prisma/client";

async function requireSystemAdmin() {
  return await requireRole(["SYSTEM_ADMIN"]);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let actor: { userId: string; role: any } | null = null;
  try {
    actor = await requireSystemAdmin();
  } catch (err) {
    const r = authErrorResponse(err);
    if (r) return r;
    throw err;
  }

  const { id: rawId } = await ctx.params;
  const id = String(rawId ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const password = String(body?.password ?? "");
  if (!password) return NextResponse.json({ ok: false, error: "PASSWORD_REQUIRED" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ ok: false, error: "PASSWORD_TOO_SHORT" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });

  await writeAudit({
    req,
    actorUserId: actor!.userId,
    actorRole: actor!.role,
    action: AuditAction.USER_PASSWORD_RESET,
    targetType: AuditTargetType.USER,
    targetId: id,
    details: { note: "password reset by system admin" },
  });

  return NextResponse.json({ ok: true });
}