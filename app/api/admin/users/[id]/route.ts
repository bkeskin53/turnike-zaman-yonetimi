import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull, requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/auth/http";
import { prisma } from "@/src/repositories/prisma";
import { UserRole } from "@prisma/client";
import { UserDataScope } from "@prisma/client";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType } from "@prisma/client";

async function requireSystemAdmin() {
  return await requireRole(["SYSTEM_ADMIN"]);
}

async function activeAdminCount(): Promise<number> {
  return await prisma.user.count({ where: { role: UserRole.SYSTEM_ADMIN, isActive: true } });
}

function uniqStrings(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const out: string[] = [];
  for (const v of input) {
    const s = String(v ?? "").trim();
    if (!s) continue;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  let actor: { userId: string; role: any } | null = null;
  try {
    actor = await requireSystemAdmin();
  } catch (err) {
    const r = authErrorResponse(err);
    if (r) return r;
    throw err;
  }

  const me = await getSessionOrNull();
  const meId = me?.userId ?? "";

  const params = await ctx.params;
  const id = String(params?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const patch: {
    role?: UserRole;
    isActive?: boolean;
    dataScope?: UserDataScope;
    scopeBranchIds?: string[];
    scopeEmployeeGroupIds?: string[];
    scopeEmployeeSubgroupIds?: string[];
  } = {};

  if (typeof body?.role !== "undefined") {
    const role = String(body.role) as UserRole;
    if (!Object.values(UserRole).includes(role)) return NextResponse.json({ ok: false, error: "ROLE_REQUIRED" }, { status: 400 });
    patch.role = role;
  }
  if (typeof body?.isActive !== "undefined") patch.isActive = Boolean(body.isActive);

  // Scope patch (Scope v1)
  if (typeof body?.dataScope !== "undefined") {
    const ds = String(body.dataScope) as UserDataScope;
    if (!Object.values(UserDataScope).includes(ds)) {
      return NextResponse.json({ ok: false, error: "INVALID_DATA_SCOPE" }, { status: 400 });
    }
    patch.dataScope = ds;
  }
  if (typeof body?.scopeBranchIds !== "undefined") {
    const arr = uniqStrings(body.scopeBranchIds);
    if (arr === null) return NextResponse.json({ ok: false, error: "INVALID_SCOPE_BRANCH_IDS" }, { status: 400 });
    patch.scopeBranchIds = arr.slice(0, 200);
  }
  if (typeof body?.scopeEmployeeGroupIds !== "undefined") {
    const arr = uniqStrings(body.scopeEmployeeGroupIds);
    if (arr === null) return NextResponse.json({ ok: false, error: "INVALID_SCOPE_GROUP_IDS" }, { status: 400 });
    patch.scopeEmployeeGroupIds = arr.slice(0, 200);
  }
  if (typeof body?.scopeEmployeeSubgroupIds !== "undefined") {
    const arr = uniqStrings(body.scopeEmployeeSubgroupIds);
    if (arr === null) return NextResponse.json({ ok: false, error: "INVALID_SCOPE_SUBGROUP_IDS" }, { status: 400 });
    patch.scopeEmployeeSubgroupIds = arr.slice(0, 200);
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: false, error: "NO_CHANGES" }, { status: 400 });

  const existing = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      dataScope: true,
      scopeBranchIds: true,
      scopeEmployeeGroupIds: true,
      scopeEmployeeSubgroupIds: true,
    },
  });
  if (!existing) return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });

  if (id === meId && patch.isActive === false) return NextResponse.json({ ok: false, error: "CANNOT_DISABLE_SELF" }, { status: 400 });

  const willBeActive = typeof patch.isActive === "boolean" ? patch.isActive : existing.isActive;
  const willBeRole = patch.role ?? existing.role;
  const isCurrentlyActiveAdmin = existing.role === UserRole.SYSTEM_ADMIN && existing.isActive;
  const willStopBeingActiveAdmin = isCurrentlyActiveAdmin && !(willBeRole === UserRole.SYSTEM_ADMIN && willBeActive);
  if (willStopBeingActiveAdmin) {
    const cnt = await activeAdminCount();
    if (cnt <= 1) return NextResponse.json({ ok: false, error: "MUST_KEEP_ONE_ADMIN" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: patch,
    select: { id: true, email: true, role: true, isActive: true, createdAt: true, updatedAt: true },
  });

  // --- AUDIT (v1) ---
  // role changed
  if (typeof patch.role !== "undefined" && patch.role !== existing.role) {
    await writeAudit({
      req,
      actorUserId: actor!.userId,
      actorRole: actor!.role,
      action: AuditAction.USER_ROLE_CHANGED,
      targetType: AuditTargetType.USER,
      targetId: id,
      details: { from: existing.role, to: patch.role },
    });
  }

  // status changed
  if (typeof patch.isActive !== "undefined" && patch.isActive !== existing.isActive) {
    await writeAudit({
      req,
      actorUserId: actor!.userId,
      actorRole: actor!.role,
      action: AuditAction.USER_STATUS_CHANGED,
      targetType: AuditTargetType.USER,
      targetId: id,
      details: { from: existing.isActive, to: patch.isActive },
    });
  }

  // supervisor scope changed (log if any of these arrays changed OR dataScope changed)
  const scopeTouched =
    typeof patch.dataScope !== "undefined" ||
    typeof patch.scopeBranchIds !== "undefined" ||
    typeof patch.scopeEmployeeGroupIds !== "undefined" ||
    typeof patch.scopeEmployeeSubgroupIds !== "undefined";
  if (scopeTouched) {
    await writeAudit({
      req,
      actorUserId: actor!.userId,
      actorRole: actor!.role,
      action: AuditAction.SUPERVISOR_SCOPE_UPDATED,
      targetType: AuditTargetType.USER,
      targetId: id,
      details: {
        before: {
          dataScope: existing.dataScope,
          scopeBranchIds: existing.scopeBranchIds ?? [],
          scopeEmployeeGroupIds: existing.scopeEmployeeGroupIds ?? [],
          scopeEmployeeSubgroupIds: existing.scopeEmployeeSubgroupIds ?? [],
        },
        after: {
          dataScope: typeof patch.dataScope !== "undefined" ? patch.dataScope : existing.dataScope,
          scopeBranchIds: typeof patch.scopeBranchIds !== "undefined" ? patch.scopeBranchIds : (existing.scopeBranchIds ?? []),
          scopeEmployeeGroupIds:
            typeof patch.scopeEmployeeGroupIds !== "undefined" ? patch.scopeEmployeeGroupIds : (existing.scopeEmployeeGroupIds ?? []),
          scopeEmployeeSubgroupIds:
            typeof patch.scopeEmployeeSubgroupIds !== "undefined"
              ? patch.scopeEmployeeSubgroupIds
              : (existing.scopeEmployeeSubgroupIds ?? []),
        },
      },
    });
  }

  return NextResponse.json({
    ok: true,
    item: { id: updated.id, email: updated.email, role: updated.role, isActive: updated.isActive, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() },
  });
}