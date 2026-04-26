import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import {
  clearBranchPolicyRuleSet,
  listBranchesWithPolicyRuleSet,
  setBranchPolicyRuleSet,
} from "@/src/services/branchPolicyAssignment.service";

export async function GET() {
  try {
    // Read-only master data: allow Supervisor to view branch -> rule set
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR", "SUPERVISOR"]);
    const data = await listBranchesWithPolicyRuleSet();
    return NextResponse.json(data);
  } catch (err) {
    return authErrorResponse(err) ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // CONFIG write: HR_CONFIG_ADMIN must be able to update branch rule set; HR_OPERATOR must NOT
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const body = await req.json().catch(() => null);
    const branchId = String(body?.branchId ?? "").trim();
    if (!branchId) return NextResponse.json({ error: "BRANCH_ID_REQUIRED" }, { status: 400 });

    if (body?.clear === true) {
      const data = await clearBranchPolicyRuleSet({ branchId });
      return NextResponse.json(data);
    }

    const ruleSetId = String(body?.ruleSetId ?? "").trim();
    if (!ruleSetId) return NextResponse.json({ error: "RULESET_ID_REQUIRED" }, { status: 400 });

    const data = await setBranchPolicyRuleSet({ branchId, ruleSetId });
    return NextResponse.json(data);
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
