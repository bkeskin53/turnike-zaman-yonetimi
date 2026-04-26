import { Prisma } from "@prisma/client";
import type {
  PayrollAuditEntityType,
  PayrollAuditEventType,
} from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import type {
  PuantajPayrollQuantityStrategy,
  PuantajPayrollQuantityUnit,
} from "@/src/services/puantaj/types";

function assertOptionalMonth(month?: string | null) {
  if (month == null || month === "") return;
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("BAD_MONTH");
  }
}

function normalizeActorUserId(value?: string | null) {
  const v = String(value ?? "").trim();
  return v.length > 0 ? v : null;
}

function normalizeOptionalString(value?: string | null) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEntityId(value: string | number) {
  const normalized = String(value).trim();
  if (!normalized) {
    throw new Error("BAD_ENTITY_ID");
  }
  return normalized;
}

function normalizeJsonPayload(
  payload?: Prisma.InputJsonValue | null
) {
   return payload == null ? Prisma.JsonNull : payload;
}

function buildPayrollRuleAuditPayload(args: {
  payrollRuleEngineVersion?: string | null;
  payrollRuleStats?: Prisma.InputJsonValue | null;
  hasLegacyFallbackRows?: boolean | null;
  generatedRuleCodes?: string[] | null;
  generatedPuantajCodes?: string[] | null;
}) {
  return {
    payrollRuleEngineVersion: normalizeOptionalString(args.payrollRuleEngineVersion),
    payrollRuleStats: args.payrollRuleStats ?? null,
    hasLegacyFallbackRows: args.hasLegacyFallbackRows ?? null,
    generatedRuleCodes: args.generatedRuleCodes ?? null,
    generatedPuantajCodes: args.generatedPuantajCodes ?? null,
  };
}

export type CreatePayrollAuditEventArgs = {
  companyId: string;
  eventType: PayrollAuditEventType;
  entityType: PayrollAuditEntityType;
  entityId: string | number;
  month?: string | null;
  employeeId?: string | null;
  actorUserId?: string | null;
  payload?: Prisma.InputJsonValue | null;
  createdAt?: Date;
};

export async function createPayrollAuditEvent(args: CreatePayrollAuditEventArgs) {
  assertOptionalMonth(args.month);

  return prisma.payrollAuditEvent.create({
    data: {
      companyId: args.companyId,
      month: normalizeOptionalString(args.month),
      employeeId: normalizeOptionalString(args.employeeId),
      eventType: args.eventType,
      entityType: args.entityType,
      entityId: normalizeEntityId(args.entityId),
      actorUserId: normalizeActorUserId(args.actorUserId),
      payload: normalizeJsonPayload(args.payload),
      ...(args.createdAt ? { createdAt: args.createdAt } : {}),
    },
    include: {
      actorUser: {
        select: { id: true, email: true, role: true },
      },
    },
  });
}

export type ListPayrollAuditEventsArgs = {
  companyId: string;
  month?: string | null;
  employeeId?: string | null;
  employeeIds?: string[] | null;
  includeGlobalEvents?: boolean;
  eventTypes?: PayrollAuditEventType[];
  entityType?: PayrollAuditEntityType | null;
  entityId?: string | null;
  take?: number;
  skip?: number;
};

export async function listPayrollAuditEvents(args: ListPayrollAuditEventsArgs) {
  assertOptionalMonth(args.month);

  const take = Math.min(Math.max(args.take ?? 50, 1), 200);
  const skip = Math.max(args.skip ?? 0, 0);
  const normalizedEmployeeIds =
    args.employeeIds?.map((x) => String(x).trim()).filter(Boolean) ?? [];

  const employeeFilter = args.employeeId
    ? { employeeId: args.employeeId }
    : normalizedEmployeeIds.length > 0
      ? {
          OR: [
            ...(args.includeGlobalEvents === false ? [] : [{ employeeId: null }]),
            { employeeId: { in: normalizedEmployeeIds } },
          ],
        }
      : {};

  return prisma.payrollAuditEvent.findMany({
    where: {
      companyId: args.companyId,
      ...(args.month ? { month: args.month } : {}),
      ...employeeFilter,
      ...(args.eventTypes?.length ? { eventType: { in: args.eventTypes } } : {}),
      ...(args.entityType ? { entityType: args.entityType } : {}),
      ...(args.entityId ? { entityId: args.entityId } : {}),
    },
    include: {
      actorUser: {
        select: { id: true, email: true, role: true },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    skip,
  });
}

export async function countPayrollAuditEvents(args: Omit<ListPayrollAuditEventsArgs, "take" | "skip">) {
  assertOptionalMonth(args.month);
  const normalizedEmployeeIds =
    args.employeeIds?.map((x) => String(x).trim()).filter(Boolean) ?? [];

  const employeeFilter = args.employeeId
    ? { employeeId: args.employeeId }
    : normalizedEmployeeIds.length > 0
      ? {
          OR: [
            ...(args.includeGlobalEvents === false ? [] : [{ employeeId: null }]),
            { employeeId: { in: normalizedEmployeeIds } },
          ],
        }
      : {};

  return prisma.payrollAuditEvent.count({
    where: {
      companyId: args.companyId,
      ...(args.month ? { month: args.month } : {}),
      ...employeeFilter,
      ...(args.eventTypes?.length ? { eventType: { in: args.eventTypes } } : {}),
      ...(args.entityType ? { entityType: args.entityType } : {}),
      ...(args.entityId ? { entityId: args.entityId } : {}),
    },
  });
}

export async function listPayrollAuditEventsPage(args: ListPayrollAuditEventsArgs) {
  const [items, total] = await Promise.all([
    listPayrollAuditEvents(args),
    countPayrollAuditEvents({
      companyId: args.companyId,
      month: args.month,
      employeeId: args.employeeId,
      employeeIds: args.employeeIds,
      includeGlobalEvents: args.includeGlobalEvents,
      eventTypes: args.eventTypes,
      entityType: args.entityType,
      entityId: args.entityId,
    }),
  ]);

  const take = Math.min(Math.max(args.take ?? 50, 1), 200);
  const skip = Math.max(args.skip ?? 0, 0);

  return {
    items,
    total,
    page: {
      take,
      skip,
      hasMore: skip + items.length < total,
    },
  };
}

export async function logPayrollPeriodPreClosed(args: {
  companyId: string;
  periodId: string;
  month: string;
  actorUserId?: string | null;
  note?: string | null;
  periodStatus?: string | null;
}) {
  return createPayrollAuditEvent({
    companyId: args.companyId,
    month: args.month,
    eventType: "PERIOD_PRE_CLOSED",
    entityType: "PAYROLL_PERIOD",
    entityId: args.periodId,
    actorUserId: args.actorUserId,
    payload: {
      note: normalizeOptionalString(args.note),
      periodStatus: normalizeOptionalString(args.periodStatus),
    },
  });
}

export async function logPayrollPeriodClosed(args: {
  companyId: string;
  periodId: string;
  month: string;
  actorUserId?: string | null;
  note?: string | null;
  readiness?: Prisma.InputJsonValue | null;
  snapshotId?: string | null;
}) {
  return createPayrollAuditEvent({
    companyId: args.companyId,
    month: args.month,
    eventType: "PERIOD_CLOSED",
    entityType: "PAYROLL_PERIOD",
    entityId: args.periodId,
    actorUserId: args.actorUserId,
    payload: {
      note: normalizeOptionalString(args.note),
      snapshotId: normalizeOptionalString(args.snapshotId),
      readiness: args.readiness ?? null,
    },
  });
}

export async function logPayrollSnapshotCreated(args: {
  companyId: string;
  snapshotId: string;
  month: string;
  actorUserId?: string | null;
  requestedPayrollMappingProfile?: string | null;
  resolvedPayrollMappingProfile?: string | null;
  resolvedPayrollMappingSource?: string | null;
  payrollMappingProfile?: string | null;
  dailyExportProfile?: string | null;
  monthlyExportProfile?: string | null;
  employeeCount?: number;
  payrollReadyCount?: number;
  blockedEmployeeCount?: number;
  blockedDayCount?: number;
  reviewRequiredDayCount?: number;
  pendingReviewDayCount?: number;
  rejectedReviewDayCount?: number;
  rowCounts?: Prisma.InputJsonValue | null;
  payrollRuleEngineVersion?: string | null;
  payrollRuleStats?: Prisma.InputJsonValue | null;
  hasLegacyFallbackRows?: boolean | null;
  generatedRuleCodes?: string[] | null;
  generatedPuantajCodes?: string[] | null;
}) {
  return createPayrollAuditEvent({
    companyId: args.companyId,
    month: args.month,
    eventType: "SNAPSHOT_CREATED",
    entityType: "PAYROLL_PERIOD_SNAPSHOT",
    entityId: args.snapshotId,
    actorUserId: args.actorUserId,
    payload: {
      requestedPayrollMappingProfile: normalizeOptionalString(args.requestedPayrollMappingProfile),
      resolvedPayrollMappingProfile:
        normalizeOptionalString(args.resolvedPayrollMappingProfile) ??
        normalizeOptionalString(args.payrollMappingProfile),
      resolvedPayrollMappingSource: normalizeOptionalString(args.resolvedPayrollMappingSource),
      payrollMappingProfile: normalizeOptionalString(args.payrollMappingProfile),
      dailyExportProfile: normalizeOptionalString(args.dailyExportProfile),
      monthlyExportProfile: normalizeOptionalString(args.monthlyExportProfile),
      employeeCount: args.employeeCount ?? 0,
      payrollReadyCount: args.payrollReadyCount ?? 0,
      blockedEmployeeCount: args.blockedEmployeeCount ?? 0,
      blockedDayCount: args.blockedDayCount ?? 0,
      reviewRequiredDayCount: args.reviewRequiredDayCount ?? 0,
      pendingReviewDayCount: args.pendingReviewDayCount ?? 0,
      rejectedReviewDayCount: args.rejectedReviewDayCount ?? 0,
      rowCounts: args.rowCounts ?? null,
      ...buildPayrollRuleAuditPayload(args),
    },
  });
}

export async function logPayrollMonthlyExportCreated(args: {
  companyId: string;
  month: string;
  actorUserId?: string | null;
  exportProfile: string;
  exportSource: "LIVE" | "SNAPSHOT";
  snapshotId?: string | null;
  requestedPayrollMappingProfile?: string | null;
  resolvedPayrollMappingProfile?: string | null;
  resolvedPayrollMappingSource?: string | null;
  payrollMappingProfile?: string | null;
  employeeId?: string | null;
  rowCount?: number | null;
  payrollRuleEngineVersion?: string | null;
  payrollRuleStats?: Prisma.InputJsonValue | null;
  hasLegacyFallbackRows?: boolean | null;
  generatedRuleCodes?: string[] | null;
  generatedPuantajCodes?: string[] | null;
}) {
  return createPayrollAuditEvent({
    companyId: args.companyId,
    month: args.month,
    employeeId: args.employeeId,
    eventType: "MONTHLY_EXPORT_CREATED",
    entityType: "EXPORT",
    entityId: `${args.month}:${args.exportProfile}:${Date.now()}`,
    actorUserId: args.actorUserId,
    payload: {
      exportProfile: args.exportProfile,
      exportSource: args.exportSource,
      snapshotId: normalizeOptionalString(args.snapshotId),
      requestedPayrollMappingProfile: normalizeOptionalString(args.requestedPayrollMappingProfile),
      resolvedPayrollMappingProfile:
        normalizeOptionalString(args.resolvedPayrollMappingProfile) ??
        normalizeOptionalString(args.payrollMappingProfile),
      resolvedPayrollMappingSource: normalizeOptionalString(args.resolvedPayrollMappingSource),
      payrollMappingProfile: normalizeOptionalString(args.payrollMappingProfile),
      rowCount: args.rowCount ?? null,
      ...buildPayrollRuleAuditPayload(args),
    },
  });
}

export async function logPayrollDailyExportCreated(args: {
  companyId: string;
  month: string;
  actorUserId?: string | null;
  exportProfile: string;
  employeeId?: string | null;
  rowCount?: number | null;
  payrollRuleEngineVersion?: string | null;
  payrollRuleStats?: Prisma.InputJsonValue | null;
  hasLegacyFallbackRows?: boolean | null;
  generatedRuleCodes?: string[] | null;
  generatedPuantajCodes?: string[] | null;
}) {
  return createPayrollAuditEvent({
    companyId: args.companyId,
    month: args.month,
    employeeId: args.employeeId,
    eventType: "DAILY_EXPORT_CREATED",
    entityType: "EXPORT",
    entityId: `${args.month}:${args.exportProfile}:${args.employeeId ?? "ALL"}:${Date.now()}`,
    actorUserId: args.actorUserId,
    payload: {
      exportProfile: args.exportProfile,
      rowCount: args.rowCount ?? null,
      ...buildPayrollRuleAuditPayload(args),
    },
  });
}

export async function logPayrollReviewStatusChanged(args: {
  companyId: string;
  month: string;
  employeeId?: string | null;
  dailyAttendanceId: string;
  actorUserId?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
}) {
  return createPayrollAuditEvent({
    companyId: args.companyId,
    month: args.month,
    employeeId: args.employeeId,
    eventType: "REVIEW_STATUS_CHANGED",
    entityType: "DAILY_ATTENDANCE",
    entityId: args.dailyAttendanceId,
    actorUserId: args.actorUserId,
    payload: {
      fromStatus: normalizeOptionalString(args.fromStatus),
      toStatus: normalizeOptionalString(args.toStatus),
      note: normalizeOptionalString(args.note),
    },
  });
}

export async function logPayrollReviewNoteChanged(args: {
  companyId: string;
  month: string;
  employeeId?: string | null;
  dailyAttendanceId: string;
  actorUserId?: string | null;
  note?: string | null;
}) {
  return createPayrollAuditEvent({
    companyId: args.companyId,
    month: args.month,
    employeeId: args.employeeId,
    eventType: "REVIEW_NOTE_CHANGED",
    entityType: "DAILY_ATTENDANCE",
    entityId: args.dailyAttendanceId,
    actorUserId: args.actorUserId,
    payload: {
      note: normalizeOptionalString(args.note),
    },
  });
}

export async function logPayrollMappingProfileCreated(args: {
  companyId: string;
  actorUserId?: string | null;
  profileCode: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
}) {
  return createPayrollAuditEvent({
    companyId: args.companyId,
    eventType: "PAYROLL_MAPPING_PROFILE_CREATED",
    entityType: "PAYROLL_MAPPING_PROFILE",
    entityId: args.profileCode,
    actorUserId: args.actorUserId,
    payload: {
      code: args.profileCode,
      name: args.name,
      isDefault: args.isDefault,
      isActive: args.isActive,
    },
  });
}

export async function logPayrollMappingProfileUpdated(args: {
  companyId: string;
  actorUserId?: string | null;
  profileCode: string;
  name?: string | null;
  isActive?: boolean | null;
}) {
  return createPayrollAuditEvent({
    companyId: args.companyId,
    eventType: "PAYROLL_MAPPING_PROFILE_UPDATED",
    entityType: "PAYROLL_MAPPING_PROFILE",
    entityId: args.profileCode,
    actorUserId: args.actorUserId,
    payload: {
      code: args.profileCode,
      name: args.name ?? null,
      isActive: args.isActive ?? null,
    },
  });
}

export async function logPayrollMappingProfileDefaultChanged(args: {
  companyId: string;
  actorUserId?: string | null;
  profileCode: string;
}) {
  return createPayrollAuditEvent({
    companyId: args.companyId,
    eventType: "PAYROLL_MAPPING_PROFILE_DEFAULT_CHANGED",
    entityType: "PAYROLL_MAPPING_PROFILE",
    entityId: args.profileCode,
    actorUserId: args.actorUserId,
    payload: {
      code: args.profileCode,
      isDefault: true,
    },
  });
}

export async function logPayrollMappingProfileActiveChanged(args: {
  companyId: string;
  actorUserId?: string | null;
  profileCode: string;
  isActive: boolean;
}) {
  return createPayrollAuditEvent({
    companyId: args.companyId,
    eventType: "PAYROLL_MAPPING_PROFILE_ACTIVE_CHANGED",
    entityType: "PAYROLL_MAPPING_PROFILE",
    entityId: args.profileCode,
    actorUserId: args.actorUserId,
    payload: {
      code: args.profileCode,
      isActive: args.isActive,
    },
  });
}

export async function logPayrollMappingItemUpserted(args: {
  companyId: string;
  actorUserId?: string | null;
  profileCode: string;
  puantajCode: string;
  payrollCode: string;
  payrollLabel: string;
  unit: PuantajPayrollQuantityUnit;
  quantityStrategy: PuantajPayrollQuantityStrategy;
  fixedQuantity: number | null;
  sortOrder: number;
  isActive: boolean;
}) {
  return createPayrollAuditEvent({
    companyId: args.companyId,
    eventType: "PAYROLL_MAPPING_ITEM_UPSERTED",
    entityType: "PAYROLL_MAPPING_ITEM",
    entityId: `${args.profileCode}:${args.puantajCode}`,
    actorUserId: args.actorUserId,
    payload: {
      profileCode: args.profileCode,
      puantajCode: args.puantajCode,
      payrollCode: args.payrollCode,
      payrollLabel: args.payrollLabel,
      unit: args.unit,
      quantityStrategy: args.quantityStrategy,
      fixedQuantity: args.fixedQuantity,
      sortOrder: args.sortOrder,
      isActive: args.isActive,
    },
  });
}

export async function logPayrollMappingItemDeactivated(args: {
  companyId: string;
  actorUserId?: string | null;
  profileCode: string;
  puantajCode: string;
}) {
  return createPayrollAuditEvent({
    companyId: args.companyId,
    eventType: "PAYROLL_MAPPING_ITEM_DEACTIVATED",
    entityType: "PAYROLL_MAPPING_ITEM",
    entityId: `${args.profileCode}:${args.puantajCode}`,
    actorUserId: args.actorUserId,
    payload: {
      profileCode: args.profileCode,
      puantajCode: args.puantajCode,
      isActive: false,
    },
  })
}