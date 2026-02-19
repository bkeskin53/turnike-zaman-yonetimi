import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { clearEmployeeGroupPolicyAssignments, setEmployeeGroupPolicyAssignment } from "@/src/services/policyAssignment.service";

export async function POST(req: Request) {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const body = await req.json().catch(() => null);

    const employeeGroupId = String(body?.employeeGroupId ?? "").trim();
    if (!employeeGroupId) return NextResponse.json({ error: "GROUP_ID_REQUIRED" }, { status: 400 });

    if (body?.clear === true) {
      const data = await clearEmployeeGroupPolicyAssignments({ employeeGroupId });
      return NextResponse.json(data);
    }

    const ruleSetId = String(body?.ruleSetId ?? "").trim();
    if (!ruleSetId) return NextResponse.json({ error: "RULESET_ID_REQUIRED" }, { status: 400 });

    const validFromDayKey = body?.validFromDayKey ? String(body.validFromDayKey) : null;
    const validToDayKey = body?.validToDayKey ? String(body.validToDayKey) : null;
    const priority = typeof body?.priority === "number" ? body.priority : undefined;

    const data = await setEmployeeGroupPolicyAssignment({
      employeeGroupId,
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