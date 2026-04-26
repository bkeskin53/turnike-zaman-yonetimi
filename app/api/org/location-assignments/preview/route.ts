import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import { authErrorResponse } from "@/src/auth/http";
import { getEmployeeScopeWhereForSession } from "@/src/auth/scope";
import { getActiveCompanyId } from "@/src/services/company.service";
import { isISODate } from "@/src/utils/dayKey";
import { previewBulkEmployeeLocationAssignment } from "@/src/services/employeeLocationAssignmentQuery.service";
import { prisma } from "@/src/repositories/prisma";

function normalizeTargetMode(value: unknown): "selected" | "filter" {
  return value === "filter" ? "filter" : "selected";
}

export async function POST(req: Request) {
  let session: { userId: string; role: any } | null = null;
  try {
    session = await requireRole(ROLE_SETS.CONFIG_WRITE);
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;
    throw err;
  }

  try {
    const companyId = await getActiveCompanyId();
    const scopeWhere = session ? await getEmployeeScopeWhereForSession(session) : null;
    const body = await req.json().catch(() => null);

    const targetMode = normalizeTargetMode(body?.targetMode);
    const effectiveDayKey = String(body?.effectiveDayKey ?? "").trim();
    const targetBranchId = String(body?.targetBranchId ?? "").trim();

    if (!isISODate(effectiveDayKey)) {
      return NextResponse.json({ error: "EFFECTIVE_DAY_KEY_REQUIRED" }, { status: 400 });
    }
    if (!targetBranchId) {
      return NextResponse.json({ error: "TARGET_BRANCH_REQUIRED" }, { status: 400 });
    }

    const branch = await prisma.branch.findFirst({
      where: { companyId, id: targetBranchId, isActive: true },
      select: { id: true, code: true, name: true },
    });
    if (!branch) {
      return NextResponse.json({ error: "BRANCH_NOT_FOUND" }, { status: 400 });
    }

    const data = await previewBulkEmployeeLocationAssignment({
      companyId,
      targetMode,
      effectiveDayKey,
      targetBranchId,
      employeeIds: Array.isArray(body?.employeeIds) ? body.employeeIds.map((item: unknown) => String(item)) : [],
      filters: body?.filters ?? null,
      scopeWhere,
      maxEmployees: 5000,
    });

    return NextResponse.json({
      ...data,
      targetMode,
      effectiveDayKey,
      targetBranch: branch,
    });
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;
    const message = err instanceof Error ? err.message : "server_error";
    const status = message === "TOO_MANY_EMPLOYEES" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}