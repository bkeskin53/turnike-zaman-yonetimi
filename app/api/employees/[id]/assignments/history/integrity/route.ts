import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { dayKeyToday } from "@/src/utils/dayKey";
import {
  inspectEmployeeOrgAssignmentIntegrity,
  isEmployeeOrgAssignmentIntegrityError,
} from "@/src/services/employees/employeeOrgAssignmentIntegrity.service";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(ROLE_SETS.READ_ALL);
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "BAD_ID" }, { status: 400 });

    const companyId = await getActiveCompanyId();
    const bundle = await getCompanyBundle();
    const timezone = bundle.policy?.timezone || "Europe/Istanbul";
    const todayDayKey = dayKeyToday(timezone);

    const item = await inspectEmployeeOrgAssignmentIntegrity({
      companyId,
      employeeId: id,
      todayDayKey,
    });

    return NextResponse.json({ item });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (isEmployeeOrgAssignmentIntegrityError(err)) {
      const status = err.code === "EMPLOYEE_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: err.code }, { status });
    }
    console.error("[api/employees/[id]/assignments/history/integrity][GET] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}