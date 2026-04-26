import { writeAudit } from "@/src/audit/writeAudit";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { dbDateFromDayKey, dayKeyToday } from "@/src/utils/dayKey";
import { AuditAction, AuditTargetType, type UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";

export type EmployeeHardDeleteWarningLevel = "W0" | "W1" | "W2" | "W3";
export const HARD_DELETE_CONFIRMATION_PHRASE = "HARD DELETE";

function toDayKey(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function summarizeMonths(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function summarizeTouchedPeriods(items: Array<{ month: string; status: string }>) {
  const unique = Array.from(
    new Map(items.map((x) => [`${x.month}:${x.status}`, x] as const)).values(),
  ).sort((a, b) => a.month.localeCompare(b.month));

  return unique;
}

function monthKeyFromDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const raw =
    typeof value === "string"
      ? value
      : value instanceof Date
        ? value.toISOString()
        : String(value);
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 7);
  return s.length >= 7 ? s.slice(0, 7) : null;
}

function expandMonthRange(startMonth: string | null, endMonth: string | null): string[] {
  if (!startMonth && !endMonth) return [];
  const start = startMonth ?? endMonth;
  const end = endMonth ?? startMonth;
  if (!start || !end) return [];

  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  if (!sy || !sm || !ey || !em) return [];

  const out: string[] = [];
  let y = sy;
  let m = sm;

  while (y < ey || (y === ey && m <= em)) {
    out.push(`${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
    if (out.length > 36) break;
  }

  return out;
}

function buildWarning(args: {
  activeToday: boolean;
  openEmploymentPeriodCount: number;
  rawEventCount: number;
  normalizedEventCount: number;
  dailyAttendanceCount: number;
  dailyAdjustmentCount: number;
  leaveCount: number;
  weeklyShiftPlanCount: number;
  attendanceOwnershipAuditCount: number;
  integrationLinkCount: number;
  assignmentCount: number;
  resolvedDeviceInboxRefCount: number;
  payrollSnapshotEmployeeRowCount: number;
  payrollSnapshotCodeRowCount: number;
  payrollAuditEventCount: number;
  touchedPayrollPeriods: Array<{ month: string; status: string }>;
}) {
  const touchedCriticalPayrollPeriods = args.touchedPayrollPeriods.filter(
    (x) => x.status === "PRE_CLOSED" || x.status === "CLOSED",
  );

  const hasOperationalData =
    args.rawEventCount > 0 ||
    args.normalizedEventCount > 0 ||
    args.dailyAttendanceCount > 0 ||
    args.dailyAdjustmentCount > 0 ||
    args.leaveCount > 0 ||
    args.weeklyShiftPlanCount > 0 ||
    args.attendanceOwnershipAuditCount > 0;

  const hasConfigSurface =
    args.integrationLinkCount > 0 ||
    args.assignmentCount > 0 ||
    args.openEmploymentPeriodCount > 0 ||
    args.resolvedDeviceInboxRefCount > 0;

  const hasHistoricalLedger =
    args.payrollSnapshotEmployeeRowCount > 0 ||
    args.payrollSnapshotCodeRowCount > 0 ||
    args.payrollAuditEventCount > 0;

  const heavyOperationalFootprint =
    args.rawEventCount >= 50 ||
    args.normalizedEventCount >= 50 ||
    args.dailyAttendanceCount >= 15 ||
    args.attendanceOwnershipAuditCount >= 50;

  let level: EmployeeHardDeleteWarningLevel = "W0";

  if (
    args.activeToday ||
    args.openEmploymentPeriodCount > 0 ||
    touchedCriticalPayrollPeriods.length > 0 ||
    hasHistoricalLedger ||
    heavyOperationalFootprint
  ) {
    level = "W3";
  } else if (hasOperationalData) {
    level = "W2";
  } else if (hasConfigSurface) {
    level = "W1";
  }

  const title =
    level === "W3"
      ? "Bu personel için kritik hard delete riski var"
      : level === "W2"
        ? "Bu personel için operasyonel zaman verisi silinecek"
        : level === "W1"
          ? "Bu personel için sınırlı kapsamlı silme etkisi var"
          : "Bu personel için silinecek operasyonel veri bulunmadı";

  const messages: string[] = [];

  if (args.activeToday) {
    messages.push("Personel bugün itibarıyla aktif kapsamda görünüyor.");
  }

  if (args.openEmploymentPeriodCount > 0) {
    messages.push(`Açık employment period sayısı: ${args.openEmploymentPeriodCount}.`);
  }

  if (args.rawEventCount > 0 || args.dailyAttendanceCount > 0) {
    messages.push(
      `Operational graph içinde ${args.rawEventCount} raw event ve ${args.dailyAttendanceCount} daily attendance kaydı bulundu.`,
    );
  }

  if (args.weeklyShiftPlanCount > 0 || args.leaveCount > 0 || args.dailyAdjustmentCount > 0) {
    messages.push(
      `Ek operasyonel yüzey bulundu: ${args.weeklyShiftPlanCount} weekly plan, ${args.leaveCount} leave, ${args.dailyAdjustmentCount} adjustment.`,
    );
  }

  if (args.resolvedDeviceInboxRefCount > 0) {
    messages.push(
      `${args.resolvedDeviceInboxRefCount} device inbox kaydı çalışan bağlantısı kaldırılarak korunacaktır.`,
    );
  }

  if (hasHistoricalLedger) {
    messages.push(
      "Payroll snapshot ve payroll audit ledger kayıtları default hard delete kapsamında korunacaktır.",
    );
  }

  if (args.touchedPayrollPeriods.length > 0) {
    const label = args.touchedPayrollPeriods.map((x) => `${x.month} (${x.status})`).join(", ");
    messages.push(`Tarihsel payroll izi bulunan dönemler: ${label}.`);
  }

  if (level === "W0") {
    messages.push("Silme önizlemesinde employee ana kaydı dışında operasyonel veri izi bulunmadı.");
  }

  return { level, title, messages };
}

function buildRecommendation(args: {
  employeeId: string;
  activeToday: boolean;
  openEmploymentPeriodCount: number;
}) {
  const shouldSuggestTerminate =
    args.activeToday || args.openEmploymentPeriodCount > 0;

  if (!shouldSuggestTerminate) {
    return {
      shouldSuggestTerminateFirst: false,
      severity: "NONE" as const,
      title: null,
      message: null,
      actions: {
        terminateFirst: null,
      },
    };
  }

  return {
    shouldSuggestTerminateFirst: true,
    severity: "ADVISORY" as const,
    title: "Önce kapsamı sonlandırmanız önerilir",
    message:
      "Bu personel bugün itibarıyla aktif kapsamda veya açık employment period durumunda görünüyor. Hard delete yine mümkündür; ancak önce kapsamı sonlandırmanız operasyonel görünürlüğü daha kontrollü şekilde kapatır.",
    actions: {
      terminateFirst: `/api/employees/${args.employeeId}/terminate`,
    },
  };
}

function buildOperationalImpact(args: {
  months: string[];
  touchedPayrollPeriods: Array<{ month: string; status: string }>;
}) {
  const openPeriods = args.touchedPayrollPeriods.filter((x) => x.status === "OPEN");
  const preClosedPeriods = args.touchedPayrollPeriods.filter((x) => x.status === "PRE_CLOSED");
  const requiresExplicitOverride = openPeriods.length > 0 || preClosedPeriods.length > 0;

  return {
    touchedMonths: args.months,
    touchedPeriodCount: args.touchedPayrollPeriods.length,
    touchedOpenPeriods: openPeriods,
    touchedPreClosedPeriods: preClosedPeriods,
    requiresExplicitOverride,
    title: requiresExplicitOverride
      ? "Canlı operasyon dönemi etkisi var"
      : "Canlı operasyon dönemi etkisi bulunmadı",
    message: requiresExplicitOverride
      ? "Bu silme işlemi açık veya ön kapanış durumundaki dönemleri etkileyebilir. İşlem yine mümkündür; ancak canlı operasyon dönemi etkisini ayrıca onaylamanız gerekir."
      : "Silme önizlemesinde açık veya ön kapanış durumundaki canlı dönem etkisi bulunmadı.",
  };
}

export async function previewEmployeeHardDelete(employeeId: string) {
  const companyId = await getActiveCompanyId();
  const bundle = await getCompanyBundle();
  const tz = bundle.policy?.timezone || "Europe/Istanbul";
  const todayDayKey = dayKeyToday(tz);
  const todayDb = dbDateFromDayKey(todayDayKey);

  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, companyId },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        cardNo: true,
        deviceUserId: true,
        branch: { select: { id: true, code: true, name: true } },
        employeeGroup: { select: { id: true, code: true, name: true } },
        employeeSubgroup: { select: { id: true, code: true, name: true } },
        employmentPeriods: {
          orderBy: [{ startDate: "desc" }],
          take: 3,
          select: {
            id: true,
            startDate: true,
            endDate: true,
            reason: true,
          },
        },
      },
    });

    if (!employee) {
      throw new Error("EMPLOYEE_NOT_FOUND");
    }

    const [
      employmentPeriodCount,
      openEmploymentPeriodCount,
      employeeActionCount,
      activePeriod,
      rawEventAgg,
      normalizedEventCount,
      dailyAttendanceAgg,
      dailyAdjustmentCount,
      leaveCount,
      weeklyShiftPlanCount,
      attendanceOwnershipAuditCount,
      integrationEmployeeLinkCount,
      integrationLeaveLinkCount,
      integrationWeeklyShiftPlanLinkCount,
      policyAssignmentCount,
      shiftPolicyAssignmentCount,
      workScheduleAssignmentCount,
      resolvedDeviceInboxRefCount,
      payrollSnapshotEmployeeRowCount,
      payrollSnapshotCodeRowCount,
      payrollAuditEventCount,
      touchedPayrollPeriods,
      payrollAuditMonths,
    ] = await Promise.all([
      tx.employeeEmploymentPeriod.count({
        where: { companyId, employeeId },
      }),
      tx.employeeEmploymentPeriod.count({
        where: { companyId, employeeId, endDate: null },
      }),
      tx.employeeAction.count({
        where: { companyId, employeeId },
      }),
      tx.employeeEmploymentPeriod.findFirst({
        where: {
          companyId,
          employeeId,
          startDate: { lte: todayDb },
          OR: [{ endDate: null }, { endDate: { gte: todayDb } }],
        },
        select: { id: true },
      }),
      tx.rawEvent.aggregate({
        where: { companyId, employeeId },
        _count: { _all: true },
        _min: { occurredAt: true },
        _max: { occurredAt: true },
      }),
      tx.normalizedEvent.count({
        where: { companyId, employeeId },
      }),
      tx.dailyAttendance.aggregate({
        where: { companyId, employeeId },
        _count: { _all: true },
        _min: { workDate: true },
        _max: { workDate: true },
      }),
      tx.dailyAdjustment.count({
        where: { companyId, employeeId },
      }),
      tx.employeeLeave.count({
        where: { companyId, employeeId },
      }),
      tx.weeklyShiftPlan.count({
        where: { companyId, employeeId },
      }),
      tx.attendanceOwnershipAudit.count({
        where: { companyId, employeeId },
      }),
      tx.integrationEmployeeLink.count({
        where: { companyId, employeeId },
      }),
      tx.integrationLeaveLink.count({
        where: { companyId, employeeId },
      }),
      tx.integrationWeeklyShiftPlanLink.count({
        where: { companyId, employeeId },
      }),
      tx.policyAssignment.count({
        where: { companyId, employeeId },
      }),
      tx.shiftPolicyAssignment.count({
        where: { companyId, employeeId },
      }),
      tx.workScheduleAssignment.count({
        where: { companyId, employeeId },
      }),
      tx.deviceInboxEvent.count({
        where: { companyId, resolvedEmployeeId: employeeId },
      }),
      tx.payrollPeriodSnapshotEmployee.count({
        where: {
          employeeId,
          snapshot: {
            is: { companyId },
          },
        },
      }),
      tx.payrollPeriodSnapshotCodeRow.count({
        where: {
          employeeId,
          snapshot: {
            is: { companyId },
          },
        },
      }),
      tx.payrollAuditEvent.count({
        where: { companyId, employeeId },
      }),
      tx.payrollPeriod.findMany({
        where: {
          companyId,
          snapshots: {
            some: {
              employeeRows: {
                some: { employeeId },
              },
            },
          },
        },
        orderBy: [{ month: "asc" }],
        select: {
          month: true,
          status: true,
        },
      }),
      tx.payrollAuditEvent.findMany({
        where: { companyId, employeeId, month: { not: null } },
        orderBy: [{ month: "asc" }],
        select: { month: true },
      }),
    ]);

    const integrationLinkCount =
      integrationEmployeeLinkCount + integrationLeaveLinkCount + integrationWeeklyShiftPlanLinkCount;

    const assignmentCount =
      policyAssignmentCount + shiftPolicyAssignmentCount + workScheduleAssignmentCount;

    const payrollPeriods = summarizeTouchedPeriods(
      touchedPayrollPeriods.map((x) => ({ month: x.month, status: x.status })),
    );

    const payrollMonthsFromAudit = summarizeMonths(
      payrollAuditMonths.map((x) => String(x.month ?? "")).filter(Boolean),
    );

    const warning = buildWarning({
      activeToday: !!activePeriod,
      openEmploymentPeriodCount,
      rawEventCount: rawEventAgg._count._all,
      normalizedEventCount,
      dailyAttendanceCount: dailyAttendanceAgg._count._all,
      dailyAdjustmentCount,
      leaveCount,
      weeklyShiftPlanCount,
      attendanceOwnershipAuditCount,
      integrationLinkCount,
      assignmentCount,
      resolvedDeviceInboxRefCount,
      payrollSnapshotEmployeeRowCount,
      payrollSnapshotCodeRowCount,
      payrollAuditEventCount,
      touchedPayrollPeriods: payrollPeriods,
    });

    const recommendation = buildRecommendation({
      employeeId,
      activeToday: !!activePeriod,
      openEmploymentPeriodCount,
    });

    const rawFromMonth = monthKeyFromDate(rawEventAgg._min.occurredAt);
    const rawToMonth = monthKeyFromDate(rawEventAgg._max.occurredAt);
    const dailyFromMonth = monthKeyFromDate(dailyAttendanceAgg._min.workDate);
    const dailyToMonth = monthKeyFromDate(dailyAttendanceAgg._max.workDate);

    const operationalTouchedMonths = Array.from(
      new Set([
        ...expandMonthRange(rawFromMonth, rawToMonth),
        ...expandMonthRange(dailyFromMonth, dailyToMonth),
      ]),
    ).sort();

    const operationalTouchedPayrollPeriods = await tx.payrollPeriod.findMany({
      where: {
        companyId,
        month: { in: operationalTouchedMonths.length > 0 ? operationalTouchedMonths : ["__NO_MONTH__"] },
      },
      orderBy: [{ month: "asc" }],
      select: {
        month: true,
        status: true,
      },
    });

    const operationalImpact = buildOperationalImpact({
      months: operationalTouchedMonths,
      touchedPayrollPeriods: operationalTouchedPayrollPeriods.map((x) => ({
        month: x.month,
        status: x.status,
      })),
    });

    return {
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        firstName: employee.firstName,
        lastName: employee.lastName,
        fullName: `${employee.firstName} ${employee.lastName}`.trim(),
        email: employee.email,
        isActive: employee.isActive,
        activeToday: !!activePeriod,
        cardNo: employee.cardNo,
        deviceUserId: employee.deviceUserId,
        branch: employee.branch,
        employeeGroup: employee.employeeGroup,
        employeeSubgroup: employee.employeeSubgroup,
        recentEmploymentPeriods: employee.employmentPeriods.map((p) => ({
          id: p.id,
          startDate: toDayKey(p.startDate),
          endDate: toDayKey(p.endDate),
          reason: p.reason,
        })),
      },
      policy: {
        mode: "OPERATIONAL_HARD_DELETE",
        preservesHistoricalLedger: true,
        previewGeneratedAt: new Date().toISOString(),
        timezone: tz,
        todayDayKey,
      },
      counts: {
        operationalDelete: {
          employmentPeriods: employmentPeriodCount,
          employeeActions: employeeActionCount,
          rawEvents: rawEventAgg._count._all,
          normalizedEvents: normalizedEventCount,
          dailyAttendances: dailyAttendanceAgg._count._all,
          attendanceOwnershipAudits: attendanceOwnershipAuditCount,
          dailyAdjustments: dailyAdjustmentCount,
          employeeLeaves: leaveCount,
          weeklyShiftPlans: weeklyShiftPlanCount,
          integrationEmployeeLinks: integrationEmployeeLinkCount,
          integrationLeaveLinks: integrationLeaveLinkCount,
          integrationWeeklyShiftPlanLinks: integrationWeeklyShiftPlanLinkCount,
          policyAssignments: policyAssignmentCount,
          shiftPolicyAssignments: shiftPolicyAssignmentCount,
          workScheduleAssignments: workScheduleAssignmentCount,
        },
        detachOnly: {
          resolvedDeviceInboxRefs: resolvedDeviceInboxRefCount,
        },
        preserveHistoricalLedger: {
          payrollSnapshotEmployeeRows: payrollSnapshotEmployeeRowCount,
          payrollSnapshotCodeRows: payrollSnapshotCodeRowCount,
          payrollAuditEvents: payrollAuditEventCount,
        },
      },
      ranges: {
        rawEvents:
          rawEventAgg._count._all > 0
            ? {
                fromOccurredAt: rawEventAgg._min.occurredAt?.toISOString() ?? null,
                toOccurredAt: rawEventAgg._max.occurredAt?.toISOString() ?? null,
              }
            : null,
        dailyAttendance:
          dailyAttendanceAgg._count._all > 0
            ? {
                fromWorkDate: toDayKey(dailyAttendanceAgg._min.workDate),
                toWorkDate: toDayKey(dailyAttendanceAgg._max.workDate),
              }
            : null,
      },
      payrollImpact: {
        touchedPeriods: payrollPeriods,
        touchedPeriodCount: payrollPeriods.length,
        auditMonths: payrollMonthsFromAudit,
      },
      operationalImpact,
      recommendation,
      warning,
    };
  });
}

export async function applyEmployeeHardDelete(args: {
  employeeId: string;
  actorUserId: string;
  actorRole: UserRole;
  req?: NextRequest | Request;
  confirmEmployeeCode: string;
  confirmationText: string;
  allowActiveScopeDelete?: boolean;
  allowOperationalPeriodImpactDelete?: boolean;
  preserveHistoricalLedger?: boolean;
}) {
  const companyId = await getActiveCompanyId();

  const preview = await previewEmployeeHardDelete(args.employeeId);

  const confirmEmployeeCode = String(args.confirmEmployeeCode ?? "").trim();
  const confirmationText = String(args.confirmationText ?? "").trim().toUpperCase();
  const allowActiveScopeDelete = !!args.allowActiveScopeDelete;
  const allowOperationalPeriodImpactDelete = !!args.allowOperationalPeriodImpactDelete;
  const preserveHistoricalLedger = args.preserveHistoricalLedger !== false;

  if (!confirmEmployeeCode) {
    throw new Error("EMPLOYEE_CODE_CONFIRM_REQUIRED");
  }

  if (confirmEmployeeCode !== preview.employee.employeeCode) {
    throw new Error("EMPLOYEE_CODE_CONFIRM_MISMATCH");
  }

  if (!confirmationText) {
    throw new Error("HARD_DELETE_CONFIRMATION_REQUIRED");
  }

  if (confirmationText !== HARD_DELETE_CONFIRMATION_PHRASE) {
    throw new Error("HARD_DELETE_CONFIRMATION_MISMATCH");
  }

  if (!preserveHistoricalLedger) {
    throw new Error("PRESERVE_HISTORICAL_LEDGER_REQUIRED");
  }

  if (preview.recommendation?.shouldSuggestTerminateFirst && !allowActiveScopeDelete) {
    throw new Error("ACTIVE_SCOPE_DELETE_REQUIRES_OVERRIDE");
  }

  if (preview.operationalImpact?.requiresExplicitOverride && !allowOperationalPeriodImpactDelete) {
    throw new Error("OPEN_PERIOD_IMPACT_REQUIRES_OVERRIDE");
  }

  const deletedAt = new Date().toISOString();

  const result = await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findFirst({
      where: { id: args.employeeId, companyId },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    if (!employee) {
      throw new Error("EMPLOYEE_NOT_FOUND");
    }

    // Bu transaction içinde sadece employee ana kaydı silinir.
    // İlişkili operational graph child kayıtları DB cascade ile temizlenir.
    // DeviceInboxEvent.resolvedEmployeeId ise onDelete:SetNull ile detach olur.
    await tx.employee.delete({
      where: {
        id: employee.id,
      },
    });

    return {
      deletedEmployee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: `${employee.firstName} ${employee.lastName}`.trim(),
        wasActiveFlag: employee.isActive,
      },
    };
  });

  await writeAudit({
    req: args.req,
    actorUserId: args.actorUserId,
    actorRole: args.actorRole,
    action: AuditAction.EMPLOYEE_HARD_DELETE,
    targetType: AuditTargetType.EMPLOYEES,
    targetId: args.employeeId,
    details: {
      mode: "OPERATIONAL_HARD_DELETE",
      preservesHistoricalLedger: true,
      deletedAt,
      confirmation: {
        confirmEmployeeCode,
        confirmationText,
        allowActiveScopeDelete,
        allowOperationalPeriodImpactDelete,
      },
      employee: {
        id: preview.employee.id,
        employeeCode: preview.employee.employeeCode,
        fullName: preview.employee.fullName,
        email: preview.employee.email,
        isActive: preview.employee.isActive,
        activeToday: preview.employee.activeToday,
      },
      counts: preview.counts,
      ranges: preview.ranges,
      payrollImpact: preview.payrollImpact,
      operationalImpact: preview.operationalImpact,
      recommendation: preview.recommendation,
      warning: preview.warning,
    },
  });

  return {
    ok: true,
    deletedAt,
    mode: "OPERATIONAL_HARD_DELETE",
    preservesHistoricalLedger: true,
    employee: result.deletedEmployee,
    detachedResolvedDeviceInboxRefs: preview.counts.detachOnly.resolvedDeviceInboxRefs,
    preservedHistoricalLedger: preview.counts.preserveHistoricalLedger,
    deletedOperationalCounts: preview.counts.operationalDelete,
    operationalImpact: preview.operationalImpact,
    warning: preview.warning,
  };
}