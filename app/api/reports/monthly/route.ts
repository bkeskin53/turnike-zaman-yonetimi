import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { buildMonthlyReportItems } from "@/src/services/reports/monthlyReport.service";
import { getEmployeeScopeWhereForSession } from "@/src/auth/scope";

export async function GET(req: Request) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const url = new URL(req.url);
  const month = url.searchParams.get("month");

  const companyId = await getActiveCompanyId();
  const { policy } = await getCompanyBundle();
  const tz = policy.timezone || "Europe/Istanbul";

  const employeeScopeWhere = await getEmployeeScopeWhereForSession(session);
  const { items, coverage, month: normalizedMonth } = await buildMonthlyReportItems({
    companyId,
    tz,
    month,
    employeeWhere: employeeScopeWhere,
  });

  return NextResponse.json({
    ok: true,
    month: normalizedMonth,
    coverage,
    items,
  });
}
