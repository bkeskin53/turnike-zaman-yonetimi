import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { createPattern, listPatterns } from "@/src/services/workSchedulePattern.service";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import { getActiveCompanyId } from "@/src/services/company.service";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import { RecomputeReason } from "@prisma/client";

function mapWorkSchedulePatternError(error: unknown) {
  const msg = error instanceof Error ? error.message : "";

  if (
    msg === "CODE_REQUIRED" ||
    msg === "NAME_REQUIRED" ||
    msg === "CYCLE_INVALID" ||
    msg === "REFERENCE_DATE_INVALID" ||
    msg === "DAY_SHIFT_TEMPLATE_IDS_LENGTH_MISMATCH"
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

export async function GET() {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR", "SUPERVISOR"]);
    const data = await listPatterns();
    return NextResponse.json(data);
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = e instanceof Error ? e.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const body: any = await req.json().catch(() => ({}));
    const data = await createPattern({
      code: String(body?.code ?? ""),
      name: String(body?.name ?? ""),
      cycleLengthDays: Number(body?.cycleLengthDays ?? 0),
      referenceDayKey: String(body?.referenceDayKey ?? ""),
      dayShiftTemplateIds: Array.isArray(body?.dayShiftTemplateIds) ? body.dayShiftTemplateIds : [],
    });

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.WORK_SCHEDULE_UPDATED,
      targetType: AuditTargetType.WORK_SCHEDULE,
      targetId: (data as any)?.item?.id ?? null,
      details: { op: "CREATE", patternId: (data as any)?.item?.id ?? null },
    });

    // Recompute orchestration v1 (no guessing): pattern changes may affect many days => range unknown (null)
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
    console.error("[work-schedules] POST unexpected error", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}