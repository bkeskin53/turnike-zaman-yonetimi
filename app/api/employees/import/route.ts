import { NextRequest, NextResponse } from "next/server";
import { RecomputeReason, UserRole } from "@prisma/client";
import { authErrorResponse } from "@/src/auth/http";
import {
  EmployeeImportSheetKind,
  getEmployeeImportReferenceSheet,
  getEmployeeImportSheet,
  listEmployeeImportableSheetTitles,
} from "@/src/features/employees/importTemplate";
import { getCompanyBundle } from "@/src/services/company.service";
import { resolveEmployeeImportCodes } from "@/src/services/employees/employeeImportCodeResolver.service";
import { applyEmployeeFullImport } from "@/src/services/employees/employeeFullImportMutation.service";
import { applyEmployeePersonalImport } from "@/src/services/employees/employeePersonalImportMutation.service";
import { applyEmployeeOrgImport } from "@/src/services/employees/employeeOrgImportMutation.service";
import { applyEmployeeWorkScheduleImport } from "@/src/services/employees/employeeWorkScheduleImportMutation.service";
import {
  buildEmployeeImportDuplicateWarning,
  completeEmployeeImportDryRun,
  completeEmployeeImportApplyRun,
  failEmployeeImportDryRun,
  failEmployeeImportApplyRun,
  inspectEmployeeImportContent,
  isEmployeeImportApplyLockError,
  releaseEmployeeImportApplyLock,
  startEmployeeImportDryRun,
  startEmployeeImportApplyRun,
} from "@/src/services/employees/employeeImportRun.service";
import {
  isEmployeeImportVisibilityScopeError,
  requireEmployeeImportAccess,
} from "@/src/services/employees/employeeImportVisibility.service";
import {
  EmployeeImportValidationIssue,
  validateEmployeeImportTable,
} from "@/src/services/employees/importTemplateValidation.service";
import { buildEmployeeImportIssueSummary } from "@/src/services/employees/employeeImportIssueTaxonomy.service";
import { buildEmployeeImportResultReadinessSummary } from "@/src/services/employees/employeeImportReadiness.service";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import { dayKeyToday } from "@/src/utils/dayKey";

const ALL_SHEET_KINDS: EmployeeImportSheetKind[] = [
  "ALL_FIELDS",
  "FULL_DATA",
  "PERSONAL_DATA",
  "ORG_DATA",
  "WORK_DATA",
];

function parseSheetKind(raw: unknown): EmployeeImportSheetKind {
  const value = String(raw ?? "FULL_DATA").trim().toUpperCase();
  if (ALL_SHEET_KINDS.includes(value as EmployeeImportSheetKind)) {
    return value as EmployeeImportSheetKind;
  }
  return "FULL_DATA";
}

function dryRunMessage(sheetKind: EmployeeImportSheetKind): string {
  if (sheetKind === "FULL_DATA") {
    return "Dogrulama tamamlandi. Tam toplu aktarim kosusu kaydedildi; satir kontrolleri ve kod cozumleme ozeti gecmisten incelenebilir.";
  }
  if (sheetKind === "PERSONAL_DATA") {
    return "Dogrulama tamamlandi. Kisisel veriler tabina ait satir kontrolleri ve preview sonuclari kaydedildi.";
  }
  if (sheetKind === "ORG_DATA") {
    return "Dogrulama tamamlandi. Organizasyon verileri tabina ait satir kontrolleri ve kod cozumleme ozeti kaydedildi.";
  }
  if (sheetKind === "WORK_DATA") {
    return "Dogrulama tamamlandi. Calisma verileri tabina ait satir kontrolleri ve pattern cozumleme ozeti kaydedildi.";
  }
  return "Dogrulama tamamlandi. Baslik sozlesmesi, satir kontrolleri ve cozumleme sonucu bu kosu icin kaydedildi.";
}

function validationBlockedMessage(sheetKind: EmployeeImportSheetKind): string {
  if (sheetKind === "FULL_DATA") {
    return "Dogrulama temiz degil. Hatalari duzeltip yeniden dogrulamadan tam toplu aktarim baslatilamaz.";
  }
  if (sheetKind === "PERSONAL_DATA") {
    return "Dogrulama temiz degil. Hatalari duzeltip yeniden dogrulamadan kisisel veri aktarimi baslatilamaz.";
  }
  if (sheetKind === "ORG_DATA") {
    return "Dogrulama temiz degil. Hatalari duzeltip yeniden dogrulamadan organizasyon verileri aktarimi baslatilamaz.";
  }
  return "Dogrulama temiz degil. Hatalari duzeltip yeniden dogrulamadan calisma verileri aktarimi baslatilamaz.";
}

function applyCompletedMessage(sheetKind: EmployeeImportSheetKind): string {
  if (sheetKind === "FULL_DATA") {
    return "Tam toplu aktarim tamamlandi. Sonuc ozeti, benzer icerik uyarilari ve run kaydi import gecmisinde izlenebilir.";
  }
  if (sheetKind === "PERSONAL_DATA") {
    return "Kisisel veri aktarimi tamamlandi. Sonuc ozeti ve run kaydi import gecmisinde izlenebilir.";
  }
  if (sheetKind === "ORG_DATA") {
    return "Organizasyon verileri aktarimi tamamlandi. Sonuc ozeti, recompute durumu ve run kaydi import gecmisinde izlenebilir.";
  }
  return "Calisma verileri aktarimi tamamlandi. Sonuc ozeti, recompute durumu ve run kaydi import gecmisinde izlenebilir.";
}

function issue(line: number, code: string, message: string): EmployeeImportValidationIssue {
  return { line, code, message };
}

type ImportRunRef = {
  id: string;
  mode: "DRY_RUN" | "APPLY";
  status: string;
  outcome: string | null;
  duplicateOfRunId: string | null;
};

function buildImportRunRef(args: {
  mode: "DRY_RUN" | "APPLY";
  runRecord: {
    id: string;
    status: string;
    outcome: string | null;
    duplicateOfRunId: string | null;
  };
}): ImportRunRef {
  return {
    id: args.runRecord.id,
    mode: args.mode,
    status: args.runRecord.status,
    outcome: args.runRecord.outcome,
    duplicateOfRunId: args.runRecord.duplicateOfRunId ?? null,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const csvText = String(body?.csvText ?? "");
  const dryRun = body?.dryRun === true;
  const sheetKind = parseSheetKind(body?.sheetKind);
  const sheet = getEmployeeImportSheet(sheetKind);

  let session: Awaited<ReturnType<typeof requireEmployeeImportAccess>>["session"];
  let scope: Awaited<ReturnType<typeof requireEmployeeImportAccess>>["scope"];
  try {
    ({ session, scope } = await requireEmployeeImportAccess(dryRun ? "VALIDATE" : "APPLY"));
  } catch (err) {
    const r = authErrorResponse(err);
    if (r) return r;
    if (isEmployeeImportVisibilityScopeError(err)) {
      return NextResponse.json(
        { ok: false, error: err.code, message: err.message },
        { status: 403 },
      );
    }
    throw err;
  }

  const companyId = scope.companyId;

  if (!sheet.importable) {
    const referenceSheet = getEmployeeImportReferenceSheet();
    const importableSheets = listEmployeeImportableSheetTitles().join(", ");
    return NextResponse.json(
      {
        ok: false,
        error: "REFERENCE_SHEET_NOT_IMPORTABLE",
        message:
          `${referenceSheet.title} (${referenceSheet.sheetName}) referans tabidir. Ice aktarma icin ${importableSheets} sekmelerinden birini kullan.`,
      },
      { status: 400 },
    );
  }

  if (!csvText.trim()) {
    return NextResponse.json(
      {
        ok: false,
        error: "CSV_TEXT_REQUIRED",
        message: "Ice aktarim metni bos olamaz.",
      },
      { status: 400 },
    );
  }

  const base = validateEmployeeImportTable({ csvText, sheetKind });
  const shouldResolveCodes =
    sheetKind === "FULL_DATA" || sheetKind === "ORG_DATA" || sheetKind === "WORK_DATA";
  const resolution = shouldResolveCodes
    ? await resolveEmployeeImportCodes({
        companyId,
        sheetKind,
        rows: base.validRows,
      })
    : {
        errors: [],
        warnings: [],
        summary: undefined,
      };

  const resolutionInvalidLines = new Set<number>();
  for (const item of resolution.errors) {
    if (item.line > 1) resolutionInvalidLines.add(item.line);
  }

  const mergedErrors = [...base.errors, ...resolution.errors];
  const mergedWarnings = [...base.warnings, ...resolution.warnings];
  const validCount = Math.max(0, base.totals.valid - resolutionInvalidLines.size);
  const invalidCount = base.totals.invalid + resolutionInvalidLines.size;
  const validRowsAfterResolution = shouldResolveCodes
    ? base.validRows.filter((row) => !resolutionInvalidLines.has(row.line))
    : base.validRows;
  const { validRows: ignoredValidRows, ...publicBase } = base;
  void ignoredValidRows;
  const applyEnabled =
    (sheetKind === "FULL_DATA" ||
      sheetKind === "PERSONAL_DATA" ||
      sheetKind === "ORG_DATA" ||
      sheetKind === "WORK_DATA") &&
    mergedErrors.length === 0 &&
    validRowsAfterResolution.length > 0;
  const duplicateInspection =
    validRowsAfterResolution.length > 0
      ? await inspectEmployeeImportContent({
          companyId,
          sheetKind,
          csvText,
        })
      : null;
  const duplicateWarnings = duplicateInspection?.duplicateRun
    ? [
        buildEmployeeImportDuplicateWarning({
          sheetKind,
          duplicateRunId: duplicateInspection.duplicateRun.id,
        }),
      ]
    : [];

  if (dryRun) {
    const finalWarnings = [...mergedWarnings, ...duplicateWarnings];
    const issueSummary = buildEmployeeImportIssueSummary({
      errors: mergedErrors,
      warnings: finalWarnings,
    });
    let dryRunRunContext:
      | {
          runId: string;
          duplicateOfRunId: string | null;
        }
      | null = null;

    try {
      dryRunRunContext = await startEmployeeImportDryRun({
        companyId,
        sheetKind,
        sheetTitle: sheet.title,
        csvText,
        actorUserId: session.userId,
        requestedCount: base.totals.rows,
        contentHash: duplicateInspection?.contentHash,
        duplicateRun: duplicateInspection?.duplicateRun ?? null,
      });

      const runRecord = await completeEmployeeImportDryRun({
        runId: dryRunRunContext.runId,
        requestedCount: base.totals.rows,
        processedCount: validCount,
        rejectedCount: invalidCount,
        headerSummarySnapshot: base.headerSummary,
        codeResolutionSnapshot: resolution.summary,
        warnings: finalWarnings,
        errors: mergedErrors,
      });

      return NextResponse.json({
        ...publicBase,
        ok: mergedErrors.length === 0,
        applyEnabled,
        canProceedToNextPhase: mergedErrors.length === 0,
        totals: {
          ...base.totals,
          valid: validCount,
          invalid: invalidCount,
        },
        errors: mergedErrors,
        warnings: finalWarnings,
        issueSummary,
        readinessSummary: buildEmployeeImportResultReadinessSummary({
          sheetKind,
          actionableRowCount: validCount,
          invalidRowCount: invalidCount,
          issueSummary,
          headerSummary: base.headerSummary,
          codeResolutionSummary: resolution.summary,
        }),
        ...(resolution.summary ? { codeResolutionSummary: resolution.summary } : {}),
        runRef: buildImportRunRef({
          mode: "DRY_RUN",
          runRecord,
        }),
        message: dryRunMessage(sheetKind),
      });
    } catch (error) {
      if (dryRunRunContext) {
        const failedMessage = error instanceof Error ? error.message : "Import dry-run tamamlanamadi.";
        await failEmployeeImportDryRun({
          runId: dryRunRunContext.runId,
          requestedCount: base.totals.rows,
          processedCount: validCount,
          rejectedCount: invalidCount,
          failedCode: "EMPLOYEE_IMPORT_DRY_RUN_FAILED",
          failedMessage,
          headerSummarySnapshot: base.headerSummary,
          codeResolutionSnapshot: resolution.summary,
          warnings: finalWarnings,
          errors: [...mergedErrors, issue(1, "EMPLOYEE_IMPORT_DRY_RUN_FAILED", failedMessage)],
        }).catch(() => null);
      }

      throw error;
    }
  }

  if (mergedErrors.length > 0) {
    const issueSummary = buildEmployeeImportIssueSummary({
      errors: mergedErrors,
      warnings: mergedWarnings,
    });
    return NextResponse.json(
      {
        ...publicBase,
        ok: false,
        dryRun: false,
        applyEnabled: false,
        canProceedToNextPhase: false,
        totals: {
          ...base.totals,
          valid: validCount,
          invalid: invalidCount,
        },
        errors: mergedErrors,
        warnings: mergedWarnings,
        issueSummary,
        readinessSummary: buildEmployeeImportResultReadinessSummary({
          sheetKind,
          actionableRowCount: validCount,
          invalidRowCount: invalidCount,
          issueSummary,
          headerSummary: base.headerSummary,
          codeResolutionSummary: resolution.summary,
        }),
        message: validationBlockedMessage(sheetKind),
      },
      { status: 409 },
    );
  }

  const { policy } = await getCompanyBundle();
  const todayKey = dayKeyToday(policy.timezone || "Europe/Istanbul");
  let applyRunContext:
    | {
        runId: string;
        duplicateOfRunId: string | null;
      }
    | null = null;

  try {
    applyRunContext = await startEmployeeImportApplyRun({
      companyId,
      sheetKind,
      sheetTitle: sheet.title,
      csvText,
      actorUserId: session.userId,
      requestedCount: validRowsAfterResolution.length,
      contentHash: duplicateInspection?.contentHash,
      duplicateRun: duplicateInspection?.duplicateRun ?? null,
    });
  } catch (error) {
    if (isEmployeeImportApplyLockError(error)) {
      return NextResponse.json(
        {
          ...publicBase,
          ok: false,
          dryRun: false,
          applyEnabled: false,
          canProceedToNextPhase: false,
          totals: {
            ...base.totals,
            valid: validCount,
            invalid: invalidCount,
          },
          errors: [
            issue(
              1,
              error.code,
              error.message,
            ),
          ],
          warnings: [...mergedWarnings, ...duplicateWarnings],
          issueSummary: buildEmployeeImportIssueSummary({
            errors: [
              issue(
                1,
                error.code,
                error.message,
              ),
            ],
            warnings: [...mergedWarnings, ...duplicateWarnings],
          }),
          message: error.message,
        },
        { status: 409 },
      );
    }

    throw error;
  }

  try {
    if (sheetKind === "FULL_DATA") {
      const applyResult = await applyEmployeeFullImport({
        companyId,
        actorUserId: session.userId,
        actorRole: session.role as unknown as UserRole,
        todayKey,
        timezone: policy.timezone || "Europe/Istanbul",
        req,
        rows: validRowsAfterResolution,
      });

      const recomputeQueued =
        Boolean(applyResult.recomputeStartDayKey) && applyResult.summary.changed > 0
          ? await markRecomputeRequired({
              companyId,
              reason: RecomputeReason.WORKFORCE_UPDATED,
              createdByUserId: session.userId,
              rangeStartDayKey: applyResult.recomputeStartDayKey!,
              rangeEndDayKey: applyResult.recomputeEndDayKey ?? null,
            }).then(() => true)
          : false;

      const finalErrors = [...applyResult.errors];
      const finalWarnings = [...mergedWarnings, ...duplicateWarnings, ...applyResult.warnings];
      const finalSummary = {
        kind: "FULL_DATA" as const,
        ...applyResult.summary,
        recomputeQueued,
      };

      const runRecord = await completeEmployeeImportApplyRun({
        runId: applyRunContext.runId,
        summary: finalSummary,
        processedCount: validRowsAfterResolution.length,
        headerSummarySnapshot: base.headerSummary,
        codeResolutionSnapshot: resolution.summary,
        changedEmployeeCodesPreview: applyResult.changedEmployeeCodesPreview,
        warnings: finalWarnings,
        errors: finalErrors,
      });

      return NextResponse.json({
        ...publicBase,
        ok: finalErrors.length === 0,
        dryRun: false,
        applyEnabled: false,
        canProceedToNextPhase: finalErrors.length === 0,
        totals: {
          ...base.totals,
          valid: validRowsAfterResolution.length,
          invalid: invalidCount + applyResult.summary.rejected,
        },
        errors: finalErrors,
        warnings: finalWarnings,
        issueSummary: buildEmployeeImportIssueSummary({
          errors: finalErrors,
          warnings: finalWarnings,
        }),
        applySummary: finalSummary,
        runRef: buildImportRunRef({
          mode: "APPLY",
          runRecord,
        }),
      changedEmployeeCodesPreview: applyResult.changedEmployeeCodesPreview,
      message: applyCompletedMessage("FULL_DATA"),
      });
    }

    if (sheetKind === "PERSONAL_DATA") {
      const applyResult = await applyEmployeePersonalImport({
        companyId,
        actorUserId: session.userId,
        actorRole: session.role as unknown as UserRole,
        todayKey,
        req,
        rows: validRowsAfterResolution,
      });

      const finalErrors = [...applyResult.errors];
      const finalWarnings = [...mergedWarnings, ...duplicateWarnings, ...applyResult.warnings];
      const finalSummary = {
        kind: "PERSONAL_DATA" as const,
        ...applyResult.summary,
      };

      const runRecord = await completeEmployeeImportApplyRun({
        runId: applyRunContext.runId,
        summary: finalSummary,
        processedCount: validRowsAfterResolution.length,
        headerSummarySnapshot: base.headerSummary,
        codeResolutionSnapshot: resolution.summary,
        changedEmployeeCodesPreview: applyResult.changedEmployeeCodesPreview,
        warnings: finalWarnings,
        errors: finalErrors,
      });

      return NextResponse.json({
        ...publicBase,
        ok: finalErrors.length === 0,
        dryRun: false,
        applyEnabled: false,
        canProceedToNextPhase: finalErrors.length === 0,
        totals: {
          ...base.totals,
          valid: validRowsAfterResolution.length,
          invalid: invalidCount + applyResult.summary.rejected,
        },
        errors: finalErrors,
        warnings: finalWarnings,
        issueSummary: buildEmployeeImportIssueSummary({
          errors: finalErrors,
          warnings: finalWarnings,
        }),
        applySummary: finalSummary,
        runRef: buildImportRunRef({
          mode: "APPLY",
          runRecord,
        }),
        changedEmployeeCodesPreview: applyResult.changedEmployeeCodesPreview,
        message: applyCompletedMessage("PERSONAL_DATA"),
      });
    }

    if (sheetKind === "WORK_DATA") {
      const applyResult = await applyEmployeeWorkScheduleImport({
        companyId,
        actorUserId: session.userId,
        actorRole: session.role as unknown as UserRole,
        req,
        rows: validRowsAfterResolution,
      });

      const recomputeQueued =
        Boolean(applyResult.recomputeStartDayKey) && applyResult.summary.changed > 0
          ? await markRecomputeRequired({
              companyId,
              reason: RecomputeReason.WORKFORCE_UPDATED,
              createdByUserId: session.userId,
              rangeStartDayKey: applyResult.recomputeStartDayKey!,
              rangeEndDayKey: applyResult.recomputeEndDayKey ?? null,
            }).then(() => true)
          : false;

      const finalErrors = [...applyResult.errors];
      const finalWarnings = [...mergedWarnings, ...duplicateWarnings, ...applyResult.warnings];
      const finalSummary = {
        kind: "WORK_DATA" as const,
        ...applyResult.summary,
        recomputeQueued,
      };

      const runRecord = await completeEmployeeImportApplyRun({
        runId: applyRunContext.runId,
        summary: finalSummary,
        processedCount: validRowsAfterResolution.length,
        headerSummarySnapshot: base.headerSummary,
        codeResolutionSnapshot: resolution.summary,
        changedEmployeeCodesPreview: applyResult.changedEmployeeCodesPreview,
        warnings: finalWarnings,
        errors: finalErrors,
      });

      return NextResponse.json({
        ...publicBase,
        ok: finalErrors.length === 0,
        dryRun: false,
        applyEnabled: false,
        canProceedToNextPhase: finalErrors.length === 0,
        totals: {
          ...base.totals,
          valid: validRowsAfterResolution.length,
          invalid: invalidCount + applyResult.summary.rejected,
        },
        errors: finalErrors,
        warnings: finalWarnings,
        issueSummary: buildEmployeeImportIssueSummary({
          errors: finalErrors,
          warnings: finalWarnings,
        }),
        applySummary: finalSummary,
        runRef: buildImportRunRef({
          mode: "APPLY",
          runRecord,
        }),
        changedEmployeeCodesPreview: applyResult.changedEmployeeCodesPreview,
        message: applyCompletedMessage("WORK_DATA"),
      });
    }

    const applyResult = await applyEmployeeOrgImport({
      companyId,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      todayKey,
      req,
      rows: validRowsAfterResolution,
    });

    const recomputeQueued =
      Boolean(applyResult.recomputeStartDayKey) && applyResult.summary.changed > 0
        ? await markRecomputeRequired({
            companyId,
            reason: RecomputeReason.WORKFORCE_UPDATED,
            createdByUserId: session.userId,
            rangeStartDayKey: applyResult.recomputeStartDayKey!,
            rangeEndDayKey: applyResult.recomputeEndDayKey ?? null,
          }).then(() => true)
        : false;

    const finalErrors = [...applyResult.errors];
    const finalWarnings = [...mergedWarnings, ...duplicateWarnings, ...applyResult.warnings];
    const finalSummary = {
      kind: "ORG_DATA" as const,
      ...applyResult.summary,
      recomputeQueued,
    };

    const runRecord = await completeEmployeeImportApplyRun({
      runId: applyRunContext.runId,
      summary: finalSummary,
      processedCount: validRowsAfterResolution.length,
      headerSummarySnapshot: base.headerSummary,
      codeResolutionSnapshot: resolution.summary,
      changedEmployeeCodesPreview: applyResult.changedEmployeeCodesPreview,
      warnings: finalWarnings,
      errors: finalErrors,
    });

    return NextResponse.json({
      ...publicBase,
      ok: finalErrors.length === 0,
      dryRun: false,
      applyEnabled: false,
      canProceedToNextPhase: finalErrors.length === 0,
      totals: {
        ...base.totals,
        valid: validRowsAfterResolution.length,
        invalid: invalidCount + applyResult.summary.rejected,
      },
      errors: finalErrors,
      warnings: finalWarnings,
      issueSummary: buildEmployeeImportIssueSummary({
        errors: finalErrors,
        warnings: finalWarnings,
      }),
      applySummary: finalSummary,
      runRef: buildImportRunRef({
        mode: "APPLY",
        runRecord,
      }),
      changedEmployeeCodesPreview: applyResult.changedEmployeeCodesPreview,
      message: applyCompletedMessage("ORG_DATA"),
    });
  } catch (error) {
    if (applyRunContext) {
      const failedMessage = error instanceof Error ? error.message : "Import apply tamamlanamadi.";
      const runRecord = await failEmployeeImportApplyRun({
        runId: applyRunContext.runId,
        failedCode: "EMPLOYEE_IMPORT_APPLY_FAILED",
        failedMessage,
        processedCount: validRowsAfterResolution.length,
        headerSummarySnapshot: base.headerSummary,
        codeResolutionSnapshot: resolution.summary,
        warnings: [...mergedWarnings, ...duplicateWarnings],
        errors: [issue(1, "EMPLOYEE_IMPORT_APPLY_FAILED", failedMessage)],
      });

      return NextResponse.json(
        {
          ...publicBase,
          ok: false,
          dryRun: false,
          applyEnabled: false,
          canProceedToNextPhase: false,
          totals: {
            ...base.totals,
            valid: validRowsAfterResolution.length,
            invalid: invalidCount + validRowsAfterResolution.length,
          },
          errors: [issue(1, "EMPLOYEE_IMPORT_APPLY_FAILED", failedMessage)],
          warnings: [...mergedWarnings, ...duplicateWarnings],
          issueSummary: buildEmployeeImportIssueSummary({
            errors: [issue(1, "EMPLOYEE_IMPORT_APPLY_FAILED", failedMessage)],
            warnings: [...mergedWarnings, ...duplicateWarnings],
          }),
          runRef: buildImportRunRef({
            mode: "APPLY",
            runRecord,
          }),
          message: failedMessage,
        },
        { status: 500 },
      );
    }

    throw error;
  } finally {
    if (applyRunContext) {
      await releaseEmployeeImportApplyLock({
        companyId,
        sheetKind,
      }).catch(() => null);
    }
  }
}
