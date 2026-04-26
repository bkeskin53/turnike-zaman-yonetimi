import { AuditAction, AuditTargetType, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { writeAudit } from "@/src/audit/writeAudit";
import {
  applyEmployeeWorkScheduleAssignmentChange,
  applyEmployeeWorkScheduleAssignmentFiniteRangeChange,
  isEmployeeWorkScheduleAssignmentMutationError,
} from "@/src/services/employees/employeeWorkScheduleAssignmentMutation.service";
import {
  EmployeeImportPreviewRow,
  EmployeeImportValidationIssue,
} from "@/src/services/employees/importTemplateValidation.service";
import { nextDayKey } from "@/src/services/employees/finiteRangeHistoryMutation.util";

function issue(
  line: number,
  code: string,
  message: string,
  opts?: Partial<EmployeeImportValidationIssue>,
): EmployeeImportValidationIssue {
  return {
    line,
    code,
    message,
    employeeCode: opts?.employeeCode,
    field: opts?.field,
    value: opts?.value,
  };
}

function normalizeCode(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

function minDayKey(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

function maxDayKey(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

export type EmployeeWorkScheduleImportApplySummary = {
  requested: number;
  found: number;
  changed: number;
  unchanged: number;
  rejected: number;
  workScheduleChanged: number;
  employeeNotFound: number;
  cardMismatch: number;
  invalidWorkValues: number;
  recomputeQueued: boolean;
};

export type EmployeeWorkScheduleImportEmployeeRecord = {
  id: string;
  employeeCode: string;
  cardNo: string | null;
};

export type EmployeeWorkSchedulePatternRecord = {
  id: string;
  code: string;
  isActive: boolean;
};

export type EmployeeWorkScheduleImportRowResult = {
  status: "changed" | "no_change" | "rejected";
  errors: EmployeeImportValidationIssue[];
  warnings: EmployeeImportValidationIssue[];
  workScheduleChanged: boolean;
  recomputeRangeStartDayKey: string | null;
  recomputeRangeEndDayKey: string | null;
  employeeNotFound: boolean;
  cardMismatch: boolean;
  invalidWorkValues: boolean;
  employee: EmployeeWorkScheduleImportEmployeeRecord | null;
};

export async function applyEmployeeWorkScheduleImportRow(args: {
  tx: Prisma.TransactionClient;
  companyId: string;
  row: EmployeeImportPreviewRow;
  employee: EmployeeWorkScheduleImportEmployeeRecord | null;
  patternByCode: Map<string, EmployeeWorkSchedulePatternRecord>;
  emitCardReferenceWarning?: boolean;
  enforceEmploymentOnEffectiveDate?: boolean;
}): Promise<EmployeeWorkScheduleImportRowResult> {
  const warnings: EmployeeImportValidationIssue[] = [];

  if (!args.employee) {
    return {
      status: "rejected",
      errors: [
        issue(args.row.line, "EMPLOYEE_NOT_FOUND", `Calisan bulunamadi: ${args.row.employeeCode}`, {
          employeeCode: args.row.employeeCode,
          field: "employeeCode",
          value: args.row.employeeCode,
        }),
      ],
      warnings,
      workScheduleChanged: false,
      recomputeRangeStartDayKey: null,
      recomputeRangeEndDayKey: null,
      employeeNotFound: true,
      cardMismatch: false,
      invalidWorkValues: false,
      employee: null,
    };
  }

  if (args.employee.cardNo && args.employee.cardNo !== args.row.cardNo) {
    return {
      status: "rejected",
      errors: [
        issue(
          args.row.line,
          "CARD_NO_MISMATCH",
          `Kart ID eslesmiyor. Mevcut: ${args.employee.cardNo} / Gelen: ${args.row.cardNo}`,
          {
            employeeCode: args.row.employeeCode,
            field: "cardNo",
            value: args.row.cardNo,
          },
        ),
      ],
      warnings,
      workScheduleChanged: false,
      recomputeRangeStartDayKey: null,
      recomputeRangeEndDayKey: null,
      employeeNotFound: false,
      cardMismatch: true,
      invalidWorkValues: false,
      employee: args.employee,
    };
  }

  if (args.emitCardReferenceWarning !== false && !args.employee.cardNo) {
    warnings.push(
      issue(
        args.row.line,
        "CARD_NO_REFERENCE_ONLY",
        "Kart ID bu fazda yalnizca referans / dogrulama alanidir. Mevcut calisan karti bossa calisma plani atamasi yine de islenir.",
        {
          employeeCode: args.row.employeeCode,
          field: "cardNo",
          value: args.row.cardNo,
        },
      ),
    );
  }

  const pattern = args.patternByCode.get(normalizeCode(args.row.values.workSchedulePatternCode));
  if (!pattern) {
    return {
      status: "rejected",
      errors: [
        issue(
          args.row.line,
          "WORK_SCHEDULE_PATTERN_CODE_NOT_FOUND",
          `Calisma plani kodu bulunamadi: ${args.row.values.workSchedulePatternCode}`,
          {
            employeeCode: args.row.employeeCode,
            field: "workSchedulePatternCode",
            value: args.row.values.workSchedulePatternCode ?? undefined,
          },
        ),
      ],
      warnings,
      workScheduleChanged: false,
      recomputeRangeStartDayKey: null,
      recomputeRangeEndDayKey: null,
      employeeNotFound: false,
      cardMismatch: false,
      invalidWorkValues: true,
      employee: args.employee,
    };
  }

  if (!pattern.isActive) {
    return {
      status: "rejected",
      errors: [
        issue(
          args.row.line,
          "WORK_SCHEDULE_PATTERN_INACTIVE",
          `Calisma plani pasif: ${args.row.values.workSchedulePatternCode}`,
          {
            employeeCode: args.row.employeeCode,
            field: "workSchedulePatternCode",
            value: args.row.values.workSchedulePatternCode ?? undefined,
          },
        ),
      ],
      warnings,
      workScheduleChanged: false,
      recomputeRangeStartDayKey: null,
      recomputeRangeEndDayKey: null,
      employeeNotFound: false,
      cardMismatch: false,
      invalidWorkValues: true,
      employee: args.employee,
    };
  }

  try {
    const result = args.row.scopeEndDate
      ? await applyEmployeeWorkScheduleAssignmentFiniteRangeChange({
          tx: args.tx,
          companyId: args.companyId,
          employeeId: args.employee.id,
          patternId: pattern.id,
          startDayKey: args.row.scopeStartDate,
          endDayKey: args.row.scopeEndDate,
          enforceEmploymentOnEffectiveDate: args.enforceEmploymentOnEffectiveDate,
        })
      : await applyEmployeeWorkScheduleAssignmentChange({
          tx: args.tx,
          companyId: args.companyId,
          employeeId: args.employee.id,
          patternId: pattern.id,
          effectiveDayKey: args.row.scopeStartDate,
          enforceEmploymentOnEffectiveDate: args.enforceEmploymentOnEffectiveDate,
        });

    return {
      status: result.changed ? "changed" : "no_change",
      errors: [],
      warnings,
      workScheduleChanged: result.changed,
      recomputeRangeStartDayKey: result.changed ? args.row.scopeStartDate : null,
      recomputeRangeEndDayKey:
        result.changed && args.row.scopeEndDate ? nextDayKey(args.row.scopeEndDate) : null,
      employeeNotFound: false,
      cardMismatch: false,
      invalidWorkValues: false,
      employee: args.employee,
    };
  } catch (error) {
    if (isEmployeeWorkScheduleAssignmentMutationError(error)) {
      return {
        status: "rejected",
        errors: [
          issue(args.row.line, error.code, error.message, {
            employeeCode: args.row.employeeCode,
            field: "workSchedulePatternCode",
            value: args.row.values.workSchedulePatternCode ?? undefined,
          }),
        ],
        warnings,
        workScheduleChanged: false,
        recomputeRangeStartDayKey: null,
        recomputeRangeEndDayKey: null,
        employeeNotFound: false,
        cardMismatch: false,
        invalidWorkValues: true,
        employee: args.employee,
      };
    }

    return {
      status: "rejected",
      errors: [
        issue(
          args.row.line,
          "WORK_SCHEDULE_ASSIGNMENT_APPLY_FAILED",
          error instanceof Error ? error.message : "Calisma plani atamasi uygulanamadi.",
          {
            employeeCode: args.row.employeeCode,
            field: "workSchedulePatternCode",
            value: args.row.values.workSchedulePatternCode ?? undefined,
          },
        ),
      ],
      warnings,
      workScheduleChanged: false,
      recomputeRangeStartDayKey: null,
      recomputeRangeEndDayKey: null,
      employeeNotFound: false,
      cardMismatch: false,
      invalidWorkValues: true,
      employee: args.employee,
    };
  }
}

export async function applyEmployeeWorkScheduleImport(args: {
  companyId: string;
  actorUserId: string;
  actorRole: UserRole;
  req?: Request;
  rows: EmployeeImportPreviewRow[];
}) {
  const employeeCodes = Array.from(new Set(args.rows.map((row) => row.employeeCode).filter(Boolean)));
  const workScheduleCodes = Array.from(
    new Set(args.rows.map((row) => normalizeCode(row.values.workSchedulePatternCode)).filter(Boolean)),
  );

  const [employees, patterns] = await Promise.all([
    prisma.employee.findMany({
      where: {
        companyId: args.companyId,
        employeeCode: { in: employeeCodes },
      },
      select: {
        id: true,
        employeeCode: true,
        cardNo: true,
      },
    }),
    workScheduleCodes.length
      ? prisma.workSchedulePattern.findMany({
          where: { companyId: args.companyId },
          select: { id: true, code: true, isActive: true },
        })
      : Promise.resolve([]),
  ]);

  const employeeByCode = new Map<string, EmployeeWorkScheduleImportEmployeeRecord>(
    employees.map((item) => [item.employeeCode, item]),
  );
  const patternByCode = new Map(patterns.map((item) => [normalizeCode(item.code), item]));

  const errors: EmployeeImportValidationIssue[] = [];
  const warnings: EmployeeImportValidationIssue[] = [];
  const changedEmployeeCodes: string[] = [];
  let recomputeStartDayKey: string | null = null;
  let recomputeEndDayKey: string | null = null;
  let recomputeHasOpenEnd = false;

  const summary: EmployeeWorkScheduleImportApplySummary = {
    requested: args.rows.length,
    found: 0,
    changed: 0,
    unchanged: 0,
    rejected: 0,
    workScheduleChanged: 0,
    employeeNotFound: 0,
    cardMismatch: 0,
    invalidWorkValues: 0,
    recomputeQueued: false,
  };

  for (const row of args.rows) {
    const employee = employeeByCode.get(row.employeeCode) ?? null;
    if (employee) summary.found += 1;

    const rowResult = await prisma.$transaction((tx) =>
      applyEmployeeWorkScheduleImportRow({
        tx,
        companyId: args.companyId,
        row,
        employee,
        patternByCode,
      }),
    );

    errors.push(...rowResult.errors);
    warnings.push(...rowResult.warnings);

    if (rowResult.employeeNotFound) {
      summary.rejected += 1;
      summary.employeeNotFound += 1;
      continue;
    }

    if (rowResult.cardMismatch) {
      summary.rejected += 1;
      summary.cardMismatch += 1;
      continue;
    }

    if (rowResult.invalidWorkValues) {
      summary.rejected += 1;
      summary.invalidWorkValues += 1;
      continue;
    }

    if (rowResult.status === "changed") {
      summary.changed += 1;
      summary.workScheduleChanged += 1;
      recomputeStartDayKey = minDayKey(
        recomputeStartDayKey,
        rowResult.recomputeRangeStartDayKey ?? row.scopeStartDate,
      );
      if (rowResult.recomputeRangeEndDayKey) {
        recomputeEndDayKey = maxDayKey(recomputeEndDayKey, rowResult.recomputeRangeEndDayKey);
      } else {
        recomputeHasOpenEnd = true;
      }
      changedEmployeeCodes.push(row.employeeCode);
    } else if (rowResult.status === "no_change") {
      summary.unchanged += 1;
    } else {
      summary.rejected += 1;
    }
  }

  await writeAudit({
    req: args.req,
    actorUserId: args.actorUserId,
    actorRole: args.actorRole,
    action: AuditAction.IMPORT,
    targetType: AuditTargetType.EMPLOYEES,
    details: {
      kind: "EMPLOYEE_WORK_SCHEDULE_IMPORT_PATCH_8_9",
      requested: summary.requested,
      found: summary.found,
      changed: summary.changed,
      unchanged: summary.unchanged,
      rejected: summary.rejected,
      workScheduleChanged: summary.workScheduleChanged,
      employeeNotFound: summary.employeeNotFound,
      cardMismatch: summary.cardMismatch,
      invalidWorkValues: summary.invalidWorkValues,
      recomputeStartDayKey,
      recomputeEndDayKey: recomputeHasOpenEnd ? null : recomputeEndDayKey,
      changedEmployeeCodesPreview: changedEmployeeCodes.slice(0, 20),
      rejectedPreview: errors.slice(0, 20).map((item) => ({
        line: item.line,
        employeeCode: item.employeeCode ?? null,
        code: item.code,
      })),
    },
  });

  return {
    summary,
    errors,
    warnings,
    changedEmployeeCodesPreview: changedEmployeeCodes.slice(0, 20),
    recomputeStartDayKey,
    recomputeEndDayKey: recomputeHasOpenEnd ? null : recomputeEndDayKey,
  };
}
