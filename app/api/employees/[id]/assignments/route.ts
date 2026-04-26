import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { dayKeyToday } from "@/src/utils/dayKey";
import {
  normalizeEmployeeAssignmentEditDraft,
  toEmployeeAssignmentEditPayload,
  validateEmployeeAssignmentEditDraft,
} from "@/src/features/employees/assignmentEditForm";
import {
  applyEmployeeOrgAssignmentAppendVersionChange,
  isEmployeeOrgAssignmentMutationError,
} from "@/src/services/employeeOrgAssignmentMutation.service";

function statusForEmployeeOrgAssignmentMutation(code: string): number {
  if (code === "EMPLOYEE_NOT_FOUND") return 404;
  if (
    code === "MULTIPLE_ACTIVE_ORG_ASSIGNMENTS_FOR_DAY" ||
    code === "NO_ACTIVE_ORG_ASSIGNMENT_FOR_DAY"
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

    const draft = normalizeEmployeeAssignmentEditDraft(rawBody);
    const validationCode = validateEmployeeAssignmentEditDraft(draft);
    if (validationCode) {
      return NextResponse.json({ error: validationCode }, { status: 400 });
    }

    const payload = toEmployeeAssignmentEditPayload(draft);
    const companyId = await getActiveCompanyId();
    const bundle = await getCompanyBundle();
    const tz = bundle.policy?.timezone || "Europe/Istanbul";

    const result = await applyEmployeeOrgAssignmentAppendVersionChange({
      companyId,
      employeeId: id,
      actorUserId: session.userId,
      effectiveDayKey: payload.scopeStartDate,
      mirrorDayKey: dayKeyToday(tz),
      payload: {
        branchId: payload.branchId,
        employeeGroupId: payload.employeeGroupId,
        employeeSubgroupId: payload.employeeSubgroupId,
      },
    });

    return NextResponse.json({ item: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (isEmployeeOrgAssignmentMutationError(err)) {
      const status = statusForEmployeeOrgAssignmentMutation(err.code);
      return NextResponse.json({ error: err.code }, { status });
    }
    console.error("[api/employees/[id]/assignments][PATCH] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
