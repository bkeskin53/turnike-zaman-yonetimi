import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/auth/http";
import { prisma } from "@/src/repositories/prisma";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { UserDataScope } from "@prisma/client";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType } from "@prisma/client";

function isValidEmail(email: string): boolean {
  const v = (email ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

async function requireSystemAdmin() {
  return await requireRole(["SYSTEM_ADMIN"]);
}

export async function GET() {
  let meUserId = "";
  try {
    const s = await requireSystemAdmin();
    meUserId = s.userId;
  } catch (err) {
    const r = authErrorResponse(err);
    if (r) return r;
    throw err;
  }

  const items = await prisma.user.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      dataScope: true,
      scopeBranchIds: true,
      scopeEmployeeGroupIds: true,
      scopeEmployeeSubgroupIds: true,
    },
  });

  return NextResponse.json({
    ok: true,
    meUserId,
    items: items.map((u) => ({ 
      id: u.id, 
      email: u.email, 
      role: u.role, 
      isActive: u.isActive, 
      createdAt: u.createdAt.toISOString(), 
      dataScope: u.dataScope,
      scopeBranchIds: u.scopeBranchIds ?? [],
      scopeEmployeeGroupIds: u.scopeEmployeeGroupIds ?? [],
      scopeEmployeeSubgroupIds: u.scopeEmployeeSubgroupIds ?? [],
    })),
  });
}
export async function POST(req: NextRequest) {
  let actor: { userId: string; role: any } | null = null;
  try {
    actor = await requireSystemAdmin();
  } catch (err) {
    const r = authErrorResponse(err);
    if (r) return r;
    throw err;
  }

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const role = String(body?.role ?? "") as UserRole;

  if (!email) return NextResponse.json({ ok: false, error: "EMAIL_REQUIRED" }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ ok: false, error: "INVALID_EMAIL" }, { status: 400 });
  if (!password) return NextResponse.json({ ok: false, error: "PASSWORD_REQUIRED" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ ok: false, error: "PASSWORD_TOO_SHORT" }, { status: 400 });
  if (!Object.values(UserRole).includes(role)) return NextResponse.json({ ok: false, error: "ROLE_REQUIRED" }, { status: 400 });

  const exists = await prisma.user.findFirst({ where: { email }, select: { id: true } });
  if (exists) return NextResponse.json({ ok: false, error: "EMAIL_TAKEN" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await prisma.user.create({
    data: { email, passwordHash, role, isActive: true },
    select: { id: true, email: true, role: true, isActive: true, createdAt: true },
  });

  await writeAudit({
    req,
    actorUserId: actor!.userId,
    actorRole: actor!.role,
    action: AuditAction.USER_CREATED,
    targetType: AuditTargetType.USER,
    targetId: created.id,
    details: { role: created.role, isActive: created.isActive },
  });

  return NextResponse.json({
    ok: true,
    item: { id: created.id, email: created.email, role: created.role, isActive: created.isActive, createdAt: created.createdAt.toISOString() },
  });
}