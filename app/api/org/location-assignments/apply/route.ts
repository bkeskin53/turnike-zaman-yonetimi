import { NextResponse } from "next/server";
import { AuditAction, AuditTargetType, RecomputeReason, UserRole } from "@prisma/client";
import { requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import { authErrorResponse } from "@/src/auth/http";
import { getEmployeeScopeWhereForSession } from "@/src/auth/scope";
import { writeAudit } from "@/src/audit/writeAudit";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import { dayKeyToday, isISODate } from "@/src/utils/dayKey";
import { prisma } from "@/src/repositories/prisma";
import { applyBulkEmployeeLocationAssignment } from "@/src/services/employeeOrgAssignmentMutation.service";
import { resolveEmployeesForLocationAssignmentTarget } from "@/src/services/employeeLocationAssignmentQuery.service";

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
    const bundle = await getCompanyBundle();
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

    const targetBranch = await prisma.branch.findFirst({
      where: { companyId, id: targetBranchId, isActive: true },
      select: { id: true, code: true, name: true },
    });
    if (!targetBranch) {
      return NextResponse.json({ error: "BRANCH_NOT_FOUND" }, { status: 400 });
    }

    const resolved = await resolveEmployeesForLocationAssignmentTarget({
      companyId,
      targetMode,
      effectiveDayKey,
      employeeIds: Array.isArray(body?.employeeIds) ? body.employeeIds.map((item: unknown) => String(item)) : [],
      filters: body?.filters ?? null,
      scopeWhere,
      maxEmployees: 5000,
    });

    const mirrorDayKey = dayKeyToday(bundle.policy?.timezone || "Europe/Istanbul");
    const data = await applyBulkEmployeeLocationAssignment({
      companyId,
      employeeIds: resolved.items.map((item) => item.id),
      targetBranchId,
      effectiveDayKey,
      mirrorDayKey,
    });

    const recomputeRequirement =
      (data.summary.changed ?? 0) > 0
        ? await markRecomputeRequired({
            companyId,
            reason: RecomputeReason.WORKFORCE_UPDATED,
            createdByUserId: session!.userId,
            rangeStartDayKey: effectiveDayKey,
            rangeEndDayKey: null,
          })
        : null;

    await writeAudit({
      req,
      actorUserId: session!.userId,
      actorRole: session!.role as unknown as UserRole,
      action: AuditAction.WORKFORCE_UPDATED,
      targetType: AuditTargetType.WORKFORCE,
      targetId: null,
      details: {
        op: "LOCATION_ASSIGNMENT_BULK_APPLY",
        targetMode,
        effectiveDayKey,
        targetBranchId: targetBranch.id,
        targetBranchCode: targetBranch.code,
        targetBranchName: targetBranch.name,
        requestedEmployeeCount: resolved.requested,
        foundEmployeeCount: resolved.items.length,
        changedEmployeeCount: data.summary.changed,
        unchangedEmployeeCount: data.summary.unchanged,
        rejectedEmployeeCount: data.summary.rejected,
        filters: targetMode === "filter" ? body?.filters ?? null : null,
        selectedEmployeeIdsPreview:
          targetMode === "selected"
            ? (Array.isArray(body?.employeeIds) ? body.employeeIds.map((item: unknown) => String(item)).slice(0, 50) : [])
            : null,
        changedEmployeeIdsPreview: data.changedEmployeeIds.slice(0, 50),
        unchangedEmployeeIdsPreview: data.unchangedEmployeeIds.slice(0, 50),
        rejectedEmployeesPreview: data.rejectedEmployees.slice(0, 50),
        recomputeRequired: recomputeRequirement
          ? {
              id: recomputeRequirement.id,
              reason: RecomputeReason.WORKFORCE_UPDATED,
              rangeStartDayKey: recomputeRequirement.mergedStart,
              rangeEndDayKey: recomputeRequirement.mergedEnd,
              status: "PENDING",
            }
          : null,
      },
    });

    return NextResponse.json({
      ...data,
      targetMode,
      effectiveDayKey,
      targetBranch,
      recomputeRequired: recomputeRequirement
        ? {
            id: recomputeRequirement.id,
            reason: RecomputeReason.WORKFORCE_UPDATED,
            rangeStartDayKey: recomputeRequirement.mergedStart,
            rangeEndDayKey: recomputeRequirement.mergedEnd,
            status: "PENDING",
          }
        : null,
    });
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;
    const message = err instanceof Error ? err.message : "server_error";
    const status = message === "TOO_MANY_EMPLOYEES" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}