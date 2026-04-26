import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import { getEmployeeScopeWhereForSession } from "@/src/auth/scope";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { getMonthlyExportProfile, getMonthlyExportProfileLabel } from "@/src/services/puantaj/exportProfiles";
import { buildMonthlyPuantajSummary } from "@/src/services/puantaj/buildMonthlyPuantajSummary";
import { resolvePayrollCodeMappingProfile } from "@/src/services/puantaj/payrollCodeMappingResolver.service";

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
  const profileRaw = url.searchParams.get("profile");
  const mappingProfileRaw = url.searchParams.get("mappingProfile");
  if (!isValidMonth(month)) {
    return NextResponse.json({ error: "BAD_MONTH" }, { status: 400 });
  }

  let exportProfile: ReturnType<typeof getMonthlyExportProfile>;
  try {
    exportProfile = getMonthlyExportProfile(profileRaw);
  } catch {
    return NextResponse.json({ error: "BAD_PROFILE" }, { status: 400 });
  }

  const companyId = await getActiveCompanyId();
  const { policy, company } = await getCompanyBundle();
  const tz = policy.timezone || "Europe/Istanbul";
  const resolvedMappingProfile = await resolvePayrollCodeMappingProfile({
    companyId,
    code: mappingProfileRaw,
    autoSeedDefault: true,
  });

  const employeeScopeWhere = await getEmployeeScopeWhereForSession(session);
  const items = await buildMonthlyPuantajSummary({
    companyId,
    month,
    tz,
    employeeWhere: employeeScopeWhere,
  });

  const payrollReadyCount = items.filter((x) => x.isPayrollReady).length;
  const blockedCount = items.length - payrollReadyCount;
  const blockedDayCount = items.reduce((sum, x) => sum + x.blockedDays, 0);
  const pendingReviewDayCount = items.reduce((sum, x) => sum + x.pendingReviewDays, 0);
  const rejectedReviewDayCount = items.reduce((sum, x) => sum + x.rejectedReviewDays, 0);
  const reviewRequiredDayCount = items.reduce((sum, x) => sum + x.reviewRequiredDays, 0);

  return NextResponse.json({
    ok: true,
    month,
    meta: {
      company: {
        id: companyId,
        name: company?.name ?? "",
      },
      projection: {
        monthlyExportProfile: exportProfile,
        monthlyExportProfileLabel: getMonthlyExportProfileLabel(exportProfile),
        requestedPayrollMappingProfile: mappingProfileRaw ?? null,
        payrollMappingProfile: resolvedMappingProfile.code,
        payrollMappingSource: resolvedMappingProfile.source,
        payrollMappingActive: exportProfile === "PAYROLL_CODE_SUMMARY",
      },
      tz,
      summary: {
        employeeCount: items.length,
        payrollReadyCount,
        blockedCount,
        blockedDayCount,
        reviewRequiredDayCount,
        pendingReviewDayCount,
        rejectedReviewDayCount,
      },
    },
    items,
  });
}