import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import { getActiveCompanyId } from "@/src/services/company.service";
import {
  normalizeEmployeeWorkScheduleProfileEditDraft,
  toEmployeeWorkScheduleProfileEditPayload,
  validateEmployeeWorkScheduleProfileEditDraft,
} from "@/src/features/employees/workScheduleProfileEditForm";
import {
  applyEmployeeWorkScheduleAssignmentAppendVersionChange,
  isEmployeeWorkScheduleAssignmentMutationError,
} from "@/src/services/employees/employeeWorkScheduleAssignmentMutation.service";

function statusForEmployeeWorkScheduleAssignmentMutation(code: string): number {
  if (code === "EMPLOYEE_NOT_FOUND") return 404;
  if (
    code === "MULTIPLE_ACTIVE_WORK_SCHEDULE_ASSIGNMENTS_FOR_DAY" ||
    code === "NO_ACTIVE_WORK_SCHEDULE_ASSIGNMENT_FOR_DAY"
  ) return 409;
  return 400;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(ROLE_SETS.OPS_WRITE);
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "BAD_ID" }, { status: 400 });

    const rawBody = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const draft = normalizeEmployeeWorkScheduleProfileEditDraft(rawBody);
    const validationCode = validateEmployeeWorkScheduleProfileEditDraft(draft);
    if (validationCode) {
      return NextResponse.json({ error: validationCode }, { status: 400 });
    }

    const payload = toEmployeeWorkScheduleProfileEditPayload(draft);
    const companyId = await getActiveCompanyId();

    const result = await applyEmployeeWorkScheduleAssignmentAppendVersionChange({
      companyId,
      employeeId: id,
      actorUserId: session.userId,
      patternId: payload.workSchedulePatternId,
      effectiveDayKey: payload.scopeStartDate,
    });

    return NextResponse.json({ item: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (isEmployeeWorkScheduleAssignmentMutationError(err)) {
      const status = statusForEmployeeWorkScheduleAssignmentMutation(err.code);
      return NextResponse.json({ error: err.code }, { status });
    }
    console.error("[api/employees/[id]/profile][PATCH] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
