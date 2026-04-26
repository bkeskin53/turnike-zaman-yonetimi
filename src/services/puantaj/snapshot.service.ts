import { Prisma } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { buildDailyPuantajRows } from "@/src/services/puantaj/buildDailyPuantajRows";
import { buildMonthlyPuantajSummary } from "@/src/services/puantaj/buildMonthlyPuantajSummary";
import { buildPayrollCodeSummary } from "@/src/services/puantaj/buildPayrollCodeSummary";
import { summarizePayrollRuleDiagnostics, type PayrollRuleDiagnosticsSummary } from "@/src/services/puantaj/payrollRuleDiagnostics";
import { resolvePayrollCodeMappingProfile } from "@/src/services/puantaj/payrollCodeMappingResolver.service";
import {
  evaluatePayrollPeriodReadiness,
  getOrCreatePayrollPeriod,
  getPayrollPeriod,
  type PayrollPeriodReadiness,
} from "@/src/services/puantaj/period.service";
import type { PuantajExportProfile } from "@/src/services/puantaj/exportProfiles";
import type {
  PuantajCode,
  PuantajMonthlyEmployeeSummary,
  PuantajPayrollCodeSummaryRow,
  PuantajPayrollQuantityStrategy,
  PuantajPayrollQuantityUnit,
} from "@/src/services/puantaj/types";

function assertValidMonth(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("BAD_MONTH");
 }
}

function toSnapshotUnit(unit: PuantajPayrollQuantityUnit) {
  switch (unit) {
    case "MINUTES":
      return "MINUTES" as const;
    case "COUNT":
      return "COUNT" as const;
    case "DAYS":
    default:
      return "DAYS" as const;
  }
}

function toSnapshotQuantityStrategy(strategy: PuantajPayrollQuantityStrategy) {
  switch (strategy) {
    case "WORKED_MINUTES":
      return "WORKED_MINUTES" as const;
    case "OVERTIME_MINUTES":
      return "OVERTIME_MINUTES" as const;
    case "FIXED_QUANTITY":
    default:
      return "FIXED_QUANTITY" as const;
  }
}

function toDecimal(value: number) {
  return new Prisma.Decimal(value);
}

function isPuantajCode(value: unknown): value is PuantajCode {
  return (
    value === "NORMAL_WORK" ||
    value === "OVERTIME" ||
    value === "OFF_DAY" ||
    value === "ABSENCE" ||
    value === "LEAVE_ANNUAL" ||
    value === "LEAVE_SICK" ||
    value === "LEAVE_EXCUSED" ||
    value === "LEAVE_UNPAID" ||
    value === "LEAVE_UNKNOWN"
  );
}

function parsePuantajCodes(value: Prisma.JsonValue | null): PuantajCode[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPuantajCode);
}

function toNumber(value: Prisma.Decimal | number) {
  if (typeof value === "number") return value;
  return Number(value);
}

async function buildSnapshotSourceData(args: {
  companyId: string;
  month: string;
  tz: string;
  employeeWhere?: Prisma.EmployeeWhereInput | null;
  payrollMappingProfile: string;
}): Promise<{
  dailyRows: Awaited<ReturnType<typeof buildDailyPuantajRows>>;
  employeeItems: Awaited<ReturnType<typeof buildMonthlyPuantajSummary>>;
  codeItems: Awaited<ReturnType<typeof buildPayrollCodeSummary>>;
  payrollRuleDiagnostics: PayrollRuleDiagnosticsSummary;
}> {
  const [dailyRows, employeeItems, codeItems] = await Promise.all([
    buildDailyPuantajRows({
      companyId: args.companyId,
      month: args.month,
      tz: args.tz,
      employeeWhere: args.employeeWhere ?? null,
    }),
    buildMonthlyPuantajSummary({
      companyId: args.companyId,
      month: args.month,
      tz: args.tz,
      employeeWhere: args.employeeWhere ?? null,
    }),
    buildPayrollCodeSummary({
      companyId: args.companyId,
      month: args.month,
      tz: args.tz,
      employeeWhere: args.employeeWhere ?? null,
      payrollMappingProfile: args.payrollMappingProfile,
    }),
  ]);

  return {
    dailyRows,
    employeeItems,
    codeItems,
    payrollRuleDiagnostics: summarizePayrollRuleDiagnostics({
      rows: dailyRows,
      codeItems,
    }),
  };
}

export type CreatePayrollPeriodSnapshotArgs = {
  companyId: string;
  month: string;
  tz: string;
  actorUserId?: string | null;
  payrollMappingProfile?: string | null;
  dailyExportProfile?: PuantajExportProfile | null;
  monthlyExportProfile?: PuantajExportProfile | null;
  employeeWhere?: Prisma.EmployeeWhereInput | null;
};

export type PayrollMappingResolutionInfo = {
  requestedProfileCode: string | null;
  resolvedProfileCode: string;
  resolvedProfileSource: "DB" | "FILE";
};

export async function getLatestPayrollPeriodSnapshot(args: {
  companyId: string;
  month: string;
}) {
  assertValidMonth(args.month);

  return prisma.payrollPeriodSnapshot.findFirst({
    where: {
      companyId: args.companyId,
      month: args.month,
    },
    include: {
      createdByUser: {
        select: { id: true, email: true, role: true },
      },
      _count: {
        select: {
          employeeRows: true,
          codeRows: true,
        },
      },
    },
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
  });
}

export async function getLatestFinalPayrollPeriodSnapshot(args: {
  companyId: string;
  month: string;
}) {
  assertValidMonth(args.month);

  return prisma.payrollPeriodSnapshot.findFirst({
    where: {
      companyId: args.companyId,
      month: args.month,
      status: "FINAL",
    },
    include: {
      createdByUser: {
        select: { id: true, email: true, role: true },
      },
      _count: {
        select: {
          employeeRows: true,
          codeRows: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

async function resolveSnapshotEmployeeIds(args: {
  companyId: string;
  employeeWhere?: Prisma.EmployeeWhereInput | null;
}): Promise<string[] | null> {
  if (!args.employeeWhere) return null;

  const employees = await prisma.employee.findMany({
    where: {
      companyId: args.companyId,
      AND: [args.employeeWhere],
    },
    select: { id: true },
  });

  return employees.map((x) => x.id);
}

export async function loadMonthlySummarySnapshotRows(args: {
  companyId: string;
  month: string;
  employeeWhere?: Prisma.EmployeeWhereInput | null;
}): Promise<{
  snapshot: NonNullable<Awaited<ReturnType<typeof getLatestFinalPayrollPeriodSnapshot>>>;
  items: PuantajMonthlyEmployeeSummary[];
}> {
  assertValidMonth(args.month);

  const snapshot = await getLatestFinalPayrollPeriodSnapshot({
    companyId: args.companyId,
    month: args.month,
  });

  if (!snapshot) {
    throw new Error("FINAL_SNAPSHOT_NOT_FOUND");
  }

  const allowedEmployeeIds = await resolveSnapshotEmployeeIds({
    companyId: args.companyId,
    employeeWhere: args.employeeWhere ?? null,
  });

  const rows = await prisma.payrollPeriodSnapshotEmployee.findMany({
    where: {
      snapshotId: snapshot.id,
      ...(allowedEmployeeIds ? { employeeId: { in: allowedEmployeeIds } } : {}),
    },
    orderBy: [{ employeeCode: "asc" }, { fullName: "asc" }],
  });

  return {
    snapshot,
    items: rows.map((row) => ({
      employeeId: row.employeeId,
      employeeCode: row.employeeCode,
      fullName: row.fullName,
      month: row.month,
      dayCount: row.dayCount,
      presentDays: row.presentDays,
      absentDays: row.absentDays,
      offDays: row.offDays,
      leaveDays: row.leaveDays,
      annualLeaveDays: row.annualLeaveDays,
      sickLeaveDays: row.sickLeaveDays,
      excusedLeaveDays: row.excusedLeaveDays,
      unpaidLeaveDays: row.unpaidLeaveDays,
      unknownLeaveDays: row.unknownLeaveDays,
      workedMinutes: row.workedMinutes,
      overtimeMinutes: row.overtimeMinutes,
      overtimeEarlyMinutes: row.overtimeEarlyMinutes,
      overtimeLateMinutes: row.overtimeLateMinutes,
      lateMinutes: row.lateMinutes,
      earlyLeaveMinutes: row.earlyLeaveMinutes,
      blockedDays: row.blockedDays,
      readyDays: row.readyDays,
      reviewRequiredDays: row.reviewRequiredDays,
      pendingReviewDays: row.pendingReviewDays,
      rejectedReviewDays: row.rejectedReviewDays,
      manualAdjustmentDays: row.manualAdjustmentDays,
      anomalyDays: row.anomalyDays,
      puantajCodes: parsePuantajCodes(row.puantajCodes),
      isPayrollReady: row.isPayrollReady,
    })),
  };
}

export async function loadPayrollCodeSummarySnapshotRows(args: {
  companyId: string;
  month: string;
  employeeWhere?: Prisma.EmployeeWhereInput | null;
}): Promise<{
  snapshot: NonNullable<Awaited<ReturnType<typeof getLatestFinalPayrollPeriodSnapshot>>>;
  items: PuantajPayrollCodeSummaryRow[];
}> {
  assertValidMonth(args.month);

  const snapshot = await getLatestFinalPayrollPeriodSnapshot({
    companyId: args.companyId,
    month: args.month,
  });

  if (!snapshot) {
    throw new Error("FINAL_SNAPSHOT_NOT_FOUND");
  }

  const allowedEmployeeIds = await resolveSnapshotEmployeeIds({
    companyId: args.companyId,
    employeeWhere: args.employeeWhere ?? null,
  });

  const rows = await prisma.payrollPeriodSnapshotCodeRow.findMany({
    where: {
      snapshotId: snapshot.id,
      ...(allowedEmployeeIds ? { employeeId: { in: allowedEmployeeIds } } : {}),
    },
    orderBy: [{ employeeCode: "asc" }, { puantajCode: "asc" }],
  });

  return {
    snapshot,
    items: rows.map((row) => ({
      employeeId: row.employeeId,
      employeeCode: row.employeeCode,
      fullName: row.fullName,
      month: row.month,
      code: row.puantajCode as PuantajCode,
      payrollCode: row.payrollCode,
      payrollLabel: row.payrollLabel,
      unit: row.unit as PuantajPayrollQuantityUnit,
      quantityStrategy: row.quantityStrategy as PuantajPayrollQuantityStrategy,
      fixedQuantity: row.fixedQuantity == null ? null : toNumber(row.fixedQuantity),
      quantity: toNumber(row.quantity),
      dayCount: row.dayCount,
      totalMinutes: row.totalMinutes,
    })),
  };
}

export async function createPayrollPeriodSnapshot(args: CreatePayrollPeriodSnapshotArgs) {
  assertValidMonth(args.month);

  const resolvedPayrollMappingProfile = await resolvePayrollCodeMappingProfile({
    companyId: args.companyId,
    code: args.payrollMappingProfile ?? null,
    autoSeedDefault: true,
  });
  const mappingResolution: PayrollMappingResolutionInfo = {
    requestedProfileCode: args.payrollMappingProfile ?? null,
    resolvedProfileCode: resolvedPayrollMappingProfile.code,
    resolvedProfileSource: resolvedPayrollMappingProfile.source,
  };
  const payrollMappingProfile = resolvedPayrollMappingProfile.code;
  const dailyExportProfile = args.dailyExportProfile ?? "STANDARD_DAILY";
  const monthlyExportProfile = args.monthlyExportProfile ?? "PAYROLL_CODE_SUMMARY";

  const period = await getPayrollPeriod(args.companyId, args.month);
  if (!period) {
    throw new Error("PERIOD_NOT_FOUND");
  }

  if (period.status !== "CLOSED") {
    throw new Error("PERIOD_MUST_BE_CLOSED_FOR_SNAPSHOT");
  }

  const {
    employeeItems,
    codeItems,
    payrollRuleDiagnostics,
  } = await buildSnapshotSourceData({
    companyId: args.companyId,
    month: args.month,
    tz: args.tz,
    employeeWhere: args.employeeWhere ?? null,
    payrollMappingProfile,
  });

  const employeeCount = employeeItems.length;
  const payrollReadyCount = employeeItems.filter((x) => x.isPayrollReady).length;
  const blockedEmployeeCount = employeeItems.filter((x) => x.blockedDays > 0).length;
  const blockedDayCount = employeeItems.reduce((sum, x) => sum + x.blockedDays, 0);
  const reviewRequiredDayCount = employeeItems.reduce((sum, x) => sum + x.reviewRequiredDays, 0);
  const pendingReviewDayCount = employeeItems.reduce((sum, x) => sum + x.pendingReviewDays, 0);
  const rejectedReviewDayCount = employeeItems.reduce((sum, x) => sum + x.rejectedReviewDays, 0);

  return prisma.$transaction(async (tx) => {
    const snapshot = await tx.payrollPeriodSnapshot.create({
      data: {
        companyId: args.companyId,
        periodId: period.id,
        month: args.month,
        status: "DRAFT",
        payrollMappingProfile,
        dailyExportProfile,
        monthlyExportProfile,
        employeeCount,
        payrollReadyCount,
        blockedEmployeeCount,
        blockedDayCount,
        reviewRequiredDayCount,
        pendingReviewDayCount,
        rejectedReviewDayCount,
        createdByUserId: args.actorUserId ?? null,
      },
    });

    if (employeeItems.length > 0) {
      await tx.payrollPeriodSnapshotEmployee.createMany({
        data: employeeItems.map((item) => ({
          snapshotId: snapshot.id,
          employeeId: item.employeeId,
          employeeCode: item.employeeCode,
          fullName: item.fullName,
          month: item.month,
          dayCount: item.dayCount,
          presentDays: item.presentDays,
          absentDays: item.absentDays,
          offDays: item.offDays,
          leaveDays: item.leaveDays,
          annualLeaveDays: item.annualLeaveDays,
          sickLeaveDays: item.sickLeaveDays,
          excusedLeaveDays: item.excusedLeaveDays,
          unpaidLeaveDays: item.unpaidLeaveDays,
          unknownLeaveDays: item.unknownLeaveDays,
          workedMinutes: item.workedMinutes,
          overtimeMinutes: item.overtimeMinutes,
          overtimeEarlyMinutes: item.overtimeEarlyMinutes,
          overtimeLateMinutes: item.overtimeLateMinutes,
          lateMinutes: item.lateMinutes,
          earlyLeaveMinutes: item.earlyLeaveMinutes,
          blockedDays: item.blockedDays,
          readyDays: item.readyDays,
          reviewRequiredDays: item.reviewRequiredDays,
          pendingReviewDays: item.pendingReviewDays,
          rejectedReviewDays: item.rejectedReviewDays,
          manualAdjustmentDays: item.manualAdjustmentDays,
          anomalyDays: item.anomalyDays,
          puantajCodes: item.puantajCodes,
          isPayrollReady: item.isPayrollReady,
        })),
      });
    }

    if (codeItems.length > 0) {
      await tx.payrollPeriodSnapshotCodeRow.createMany({
        data: codeItems.map((item) => ({
          snapshotId: snapshot.id,
          employeeId: item.employeeId,
          employeeCode: item.employeeCode,
          fullName: item.fullName,
          month: item.month,
          puantajCode: item.code,
          payrollCode: item.payrollCode,
          payrollLabel: item.payrollLabel,
          unit: toSnapshotUnit(item.unit),
          quantityStrategy: toSnapshotQuantityStrategy(item.quantityStrategy),
          fixedQuantity: item.fixedQuantity == null ? null : toDecimal(item.fixedQuantity),
          quantity: toDecimal(item.quantity),
          dayCount: item.dayCount,
          totalMinutes: item.totalMinutes,
        })),
      });
    }

    const finalized = await tx.payrollPeriodSnapshot.update({
      where: { id: snapshot.id },
      data: {
        status: "FINAL",
      },
      include: {
        createdByUser: {
          select: { id: true, email: true, role: true },
        },
        _count: {
          select: {
            employeeRows: true,
            codeRows: true,
          },
        },
      },
    });

    return {
      ...finalized,
      mappingResolution,
      payrollRuleDiagnostics,
    };
  });
}

export async function closePayrollPeriodWithSnapshot(args: {
  companyId: string;
  month: string;
  tz: string;
  actorUserId?: string | null;
  note?: string | null;
  employeeWhere?: Prisma.EmployeeWhereInput | null;
  payrollMappingProfile?: string | null;
  dailyExportProfile?: PuantajExportProfile | null;
  monthlyExportProfile?: PuantajExportProfile | null;
}): Promise<{
  period: Awaited<ReturnType<typeof getOrCreatePayrollPeriod>>;
  readiness: PayrollPeriodReadiness;
  snapshot: Awaited<ReturnType<typeof getLatestPayrollPeriodSnapshot>>;
  mappingResolution: PayrollMappingResolutionInfo;
  payrollRuleDiagnostics: PayrollRuleDiagnosticsSummary;
}> {
  assertValidMonth(args.month);

  const resolvedPayrollMappingProfile = await resolvePayrollCodeMappingProfile({
    companyId: args.companyId,
    code: args.payrollMappingProfile ?? null,
    autoSeedDefault: true,
  });
  const mappingResolution: PayrollMappingResolutionInfo = {
    requestedProfileCode: args.payrollMappingProfile ?? null,
    resolvedProfileCode: resolvedPayrollMappingProfile.code,
    resolvedProfileSource: resolvedPayrollMappingProfile.source,
  };
  const payrollMappingProfile = resolvedPayrollMappingProfile.code;
  const dailyExportProfile = args.dailyExportProfile ?? "STANDARD_DAILY";
  const monthlyExportProfile = args.monthlyExportProfile ?? "PAYROLL_CODE_SUMMARY";
  const normalizedNote = (args.note ?? "").trim() || null;

  const readiness = await evaluatePayrollPeriodReadiness({
    companyId: args.companyId,
    month: args.month,
    tz: args.tz,
    employeeWhere: args.employeeWhere ?? null,
  });

  if (!readiness.isReadyToClose) {
    const error = new Error("PERIOD_NOT_READY_TO_CLOSE");
    (error as Error & { readiness?: PayrollPeriodReadiness }).readiness = readiness;
    throw error;
  }

  const existingPeriod = await getOrCreatePayrollPeriod(args.companyId, args.month);
  const latestSnapshot = await getLatestPayrollPeriodSnapshot({
    companyId: args.companyId,
    month: args.month,
  });

  if (existingPeriod.status === "CLOSED" && latestSnapshot?.status === "FINAL") {
    const { payrollRuleDiagnostics } = await buildSnapshotSourceData({
      companyId: args.companyId,
      month: args.month,
      tz: args.tz,
      employeeWhere: args.employeeWhere ?? null,
      payrollMappingProfile,
    });

    return {
      period: existingPeriod,
      readiness,
      snapshot: latestSnapshot,
      mappingResolution,
      payrollRuleDiagnostics,
    };
  }

  const {
    employeeItems,
    codeItems,
    payrollRuleDiagnostics,
  } = await buildSnapshotSourceData({
    companyId: args.companyId,
    month: args.month,
    tz: args.tz,
    employeeWhere: args.employeeWhere ?? null,
    payrollMappingProfile,
  });

  const employeeCount = employeeItems.length;
  const payrollReadyCount = employeeItems.filter((x) => x.isPayrollReady).length;
  const blockedEmployeeCount = employeeItems.filter((x) => x.blockedDays > 0).length;
  const blockedDayCount = employeeItems.reduce((sum, x) => sum + x.blockedDays, 0);
  const reviewRequiredDayCount = employeeItems.reduce((sum, x) => sum + x.reviewRequiredDays, 0);
  const pendingReviewDayCount = employeeItems.reduce((sum, x) => sum + x.pendingReviewDays, 0);
  const rejectedReviewDayCount = employeeItems.reduce((sum, x) => sum + x.rejectedReviewDays, 0);

  const result = await prisma.$transaction(async (tx) => {
    const now = new Date();

    const period =
      existingPeriod.status === "CLOSED"
        ? await tx.payrollPeriod.findUniqueOrThrow({
            where: {
              companyId_month: {
                companyId: args.companyId,
                month: args.month,
              },
            },
            include: {
              preClosedByUser: {
                select: { id: true, email: true, role: true },
              },
              closedByUser: {
                select: { id: true, email: true, role: true },
              },
            },
          })
        : await tx.payrollPeriod.update({
            where: {
              companyId_month: {
                companyId: args.companyId,
                month: args.month,
              },
            },
            data: {
              status: "CLOSED",
              preClosedAt: existingPeriod.preClosedAt ?? now,
              preClosedByUserId:
                existingPeriod.preClosedByUserId ?? (args.actorUserId ?? null),
              closedAt: now,
              closedByUserId: args.actorUserId ?? null,
              note: normalizedNote ?? existingPeriod.note ?? null,
            },
            include: {
              preClosedByUser: {
                select: { id: true, email: true, role: true },
              },
              closedByUser: {
                select: { id: true, email: true, role: true },
              },
            },
          });

    const snapshot = await tx.payrollPeriodSnapshot.create({
      data: {
        companyId: args.companyId,
        periodId: period.id,
        month: args.month,
        status: "DRAFT",
        payrollMappingProfile,
        dailyExportProfile,
        monthlyExportProfile,
        employeeCount,
        payrollReadyCount,
        blockedEmployeeCount,
        blockedDayCount,
        reviewRequiredDayCount,
        pendingReviewDayCount,
        rejectedReviewDayCount,
        createdByUserId: args.actorUserId ?? null,
      },
    });

    if (employeeItems.length > 0) {
      await tx.payrollPeriodSnapshotEmployee.createMany({
        data: employeeItems.map((item) => ({
          snapshotId: snapshot.id,
          employeeId: item.employeeId,
          employeeCode: item.employeeCode,
          fullName: item.fullName,
          month: item.month,
          dayCount: item.dayCount,
          presentDays: item.presentDays,
          absentDays: item.absentDays,
          offDays: item.offDays,
          leaveDays: item.leaveDays,
          annualLeaveDays: item.annualLeaveDays,
          sickLeaveDays: item.sickLeaveDays,
          excusedLeaveDays: item.excusedLeaveDays,
          unpaidLeaveDays: item.unpaidLeaveDays,
          unknownLeaveDays: item.unknownLeaveDays,
          workedMinutes: item.workedMinutes,
          overtimeMinutes: item.overtimeMinutes,
          overtimeEarlyMinutes: item.overtimeEarlyMinutes,
          overtimeLateMinutes: item.overtimeLateMinutes,
          lateMinutes: item.lateMinutes,
          earlyLeaveMinutes: item.earlyLeaveMinutes,
          blockedDays: item.blockedDays,
          readyDays: item.readyDays,
          reviewRequiredDays: item.reviewRequiredDays,
          pendingReviewDays: item.pendingReviewDays,
          rejectedReviewDays: item.rejectedReviewDays,
          manualAdjustmentDays: item.manualAdjustmentDays,
          anomalyDays: item.anomalyDays,
          puantajCodes: item.puantajCodes,
          isPayrollReady: item.isPayrollReady,
        })),
      });
    }

    if (codeItems.length > 0) {
      await tx.payrollPeriodSnapshotCodeRow.createMany({
        data: codeItems.map((item) => ({
          snapshotId: snapshot.id,
          employeeId: item.employeeId,
          employeeCode: item.employeeCode,
          fullName: item.fullName,
          month: item.month,
          puantajCode: item.code,
          payrollCode: item.payrollCode,
          payrollLabel: item.payrollLabel,
          unit: toSnapshotUnit(item.unit),
          quantityStrategy: toSnapshotQuantityStrategy(item.quantityStrategy),
          fixedQuantity: item.fixedQuantity == null ? null : toDecimal(item.fixedQuantity),
          quantity: toDecimal(item.quantity),
          dayCount: item.dayCount,
          totalMinutes: item.totalMinutes,
        })),
      });
    }

    const finalizedSnapshot = await tx.payrollPeriodSnapshot.update({
      where: { id: snapshot.id },
      data: {
        status: "FINAL",
      },
      include: {
        createdByUser: {
          select: { id: true, email: true, role: true },
        },
        _count: {
          select: {
            employeeRows: true,
            codeRows: true,
          },
        },
      },
    });

    return {
      period,
      snapshot: finalizedSnapshot,
    };
  });

  return {
    period: result.period,
    readiness,
    snapshot: result.snapshot,
    mappingResolution,
    payrollRuleDiagnostics,
  };
}