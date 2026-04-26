import { WorkScheduleAssignmentScope } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { resolveEmployeeHistoricalSnapshot } from "@/src/services/employeeHistory.service";
import { dbDateFromDayKey } from "@/src/utils/dayKey";
import { nextDayKey, toDayKey } from "@/src/services/employees/finiteRangeHistoryMutation.util";

type EmployeeScopeWorkScheduleRow = {
  id: string;
  validFrom: Date | null;
  validTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
  patternId: string;
  pattern: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  } | null;
};

function scopeRank(scope: string): number {
  switch (scope) {
    case "EMPLOYEE":
      return 4;
    case "EMPLOYEE_SUBGROUP":
      return 3;
    case "EMPLOYEE_GROUP":
      return 2;
    case "BRANCH":
      return 1;
    default:
      return 0;
  }
}

function buildFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function isActiveOnDay(row: { validFrom: Date | null; validTo: Date | null }, dayKey: string): boolean {
  const validFromDayKey = toDayKey(row.validFrom);
  const validToDayKey = toDayKey(row.validTo);
  if (validFromDayKey && validFromDayKey > dayKey) return false;
  if (!validToDayKey) return true;
  return validToDayKey >= dayKey;
}

function sameWorkSchedulePayload(a: { patternId: string }, b: { patternId: string }): boolean {
  return a.patternId === b.patternId;
}

export type EmployeeWorkScheduleAssignmentIntegrityIssueCode =
  | "NO_ASSIGNMENTS"
  | "NO_ACTIVE_FOR_TODAY"
  | "MULTIPLE_ACTIVE_FOR_TODAY"
  | "OVERLAP_WITH_PREVIOUS"
  | "GAP_WITH_PREVIOUS"
  | "MERGEABLE_ADJACENT_DUPLICATE"
  | "SNAPSHOT_CHOOSES_ONE_OF_MULTIPLE_ACTIVE";

export type EmployeeWorkScheduleAssignmentIntegrityIssue = {
  code: EmployeeWorkScheduleAssignmentIntegrityIssueCode;
  severity: "error" | "warning";
  message: string;
  recordId?: string | null;
  relatedRecordId?: string | null;
};

export class EmployeeWorkScheduleAssignmentIntegrityError extends Error {
  code: "EMPLOYEE_NOT_FOUND";

  constructor(code: "EMPLOYEE_NOT_FOUND", message: string) {
    super(message);
    this.name = "EmployeeWorkScheduleAssignmentIntegrityError";
    this.code = code;
  }
}

export function isEmployeeWorkScheduleAssignmentIntegrityError(
  error: unknown,
): error is EmployeeWorkScheduleAssignmentIntegrityError {
  return error instanceof EmployeeWorkScheduleAssignmentIntegrityError;
}

export async function inspectEmployeeWorkScheduleAssignmentIntegrity(args: {
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
    },
  });

  if (!employee) {
    throw new EmployeeWorkScheduleAssignmentIntegrityError("EMPLOYEE_NOT_FOUND", "Çalışan kaydı bulunamadı.");
  }

  const employeeScopeRows: EmployeeScopeWorkScheduleRow[] = await prisma.workScheduleAssignment.findMany({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
      scope: WorkScheduleAssignmentScope.EMPLOYEE,
    },
    orderBy: [{ validFrom: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      validFrom: true,
      validTo: true,
      createdAt: true,
      updatedAt: true,
      patternId: true,
      pattern: {
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
        },
      },
    },
  });

  const activeRows = employeeScopeRows.filter((row) => isActiveOnDay(row, args.todayDayKey));
  const issues: EmployeeWorkScheduleAssignmentIntegrityIssue[] = [];

  if (employeeScopeRows.length === 0) {
    issues.push({
      code: "NO_ASSIGNMENTS",
      severity: "error",
      message: "Çalışan için hiç vardiya planı kaydı bulunamadı.",
    });
  }

  if (activeRows.length === 0) {
    issues.push({
      code: "NO_ACTIVE_FOR_TODAY",
      severity: "error",
      message: "Bugün için aktif vardiya planı kaydı bulunamadı.",
    });
  }

  if (activeRows.length > 1) {
    issues.push({
      code: "MULTIPLE_ACTIVE_FOR_TODAY",
      severity: "error",
      message: "Bugünü kapsayan birden fazla vardiya planı kaydı bulundu.",
      recordId: activeRows[0]?.id ?? null,
      relatedRecordId: activeRows[1]?.id ?? null,
    });
  }

  for (let index = 1; index < employeeScopeRows.length; index += 1) {
    const previous = employeeScopeRows[index - 1];
    const current = employeeScopeRows[index];
    const previousValidToDayKey = toDayKey(previous.validTo);
    const currentValidFromDayKey = toDayKey(current.validFrom);
    if (!currentValidFromDayKey) continue;

    if (previousValidToDayKey === null || previousValidToDayKey >= currentValidFromDayKey) {
      issues.push({
        code: "OVERLAP_WITH_PREVIOUS",
        severity: "error",
        message: "Kayıt başlangıcı önceki vardiya planı kaydı ile çakışıyor.",
        recordId: current.id,
        relatedRecordId: previous.id,
      });
    } else if (nextDayKey(previousValidToDayKey) < currentValidFromDayKey) {
      issues.push({
        code: "GAP_WITH_PREVIOUS",
        severity: "error",
        message: "Önceki vardiya planı kaydı ile bu kayıt arasında boş gün aralığı var.",
        recordId: current.id,
        relatedRecordId: previous.id,
      });
    }

    if (
      previousValidToDayKey !== null &&
      nextDayKey(previousValidToDayKey) === currentValidFromDayKey &&
      sameWorkSchedulePayload(previous, current)
    ) {
      issues.push({
        code: "MERGEABLE_ADJACENT_DUPLICATE",
        severity: "warning",
        message: "Komşu iki vardiya planı kaydı aynı pattern’i taşıyor; tek aralıkta birleştirilebilir.",
        recordId: current.id,
        relatedRecordId: previous.id,
      });
    }
  }

  const snapshot = await resolveEmployeeHistoricalSnapshot({
    companyId: args.companyId,
    employeeId: args.employeeId,
    dayKey: args.todayDayKey,
  });

  const requestedDb = dbDateFromDayKey(args.todayDayKey);
  const scopeFilters = [
    { scope: WorkScheduleAssignmentScope.EMPLOYEE, employeeId: args.employeeId },
    ...(snapshot?.org.context.employeeSubgroupId
      ? [{
          scope: WorkScheduleAssignmentScope.EMPLOYEE_SUBGROUP,
          employeeSubgroupId: snapshot.org.context.employeeSubgroupId,
        }]
      : []),
    ...(snapshot?.org.context.employeeGroupId
      ? [{
          scope: WorkScheduleAssignmentScope.EMPLOYEE_GROUP,
          employeeGroupId: snapshot.org.context.employeeGroupId,
        }]
      : []),
    ...(snapshot?.org.context.branchId
      ? [{
          scope: WorkScheduleAssignmentScope.BRANCH,
          branchId: snapshot.org.context.branchId,
        }]
      : []),
  ];

  const resolvedCandidates = await prisma.workScheduleAssignment.findMany({
    where: {
      companyId: args.companyId,
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: requestedDb } }] },
        { OR: [{ validTo: null }, { validTo: { gte: requestedDb } }] },
      ],
      OR: scopeFilters,
    },
    select: {
      id: true,
      scope: true,
      priority: true,
      validFrom: true,
      validTo: true,
      createdAt: true,
      updatedAt: true,
      patternId: true,
      pattern: {
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
        },
      },
    },
  });

  const activeResolvedCandidates = resolvedCandidates.filter((row) => row.pattern?.isActive);
  activeResolvedCandidates.sort((a, b) => {
    const sr = scopeRank(String(a.scope)) - scopeRank(String(b.scope));
    if (sr !== 0) return -sr;
    const pr = (a.priority ?? 0) - (b.priority ?? 0);
    if (pr !== 0) return -pr;
    const updatedDelta = (b.updatedAt?.getTime?.() ?? 0) - (a.updatedAt?.getTime?.() ?? 0);
    if (updatedDelta !== 0) return updatedDelta;
    return (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0);
  });

  const chosenResolved = activeResolvedCandidates[0] ?? null;

  if (
    activeRows.length > 1 &&
    chosenResolved &&
    String(chosenResolved.scope) === "EMPLOYEE" &&
    activeRows.some((row) => row.id === chosenResolved.id)
  ) {
    issues.push({
      code: "SNAPSHOT_CHOOSES_ONE_OF_MULTIPLE_ACTIVE",
      severity: "warning",
      message: "Current çözümleme, birden fazla aktif employee-scope kayıt içinden tek birini seçerek ilerliyor.",
      recordId: chosenResolved.id,
    });
  }

  const items = employeeScopeRows.map((row, index) => {
    const previous = index > 0 ? employeeScopeRows[index - 1] : null;
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
        sameWorkSchedulePayload(previous, row)
      ) {
        mergeableWithPrevious = true;
      }
    }

    const coversToday = isActiveOnDay(row, args.todayDayKey);

    return {
      id: row.id,
      validFrom: validFromDayKey,
      validTo: validToDayKey,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      pattern: row.pattern
        ? {
            id: row.pattern.id,
            code: row.pattern.code,
            name: row.pattern.name,
            isActive: row.pattern.isActive,
          }
        : null,
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
    activeAssignmentRecordIds: activeRows.map((row) => row.id),
    resolvedToday: chosenResolved
      ? {
          assignmentId: chosenResolved.id,
          scope: String(chosenResolved.scope),
          priority: chosenResolved.priority ?? null,
          validFrom: toDayKey(chosenResolved.validFrom),
          validTo: toDayKey(chosenResolved.validTo),
          pattern: chosenResolved.pattern
            ? {
                id: chosenResolved.pattern.id,
                code: chosenResolved.pattern.code,
                name: chosenResolved.pattern.name,
                isActive: chosenResolved.pattern.isActive,
              }
            : null,
        }
      : null,
    items,
    issues,
  };
}