import { getSessionOrNull } from "@/src/auth/guard";
import { getEmployeeScopeWhereForSession } from "@/src/auth/scope";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { resolvePayrollCodeMappingProfile } from "@/src/services/puantaj/payrollCodeMappingResolver.service";
import { getMonthlyExportProfile } from "@/src/services/puantaj/exportProfiles";
import { buildDailyPuantajRows } from "@/src/services/puantaj/buildDailyPuantajRows";
import { buildPayrollCodeSummary } from "@/src/services/puantaj/buildPayrollCodeSummary";
import { buildMonthlyPuantajSummary } from "@/src/services/puantaj/buildMonthlyPuantajSummary";
import { getPayrollPeriod } from "@/src/services/puantaj/period.service";
import {
  loadMonthlySummarySnapshotRows,
  loadPayrollCodeSummarySnapshotRows,
} from "@/src/services/puantaj/snapshot.service";
import { summarizePayrollRuleDiagnostics } from "@/src/services/puantaj/payrollRuleDiagnostics";
import { logPayrollMonthlyExportCreated } from "@/src/services/puantaj/audit.service";
import { renderMonthlyPuantajSummaryCsv, renderPayrollCodeSummaryCsv } from "@/src/services/puantaj/toCsv";

function isValidMonth(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}$/.test(value);
}

async function buildLivePayrollRuleDiagnostics(args: {
  companyId: string;
  month: string;
  tz: string;
  employeeWhere: Awaited<ReturnType<typeof getEmployeeScopeWhereForSession>>;
  codeItems?: Awaited<ReturnType<typeof buildPayrollCodeSummary>>;
}) {
  const rows = await buildDailyPuantajRows({
    companyId: args.companyId,
    month: args.month,
    tz: args.tz,
    employeeWhere: args.employeeWhere,
  });

  return summarizePayrollRuleDiagnostics({
    rows,
    codeItems: args.codeItems,
  });
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
  const profileRaw = url.searchParams.get("profile");
  const mappingProfileRaw = url.searchParams.get("mappingProfile");
  if (!isValidMonth(month)) {
    return new Response(JSON.stringify({ error: "bad_month" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let profile: ReturnType<typeof getMonthlyExportProfile>;
  try {
    profile = getMonthlyExportProfile(profileRaw);
  } catch {
    return new Response(JSON.stringify({ error: "bad_profile" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const companyId = await getActiveCompanyId();
  const { policy } = await getCompanyBundle();
  const tz = policy.timezone || "Europe/Istanbul";
  const employeeScopeWhere = await getEmployeeScopeWhereForSession(session);
  const resolvedMappingProfile = await resolvePayrollCodeMappingProfile({
    companyId,
    code: mappingProfileRaw,
    autoSeedDefault: true,
  });
  const period = await getPayrollPeriod(companyId, month);
  const actorUserId = String((session as any).userId ?? (session as any).id ?? "");

  const items = await buildMonthlyPuantajSummary({
    companyId,
    month,
    tz,
    employeeWhere: employeeScopeWhere,
  });

  let csv = "";
  let fileName = "";
  let exportSource: "LIVE" | "SNAPSHOT" = "LIVE";
  let snapshotMeta: {
    snapshotId: string;
    payrollMappingProfile: string;
    monthlyExportProfile: string | null;
  } | null = null;
  let rowCount = 0;
  let payrollRuleDiagnostics: ReturnType<typeof summarizePayrollRuleDiagnostics> | null = null;

  if (period?.status === "CLOSED") {
    switch (profile) {
      case "STANDARD_MONTHLY": {
        const snapshotResult = await loadMonthlySummarySnapshotRows({
          companyId,
          month,
          employeeWhere: employeeScopeWhere,
        });
        csv = renderMonthlyPuantajSummaryCsv(snapshotResult.items);
        fileName = `puantaj-monthly-${month}.csv`;
        exportSource = "SNAPSHOT";
        rowCount = snapshotResult.items.length;
        snapshotMeta = {
          snapshotId: snapshotResult.snapshot.id,
          payrollMappingProfile: snapshotResult.snapshot.payrollMappingProfile,
          monthlyExportProfile: snapshotResult.snapshot.monthlyExportProfile,
        };
        break;
      }
      case "PAYROLL_CODE_SUMMARY": {
        const snapshotResult = await loadPayrollCodeSummarySnapshotRows({
          companyId,
          month,
          employeeWhere: employeeScopeWhere,
        });
        csv = renderPayrollCodeSummaryCsv(snapshotResult.items);
        fileName = `puantaj-payroll-code-summary-${month}.csv`;
        exportSource = "SNAPSHOT";
        rowCount = snapshotResult.items.length;
        snapshotMeta = {
          snapshotId: snapshotResult.snapshot.id,
          payrollMappingProfile: snapshotResult.snapshot.payrollMappingProfile,
          monthlyExportProfile: snapshotResult.snapshot.monthlyExportProfile,
        };
        break;
      }
    }
  } else {
    switch (profile) {
      case "STANDARD_MONTHLY": {
        csv = renderMonthlyPuantajSummaryCsv(items);
        fileName = `puantaj-monthly-${month}.csv`;
        rowCount = items.length;
        payrollRuleDiagnostics = await buildLivePayrollRuleDiagnostics({

          companyId,
          month,
          tz,
          employeeWhere: employeeScopeWhere,
        });
        break;
      }
      case "PAYROLL_CODE_SUMMARY": {
        const codeItems = await buildPayrollCodeSummary({
          companyId,
          month,
          tz,
          payrollMappingProfile: resolvedMappingProfile.code,
          employeeWhere: employeeScopeWhere,
        });
        payrollRuleDiagnostics = await buildLivePayrollRuleDiagnostics({
          companyId,
          month,
          tz,
          employeeWhere: employeeScopeWhere,
          codeItems,
        });
        csv = renderPayrollCodeSummaryCsv(codeItems);
        fileName = `puantaj-payroll-code-summary-${month}.csv`;
        rowCount = codeItems.length;
        break;
      }
    }
  }

  await logPayrollMonthlyExportCreated({
    companyId,
    month,
    actorUserId,
    exportProfile: profile,
    exportSource,
    snapshotId: snapshotMeta?.snapshotId ?? null,
    requestedPayrollMappingProfile: mappingProfileRaw,
    resolvedPayrollMappingProfile:
      snapshotMeta?.payrollMappingProfile ?? resolvedMappingProfile.code,
    resolvedPayrollMappingSource:
      exportSource === "SNAPSHOT" ? "SNAPSHOT" : resolvedMappingProfile.source,
    payrollMappingProfile:
      snapshotMeta?.payrollMappingProfile ?? resolvedMappingProfile.code,
    rowCount,
    payrollRuleEngineVersion: payrollRuleDiagnostics?.ruleEngineVersion ?? null,
    payrollRuleStats: payrollRuleDiagnostics,
    hasLegacyFallbackRows: payrollRuleDiagnostics?.hasLegacyFallbackRows ?? null,
    generatedRuleCodes: payrollRuleDiagnostics?.generatedRuleCodes ?? null,
    generatedPuantajCodes: payrollRuleDiagnostics?.generatedPuantajCodes ?? null,
  });

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
      "X-Puantaj-Export-Source": exportSource,
      ...(snapshotMeta
        ? {
            "X-Puantaj-Snapshot-Diagnostics": "UNAVAILABLE",
            "X-Puantaj-Snapshot-Id": snapshotMeta.snapshotId,
            "X-Puantaj-Snapshot-Mapping-Profile": snapshotMeta.payrollMappingProfile,
            "X-Puantaj-Snapshot-Monthly-Profile": snapshotMeta.monthlyExportProfile ?? "",
          }
        : {}),
    },
  });
}