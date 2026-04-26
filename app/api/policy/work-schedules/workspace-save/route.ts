import { NextResponse } from "next/server";
import { AuditAction, AuditTargetType, RecomputeReason, UserRole } from "@prisma/client";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { writeAudit } from "@/src/audit/writeAudit";
import { getActiveCompanyId } from "@/src/services/company.service";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import { saveWorkScheduleWorkspace } from "@/src/services/workScheduleWorkspaceSave.service";

function mapWorkspaceSaveError(error: unknown) {
  const msg = error instanceof Error ? error.message : "";

  if (
    msg === "PATTERN_ID_REQUIRED" ||
    msg === "ID_REQUIRED" ||
    msg === "NOT_FOUND" ||
    msg === "CODE_REQUIRED" ||
    msg === "NAME_REQUIRED" ||
    msg === "CYCLE_INVALID" ||
    msg === "REFERENCE_DATE_INVALID" ||
    msg === "DAY_SHIFT_TEMPLATE_IDS_LENGTH_MISMATCH" ||
    msg === "NON_OFF_TAIL_REMOVAL_FORBIDDEN" ||
    msg === "SCOPE_REQUIRED" ||
    msg === "EMPLOYEE_REQUIRED" ||
    msg === "SUBGROUP_REQUIRED" ||
    msg === "GROUP_REQUIRED" ||
    msg === "BRANCH_REQUIRED" ||
    msg === "VALID_FROM_INVALID" ||
    msg === "VALID_TO_INVALID" ||
    msg === "VALID_RANGE_INVALID" ||
    msg === "ASSIGNMENT_NOT_FOUND" ||
    msg === "ASSIGNMENT_PATTERN_MISMATCH"
  ) {
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (
    msg === "CODE_ALREADY_EXISTS" ||
    msg === "NAME_ALREADY_EXISTS" ||
    msg.includes("Unique constraint") ||
    msg.includes("P2002")
  ) {
    return NextResponse.json(
      {
        error: msg === "NAME_ALREADY_EXISTS" ? "NAME_ALREADY_EXISTS" : "CODE_ALREADY_EXISTS",
      },
      { status: 409 }
    );
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const body: any = await req.json().catch(() => ({}));

    const data = await saveWorkScheduleWorkspace({
      patternId: String(body?.patternId ?? ""),
      pattern: {
        code: String(body?.pattern?.code ?? ""),
        name: String(body?.pattern?.name ?? ""),
        cycleLengthDays: Number(body?.pattern?.cycleLengthDays ?? 0),
        referenceDayKey: String(body?.pattern?.referenceDayKey ?? ""),
        dayShiftTemplateIds: Array.isArray(body?.pattern?.dayShiftTemplateIds) ? body.pattern.dayShiftTemplateIds : [],
      },
      assignmentCreateDrafts: Array.isArray(body?.assignmentCreateDrafts) ? body.assignmentCreateDrafts : [],
      assignmentDeleteIds: Array.isArray(body?.assignmentDeleteIds) ? body.assignmentDeleteIds : [],
    });

    const targetPatternId = String((data as any)?.item?.id ?? body?.patternId ?? "").trim() || null;
    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.WORK_SCHEDULE_UPDATED,
      targetType: AuditTargetType.WORK_SCHEDULE,
      targetId: targetPatternId,
      details: {
        op: "WORKSPACE_SAVE",
        patternId: targetPatternId,
        patternChanged: Boolean((data as any)?.summary?.patternChanged),
        createdAssignmentCount: Number((data as any)?.summary?.createdAssignmentCount ?? 0),
        deletedAssignmentCount: Number((data as any)?.summary?.deletedAssignmentCount ?? 0),
      },
    });

    const companyId = await getActiveCompanyId();
    await markRecomputeRequired({
      companyId,
      reason: RecomputeReason.WORK_SCHEDULE_UPDATED,
      createdByUserId: session.userId,
      rangeStartDayKey: null,
      rangeEndDayKey: null,
    });

    return NextResponse.json(data);
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const mapped = mapWorkspaceSaveError(e);
    if (mapped) return mapped;
    console.error("[work-schedules/workspace-save] POST unexpected error", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}