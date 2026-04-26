import { DateTime } from "luxon";
import { EventDirection, NormalizedStatus } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { buildShiftInstance, type ShiftInstance } from "@/src/domain/attendance/shiftInstance";
import { chooseBestOwnership } from "@/src/domain/attendance/ownership";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import {
  applyFallbackMinutesToResolvedShift,
  computeWeekStartUTC,
  findWeeklyShiftPlansForEmployees,
  resolveShiftMinutesForEmployeeOnDateWithWeeklyPlan,
} from "@/src/services/shiftPlan.service";
import { resolveWorkScheduleShiftsForEmployeesOnDate } from "@/src/services/workSchedule.service";
import { computeDailyAttendance } from "@/src/domain/attendance/computeDaily";
import { evaluateAttendanceDay } from "@/src/domain/attendance/evaluateAttendanceDay";
import { normalizePunches } from "@/src/domain/attendance/normalizePunches";
import { findDailyAttendanceByKey, upsertDailyAttendance } from "@/src/repositories/attendance.repo";
import {
   upsertNormalizedForRawEventsBatch,
   type NormalizedUpsertInput,
 } from "@/src/repositories/normalizedEvent.repo";
import {
  upsertAttendanceOwnershipAuditsBatch,
  type OwnershipAuditUpsertInput,
} from "@/src/repositories/attendanceOwnershipAudit.repo";
import { dbDateFromDayKey } from "@/src/utils/dayKey";

function toComputePolicy(policy: any) {
  return {
    shiftStartMinute: policy.shiftStartMinute ?? undefined,
    shiftEndMinute: policy.shiftEndMinute ?? undefined,
    breakAutoDeductEnabled: policy.breakAutoDeductEnabled ?? undefined,
    breakMinutes: policy.breakMinutes ?? undefined,
    lateGraceMinutes: policy.lateGraceMinutes ?? undefined,
    earlyLeaveGraceMinutes: policy.earlyLeaveGraceMinutes ?? undefined,
    offDayEntryBehavior: policy.offDayEntryBehavior ?? undefined,
    overtimeEnabled: policy.overtimeEnabled ?? undefined,

    // Advanced / Optional (DB null -> domain undefined)
    graceAffectsWorked: policy.graceAffectsWorked ?? undefined,
    graceMode: policy.graceMode ?? undefined,
    exitConsumesBreak: policy.exitConsumesBreak ?? undefined,
    maxSingleExitMinutes: policy.maxSingleExitMinutes ?? undefined,
    maxDailyExitMinutes: policy.maxDailyExitMinutes ?? undefined,
    exitExceedAction: policy.exitExceedAction ?? undefined,

    // Enterprise: overtime dynamic break (DB null -> domain undefined)
    otBreakInterval: policy.otBreakInterval ?? undefined,
    otBreakDuration: policy.otBreakDuration ?? undefined,

    // Worked minutes calculation mode (default handled in computeDaily)
    workedCalculationMode: policy.workedCalculationMode ?? undefined,

    // Ownership engine
    attendanceOwnershipMode: policy.attendanceOwnershipMode ?? undefined,
    minimumRestMinutes: policy.minimumRestMinutes ?? undefined,
    ownershipEarlyInMinutes: policy.ownershipEarlyInMinutes ?? undefined,
    ownershipLateOutMinutes: policy.ownershipLateOutMinutes ?? undefined,
    ownershipNextShiftLookaheadMinutes: policy.ownershipNextShiftLookaheadMinutes ?? undefined,
    unscheduledWorkBehavior: policy.unscheduledWorkBehavior ?? undefined,
  };
}

type ComputePolicyInput = ReturnType<typeof toComputePolicy>;

/**
 * Model-A kilidi (SAP-benzeri):
 * - Policy (work rules) sadece Workforce/Segment çözümlemesinden gelir.
 * - Shift (vardiya) sadece Shift Plan çözümlemesinden gelir.
 *
 * Hesap motoru (computeDaily) bugün... vardiya penceresini bilmek zorunda olduğu için,
 * sadece shiftStartMinute/shiftEndMinute alanlarını “engine input” üzerinde güncelleriz.
 * Diğer policy alanları (grace/break/OT/leave...) shift plan tarafından ASLA override edilmez.
 */
function applyResolvedShiftMinutesToComputePolicy(args: {
  base: ComputePolicyInput;
  resolved: { startMinute?: number; endMinute?: number };
}): ComputePolicyInput {
  const { base, resolved } = args;
  if (typeof resolved.startMinute === "number" && typeof resolved.endMinute === "number") {
    const next = {
      ...base,
      shiftStartMinute: resolved.startMinute,
      shiftEndMinute: resolved.endMinute,
    };
    // Guardrail: prevent accidental runtime mutation leaks in dev.
    if (process.env.NODE_ENV !== "production") return Object.freeze(next);
    return next;
  }
  if (process.env.NODE_ENV !== "production") return Object.freeze({ ...base });
  return base;
}

function mergePolicyRules(baseCompanyPolicy: any, ruleSet: any) {
  // CompanyPolicy = company-level (timezone vb.) source of truth.
  // RuleSet = override layer.
  // IMPORTANT: null/undefined in ruleSet must NOT wipe base values.
  const merged: any = { ...baseCompanyPolicy };
  if (ruleSet && typeof ruleSet === "object") {
    for (const [k, v] of Object.entries(ruleSet)) {
      if (v === null || v === undefined) continue;
      merged[k] = v;
    }
  }
  // TIME is canonical on company policy
  merged.timezone = baseCompanyPolicy.timezone;
  return merged;
}

function addDaysToDayKey(dayKey: string, days: number, tz: string) {
  return DateTime.fromISO(dayKey, { zone: tz }).plus({ days }).toISODate()!;
}

function isDateWithinRange(dayKey: string, validFrom?: Date | null, validTo?: Date | null) {
  const d = dbDateFromDayKey(dayKey).getTime();
  const fromOk = !validFrom || validFrom.getTime() <= d;
  const toOk = !validTo || validTo.getTime() >= d;
  return fromOk && toOk;
}

function isPostEndInForInstance(args: {
  event: { occurredAt: Date; direction: EventDirection };
  instance: ShiftInstance;
}) {
  const { event, instance } = args;
  if (event.direction !== "IN") return false;
  if (!instance.plannedEndUtc) return false;
  return event.occurredAt > instance.plannedEndUtc;
}

function shouldIncludeInScheduledOwnedEvents(args: {
  date: string;
  event: { id: string; occurredAt: Date; direction: EventDirection };
  ownerLogicalDayKey: string | null;
  currentInstance: ShiftInstance;
  isOffDay: boolean;
}) {
  const { date, event, ownerLogicalDayKey, currentInstance, isOffDay } = args;
  if (isOffDay) return false;
  if (ownerLogicalDayKey !== date) return false;

  // Critical guard:
  // Overnight/current scheduled attendance must never accept a post-end IN
  // as part of the previous logical day's scheduled set.
  if (isPostEndInForInstance({ event, instance: currentInstance })) return false;

  return true;
}

function hasRestViolation(args: {
  event: { occurredAt: Date; direction: EventDirection };
  lastAcceptedOutAt: Date | null;
  minimumRestMinutes?: number;
}) {
  if (args.event.direction !== "IN") return false;
  if (!args.lastAcceptedOutAt) return false;
  if (typeof args.minimumRestMinutes !== "number" || args.minimumRestMinutes <= 0) return false;

  const gapMinutes = Math.floor(
    (args.event.occurredAt.getTime() - args.lastAcceptedOutAt.getTime()) / 60000
  );
  if (gapMinutes < 0) return false;

  return gapMinutes < args.minimumRestMinutes;
}

function isIntraShiftReEntryForInstance(args: {
  event: { occurredAt: Date; direction: EventDirection };
  previousOutAt: Date | null;
  instance: ShiftInstance;
}) {
  const { event, previousOutAt, instance } = args;

  if (event.direction !== "IN") return false;
  if (!previousOutAt) return false;
  if (!instance.plannedStartUtc || !instance.plannedEndUtc) return false;

  const outInsideWindow =
    previousOutAt >= instance.plannedStartUtc &&
    previousOutAt <= instance.plannedEndUtc;

  const inInsideWindow =
    event.occurredAt >= instance.plannedStartUtc &&
    event.occurredAt <= instance.plannedEndUtc;

  return outInsideWindow && inInsideWindow;
}

function previousAcceptedOutAtOrNull(
  events: Array<{ occurredAt: Date; direction: EventDirection }>,
  index: number
): Date | null {
  for (let i = index - 1; i >= 0; i--) {
    if (events[i]?.direction === "OUT") {
      return events[i].occurredAt;
    }
  }
  return null;
}

function collectRestViolationEventIds(
  events: Array<{ id: string; occurredAt: Date; direction: EventDirection }>,
  minimumRestMinutes?: number,
  instance?: ShiftInstance
): Set<string> {
  const ids = new Set<string>();
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const previousOutAt = previousAcceptedOutAtOrNull(events, i);

    // SAP-benzeri koruma:
    // Aynı vardiya penceresi içindeki OUT -> IN dönüşleri
    // minimum rest violation olarak işaretlenmez.
    if (
      instance &&
      isIntraShiftReEntryForInstance({
        event: ev,
        previousOutAt,
        instance,
      })
    ) {
      continue;
    }
    if (
      hasRestViolation({
        event: ev,
        lastAcceptedOutAt: previousOutAt,
        minimumRestMinutes,
      })
    ) {
      ids.add(ev.id);
    }
  }
  return ids;
}

function buildReviewDecision(args: {
  anomalies: string[];
  scheduledOvertimeMinutes: number;
  unscheduledOvertimeMinutes: number;
  scheduledWorkedMinutes: number;
  unscheduledWorkedMinutes: number;
  exitExceedAction?: "IGNORE" | "WARN" | "FLAG";
}) {
  const reasons = new Set<string>();

  for (const a of args.anomalies) {
    if (
      a === "MISSING_PUNCH" ||
      a === "ORPHAN_OUT" ||
      a === "CONSECUTIVE_IN" ||
      a === "CONSECUTIVE_OUT" ||
      a === "REST_VIOLATION" ||
      a === "UNSCHEDULED_WORK" ||
      a === "OFF_DAY_WORK" ||
      a.startsWith("LEAVE_PUNCH_")
    ) {
      reasons.add(a);
    }

    if (
      args.exitExceedAction === "FLAG" &&
      (a === "SINGLE_EXIT_LIMIT_EXCEEDED" || a === "DAILY_EXIT_LIMIT_EXCEEDED")
    ) {
      reasons.add(a);
    }
  }

  if (args.unscheduledWorkedMinutes > 0) reasons.add("UNSCHEDULED_WORK_REVIEW");
  if (args.unscheduledOvertimeMinutes > 0) reasons.add("UNSCHEDULED_OT_REVIEW");

  return {
    requiresReview: reasons.size > 0,
    reviewReasons: Array.from(reasons),
  };
}

function sameDateTime(a?: Date | null, b?: Date | null) {
  const at = a ? a.getTime() : null;
  const bt = b ? b.getTime() : null;
  return at === bt;
}

function sameStringArray(a?: string[] | null, b?: string[] | null) {
  const aa = Array.isArray(a) ? [...a].sort() : [];
  const bb = Array.isArray(b) ? [...b].sort() : [];
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) {
    if (aa[i] !== bb[i]) return false;
  }
  return true;
}

function sameJsonLike(a: any, b: any) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function shouldResetReviewOnRecompute(args: {
  existing: any | null;
  next: {
    status: string;
    firstIn: Date | null;
    lastOut: Date | null;
    workedMinutes: number;
    scheduledWorkedMinutes: number;
    unscheduledWorkedMinutes: number;
    overtimeMinutes: number;
    scheduledOvertimeMinutes: number;
    unscheduledOvertimeMinutes: number;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    anomalies: string[];
    anomalyMeta?: any;
  };
}) {
  const e = args.existing;
  if (!e) return true;

  if (String(e.status ?? "") !== String(args.next.status ?? "")) return true;
  if (!sameDateTime(e.firstIn ?? null, args.next.firstIn ?? null)) return true;
  if (!sameDateTime(e.lastOut ?? null, args.next.lastOut ?? null)) return true;
  if (Number(e.workedMinutes ?? 0) !== Number(args.next.workedMinutes ?? 0)) return true;
  if (Number(e.scheduledWorkedMinutes ?? 0) !== Number(args.next.scheduledWorkedMinutes ?? 0)) return true;
  if (Number(e.unscheduledWorkedMinutes ?? 0) !== Number(args.next.unscheduledWorkedMinutes ?? 0)) return true;
  if (Number(e.overtimeMinutes ?? 0) !== Number(args.next.overtimeMinutes ?? 0)) return true;
  if (Number(e.scheduledOvertimeMinutes ?? 0) !== Number(args.next.scheduledOvertimeMinutes ?? 0)) return true;
  if (Number(e.unscheduledOvertimeMinutes ?? 0) !== Number(args.next.unscheduledOvertimeMinutes ?? 0)) return true;
  if (Number(e.lateMinutes ?? 0) !== Number(args.next.lateMinutes ?? 0)) return true;
  if (Number(e.earlyLeaveMinutes ?? 0) !== Number(args.next.earlyLeaveMinutes ?? 0)) return true;
  if (!sameStringArray(e.anomalies ?? [], args.next.anomalies ?? [])) return true;
  if (!sameJsonLike((e as any).anomalyMeta ?? null, args.next.anomalyMeta ?? null)) return true;

  return false;
}

function mapOwnerSourceToAuditSource(
  src: "PREVIOUS_DAY" | "CURRENT_DAY" | "NEXT_DAY" | null
) {
  if (src === "PREVIOUS_DAY") return "PREVIOUS_DAY" as const;
  if (src === "CURRENT_DAY") return "CURRENT_DAY" as const;
  if (src === "NEXT_DAY") return "NEXT_DAY" as const;
  return null;
}

function shouldAdvanceRestReferenceFromOwnershipDecision(args: {
  event: { occurredAt: Date; direction: EventDirection };
  decision: {
    ownerLogicalDayKey: string | null;
    ownerSource: "PREVIOUS_DAY" | "CURRENT_DAY" | "NEXT_DAY" | null;
    score: number;
  };
}) {
  const { event, decision } = args;

  if (event.direction !== "OUT") return false;

  // Faz G1.1 kuralı:
  // Rest referansı sadece gerçekten bir ownership winner'ı olan OUT event ile ilerler.
  // Böylece ownerless / rejected OUT event'ler sonraki IN kararlarını kirletemez.
  if (!decision.ownerLogicalDayKey) return false;
  if (!decision.ownerSource) return false;
  if (!Number.isFinite(decision.score)) return false;
  if (decision.score < 0) return false;

  return true;
}

function buildOwnershipAuditDisposition(args: {
  eventId: string;
  date: string;
  eventOccurredAt: Date;
  calendarDayStartUtc: Date;
  calendarDayEndUtc: Date;
  scheduledOwnedEventIds: Set<string>;
  visibleUnscheduledEventIds: Set<string>;
  ownerLogicalDayKey: string | null;
}) {
  if (args.scheduledOwnedEventIds.has(args.eventId)) {
    return {
      disposition: "SCHEDULED" as const,
      note: "Included in scheduled attendance set for current logical day.",
    };
  }

  if (args.visibleUnscheduledEventIds.has(args.eventId)) {
    return {
      disposition: "VISIBLE_UNSCHEDULED" as const,
      note: "Visible on current logical day as unscheduled/single-punch activity.",
    };
  }

  const inCurrentCalendarDay =
    args.eventOccurredAt >= args.calendarDayStartUtc &&
    args.eventOccurredAt < args.calendarDayEndUtc;

  if (inCurrentCalendarDay && args.ownerLogicalDayKey && args.ownerLogicalDayKey !== args.date) {
    return {
      disposition: "OWNED_OTHER_LOGICAL_DAY" as const,
      note: `Owned by another logical day: ${args.ownerLogicalDayKey}.`,
    };
  }

  return {
    disposition: "IGNORED" as const,
    note: "Not used by current logical day attendance materialization.",
  };
}

function isWithinInstancePlannedWindow(
  occurredAt: Date,
  instance?: ShiftInstance | null
) {
  if (!instance?.plannedStartUtc || !instance?.plannedEndUtc) return false;
  return occurredAt >= instance.plannedStartUtc && occurredAt <= instance.plannedEndUtc;
}

function shouldIncludeInVisibleCurrentDayEvents(args: {
  date: string;
  eventOccurredAt: Date;
  calendarDayStartUtc: Date;
  calendarDayEndUtc: Date;
  ownerLogicalDayKey: string | null;
  currentInstance: ShiftInstance;
  previousInstance?: ShiftInstance | null;
  nextInstance?: ShiftInstance | null;
}) {
  const {
    date,
    eventOccurredAt,
    calendarDayStartUtc,
    calendarDayEndUtc,
    ownerLogicalDayKey,
    currentInstance,
    previousInstance,
    nextInstance,
  } = args;

  // Primary rule:
  // Any event explicitly owned by the current logical day must be visible,
  // even if it falls outside the current calendar-day window
  // (critical for overnight spillover OUT events).
  if (ownerLogicalDayKey === date) return true;

  // If another logical day explicitly owns the event, never show it here.
  if (ownerLogicalDayKey && ownerLogicalDayKey !== date) return false;

  // Ownerless fallback #1:
  // Keep anything inside the current instance planned window visible.
  // This is the key overnight re-entry / spillover rescue path.
  if (isWithinInstancePlannedWindow(eventOccurredAt, currentInstance)) {
    return true;
  }

  // Ownerless fallback #2:
  // Same-calendar-day diagnostics are allowed only if the event is NOT
  // already covered by previous/next logical-day shift windows.
  //
  // This prevents cases like:
  // 24th logical day shift 22:00-06:00
  // 25th 01:30 IN
  //
  // from incorrectly showing up again on the 25th daily screen merely because
  // it is ownerless and inside the 25th calendar day.
  if (
    ownerLogicalDayKey == null &&
    eventOccurredAt >= calendarDayStartUtc &&
    eventOccurredAt < calendarDayEndUtc
  ) {
    if (isWithinInstancePlannedWindow(eventOccurredAt, previousInstance)) return false;
    if (isWithinInstancePlannedWindow(eventOccurredAt, nextInstance)) return false;
    return true;
  }

  return false;
}

type EmployeeLite = {
  id: string;
  employeeSubgroupId: string | null;
  employeeGroupId: string | null;
  branchId: string | null;
};

type EmployeeDayEngineContext = {
  dayKey: string;
  policy: any;
  resolved: {
    source: string;
    signature: string;
    spansMidnight: boolean;
    shiftCode?: string | null;
    shiftTemplateId?: string | null;
    startMinute?: number;
    endMinute?: number;
    isOffDay?: boolean;
  };
  computePolicyInput: any;
  instance: ShiftInstance;
};

function buildOwnershipInstance(args: {
  dayKey: string;
  source: "PREVIOUS_DAY" | "CURRENT_DAY" | "NEXT_DAY";
  timezone: string;
  resolved: {
    source: string;
    signature: string;
    spansMidnight: boolean;
    shiftCode?: string | null;
    shiftTemplateId?: string | null;
    startMinute?: number;
    endMinute?: number;
    isOffDay?: boolean;
  };
  effectivePolicy: any;
}) {
  return buildShiftInstance({
    source: args.source,
    logicalDayKey: args.dayKey,
    timezone: args.timezone,
    shiftSource: args.resolved.source ?? null,
    shiftSignature: args.resolved.signature ?? null,
    shiftTemplateId: args.resolved.shiftTemplateId ?? null,
    isOffDay: !!args.resolved.isOffDay,
    spansMidnight: !!args.resolved.spansMidnight,
    plannedStartMinute: args.resolved.startMinute ?? null,
    plannedEndMinute: args.resolved.endMinute ?? null,
    ownershipEarlyInMinutes: Math.max(0, args.effectivePolicy?.ownershipEarlyInMinutes ?? 180),
    ownershipNextShiftLookaheadMinutes: Math.max(0, args.effectivePolicy?.ownershipNextShiftLookaheadMinutes ?? 0),
    ownershipLateOutMinutes: Math.max(0, args.effectivePolicy?.ownershipLateOutMinutes ?? 120),
  });
}

export async function recomputeAttendanceForDate(date: string) {
  const companyId = await getActiveCompanyId();
  const bundle = await getCompanyBundle();
  const companyPolicy = bundle.policy;

  const tz = companyPolicy.timezone || "Europe/Istanbul";

  // ------------------------------------------------------------------
  // Stage 7: Shift-aware raw event windowing (SAP Time Evaluation)
  //
  // Amaç:
  // - Overnight vardiyalarda (örn. 22:00-06:00) OUT olayları ertesi güne kaydığı için
  //   “takvim günü” aralığı ile ham event çekmek yetersiz kalır.
  // - Weekly plan / ShiftTemplate entegre olduğu için pencereyi çalışan bazlı hesaplayacağız.
  //
  // Strateji (minimal & güvenli):
  // 1) DB'den ham eventleri geniş bir aralıkta tek seferde çek (date 00:00 -> date+2 gün 00:00).
  // 2) Çalışan bazında vardiya penceresi hesapla ve ham eventleri bu pencereye göre filtrele.
  //    Böylece gereksiz ham kayıtlar günlük hesaba girmez.
  const dayStartLocal = DateTime.fromISO(date, { zone: tz }).startOf("day");
  const previousDayKey = addDaysToDayKey(date, -1, tz);
  const nextDayKey = addDaysToDayKey(date, 1, tz);

  // Instance ownership engine:
  // current-day attendance may need next-morning spillover and same-day ownership comparison.
  const startUtc = dayStartLocal.minus({ hours: 6 }).toUTC();
  const endUtc = dayStartLocal.plus({ days: 2, hours: 6 }).toUTC();

  const targetDayDb = dbDateFromDayKey(date);

  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      employmentPeriods: {
        some: {
          startDate: { lte: targetDayDb },
          OR: [{ endDate: null }, { endDate: { gte: targetDayDb } }],
        },
      },
    },
    // Include context fields to avoid per-employee DB lookups in policy resolvers.
    select: { id: true, employeeSubgroupId: true, employeeGroupId: true, branchId: true },
  });
  // ------------------------------------------------------------------
  // N+1 reduction: prefetch leave + policy + shift-policy assignments for this day
  // IMPORTANT: We do NOT change domain logic. We only change how we fetch data.
 // Resolution order and tie-breakers remain identical to the resolver services.

  const employeeIds = employees.map((e) => e.id);
  const subgroupIds = Array.from(
    new Set(employees.map((e) => e.employeeSubgroupId).filter((x): x is string => !!x))
  );
  const groupIds = Array.from(
    new Set(employees.map((e) => e.employeeGroupId).filter((x): x is string => !!x))
  );
  const branchIds = Array.from(
    new Set(employees.map((e) => e.branchId).filter((x): x is string => !!x))
  );

  // ------------------------------------------------------------------
  // WeeklyShiftPlan N+1 breaker:
  // resolveShiftMinutesForEmployeeOnDate() internally fetches weekly plan per employee.
  // Here we batch-fetch the whole week plans once and inject them to a cached resolver.
  const weekStartUTC = computeWeekStartUTC(date, tz);
  const weeklyPlans = employeeIds.length
    ? await findWeeklyShiftPlansForEmployees(companyId, employeeIds, weekStartUTC)
    : [];

  // Leave: we only need boolean presence (the existing code does `if (leave) { ... }`).
  const dayStartUtcLeave = DateTime.fromISO(date, { zone: tz }).startOf("day").toUTC().toJSDate();
  const dayEndUtcLeave = DateTime.fromISO(date, { zone: tz }).endOf("day").toUTC().toJSDate();
  const leaveRows = employeeIds.length
    ? await prisma.employeeLeave.findMany({
        where: {
          companyId,
          employeeId: { in: employeeIds },
          dateFrom: { lte: dayEndUtcLeave },
          dateTo: { gte: dayStartUtcLeave },
        },
        select: { employeeId: true },
      })
    : [];
  const employeesOnLeave = new Set<string>(leaveRows.map((r) => r.employeeId));

  const policyRuleSetSelect = {
    id: true,
    code: true,
    name: true,

    breakMinutes: true,
    lateGraceMinutes: true,
    earlyLeaveGraceMinutes: true,

    breakAutoDeductEnabled: true,
    offDayEntryBehavior: true,
    overtimeEnabled: true,
    leaveEntryBehavior: true,

    graceAffectsWorked: true,
    exitConsumesBreak: true,
    maxSingleExitMinutes: true,
    maxDailyExitMinutes: true,
    exitExceedAction: true,

    graceMode: true,
    workedCalculationMode: true,
    otBreakInterval: true,
    otBreakDuration: true,

    attendanceOwnershipMode: true,
    minimumRestMinutes: true,
    ownershipEarlyInMinutes: true,
    ownershipLateOutMinutes: true,
    ownershipNextShiftLookaheadMinutes: true,
    unscheduledWorkBehavior: true,
  } as const;

  function pickBetterAssignment<T extends { priority: number; createdAt: Date }>(
    current: T | undefined,
    candidate: T
  ): T {
    if (!current) return candidate;
    if (candidate.priority !== current.priority) return candidate.priority > current.priority ? candidate : current;
    return candidate.createdAt > current.createdAt ? candidate : current;
  }

  type PolicyAssignmentRow = {
    scope: "EMPLOYEE" | "EMPLOYEE_SUBGROUP" | "EMPLOYEE_GROUP" | "BRANCH";
    employeeId: string | null;
    employeeSubgroupId: string | null;
    employeeGroupId: string | null;
    branchId: string | null;
    priority: number;
    createdAt: Date;
    validFrom: Date | null;
    validTo: Date | null;
    ruleSet: any;
  };

  const policyAssignments: PolicyAssignmentRow[] =
    employeeIds.length
      ? await prisma.policyAssignment.findMany({
          where: {
            companyId,
            scope: { in: ["EMPLOYEE", "EMPLOYEE_SUBGROUP", "EMPLOYEE_GROUP", "BRANCH"] },
            AND: [
              { OR: [{ validFrom: null }, { validFrom: { lte: targetDayDb } }] },
              { OR: [{ validTo: null }, { validTo: { gte: targetDayDb } }] },
            ],
            OR: [
              { scope: "EMPLOYEE", employeeId: { in: employeeIds } },
              subgroupIds.length
                ? { scope: "EMPLOYEE_SUBGROUP", employeeSubgroupId: { in: subgroupIds } }
                : undefined,
              groupIds.length
                ? { scope: "EMPLOYEE_GROUP", employeeGroupId: { in: groupIds } }
                : undefined,
              branchIds.length ? { scope: "BRANCH", branchId: { in: branchIds } } : undefined,
            ].filter(Boolean) as any,
          },
          select: {
            scope: true,
            employeeId: true,
            employeeSubgroupId: true,
            employeeGroupId: true,
            branchId: true,
            priority: true,
            validFrom: true,
            validTo: true,
            createdAt: true,
            ruleSet: { select: policyRuleSetSelect },
          },
        })
      : [];

  const policyByEmployee = new Map<string, PolicyAssignmentRow>();
  const policyBySubgroup = new Map<string, PolicyAssignmentRow>();
  const policyByGroup = new Map<string, PolicyAssignmentRow>();
  const policyByBranch = new Map<string, PolicyAssignmentRow>();
  for (const a of policyAssignments) {
    if (a.scope === "EMPLOYEE" && a.employeeId) {
      policyByEmployee.set(a.employeeId, pickBetterAssignment(policyByEmployee.get(a.employeeId), a));
    }
    if (a.scope === "EMPLOYEE_SUBGROUP" && a.employeeSubgroupId) {
      policyBySubgroup.set(a.employeeSubgroupId, pickBetterAssignment(policyBySubgroup.get(a.employeeSubgroupId), a));
    }
    if (a.scope === "EMPLOYEE_GROUP" && a.employeeGroupId) {
      policyByGroup.set(a.employeeGroupId, pickBetterAssignment(policyByGroup.get(a.employeeGroupId), a));
    }
    if (a.scope === "BRANCH" && a.branchId) {
      policyByBranch.set(a.branchId, pickBetterAssignment(policyByBranch.get(a.branchId), a));
    }
  }

  function getWorkforceRuleSetForEmployeeOnDay(e: {
    id: string;
    employeeSubgroupId: string | null;
    employeeGroupId: string | null;
    branchId: string | null;
  }, dayKey: string): any | null {
    // Precedence must match resolvePolicyRuleSetForEmployeeOnDate:
    // EMPLOYEE > EMPLOYEE_SUBGROUP > EMPLOYEE_GROUP > BRANCH
    const a1 = policyByEmployee.get(e.id);
    if (a1?.ruleSet && isDateWithinRange(dayKey, a1.validFrom, a1.validTo)) return a1.ruleSet;
    if (e.employeeSubgroupId) {
      const a2 = policyBySubgroup.get(e.employeeSubgroupId);
      if (a2?.ruleSet && isDateWithinRange(dayKey, a2.validFrom, a2.validTo)) return a2.ruleSet;
    }
    if (e.employeeGroupId) {
      const a3 = policyByGroup.get(e.employeeGroupId);
      if (a3?.ruleSet && isDateWithinRange(dayKey, a3.validFrom, a3.validTo)) return a3.ruleSet;
    }
    if (e.branchId) {
      const a4 = policyByBranch.get(e.branchId);
      if (a4?.ruleSet && isDateWithinRange(dayKey, a4.validFrom, a4.validTo)) return a4.ruleSet;
    }
    return null;
  }

  const engineDayKeys = [previousDayKey, date, nextDayKey];
  const weekStartKeys = Array.from(
    new Set(engineDayKeys.map((d) => computeWeekStartUTC(d, tz).toISOString()))
  );

  const weeklyPlanByEmployeeWeekKey = new Map<string, any>();
  for (const iso of weekStartKeys) {
    const weekStart = new Date(iso);
    const rows = employeeIds.length
      ? await findWeeklyShiftPlansForEmployees(companyId, employeeIds, weekStart)
      : [];
    for (const row of rows as any[]) {
      weeklyPlanByEmployeeWeekKey.set(`${String((row as any).employeeId)}|${iso}`, row);
    }
  }

  const workScheduleByEmployeeDayKey = new Map<string, any>();
  for (const dayKey of engineDayKeys) {
    const map = await resolveWorkScheduleShiftsForEmployeesOnDate({
      companyId,
      employees,
      dayKey,
      timezone: tz,
    });
    for (const [employeeId, value] of map.entries()) workScheduleByEmployeeDayKey.set(`${employeeId}|${dayKey}`, value);
  }

  const rawEvents = await prisma.rawEvent.findMany({
    where: {
      companyId,
      occurredAt: { gte: startUtc.toJSDate(), lt: endUtc.toJSDate() },
    },
    select: { id: true, employeeId: true, occurredAt: true, direction: true },
    orderBy: [{ occurredAt: "asc" }],
  });

  const rawByEmployee = new Map<string, Array<{ id: string; occurredAt: Date; direction: EventDirection }>>();
  for (const ev of rawEvents) {
    const arr = rawByEmployee.get(ev.employeeId) ?? [];
    arr.push({ id: ev.id, occurredAt: ev.occurredAt, direction: ev.direction as EventDirection });
    rawByEmployee.set(ev.employeeId, arr);
  }

  const workDate = dbDateFromDayKey(date);
  const computedAt = new Date();

  let presentCount = 0;
  let absentCount = 0;
  let missingPunchCount = 0;

  // Collect normalized upserts and flush once (kills per-event upsert N+1).
  const normalizedBatch: NormalizedUpsertInput[] = [];
  const ownershipAuditBatch: OwnershipAuditUpsertInput[] = [];

  type ShiftPolicyScope =
    | "EMPLOYEE_SHIFT"
    | "EMPLOYEE_SUBGROUP_SHIFT"
    | "EMPLOYEE_GROUP_SHIFT"
    | "BRANCH_SHIFT"
    | "SHIFT";
  type ShiftPolicyAssignmentRow = {
    scope: ShiftPolicyScope;
    shiftCode: string;
    employeeId: string | null;
    employeeSubgroupId: string | null;
    employeeGroupId: string | null;
    branchId: string | null;
    priority: number;
    validFrom: Date | null;
    validTo: Date | null;
    createdAt: Date;
    ruleSet: any;
  };

  // Shift-policy assignments depend on shiftCode, which comes from plannerResolved.
  // We'll lazily load per shiftCode (but still in batch: findMany instead of many findFirst).
  const shiftPolicyByShiftCode = new Map<
    string,
    {
      byEmployee: Map<string, ShiftPolicyAssignmentRow>;
      bySubgroup: Map<string, ShiftPolicyAssignmentRow>;
      byGroup: Map<string, ShiftPolicyAssignmentRow>;
      byBranch: Map<string, ShiftPolicyAssignmentRow>;
      byShift: ShiftPolicyAssignmentRow | null;
    }
  >();

  async function ensureShiftPolicyLoaded(shiftCodeRaw: string | null | undefined) {
    const shiftCode = String(shiftCodeRaw ?? "").trim();
    if (!shiftCode) return;
    if (shiftPolicyByShiftCode.has(shiftCode)) return;

    const rows: ShiftPolicyAssignmentRow[] = await prisma.shiftPolicyAssignment.findMany({
      where: {
        companyId,
        shiftCode,
        scope: {
          in: [
            "EMPLOYEE_SHIFT",
            "EMPLOYEE_SUBGROUP_SHIFT",
            "EMPLOYEE_GROUP_SHIFT",
            "BRANCH_SHIFT",
            "SHIFT",
          ],
        },
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: targetDayDb } }] },
          { OR: [{ validTo: null }, { validTo: { gte: targetDayDb } }] },
        ],
        OR: [
          { scope: "EMPLOYEE_SHIFT", employeeId: { in: employeeIds } },
          subgroupIds.length
            ? { scope: "EMPLOYEE_SUBGROUP_SHIFT", employeeSubgroupId: { in: subgroupIds } }
            : undefined,
          groupIds.length ? { scope: "EMPLOYEE_GROUP_SHIFT", employeeGroupId: { in: groupIds } } : undefined,
          branchIds.length ? { scope: "BRANCH_SHIFT", branchId: { in: branchIds } } : undefined,
          { scope: "SHIFT" },
        ].filter(Boolean) as any,
      },
      select: {
        scope: true,
        shiftCode: true,
        employeeId: true,
        employeeSubgroupId: true,
        employeeGroupId: true,
        branchId: true,
        priority: true,
        validFrom: true,
        validTo: true,
        createdAt: true,
        ruleSet: { select: policyRuleSetSelect },
      },
    });

    const byEmployee = new Map<string, ShiftPolicyAssignmentRow>();
    const bySubgroup = new Map<string, ShiftPolicyAssignmentRow>();
    const byGroup = new Map<string, ShiftPolicyAssignmentRow>();
    const byBranch = new Map<string, ShiftPolicyAssignmentRow>();
    let byShift: ShiftPolicyAssignmentRow | null = null;
    for (const a of rows) {
      if (a.scope === "EMPLOYEE_SHIFT" && a.employeeId) {
        byEmployee.set(a.employeeId, pickBetterAssignment(byEmployee.get(a.employeeId), a));
      }
      if (a.scope === "EMPLOYEE_SUBGROUP_SHIFT" && a.employeeSubgroupId) {
        bySubgroup.set(
          a.employeeSubgroupId,
          pickBetterAssignment(bySubgroup.get(a.employeeSubgroupId), a)
        );
      }
      if (a.scope === "EMPLOYEE_GROUP_SHIFT" && a.employeeGroupId) {
        byGroup.set(a.employeeGroupId, pickBetterAssignment(byGroup.get(a.employeeGroupId), a));
      }
      if (a.scope === "BRANCH_SHIFT" && a.branchId) {
        byBranch.set(a.branchId, pickBetterAssignment(byBranch.get(a.branchId), a));
      }
      if (a.scope === "SHIFT") {
        byShift = pickBetterAssignment(byShift ?? undefined, a);
      }
    }

    shiftPolicyByShiftCode.set(shiftCode, { byEmployee, bySubgroup, byGroup, byBranch, byShift });
  }

  function getShiftRuleSetForEmployee(args: {
    employee: {
      id: string;
      employeeSubgroupId: string | null;
      employeeGroupId: string | null;
      branchId: string | null;
    };
    shiftCodeRaw: string | null | undefined;
    dayKey: string;
  }): any | null {
    const shiftCode = String(args.shiftCodeRaw ?? "").trim();
    if (!shiftCode) return null;
    const cache = shiftPolicyByShiftCode.get(shiftCode);
    if (!cache) return null;

    // Precedence must match resolveShiftPolicyRuleSetForEmployeeOnDate:
    // EMPLOYEE_SHIFT > SUBGROUP_SHIFT > GROUP_SHIFT > BRANCH_SHIFT > SHIFT
    const a1 = cache.byEmployee.get(args.employee.id);
    if (a1?.ruleSet && isDateWithinRange(args.dayKey, a1.validFrom, a1.validTo)) return a1.ruleSet;
    if (args.employee.employeeSubgroupId) {
      const a2 = cache.bySubgroup.get(args.employee.employeeSubgroupId);
      if (a2?.ruleSet && isDateWithinRange(args.dayKey, a2.validFrom, a2.validTo)) return a2.ruleSet;
    }
    if (args.employee.employeeGroupId) {
      const a3 = cache.byGroup.get(args.employee.employeeGroupId);
      if (a3?.ruleSet && isDateWithinRange(args.dayKey, a3.validFrom, a3.validTo)) return a3.ruleSet;
    }
    if (args.employee.branchId) {
      const a4 = cache.byBranch.get(args.employee.branchId);
      if (a4?.ruleSet && isDateWithinRange(args.dayKey, a4.validFrom, a4.validTo)) return a4.ruleSet;
    }
    if (cache.byShift?.ruleSet && isDateWithinRange(args.dayKey, cache.byShift.validFrom, cache.byShift.validTo)) return cache.byShift.ruleSet;
    return null;
  }

  async function buildDayContextForEmployee(employee: EmployeeLite, dayKey: string): Promise<EmployeeDayEngineContext> {
    const workforceRuleSet = getWorkforceRuleSetForEmployeeOnDay(employee, dayKey);
    const workforcePolicy = workforceRuleSet ? mergePolicyRules(companyPolicy, workforceRuleSet) : companyPolicy;

    const weekStart = computeWeekStartUTC(dayKey, tz);
    const weekStartKey = weekStart.toISOString();
    const weeklyPlan = weeklyPlanByEmployeeWeekKey.get(`${employee.id}|${weekStartKey}`) ?? null;
    const workSchedule = workScheduleByEmployeeDayKey.get(`${employee.id}|${dayKey}`) ?? null;

    const plannerResolved = await resolveShiftMinutesForEmployeeOnDateWithWeeklyPlan({
      companyId,
      employeeId: employee.id,
      date: dayKey,
      timezone: tz,
      policy: companyPolicy,
      weeklyPlan,
      workSchedule,
    });

    await ensureShiftPolicyLoaded(plannerResolved.shiftCode);
    const shiftRuleSet = getShiftRuleSetForEmployee({
      employee,
      shiftCodeRaw: plannerResolved.shiftCode,
      dayKey,
    });

    const effectivePolicy = shiftRuleSet ? mergePolicyRules(workforcePolicy, shiftRuleSet) : workforcePolicy;

    const resolved = applyFallbackMinutesToResolvedShift({
      resolved: plannerResolved,
      fallbackStartMinute: (effectivePolicy as any).shiftStartMinute,
      fallbackEndMinute: (effectivePolicy as any).shiftEndMinute,
    });

    let computePolicyInput = applyResolvedShiftMinutesToComputePolicy({
      base: toComputePolicy(effectivePolicy),
      resolved: { startMinute: resolved.startMinute, endMinute: resolved.endMinute },
    });

    if (resolved.isOffDay) {
      computePolicyInput = { ...(computePolicyInput as any), isOffDay: true } as any;
    }

    return {
      dayKey,
      policy: effectivePolicy,
      resolved,
      computePolicyInput,
      instance: buildOwnershipInstance({
        dayKey,
        source: dayKey === previousDayKey ? "PREVIOUS_DAY" : dayKey === nextDayKey ? "NEXT_DAY" : "CURRENT_DAY",
        timezone: tz,
        resolved,
        effectivePolicy,
      }),
    };
  }

  for (const e of employees) {
    const prevCtx = await buildDayContextForEmployee(e, previousDayKey);
    const currCtx = await buildDayContextForEmployee(e, date);
    const currInstance = currCtx.instance;
    const nextCtx = await buildDayContextForEmployee(e, nextDayKey);

    const ownershipMode = String(
      (currCtx.policy as any).attendanceOwnershipMode ?? "INSTANCE_SCORING"
    ).toUpperCase();

    const empEventsAll = rawByEmployee.get(e.id) ?? [];

    const candidateInstances = [prevCtx.instance, currCtx.instance, nextCtx.instance];

    let rollingLastAcceptedOutAt: Date | null = null;
    const ownershipDecisions = empEventsAll.map((ev) => {
      const decision =
        ownershipMode === "INSTANCE_SCORING"
          ? chooseBestOwnership({
              event: {
                id: ev.id,
                occurredAt: ev.occurredAt,
                direction: ev.direction,
                lastAcceptedOutAt: rollingLastAcceptedOutAt,
              },
              candidates: candidateInstances,
              minimumRestMinutes:
                typeof (currCtx.policy as any).minimumRestMinutes === "number"
                  ? (currCtx.policy as any).minimumRestMinutes
                  : undefined,
            })
          : chooseBestOwnership({
              event: {
                id: ev.id,
                occurredAt: ev.occurredAt,
                direction: ev.direction,
                lastAcceptedOutAt: rollingLastAcceptedOutAt,
              },
              candidates: [currCtx.instance],
              minimumRestMinutes:
                typeof (currCtx.policy as any).minimumRestMinutes === "number"
                  ? (currCtx.policy as any).minimumRestMinutes
                  : undefined,
            });

      if (
        shouldAdvanceRestReferenceFromOwnershipDecision({
          event: ev,
          decision: {
            ownerLogicalDayKey: decision.ownerLogicalDayKey,
            ownerSource: decision.ownerSource,
            score: decision.score,
          },
        })
      ) {
        rollingLastAcceptedOutAt = ev.occurredAt;
      }

      return { event: ev, decision };
    });

    const scheduledOwnedEvents = ownershipDecisions
      .filter((x) =>
        shouldIncludeInScheduledOwnedEvents({
          date,
          event: x.event,
          ownerLogicalDayKey: x.decision.ownerLogicalDayKey,
          currentInstance: currInstance,
          isOffDay: !!currCtx.resolved.isOffDay,
        })
      )
      .map((x) => x.event)
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    
    const scheduledOwnedEventIds = new Set<string>(scheduledOwnedEvents.map((x) => x.id));

    const leave = employeesOnLeave.has(e.id) ? ({ employeeId: e.id } as any) : null;

    const calendarDayStartUtc = dayStartLocal.toUTC().toJSDate();
    const calendarDayEndUtc = dayStartLocal.plus({ days: 1 }).toUTC().toJSDate();

    const visibleCurrentDayEvents = ownershipDecisions
      .filter((x) =>
        shouldIncludeInVisibleCurrentDayEvents({
          date,
          eventOccurredAt: x.event.occurredAt,
          calendarDayStartUtc,
          calendarDayEndUtc,
          ownerLogicalDayKey: x.decision.ownerLogicalDayKey ?? null,
          currentInstance: currInstance,
          previousInstance: prevCtx.instance,
          nextInstance: nextCtx.instance,
        })
      )
      .map((x) => x.event)
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    const visibleRestViolationEventIds = collectRestViolationEventIds(
      visibleCurrentDayEvents,
      typeof (currCtx.policy as any).minimumRestMinutes === "number"
        ? (currCtx.policy as any).minimumRestMinutes
        : undefined,
      currInstance
    );

    const fullNorm = normalizePunches(visibleCurrentDayEvents);

    // Persist one normalization truth for the visible current-day stream.
    for (const raw of visibleCurrentDayEvents) {
      const d = fullNorm.decisions[raw.id] ?? { status: "ACCEPTED" as const };
      const status =
        d.status === "ACCEPTED" ? NormalizedStatus.PROCESSED : NormalizedStatus.REJECTED;
      normalizedBatch.push({
        rawEventId: raw.id,
        companyId,
        employeeId: e.id,
        occurredAt: raw.occurredAt,
        direction: raw.direction,
        status,
        rejectReason: d.status === "REJECTED" ? d.reason ?? "REJECTED" : null,
      });
    }

    const computed = computeDailyAttendance({
      date,
      timezone: tz,
      policy: currCtx.computePolicyInput,
      normalized: fullNorm,
      events: visibleCurrentDayEvents,
    });

    const hasReferenceShift =
      currCtx.computePolicyInput.shiftStartMinute !== undefined &&
      currCtx.computePolicyInput.shiftEndMinute !== undefined;

    const evaluation = evaluateAttendanceDay({
      computed,
      fullNorm,
      visibleEventCount: visibleCurrentDayEvents.length,
      isLeaveDay: !!leave,
      isOffDay: !!currCtx.resolved.isOffDay,
      leaveEntryBehaviorRaw: (currCtx.policy as any).leaveEntryBehavior,
      unscheduledWorkBehaviorRaw: (currCtx.policy as any).unscheduledWorkBehavior,
      shiftStartMinute:
        typeof currCtx.resolved.startMinute === "number" ? currCtx.resolved.startMinute : null,
      shiftEndMinute:
        typeof currCtx.resolved.endMinute === "number" ? currCtx.resolved.endMinute : null,
      dayStartUtc: calendarDayStartUtc,
      otBreakInterval: currCtx.computePolicyInput.otBreakInterval ?? undefined,
      otBreakDuration: currCtx.computePolicyInput.otBreakDuration ?? undefined,
      hasVisibleRestViolation: visibleRestViolationEventIds.size > 0,
      hasReferenceShift,
    });

    const computedRef = evaluation.computed;
    const scheduledWorkedMinutes = evaluation.scheduledWorkedMinutes;
    const unscheduledWorkedMinutes = evaluation.unscheduledWorkedMinutes;
    const scheduledOvertimeMinutes = evaluation.scheduledOvertimeMinutes;
    const unscheduledOvertimeMinutes = evaluation.unscheduledOvertimeMinutes;
    const leaveEntryBehavior = evaluation.leaveEntryBehavior;
    const unscheduledBehavior = evaluation.unscheduledBehavior;

    const visibleUnscheduledEventIds = new Set<string>(
      visibleCurrentDayEvents
        .filter((x) => !scheduledOwnedEventIds.has(x.id))
        .map((x) => x.id)
    );

    const auditRelevantEventIds = new Set<string>();
    for (const ev of visibleCurrentDayEvents) auditRelevantEventIds.add(ev.id);
    for (const x of ownershipDecisions) {
      if (x.event.occurredAt >= calendarDayStartUtc && x.event.occurredAt < calendarDayEndUtc) {
        auditRelevantEventIds.add(x.event.id);
      }
    }

    for (const x of ownershipDecisions) {
      if (!auditRelevantEventIds.has(x.event.id)) continue;

      const audit = buildOwnershipAuditDisposition({
        eventId: x.event.id,
        date,
        eventOccurredAt: x.event.occurredAt,
        calendarDayStartUtc,
        calendarDayEndUtc,
        scheduledOwnedEventIds,
        visibleUnscheduledEventIds,
        ownerLogicalDayKey: x.decision.ownerLogicalDayKey,
      });

      ownershipAuditBatch.push({
        companyId,
        employeeId: e.id,
        rawEventId: x.event.id,
        logicalDayKey: date,
        occurredAt: x.event.occurredAt,
        direction: x.event.direction,
        ownerLogicalDayKey: x.decision.ownerLogicalDayKey ?? null,
        ownerSource: mapOwnerSourceToAuditSource(x.decision.ownerSource ?? null),
        ownershipScore: x.decision.score ?? null,
        ownershipBreakdown: x.decision.breakdown as any,
        disposition: audit.disposition,
        note:
          visibleRestViolationEventIds.has(x.event.id)
            ? `${audit.note ?? ""}${audit.note ? " " : ""}${
                "Minimum rest rule violated for this visible current-day IN."
              }`
            : audit.disposition === "VISIBLE_UNSCHEDULED"
            ? `${audit.note ?? ""}${audit.note ? " " : ""}Unscheduled behavior: ${unscheduledBehavior}.${computedRef.status === "LEAVE" ? ` Leave entry behavior: ${leaveEntryBehavior}.` : ""}`
            : audit.note,
        shiftSource: currCtx.resolved.source ?? null,
        shiftSignature: currCtx.resolved.signature ?? null,
      });
    }

    if (computedRef.status === "ABSENT") absentCount++;
    if (computedRef.anomalies.includes("MISSING_PUNCH")) missingPunchCount++;

    const reviewDecision = buildReviewDecision({
      anomalies: computedRef.anomalies,
      scheduledOvertimeMinutes,
      unscheduledOvertimeMinutes,
      scheduledWorkedMinutes,
      unscheduledWorkedMinutes,
      exitExceedAction:
        String((currCtx.policy as any).exitExceedAction ?? "IGNORE").toUpperCase() === "FLAG"
          ? "FLAG"
          : String((currCtx.policy as any).exitExceedAction ?? "IGNORE").toUpperCase() === "WARN"
          ? "WARN"
          : "IGNORE",
    });

    const existingDaily = await findDailyAttendanceByKey({
      companyId,
      employeeId: e.id,
      workDate,
    });

    const resetReview = shouldResetReviewOnRecompute({
      existing: existingDaily,
      next: {
        status: String(computedRef.status ?? ""),
        firstIn: computedRef.firstIn ?? null,
        lastOut: computedRef.lastOut ?? null,
        workedMinutes: Number(computedRef.workedMinutes ?? 0),
        scheduledWorkedMinutes,
        unscheduledWorkedMinutes,
        overtimeMinutes: Number(computedRef.overtimeMinutes ?? 0),
        scheduledOvertimeMinutes,
        unscheduledOvertimeMinutes,
        lateMinutes: Number(computedRef.lateMinutes ?? 0),
        earlyLeaveMinutes: Number(computedRef.earlyLeaveMinutes ?? 0),
        anomalies: Array.isArray(computedRef.anomalies) ? computedRef.anomalies : [],
        anomalyMeta: (computedRef as any).anomalyMeta ?? null,
      },
    });
    const reviewStatus =
      !reviewDecision.requiresReview
        ? "NONE"
        : resetReview
        ? "PENDING"
        : String(existingDaily?.reviewStatus ?? "PENDING");

    const reviewedAt =
      !reviewDecision.requiresReview
        ? null
        : resetReview
        ? null
        : existingDaily?.reviewedAt ?? null;

    const reviewedByUserId =
      !reviewDecision.requiresReview
        ? null
        : resetReview
        ? null
        : existingDaily?.reviewedByUserId ?? null;

    const reviewNote =
      !reviewDecision.requiresReview
        ? null
        : resetReview
        ? null
        : existingDaily?.reviewNote ?? null;

    await upsertDailyAttendance({
      companyId,
      employeeId: e.id,
      workDate,
      firstIn: computedRef.firstIn,
      lastOut: computedRef.lastOut,
      workedMinutes: computedRef.workedMinutes,
      scheduledWorkedMinutes,
      unscheduledWorkedMinutes,
      lateMinutes: computedRef.lateMinutes,
      earlyLeaveMinutes: computedRef.earlyLeaveMinutes,
      overtimeMinutes: computedRef.overtimeMinutes,
      scheduledOvertimeMinutes,
      unscheduledOvertimeMinutes,
      overtimeEarlyMinutes: computedRef.overtimeEarlyMinutes ?? 0,
      overtimeLateMinutes: computedRef.overtimeLateMinutes ?? 0,
      otBreakCount: (computedRef as any).otBreakCount ?? 0,
      otBreakDeductMinutes: (computedRef as any).otBreakDeductMinutes ?? 0,
      status: computedRef.status as any,
      anomalies: computedRef.anomalies,
      anomalyMeta: (computedRef as any).anomalyMeta ?? null,
      requiresReview: reviewDecision.requiresReview,
      reviewReasons: reviewDecision.reviewReasons,
      reviewStatus: reviewStatus as any,
       reviewedAt,
      reviewedByUserId,
      reviewNote,

      shiftSource: currCtx.resolved.source,
      shiftSignature: currCtx.resolved.signature,
      shiftStartMinute:
        typeof currCtx.resolved.startMinute === "number" ? currCtx.resolved.startMinute : 0,
      shiftEndMinute:
        typeof currCtx.resolved.endMinute === "number" ? currCtx.resolved.endMinute : 0,
      shiftSpansMidnight: !!currCtx.resolved.spansMidnight,

      computedAt,
    });
  }

  // Flush normalized events once.
  // This is safe because dailyAttendance computation already used `norm` in-memory;
  // persistence timing does not affect computeDaily semantics.
  if (normalizedBatch.length) {
    await upsertNormalizedForRawEventsBatch(normalizedBatch);
  }
  if (ownershipAuditBatch.length) {
    await upsertAttendanceOwnershipAuditsBatch(ownershipAuditBatch);
  }

  return {
    ok: true,
    date,
    employeesComputed: employees.length,
    presentCount,
    absentCount,
    missingPunchCount,
  };
}
