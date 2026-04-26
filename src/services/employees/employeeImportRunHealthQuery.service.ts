import { EmployeeImportRunMode, EmployeeImportRunOutcome, EmployeeImportRunStatus } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { EMPLOYEE_IMPORT_OPERATIONAL_STALE_MINUTES } from "@/src/services/employees/employeeImportRun.service";
import { formatEmployeeImportSheetTitle } from "@/src/features/employees/importTemplate";

export const EMPLOYEE_IMPORT_RUN_HEALTH_RECENT_FAILURE_WINDOW_DAYS = 7;
export const EMPLOYEE_IMPORT_RUN_HEALTH_DUPLICATE_WINDOW_DAYS = 7;
const EMPLOYEE_IMPORT_RUN_HEALTH_REFERENCE_LIMIT = 5;

type EmployeeImportHealthLockRecord = {
  id: string;
  sheetKind: string;
  actorUserId: string;
  acquiredAt: Date;
};

type EmployeeImportHealthRunRecord = {
  id: string;
  sheetKind: string;
  sheetTitle: string;
  actorUserId: string;
  mode: EmployeeImportRunMode;
  status: EmployeeImportRunStatus;
  outcome: EmployeeImportRunOutcome | null;
  startedAt: Date;
  finishedAt: Date | null;
  duplicateOfRunId: string | null;
  failedCode: string | null;
  failedMessage: string | null;
};

export type EmployeeImportRunHealthSeverity = "critical" | "warning" | "info";

export type EmployeeImportRunHealthIssueCode =
  | "STALE_APPLY_LOCK"
  | "ORPHAN_APPLY_LOCK"
  | "STALE_RUNNING_APPLY_RUN"
  | "STALE_RUNNING_DRY_RUN"
  | "RECENT_FAILED_RUN"
  | "RECENT_DUPLICATE_PATTERN";

export type EmployeeImportRunHealthReferenceDto = {
  refType: "LOCK" | "RUN";
  id: string;
  sheetKind: string;
  sheetTitle: string;
  actorUserId: string;
  mode: EmployeeImportRunMode | null;
  status: EmployeeImportRunStatus | null;
  outcome: EmployeeImportRunOutcome | null;
  acquiredAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  failedCode: string | null;
  duplicateOfRunId: string | null;
  recoveryAction: "NORMALIZE_STALE_SHEET_STATE" | null;
  recoverySheetKind: string | null;
};

export type EmployeeImportRunHealthIssueDto = {
  code: EmployeeImportRunHealthIssueCode;
  severity: EmployeeImportRunHealthSeverity;
  title: string;
  message: string;
  count: number;
  references: EmployeeImportRunHealthReferenceDto[];
};

export type EmployeeImportRunHealthSummaryDto = {
  generatedAt: Date;
  staleThresholdMinutes: number;
  recentFailureWindowDays: number;
  duplicatePatternWindowDays: number;
  counts: {
    activeApplyLocks: number;
    runningApplyRuns: number;
    runningDryRuns: number;
    staleApplyLocks: number;
    orphanApplyLocks: number;
    staleRunningApplyRuns: number;
    staleRunningDryRuns: number;
    recentFailedRuns: number;
    recentDuplicateRuns: number;
  };
  issues: EmployeeImportRunHealthIssueDto[];
};

function daysAgo(days: number, now: Date): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function employeeImportOperationalStaleThresholdDate(now: Date = new Date()): Date {
  return new Date(now.getTime() - EMPLOYEE_IMPORT_OPERATIONAL_STALE_MINUTES * 60_000);
}

function toLockReference(lock: EmployeeImportHealthLockRecord): EmployeeImportRunHealthReferenceDto {
  return {
    refType: "LOCK",
    id: lock.id,
    sheetKind: lock.sheetKind,
    sheetTitle: formatEmployeeImportSheetTitle(lock.sheetKind, null),
    actorUserId: lock.actorUserId,
    mode: null,
    status: null,
    outcome: null,
    acquiredAt: lock.acquiredAt,
    startedAt: null,
    finishedAt: null,
    failedCode: null,
    duplicateOfRunId: null,
    recoveryAction: null,
    recoverySheetKind: null,
  };
}

function toRunReference(run: EmployeeImportHealthRunRecord): EmployeeImportRunHealthReferenceDto {
  return {
    refType: "RUN",
    id: run.id,
    sheetKind: run.sheetKind,
    sheetTitle: formatEmployeeImportSheetTitle(run.sheetKind, run.sheetTitle),
    actorUserId: run.actorUserId,
    mode: run.mode,
    status: run.status,
    outcome: run.outcome,
    acquiredAt: null,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    failedCode: run.failedCode,
    duplicateOfRunId: run.duplicateOfRunId,
    recoveryAction: null,
    recoverySheetKind: null,
  };
}

function withSheetOperationalRecovery(
  reference: EmployeeImportRunHealthReferenceDto,
): EmployeeImportRunHealthReferenceDto {
  return {
    ...reference,
    recoveryAction: "NORMALIZE_STALE_SHEET_STATE",
    recoverySheetKind: reference.sheetKind,
  };
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

export function buildEmployeeImportRunHealthSummary(args: {
  locks: EmployeeImportHealthLockRecord[];
  runs: EmployeeImportHealthRunRecord[];
  now?: Date;
}): EmployeeImportRunHealthSummaryDto {
  const now = args.now ?? new Date();
  const staleThreshold = employeeImportOperationalStaleThresholdDate(now);
  const recentFailureThreshold = daysAgo(EMPLOYEE_IMPORT_RUN_HEALTH_RECENT_FAILURE_WINDOW_DAYS, now);
  const duplicatePatternThreshold = daysAgo(EMPLOYEE_IMPORT_RUN_HEALTH_DUPLICATE_WINDOW_DAYS, now);

  const runningApplyRuns = args.runs.filter(
    (run) => run.mode === EmployeeImportRunMode.APPLY && run.status === EmployeeImportRunStatus.RUNNING,
  );
  const runningDryRuns = args.runs.filter(
    (run) => run.mode === EmployeeImportRunMode.DRY_RUN && run.status === EmployeeImportRunStatus.RUNNING,
  );
  const staleApplyLocks = args.locks.filter((lock) => lock.acquiredAt < staleThreshold);
  const staleRunningApplyRuns = runningApplyRuns.filter((run) => run.startedAt < staleThreshold);
  const staleRunningDryRuns = runningDryRuns.filter((run) => run.startedAt < staleThreshold);
  const orphanApplyLocks = args.locks.filter((lock) => {
    if (lock.acquiredAt >= staleThreshold) return false;
    return !runningApplyRuns.some((run) => run.sheetKind === lock.sheetKind);
  });
  const recentFailedRuns = args.runs.filter((run) => {
    if (run.status !== EmployeeImportRunStatus.FAILED) return false;
    const referenceDate = run.finishedAt ?? run.startedAt;
    return referenceDate >= recentFailureThreshold;
  });
  const recentDuplicateRuns = args.runs.filter((run) => {
    if (!run.duplicateOfRunId) return false;
    const referenceDate = run.finishedAt ?? run.startedAt;
    return referenceDate >= duplicatePatternThreshold;
  });

  const issues: EmployeeImportRunHealthIssueDto[] = [];

  if (staleApplyLocks.length > 0) {
    issues.push({
      code: "STALE_APPLY_LOCK",
      severity: "warning",
      title: "Süre aşmış apply kilidi",
      message: `${staleApplyLocks.length} sekmede ${EMPLOYEE_IMPORT_OPERATIONAL_STALE_MINUTES} dakikayı aşan apply kilidi görünüyor.`,
      count: staleApplyLocks.length,
      references: staleApplyLocks
        .slice(0, EMPLOYEE_IMPORT_RUN_HEALTH_REFERENCE_LIMIT)
        .map(toLockReference)
        .map(withSheetOperationalRecovery),
    });
  }

  if (orphanApplyLocks.length > 0) {
    issues.push({
      code: "ORPHAN_APPLY_LOCK",
      severity: "critical",
      title: "Orphan apply kilidi",
      message: `${orphanApplyLocks.length} stale kilit için eşleşen RUNNING apply koşusu bulunamadı.`,
      count: orphanApplyLocks.length,
      references: orphanApplyLocks
        .slice(0, EMPLOYEE_IMPORT_RUN_HEALTH_REFERENCE_LIMIT)
        .map(toLockReference)
        .map(withSheetOperationalRecovery),
    });
  }

  if (staleRunningApplyRuns.length > 0) {
    issues.push({
      code: "STALE_RUNNING_APPLY_RUN",
      severity: "critical",
      title: "Stale running apply koşusu",
      message: `${staleRunningApplyRuns.length} apply koşusu ${EMPLOYEE_IMPORT_OPERATIONAL_STALE_MINUTES} dakikayı aşan RUNNING durumda kaldı.`,
      count: staleRunningApplyRuns.length,
      references: staleRunningApplyRuns
        .slice(0, EMPLOYEE_IMPORT_RUN_HEALTH_REFERENCE_LIMIT)
        .map(toRunReference)
        .map(withSheetOperationalRecovery),
    });
  }

  if (staleRunningDryRuns.length > 0) {
    issues.push({
      code: "STALE_RUNNING_DRY_RUN",
      severity: "warning",
      title: "Stale running kontrol koşusu",
      message: `${staleRunningDryRuns.length} kontrol koşusu ${EMPLOYEE_IMPORT_OPERATIONAL_STALE_MINUTES} dakikayı aşan RUNNING durumda kaldı.`,
      count: staleRunningDryRuns.length,
      references: staleRunningDryRuns
        .slice(0, EMPLOYEE_IMPORT_RUN_HEALTH_REFERENCE_LIMIT)
        .map(toRunReference)
        .map(withSheetOperationalRecovery),
    });
  }

  if (recentFailedRuns.length > 0) {
    issues.push({
      code: "RECENT_FAILED_RUN",
      severity: "warning",
      title: "Yakın tarihli başarısız koşular",
      message: `Son ${EMPLOYEE_IMPORT_RUN_HEALTH_RECENT_FAILURE_WINDOW_DAYS} günde ${recentFailedRuns.length} başarısız import koşusu kaydedildi.`,
      count: recentFailedRuns.length,
      references: uniqueById(recentFailedRuns)
        .slice(0, EMPLOYEE_IMPORT_RUN_HEALTH_REFERENCE_LIMIT)
        .map(toRunReference),
    });
  }

  if (recentDuplicateRuns.length > 0) {
    issues.push({
      code: "RECENT_DUPLICATE_PATTERN",
      severity: "info",
      title: "Benzer içerik paterni",
      message: `Son ${EMPLOYEE_IMPORT_RUN_HEALTH_DUPLICATE_WINDOW_DAYS} günde ${recentDuplicateRuns.length} koşu daha önce görülen içerikle ilişkili bulundu.`,
      count: recentDuplicateRuns.length,
      references: uniqueById(recentDuplicateRuns)
        .slice(0, EMPLOYEE_IMPORT_RUN_HEALTH_REFERENCE_LIMIT)
        .map(toRunReference),
    });
  }

  return {
    generatedAt: now,
    staleThresholdMinutes: EMPLOYEE_IMPORT_OPERATIONAL_STALE_MINUTES,
    recentFailureWindowDays: EMPLOYEE_IMPORT_RUN_HEALTH_RECENT_FAILURE_WINDOW_DAYS,
    duplicatePatternWindowDays: EMPLOYEE_IMPORT_RUN_HEALTH_DUPLICATE_WINDOW_DAYS,
    counts: {
      activeApplyLocks: args.locks.length,
      runningApplyRuns: runningApplyRuns.length,
      runningDryRuns: runningDryRuns.length,
      staleApplyLocks: staleApplyLocks.length,
      orphanApplyLocks: orphanApplyLocks.length,
      staleRunningApplyRuns: staleRunningApplyRuns.length,
      staleRunningDryRuns: staleRunningDryRuns.length,
      recentFailedRuns: recentFailedRuns.length,
      recentDuplicateRuns: recentDuplicateRuns.length,
    },
    issues,
  };
}

export async function getEmployeeImportRunHealthSummary(args: {
  companyId: string;
  now?: Date;
}): Promise<EmployeeImportRunHealthSummaryDto> {
  const now = args.now ?? new Date();
  const recentFailureThreshold = daysAgo(EMPLOYEE_IMPORT_RUN_HEALTH_RECENT_FAILURE_WINDOW_DAYS, now);
  const duplicatePatternThreshold = daysAgo(EMPLOYEE_IMPORT_RUN_HEALTH_DUPLICATE_WINDOW_DAYS, now);

  const [locks, runs] = await Promise.all([
    prisma.employeeImportApplyLock.findMany({
      where: { companyId: args.companyId },
      orderBy: [{ acquiredAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        sheetKind: true,
        actorUserId: true,
        acquiredAt: true,
      },
    }),
    prisma.employeeImportRun.findMany({
      where: {
        companyId: args.companyId,
        OR: [
          { status: EmployeeImportRunStatus.RUNNING },
          {
            status: EmployeeImportRunStatus.FAILED,
            OR: [
              { finishedAt: { gte: recentFailureThreshold } },
              {
                AND: [{ finishedAt: null }, { startedAt: { gte: recentFailureThreshold } }],
              },
            ],
          },
          {
            duplicateOfRunId: { not: null },
            OR: [
              { finishedAt: { gte: duplicatePatternThreshold } },
              {
                AND: [{ finishedAt: null }, { startedAt: { gte: duplicatePatternThreshold } }],
              },
            ],
          },
        ],
      },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        sheetKind: true,
        sheetTitle: true,
        actorUserId: true,
        mode: true,
        status: true,
        outcome: true,
        startedAt: true,
        finishedAt: true,
        duplicateOfRunId: true,
        failedCode: true,
        failedMessage: true,
      },
    }),
  ]);

  return buildEmployeeImportRunHealthSummary({
    locks,
    runs,
    now,
  });
}
