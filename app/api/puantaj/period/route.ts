import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import { getEmployeeScopeWhereForSession } from "@/src/auth/scope";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import {
  evaluatePayrollPeriodReadiness,
  getOrCreatePayrollPeriod,
} from "@/src/services/puantaj/period.service";
import { getLatestPayrollPeriodSnapshot } from "@/src/services/puantaj/snapshot.service";

function isValidMonth(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}$/.test(value);
}

export async function GET(req: Request) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const url = new URL(req.url);
  const month = url.searchParams.get("month");
  if (!isValidMonth(month)) {
    return NextResponse.json({ error: "BAD_MONTH" }, { status: 400 });
  }

  const companyId = await getActiveCompanyId();
  const { policy, company } = await getCompanyBundle();
  const tz = policy.timezone || "Europe/Istanbul";

  const employeeScopeWhere = await getEmployeeScopeWhereForSession(session);

  const [period, readiness, latestSnapshot] = await Promise.all([
    getOrCreatePayrollPeriod(companyId, month),
    evaluatePayrollPeriodReadiness({
      companyId,
      month,
      tz,
      employeeWhere: employeeScopeWhere,
    }),
    getLatestPayrollPeriodSnapshot({
      companyId,
      month,
    }),
  ]);

  const canManagePeriod = ["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR"].includes(session.role);
  const canPreClose = canManagePeriod && period.status !== "CLOSED";
  const canClose = canManagePeriod && period.status !== "CLOSED" && readiness.isReadyToClose;

  return NextResponse.json({
    ok: true,
    month,
    meta: {
      company: {
        id: companyId,
        name: company?.name ?? "",
      },
      tz,
      scope: {
        isScoped: session.role === "SUPERVISOR",
      },
      actions: {
        canManagePeriod,
        canPreClose,
        canClose,
      },
    },
    period,
    readiness,
    snapshot:
      period.status === "CLOSED" && latestSnapshot
        ? {
            id: latestSnapshot.id,
            status: latestSnapshot.status,
            payrollMappingProfile: latestSnapshot.payrollMappingProfile,
            dailyExportProfile: latestSnapshot.dailyExportProfile,
            monthlyExportProfile: latestSnapshot.monthlyExportProfile,
            createdAt: latestSnapshot.createdAt,
            createdByUser: latestSnapshot.createdByUser ?? null,
            employeeCount: latestSnapshot.employeeCount,
            payrollReadyCount: latestSnapshot.payrollReadyCount,
            blockedEmployeeCount: latestSnapshot.blockedEmployeeCount,
            blockedDayCount: latestSnapshot.blockedDayCount,
            reviewRequiredDayCount: latestSnapshot.reviewRequiredDayCount,
            pendingReviewDayCount: latestSnapshot.pendingReviewDayCount,
            rejectedReviewDayCount: latestSnapshot.rejectedReviewDayCount,
            rowCounts: {
              employeeRows: latestSnapshot._count.employeeRows,
              codeRows: latestSnapshot._count.codeRows,
            },
          }
        : null,
  });
}