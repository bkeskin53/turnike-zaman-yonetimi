import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import { getEmployeeScopeWhereForSession } from "@/src/auth/scope";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { buildDailyPuantajRows } from "@/src/services/puantaj/buildDailyPuantajRows";

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
  const employeeId = url.searchParams.get("employeeId");

  if (!isValidMonth(month)) {
    return NextResponse.json({ error: "BAD_MONTH" }, { status: 400 });
  }

  if (!employeeId) {
    return NextResponse.json({ error: "EMPLOYEE_ID_REQUIRED" }, { status: 400 });
  }

  const companyId = await getActiveCompanyId();
  const { policy } = await getCompanyBundle();
  const tz = policy.timezone || "Europe/Istanbul";

  const scopeWhere = await getEmployeeScopeWhereForSession(session);
  const employeeWhere = {
    AND: [scopeWhere ?? {}, { id: employeeId }],
  };

  const items = await buildDailyPuantajRows({
    companyId,
    month,
    tz,
    employeeWhere,
  });

  const employee =
    items.length > 0
      ? {
          employeeId: items[0].employeeId,
          employeeCode: items[0].employeeCode,
          fullName: items[0].fullName,
        }
      : {
          employeeId,
          employeeCode: "",
          fullName: "",
        };

  const blockedDayCount = items.filter((x) => x.puantajState === "BLOCKED").length;
  const pendingReviewDayCount = items.filter((x) => x.reviewStatus === "PENDING").length;
  const rejectedReviewDayCount = items.filter((x) => x.reviewStatus === "REJECTED").length;
  const anomalyDayCount = items.filter((x) => x.anomalies.length > 0).length;

  return NextResponse.json({
    ok: true,
    month,
    employee,
    meta: {
      tz,
      summary: {
        dayCount: items.length,
        blockedDayCount,
        pendingReviewDayCount,
        rejectedReviewDayCount,
        anomalyDayCount,
      },
    },
    items,
  });
}