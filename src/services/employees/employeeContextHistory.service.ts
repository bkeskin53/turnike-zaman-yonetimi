import { DateTime } from "luxon";
import { Prisma, RecomputeReason, WorkScheduleAssignmentScope } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { dbDateFromDayKey } from "@/src/utils/dayKey";
import {
  backfillEmployeeHistoryForEmployee,
  resolveEmployeeHistoricalSnapshot,
} from "@/src/services/employeeHistory.service";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import {
  applyEmployeeProfileVersionChange,
  mergeAdjacentEmployeeProfileVersions,
  isEmployeeProfileVersionCurrentSyncError,
  syncEmployeeCurrentProfileFromHistory,
} from "@/src/services/employees/employeeProfileVersionMutation.service";
import {
  applyEmployeeOrgAssignmentChange,
  ensureEmployeeEmployedOnDay as ensureEmployeeEmployedOnDayForOrg,
  isEmployeeOrgAssignmentMutationError,
  mergeAdjacentEmployeeOrgAssignments,
  requireCompleteOrgContext,
  syncEmployeeCurrentOrgMirrorFromHistory,
  validateEmployeeOrgContext,
} from "@/src/services/employeeOrgAssignmentMutation.service";
import {
  applyEmployeeWorkScheduleAssignmentChange,
  ensureEmployeeEmployedOnDay as ensureEmployeeEmployedOnDayForWorkSchedule,
  ensureEmployeeExists as ensureEmployeeExistsForWorkSchedule,
  isEmployeeWorkScheduleAssignmentMutationError,
  validateWorkSchedulePattern,
} from "@/src/services/employees/employeeWorkScheduleAssignmentMutation.service";
import { nextDayKey, previousDayKey, toDayKey } from "@/src/services/employees/finiteRangeHistoryMutation.util";

type Tx = Prisma.TransactionClient;

type WorkScheduleHistoryPattern = Prisma.WorkSchedulePatternGetPayload<{
  select: {
    id: true;
    code: true;
    name: true;
    cycleLengthDays: true;
    dayShiftTemplateIds: true;
    days: {
      select: {
        dayIndex: true;
        shiftTemplateId: true;
      };
    };
  };
}>;

type WorkScheduleHistoryShiftTemplate = {
  id: string;
  startTime: string;
  endTime: string;
  spansMidnight: boolean;
};

function historyMinutesFromTimeString(v: string | null | undefined): number | null {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function historyShiftDurationMinutes(args: {
  startTime: string | null | undefined;
  endTime: string | null | undefined;
  spansMidnight?: boolean | null | undefined;
}): number | null {
  const start = historyMinutesFromTimeString(args.startTime);
  const end = historyMinutesFromTimeString(args.endTime);
  if (start == null || end == null) return null;
  let diff = end - start;
  if (args.spansMidnight || diff < 0) diff += 24 * 60;
  if (diff < 0) return null;
  return diff;
}

function historyFormatHoursLabelFromMinutes(minutes: number): string {
  const h = minutes / 60;
  if (Number.isInteger(h)) return `${h} sa`;
  return `${h.toFixed(1).replace(".", ",")} sa`;
}

function normalizeHistoryPatternDayTemplateIds(
  pattern: WorkScheduleHistoryPattern,
): Array<string | null> {
  const cycle = Number(pattern?.cycleLengthDays ?? 0);
  if (!Number.isInteger(cycle) || cycle <= 0) return [];

  const rows = Array.isArray(pattern?.days) ? pattern.days : [];
  if (rows.length > 0) {
    const out = Array.from({ length: cycle }, () => null as string | null);
    for (const row of rows) {
      const idx = Number(row?.dayIndex);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cycle) continue;
      const tplId = row?.shiftTemplateId ? String(row.shiftTemplateId).trim() : "";
      out[idx] = tplId || null;
    }
    return out;
  }

  const legacy = Array.isArray(pattern?.dayShiftTemplateIds) ? pattern.dayShiftTemplateIds : [];
  return Array.from({ length: cycle }, (_, idx) => {
    const raw = String(legacy[idx] ?? "").trim();
    return raw || null;
  });
}

function summarizeHistoryWorkSchedule(args: {
  pattern: WorkScheduleHistoryPattern | null | undefined;
  templatesById: Map<string, WorkScheduleHistoryShiftTemplate>;
}): {
  timeManagementStatus: string | null;
  dailyWorkLabel: string;
  weeklyWorkLabel: string;
  weeklyWorkDaysLabel: string;
} {
  const pattern = args.pattern;
  if (!pattern) {
    return {
      timeManagementStatus: null,
      dailyWorkLabel: "—",
      weeklyWorkLabel: "—",
      weeklyWorkDaysLabel: "—",
    };
  }

  const dayTemplateIds = normalizeHistoryPatternDayTemplateIds(pattern);
  const cycle = dayTemplateIds.length;
  if (cycle === 0) {
    return {
      timeManagementStatus: null,
      dailyWorkLabel: "—",
      weeklyWorkLabel: "—",
      weeklyWorkDaysLabel: "—",
    };
  }

  const durations: Array<number | null> = dayTemplateIds.map((tplId) => {
    if (!tplId) return null;
    const tpl = args.templatesById.get(tplId);
    if (!tpl) return null;
    return historyShiftDurationMinutes({
      startTime: tpl.startTime,
      endTime: tpl.endTime,
      spansMidnight: tpl.spansMidnight,
    });
  });

  const workedDurations = durations.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0,
  );
  const uniqueWorkedDurations = Array.from(new Set(workedDurations));

  const dailyWorkLabel =
    workedDurations.length === 0
      ? "—"
      : uniqueWorkedDurations.length === 1
        ? historyFormatHoursLabelFromMinutes(uniqueWorkedDurations[0])
        : "Değişken";

  const weeklyBuckets =
    cycle % 7 === 0
      ? Array.from({ length: cycle / 7 }, (_, weekIndex) => {
          const slice = durations.slice(weekIndex * 7, weekIndex * 7 + 7);
          const totalMinutes = slice.reduce<number>(
            (acc, v) => acc + (typeof v === "number" && Number.isFinite(v) ? v : 0),
            0,
          );
          const workDays = slice.reduce<number>(
            (acc, v) => acc + (typeof v === "number" && Number.isFinite(v) && v > 0 ? 1 : 0),
            0,
          );
          return { totalMinutes, workDays };
        })
      : [];

  const weeklyMinutesValues: number[] = Array.from(new Set(weeklyBuckets.map((x) => x.totalMinutes)));
  const weeklyWorkDaysValues: number[] = Array.from(new Set(weeklyBuckets.map((x) => x.workDays)));

  const weeklyWorkLabel =
    weeklyBuckets.length === 0
      ? "Değişken"
      : weeklyMinutesValues.length === 1
        ? historyFormatHoursLabelFromMinutes(weeklyMinutesValues[0])
        : "Değişken";

  const weeklyWorkDaysLabel =
    weeklyBuckets.length === 0
      ? "Değişken"
      : weeklyWorkDaysValues.length === 1
        ? `${weeklyWorkDaysValues[0]} gün`
        : "Değişken";

  return {
    timeManagementStatus: null,
    dailyWorkLabel,
    weeklyWorkLabel,
    weeklyWorkDaysLabel,
  };
}

export type EmployeeHistoryListEmployee = {
  id: string;
  employeeCode: string;
  cardNo: string | null;
  fullName: string;
};

export type EmployeeMasterHistoryItem = {
  id: string;
  recordId: string;
  dayKey: string;
  title: string;
  subtitle: string;
  rangeLabel: string | null;
  createdAt: string;
  updatedAt: string;
  createdAtLabel: string;
  updatedAtLabel: string;
  detail: {
    scopeStartDate: string;
    scopeEndDate: string | null;
    employeeCode: string;
    cardNo: string;
    firstName: string;
    lastName: string;
    nationalId: string;
    gender: string;
    email: string;
    phone: string;
  };
};

export type EmployeeAssignmentsHistoryItem = {
  id: string;
  recordId: string;
  dayKey: string;
  title: string;
  subtitle: string;
  rangeLabel: string | null;
  createdAt: string;
  updatedAt: string;
  createdAtLabel: string;
  updatedAtLabel: string;
  detail: {
    scopeStartDate: string;
    scopeEndDate: string | null;
    branchId: string;
    employeeGroupId: string;
    employeeSubgroupId: string;
  };
};

export type EmployeeProfileHistoryItem = {
  id: string;
  recordId: string;
  dayKey: string;
  title: string;
  subtitle: string;
  rangeLabel: string | null;
  createdAt: string;
  updatedAt: string;
  createdAtLabel: string;
  updatedAtLabel: string;
  detail: {
    scopeStartDate: string;
    scopeEndDate: string | null;
    workSchedulePatternId: string;
    workScheduleLabel: string;
    timeManagementStatus: string | null;
    dailyWorkLabel: string;
    weeklyWorkLabel: string;
    weeklyWorkDaysLabel: string;
  };
};

export type EmployeeMasterHistoryListResult = {
  employee: EmployeeHistoryListEmployee;
  todayDayKey: string;
  items: EmployeeMasterHistoryItem[];
};

export type EmployeeAssignmentsHistoryListResult = {
  employee: EmployeeHistoryListEmployee;
  todayDayKey: string;
  items: EmployeeAssignmentsHistoryItem[];
};

export type EmployeeProfileHistoryListResult = {
  employee: EmployeeHistoryListEmployee;
  todayDayKey: string;
  items: EmployeeProfileHistoryItem[];
};

export type EmployeeMasterHistoryPayload = {
  scopeStartDate: string;
  firstName: string;
  lastName: string;
  nationalId: string | null;
  gender: string | null;
  email: string | null;
  phone: string | null;
};

export type EmployeeAssignmentsHistoryPayload = {
  scopeStartDate: string;
  branchId: string;
  employeeGroupId: string;
  employeeSubgroupId: string;
};

export type EmployeeProfileHistoryPayload = {
  scopeStartDate: string;
  workSchedulePatternId: string;
};

export type EmployeeContextHistoryMutationErrorCode =
  | "EMPLOYEE_NOT_FOUND"
  | "RECORD_NOT_FOUND"
  | "RECORD_ALREADY_EXISTS_FOR_DATE"
  | "MULTIPLE_ACTIVE_ORG_ASSIGNMENTS_FOR_TODAY"
  | "NO_ACTIVE_ORG_ASSIGNMENT_FOR_TODAY"
  | "MULTIPLE_ACTIVE_PROFILE_VERSIONS_FOR_TODAY"
  | "MULTIPLE_ACTIVE_WORK_SCHEDULE_ASSIGNMENTS_FOR_TODAY"
  | "NO_ACTIVE_WORK_SCHEDULE_ASSIGNMENT_FOR_TODAY"
  | "NO_ACTIVE_PROFILE_VERSION_FOR_TODAY"
  | "SCOPE_START_DATE_OVERLAPS_PREVIOUS_RANGE"
  | "SCOPE_START_DATE_AFTER_RANGE_END";

export class EmployeeContextHistoryMutationError extends Error {
  code: EmployeeContextHistoryMutationErrorCode;

  constructor(code: EmployeeContextHistoryMutationErrorCode, message: string) {
    super(message);
    this.name = "EmployeeContextHistoryMutationError";
    this.code = code;
  }
}

export function isEmployeeContextHistoryMutationError(
  error: unknown,
): error is EmployeeContextHistoryMutationError {
  return error instanceof EmployeeContextHistoryMutationError;
}

function buildFullName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  return `${String(firstName ?? "").trim()} ${String(lastName ?? "").trim()}`.trim();
}

function nonEmptyParts(parts: Array<string | null | undefined>): string {
  return parts.map((part) => String(part ?? "").trim()).filter(Boolean).join(" · ");
}

function buildEmployeeSummary(args: {
  id: string;
  employeeCode: string;
  cardNo?: string | null;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
}): EmployeeHistoryListEmployee {
  return {
    id: args.id,
    employeeCode: args.employeeCode,
    cardNo: args.cardNo ?? null,
    fullName: buildFullName(args.firstName, args.lastName) || args.employeeCode,
  };
}

function buildRangeLabel(validFrom: Date | null | undefined, validTo: Date | null | undefined): string | null {
  const fromKey = toDayKey(validFrom);
  const toKey = toDayKey(validTo);
  if (!fromKey && !toKey) return null;
  if (fromKey && toKey) return `${fromKey} → ${toKey}`;
  if (fromKey) return `${fromKey} → Açık`;
  return toKey ? `→ ${toKey}` : null;
}

function formatDateTimeLabel(value: Date, timezone: string): string {
  return DateTime.fromJSDate(value, { zone: "utc" }).setZone(timezone).setLocale("tr").toFormat("dd.MM.yyyy HH:mm");
}

function minDayKey(left: string, right: string): string {
  return left <= right ? left : right;
}

function assertScopeStartFitsExistingRange(args: {
  scopeStartDate: string;
  scopeEndDate: string | null;
}) {
  if (args.scopeEndDate && args.scopeStartDate > args.scopeEndDate) {
    throw new EmployeeContextHistoryMutationError(
      "SCOPE_START_DATE_AFTER_RANGE_END",
      "Geçerlilik başlangıcı mevcut bitiş tarihinden sonra olamaz.",
    );
  }
}

function assertNoHistoryRecordStartsOnSameDay(args: {
  existingDayKeys: string[];
  scopeStartDate: string;
}) {
  if (args.existingDayKeys.includes(args.scopeStartDate)) {
    throw new EmployeeContextHistoryMutationError(
      "RECORD_ALREADY_EXISTS_FOR_DATE",
      "Bu tarih için zaten bir kayıt var. Mevcut tarihçe kaydını değiştirmek için yeni kayıt yerine düzenle kullanılmalıdır.",
    );
  }
}

function assertScopeStartDoesNotOverlapPreviousRange(args: {
  previousScopeStartDate: string | null;
  scopeStartDate: string;
}) {
  if (args.previousScopeStartDate && args.scopeStartDate <= args.previousScopeStartDate) {
    throw new EmployeeContextHistoryMutationError(
      "SCOPE_START_DATE_OVERLAPS_PREVIOUS_RANGE",
      "Geçerlilik başlangıcı önceki kaydın başlangıç tarihinin üstüne taşınamaz.",
    );
  }
}

async function loadEmployeeOrThrow(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
}) {
  const employee = await args.tx.employee.findFirst({
    where: { companyId: args.companyId, id: args.employeeId },
    select: {
      id: true,
      employeeCode: true,
      cardNo: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!employee) {
    throw new EmployeeContextHistoryMutationError("EMPLOYEE_NOT_FOUND", "Çalışan kaydı bulunamadı.");
  }

  return employee;
}

async function loadMasterHistoryRecordOrThrow(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
  recordId: string;
}) {
  const row = await args.tx.employeeProfileVersion.findFirst({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
      id: args.recordId,
    },
    select: {
      id: true,
      validFrom: true,
      validTo: true,
      createdAt: true,
      updatedAt: true,
      firstName: true,
      lastName: true,
      nationalId: true,
      gender: true,
      email: true,
      phone: true,
    },
  });

  if (!row) {
    throw new EmployeeContextHistoryMutationError("RECORD_NOT_FOUND", "Seçilen kimlik kaydı bulunamadı.");
  }

  return row;
}

async function syncEmployeeCurrentOrgMirrorFromHistoryOrThrow(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
  dayKey: string;
}) {
  try {
    return await syncEmployeeCurrentOrgMirrorFromHistory({
      tx: args.tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      mirrorDayKey: args.dayKey,
      strict: true,
    });
  } catch (error) {
    if (isEmployeeOrgAssignmentMutationError(error)) {
      if (error.code === "EMPLOYEE_NOT_FOUND") {
        throw new EmployeeContextHistoryMutationError("EMPLOYEE_NOT_FOUND", "Çalışan kaydı bulunamadı.");
      }
      if (error.code === "MULTIPLE_ACTIVE_ORG_ASSIGNMENTS_FOR_DAY") {
        throw new EmployeeContextHistoryMutationError(
          "MULTIPLE_ACTIVE_ORG_ASSIGNMENTS_FOR_TODAY",
          "Bugün için birden fazla aktif organizasyon ataması bulunduğu için güncel çalışan özeti güncellenemedi.",
        );
      }
      if (error.code === "NO_ACTIVE_ORG_ASSIGNMENT_FOR_DAY") {
        throw new EmployeeContextHistoryMutationError("NO_ACTIVE_ORG_ASSIGNMENT_FOR_TODAY", "Bugün için aktif organizasyon ataması bulunamadı.");
      }
    }
    throw error;
  }
}

async function loadMasterHistoryBoundaryRows(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
}) {
  return args.tx.employeeProfileVersion.findMany({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
    },
    orderBy: [{ validFrom: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      validFrom: true,
      validTo: true,
    },
  });
}

async function syncEmployeeCurrentProfileFromHistoryOrThrow(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
  dayKey: string;
}) {
  try {
    return await syncEmployeeCurrentProfileFromHistory({
      tx: args.tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      dayKey: args.dayKey,
      strict: true,
    });
  } catch (error) {
    if (isEmployeeProfileVersionCurrentSyncError(error)) {
      if (error.code === "EMPLOYEE_NOT_FOUND") {
        throw new EmployeeContextHistoryMutationError("EMPLOYEE_NOT_FOUND", "Çalışan kaydı bulunamadı.");
      }
      if (error.code === "MULTIPLE_ACTIVE_PROFILE_VERSIONS_FOR_DAY") {
        throw new EmployeeContextHistoryMutationError(
          "MULTIPLE_ACTIVE_PROFILE_VERSIONS_FOR_TODAY",
          "Bugün için birden fazla aktif kimlik sürümü bulunduğu için güncel çalışan özeti güncellenemedi.",
        );
      }
      if (error.code === "NO_ACTIVE_PROFILE_VERSION_FOR_DAY") {
        throw new EmployeeContextHistoryMutationError(
          "NO_ACTIVE_PROFILE_VERSION_FOR_TODAY",
          "Bugün için aktif kimlik sürümü bulunamadığı için güncel çalışan özeti güncellenemedi.",
        );
      }
    }
    throw error;
  }
}

async function loadAssignmentsHistoryBoundaryRows(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
}) {
  return args.tx.employeeOrgAssignment.findMany({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
    },
    orderBy: [{ validFrom: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      validFrom: true,
      validTo: true,
    },
  });
}

async function loadProfileHistoryBoundaryRows(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
}) {
  return args.tx.workScheduleAssignment.findMany({
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
      patternId: true,
    },
  });
}

function isProfileHistoryActiveOnDay(
  row: { validFrom: Date | null; validTo: Date | null },
  dayKey: string,
): boolean {
  const fromKey = toDayKey(row.validFrom);
  const toKey = toDayKey(row.validTo);
  if (fromKey && fromKey > dayKey) return false;
  if (!toKey) return true;
  return toKey >= dayKey;
}

function maxNullableHistoryDayKey(a: string | null, b: string | null): string | null {
  if (!a || !b) return null;
  return a >= b ? a : b;
}

function isAdjacentOrOverlappingProfileHistory(args: {
  previous: { validTo: Date | null };
  next: { validFrom: Date | null };
}) {
  const previousEnd = toDayKey(args.previous.validTo);
  const nextStart = toDayKey(args.next.validFrom);
  if (!nextStart) return false;
  if (!previousEnd) return true;
  return nextDayKey(previousEnd) >= nextStart;
}

async function mergeAdjacentProfileHistoryRows(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
}) {
  while (true) {
    const rows = await loadProfileHistoryBoundaryRows(args);
    let merged = false;

    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1];
      const current = rows[index];
      if (previous.patternId !== current.patternId) continue;
      if (!isAdjacentOrOverlappingProfileHistory({ previous, next: current })) continue;

      const mergedValidTo = maxNullableHistoryDayKey(toDayKey(previous.validTo), toDayKey(current.validTo));

      await args.tx.workScheduleAssignment.update({
        where: { id: previous.id },
        data: { validTo: mergedValidTo ? dbDateFromDayKey(mergedValidTo) : null },
        select: { id: true },
      });

      await args.tx.workScheduleAssignment.delete({
        where: { id: current.id },
        select: { id: true },
      });

      merged = true;
      break;
    }

    if (!merged) break;
  }
}

async function assertNoMultipleActiveProfileHistoryForToday(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
  dayKey: string;
}) {
  const rows = await loadProfileHistoryBoundaryRows(args);
  const activeRows = rows.filter((row) => isProfileHistoryActiveOnDay(row, args.dayKey));
  if (activeRows.length > 1) {
    throw new EmployeeContextHistoryMutationError(
      "MULTIPLE_ACTIVE_WORK_SCHEDULE_ASSIGNMENTS_FOR_TODAY",
      "Bugün için birden fazla aktif vardiya planı kaydı bulundu.",
    );
  }
}

export async function listEmployeeMasterHistory(args: {
  companyId: string;
  employeeId: string;
  todayDayKey: string;
  timezone: string;
}): Promise<EmployeeMasterHistoryListResult> {
  const employee = await prisma.employee.findFirst({
    where: { companyId: args.companyId, id: args.employeeId },
    select: {
      id: true,
      employeeCode: true,
      cardNo: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!employee) {
    throw new EmployeeContextHistoryMutationError("EMPLOYEE_NOT_FOUND", "Çalışan kaydı bulunamadı.");
  }

  const currentSnapshot = await resolveEmployeeHistoricalSnapshot({
    companyId: args.companyId,
    employeeId: args.employeeId,
    dayKey: args.todayDayKey,
  });

  const rows = await prisma.employeeProfileVersion.findMany({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
    },
    orderBy: [{ validFrom: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      validFrom: true,
      validTo: true,
      createdAt: true,
      updatedAt: true,
      employeeCode: true,
      cardNo: true,
      firstName: true,
      lastName: true,
      nationalId: true,
      gender: true,
      email: true,
      phone: true,
    },
  });

  const currentSummarySource = currentSnapshot
    ? {
        id: employee.id,
        employeeCode: employee.employeeCode,
        cardNo: employee.cardNo,
        firstName: currentSnapshot.profile.firstName,
        lastName: currentSnapshot.profile.lastName,
      }
    : employee;

  return {
    employee: buildEmployeeSummary(currentSummarySource),
    todayDayKey: args.todayDayKey,
    items: rows.flatMap((row, index) => {
      const dayKey = toDayKey(row.validFrom);
      if (!dayKey) return [];

      const title = index === rows.length - 1 ? "İlk kimlik kaydı" : "Kimlik bilgisi kaydı";
      const subtitle =
        nonEmptyParts([
          buildFullName(row.firstName, row.lastName) || null,
          row.email ? `E-posta: ${row.email}` : null,
          row.phone ? `Telefon: ${row.phone}` : null,
        ]) || "Kimlik bilgisi kaydı";

      return [
        {
          id: `master:${row.id}`,
          recordId: row.id,
          dayKey,
          title,
          subtitle,
          rangeLabel: buildRangeLabel(row.validFrom, row.validTo),
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          createdAtLabel: formatDateTimeLabel(row.createdAt, args.timezone),
          updatedAtLabel: formatDateTimeLabel(row.updatedAt, args.timezone),
          detail: {
            scopeStartDate: dayKey,
            scopeEndDate: toDayKey(row.validTo),
            employeeCode: row.employeeCode,
            cardNo: row.cardNo ?? "",
            firstName: row.firstName,
            lastName: row.lastName,
            nationalId: row.nationalId ?? "",
            gender: row.gender ?? "",
            email: row.email ?? "",
            phone: row.phone ?? "",
          },
        } satisfies EmployeeMasterHistoryItem,
      ];
    }),
  };
}

export async function createEmployeeMasterHistoryRecord(args: {
  companyId: string;
  employeeId: string;
  actorUserId: string;
  todayDayKey: string;
  payload: EmployeeMasterHistoryPayload;
}) {
  return prisma.$transaction(async (tx) => {
    const employee = await loadEmployeeOrThrow({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    await backfillEmployeeHistoryForEmployee({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    const rows = await loadMasterHistoryBoundaryRows({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    assertNoHistoryRecordStartsOnSameDay({
      existingDayKeys: rows.map((row) => toDayKey(row.validFrom)).filter((value): value is string => Boolean(value)),
      scopeStartDate: args.payload.scopeStartDate,
    });

    const result = await applyEmployeeProfileVersionChange({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      effectiveDayKey: args.payload.scopeStartDate,
      payload: {
        employeeCode: employee.employeeCode,
        cardNo: employee.cardNo ?? null,
        firstName: args.payload.firstName,
        lastName: args.payload.lastName,
        nationalId: args.payload.nationalId,
        gender: args.payload.gender,
        email: args.payload.email,
        phone: args.payload.phone,
      },
    });

    await syncEmployeeCurrentProfileFromHistoryOrThrow({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      dayKey: args.todayDayKey,
    });

    await tx.employeeAction.create({
      data: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        type: "UPDATE",
        effectiveDate: dbDateFromDayKey(args.payload.scopeStartDate),
        note: "Kimlik bilgileri tarihçesine yeni kayıt eklendi.",
        actorUserId: args.actorUserId,
        details: {
          surface: "MASTER_HISTORY",
          mode: "HISTORY_CREATE",
          profileVersionId: result.versionId,
          effectiveDayKey: args.payload.scopeStartDate,
          mutationMode: result.mode,
          fields: ["firstName", "lastName", "nationalId", "gender", "email", "phone"],
        },
      },
      select: { id: true },
    });

    return {
      recordId: result.versionId,
      effectiveDayKey: args.payload.scopeStartDate,
    };
  });
}

export async function updateEmployeeMasterHistoryRecord(args: {
  companyId: string;
  employeeId: string;
  recordId: string;
  actorUserId: string;
  todayDayKey: string;
  payload: EmployeeMasterHistoryPayload;
}) {
  return prisma.$transaction(async (tx) => {
    await loadEmployeeOrThrow({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    const row = await loadMasterHistoryRecordOrThrow({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      recordId: args.recordId,
    });

    const rows = await loadMasterHistoryBoundaryRows({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    assertNoHistoryRecordStartsOnSameDay({
      existingDayKeys: rows
        .filter((candidate) => candidate.id !== row.id)
        .map((candidate) => toDayKey(candidate.validFrom))
        .filter((value): value is string => Boolean(value)),
      scopeStartDate: args.payload.scopeStartDate,
    });

    const rowIndex = rows.findIndex((candidate) => candidate.id === row.id);
    const previousRow = rowIndex > 0 ? rows[rowIndex - 1] : null;
    const previousRowStartDayKey = previousRow ? toDayKey(previousRow.validFrom) : null;

    assertScopeStartFitsExistingRange({
      scopeStartDate: args.payload.scopeStartDate,
      scopeEndDate: toDayKey(row.validTo),
    });

    assertScopeStartDoesNotOverlapPreviousRange({
      previousScopeStartDate: previousRowStartDayKey,
      scopeStartDate: args.payload.scopeStartDate,
    });

    if (previousRow) {
      await tx.employeeProfileVersion.update({
        where: { id: previousRow.id },
        data: { validTo: dbDateFromDayKey(previousDayKey(args.payload.scopeStartDate)) },
        select: { id: true },
      });
    }

    const updated = await tx.employeeProfileVersion.update({
      where: { id: row.id },
      data: {
        validFrom: dbDateFromDayKey(args.payload.scopeStartDate),
        firstName: args.payload.firstName,
        lastName: args.payload.lastName,
        nationalId: args.payload.nationalId,
        gender: args.payload.gender,
        email: args.payload.email,
        phone: args.payload.phone,
      },
      select: {
        id: true,
        validFrom: true,
      },
    });

    await mergeAdjacentEmployeeProfileVersions({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    await syncEmployeeCurrentProfileFromHistoryOrThrow({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      dayKey: args.todayDayKey,
    });

    await tx.employeeAction.create({
      data: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        type: "UPDATE",
        effectiveDate: dbDateFromDayKey(args.payload.scopeStartDate),
        note: "Kimlik bilgileri tarihçesindeki seçili kayıt güncellendi.",
        actorUserId: args.actorUserId,
        details: {
          surface: "MASTER_HISTORY",
          mode: "HISTORY_UPDATE_IN_PLACE",
          profileVersionId: row.id,
          previousEffectiveDayKey: toDayKey(row.validFrom),
          effectiveDayKey: args.payload.scopeStartDate,
          fields: ["firstName", "lastName", "nationalId", "gender", "email", "phone"],
        },
      },
      select: { id: true },
    });

    return {
      recordId: updated.id,
      effectiveDayKey: toDayKey(updated.validFrom),
    };
  });
}

export async function deleteEmployeeMasterHistoryRecord(args: {
  companyId: string;
  employeeId: string;
  recordId: string;
  actorUserId: string;
  todayDayKey: string;
}) {
  return prisma.$transaction(async (tx) => {
    await loadEmployeeOrThrow({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    const row = await loadMasterHistoryRecordOrThrow({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      recordId: args.recordId,
    });

    const rows = await loadMasterHistoryBoundaryRows({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    const rowIndex = rows.findIndex((candidate) => candidate.id === row.id);
    const previousRow = rowIndex > 0 ? rows[rowIndex - 1] : null;

    await tx.employeeProfileVersion.delete({
      where: { id: row.id },
      select: { id: true },
    });

    if (previousRow) {
      await tx.employeeProfileVersion.update({
        where: { id: previousRow.id },
        data: { validTo: row.validTo },
        select: { id: true },
      });
    }

    await mergeAdjacentEmployeeProfileVersions({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    await syncEmployeeCurrentProfileFromHistoryOrThrow({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      dayKey: args.todayDayKey,
    });

    await tx.employeeAction.create({
      data: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        type: "UPDATE",
        effectiveDate: row.validFrom,
        note: "Kimlik bilgileri tarihçesindeki seçili kayıt silindi.",
        actorUserId: args.actorUserId,
        details: {
          surface: "MASTER_HISTORY",
          mode: "HISTORY_DELETE",
          profileVersionId: row.id,
          effectiveDayKey: toDayKey(row.validFrom),
        },
      },
      select: { id: true },
    });

    return {
      deletedRecordId: row.id,
      effectiveDayKey: toDayKey(row.validFrom),
    };
  });
}

async function loadAssignmentsHistoryRecordOrThrow(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
  recordId: string;
}) {
  const row = await args.tx.employeeOrgAssignment.findFirst({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
      id: args.recordId,
    },
    select: {
      id: true,
      validFrom: true,
      validTo: true,
      createdAt: true,
      updatedAt: true,
      branchId: true,
      employeeGroupId: true,
      employeeSubgroupId: true,
    },
  });

  if (!row) {
    throw new EmployeeContextHistoryMutationError("RECORD_NOT_FOUND", "Seçilen organizasyon kaydı bulunamadı.");
  }

  return row;
}

export async function listEmployeeAssignmentsHistory(args: {
  companyId: string;
  employeeId: string;
  todayDayKey: string;
  timezone: string;
}): Promise<EmployeeAssignmentsHistoryListResult> {
  const employee = await prisma.employee.findFirst({
    where: { companyId: args.companyId, id: args.employeeId },
    select: {
      id: true,
      employeeCode: true,
      cardNo: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!employee) {
    throw new EmployeeContextHistoryMutationError("EMPLOYEE_NOT_FOUND", "Çalışan kaydı bulunamadı.");
  }

  const rows = await prisma.employeeOrgAssignment.findMany({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
    },
    orderBy: [{ validFrom: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      validFrom: true,
      validTo: true,
      createdAt: true,
      updatedAt: true,
      branchId: true,
      employeeGroupId: true,
      employeeSubgroupId: true,
      branch: { select: { code: true, name: true } },
      employeeGroup: { select: { code: true, name: true } },
      employeeSubgroup: { select: { code: true, name: true } },
    },
  });

  return {
    employee: buildEmployeeSummary(employee),
    todayDayKey: args.todayDayKey,
    items: rows.flatMap((row, index) => {
      const dayKey = toDayKey(row.validFrom);
      if (!dayKey) return [];

      const title = index === rows.length - 1 ? "İlk organizasyon kaydı" : "Organizasyon kaydı";
      const subtitle =
        nonEmptyParts([
          row.branch ? `${row.branch.code} · ${row.branch.name}` : null,
          row.employeeGroup ? `Grup: ${row.employeeGroup.code}` : null,
          row.employeeSubgroup ? `Alt grup: ${row.employeeSubgroup.code}` : null,
        ]) || "Organizasyon kaydı";

      return [
        {
          id: `assignments:${row.id}`,
          recordId: row.id,
          dayKey,
          title,
          subtitle,
          rangeLabel: buildRangeLabel(row.validFrom, row.validTo),
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          createdAtLabel: formatDateTimeLabel(row.createdAt, args.timezone),
          updatedAtLabel: formatDateTimeLabel(row.updatedAt, args.timezone),
          detail: {
            scopeStartDate: dayKey,
            scopeEndDate: toDayKey(row.validTo),
            branchId: row.branchId ?? "",
            employeeGroupId: row.employeeGroupId ?? "",
            employeeSubgroupId: row.employeeSubgroupId ?? "",
          },
        } satisfies EmployeeAssignmentsHistoryItem,
      ];
    }),
  };
}

export async function createEmployeeAssignmentsHistoryRecord(args: {
  companyId: string;
  employeeId: string;
  actorUserId: string;
  todayDayKey: string;
  payload: EmployeeAssignmentsHistoryPayload;
}) {
  const result = await prisma.$transaction(async (tx) => {
    await loadEmployeeOrThrow({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    await ensureEmployeeEmployedOnDayForOrg({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      effectiveDayKey: args.payload.scopeStartDate,
    });

    await backfillEmployeeHistoryForEmployee({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    const rows = await loadAssignmentsHistoryBoundaryRows({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    assertNoHistoryRecordStartsOnSameDay({
      existingDayKeys: rows.map((row) => toDayKey(row.validFrom)).filter((value): value is string => Boolean(value)),
      scopeStartDate: args.payload.scopeStartDate,
    });

    const payload = requireCompleteOrgContext(
      await validateEmployeeOrgContext({
        tx,
        companyId: args.companyId,
        payload: {
          branchId: args.payload.branchId,
          employeeGroupId: args.payload.employeeGroupId,
          employeeSubgroupId: args.payload.employeeSubgroupId,
        },
      }),
    );

    const mutation = await applyEmployeeOrgAssignmentChange({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      effectiveDayKey: args.payload.scopeStartDate,
      mirrorDayKey: args.todayDayKey,
      payload,
      enforceEmploymentOnEffectiveDate: false,
      strictMirrorSync: true,
    });

    const created = mutation.assignmentId
      ? await tx.employeeOrgAssignment.findUnique({
          where: { id: mutation.assignmentId },
          select: {
            id: true,
            validFrom: true,
            validTo: true,
          },
        })
      : null;

    if (!created) {
      throw new Error("ORG_ASSIGNMENT_NOT_FOUND_AFTER_MUTATION");
    }

    await syncEmployeeCurrentOrgMirrorFromHistoryOrThrow({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      dayKey: args.todayDayKey,
    });

    await tx.employeeAction.create({
      data: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        type: "UPDATE",
        effectiveDate: dbDateFromDayKey(args.payload.scopeStartDate),
        note: "Organizasyon tarihçesine yeni kayıt eklendi.",
        actorUserId: args.actorUserId,
        details: {
          surface: "ASSIGNMENTS_HISTORY",
          mode: "HISTORY_CREATE",
          assignmentId: created.id,
          effectiveDayKey: args.payload.scopeStartDate,
          validToDayKey: toDayKey(created.validTo),
          mutationStatus: mutation.status,
          mergedPairCount: mutation.mergedPairCount,
          mirrorChanged: mutation.mirrorChanged,
          fields: ["branchId", "employeeGroupId", "employeeSubgroupId"],
        },
      },
      select: { id: true },
    });

    return {
      recordId: created.id,
      effectiveDayKey: toDayKey(created.validFrom) ?? args.payload.scopeStartDate,
    };
  });

  await markRecomputeRequired({
    companyId: args.companyId,
    reason: RecomputeReason.WORKFORCE_UPDATED,
    createdByUserId: args.actorUserId,
    rangeStartDayKey: args.payload.scopeStartDate,
    rangeEndDayKey: null,
  });

  return result;
}

export async function updateEmployeeAssignmentsHistoryRecord(args: {
  companyId: string;
  employeeId: string;
  recordId: string;
  actorUserId: string;
  todayDayKey: string;
  payload: EmployeeAssignmentsHistoryPayload;
}) {
  const result = await prisma.$transaction(async (tx) => {
    await loadEmployeeOrThrow({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    const row = await loadAssignmentsHistoryRecordOrThrow({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      recordId: args.recordId,
    });

    const rows = await loadAssignmentsHistoryBoundaryRows({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    assertNoHistoryRecordStartsOnSameDay({
      existingDayKeys: rows
        .filter((candidate) => candidate.id !== row.id)
        .map((candidate) => toDayKey(candidate.validFrom))
        .filter((value): value is string => Boolean(value)),
      scopeStartDate: args.payload.scopeStartDate,
    });

    const rowIndex = rows.findIndex((candidate) => candidate.id === row.id);
    const previousRow = rowIndex > 0 ? rows[rowIndex - 1] : null;
    const previousRowStartDayKey = previousRow ? toDayKey(previousRow.validFrom) : null;

    const payload = requireCompleteOrgContext(
      await validateEmployeeOrgContext({
        tx,
        companyId: args.companyId,
        payload: {
          branchId: args.payload.branchId,
          employeeGroupId: args.payload.employeeGroupId,
          employeeSubgroupId: args.payload.employeeSubgroupId,
        },
      }),
    );

    await ensureEmployeeEmployedOnDayForOrg({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      effectiveDayKey: args.payload.scopeStartDate,
    });

    assertScopeStartFitsExistingRange({
      scopeStartDate: args.payload.scopeStartDate,
      scopeEndDate: toDayKey(row.validTo),
    });

    assertScopeStartDoesNotOverlapPreviousRange({
      previousScopeStartDate: previousRowStartDayKey,
      scopeStartDate: args.payload.scopeStartDate,
    });

    if (previousRow) {
      await tx.employeeOrgAssignment.update({
        where: { id: previousRow.id },
        data: { validTo: dbDateFromDayKey(previousDayKey(args.payload.scopeStartDate)) },
        select: { id: true },
      });
    }

    const updated = await tx.employeeOrgAssignment.update({
      where: { id: row.id },
      data: {
        validFrom: dbDateFromDayKey(args.payload.scopeStartDate),
        branchId: payload.branchId,
        employeeGroupId: payload.employeeGroupId,
        employeeSubgroupId: payload.employeeSubgroupId,
      },
      select: {
        id: true,
        validFrom: true,
      },
    });

    await mergeAdjacentEmployeeOrgAssignments({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    await syncEmployeeCurrentOrgMirrorFromHistoryOrThrow({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      dayKey: args.todayDayKey,
    });

    await tx.employeeAction.create({
      data: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        type: "UPDATE",
        effectiveDate: dbDateFromDayKey(args.payload.scopeStartDate),
        note: "Organizasyon tarihçesindeki seçili kayıt güncellendi.",
        actorUserId: args.actorUserId,
        details: {
          surface: "ASSIGNMENTS_HISTORY",
          mode: "HISTORY_UPDATE_IN_PLACE",
          assignmentId: row.id,
          previousEffectiveDayKey: toDayKey(row.validFrom),
          effectiveDayKey: args.payload.scopeStartDate,
          fields: ["branchId", "employeeGroupId", "employeeSubgroupId"],
        },
      },
      select: { id: true },
    });

    return {
      recordId: updated.id,
      previousEffectiveDayKey: toDayKey(row.validFrom) ?? args.payload.scopeStartDate,
      effectiveDayKey: toDayKey(updated.validFrom) ?? args.payload.scopeStartDate,
    };
  });

  await markRecomputeRequired({
    companyId: args.companyId,
    reason: RecomputeReason.WORKFORCE_UPDATED,
    createdByUserId: args.actorUserId,
    rangeStartDayKey: minDayKey(result.previousEffectiveDayKey, result.effectiveDayKey),
    rangeEndDayKey: null,
  });

  return result;
}

export async function deleteEmployeeAssignmentsHistoryRecord(args: {
  companyId: string;
  employeeId: string;
  recordId: string;
  actorUserId: string;
  todayDayKey: string;
}) {
  const result = await prisma.$transaction(async (tx) => {
    await loadEmployeeOrThrow({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    const row = await loadAssignmentsHistoryRecordOrThrow({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      recordId: args.recordId,
    });

    const rows = await loadAssignmentsHistoryBoundaryRows({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    const rowIndex = rows.findIndex((candidate) => candidate.id === row.id);
    const previousRow = rowIndex > 0 ? rows[rowIndex - 1] : null;

    await tx.employeeOrgAssignment.delete({
      where: { id: row.id },
      select: { id: true },
    });

    if (previousRow) {
      await tx.employeeOrgAssignment.update({
        where: { id: previousRow.id },
        data: { validTo: row.validTo },
        select: { id: true },
      });
    }

    await mergeAdjacentEmployeeOrgAssignments({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    await syncEmployeeCurrentOrgMirrorFromHistoryOrThrow({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      dayKey: args.todayDayKey,
    });

    await tx.employeeAction.create({
      data: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        type: "UPDATE",
        effectiveDate: row.validFrom,
        note: "Organizasyon tarihçesindeki seçili kayıt silindi.",
        actorUserId: args.actorUserId,
        details: {
          surface: "ASSIGNMENTS_HISTORY",
          mode: "HISTORY_DELETE",
          assignmentId: row.id,
          effectiveDayKey: toDayKey(row.validFrom),
        },
      },
      select: { id: true },
    });

    return {
      deletedRecordId: row.id,
      effectiveDayKey: toDayKey(row.validFrom) ?? args.todayDayKey,
    };
  });

  await markRecomputeRequired({
    companyId: args.companyId,
    reason: RecomputeReason.WORKFORCE_UPDATED,
    createdByUserId: args.actorUserId,
    rangeStartDayKey: result.effectiveDayKey,
    rangeEndDayKey: null,
  });

  return result;
}

async function loadProfileHistoryRecordOrThrow(args: {
  tx: Tx;
  companyId: string;
  employeeId: string;
  recordId: string;
}) {
  const row = await args.tx.workScheduleAssignment.findFirst({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
      scope: WorkScheduleAssignmentScope.EMPLOYEE,
      id: args.recordId,
    },
    select: {
      id: true,
      validFrom: true,
      validTo: true,
      createdAt: true,
      updatedAt: true,
      patternId: true,
    },
  });

  if (!row) {
    throw new EmployeeContextHistoryMutationError("RECORD_NOT_FOUND", "Seçilen vardiya kaydı bulunamadı.");
  }

  return row;
}

function rethrowProfileHistoryMutationError(error: unknown): never {
  if (isEmployeeWorkScheduleAssignmentMutationError(error)) {
    if (error.code === "EMPLOYEE_NOT_FOUND") {
      throw new EmployeeContextHistoryMutationError("EMPLOYEE_NOT_FOUND", "Çalışan kaydı bulunamadı.");
    }
    if (error.code === "MULTIPLE_ACTIVE_WORK_SCHEDULE_ASSIGNMENTS_FOR_DAY") {
      throw new EmployeeContextHistoryMutationError(
        "MULTIPLE_ACTIVE_WORK_SCHEDULE_ASSIGNMENTS_FOR_TODAY",
        "Bugün için birden fazla aktif vardiya planı kaydı bulundu.",
      );
    }
    if (error.code === "NO_ACTIVE_WORK_SCHEDULE_ASSIGNMENT_FOR_DAY") {
      throw new EmployeeContextHistoryMutationError(
        "NO_ACTIVE_WORK_SCHEDULE_ASSIGNMENT_FOR_TODAY",
        "Bugün için aktif vardiya planı kaydı bulunamadı.",
      );
    }
    if (error.code === "EMPLOYEE_NOT_EMPLOYED_ON_EFFECTIVE_DATE") {
      throw new EmployeeContextHistoryMutationError("SCOPE_START_DATE_AFTER_RANGE_END", error.message);
    }
  }

  throw error;
}

export async function listEmployeeProfileHistory(args: {
  companyId: string;
  employeeId: string;
  todayDayKey: string;
  timezone: string;
}): Promise<EmployeeProfileHistoryListResult> {
  const employee = await prisma.employee.findFirst({
    where: { companyId: args.companyId, id: args.employeeId },
    select: {
      id: true,
      employeeCode: true,
      cardNo: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!employee) {
    throw new EmployeeContextHistoryMutationError("EMPLOYEE_NOT_FOUND", "Çalışan kaydı bulunamadı.");
  }

  const rows = await prisma.workScheduleAssignment.findMany({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
      scope: WorkScheduleAssignmentScope.EMPLOYEE,
    },
    orderBy: [{ validFrom: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
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
          cycleLengthDays: true,
          dayShiftTemplateIds: true,
          days: {
            select: {
              dayIndex: true,
              shiftTemplateId: true,
            },
          },
        },
      },
    },
  });

  const shiftTemplateIds = Array.from(
    new Set(
      rows.flatMap((row) => {
        if (!row.pattern) return [];
        return normalizeHistoryPatternDayTemplateIds(row.pattern).filter(
          (id): id is string => Boolean(id),
        );
      }),
    ),
  );

  const shiftTemplates = shiftTemplateIds.length
    ? await prisma.shiftTemplate.findMany({
        where: {
          companyId: args.companyId,
          id: { in: shiftTemplateIds },
        },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          spansMidnight: true,
        },
      })
    : [];

  const shiftTemplatesById = new Map(
    shiftTemplates.map((template) => [template.id, template] as const),
  );

  return {
    employee: buildEmployeeSummary(employee),
    todayDayKey: args.todayDayKey,
    items: rows.flatMap((row, index) => {
      const dayKey = toDayKey(row.validFrom ?? row.createdAt);
      if (!dayKey) return [];

      const workScheduleLabel =
        nonEmptyParts([row.pattern?.code ?? null, row.pattern?.name ?? null]) || "Çalışma planı kaydı";
      const workScheduleSummary = summarizeHistoryWorkSchedule({
        pattern: row.pattern,
        templatesById: shiftTemplatesById,
      });
      return [
        {
          id: `profile:${row.id}`,
          recordId: row.id,
          dayKey,
          title: index === rows.length - 1 ? "İlk vardiya kaydı" : "Vardiya kaydı",
          subtitle: workScheduleLabel,
          rangeLabel: buildRangeLabel(row.validFrom ?? row.createdAt, row.validTo),
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          createdAtLabel: formatDateTimeLabel(row.createdAt, args.timezone),
          updatedAtLabel: formatDateTimeLabel(row.updatedAt, args.timezone),
          detail: {
            scopeStartDate: dayKey,
            scopeEndDate: toDayKey(row.validTo),
            workSchedulePatternId: row.patternId,
            workScheduleLabel,
            timeManagementStatus: workScheduleSummary.timeManagementStatus,
            dailyWorkLabel: workScheduleSummary.dailyWorkLabel,
            weeklyWorkLabel: workScheduleSummary.weeklyWorkLabel,
            weeklyWorkDaysLabel: workScheduleSummary.weeklyWorkDaysLabel,
          },
        } satisfies EmployeeProfileHistoryItem,
      ];
    }),
  };
}

export async function createEmployeeProfileHistoryRecord(args: {
  companyId: string;
  employeeId: string;
  actorUserId: string;
  payload: EmployeeProfileHistoryPayload;
}) {
  const result = await prisma.$transaction(async (tx) => {
    await ensureEmployeeExistsForWorkSchedule({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    const patternId = await validateWorkSchedulePattern({
      tx,
      companyId: args.companyId,
      patternId: args.payload.workSchedulePatternId,
    });

    await ensureEmployeeEmployedOnDayForWorkSchedule({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      effectiveDayKey: args.payload.scopeStartDate,
    });

    const rows = await loadProfileHistoryBoundaryRows({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    assertNoHistoryRecordStartsOnSameDay({
      existingDayKeys: rows.map((row) => toDayKey(row.validFrom)).filter((value): value is string => Boolean(value)),
      scopeStartDate: args.payload.scopeStartDate,
    });

    let mutation;
    try {
      mutation = await applyEmployeeWorkScheduleAssignmentChange({
        tx,
        companyId: args.companyId,
        employeeId: args.employeeId,
        patternId,
        effectiveDayKey: args.payload.scopeStartDate,
        enforceEmploymentOnEffectiveDate: false,
        strictResolve: true,
      });
    } catch (error) {
      rethrowProfileHistoryMutationError(error);
    }

    const created = mutation.assignmentId
      ? await tx.workScheduleAssignment.findUnique({
          where: { id: mutation.assignmentId },
          select: {
            id: true,
            validFrom: true,
            validTo: true,
            patternId: true,
          },
        })
      : null;

    if (!created) {
      throw new Error("WORK_SCHEDULE_ASSIGNMENT_NOT_FOUND_AFTER_MUTATION");
    }

    await assertNoMultipleActiveProfileHistoryForToday({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      dayKey: args.payload.scopeStartDate >= args.payload.scopeStartDate ? args.payload.scopeStartDate : args.payload.scopeStartDate,
    });

    await assertNoMultipleActiveProfileHistoryForToday({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      dayKey: DateTime.now().toISODate() ?? args.payload.scopeStartDate,
    });

    await tx.employeeAction.create({
      data: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        type: "UPDATE",
        effectiveDate: dbDateFromDayKey(args.payload.scopeStartDate),
        note: "Vardiya tarihçesine yeni kayıt eklendi.",
        actorUserId: args.actorUserId,
        details: {
          surface: "PROFILE_HISTORY",
          mode: "HISTORY_CREATE",
          workScheduleAssignmentId: created.id,
          patternId,
          effectiveDayKey: args.payload.scopeStartDate,
          validToDayKey: toDayKey(created.validTo),
          mutationStatus: mutation.status,
          mergedPairCount: mutation.mergedPairCount,
          fields: ["workSchedulePatternId"],
        },
      },
      select: { id: true },
    });

    return {
      recordId: created.id,
      effectiveDayKey: toDayKey(created.validFrom) ?? args.payload.scopeStartDate,
    };
  });

  await markRecomputeRequired({
    companyId: args.companyId,
    reason: RecomputeReason.WORK_SCHEDULE_UPDATED,
    createdByUserId: args.actorUserId,
    rangeStartDayKey: args.payload.scopeStartDate,
    rangeEndDayKey: null,
  });

  return result;
}

export async function updateEmployeeProfileHistoryRecord(args: {
  companyId: string;
  employeeId: string;
  recordId: string;
  actorUserId: string;
  payload: EmployeeProfileHistoryPayload;
}) {
  const result = await prisma.$transaction(async (tx) => {
    await ensureEmployeeExistsForWorkSchedule({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    const row = await loadProfileHistoryRecordOrThrow({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      recordId: args.recordId,
    });

    const patternId = await validateWorkSchedulePattern({
      tx,
      companyId: args.companyId,
      patternId: args.payload.workSchedulePatternId,
    });

    await ensureEmployeeEmployedOnDayForWorkSchedule({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      effectiveDayKey: args.payload.scopeStartDate,
    });

    const rows = await loadProfileHistoryBoundaryRows({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    assertNoHistoryRecordStartsOnSameDay({
      existingDayKeys: rows
        .filter((candidate) => candidate.id !== row.id)
        .map((candidate) => toDayKey(candidate.validFrom))
        .filter((value): value is string => Boolean(value)),
      scopeStartDate: args.payload.scopeStartDate,
    });

    const rowIndex = rows.findIndex((candidate) => candidate.id === row.id);
    const previousRow = rowIndex > 0 ? rows[rowIndex - 1] : null;
    const previousRowStartDayKey = previousRow ? toDayKey(previousRow.validFrom) : null;

    assertScopeStartFitsExistingRange({
      scopeStartDate: args.payload.scopeStartDate,
      scopeEndDate: toDayKey(row.validTo),
    });

    assertScopeStartDoesNotOverlapPreviousRange({
      previousScopeStartDate: previousRowStartDayKey,
      scopeStartDate: args.payload.scopeStartDate,
    });

    if (previousRow) {
      await tx.workScheduleAssignment.update({
        where: { id: previousRow.id },
        data: { validTo: dbDateFromDayKey(previousDayKey(args.payload.scopeStartDate)) },
        select: { id: true },
      });
    }

    const updated = await tx.workScheduleAssignment.update({
      where: { id: row.id },
      data: {
        validFrom: dbDateFromDayKey(args.payload.scopeStartDate),
        patternId,
      },
      select: {
        id: true,
        validFrom: true,
      },
    });

    await mergeAdjacentProfileHistoryRows({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    await assertNoMultipleActiveProfileHistoryForToday({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      dayKey: DateTime.now().toISODate() ?? args.payload.scopeStartDate,
    });

    await tx.employeeAction.create({
      data: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        type: "UPDATE",
        effectiveDate: dbDateFromDayKey(args.payload.scopeStartDate),
        note: "Vardiya tarihçesindeki seçili kayıt güncellendi.",
        actorUserId: args.actorUserId,
        details: {
          surface: "PROFILE_HISTORY",
          mode: "HISTORY_UPDATE_IN_PLACE",
          workScheduleAssignmentId: row.id,
          previousEffectiveDayKey: toDayKey(row.validFrom),
          effectiveDayKey: args.payload.scopeStartDate,
          patternId,
          fields: ["workSchedulePatternId"],
        },
      },
      select: { id: true },
    });

    return {
      recordId: updated.id,
      previousEffectiveDayKey: toDayKey(row.validFrom) ?? args.payload.scopeStartDate,
      effectiveDayKey: toDayKey(updated.validFrom) ?? args.payload.scopeStartDate,
    };
  });

  await markRecomputeRequired({
    companyId: args.companyId,
    reason: RecomputeReason.WORK_SCHEDULE_UPDATED,
    createdByUserId: args.actorUserId,
    rangeStartDayKey: minDayKey(result.previousEffectiveDayKey, result.effectiveDayKey),
    rangeEndDayKey: null,
  });

  return result;
}

export async function deleteEmployeeProfileHistoryRecord(args: {
  companyId: string;
  employeeId: string;
  recordId: string;
  actorUserId: string;
}) {
  const result = await prisma.$transaction(async (tx) => {
    await ensureEmployeeExistsForWorkSchedule({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    const row = await loadProfileHistoryRecordOrThrow({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      recordId: args.recordId,
    });

    const rows = await loadProfileHistoryBoundaryRows({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    const rowIndex = rows.findIndex((candidate) => candidate.id === row.id);
    const previousRow = rowIndex > 0 ? rows[rowIndex - 1] : null;

    await tx.workScheduleAssignment.delete({
      where: { id: row.id },
      select: { id: true },
    });
    
    if (previousRow) {
      await tx.workScheduleAssignment.update({
        where: { id: previousRow.id },
        data: { validTo: row.validTo },
        select: { id: true },
      });
    }

    await mergeAdjacentProfileHistoryRows({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    await assertNoMultipleActiveProfileHistoryForToday({
      tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
      dayKey: DateTime.now().toISODate() ?? toDayKey(row.validFrom ?? row.createdAt) ?? DateTime.now().toISODate()!,
    });

    await tx.employeeAction.create({
      data: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        type: "UPDATE",
        effectiveDate: row.validFrom ?? row.createdAt,
        note: "Vardiya tarihçesindeki seçili kayıt silindi.",
        actorUserId: args.actorUserId,
        details: {
          surface: "PROFILE_HISTORY",
          mode: "HISTORY_DELETE",
          workScheduleAssignmentId: row.id,
          effectiveDayKey: toDayKey(row.validFrom ?? row.createdAt),
        },
      },
      select: { id: true },
    });

    return {
      deletedRecordId: row.id,
      effectiveDayKey: toDayKey(row.validFrom ?? row.createdAt),
    };
  });

  await markRecomputeRequired({
    companyId: args.companyId,
    reason: RecomputeReason.WORK_SCHEDULE_UPDATED,
    createdByUserId: args.actorUserId,
    rangeStartDayKey: result.effectiveDayKey ?? DateTime.now().toISODate()!,
    rangeEndDayKey: null,
  });

  return result;
}
