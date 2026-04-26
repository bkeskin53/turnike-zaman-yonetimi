import { AuditAction, AuditTargetType, Prisma, UserRole } from "@prisma/client";
import { writeAudit } from "@/src/audit/writeAudit";
import { prisma } from "@/src/repositories/prisma";
import {
  EmployeeImportPreviewRow,
  EmployeeImportValidationIssue,
} from "@/src/services/employees/importTemplateValidation.service";
import {
  applyEmployeeOnboardingMutation,
  isEmployeeOnboardingMutationError,
} from "@/src/services/employees/employeeOnboardingMutation.service";
import {
  applyEmployeeEmploymentLifecycleMutation,
  EmployeeEmploymentLifecycleAction,
  isEmployeeEmploymentLifecycleMutationError,
} from "@/src/services/employees/employeeEmploymentLifecycleMutation.service";
import {
  applyEmployeeOrgImportRow,
  EmployeeOrgImportBranchRecord,
  EmployeeOrgImportEmployeeRecord,
  EmployeeOrgImportGroupRecord,
  EmployeeOrgImportSubgroupRecord,
} from "@/src/services/employees/employeeOrgImportMutation.service";
import {
  applyEmployeePersonalImportRow,
  buildEmployeePersonalImportPayload,
  EmployeePersonalImportCardOwnerRecord,
  EmployeePersonalImportEmployeeRecord,
} from "@/src/services/employees/employeePersonalImportMutation.service";
import {
  applyEmployeeWorkScheduleImportRow,
  EmployeeWorkScheduleImportEmployeeRecord,
  EmployeeWorkSchedulePatternRecord,
} from "@/src/services/employees/employeeWorkScheduleImportMutation.service";

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

function normalizeOptionalText(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
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

type FullImportEmployeeState = EmployeePersonalImportEmployeeRecord &
  EmployeeOrgImportEmployeeRecord &
  EmployeeWorkScheduleImportEmployeeRecord;

type FullImportReferenceResolution = {
  branchId: string;
  employeeGroupId: string;
  employeeSubgroupId: string;
  workSchedulePatternId: string;
};

type FullImportLifecycleCommand = {
  action: EmployeeEmploymentLifecycleAction;
  effectiveDayKey: string;
};

type FullImportLifecycleResolution = {
  command: FullImportLifecycleCommand | null;
  warnings: EmployeeImportValidationIssue[];
  errors: EmployeeImportValidationIssue[];
};

class FullImportRowRejectedError extends Error {
  errors: EmployeeImportValidationIssue[];
  warnings: EmployeeImportValidationIssue[];
  cardConflict: boolean;
  invalidValues: boolean;

  constructor(args: {
    errors: EmployeeImportValidationIssue[];
    warnings: EmployeeImportValidationIssue[];
    cardConflict?: boolean;
    invalidValues?: boolean;
  }) {
    super("FULL_IMPORT_ROW_REJECTED");
    this.name = "FullImportRowRejectedError";
    this.errors = args.errors;
    this.warnings = args.warnings;
    this.cardConflict = args.cardConflict === true;
    this.invalidValues = args.invalidValues !== false;
  }
}

export type EmployeeFullImportApplySummary = {
  requested: number;
  found: number;
  created: number;
  updated: number;
  changed: number;
  unchanged: number;
  rejected: number;
  employmentChanged: number;
  personalChanged: number;
  orgChanged: number;
  workScheduleChanged: number;
  cardFilled: number;
  cardConflict: number;
  invalidValues: number;
  recomputeQueued: boolean;
};

function buildCommonReferenceWarnings(row: EmployeeImportPreviewRow): EmployeeImportValidationIssue[] {
  const warnings: EmployeeImportValidationIssue[] = [];

  if (normalizeOptionalText(row.values.isActive)) {
    warnings.push(
      issue(
        row.line,
        "IS_ACTIVE_DERIVED_IN_PATCH_8_8",
        "isActive bu patchte dogrudan destructive komut degildir. Employment lifecycle state'inden turetilen sonuc olarak ele alinir.",
        {
          employeeCode: row.employeeCode,
          field: "isActive",
          value: row.values.isActive ?? undefined,
        },
      ),
    );
  }

  if (normalizeOptionalText(row.values.companyCode)) {
    warnings.push(
      issue(
        row.line,
        "COMPANY_CODE_REFERENCE_ONLY_IN_PATCH_8_8",
        "companyCode bu patchte multi-company semantics acmaz. Aktif company baglaminda referans olarak kalir.",
        {
          employeeCode: row.employeeCode,
          field: "companyCode",
          value: row.values.companyCode ?? undefined,
        },
      ),
    );
  }

  return warnings;
}

function resolveExistingEmployeeLifecycle(row: EmployeeImportPreviewRow): FullImportLifecycleResolution {
  const warnings = buildCommonReferenceWarnings(row);
  const errors: EmployeeImportValidationIssue[] = [];
  const actionRaw = normalizeOptionalText(row.values.employmentAction);
  const action = actionRaw ? normalizeCode(actionRaw) : null;
  const hireDate = normalizeOptionalText(row.values.hireDate);
  const terminationDate = normalizeOptionalText(row.values.terminationDate);

  if (!action) {
    if (hireDate) {
      warnings.push(
        issue(
          row.line,
          "HIRE_DATE_REFERENCE_ONLY_WITHOUT_ACTION_IN_PATCH_8_8",
          "Mevcut calisan update branch'inde employmentAction yoksa hireDate lifecycle mutation'a donusmez. Yalnizca referans bilgisidir.",
          {
            employeeCode: row.employeeCode,
            field: "hireDate",
            value: row.values.hireDate ?? undefined,
          },
        ),
      );
    }
    if (terminationDate) {
      warnings.push(
        issue(
          row.line,
          "TERMINATION_DATE_REFERENCE_ONLY_WITHOUT_ACTION_IN_PATCH_8_8",
          "Mevcut calisan update branch'inde employmentAction yoksa terminationDate lifecycle mutation'a donusmez. Yalnizca referans bilgisidir.",
          {
            employeeCode: row.employeeCode,
            field: "terminationDate",
            value: row.values.terminationDate ?? undefined,
          },
        ),
      );
    }

    return {
      command: null,
      warnings,
      errors,
    };
  }

  if (action !== "HIRE" && action !== "TERMINATE" && action !== "REHIRE") {
    errors.push(
      issue(
        row.line,
        "INVALID_EMPLOYMENT_ACTION",
        "employmentAction yalnizca HIRE / TERMINATE / REHIRE olabilir.",
        {
          employeeCode: row.employeeCode,
          field: "employmentAction",
          value: actionRaw ?? undefined,
        },
      ),
    );
    return { command: null, warnings, errors };
  }

  if (action === "TERMINATE") {
    if (!terminationDate) {
      errors.push(
        issue(
          row.line,
          "TERMINATION_DATE_REQUIRED_FOR_TERMINATE",
          "employmentAction=TERMINATE icin terminationDate zorunludur.",
          {
            employeeCode: row.employeeCode,
            field: "terminationDate",
          },
        ),
      );
    }
    if (hireDate) {
      warnings.push(
        issue(
          row.line,
          "HIRE_DATE_IGNORED_FOR_TERMINATE_IN_PATCH_8_8",
          "employmentAction=TERMINATE oldugunda hireDate destructive mutation uretmez. Yalnizca referans bilgisidir.",
          {
            employeeCode: row.employeeCode,
            field: "hireDate",
            value: row.values.hireDate ?? undefined,
          },
        ),
      );
    }
    if (terminationDate && row.scopeStartDate > terminationDate) {
      errors.push(
        issue(
          row.line,
          "SCOPE_START_AFTER_TERMINATION_DATE",
          "scopeStartDate, terminationDate tarihinden sonra olamaz. FULL_DATA icinde org/work etkili tarihi istihdam kapanisindan sonra kalamaz.",
          {
            employeeCode: row.employeeCode,
            field: "scopeStartDate",
            value: row.scopeStartDate,
          },
        ),
      );
    }
    if (terminationDate && row.scopeEndDate && row.scopeEndDate > terminationDate) {
      errors.push(
        issue(
          row.line,
          "SCOPE_END_AFTER_TERMINATION_DATE",
          "scopeEndDate, terminationDate tarihinden sonra olamaz. Finite-range non-lifecycle aralik istihdam kapanisinin otesine tasamaz.",
          {
            employeeCode: row.employeeCode,
            field: "scopeEndDate",
            value: row.scopeEndDate,
          },
        ),
      );
    }

    return {
      command: terminationDate ? { action: "TERMINATE", effectiveDayKey: terminationDate } : null,
      warnings,
      errors,
    };
  }

  const effectiveHireDayKey = hireDate ?? row.scopeStartDate;
  if (action === "REHIRE" && !hireDate) {
    errors.push(
      issue(
        row.line,
        "HIRE_DATE_REQUIRED_FOR_REHIRE",
        "employmentAction=REHIRE icin hireDate zorunludur.",
        {
          employeeCode: row.employeeCode,
          field: "hireDate",
        },
      ),
    );
  }
  if (terminationDate) {
    warnings.push(
      issue(
        row.line,
        action === "HIRE"
          ? "TERMINATION_DATE_IGNORED_FOR_HIRE_IN_PATCH_8_8"
          : "TERMINATION_DATE_IGNORED_FOR_REHIRE_IN_PATCH_8_8",
        action === "HIRE"
          ? "employmentAction=HIRE oldugunda terminationDate destructive mutation uretmez. Yalnizca referans bilgisidir."
          : "employmentAction=REHIRE oldugunda terminationDate destructive mutation uretmez. Yalnizca referans bilgisidir.",
        {
          employeeCode: row.employeeCode,
          field: "terminationDate",
          value: row.values.terminationDate ?? undefined,
        },
      ),
    );
  }
  if (effectiveHireDayKey > row.scopeStartDate) {
    errors.push(
      issue(
        row.line,
        "SCOPE_START_BEFORE_HIRE_DATE",
        "scopeStartDate, hireDate tarihinden once olamaz. FULL_DATA icinde org/work etkili tarihi istihdam baslangicindan once kalamaz.",
        {
          employeeCode: row.employeeCode,
          field: hireDate ? "hireDate" : "scopeStartDate",
          value: hireDate ?? row.scopeStartDate,
        },
      ),
    );
  }

  return {
    command:
      errors.length === 0
        ? {
            action: action as EmployeeEmploymentLifecycleAction,
            effectiveDayKey: effectiveHireDayKey,
          }
        : null,
    warnings,
    errors,
  };
}

function resolveCreateEmployeeLifecycle(row: EmployeeImportPreviewRow): {
  employmentStartDayKey: string;
  warnings: EmployeeImportValidationIssue[];
  errors: EmployeeImportValidationIssue[];
} {
  const warnings = buildCommonReferenceWarnings(row);
  const errors: EmployeeImportValidationIssue[] = [];
  const actionRaw = normalizeOptionalText(row.values.employmentAction);
  const action = actionRaw ? normalizeCode(actionRaw) : null;
  const hireDate = normalizeOptionalText(row.values.hireDate);
  const terminationDate = normalizeOptionalText(row.values.terminationDate);
  const employmentStartDayKey = hireDate ?? row.scopeStartDate;

  if (action && action !== "HIRE" && action !== "TERMINATE" && action !== "REHIRE") {
    errors.push(
      issue(
        row.line,
        "INVALID_EMPLOYMENT_ACTION",
        "employmentAction yalnizca HIRE / TERMINATE / REHIRE olabilir.",
        {
          employeeCode: row.employeeCode,
          field: "employmentAction",
          value: actionRaw ?? undefined,
        },
      ),
    );
  }

  if (action === "TERMINATE" || action === "REHIRE") {
    errors.push(
      issue(
        row.line,
        "EMPLOYMENT_ACTION_NOT_ALLOWED_FOR_CREATE",
        "Sistemde olmayan employeeCode icin create branch yalnizca onboarding/HIRE acabilir. TERMINATE ve REHIRE mevcut calisan branch'inde kullanilmalidir.",
        {
          employeeCode: row.employeeCode,
          field: "employmentAction",
          value: actionRaw ?? undefined,
        },
      ),
    );
  }

  if (terminationDate) {
    warnings.push(
      issue(
        row.line,
        "TERMINATION_DATE_REFERENCE_ONLY_ON_CREATE_IN_PATCH_8_8",
        "Sistemde olmayan employeeCode create branch'inde terminationDate destructive mutation uretmez. Yalnizca referans bilgisidir.",
        {
          employeeCode: row.employeeCode,
          field: "terminationDate",
          value: row.values.terminationDate ?? undefined,
        },
      ),
    );
  }

  return {
    employmentStartDayKey,
    warnings,
    errors,
  };
}

function resolveFullImportReferences(args: {
  row: EmployeeImportPreviewRow;
  branchByCode: Map<string, EmployeeOrgImportBranchRecord>;
  groupByCode: Map<string, EmployeeOrgImportGroupRecord>;
  subgroupByCode: Map<string, EmployeeOrgImportSubgroupRecord>;
  patternByCode: Map<string, EmployeeWorkSchedulePatternRecord>;
}): {
  resolved: FullImportReferenceResolution | null;
  errors: EmployeeImportValidationIssue[];
} {
  const errors: EmployeeImportValidationIssue[] = [];

  const branch = args.branchByCode.get(normalizeCode(args.row.values.branchCode));
  if (!branch) {
    errors.push(
      issue(args.row.line, "BRANCH_CODE_NOT_FOUND", `Lokasyon kodu bulunamadi: ${args.row.values.branchCode}`, {
        employeeCode: args.row.employeeCode,
        field: "branchCode",
        value: args.row.values.branchCode ?? undefined,
      }),
    );
  } else if (!branch.isActive) {
    errors.push(
      issue(args.row.line, "BRANCH_CODE_INACTIVE", `Lokasyon pasif: ${args.row.values.branchCode}`, {
        employeeCode: args.row.employeeCode,
        field: "branchCode",
        value: args.row.values.branchCode ?? undefined,
      }),
    );
  }

  const group = args.groupByCode.get(normalizeCode(args.row.values.employeeGroupCode));
  if (!group) {
    errors.push(
      issue(
        args.row.line,
        "EMPLOYEE_GROUP_CODE_NOT_FOUND",
        `Grup kodu bulunamadi: ${args.row.values.employeeGroupCode}`,
        {
          employeeCode: args.row.employeeCode,
          field: "employeeGroupCode",
          value: args.row.values.employeeGroupCode ?? undefined,
        },
      ),
    );
  }

  const subgroup = args.subgroupByCode.get(normalizeCode(args.row.values.employeeSubgroupCode));
  if (!subgroup) {
    errors.push(
      issue(
        args.row.line,
        "EMPLOYEE_SUBGROUP_CODE_NOT_FOUND",
        `Alt grup kodu bulunamadi: ${args.row.values.employeeSubgroupCode}`,
        {
          employeeCode: args.row.employeeCode,
          field: "employeeSubgroupCode",
          value: args.row.values.employeeSubgroupCode ?? undefined,
        },
      ),
    );
  }

  if (group && subgroup && subgroup.groupId !== group.id) {
    errors.push(
      issue(
        args.row.line,
        "SUBGROUP_GROUP_MISMATCH",
        `Alt grup ile grup uyumsuz: ${args.row.values.employeeSubgroupCode} / ${args.row.values.employeeGroupCode}`,
        {
          employeeCode: args.row.employeeCode,
          field: "employeeSubgroupCode",
          value: args.row.values.employeeSubgroupCode ?? undefined,
        },
      ),
    );
  }

  const pattern = args.patternByCode.get(normalizeCode(args.row.values.workSchedulePatternCode));
  if (!pattern) {
    errors.push(
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
    );
  } else if (!pattern.isActive) {
    errors.push(
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
    );
  }

  if (errors.length > 0 || !branch || !group || !subgroup || !pattern || !branch.isActive || !pattern.isActive) {
    return { resolved: null, errors };
  }

  return {
    resolved: {
      branchId: branch.id,
      employeeGroupId: group.id,
      employeeSubgroupId: subgroup.id,
      workSchedulePatternId: pattern.id,
    },
    errors: [],
  };
}

export async function applyEmployeeFullImport(args: {
  companyId: string;
  actorUserId: string;
  actorRole: UserRole;
  todayKey: string;
  timezone: string;
  req?: Request;
  rows: EmployeeImportPreviewRow[];
}) {
  const employeeCodes = Array.from(new Set(args.rows.map((row) => row.employeeCode).filter(Boolean)));
  const incomingCardNos = Array.from(new Set(args.rows.map((row) => row.cardNo).filter(Boolean)));
  const branchCodes = Array.from(new Set(args.rows.map((row) => normalizeCode(row.values.branchCode)).filter(Boolean)));
  const groupCodes = Array.from(new Set(args.rows.map((row) => normalizeCode(row.values.employeeGroupCode)).filter(Boolean)));
  const subgroupCodes = Array.from(new Set(args.rows.map((row) => normalizeCode(row.values.employeeSubgroupCode)).filter(Boolean)));
  const patternCodes = Array.from(new Set(args.rows.map((row) => normalizeCode(row.values.workSchedulePatternCode)).filter(Boolean)));

  const [employees, cardOwners, branches, groups, subgroups, patterns] = await Promise.all([
    prisma.employee.findMany({
      where: {
        companyId: args.companyId,
        employeeCode: { in: employeeCodes },
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        nationalId: true,
        phone: true,
        gender: true,
        cardNo: true,
        branchId: true,
        employeeGroupId: true,
        employeeSubgroupId: true,
      },
    }),
    incomingCardNos.length
      ? prisma.employee.findMany({
          where: {
            companyId: args.companyId,
            cardNo: { in: incomingCardNos },
          },
          select: { id: true, employeeCode: true, cardNo: true },
        })
      : Promise.resolve([]),
    branchCodes.length
      ? prisma.branch.findMany({
          where: { companyId: args.companyId },
          select: { id: true, code: true, name: true, isActive: true },
        })
      : Promise.resolve([]),
    groupCodes.length
      ? prisma.employeeGroup.findMany({
          where: { companyId: args.companyId },
          select: { id: true, code: true, name: true },
        })
      : Promise.resolve([]),
    subgroupCodes.length
      ? prisma.employeeSubgroup.findMany({
          where: { companyId: args.companyId },
          select: { id: true, code: true, name: true, groupId: true },
        })
      : Promise.resolve([]),
    patternCodes.length
      ? prisma.workSchedulePattern.findMany({
          where: { companyId: args.companyId },
          select: { id: true, code: true, isActive: true },
        })
      : Promise.resolve([]),
  ]);

  const employeeByCode = new Map<string, FullImportEmployeeState>(
    employees.map((item) => [item.employeeCode, item]),
  );
  const cardOwnerByCardNo = new Map<string, EmployeePersonalImportCardOwnerRecord>(
    cardOwners.filter((item) => item.cardNo).map((item) => [item.cardNo!, item]),
  );
  const branchByCode = new Map(branches.map((item) => [normalizeCode(item.code), item]));
  const groupByCode = new Map(groups.map((item) => [normalizeCode(item.code), item]));
  const subgroupByCode = new Map(subgroups.map((item) => [normalizeCode(item.code), item]));
  const patternByCode = new Map(patterns.map((item) => [normalizeCode(item.code), item]));

  const uploadCardOwners = new Map<string, Set<string>>();
  for (const row of args.rows) {
    const key = String(row.cardNo ?? "").trim();
    if (!key) continue;
    const bucket = uploadCardOwners.get(key) ?? new Set<string>();
    bucket.add(row.employeeCode);
    uploadCardOwners.set(key, bucket);
  }

  const errors: EmployeeImportValidationIssue[] = [];
  const warnings: EmployeeImportValidationIssue[] = [];
  const changedEmployeeCodes: string[] = [];
  let recomputeStartDayKey: string | null = null;
  let recomputeEndDayKey: string | null = null;
  let recomputeHasOpenEnd = false;

  const summary: EmployeeFullImportApplySummary = {
    requested: args.rows.length,
    found: 0,
    created: 0,
    updated: 0,
    changed: 0,
    unchanged: 0,
    rejected: 0,
    employmentChanged: 0,
    personalChanged: 0,
    orgChanged: 0,
    workScheduleChanged: 0,
    cardFilled: 0,
    cardConflict: 0,
    invalidValues: 0,
    recomputeQueued: false,
  };

  for (const row of args.rows) {
    const existingEmployee = employeeByCode.get(row.employeeCode) ?? null;

    if (existingEmployee) {
      summary.found += 1;
      const lifecycleResolution = resolveExistingEmployeeLifecycle(row);
      const rowWarnings = [...lifecycleResolution.warnings];

      if (lifecycleResolution.errors.length > 0) {
        errors.push(...lifecycleResolution.errors);
        warnings.push(...rowWarnings);
        summary.rejected += 1;
        summary.invalidValues += 1;
        continue;
      }

      try {
        const txResult = await prisma.$transaction(async (tx) => {
          let currentEmployee: FullImportEmployeeState = existingEmployee;

          const personalResult = await applyEmployeePersonalImportRow({
            tx,
            companyId: args.companyId,
            todayKey: args.todayKey,
            row,
            employee: currentEmployee,
            uploadCardOwners,
            cardOwnerByCardNo,
          });
          rowWarnings.push(...personalResult.warnings);
          if (personalResult.status === "rejected") {
            throw new FullImportRowRejectedError({
              errors: personalResult.errors,
              warnings: rowWarnings,
              cardConflict: personalResult.cardConflict,
              invalidValues: !personalResult.cardConflict,
            });
          }
          if (personalResult.employee) currentEmployee = { ...currentEmployee, ...personalResult.employee };

          let employmentChanged = false;
          let employmentEffectiveDayKey: string | null = null;
          if (lifecycleResolution.command) {
            const employmentResult = await applyEmployeeEmploymentLifecycleMutation({
              tx,
              companyId: args.companyId,
              employeeId: currentEmployee.id,
              todayKey: args.todayKey,
              actorUserId: args.actorUserId,
              action: lifecycleResolution.command.action,
              effectiveDayKey: lifecycleResolution.command.effectiveDayKey,
              reason: "FULL_DATA_IMPORT_PATCH_8_9",
              actionNote: "FULL_DATA_IMPORT_PATCH_8_9",
              timezone: args.timezone,
              actionDetails: {
                source: "FULL_DATA_IMPORT_PATCH_8_9",
                line: row.line,
                employmentAction: lifecycleResolution.command.action,
              },
            });
            employmentChanged = employmentResult.changed;
            employmentEffectiveDayKey = employmentResult.effectiveDayKey;
          }

          const orgResult = await applyEmployeeOrgImportRow({
            tx,
            companyId: args.companyId,
            todayKey: args.todayKey,
            row,
            employee: currentEmployee,
            branchByCode,
            groupByCode,
            subgroupByCode,
            emitCardReferenceWarning: false,
            enforceEmploymentOnEffectiveDate: false,
          });
          rowWarnings.push(...orgResult.warnings);
          if (orgResult.status === "rejected") {
            throw new FullImportRowRejectedError({
              errors: orgResult.errors,
              warnings: rowWarnings,
              cardConflict: orgResult.cardMismatch,
              invalidValues: !orgResult.cardMismatch,
            });
          }
          if (orgResult.employee) currentEmployee = { ...currentEmployee, ...orgResult.employee };

          const workResult = await applyEmployeeWorkScheduleImportRow({
            tx,
            companyId: args.companyId,
            row,
            employee: currentEmployee,
            patternByCode,
            emitCardReferenceWarning: false,
          });
          rowWarnings.push(...workResult.warnings);
          if (workResult.status === "rejected") {
            throw new FullImportRowRejectedError({
              errors: workResult.errors,
              warnings: rowWarnings,
              cardConflict: workResult.cardMismatch,
              invalidValues: !workResult.cardMismatch,
            });
          }

          return {
            employee: currentEmployee,
            employmentChanged,
            employmentEffectiveDayKey,
            personalChanged: personalResult.status === "changed",
            orgChanged: orgResult.status === "changed",
            workScheduleChanged: workResult.status === "changed",
            orgRecomputeStartDayKey: orgResult.recomputeRangeStartDayKey,
            orgRecomputeEndDayKey: orgResult.recomputeRangeEndDayKey,
            workRecomputeStartDayKey: workResult.recomputeRangeStartDayKey,
            workRecomputeEndDayKey: workResult.recomputeRangeEndDayKey,
            cardFilled: personalResult.cardFilled,
            warnings: rowWarnings,
          };
        });

        warnings.push(...txResult.warnings);
        employeeByCode.set(row.employeeCode, txResult.employee);
        if (txResult.employee.cardNo) {
          cardOwnerByCardNo.set(txResult.employee.cardNo, {
            id: txResult.employee.id,
            employeeCode: txResult.employee.employeeCode,
            cardNo: txResult.employee.cardNo,
          });
        }

        const rowChanged =
          txResult.employmentChanged ||
          txResult.personalChanged ||
          txResult.orgChanged ||
          txResult.workScheduleChanged;
        if (rowChanged) {
          summary.updated += 1;
          summary.changed += 1;
          if (txResult.employmentChanged) {
            summary.employmentChanged += 1;
            recomputeStartDayKey = minDayKey(
              recomputeStartDayKey,
              txResult.employmentEffectiveDayKey,
            );
            recomputeHasOpenEnd = true;
            recomputeEndDayKey = null;
          }
          if (txResult.personalChanged) summary.personalChanged += 1;
          if (txResult.orgChanged) summary.orgChanged += 1;
          if (txResult.workScheduleChanged) summary.workScheduleChanged += 1;
          if (txResult.cardFilled) summary.cardFilled += 1;
          if (txResult.orgChanged) {
            recomputeStartDayKey = minDayKey(
              recomputeStartDayKey,
              txResult.orgRecomputeStartDayKey ?? row.scopeStartDate,
            );
            if (!recomputeHasOpenEnd) {
              if (txResult.orgRecomputeEndDayKey) {
                recomputeEndDayKey = maxDayKey(recomputeEndDayKey, txResult.orgRecomputeEndDayKey);
              } else {
                recomputeHasOpenEnd = true;
                recomputeEndDayKey = null;
              }
            }
          }
          if (txResult.workScheduleChanged) {
            recomputeStartDayKey = minDayKey(
              recomputeStartDayKey,
              txResult.workRecomputeStartDayKey ?? row.scopeStartDate,
            );
            if (!recomputeHasOpenEnd) {
              if (txResult.workRecomputeEndDayKey) {
                recomputeEndDayKey = maxDayKey(recomputeEndDayKey, txResult.workRecomputeEndDayKey);
              } else {
                recomputeHasOpenEnd = true;
                recomputeEndDayKey = null;
              }
            }
          }
          changedEmployeeCodes.push(row.employeeCode);
        } else {
          summary.unchanged += 1;
        }
      } catch (error) {
        if (error instanceof FullImportRowRejectedError) {
          errors.push(...error.errors);
          warnings.push(...error.warnings);
          summary.rejected += 1;
          if (error.cardConflict) summary.cardConflict += 1;
          else summary.invalidValues += 1;
          continue;
        }

        if (isEmployeeEmploymentLifecycleMutationError(error)) {
          errors.push(
            issue(row.line, error.code, error.message, {
              employeeCode: row.employeeCode,
              field: "employmentAction",
              value: row.values.employmentAction ?? undefined,
            }),
          );
          warnings.push(...lifecycleResolution.warnings);
          summary.rejected += 1;
          summary.invalidValues += 1;
          continue;
        }

        throw error;
      }

      continue;
    }

    const createLifecycle = resolveCreateEmployeeLifecycle(row);
    warnings.push(...createLifecycle.warnings);

    if (createLifecycle.errors.length > 0) {
      errors.push(...createLifecycle.errors);
      summary.rejected += 1;
      summary.invalidValues += 1;
      continue;
    }

    const uploadOwners = uploadCardOwners.get(row.cardNo);
    if (uploadOwners && uploadOwners.size > 1) {
      errors.push(
        issue(
          row.line,
          "CARD_NO_DUPLICATE_IN_UPLOAD",
          `Ayni Kart ID ayni yuk icinde birden fazla calisana atanmis: ${row.cardNo}`,
          {
            employeeCode: row.employeeCode,
            field: "cardNo",
            value: row.cardNo,
          },
        ),
      );
      summary.rejected += 1;
      summary.cardConflict += 1;
      continue;
    }

    const cardOwner = cardOwnerByCardNo.get(row.cardNo);
    if (cardOwner) {
      errors.push(
        issue(row.line, "CARD_NO_TAKEN", `Kart ID baska bir calisana ait: ${row.cardNo}`, {
          employeeCode: row.employeeCode,
          field: "cardNo",
          value: row.cardNo,
        }),
      );
      summary.rejected += 1;
      summary.cardConflict += 1;
      continue;
    }

    const personalPayload = buildEmployeePersonalImportPayload({
      row,
      employee: {
        employeeCode: row.employeeCode,
        cardNo: row.cardNo ?? null,
        firstName: "",
        lastName: "",
        email: null,
        nationalId: null,
        phone: null,
        gender: null,
      },
    });
    if (!personalPayload.payload || personalPayload.errors.length > 0) {
      errors.push(...personalPayload.errors);
      summary.rejected += 1;
      summary.invalidValues += 1;
      continue;
    }

    const resolvedRefs = resolveFullImportReferences({
      row,
      branchByCode,
      groupByCode,
      subgroupByCode,
      patternByCode,
    });
    if (!resolvedRefs.resolved || resolvedRefs.errors.length > 0) {
      errors.push(...resolvedRefs.errors);
      summary.rejected += 1;
      summary.invalidValues += 1;
      continue;
    }

    const createPayload = personalPayload.payload;
    const createResolvedRefs = resolvedRefs.resolved;

    try {
      const onboarding = await prisma.$transaction(async (tx) => {
        const onboardingResult = await applyEmployeeOnboardingMutation({
          tx,
          companyId: args.companyId,
          todayKey: args.todayKey,
          actorUserId: args.actorUserId,
          employeeCode: row.employeeCode,
          firstName: createPayload.firstName,
          lastName: createPayload.lastName,
          email: createPayload.email,
          nationalId: createPayload.nationalId,
          phone: createPayload.phone,
          gender: createPayload.gender,
          cardNo: row.cardNo,
          deviceUserId: null,
          branchId: createResolvedRefs.branchId,
          employeeGroupId: createResolvedRefs.employeeGroupId,
          employeeSubgroupId: createResolvedRefs.employeeSubgroupId,
          workSchedulePatternId: createResolvedRefs.workSchedulePatternId,
          employmentStartDayKey: createLifecycle.employmentStartDayKey,
          effectiveDayKey: row.scopeStartDate,
          employmentReason: "FULL_DATA_IMPORT_PATCH_8_9",
          actionNote: "FULL_DATA_IMPORT_PATCH_8_9",
          actionDetails: {
            source: "FULL_DATA_IMPORT_PATCH_8_9",
            line: row.line,
          },
        });

        if (row.scopeEndDate) {
          const personalResult = await applyEmployeePersonalImportRow({
            tx,
            companyId: args.companyId,
            todayKey: args.todayKey,
            row,
            employee: onboardingResult.employee,
            uploadCardOwners,
            cardOwnerByCardNo,
          });
          if (personalResult.status === "rejected") {
            throw new FullImportRowRejectedError({
              errors: personalResult.errors,
              warnings: personalResult.warnings,
              cardConflict: personalResult.cardConflict,
              invalidValues: !personalResult.cardConflict,
            });
          }

          const orgResult = await applyEmployeeOrgImportRow({
            tx,
            companyId: args.companyId,
            todayKey: args.todayKey,
            row,
            employee: onboardingResult.employee,
            branchByCode,
            groupByCode,
            subgroupByCode,
            emitCardReferenceWarning: false,
          });
          if (orgResult.status === "rejected") {
            throw new FullImportRowRejectedError({
              errors: orgResult.errors,
              warnings: orgResult.warnings,
              cardConflict: orgResult.cardMismatch,
              invalidValues: !orgResult.cardMismatch,
            });
          }

          const workResult = await applyEmployeeWorkScheduleImportRow({
            tx,
            companyId: args.companyId,
            row,
            employee: onboardingResult.employee,
            patternByCode,
            emitCardReferenceWarning: false,
            enforceEmploymentOnEffectiveDate: false,
          });
          if (workResult.status === "rejected") {
            throw new FullImportRowRejectedError({
              errors: workResult.errors,
              warnings: workResult.warnings,
              cardConflict: workResult.cardMismatch,
              invalidValues: !workResult.cardMismatch,
            });
          }
        }

        return onboardingResult;
      });

      const createdEmployee: FullImportEmployeeState = {
        ...onboarding.employee,
      };
      employeeByCode.set(row.employeeCode, createdEmployee);
      if (createdEmployee.cardNo) {
        cardOwnerByCardNo.set(createdEmployee.cardNo, {
          id: createdEmployee.id,
          employeeCode: createdEmployee.employeeCode,
          cardNo: createdEmployee.cardNo,
        });
      }

      summary.created += 1;
      summary.changed += 1;
      if (onboarding.employmentChanged) {
        summary.employmentChanged += 1;
        recomputeStartDayKey = minDayKey(
          recomputeStartDayKey,
          createLifecycle.employmentStartDayKey,
        );
        recomputeHasOpenEnd = true;
        recomputeEndDayKey = null;
      }
      if (onboarding.profileChanged) summary.personalChanged += 1;
      if (onboarding.orgChanged) summary.orgChanged += 1;
      if (onboarding.workScheduleChanged) summary.workScheduleChanged += 1;
      if (onboarding.orgChanged || onboarding.workScheduleChanged) {
        recomputeStartDayKey = minDayKey(recomputeStartDayKey, row.scopeStartDate);
        recomputeHasOpenEnd = true;
        recomputeEndDayKey = null;
      }
      changedEmployeeCodes.push(row.employeeCode);
    } catch (error) {
      if (error instanceof FullImportRowRejectedError) {
        errors.push(...error.errors);
        warnings.push(...error.warnings);
        summary.rejected += 1;
        if (error.cardConflict) summary.cardConflict += 1;
        else summary.invalidValues += 1;
        continue;
      }

      if (isEmployeeOnboardingMutationError(error)) {
        errors.push(
          issue(row.line, error.code, error.message, {
            employeeCode: row.employeeCode,
          }),
        );
        summary.rejected += 1;
        summary.invalidValues += 1;
        continue;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [];
        if (target.includes("cardNo")) {
          errors.push(
            issue(row.line, "CARD_NO_TAKEN", `Kart ID baska bir calisana ait: ${row.cardNo}`, {
              employeeCode: row.employeeCode,
              field: "cardNo",
              value: row.cardNo,
            }),
          );
          summary.rejected += 1;
          summary.cardConflict += 1;
          continue;
        }

        const code = target.includes("employeeCode") ? "EMPLOYEE_CODE_TAKEN" : "UNIQUE_CONSTRAINT";
        errors.push(
          issue(row.line, code, error.message, {
            employeeCode: row.employeeCode,
          }),
        );
        summary.rejected += 1;
        summary.invalidValues += 1;
        continue;
      }

      throw error;
    }
  }

  await writeAudit({
    req: args.req,
    actorUserId: args.actorUserId,
    actorRole: args.actorRole,
    action: AuditAction.IMPORT,
    targetType: AuditTargetType.EMPLOYEES,
    details: {
      kind: "EMPLOYEE_FULL_IMPORT_PATCH_8_9",
      requested: summary.requested,
      found: summary.found,
      created: summary.created,
      updated: summary.updated,
      changed: summary.changed,
      unchanged: summary.unchanged,
      rejected: summary.rejected,
      employmentChanged: summary.employmentChanged,
      personalChanged: summary.personalChanged,
      orgChanged: summary.orgChanged,
      workScheduleChanged: summary.workScheduleChanged,
      cardFilled: summary.cardFilled,
      cardConflict: summary.cardConflict,
      invalidValues: summary.invalidValues,
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
