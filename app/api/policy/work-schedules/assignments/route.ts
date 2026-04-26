import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { createAssignment, listAssignments } from "@/src/services/workScheduleAssignment.service";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import { getActiveCompanyId } from "@/src/services/company.service";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import { RecomputeReason } from "@prisma/client";

export async function GET() {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR", "SUPERVISOR"]);
    const data = await listAssignments();
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
    const data = await createAssignment({
      scope: String(body?.scope ?? "") as any,
      patternId: String(body?.patternId ?? ""),
      employeeId: body?.employeeId ? String(body.employeeId) : null,
      employeeSubgroupId: body?.employeeSubgroupId ? String(body.employeeSubgroupId) : null,
      employeeGroupId: body?.employeeGroupId ? String(body.employeeGroupId) : null,
      branchId: body?.branchId ? String(body.branchId) : null,
      validFromDayKey: body?.validFromDayKey ? String(body.validFromDayKey) : null,
      validToDayKey: body?.validToDayKey ? String(body.validToDayKey) : null,
      priority: typeof body?.priority === "number" ? body.priority : undefined,
    });

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.WORK_SCHEDULE_UPDATED,
      targetType: AuditTargetType.WORK_SCHEDULE,
      targetId: (data as any)?.item?.id ?? null,
      details: {
        op: "ASSIGN",
        assignmentId: (data as any)?.item?.id ?? null,
        patternId: String(body?.patternId ?? "") || null,
        scope: body?.scope ?? null,
        employeeId: body?.employeeId ?? null,
        employeeGroupId: body?.employeeGroupId ?? null,
        employeeSubgroupId: body?.employeeSubgroupId ?? null,
        branchId: body?.branchId ?? null,
        validFromDayKey: body?.validFromDayKey ?? null,
        validToDayKey: body?.validToDayKey ?? null,
        priority: typeof body?.priority === "number" ? body.priority : null,
      },
    });

    const companyId = await getActiveCompanyId();
    const validFromDayKey = body?.validFromDayKey ? String(body.validFromDayKey) : null;
    const validToDayKey = body?.validToDayKey ? String(body.validToDayKey) : null;
    await markRecomputeRequired({
      companyId,
      reason: RecomputeReason.WORK_SCHEDULE_UPDATED,
      createdByUserId: session.userId,
      rangeStartDayKey: validFromDayKey,
      rangeEndDayKey: validToDayKey,
    });
    return NextResponse.json(data);
  } catch (e: any) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = typeof e?.message === "string" ? e.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}