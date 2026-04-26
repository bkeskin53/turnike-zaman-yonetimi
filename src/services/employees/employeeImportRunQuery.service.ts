import { EmployeeImportRunMode, EmployeeImportRunOutcome, EmployeeImportRunStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { EmployeeImportSheetKind } from "@/src/features/employees/importTemplate";
import {
  EMPLOYEE_IMPORT_RUN_CHANGED_EMPLOYEE_CODES_PREVIEW_LIMIT,
  EMPLOYEE_IMPORT_RUN_ISSUE_PREVIEW_LIMIT,
  EMPLOYEE_IMPORT_RUN_PREVIEW_RETENTION_DAYS,
  EMPLOYEE_IMPORT_RUN_SNAPSHOT_RETENTION_DAYS,
  isEmployeeImportRunPreviewExpired,
  isEmployeeImportRunSnapshotExpired,
  maskEmployeeImportRunEmail,
  maskEmployeeImportRunIdentifier,
  sanitizeEmployeeImportRunChangedEmployeeCodesPreview,
  sanitizeEmployeeImportRunIssuePreview,
} from "@/src/services/employees/employeeImportRunPrivacy.service";
import type { EmployeeImportIssueSummaryDto } from "@/src/services/employees/employeeImportIssueTaxonomy.service";
import { buildEmployeeImportIssuePreviewSummary } from "@/src/services/employees/employeeImportIssueTaxonomy.service";
import type { EmployeeImportReadinessSummaryDto } from "@/src/services/employees/employeeImportReadiness.service";
import { buildEmployeeImportRunReadinessSummary } from "@/src/services/employees/employeeImportReadiness.service";

const DEFAULT_IMPORT_RUN_PAGE = 1;
const DEFAULT_IMPORT_RUN_LIMIT = 20;
const MAX_IMPORT_RUN_LIMIT = 100;
const DUPLICATE_RUN_PREVIEW_LIMIT = 20;

type JsonObject = Record<string, unknown>;

export type EmployeeImportRunActorDto = {
  userId: string;
  email: string | null;
  role: UserRole | null;
  isActive: boolean | null;
};

export type EmployeeImportRunReferenceDto = {
  id: string;
  mode: EmployeeImportRunMode;
  sheetKind: string;
  sheetTitle: string;
  status: EmployeeImportRunStatus;
  outcome: EmployeeImportRunOutcome | null;
  startedAt: Date;
  finishedAt: Date | null;
};

export type EmployeeImportRunIssuePreviewDto = {
  line: number;
  employeeCode: string | null;
  code: string;
  message: string | null;
  field: string | null;
  value: string | null;
};

export type EmployeeImportRunListFilters = {
  runId?: string | null;
  actor?: string | null;
  employeeCode?: string | null;
  mode?: EmployeeImportRunMode | null;
  sheetKind?: EmployeeImportSheetKind | null;
  status?: EmployeeImportRunStatus | null;
  outcome?: EmployeeImportRunOutcome | null;
  duplicateLinkage?: "DUPLICATE" | "REFERENCE" | "ANY_LINKED" | null;
  startedAtFrom?: Date | null;
  startedAtTo?: Date | null;
  page?: number | null;
  limit?: number | null;
};

export type EmployeeImportRunListItemDto = {
  id: string;
  mode: EmployeeImportRunMode;
  sheetKind: string;
  sheetTitle: string;
  status: EmployeeImportRunStatus;
  outcome: EmployeeImportRunOutcome | null;
  startedAt: Date;
  finishedAt: Date | null;
  requestedCount: number;
  processedCount: number | null;
  changedCount: number | null;
  unchangedCount: number | null;
  rejectedCount: number | null;
  warningCount: number | null;
  errorCount: number | null;
  actor: EmployeeImportRunActorDto;
  duplicateOf: EmployeeImportRunReferenceDto | null;
  duplicateRunCount: number;
};

export type EmployeeImportRunListResultDto = {
  items: EmployeeImportRunListItemDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type EmployeeImportRunDetailDto = {
  id: string;
  companyId: string;
  mode: EmployeeImportRunMode;
  sheetKind: string;
  sheetTitle: string;
  status: EmployeeImportRunStatus;
  outcome: EmployeeImportRunOutcome | null;
  contentHash: string;
  actor: EmployeeImportRunActorDto;
  requestedCount: number;
  processedCount: number | null;
  foundCount: number | null;
  changedCount: number | null;
  unchangedCount: number | null;
  rejectedCount: number | null;
  warningCount: number | null;
  errorCount: number | null;
  failedCode: string | null;
  failedMessage: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  duplicateOf: EmployeeImportRunReferenceDto | null;
  duplicateRunsPreview: EmployeeImportRunReferenceDto[];
  duplicateRunCount: number;
  snapshots: {
    headerSummary: JsonObject | null;
    codeResolution: JsonObject | null;
    applySummary: JsonObject | null;
  };
  previews: {
    warnings: EmployeeImportRunIssuePreviewDto[];
    errors: EmployeeImportRunIssuePreviewDto[];
    changedEmployeeCodes: string[];
  };
  issueSummary: EmployeeImportIssueSummaryDto;
  readinessSummary: EmployeeImportReadinessSummaryDto | null;
  inspectionPolicy: {
    actorMasked: boolean;
    previewValuesMasked: boolean;
    previewRetentionDays: number;
    snapshotRetentionDays: number;
    issuePreviewLimit: number;
    changedEmployeePreviewLimit: number;
    previewsExpired: boolean;
    snapshotsExpired: boolean;
  };
};

export function normalizeEmployeeImportRunListPage(value: number | null | undefined): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return DEFAULT_IMPORT_RUN_PAGE;
  return Math.floor(num);
}

export function normalizeEmployeeImportRunListLimit(value: number | null | undefined): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return DEFAULT_IMPORT_RUN_LIMIT;
  return Math.min(MAX_IMPORT_RUN_LIMIT, Math.floor(num));
}

function isJsonObject(value: Prisma.JsonValue | null | undefined): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asJsonObject(value: Prisma.JsonValue | null | undefined): JsonObject | null {
  return isJsonObject(value) ? (value as JsonObject) : null;
}

export function coerceEmployeeImportRunIssuePreviewList(
  value: Prisma.JsonValue | null | undefined,
): EmployeeImportRunIssuePreviewDto[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => {
    const issue = isJsonObject(item) ? item : {};
    return sanitizeEmployeeImportRunIssuePreview({
      line: typeof issue.line === "number" ? issue.line : 0,
      employeeCode: typeof issue.employeeCode === "string" ? issue.employeeCode : null,
      code: typeof issue.code === "string" ? issue.code : "UNKNOWN",
      message: typeof issue.message === "string" ? issue.message : null,
      field: typeof issue.field === "string" ? issue.field : null,
      value: typeof issue.value === "string" ? issue.value : null,
    });
  });
}

export function normalizeEmployeeImportRunSearchText(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export function normalizeEmployeeImportRunEmployeeCodeSearchValue(value: string | null | undefined): string | null {
  const normalized = normalizeEmployeeImportRunSearchText(value);
  if (!normalized) return null;
  return maskEmployeeImportRunIdentifier(normalized);
}

function toReferenceDto(
  run:
    | {
        id: string;
        mode: EmployeeImportRunMode;
        sheetKind: string;
        sheetTitle: string;
        status: EmployeeImportRunStatus;
        outcome: EmployeeImportRunOutcome | null;
        startedAt: Date;
        finishedAt: Date | null;
      }
    | null
    | undefined,
): EmployeeImportRunReferenceDto | null {
  if (!run) return null;
  return {
    id: run.id,
    mode: run.mode,
    sheetKind: run.sheetKind,
    sheetTitle: run.sheetTitle,
    status: run.status,
    outcome: run.outcome,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  };
}

async function loadActorMap(actorUserIds: string[]): Promise<Map<string, EmployeeImportRunActorDto>> {
  const uniqueIds = Array.from(new Set(actorUserIds.map((id) => String(id ?? "").trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return new Map<string, EmployeeImportRunActorDto>();

  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  const map = new Map<string, EmployeeImportRunActorDto>();
  for (const user of users) {
    map.set(user.id, {
      userId: user.id,
      email: maskEmployeeImportRunEmail(user.email),
      role: user.role,
      isActive: user.isActive,
    });
  }

  for (const userId of uniqueIds) {
    if (!map.has(userId)) {
      map.set(userId, {
        userId,
        email: null,
        role: null,
        isActive: null,
      });
    }
  }

  return map;
}

export function buildEmployeeImportRunWhere(input: {
  companyId: string;
  filters?: EmployeeImportRunListFilters | null;
  actorUserIds?: string[] | null;
  employeeCodeMasked?: string | null;
}): Prisma.EmployeeImportRunWhereInput {
  const and: Prisma.EmployeeImportRunWhereInput[] = [{ companyId: input.companyId }];
  const filters = input.filters ?? null;

  if (filters?.runId) and.push({ id: { contains: filters.runId } });
  if (filters?.actor) {
    and.push({
      actorUserId: { in: (input.actorUserIds ?? []).length > 0 ? input.actorUserIds ?? [] : ["__NO_MATCH__"] },
    });
  }
  if (input.employeeCodeMasked) {
    and.push({
      changedEmployeeCodesPreview: { has: input.employeeCodeMasked },
    });
  }
  if (filters?.mode) and.push({ mode: filters.mode });
  if (filters?.sheetKind) and.push({ sheetKind: filters.sheetKind });
  if (filters?.status) and.push({ status: filters.status });
  if (filters?.outcome) and.push({ outcome: filters.outcome });
  if (filters?.duplicateLinkage === "DUPLICATE") {
    and.push({ duplicateOfRunId: { not: null } });
  }
  if (filters?.duplicateLinkage === "REFERENCE") {
    and.push({ duplicateRuns: { some: {} } });
  }
  if (filters?.duplicateLinkage === "ANY_LINKED") {
    and.push({
      OR: [{ duplicateOfRunId: { not: null } }, { duplicateRuns: { some: {} } }],
    });
  }
  if (filters?.startedAtFrom || filters?.startedAtTo) {
    const startedAt: Prisma.DateTimeFilter = {};
    if (filters.startedAtFrom) startedAt.gte = filters.startedAtFrom;
    if (filters.startedAtTo) startedAt.lte = filters.startedAtTo;
    and.push({ startedAt });
  }

  return and.length === 1 ? and[0] : { AND: and };
}

async function resolveEmployeeImportRunActorUserIds(actorQuery: string | null | undefined): Promise<string[]> {
  const normalized = normalizeEmployeeImportRunSearchText(actorQuery);
  if (!normalized) return [];

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { id: { contains: normalized } },
        { email: { contains: normalized, mode: "insensitive" } },
      ],
    },
    take: 100,
    select: { id: true },
  });

  return Array.from(new Set(users.map((user) => user.id)));
}

export async function listEmployeeImportRuns(args: {
  companyId: string;
  filters?: EmployeeImportRunListFilters | null;
}): Promise<EmployeeImportRunListResultDto> {
  const page = normalizeEmployeeImportRunListPage(args.filters?.page);
  const limit = normalizeEmployeeImportRunListLimit(args.filters?.limit);
  const skip = (page - 1) * limit;
  const [actorUserIds, employeeCodeMasked] = await Promise.all([
    resolveEmployeeImportRunActorUserIds(args.filters?.actor),
    Promise.resolve(normalizeEmployeeImportRunEmployeeCodeSearchValue(args.filters?.employeeCode)),
  ]);
  const where = buildEmployeeImportRunWhere({
    ...args,
    actorUserIds,
    employeeCodeMasked,
  });

  const [total, runs] = await Promise.all([
    prisma.employeeImportRun.count({ where }),
    prisma.employeeImportRun.findMany({
      where,
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      skip,
      take: limit,
      select: {
        id: true,
        mode: true,
        sheetKind: true,
        sheetTitle: true,
        status: true,
        outcome: true,
        actorUserId: true,
        requestedCount: true,
        processedCount: true,
        changedCount: true,
        unchangedCount: true,
        rejectedCount: true,
        warningCount: true,
        errorCount: true,
        startedAt: true,
        finishedAt: true,
        duplicateOfRun: {
          select: {
            id: true,
            mode: true,
            sheetKind: true,
            sheetTitle: true,
            status: true,
            outcome: true,
            startedAt: true,
            finishedAt: true,
          },
        },
        _count: {
          select: {
            duplicateRuns: true,
          },
        },
      },
    }),
  ]);

  const actorMap = await loadActorMap(runs.map((run) => run.actorUserId));
  const items: EmployeeImportRunListItemDto[] = runs.map((run) => ({
    id: run.id,
    mode: run.mode,
    sheetKind: run.sheetKind,
    sheetTitle: run.sheetTitle,
    status: run.status,
    outcome: run.outcome,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    requestedCount: run.requestedCount,
    processedCount: run.processedCount,
    changedCount: run.changedCount,
    unchangedCount: run.unchangedCount,
    rejectedCount: run.rejectedCount,
    warningCount: run.warningCount,
    errorCount: run.errorCount,
    actor:
      actorMap.get(run.actorUserId) ??
      ({
        userId: run.actorUserId,
        email: null,
        role: null,
        isActive: null,
      } satisfies EmployeeImportRunActorDto),
    duplicateOf: toReferenceDto(run.duplicateOfRun),
    duplicateRunCount: run._count.duplicateRuns,
  }));

  return {
    items,
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export async function getEmployeeImportRunDetail(args: {
  companyId: string;
  runId: string;
}): Promise<EmployeeImportRunDetailDto | null> {
  const run = await prisma.employeeImportRun.findFirst({
    where: {
      id: args.runId,
      companyId: args.companyId,
    },
    select: {
      id: true,
      companyId: true,
      mode: true,
      sheetKind: true,
      sheetTitle: true,
      status: true,
      outcome: true,
      contentHash: true,
      actorUserId: true,
      requestedCount: true,
      processedCount: true,
      foundCount: true,
      changedCount: true,
      unchangedCount: true,
      rejectedCount: true,
      warningCount: true,
      errorCount: true,
      failedCode: true,
      failedMessage: true,
      startedAt: true,
      finishedAt: true,
      changedEmployeeCodesPreview: true,
      headerSummarySnapshot: true,
      codeResolutionSnapshot: true,
      applySummarySnapshot: true,
      warningsPreview: true,
      errorsPreview: true,
      duplicateOfRun: {
        select: {
          id: true,
          mode: true,
          sheetKind: true,
          sheetTitle: true,
          status: true,
          outcome: true,
          startedAt: true,
          finishedAt: true,
        },
      },
      duplicateRuns: {
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        take: DUPLICATE_RUN_PREVIEW_LIMIT,
        select: {
          id: true,
          mode: true,
          sheetKind: true,
          sheetTitle: true,
          status: true,
          outcome: true,
          startedAt: true,
          finishedAt: true,
        },
      },
      _count: {
        select: {
          duplicateRuns: true,
        },
      },
    },
  });

  if (!run) return null;

  const actorMap = await loadActorMap([run.actorUserId]);
  const actor =
    actorMap.get(run.actorUserId) ??
    ({
      userId: run.actorUserId,
      email: null,
      role: null,
      isActive: null,
      } satisfies EmployeeImportRunActorDto);
  const headerSummary = isEmployeeImportRunSnapshotExpired(run.finishedAt)
    ? null
    : asJsonObject(run.headerSummarySnapshot);
  const codeResolutionSummary = isEmployeeImportRunSnapshotExpired(run.finishedAt)
    ? null
    : asJsonObject(run.codeResolutionSnapshot);
  const applySummary = isEmployeeImportRunSnapshotExpired(run.finishedAt)
    ? null
    : asJsonObject(run.applySummarySnapshot);

  const previews = isEmployeeImportRunPreviewExpired(run.finishedAt)
    ? {
        warnings: [],
        errors: [],
        changedEmployeeCodes: [],
      }
    : {
        warnings: coerceEmployeeImportRunIssuePreviewList(run.warningsPreview),
        errors: coerceEmployeeImportRunIssuePreviewList(run.errorsPreview),
        changedEmployeeCodes: sanitizeEmployeeImportRunChangedEmployeeCodesPreview(run.changedEmployeeCodesPreview),
      };
  const issueSummary = buildEmployeeImportIssuePreviewSummary({
    warnings: previews.warnings,
    errors: previews.errors,
    totalWarningCount: run.warningCount,
    totalErrorCount: run.errorCount,
  });

  return {
    id: run.id,
    companyId: run.companyId,
    mode: run.mode,
    sheetKind: run.sheetKind,
    sheetTitle: run.sheetTitle,
    status: run.status,
    outcome: run.outcome,
    contentHash: run.contentHash,
    actor,
    requestedCount: run.requestedCount,
    processedCount: run.processedCount,
    foundCount: run.foundCount,
    changedCount: run.changedCount,
    unchangedCount: run.unchangedCount,
    rejectedCount: run.rejectedCount,
    warningCount: run.warningCount,
    errorCount: run.errorCount,
    failedCode: run.failedCode,
    failedMessage: run.failedMessage,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    duplicateOf: toReferenceDto(run.duplicateOfRun),
    duplicateRunsPreview: run.duplicateRuns.map((item) => toReferenceDto(item)).filter(Boolean) as EmployeeImportRunReferenceDto[],
    duplicateRunCount: run._count.duplicateRuns,
    snapshots: {
      headerSummary,
      codeResolution: codeResolutionSummary,
      applySummary,
    },
    previews,
    issueSummary,
    readinessSummary: buildEmployeeImportRunReadinessSummary({
      mode: run.mode,
      sheetKind: run.sheetKind as EmployeeImportSheetKind,
      requestedCount: run.requestedCount,
      processedCount: run.processedCount,
      rejectedCount: run.rejectedCount,
      issueSummary,
      headerSummarySnapshot: headerSummary,
      codeResolutionSnapshot: codeResolutionSummary,
    }),
    inspectionPolicy: {
      actorMasked: true,
      previewValuesMasked: true,
      previewRetentionDays: EMPLOYEE_IMPORT_RUN_PREVIEW_RETENTION_DAYS,
      snapshotRetentionDays: EMPLOYEE_IMPORT_RUN_SNAPSHOT_RETENTION_DAYS,
      issuePreviewLimit: EMPLOYEE_IMPORT_RUN_ISSUE_PREVIEW_LIMIT,
      changedEmployeePreviewLimit: EMPLOYEE_IMPORT_RUN_CHANGED_EMPLOYEE_CODES_PREVIEW_LIMIT,
      previewsExpired: isEmployeeImportRunPreviewExpired(run.finishedAt),
      snapshotsExpired: isEmployeeImportRunSnapshotExpired(run.finishedAt),
    },
  };
}
