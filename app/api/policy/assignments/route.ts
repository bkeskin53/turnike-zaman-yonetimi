import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { clearEmployeePolicyAssignments, setEmployeePolicyAssignment } from "@/src/services/policyAssignment.service";

export async function POST(req: Request) {
  try {
   await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const body = await req.json().catch(() => null);

    const employeeId = String(body?.employeeId ?? "").trim();
    if (!employeeId) return NextResponse.json({ error: "EMPLOYEE_ID_REQUIRED" }, { status: 400 });
    // clear mode
    if (body?.clear === true) {
      const data = await clearEmployeePolicyAssignments({ employeeId });
      return NextResponse.json(data);
    }

   const ruleSetId = String(body?.ruleSetId ?? "").trim();
    if (!ruleSetId) return NextResponse.json({ error: "RULESET_ID_REQUIRED" }, { status: 400 });

    const validFromDayKey = body?.validFromDayKey ? String(body.validFromDayKey) : null;
    const validToDayKey = body?.validToDayKey ? String(body.validToDayKey) : null;
    const priority = typeof body?.priority === "number" ? body.priority : undefined;

    const data = await setEmployeePolicyAssignment({
      employeeId,
      ruleSetId,
      validFromDayKey,
      validToDayKey,
      priority,
    });
    return NextResponse.json(data);
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
