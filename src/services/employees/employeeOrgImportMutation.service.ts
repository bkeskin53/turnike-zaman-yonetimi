import { AuditAction, AuditTargetType, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { writeAudit } from "@/src/audit/writeAudit";
import {
  applyEmployeeOrgAssignmentChange,
  applyEmployeeOrgAssignmentFiniteRangeChange,
  isEmployeeOrgAssignmentMutationError,
} from "@/src/services/employeeOrgAssignmentMutation.service";
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

export type EmployeeOrgImportApplySummary = {
  requested: number;
  found: number;
  changed: number;
  unchanged: number;
  rejected: number;
  orgChanged: number;
  employeeNotFound: number;
  cardMismatch: number;
  invalidOrgValues: number;
  recomputeQueued: boolean;
};

export type EmployeeOrgImportEmployeeRecord = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  cardNo: string | null;
  branchId: string | null;
  employeeGroupId: string | null;
  employeeSubgroupId: string | null;
};

export type EmployeeOrgImportBranchRecord = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

export type EmployeeOrgImportGroupRecord = {
  id: string;
  code: string;
  name: string;
};

export type EmployeeOrgImportSubgroupRecord = {
  id: string;
  code: string;
  name: string;
  groupId: string;
};

export type EmployeeOrgImportRowResult = {
  status: "changed" | "no_change" | "rejected";
  errors: EmployeeImportValidationIssue[];
  warnings: EmployeeImportValidationIssue[];
  orgChanged: boolean;
  recomputeRangeStartDayKey: string | null;
  recomputeRangeEndDayKey: string | null;
  employeeNotFound: boolean;
  cardMismatch: boolean;
  invalidOrgValues: boolean;
  employee: EmployeeOrgImportEmployeeRecord | null;
};

export async function applyEmployeeOrgImportRow(args: {
  tx: Prisma.TransactionClient;
  companyId: string;
  todayKey: string;
  row: EmployeeImportPreviewRow;
  employee: EmployeeOrgImportEmployeeRecord | null;
  branchByCode: Map<string, EmployeeOrgImportBranchRecord>;
  groupByCode: Map<string, EmployeeOrgImportGroupRecord>;
  subgroupByCode: Map<string, EmployeeOrgImportSubgroupRecord>;
  emitCardReferenceWarning?: boolean;
  enforceEmploymentOnEffectiveDate?: boolean;
}): Promise<EmployeeOrgImportRowResult> {
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
      orgChanged: false,
      recomputeRangeStartDayKey: null,
      recomputeRangeEndDayKey: null,
      employeeNotFound: true,
      cardMismatch: false,
      invalidOrgValues: false,
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
      orgChanged: false,
      recomputeRangeStartDayKey: null,
      recomputeRangeEndDayKey: null,
      employeeNotFound: false,
      cardMismatch: true,
      invalidOrgValues: false,
      employee: args.employee,
    };
  }

  if (args.emitCardReferenceWarning !== false && !args.employee.cardNo) {
    warnings.push(
      issue(
        args.row.line,
        "CARD_NO_REFERENCE_ONLY",
        "Kart ID bu fazda yalnizca referans / dogrulama alanidir. Mevcut calisan karti bossa organizasyon atamasi yine de islenir.",
        {
          employeeCode: args.row.employeeCode,
          field: "cardNo",
          value: args.row.cardNo,
        },
      ),
    );
  }

  const branch = args.branchByCode.get(normalizeCode(args.row.values.branchCode));
  if (!branch) {
    return {
      status: "rejected",
      errors: [
        issue(args.row.line, "BRANCH_CODE_NOT_FOUND", `Lokasyon kodu bulunamadi: ${args.row.values.branchCode}`, {
          employeeCode: args.row.employeeCode,
          field: "branchCode",
          value: args.row.values.branchCode ?? undefined,
        }),
      ],
      warnings,
      orgChanged: false,
      recomputeRangeStartDayKey: null,
      recomputeRangeEndDayKey: null,
      employeeNotFound: false,
      cardMismatch: false,
      invalidOrgValues: true,
      employee: args.employee,
    };
  }
  if (!branch.isActive) {
    return {
      status: "rejected",
      errors: [
        issue(args.row.line, "BRANCH_CODE_INACTIVE", `Lokasyon pasif: ${args.row.values.branchCode}`, {
          employeeCode: args.row.employeeCode,
          field: "branchCode",
          value: args.row.values.branchCode ?? undefined,
        }),
      ],
      warnings,
      orgChanged: false,
      recomputeRangeStartDayKey: null,
      recomputeRangeEndDayKey: null,
      employeeNotFound: false,
      cardMismatch: false,
      invalidOrgValues: true,
      employee: args.employee,
    };
  }

  const group = args.groupByCode.get(normalizeCode(args.row.values.employeeGroupCode));
  if (!group) {
    return {
      status: "rejected",
      errors: [
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
      ],
      warnings,
      orgChanged: false,
      recomputeRangeStartDayKey: null,
      recomputeRangeEndDayKey: null,
      employeeNotFound: false,
      cardMismatch: false,
      invalidOrgValues: true,
      employee: args.employee,
    };
  }

  const subgroup = args.subgroupByCode.get(normalizeCode(args.row.values.employeeSubgroupCode));
  if (!subgroup) {
    return {
      status: "rejected",
      errors: [
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
      ],
      warnings,
      orgChanged: false,
      recomputeRangeStartDayKey: null,
      recomputeRangeEndDayKey: null,
      employeeNotFound: false,
      cardMismatch: false,
      invalidOrgValues: true,
      employee: args.employee,
    };
  }
  if (subgroup.groupId !== group.id) {
    return {
      status: "rejected",
      errors: [
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
      ],
      warnings,
      orgChanged: false,
      recomputeRangeStartDayKey: null,
      recomputeRangeEndDayKey: null,
      employeeNotFound: false,
      cardMismatch: false,
      invalidOrgValues: true,
      employee: args.employee,
    };
  }

  try {
    const result = args.row.scopeEndDate
      ? await applyEmployeeOrgAssignmentFiniteRangeChange({
          tx: args.tx,
          companyId: args.companyId,
          employeeId: args.employee.id,
          startDayKey: args.row.scopeStartDate,
          endDayKey: args.row.scopeEndDate,
          mirrorDayKey: args.todayKey,
          payload: {
            branchId: branch.id,
            employeeGroupId: group.id,
            employeeSubgroupId: subgroup.id,
          },
          enforceEmploymentOnEffectiveDate: args.enforceEmploymentOnEffectiveDate,
        })
      : await applyEmployeeOrgAssignmentChange({
          tx: args.tx,
          companyId: args.companyId,
          employeeId: args.employee.id,
          effectiveDayKey: args.row.scopeStartDate,
          mirrorDayKey: args.todayKey,
          payload: {
            branchId: branch.id,
            employeeGroupId: group.id,
            employeeSubgroupId: subgroup.id,
          },
          enforceEmploymentOnEffectiveDate: args.enforceEmploymentOnEffectiveDate,
        });

    return {
      status: result.changed ? "changed" : "no_change",
      errors: [],
      warnings,
      orgChanged: result.changed,
      recomputeRangeStartDayKey: result.changed ? args.row.scopeStartDate : null,
      recomputeRangeEndDayKey:
        result.changed && args.row.scopeEndDate ? nextDayKey(args.row.scopeEndDate) : null,
      employeeNotFound: false,
      cardMismatch: false,
      invalidOrgValues: false,
      employee: {
        ...args.employee,
        branchId: branch.id,
        employeeGroupId: group.id,
        employeeSubgroupId: subgroup.id,
      },
    };
  } catch (error) {
    if (isEmployeeOrgAssignmentMutationError(error)) {
      return {
        status: "rejected",
        errors: [
          issue(args.row.line, error.code, error.message, {
            employeeCode: args.row.employeeCode,
          }),
        ],
        warnings,
        orgChanged: false,
        recomputeRangeStartDayKey: null,
        recomputeRangeEndDayKey: null,
        employeeNotFound: false,
        cardMismatch: false,
        invalidOrgValues: true,
        employee: args.employee,
      };
    }

    return {
      status: "rejected",
      errors: [
        issue(
          args.row.line,
          "ORG_ASSIGNMENT_APPLY_FAILED",
          error instanceof Error ? error.message : "Organizasyon atamasi uygulanamadi.",
          { employeeCode: args.row.employeeCode },
        ),
      ],
      warnings,
      orgChanged: false,
      recomputeRangeStartDayKey: null,
      recomputeRangeEndDayKey: null,
      employeeNotFound: false,
      cardMismatch: false,
      invalidOrgValues: true,
      employee: args.employee,
    };
  }
}

export async function applyEmployeeOrgImport(args: {
  companyId: string;
  actorUserId: string;
  actorRole: UserRole;
  todayKey: string;
  req?: Request;
  rows: EmployeeImportPreviewRow[];
}) {
  const employeeCodes = Array.from(new Set(args.rows.map((row) => row.employeeCode).filter(Boolean)));
  const branchCodes = Array.from(new Set(args.rows.map((row) => normalizeCode(row.values.branchCode)).filter(Boolean)));
  const groupCodes = Array.from(new Set(args.rows.map((row) => normalizeCode(row.values.employeeGroupCode)).filter(Boolean)));
  const subgroupCodes = Array.from(new Set(args.rows.map((row) => normalizeCode(row.values.employeeSubgroupCode)).filter(Boolean)));

  const [employees, branches, groups, subgroups] = await Promise.all([
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
        cardNo: true,
        branchId: true,
        employeeGroupId: true,
        employeeSubgroupId: true,
      },
    }),
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
  ]);

  const employeeByCode = new Map<string, EmployeeOrgImportEmployeeRecord>(
    employees.map((item) => [item.employeeCode, item]),
  );
  const branchByCode = new Map(branches.map((item) => [normalizeCode(item.code), item]));
  const groupByCode = new Map(groups.map((item) => [normalizeCode(item.code), item]));
  const subgroupByCode = new Map(subgroups.map((item) => [normalizeCode(item.code), item]));

  const errors: EmployeeImportValidationIssue[] = [];
  const warnings: EmployeeImportValidationIssue[] = [];
  const changedEmployeeCodes: string[] = [];
  let recomputeStartDayKey: string | null = null;
  let recomputeEndDayKey: string | null = null;
  let recomputeHasOpenEnd = false;

  const summary: EmployeeOrgImportApplySummary = {
    requested: args.rows.length,
    found: 0,
    changed: 0,
    unchanged: 0,
    rejected: 0,
    orgChanged: 0,
    employeeNotFound: 0,
    cardMismatch: 0,
    invalidOrgValues: 0,
    recomputeQueued: false,
  };

  for (const row of args.rows) {
    const employee = employeeByCode.get(row.employeeCode) ?? null;
    if (employee) summary.found += 1;

    const rowResult = await prisma.$transaction((tx) =>
      applyEmployeeOrgImportRow({
        tx,
        companyId: args.companyId,
        todayKey: args.todayKey,
        row,
        employee,
        branchByCode,
        groupByCode,
        subgroupByCode,
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

    if (rowResult.invalidOrgValues) {
      summary.rejected += 1;
      summary.invalidOrgValues += 1;
      continue;
    }

    if (rowResult.employee) {
      employeeByCode.set(row.employeeCode, rowResult.employee);
    }

    if (rowResult.status === "changed") {
      summary.changed += 1;
      summary.orgChanged += 1;
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
      kind: "EMPLOYEE_ORG_IMPORT_PATCH_8_9",
      requested: summary.requested,
      found: summary.found,
      changed: summary.changed,
      unchanged: summary.unchanged,
      rejected: summary.rejected,
      orgChanged: summary.orgChanged,
      employeeNotFound: summary.employeeNotFound,
      cardMismatch: summary.cardMismatch,
      invalidOrgValues: summary.invalidOrgValues,
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
