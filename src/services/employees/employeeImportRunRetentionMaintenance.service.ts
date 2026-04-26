import { Prisma } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import {
  EMPLOYEE_IMPORT_RUN_PREVIEW_RETENTION_DAYS,
  EMPLOYEE_IMPORT_RUN_SNAPSHOT_RETENTION_DAYS,
  employeeImportRunPreviewRetentionThresholdDate,
  employeeImportRunSnapshotRetentionThresholdDate,
} from "@/src/services/employees/employeeImportRunPrivacy.service";

const RETENTION_MAINTENANCE_BATCH_SIZE = 200;

type RetentionMaintenanceCandidateRecord = {
  id: string;
  finishedAt: Date | null;
  changedEmployeeCodesPreview: string[];
  warningsPreview: Prisma.JsonValue | null;
  errorsPreview: Prisma.JsonValue | null;
  headerSummarySnapshot: Prisma.JsonValue | null;
  codeResolutionSnapshot: Prisma.JsonValue | null;
  applySummarySnapshot: Prisma.JsonValue | null;
};

export type EmployeeImportRunRetentionMaintenanceSummary = {
  generatedAt: Date;
  previewRetentionDays: number;
  snapshotRetentionDays: number;
  previewThresholdDate: Date;
  snapshotThresholdDate: Date;
  counts: {
    previewPayloadCandidates: number;
    snapshotPayloadCandidates: number;
    distinctCandidateRuns: number;
  };
  oldestPreviewFinishedAt: Date | null;
  oldestSnapshotFinishedAt: Date | null;
};

export type EmployeeImportRunRetentionMaintenanceResult = {
  action: "PRUNE_AGED_DETAIL_PAYLOADS";
  previewThresholdDate: Date;
  snapshotThresholdDate: Date;
  previewPayloadCleanedCount: number;
  snapshotPayloadCleanedCount: number;
  touchedRunCount: number;
  noOp: boolean;
};

export function hasEmployeeImportRunPreviewPayload(run: Pick<
  RetentionMaintenanceCandidateRecord,
  "changedEmployeeCodesPreview" | "warningsPreview" | "errorsPreview"
>): boolean {
  return (
    run.changedEmployeeCodesPreview.length > 0 ||
    run.warningsPreview !== null ||
    run.errorsPreview !== null
  );
}

export function hasEmployeeImportRunSnapshotPayload(run: Pick<
  RetentionMaintenanceCandidateRecord,
  "headerSummarySnapshot" | "codeResolutionSnapshot" | "applySummarySnapshot"
>): boolean {
  return (
    run.headerSummarySnapshot !== null ||
    run.codeResolutionSnapshot !== null ||
    run.applySummarySnapshot !== null
  );
}

export function buildEmployeeImportRunRetentionMaintenanceBatchPlan(args: {
  runs: RetentionMaintenanceCandidateRecord[];
  previewThresholdDate: Date;
  snapshotThresholdDate: Date;
}) {
  const previewRunIds: string[] = [];
  const snapshotRunIds: string[] = [];

  for (const run of args.runs) {
    if (!run.finishedAt) continue;

    if (run.finishedAt < args.previewThresholdDate && hasEmployeeImportRunPreviewPayload(run)) {
      previewRunIds.push(run.id);
    }

    if (run.finishedAt < args.snapshotThresholdDate && hasEmployeeImportRunSnapshotPayload(run)) {
      snapshotRunIds.push(run.id);
    }
  }

  return {
    previewRunIds,
    snapshotRunIds,
  };
}

export function buildEmployeeImportRunRetentionMaintenanceSummary(args: {
  runs: RetentionMaintenanceCandidateRecord[];
  generatedAt?: Date;
  previewThresholdDate?: Date;
  snapshotThresholdDate?: Date;
}): EmployeeImportRunRetentionMaintenanceSummary {
  const generatedAt = args.generatedAt ?? new Date();
  const previewThresholdDate = args.previewThresholdDate ?? employeeImportRunPreviewRetentionThresholdDate();
  const snapshotThresholdDate = args.snapshotThresholdDate ?? employeeImportRunSnapshotRetentionThresholdDate();
  const plan = buildEmployeeImportRunRetentionMaintenanceBatchPlan({
    runs: args.runs,
    previewThresholdDate,
    snapshotThresholdDate,
  });

  let oldestPreviewFinishedAt: Date | null = null;
  let oldestSnapshotFinishedAt: Date | null = null;

  for (const run of args.runs) {
    if (!run.finishedAt) continue;
    if (plan.previewRunIds.includes(run.id)) {
      if (!oldestPreviewFinishedAt || run.finishedAt < oldestPreviewFinishedAt) {
        oldestPreviewFinishedAt = run.finishedAt;
      }
    }
    if (plan.snapshotRunIds.includes(run.id)) {
      if (!oldestSnapshotFinishedAt || run.finishedAt < oldestSnapshotFinishedAt) {
        oldestSnapshotFinishedAt = run.finishedAt;
      }
    }
  }

  return {
    generatedAt,
    previewRetentionDays: EMPLOYEE_IMPORT_RUN_PREVIEW_RETENTION_DAYS,
    snapshotRetentionDays: EMPLOYEE_IMPORT_RUN_SNAPSHOT_RETENTION_DAYS,
    previewThresholdDate,
    snapshotThresholdDate,
    counts: {
      previewPayloadCandidates: plan.previewRunIds.length,
      snapshotPayloadCandidates: plan.snapshotRunIds.length,
      distinctCandidateRuns: new Set([...plan.previewRunIds, ...plan.snapshotRunIds]).size,
    },
    oldestPreviewFinishedAt,
    oldestSnapshotFinishedAt,
  };
}

async function loadRetentionMaintenanceRunBatch(args: {
  companyId: string;
  previewThresholdDate: Date;
  cursorId?: string | null;
}) {
  return await prisma.employeeImportRun.findMany({
    where: {
      companyId: args.companyId,
      finishedAt: {
        lt: args.previewThresholdDate,
      },
    },
    ...(args.cursorId
      ? {
          cursor: {
            id: args.cursorId,
          },
          skip: 1,
        }
      : {}),
    orderBy: [{ id: "asc" }],
    take: RETENTION_MAINTENANCE_BATCH_SIZE,
    select: {
      id: true,
      finishedAt: true,
      changedEmployeeCodesPreview: true,
      warningsPreview: true,
      errorsPreview: true,
      headerSummarySnapshot: true,
      codeResolutionSnapshot: true,
      applySummarySnapshot: true,
    },
  });
}

export async function getEmployeeImportRunRetentionMaintenanceSummary(args: {
  companyId: string;
}): Promise<EmployeeImportRunRetentionMaintenanceSummary> {
  const previewThresholdDate = employeeImportRunPreviewRetentionThresholdDate();
  const snapshotThresholdDate = employeeImportRunSnapshotRetentionThresholdDate();
  const candidateRuns: RetentionMaintenanceCandidateRecord[] = [];
  let cursorId: string | null = null;

  while (true) {
    const batch = await loadRetentionMaintenanceRunBatch({
      companyId: args.companyId,
      previewThresholdDate,
      cursorId,
    });

    if (batch.length === 0) break;
    candidateRuns.push(...batch);
    cursorId = batch[batch.length - 1]?.id ?? null;
  }

  return buildEmployeeImportRunRetentionMaintenanceSummary({
    runs: candidateRuns,
    generatedAt: new Date(),
    previewThresholdDate,
    snapshotThresholdDate,
  });
}

export async function pruneEmployeeImportRunAgedDetailPayloads(args: {
  companyId: string;
}): Promise<EmployeeImportRunRetentionMaintenanceResult> {
  const previewThresholdDate = employeeImportRunPreviewRetentionThresholdDate();
  const snapshotThresholdDate = employeeImportRunSnapshotRetentionThresholdDate();
  let previewPayloadCleanedCount = 0;
  let snapshotPayloadCleanedCount = 0;
  const touchedRunIds = new Set<string>();
  let cursorId: string | null = null;

  while (true) {
    const batch = await loadRetentionMaintenanceRunBatch({
      companyId: args.companyId,
      previewThresholdDate,
      cursorId,
    });

    if (batch.length === 0) break;

    const plan = buildEmployeeImportRunRetentionMaintenanceBatchPlan({
      runs: batch,
      previewThresholdDate,
      snapshotThresholdDate,
    });

    if (plan.previewRunIds.length > 0) {
      const result = await prisma.employeeImportRun.updateMany({
        where: {
          id: { in: plan.previewRunIds },
        },
        data: {
          changedEmployeeCodesPreview: [],
          warningsPreview: Prisma.DbNull,
          errorsPreview: Prisma.DbNull,
        },
      });
      previewPayloadCleanedCount += result.count;
      for (const runId of plan.previewRunIds) touchedRunIds.add(runId);
    }

    if (plan.snapshotRunIds.length > 0) {
      const result = await prisma.employeeImportRun.updateMany({
        where: {
          id: { in: plan.snapshotRunIds },
        },
        data: {
          headerSummarySnapshot: Prisma.DbNull,
          codeResolutionSnapshot: Prisma.DbNull,
          applySummarySnapshot: Prisma.DbNull,
        },
      });
      snapshotPayloadCleanedCount += result.count;
      for (const runId of plan.snapshotRunIds) touchedRunIds.add(runId);
    }

    cursorId = batch[batch.length - 1]?.id ?? null;
  }

  return {
    action: "PRUNE_AGED_DETAIL_PAYLOADS",
    previewThresholdDate,
    snapshotThresholdDate,
    previewPayloadCleanedCount,
    snapshotPayloadCleanedCount,
    touchedRunCount: touchedRunIds.size,
    noOp: touchedRunIds.size === 0,
  };
}
