import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import { getEmployeeScopeWhereForSession } from "@/src/auth/scope";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { buildPayrollCodeSummary } from "@/src/services/puantaj/buildPayrollCodeSummary";
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
  const mappingProfileRaw = url.searchParams.get("mappingProfile");

  if (!isValidMonth(month)) {
    return NextResponse.json({ error: "BAD_MONTH" }, { status: 400 });
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
  const items = await buildPayrollCodeSummary({
    companyId,
    month,
    tz,
    employeeWhere: employeeScopeWhere,
    payrollMappingProfile: resolvedMappingProfile.code,
  });

  const employeeCount = new Set(items.map((x) => x.employeeId)).size;
  const codeCount = new Set(items.map((x) => x.payrollCode)).size;
  const quantityTotal = items.reduce((sum, x) => sum + x.quantity, 0);
  const totalMinutes = items.reduce((sum, x) => sum + x.totalMinutes, 0);

  return NextResponse.json({
    ok: true,
    month,
    meta: {
      company: {
        id: companyId,
        name: company?.name ?? "",
      },
      projection: {
        monthlyExportProfile: "PAYROLL_CODE_SUMMARY",
        monthlyExportProfileLabel: "Payroll Code Summary",
        requestedPayrollMappingProfile: mappingProfileRaw ?? null,
        payrollMappingProfile: resolvedMappingProfile.code,
        payrollMappingSource: resolvedMappingProfile.source,
        payrollMappingActive: true,
      },
      tz,
      summary: {
        rowCount: items.length,
        employeeCount,
        codeCount,
        quantityTotal,
        totalMinutes,
      },
    },
    items,
  });
}