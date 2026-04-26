import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import {
  closePayrollPeriodWithSnapshot,
} from "@/src/services/puantaj/snapshot.service";
import {
  getDailyExportProfile,
  getMonthlyExportProfile,
} from "@/src/services/puantaj/exportProfiles";
import {
  logPayrollPeriodClosed,
  logPayrollSnapshotCreated,
} from "@/src/services/puantaj/audit.service";

function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

export async function POST(req: Request) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR"].includes(session.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const body: any = await req.json().catch(() => ({}));
    const month = body?.month;
    const note =
      body?.note == null || body?.note === ""
        ? null
        : String(body.note);
    const requestedPayrollMappingProfile =
      body?.payrollMappingProfile == null || body?.payrollMappingProfile === ""
        ? null
        : String(body.payrollMappingProfile);
    const requestedDailyExportProfile = getDailyExportProfile(
      body?.dailyExportProfile == null || body?.dailyExportProfile === ""
        ? null
        : String(body.dailyExportProfile)
    );
    const requestedMonthlyExportProfile = getMonthlyExportProfile(
      body?.monthlyExportProfile == null || body?.monthlyExportProfile === ""
        ? null
        : String(body.monthlyExportProfile)
    );

    if (!isValidMonth(month)) {
      return NextResponse.json({ error: "BAD_MONTH" }, { status: 400 });
    }

    const companyId = await getActiveCompanyId();
    const { policy, company } = await getCompanyBundle();
    const tz = policy.timezone || "Europe/Istanbul";
    const actorUserId = String((session as any).userId ?? (session as any).id ?? "");

    const result = await closePayrollPeriodWithSnapshot({
      companyId,
      month,
      tz,
      actorUserId,
      note,
      payrollMappingProfile: requestedPayrollMappingProfile,
      dailyExportProfile: requestedDailyExportProfile,
      monthlyExportProfile: requestedMonthlyExportProfile,
    });

    if (result.snapshot) {
      await logPayrollSnapshotCreated({
        companyId,
        snapshotId: result.snapshot.id,
        month,
        actorUserId,
        requestedPayrollMappingProfile: result.mappingResolution.requestedProfileCode,
        resolvedPayrollMappingProfile: result.mappingResolution.resolvedProfileCode,
        resolvedPayrollMappingSource: result.mappingResolution.resolvedProfileSource,
        payrollMappingProfile: result.snapshot.payrollMappingProfile,
        dailyExportProfile: result.snapshot.dailyExportProfile,
        monthlyExportProfile: result.snapshot.monthlyExportProfile,
        employeeCount: result.snapshot.employeeCount,
        payrollReadyCount: result.snapshot.payrollReadyCount,
        blockedEmployeeCount: result.snapshot.blockedEmployeeCount,
        blockedDayCount: result.snapshot.blockedDayCount,
        reviewRequiredDayCount: result.snapshot.reviewRequiredDayCount,
        pendingReviewDayCount: result.snapshot.pendingReviewDayCount,
        rejectedReviewDayCount: result.snapshot.rejectedReviewDayCount,
        rowCounts: {
          employeeRows: result.snapshot._count.employeeRows,
          codeRows: result.snapshot._count.codeRows,
        },
        payrollRuleEngineVersion: result.payrollRuleDiagnostics.ruleEngineVersion,
        payrollRuleStats: result.payrollRuleDiagnostics,
        hasLegacyFallbackRows: result.payrollRuleDiagnostics.hasLegacyFallbackRows,
        generatedRuleCodes: result.payrollRuleDiagnostics.generatedRuleCodes,
        generatedPuantajCodes: result.payrollRuleDiagnostics.generatedPuantajCodes,
      });
    }

    await logPayrollPeriodClosed({
      companyId,
      periodId: result.period.id,
      month,
      actorUserId,
      note,
      snapshotId: result.snapshot?.id ?? null,
      readiness: {
        employeeCount: result.readiness.employeeCount,
        payrollReadyCount: result.readiness.payrollReadyCount,
        blockedEmployeeCount: result.readiness.blockedEmployeeCount,
        blockedDayCount: result.readiness.blockedDayCount,
        reviewRequiredDayCount: result.readiness.reviewRequiredDayCount,
        pendingReviewDayCount: result.readiness.pendingReviewDayCount,
        rejectedReviewDayCount: result.readiness.rejectedReviewDayCount,
        isReadyToPreClose: result.readiness.isReadyToPreClose,
        isReadyToClose: result.readiness.isReadyToClose,
        requestedPayrollMappingProfile: result.mappingResolution.requestedProfileCode,
        resolvedPayrollMappingProfile: result.mappingResolution.resolvedProfileCode,
        resolvedPayrollMappingSource: result.mappingResolution.resolvedProfileSource,
        dailyExportProfile: result.snapshot?.dailyExportProfile ?? requestedDailyExportProfile,
        monthlyExportProfile: result.snapshot?.monthlyExportProfile ?? requestedMonthlyExportProfile,
      },
    });

    return NextResponse.json({
      ok: true,
      month,
      meta: {
        company: {
          id: companyId,
          name: company?.name ?? "",
        },
        tz,
        actions: {
          canManagePeriod: true,
          canPreClose: false,
          canClose: false,
        },
      },
      period: result.period,
      readiness: result.readiness,
      snapshot: result.snapshot
        ? {
            id: result.snapshot.id,
            status: result.snapshot.status,
            payrollMappingProfile: result.snapshot.payrollMappingProfile,
            dailyExportProfile: result.snapshot.dailyExportProfile,
            monthlyExportProfile: result.snapshot.monthlyExportProfile,
            createdAt: result.snapshot.createdAt,
            createdByUser: result.snapshot.createdByUser ?? null,
            employeeCount: result.snapshot.employeeCount,
            payrollReadyCount: result.snapshot.payrollReadyCount,
            blockedEmployeeCount: result.snapshot.blockedEmployeeCount,
            blockedDayCount: result.snapshot.blockedDayCount,
            reviewRequiredDayCount: result.snapshot.reviewRequiredDayCount,
            pendingReviewDayCount: result.snapshot.pendingReviewDayCount,
            rejectedReviewDayCount: result.snapshot.rejectedReviewDayCount,
            mappingResolution: {
              requestedProfileCode: result.mappingResolution.requestedProfileCode,
              resolvedProfileCode: result.mappingResolution.resolvedProfileCode,
              resolvedProfileSource: result.mappingResolution.resolvedProfileSource,
            },
            rowCounts: {
              employeeRows: result.snapshot._count.employeeRows,
              codeRows: result.snapshot._count.codeRows,
            },
            payrollRuleDiagnostics: {
              ruleEngineVersion: result.payrollRuleDiagnostics.ruleEngineVersion,
              hasLegacyFallbackRows: result.payrollRuleDiagnostics.hasLegacyFallbackRows,
              generatedRuleCodes: result.payrollRuleDiagnostics.generatedRuleCodes,
              generatedPuantajCodes: result.payrollRuleDiagnostics.generatedPuantajCodes,
            },
          }
        : null,
    });
  } catch (error: any) {
    if (error?.message === "PERIOD_NOT_READY_TO_CLOSE") {
      return NextResponse.json(
        {
          error: "PERIOD_NOT_READY_TO_CLOSE",
          readiness: error?.readiness ?? null,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: "PERIOD_CLOSE_FAILED",
        message: error?.message ?? "UNKNOWN_ERROR",
      },
      { status: 400 }
    );
  }
}