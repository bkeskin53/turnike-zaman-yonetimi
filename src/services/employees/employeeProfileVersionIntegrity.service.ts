import { prisma } from "@/src/repositories/prisma";
import {
  resolveEmployeeHistoricalSnapshot,
  type EmployeeProfileVersionPayload,
} from "@/src/services/employeeHistory.service";
import { nextDayKey, toDayKey } from "@/src/services/employees/finiteRangeHistoryMutation.util";

function sameProfilePayload(a: EmployeeProfileVersionPayload, b: EmployeeProfileVersionPayload): boolean {
  return (
    a.employeeCode === b.employeeCode &&
    a.cardNo === b.cardNo &&
    a.firstName === b.firstName &&
    a.lastName === b.lastName &&
    a.email === b.email &&
    a.nationalId === b.nationalId &&
    a.phone === b.phone &&
    a.gender === b.gender
  );
}

function buildFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function payloadFromEmployee(employee: {
  employeeCode: string;
  cardNo: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  nationalId: string | null;
  phone: string | null;
  gender: string | null;
}): EmployeeProfileVersionPayload {
  return {
    employeeCode: employee.employeeCode,
    cardNo: employee.cardNo ?? null,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email ?? null,
    nationalId: employee.nationalId ?? null,
    phone: employee.phone ?? null,
    gender: employee.gender ?? null,
  };
}

function payloadFromVersionRow(row: {
  employeeCode: string;
  cardNo: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  nationalId: string | null;
  phone: string | null;
  gender: string | null;
}): EmployeeProfileVersionPayload {
  return {
    employeeCode: row.employeeCode,
    cardNo: row.cardNo ?? null,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email ?? null,
    nationalId: row.nationalId ?? null,
    phone: row.phone ?? null,
    gender: row.gender ?? null,
  };
}

export type EmployeeProfileVersionIntegrityIssueCode =
  | "NO_PROFILE_VERSIONS"
  | "NO_ACTIVE_FOR_TODAY"
  | "MULTIPLE_ACTIVE_FOR_TODAY"
  | "OVERLAP_WITH_PREVIOUS"
  | "GAP_WITH_PREVIOUS"
  | "MERGEABLE_ADJACENT_DUPLICATE"
  | "CURRENT_MIRROR_MISMATCH"
  | "SNAPSHOT_USING_CURRENT_FALLBACK";

export type EmployeeProfileVersionIntegrityIssue = {
  code: EmployeeProfileVersionIntegrityIssueCode;
  severity: "error" | "warning";
  message: string;
  recordId?: string | null;
  relatedRecordId?: string | null;
};

export class EmployeeProfileVersionIntegrityError extends Error {
  code: "EMPLOYEE_NOT_FOUND";

  constructor(code: "EMPLOYEE_NOT_FOUND", message: string) {
    super(message);
    this.name = "EmployeeProfileVersionIntegrityError";
    this.code = code;
  }
}

export function isEmployeeProfileVersionIntegrityError(
  error: unknown,
): error is EmployeeProfileVersionIntegrityError {
  return error instanceof EmployeeProfileVersionIntegrityError;
}

export async function inspectEmployeeProfileVersionIntegrity(args: {
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
      email: true,
      nationalId: true,
      phone: true,
      gender: true,
    },
  });

  if (!employee) {
    throw new EmployeeProfileVersionIntegrityError("EMPLOYEE_NOT_FOUND", "Çalışan kaydı bulunamadı.");
  }

  const rows = await prisma.employeeProfileVersion.findMany({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
    },
    orderBy: [{ validFrom: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      validFrom: true,
      validTo: true,
      employeeCode: true,
      cardNo: true,
      firstName: true,
      lastName: true,
      email: true,
      nationalId: true,
      phone: true,
      gender: true,
      createdAt: true,
      updatedAt: true,
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

  const issues: EmployeeProfileVersionIntegrityIssue[] = [];

  if (rows.length === 0) {
    issues.push({
      code: "NO_PROFILE_VERSIONS",
      severity: "error",
      message: "Çalışan için hiç kimlik sürümü kaydı bulunamadı.",
    });
  }

  if (activeRows.length === 0) {
    issues.push({
      code: "NO_ACTIVE_FOR_TODAY",
      severity: "error",
      message: "Bugün için aktif kimlik sürümü bulunamadı.",
    });
  }

  if (activeRows.length > 1) {
    issues.push({
      code: "MULTIPLE_ACTIVE_FOR_TODAY",
      severity: "error",
      message: "Bugünü kapsayan birden fazla kimlik sürümü bulundu.",
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
        message: "Kayıt başlangıcı önceki kaydın geçerlilik aralığı ile çakışıyor.",
        recordId: current.id,
        relatedRecordId: previous.id,
      });
    } else if (nextDayKey(previousValidToDayKey) < currentValidFromDayKey) {
      issues.push({
        code: "GAP_WITH_PREVIOUS",
        severity: "error",
        message: "Önceki kayıt ile bu kayıt arasında boş gün aralığı var.",
        recordId: current.id,
        relatedRecordId: previous.id,
      });
    }

    if (
      previousValidToDayKey !== null &&
      nextDayKey(previousValidToDayKey) === currentValidFromDayKey &&
      sameProfilePayload(payloadFromVersionRow(previous), payloadFromVersionRow(current))
    ) {
      issues.push({
        code: "MERGEABLE_ADJACENT_DUPLICATE",
        severity: "warning",
        message: "Komşu iki kayıt aynı payload'ı taşıyor; tek aralıkta birleştirilebilir.",
        recordId: current.id,
        relatedRecordId: previous.id,
      });
    }
  }

  if (resolvedSnapshot?.meta.profileSource === "CURRENT_FALLBACK") {
    issues.push({
      code: "SNAPSHOT_USING_CURRENT_FALLBACK",
      severity: "warning",
      message: "Bugünkü snapshot version yerine current employee mirror üzerinden çözülüyor.",
    });
  }

  if (activeRows.length === 1) {
    const activePayload = payloadFromVersionRow(activeRows[0]);
    if (!sameProfilePayload(activePayload, currentMirror)) {
      issues.push({
        code: "CURRENT_MIRROR_MISMATCH",
        severity: "error",
        message: "Current employee mirror, bugün aktif olan kimlik sürümüyle uyuşmuyor.",
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
        sameProfilePayload(payloadFromVersionRow(previous), payloadFromVersionRow(row))
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
      payload: payloadFromVersionRow(row),
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
    resolvedSnapshot: resolvedSnapshot ? {
      profile: resolvedSnapshot.profile,
      meta: resolvedSnapshot.meta,
    } : null,
    activeVersionRecordIds: activeRows.map((row) => row.id),
    items,
    issues,
  };
}