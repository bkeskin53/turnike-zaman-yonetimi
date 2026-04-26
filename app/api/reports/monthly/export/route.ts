import { getSessionOrNull } from "@/src/auth/guard";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { buildMonthlyReportItems } from "@/src/services/reports/monthlyReport.service";
import { getEmployeeScopeWhereForSession } from "@/src/auth/scope";

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  if (/[\r\n",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const session = await getSessionOrNull();
  if (!session) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const month = url.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return new Response(JSON.stringify({ error: "month is required (YYYY-MM)" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const companyId = await getActiveCompanyId();
  const { policy, company } = await getCompanyBundle();
  const tz = policy.timezone || "Europe/Istanbul";

  const employeeScopeWhere = await getEmployeeScopeWhereForSession(session);
    const { items } = await buildMonthlyReportItems({
    companyId,
    tz,
    month,
    employeeWhere: employeeScopeWhere,
  });

  const header = [
    "month",
    "company",
    "employeeCode",
    "fullName",
    "presentDays",
    "absentDays",
    "offDays",
    "leaveDays",
    "missingPunchDays",
    "workedMinutes",
    "overtimeMinutes",
    "lateMinutes",
    "earlyLeaveMinutes",
    "anomalyCount",
  ];

  const lines: string[] = [];
  lines.push(header.map(csvCell).join(","));
  for (const it of items) {
    lines.push(
      [
        month,
        company?.name ?? "",
        it.employeeCode ?? "",
        it.fullName ?? "",
        it.presentDays ?? 0,
        it.absentDays ?? 0,
        it.offDays ?? 0,
        it.leaveDays ?? 0,
        it.missingPunchDays ?? 0,
        it.workedMinutes ?? 0,
        it.overtimeMinutes ?? 0,
        it.lateMinutes ?? 0,
        it.earlyLeaveMinutes ?? 0,
        it.anomalyCount ?? 0,
      ].map(csvCell).join(",")
    );
  }

  const csv = lines.join("\r\n");
  const filename = `monthly_${month}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "Cache-Control": "no-store",
    },
  });
}
