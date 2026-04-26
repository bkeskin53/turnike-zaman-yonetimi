import { prisma } from "@/src/repositories/prisma";
import {
  resolveEmployeeHistoricalSnapshot,
  type EmployeeOrgContext,
} from "@/src/services/employeeHistory.service";
import { nextDayKey, toDayKey } from "@/src/services/employees/finiteRangeHistoryMutation.util";

function sameOrgContext(a: EmployeeOrgContext, b: EmployeeOrgContext): boolean {
  return (
    (a.branchId ?? null) === (b.branchId ?? null) &&
    (a.employeeGroupId ?? null) === (b.employeeGroupId ?? null) &&
    (a.employeeSubgroupId ?? null) === (b.employeeSubgroupId ?? null)
  );
}

function payloadFromEmployee(employee: {
  branchId: string | null;
  employeeGroupId: string | null;
  employeeSubgroupId: string | null;
}): EmployeeOrgContext {
  return {
    branchId: employee.branchId ?? null,
    employeeGroupId: employee.employeeGroupId ?? null,
    employeeSubgroupId: employee.employeeSubgroupId ?? null,
  };
}

function payloadFromRow(row: {
  branchId: string | null;
  employeeGroupId: string | null;
  employeeSubgroupId: string | null;
}): EmployeeOrgContext {
  return {
    branchId: row.branchId ?? null,
    employeeGroupId: row.employeeGroupId ?? null,
    employeeSubgroupId: row.employeeSubgroupId ?? null,
  };
}

function buildFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export type EmployeeOrgAssignmentIntegrityIssueCode =
  | "NO_ASSIGNMENTS"
  | "NO_ACTIVE_FOR_TODAY"
  | "MULTIPLE_ACTIVE_FOR_TODAY"
  | "OVERLAP_WITH_PREVIOUS"
  | "GAP_WITH_PREVIOUS"
  | "MERGEABLE_ADJACENT_DUPLICATE"
  | "CURRENT_MIRROR_MISMATCH"
  | "SNAPSHOT_USING_CURRENT_FALLBACK"
  | "SUBGROUP_GROUP_MISMATCH_IN_CHAIN";

export type EmployeeOrgAssignmentIntegrityIssue = {
  code: EmployeeOrgAssignmentIntegrityIssueCode;
  severity: "error" | "warning";
  message: string;
  recordId?: string | null;
  relatedRecordId?: string | null;
  meta?: Record<string, unknown>;
};

export class EmployeeOrgAssignmentIntegrityError extends Error {
  code: "EMPLOYEE_NOT_FOUND";

  constructor(code: "EMPLOYEE_NOT_FOUND", message: string) {
    super(message);
    this.name = "EmployeeOrgAssignmentIntegrityError";
    this.code = code;
  }
}

export function isEmployeeOrgAssignmentIntegrityError(
  error: unknown,
): error is EmployeeOrgAssignmentIntegrityError {
  return error instanceof EmployeeOrgAssignmentIntegrityError;
}

export async function inspectEmployeeOrgAssignmentIntegrity(args: {
  companyId: string;
  employeeId: string;
  todayDayKey: string;
}) {
  const employee = await prisma.employee.findFirst({
    where: {
      companyId: args.companyId,
      id: args.employeeId,
    },
    select: {
      id: true,
      employeeCode: true,
      cardNo: true,
      firstName: true,
      lastName: true,
      branchId: true,
      employeeGroupId: true,
      employeeSubgroupId: true,
    },
  });

  if (!employee) {
    throw new EmployeeOrgAssignmentIntegrityError("EMPLOYEE_NOT_FOUND", "Çalışan kaydı bulunamadı.");
  }

  const rows = await prisma.employeeOrgAssignment.findMany({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
    },
    orderBy: [{ validFrom: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      validFrom: true,
      validTo: true,
      branchId: true,
      employeeGroupId: true,
      employeeSubgroupId: true,
      createdAt: true,
      updatedAt: true,
      branch: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      employeeGroup: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      employeeSubgroup: {
        select: {
          id: true,
          code: true,
          name: true,
          groupId: true,
        },
      },
    },
  });

  const resolvedSnapshot = await resolveEmployeeHistoricalSnapshot({
    companyId: args.companyId,
    employeeId: args.employeeId,
    dayKey: args.todayDayKey,
  });

  const currentMirror = payloadFromEmployee(employee);
  const activeRows = rows.filter((row) => {
    const validFromDayKey = toDayKey(row.validFrom);
    const validToDayKey = toDayKey(row.validTo);
    if (!validFromDayKey) return false;
    return validFromDayKey <= args.todayDayKey && (!validToDayKey || validToDayKey >= args.todayDayKey);
  });

  const issues: EmployeeOrgAssignmentIntegrityIssue[] = [];

  if (rows.length === 0) {
    issues.push({
      code: "NO_ASSIGNMENTS",
      severity: "error",
      message: "Çalışan için hiç organizasyon ataması bulunamadı.",
    });
  }

  if (activeRows.length === 0) {
    issues.push({
      code: "NO_ACTIVE_FOR_TODAY",
      severity: "error",
      message: "Bugün için aktif organizasyon ataması bulunamadı.",
    });
  }

  if (activeRows.length > 1) {
    issues.push({
      code: "MULTIPLE_ACTIVE_FOR_TODAY",
      severity: "error",
      message: "Bugünü kapsayan birden fazla organizasyon ataması bulundu.",
      recordId: activeRows[0]?.id ?? null,
      relatedRecordId: activeRows[1]?.id ?? null,
    });
  }

  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1];
    const current = rows[index];
    const previousValidToDayKey = toDayKey(previous.validTo);
    const currentValidFromDayKey = toDayKey(current.validFrom);
    if (!currentValidFromDayKey) continue;

    if (previousValidToDayKey === null || previousValidToDayKey >= currentValidFromDayKey) {
      issues.push({
        code: "OVERLAP_WITH_PREVIOUS",
        severity: "error",
        message: "Kayıt başlangıcı önceki organizasyon ataması ile çakışıyor.",
        recordId: current.id,
        relatedRecordId: previous.id,
      });
    } else if (nextDayKey(previousValidToDayKey) < currentValidFromDayKey) {
      issues.push({
        code: "GAP_WITH_PREVIOUS",
        severity: "error",
        message: "Önceki organizasyon ataması ile bu kayıt arasında boş gün aralığı var.",
        recordId: current.id,
        relatedRecordId: previous.id,
      });
    }

    if (
      previousValidToDayKey !== null &&
      nextDayKey(previousValidToDayKey) === currentValidFromDayKey &&
      sameOrgContext(payloadFromRow(previous), payloadFromRow(current))
    ) {
      issues.push({
        code: "MERGEABLE_ADJACENT_DUPLICATE",
        severity: "warning",
        message: "Komşu iki organizasyon ataması aynı bağlamı taşıyor; tek aralıkta birleştirilebilir.",
        recordId: current.id,
        relatedRecordId: previous.id,
      });
    }
  }

  for (const row of rows) {
    if (
      row.employeeSubgroup &&
      row.employeeGroupId &&
      row.employeeSubgroup.groupId !== row.employeeGroupId
    ) {
      issues.push({
        code: "SUBGROUP_GROUP_MISMATCH_IN_CHAIN",
        severity: "error",
        message: "Kayıt içindeki alt grup, seçili grupla eşleşmiyor.",
        recordId: row.id,
        meta: {
          employeeGroupId: row.employeeGroupId,
          employeeSubgroupId: row.employeeSubgroupId,
          subgroupGroupId: row.employeeSubgroup.groupId,
        },
      });
    }
  }

  if (resolvedSnapshot?.meta.orgSource === "CURRENT_FALLBACK") {
    issues.push({
      code: "SNAPSHOT_USING_CURRENT_FALLBACK",
      severity: "warning",
      message: "Bugünkü organizasyon snapshot'ı version yerine current employee mirror üzerinden çözülüyor.",
    });
  }

  if (activeRows.length === 1) {
    const activeContext = payloadFromRow(activeRows[0]);
    if (!sameOrgContext(activeContext, currentMirror)) {
      issues.push({
        code: "CURRENT_MIRROR_MISMATCH",
        severity: "error",
        message: "Current employee org mirror, bugün aktif olan organizasyon atamasıyla uyuşmuyor.",
        recordId: activeRows[0].id,
      });
    }
  }

  const items = rows.map((row, index) => {
    const previous = index > 0 ? rows[index - 1] : null;
    const validFromDayKey = toDayKey(row.validFrom);
    const validToDayKey = toDayKey(row.validTo);
    const previousValidToDayKey = previous ? toDayKey(previous.validTo) : null;

    let overlapsPrevious = false;
    let hasGapFromPrevious = false;
    let mergeableWithPrevious = false;

    if (previous && validFromDayKey) {
      if (previousValidToDayKey === null || previousValidToDayKey >= validFromDayKey) {
        overlapsPrevious = true;
      } else if (nextDayKey(previousValidToDayKey) < validFromDayKey) {
        hasGapFromPrevious = true;
      }

      if (
        previousValidToDayKey !== null &&
        nextDayKey(previousValidToDayKey) === validFromDayKey &&
        sameOrgContext(payloadFromRow(previous), payloadFromRow(row))
      ) {
        mergeableWithPrevious = true;
      }
    }

    const coversToday =
      Boolean(validFromDayKey) &&
      validFromDayKey! <= args.todayDayKey &&
      (!validToDayKey || validToDayKey >= args.todayDayKey);

    return {
      id: row.id,
      validFrom: validFromDayKey,
      validTo: validToDayKey,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      context: payloadFromRow(row),
      labels: {
        branch: row.branch ? `${row.branch.code} · ${row.branch.name}` : null,
        employeeGroup: row.employeeGroup ? `${row.employeeGroup.code} · ${row.employeeGroup.name}` : null,
        employeeSubgroup: row.employeeSubgroup ? `${row.employeeSubgroup.code} · ${row.employeeSubgroup.name}` : null,
      },
      diagnostics: {
        coversToday,
        overlapsPrevious,
        hasGapFromPrevious,
        mergeableWithPrevious,
        previousRecordId: previous?.id ?? null,
      },
    };
  });

  return {
    employee: {
      id: employee.id,
      employeeCode: employee.employeeCode,
      cardNo: employee.cardNo,
      fullName: buildFullName(employee.firstName, employee.lastName),
    },
    todayDayKey: args.todayDayKey,
    currentEmployeeMirror: currentMirror,
    resolvedSnapshot: resolvedSnapshot
      ? {
          org: resolvedSnapshot.org,
          meta: resolvedSnapshot.meta,
        }
      : null,
    activeAssignmentRecordIds: activeRows.map((row) => row.id),
    items,
    issues,
  };
}