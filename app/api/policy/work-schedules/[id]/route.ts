import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { deletePattern, updatePattern } from "@/src/services/workSchedulePattern.service";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import { getActiveCompanyId } from "@/src/services/company.service";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import { RecomputeReason } from "@prisma/client";

function mapWorkSchedulePatternError(error: unknown) {
  const msg = error instanceof Error ? error.message : "";

  if (
    msg === "ID_REQUIRED" ||
    msg === "NOT_FOUND" ||
    msg === "CODE_REQUIRED" ||
    msg === "NAME_REQUIRED" ||
    msg === "CYCLE_INVALID" ||
    msg === "REFERENCE_DATE_INVALID" ||
    msg === "DAY_SHIFT_TEMPLATE_IDS_LENGTH_MISMATCH" ||
    msg === "NON_OFF_TAIL_REMOVAL_FORBIDDEN"
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const { id } = await params;
    const body: any = await req.json().catch(() => ({}));
    const data = await updatePattern({
      id,
      ...(body?.code != null ? { code: String(body.code) } : {}),
      ...(body?.name != null ? { name: String(body.name) } : {}),
      ...(body?.cycleLengthDays != null ? { cycleLengthDays: Number(body.cycleLengthDays) } : {}),
      ...(body?.referenceDayKey != null ? { referenceDayKey: String(body.referenceDayKey) } : {}),
      ...(body?.dayShiftTemplateIds != null ? { dayShiftTemplateIds: body.dayShiftTemplateIds } : {}),
      ...(body?.isActive != null ? { isActive: Boolean(body.isActive) } : {}),
    });

    const changedKeys = body && typeof body === "object" ? Object.keys(body) : [];
    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.WORK_SCHEDULE_UPDATED,
      targetType: AuditTargetType.WORK_SCHEDULE,
      targetId: id,
      details: { op: "UPDATE", patternId: id, changedKeys },
    });

    // Recompute orchestration v1 (no guessing): pattern updates may affect many days => range unknown (null)
    const companyId = await getActiveCompanyId();
    await markRecomputeRequired({
      companyId,
      reason: RecomputeReason.WORK_SCHEDULE_UPDATED,
      createdByUserId: session.userId,
      rangeStartDayKey: null,
      rangeEndDayKey: null,
    });
    return NextResponse.json(data);
  } catch (e: any) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const mapped = mapWorkSchedulePatternError(e);
    if (mapped) return mapped;
    console.error("[work-schedules] PATCH unexpected error", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const { id } = await params;
    const data = await deletePattern({ id });

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.WORK_SCHEDULE_UPDATED,
      targetType: AuditTargetType.WORK_SCHEDULE,
      targetId: id,
      details: {
        op: "DELETE",
        patternId: data.id,
        patternCode: data.code,
        patternName: data.name,
        deletedDayCount: data.deletedDayCount,
        deletedAssignmentCount: data.deletedAssignmentCount,
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
  } catch (e: any) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = typeof e?.message === "string" ? e.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}