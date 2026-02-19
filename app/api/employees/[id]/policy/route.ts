import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { getActiveCompanyId } from "@/src/services/company.service";
import { resolvePolicyRuleSetForEmployeeOnDate } from "@/src/services/policyResolver.service";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date_required" }, { status: 400 });
    }
    const companyId = await getActiveCompanyId();
    const r = await resolvePolicyRuleSetForEmployeeOnDate({
      companyId,
      employeeId: id,
      dayKey: date,
    });

    if (!r) {
      // assignment yok: DEFAULT
      return NextResponse.json({
        source: "DEFAULT",
        ruleSet: null,
      });
    }

    return NextResponse.json({
      source: r.source,
      assignmentId: r.assignmentId,
      ruleSet: {
        id: r.ruleSet.id,
        code: r.ruleSet.code,
        name: r.ruleSet.name,
      },
    });
  } catch (err) {
    return authErrorResponse(err) ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
