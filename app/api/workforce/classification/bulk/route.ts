import { NextResponse } from "next/server";
import { AuditAction, AuditTargetType, RecomputeReason, UserRole } from "@prisma/client";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import {
  bulkSetEmployeeClassification,
  bulkSetEmployeeClassificationByFilter,
} from "@/src/services/employeeClassification.service";
import { writeAudit } from "@/src/audit/writeAudit";
import { getActiveCompanyId } from "@/src/services/company.service";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import { getEmployeeScopeWhereForSession } from "@/src/auth/scope";

export async function POST(req: Request) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const body = await req.json().catch(() => null);
    const targetMode = body?.targetMode === "filter" ? "filter" : "selected";

    const employeeIds = Array.isArray(body?.employeeIds) ? body.employeeIds : [];
    const employeeGroupId = body?.employeeGroupId === undefined ? undefined : body.employeeGroupId;
    const employeeSubgroupId = body?.employeeSubgroupId === undefined ? undefined : body.employeeSubgroupId;
    const filters = body?.filters ?? null;

    const scopeWhere = await getEmployeeScopeWhereForSession(session);

    const data =
      targetMode === "filter"
        ? await bulkSetEmployeeClassificationByFilter({
            q: filters?.q ?? "",
            branchId: filters?.branchId ?? null,
            groupId: filters?.groupId ?? null,
            subgroupId: filters?.subgroupId ?? null,
            assignmentStatus:
              filters?.assignmentStatus === "assigned" || filters?.assignmentStatus === "unassigned"
                ? filters.assignmentStatus
                : "all",
            scopeWhere,
            employeeGroupId,
            employeeSubgroupId,
          })
        : await bulkSetEmployeeClassification({
            employeeIds,
            employeeGroupId,
            employeeSubgroupId,
          });

    if ((data.summary.updated ?? 0) > 0) {
      const companyId = await getActiveCompanyId();
      await markRecomputeRequired({
        companyId,
        reason: RecomputeReason.WORKFORCE_UPDATED,
        createdByUserId: session.userId,
        rangeStartDayKey: null,
        rangeEndDayKey: null,
      });
    }

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.WORKFORCE_UPDATED,
      targetType: AuditTargetType.WORKFORCE,
      targetId: null,
      details: {
        targetMode,
        op: "CLASSIFICATION_BULK_SET",
        requestedEmployeeCount: data.summary.requested,
        foundEmployeeCount: data.summary.found,
        updatedEmployeeCount: data.summary.updated,
        unchangedEmployeeCount: data.summary.unchanged,
        missingEmployeeCount: data.summary.missing,
        employeeGroupId: employeeGroupId ?? null,
        employeeSubgroupId: employeeSubgroupId ?? null,
        filters:
          targetMode === "filter"
            ? {
                q: filters?.q ?? "",
                branchId: filters?.branchId ?? null,
                groupId: filters?.groupId ?? null,
                subgroupId: filters?.subgroupId ?? null,
                assignmentStatus: filters?.assignmentStatus ?? "all",
              }
            : null,
        changedEmployeeIdsPreview: data.changedEmployeeIds.slice(0, 50),
        missingEmployeeIdsPreview: data.missingEmployeeIds.slice(0, 50),
      },
    });

    return NextResponse.json(data);
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}