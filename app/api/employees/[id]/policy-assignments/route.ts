import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { listEmployeePolicyAssignments } from "@/src/services/policyAssignment.service";

// Employee 360 UI uses:
//   GET /api/employees/:id/policy-assignments
// This endpoint returns the employee's policy assignment history (audit/UI only).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);
    const { id } = await ctx.params;
    const data = await listEmployeePolicyAssignments({ employeeId: id });
    return NextResponse.json(data);
  } catch (err) {
    return authErrorResponse(err) ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
