import { DateTime } from "luxon";
import { getCompanyBundle } from "@/src/services/company.service";
import {
  findWeeklyShiftPlan,
  findWeeklyShiftPlansForEmployees as findWeeklyShiftPlansForEmployeesRepo,
  upsertWeeklyShiftPlan,
} from "@/src/repositories/shiftPlan.repo";
import { getShiftTemplateById } from "@/src/services/shiftTemplate.service";
import { findShiftTemplateBySignature } from "@/src/repositories/shiftTemplate.repo";
import {
  resolveWorkScheduleShiftForEmployeeOnDate,
  type WorkScheduleResolved,
} from "@/src/services/workSchedule.service";

/**
 * Compute the UTC week start (Monday 00:00) for a given ISO date string and timezone.
 * @param date ISO date string (YYYY-MM-DD)
 * @param tz IANA timezone (e.g. Europe/Istanbul)
 */
export function computeWeekStartUTC(date: string, tz: string): Date {
  const dt = DateTime.fromISO(date, { zone: tz });
  // Monday = 1, Sunday = 7; subtract (weekday - 1) days to get Monday
  const mondayLocal = dt.startOf("day").minus({ days: dt.weekday - 1 });
  return mondayLocal.toUTC().toJSDate();
}

// ---------------------------------------------------------------------------
// Shift Signature (SAP uyumlu altyapı – Stage 1/2/3/4)
// ---------------------------------------------------------------------------
export type ShiftSignature = {
  startTime: string;       // "09:00"
  endTime: string;         // "18:00"
  spansMidnight: boolean;  // true if overnight shift
  signature: string;       // "0900-1800" | "2200-0600+1"
};

export type ShiftSource = "POLICY" | "WEEK_TEMPLATE" | "DAY_TEMPLATE" | "CUSTOM" | "WORK_SCHEDULE";

export type ResolvedShift = {
  source: ShiftSource;
  signature: ShiftSignature;
  shiftCode?: string | null;
  shiftTemplateId?: string | null;
  isOffDay?: boolean;
};

function isOffShiftTemplate(tpl: any): boolean {
  if (!tpl || typeof tpl !== "object") return false;

  // Preferred explicit semantic flag
  if ((tpl as any).isOffDay === true) return true;

  // Backward-compatible semantic identifiers
  const signature = String((tpl as any).signature ?? "").trim().toUpperCase();
  const shiftCode = String((tpl as any).shiftCode ?? "").trim().toUpperCase();

  if (signature === "OFF") return true;
  if (shiftCode === "OFF") return true;

  return false;
}

function buildOffResolvedShift(source: ShiftSource, tpl?: any): ResolvedShift {
  return {
    source,
    shiftCode: (tpl as any)?.shiftCode ?? null,
    shiftTemplateId: (tpl as any)?.id ?? null,
    isOffDay: true,
    signature: {
      startTime: "--:--",
      endTime: "--:--",
      spansMidnight: false,
      signature: "OFF",
    },
  };
}

function normalizeTime(value: string): string {
  const [h, m] = value.split(":").map((v) => v.padStart(2, "0"));
  return `${h}:${m}`;
}

function timeToMinute(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minuteToTime(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function buildShiftSignature(startTimeRaw: string, endTimeRaw: string): ShiftSignature {
  const startTime = normalizeTime(startTimeRaw);
  const endTime = normalizeTime(endTimeRaw);
  const startMin = timeToMinute(startTime);
  const endMin = timeToMinute(endTime);
  const spansMidnight = endMin <= startMin;
  const signature =
    `${startTime.replace(":", "")}` +
    `-${endTime.replace(":", "")}` +
    (spansMidnight ? "+1" : "");
  return { startTime, endTime, spansMidnight, signature };
}

/**
 * Resolve effective shift for UI/debug, including the layer source.
 * Precedence (SAP): Day Template > Day Custom Minutes > Week Template > Policy
 */
export async function resolveShiftForEmployeeOnDate(
  employeeId: string,
  date: string,
  employeeContext?: {
    employeeGroupId: string | null;
    employeeSubgroupId: string | null;
    branchId: string | null;
  } | null,
): Promise<ResolvedShift> {
  // Defensive normalize: avoid Prisma throwing when employeeId/date is missing/invalid.
  const empId = String(employeeId ?? "").trim();
  const dayKey = String(date ?? "").trim();
  if (!empId || !dayKey) {
    // Stable placeholder (UI/debug). Do NOT throw.
    return {
      source: "POLICY",
      shiftCode: null,
      shiftTemplateId: null,
      signature: { startTime: "--:--", endTime: "--:--", spansMidnight: false, signature: "—" },
    };
  }

  const { company, policy } = await getCompanyBundle();
  const tz = policy.timezone || "Europe/Istanbul";
  const weekStart = computeWeekStartUTC(dayKey, tz);
  const plan = await findWeeklyShiftPlan(company.id, empId, weekStart);

  // Day index 1..7 (Monday..Sunday) in local timezone
  const dayIndex = DateTime.fromISO(dayKey, { zone: tz }).weekday; // 1..7

  let dayTplId: string | null | undefined;
  let start: number | null | undefined;
  let end: number | null | undefined;

 if (plan) {
    switch (dayIndex) {
      case 1:
        dayTplId = plan.monShiftTemplateId;
        start = plan.monStartMinute;
        end = plan.monEndMinute;
        break;
      case 2:
        dayTplId = plan.tueShiftTemplateId;
        start = plan.tueStartMinute;
        end = plan.tueEndMinute;
        break;
      case 3:
        dayTplId = plan.wedShiftTemplateId;
        start = plan.wedStartMinute;
        end = plan.wedEndMinute;
        break;
      case 4:
        dayTplId = plan.thuShiftTemplateId;
        start = plan.thuStartMinute;
        end = plan.thuEndMinute;
        break;
      case 5:
        dayTplId = plan.friShiftTemplateId;
        start = plan.friStartMinute;
        end = plan.friEndMinute;
        break;
      case 6:
        dayTplId = plan.satShiftTemplateId;
        start = plan.satStartMinute;
        end = plan.satEndMinute;
        break;
      case 7:
        dayTplId = plan.sunShiftTemplateId;
        start = plan.sunStartMinute;
        end = plan.sunEndMinute;
        break;
   }

    // 1) Day template override
    if (dayTplId) {
      const tpl = await getShiftTemplateById(company.id, dayTplId);
      if (tpl) {
        if (isOffShiftTemplate(tpl)) {
          return buildOffResolvedShift("DAY_TEMPLATE", tpl);
        }

        return {
          source: "DAY_TEMPLATE",
          shiftCode: (tpl as any).shiftCode ?? tpl.signature,
          shiftTemplateId: tpl.id,
          signature: {
            startTime: tpl.startTime,
            endTime: tpl.endTime,
            spansMidnight: tpl.spansMidnight,
            signature: tpl.signature,
          },
        };
      }
    }

    // 2) Day custom minutes (legacy/custom)
    const hasMinutes = start != null && end != null;
    if (hasMinutes) {
      const sig = buildShiftSignature(minuteToTime(start as number), minuteToTime(end as number));
      return { source: "CUSTOM", shiftCode: null, shiftTemplateId: null, signature: sig };
    }

    // 3) Week default template
    if (plan.shiftTemplateId) {
      const tpl = await getShiftTemplateById(company.id, plan.shiftTemplateId);
      if (tpl) {
        if (isOffShiftTemplate(tpl)) {
          return buildOffResolvedShift("WEEK_TEMPLATE", tpl);
        }

        return {
          source: "WEEK_TEMPLATE",
          shiftCode: (tpl as any).shiftCode ?? tpl.signature,
          shiftTemplateId: tpl.id,
          signature: {
            startTime: tpl.startTime,
            endTime: tpl.endTime,
            spansMidnight: tpl.spansMidnight,
            signature: tpl.signature,
          },
        };
      }
    }
 }

  // 4) Period Work Schedule fallback (SAP: Period Work Schedule / Work Schedule Rule)
    const ws = await resolveWorkScheduleShiftForEmployeeOnDate({
      companyId: company.id,
      employeeId: empId,
      dayKey,
      timezone: tz,
      employeeContext: employeeContext
        ? {
            id: empId,
            employeeGroupId: employeeContext.employeeGroupId,
            employeeSubgroupId: employeeContext.employeeSubgroupId,
            branchId: employeeContext.branchId,
          }
        : null,
    });
    if (ws) {
      if (ws.kind === "OFF") {
        // IMPORTANT: OFF must NOT fallback to Policy for semantics.
        // We keep placeholder times; minutes can be injected later for windowing if needed.
        return {
          source: "WORK_SCHEDULE",
          shiftCode: null,
          shiftTemplateId: null,
          isOffDay: true,
          signature: { startTime: "--:--", endTime: "--:--", spansMidnight: false, signature: "OFF" },
        };
      }
      return {
        source: "WORK_SCHEDULE",
        shiftCode: ws.shiftCode ?? null,
        shiftTemplateId: ws.shiftTemplateId,
        isOffDay: false,
        signature: ws.signature,
      };
    }

  // 5) Policy fallback
  const startMin = (policy as any).shiftStartMinute;
  const endMin = (policy as any).shiftEndMinute;
  if (typeof startMin === "number" && typeof endMin === "number") {
    const sig = buildShiftSignature(minuteToTime(startMin), minuteToTime(endMin));
    return { source: "POLICY", shiftCode: null, shiftTemplateId: null, signature: sig };
  }

  // Policy minutes missing -> return stable placeholder (UI only)
  return {
    source: "POLICY",
    shiftCode: null,
    shiftTemplateId: null,
    signature: { startTime: "--:--", endTime: "--:--", spansMidnight: false, signature: "Policy" },
  };
}

export type ResolvedShiftMinutes = {
  source: ShiftSource;
  signature: string;
  spansMidnight: boolean;
  shiftCode?: string | null;
  shiftTemplateId?: string | null;
  startMinute?: number;
  endMinute?: number;
  isOffDay?: boolean;
};

/**
 * Batch helper used by recompute paths to avoid weeklyShiftPlan N+1.
 * (keeps existing callsites intact; this is an opt-in helper)
 */
export async function findWeeklyShiftPlansForEmployees(
  companyId: string,
  employeeIds: string[],
  weekStartDate: Date
) {
  return findWeeklyShiftPlansForEmployeesRepo(companyId, employeeIds, weekStartDate);
}

// Minimal shape we use from prisma.weeklyShiftPlan
type WeeklyShiftPlanRow = {
  employeeId: string;
  shiftTemplateId?: string | null;
  monShiftTemplateId?: string | null;
  tueShiftTemplateId?: string | null;
  wedShiftTemplateId?: string | null;
  thuShiftTemplateId?: string | null;
  friShiftTemplateId?: string | null;
  satShiftTemplateId?: string | null;
  sunShiftTemplateId?: string | null;
  monStartMinute?: number | null;
  monEndMinute?: number | null;
  tueStartMinute?: number | null;
  tueEndMinute?: number | null;
  wedStartMinute?: number | null;
  wedEndMinute?: number | null;
  thuStartMinute?: number | null;
  thuEndMinute?: number | null;
  friStartMinute?: number | null;
  friEndMinute?: number | null;
  satStartMinute?: number | null;
  satEndMinute?: number | null;
  sunStartMinute?: number | null;
  sunEndMinute?: number | null;
} | null;

/**
 * Cached/Injected-plan resolver for hot paths (recompute).
 * Same precedence/behavior as resolveShiftForEmployeeOnDate but WITHOUT querying weeklyShiftPlan.
 *
 * IMPORTANT: This does NOT change rules, only eliminates DB roundtrips for weeklyShiftPlan.
 */
async function resolveShiftForEmployeeOnDateUsingWeeklyPlan(args: {
  companyId: string;
  employeeId: string;
  dayKey: string;
  timezone: string;
  policy: any;
  weeklyPlan: WeeklyShiftPlanRow;
  workSchedule?: WorkScheduleResolved | null;
}): Promise<ResolvedShift> {
  const empId = String(args.employeeId ?? "").trim();
  const dayKey = String(args.dayKey ?? "").trim();
  if (!empId || !dayKey) {
    return {
      source: "POLICY",
      shiftCode: null,
      shiftTemplateId: null,
      signature: { startTime: "--:--", endTime: "--:--", spansMidnight: false, signature: "—" },
    };
  }

  const tz = args.timezone || "Europe/Istanbul";
  const dayIndex = DateTime.fromISO(dayKey, { zone: tz }).weekday; // 1..7

  const plan = args.weeklyPlan;

  let dayTplId: string | null | undefined;
  let start: number | null | undefined;
  let end: number | null | undefined;

  if (plan) {
    switch (dayIndex) {
      case 1:
        dayTplId = plan.monShiftTemplateId;
        start = plan.monStartMinute;
        end = plan.monEndMinute;
        break;
      case 2:
        dayTplId = plan.tueShiftTemplateId;
        start = plan.tueStartMinute;
        end = plan.tueEndMinute;
        break;
      case 3:
       dayTplId = plan.wedShiftTemplateId;
        start = plan.wedStartMinute;
        end = plan.wedEndMinute;
        break;
      case 4:
        dayTplId = plan.thuShiftTemplateId;
        start = plan.thuStartMinute;
       end = plan.thuEndMinute;
        break;
      case 5:
        dayTplId = plan.friShiftTemplateId;
        start = plan.friStartMinute;
        end = plan.friEndMinute;
        break;
      case 6:
        dayTplId = plan.satShiftTemplateId;
        start = plan.satStartMinute;
        end = plan.satEndMinute;
        break;
      case 7:
        dayTplId = plan.sunShiftTemplateId;
        start = plan.sunStartMinute;
        end = plan.sunEndMinute;
        break;
    }

    // 1) Day template override
    if (dayTplId) {
      const tpl = await getShiftTemplateById(args.companyId, dayTplId);
      if (tpl) {
        if (isOffShiftTemplate(tpl)) {
          return buildOffResolvedShift("DAY_TEMPLATE", tpl);
        }

        return {
          source: "DAY_TEMPLATE",
          shiftCode: (tpl as any).shiftCode ?? tpl.signature,
          shiftTemplateId: tpl.id,
          signature: {
            startTime: tpl.startTime,
            endTime: tpl.endTime,
            spansMidnight: tpl.spansMidnight,
            signature: tpl.signature,
          },
        };
      }
    }

    // 2) Day custom minutes (legacy/custom)
    const hasMinutes = start != null && end != null;
    if (hasMinutes) {
      const sig = buildShiftSignature(minuteToTime(start as number), minuteToTime(end as number));
      return { source: "CUSTOM", shiftCode: null, shiftTemplateId: null, signature: sig };
    }

    // 3) Week default template
    if ((plan as any).shiftTemplateId) {
      const tpl = await getShiftTemplateById(args.companyId, String((plan as any).shiftTemplateId));
      if (tpl) {
        if (isOffShiftTemplate(tpl)) {
          return buildOffResolvedShift("WEEK_TEMPLATE", tpl);
        }

        return {
          source: "WEEK_TEMPLATE",
          shiftCode: (tpl as any).shiftCode ?? tpl.signature,
          shiftTemplateId: tpl.id,
          signature: {
            startTime: tpl.startTime,
            endTime: tpl.endTime,
            spansMidnight: tpl.spansMidnight,
            signature: tpl.signature,
          },
        };
      }
    }
  }

  // 4) Period Work Schedule fallback
  const ws =
    args.workSchedule !== undefined
      ? args.workSchedule
      : await resolveWorkScheduleShiftForEmployeeOnDate({
          companyId: args.companyId,
          employeeId: empId,
          dayKey,
          timezone: tz,
        });
  if (ws) {
    if (ws.kind === "OFF") {
      return {
        source: "WORK_SCHEDULE",
        shiftCode: null,
        shiftTemplateId: null,
        isOffDay: true,
        signature: { startTime: "--:--", endTime: "--:--", spansMidnight: false, signature: "OFF" },
      };
    }
    return {
      source: "WORK_SCHEDULE",
      shiftCode: ws.shiftCode ?? null,
      shiftTemplateId: ws.shiftTemplateId,
      isOffDay: false,
      signature: ws.signature,
    };
  }

  // 5) Policy fallback (company policy)
  const startMin = (args.policy as any).shiftStartMinute;
  const endMin = (args.policy as any).shiftEndMinute;
  if (typeof startMin === "number" && typeof endMin === "number") {
    const sig = buildShiftSignature(minuteToTime(startMin), minuteToTime(endMin));
    return { source: "POLICY", shiftCode: null, shiftTemplateId: null, signature: sig };
  }

  return {
    source: "POLICY",
    shiftCode: null,
    shiftTemplateId: null,
    signature: { startTime: "--:--", endTime: "--:--", spansMidnight: false, signature: "Policy" },
  };
}

/**
 * Cached weekly-plan version of resolveShiftMinutesForEmployeeOnDate.
 * Used by recompute paths only; keeps existing behavior.
 */
export async function resolveShiftMinutesForEmployeeOnDateWithWeeklyPlan(args: {
  companyId: string;
  employeeId: string;
  date: string;
  timezone: string;
  policy: any;
  weeklyPlan: WeeklyShiftPlanRow;
  workSchedule?: WorkScheduleResolved | null;
}): Promise<ResolvedShiftMinutes> {
  const r = await resolveShiftForEmployeeOnDateUsingWeeklyPlan({
    companyId: args.companyId,
    employeeId: args.employeeId,
    dayKey: args.date,
    timezone: args.timezone,
    policy: args.policy,
    weeklyPlan: args.weeklyPlan,
    workSchedule: args.workSchedule,
  });

  const st = r.signature.startTime;
  const et = r.signature.endTime;

  if (st === "--:--" || et === "--:--") {
    return {
      source: r.source,
      signature: r.signature.signature,
      spansMidnight: r.signature.spansMidnight,
      shiftCode: r.shiftCode ?? null,
      shiftTemplateId: r.shiftTemplateId ?? null,
      isOffDay: !!(r as any).isOffDay,
      startMinute: undefined,
      endMinute: undefined,
    };
  }

  return {
    source: r.source,
    signature: r.signature.signature,
    spansMidnight: r.signature.spansMidnight,
    shiftCode: r.shiftCode ?? null,
    shiftTemplateId: r.shiftTemplateId ?? null,
    isOffDay: !!(r as any).isOffDay,
    startMinute: timeToMinute(st),
    endMinute: timeToMinute(et),
  };
}

/**
 * Cached weekly-plan version of resolveShiftForDayWithFallbackMinutes.
 * Behavior is intentionally identical to the original function; only plan fetching is removed.
 */
export async function resolveShiftForDayWithFallbackMinutesWithWeeklyPlan(args: {
  companyId: string;
  employeeId: string;
  date: string;
  timezone: string;
  policy: any;
  weeklyPlan: WeeklyShiftPlanRow;
  fallbackStartMinute?: number;
  fallbackEndMinute?: number;
}): Promise<ResolvedShiftMinutes> {
  const r = await resolveShiftMinutesForEmployeeOnDateWithWeeklyPlan({
    companyId: args.companyId,
    employeeId: args.employeeId,
    date: args.date,
    timezone: args.timezone,
    policy: args.policy,
    weeklyPlan: args.weeklyPlan,
  });

  const s = args.fallbackStartMinute;
  const e = args.fallbackEndMinute;

  if (r.isOffDay) {
    if (typeof s === "number" && typeof e === "number") {
      const spansMidnight = e <= s;
      return { ...r, spansMidnight, startMinute: s, endMinute: e };
    }
    return r;
  }

  if (typeof r.startMinute === "number" && typeof r.endMinute === "number") {
    if (r.source !== "POLICY") return r;
    if (typeof s === "number" && typeof e === "number") {
      const sig = buildShiftSignature(minuteToTime(s), minuteToTime(e));
      return {
        ...r,
        source: "POLICY",
        signature: sig.signature,
        spansMidnight: sig.spansMidnight,
        startMinute: s,
        endMinute: e,
      };
    }
    return r;
  }

  if (typeof s === "number" && typeof e === "number") {
    const sig = buildShiftSignature(minuteToTime(s), minuteToTime(e));
    return {
      source: "POLICY",
      signature: sig.signature,
      spansMidnight: sig.spansMidnight,
      startMinute: s,
      endMinute: e,
    };
  }

  return r;
}

function isSignatureLike(value: string): boolean {
  // Examples: 0900-1700, 2200-0600+1
  return /^\d{4}-\d{4}(\+1)?$/.test(value);
}

/**
 * Parse signature string into minute ints (engine-safe fallback).
 * This avoids “plan var ama start/end undefined” gibi edge-case’lerde
 * computeDaily’nin default 08-17’ye düşmesini engeller.
 */
export function parseShiftSignatureToMinutes(signature: string): {
  startMinute: number;
  endMinute: number;
  spansMidnight: boolean;
} | null {
  if (!isSignatureLike(signature)) return null;
  const base = signature.replace("+1", "");
  const [a, b] = base.split("-");
  if (!a || !b) return null;

  const sh = Number(a.slice(0, 2));
  const sm = Number(a.slice(2, 4));
  const eh = Number(b.slice(0, 2));
  const em = Number(b.slice(2, 4));
  if (
    Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em) ||
    sh < 0 || sh > 23 || eh < 0 || eh > 23 || sm < 0 || sm > 59 || em < 0 || em > 59
  ) {
    return null;
  }

  const startMinute = sh * 60 + sm;
  const endMinute = eh * 60 + em;
  const spansMidnight = signature.includes("+1") || endMinute <= startMinute;
  return { startMinute, endMinute, spansMidnight };
}

/**
 * Engine-safe resolver: returns effective shift minutes + source.
 * Precedence (SAP): Day Template > Day Custom Minutes > Week Template > Policy
 *
 * NOTE: If policy minutes are missing, startMinute/endMinute will be undefined.
 * ComputeDaily has its own defaults; but for audit/debug we keep "undefined" here.
 */
export async function resolveShiftMinutesForEmployeeOnDate(
  employeeId: string,
  date: string
): Promise<ResolvedShiftMinutes> {
  const r = await resolveShiftForEmployeeOnDate(employeeId, date);
  const st = r.signature.startTime;
  const et = r.signature.endTime;

  // UI placeholder case ("--:--") => no explicit minutes
  if (st === "--:--" || et === "--:--") {
    return {
      source: r.source,
      signature: r.signature.signature,
      spansMidnight: r.signature.spansMidnight,
      shiftCode: r.shiftCode ?? null,
      shiftTemplateId: r.shiftTemplateId ?? null,
      isOffDay: !!(r as any).isOffDay,
      startMinute: undefined,
      endMinute: undefined,
    };
  }

  return {
    source: r.source,
    signature: r.signature.signature,
    spansMidnight: r.signature.spansMidnight,
    shiftCode: r.shiftCode ?? null,
    shiftTemplateId: r.shiftTemplateId ?? null,
    isOffDay: !!(r as any).isOffDay,
    startMinute: timeToMinute(st),
    endMinute: timeToMinute(et),
  };
}

/**
 * ✅ Canonical engine entry point (FAZ-2)
 * Always prefer explicit minutes from templates/custom/policy.
 * If minutes are missing but signature is parseable, derive minutes from signature.
 */
export async function resolveShiftForDay(
  employeeId: string,
  date: string
): Promise<ResolvedShiftMinutes> {
  const r = await resolveShiftMinutesForEmployeeOnDate(employeeId, date);

  // If minutes are missing but signature looks like a real signature, derive minutes.
  if (
    (r.startMinute == null || r.endMinute == null) &&
    isSignatureLike(r.signature)
  ) {
    const parsed = parseShiftSignatureToMinutes(r.signature);
    if (parsed) {
      return {
        ...r,
        spansMidnight: parsed.spansMidnight,
        startMinute: parsed.startMinute,
        endMinute: parsed.endMinute,
      };
    }
  }

  return r;
}

/**
 * Engine-safe resolver WITH caller-provided fallback minutes.
 * Precedence (SAP): Day Template > Day Custom Minutes > Week Template > (fallback minutes)
 *
 * Use-case:
 * - If planner has no plan for a day, we want workforce rule-set (effectivePolicy) shiftStart/End
 *   to be used as the "policy fallback" rather than company default.
 */
export async function resolveShiftForDayWithFallbackMinutes(args: {
  employeeId: string;
  date: string;
  fallbackStartMinute?: number;
  fallbackEndMinute?: number;
}): Promise<ResolvedShiftMinutes> {
  const r = await resolveShiftMinutesForEmployeeOnDate(args.employeeId, args.date);
  return applyFallbackMinutesToResolvedShift({
    resolved: r,
    fallbackStartMinute: args.fallbackStartMinute,
    fallbackEndMinute: args.fallbackEndMinute,
  });
}

/**
 * Pure helper: Apply caller-provided fallback minutes onto an already-resolved shift minutes object.
 *
 * This is intentionally extracted so high-throughput flows (recompute) can avoid calling
 * resolveShiftMinutesForEmployeeOnDate twice (DB-heavy) while keeping behavior identical.
 */
export function applyFallbackMinutesToResolvedShift(args: {
  resolved: ResolvedShiftMinutes;
  fallbackStartMinute?: number;
  fallbackEndMinute?: number;
}): ResolvedShiftMinutes {
  const r = args.resolved;
  const s = args.fallbackStartMinute;
  const e = args.fallbackEndMinute;

  // OFF day: keep OFF semantics, but allow caller to inject minutes (windowing needs numbers).
  if (r.isOffDay) {
    if (typeof s === "number" && typeof e === "number") {
      const spansMidnight = e <= s;
      return {
        ...r,
        spansMidnight,
        startMinute: s,
        endMinute: e,
      };
    }
    return r;
  }

  // If planner/template/custom already produced minutes, keep them.
  //
  // IMPORTANT:
  // When source === "POLICY", the minutes may come from *company default* policy.
  // If caller provided fallback minutes (e.g., workforce/segment ruleset), we must
  // prefer caller's fallback so shift won't stay "DEFAULT" while policy changes.
  if (typeof r.startMinute === "number" && typeof r.endMinute === "number") {
    if (r.source !== "POLICY") return r;

    if (typeof s === "number" && typeof e === "number") {
      const sig = buildShiftSignature(minuteToTime(s), minuteToTime(e));
      return {
        ...r,
        source: "POLICY",
        signature: sig.signature,
        spansMidnight: sig.spansMidnight,
        startMinute: s,
        endMinute: e,
      };
    }
    return r;
  }

  if (typeof s === "number" && typeof e === "number") {
    const sig = buildShiftSignature(minuteToTime(s), minuteToTime(e));
    return {
      source: "POLICY",
      signature: sig.signature,
      spansMidnight: sig.spansMidnight,
      startMinute: s,
      endMinute: e,
      // Keep OFF flag false/undefined explicitly (r.isOffDay already handled above)
      isOffDay: false,
    };
  }

  // As a last resort, keep whatever we had (may be undefined).
  return r;
}

/**
 * Retrieve start and end minutes for a given employee and date from the weekly shift plan, if defined.
 * Returns hasPlan=true only when a specific start and end minute are defined for the day.
 */
export async function getShiftTimesForEmployeeOnDate(
  employeeId: string,
  date: string
): Promise<{ startMinute?: number; endMinute?: number; hasPlan: boolean }> {
  const { company, policy } = await getCompanyBundle();
  const tz = policy.timezone || "Europe/Istanbul";
  const weekStart = computeWeekStartUTC(date, tz);
  const plan = await findWeeklyShiftPlan(company.id, employeeId, weekStart);
  if (!plan) {
    return { hasPlan: false };
  }
  // Determine day index 1..7 (Monday..Sunday) in local timezone
  const dt = DateTime.fromISO(date, { zone: tz });
  const dayIndex = dt.weekday; // 1..7
  let start: number | undefined;
  let end: number | undefined;
  let dayTplId: string | null | undefined;
  switch (dayIndex) {
    case 1:
      start = plan.monStartMinute ?? undefined;
      end = plan.monEndMinute ?? undefined;
      dayTplId = plan.monShiftTemplateId;
      break;
    case 2:
      start = plan.tueStartMinute ?? undefined;
      end = plan.tueEndMinute ?? undefined;
      dayTplId = plan.tueShiftTemplateId;
      break;
    case 3:
      start = plan.wedStartMinute ?? undefined;
      end = plan.wedEndMinute ?? undefined;
      dayTplId = plan.wedShiftTemplateId;
      break;
    case 4:
      start = plan.thuStartMinute ?? undefined;
      end = plan.thuEndMinute ?? undefined;
      dayTplId = plan.thuShiftTemplateId;
      break;
    case 5:
      start = plan.friStartMinute ?? undefined;
      end = plan.friEndMinute ?? undefined;
      dayTplId = plan.friShiftTemplateId;
      break;
    case 6:
      start = plan.satStartMinute ?? undefined;
      end = plan.satEndMinute ?? undefined;
      dayTplId = plan.satShiftTemplateId;
      break;
    case 7:
      start = plan.sunStartMinute ?? undefined;
      end = plan.sunEndMinute ?? undefined;
      dayTplId = plan.sunShiftTemplateId;
      break;
  }
  const hasMinutes =
    start !== undefined &&
    end !== undefined &&
    start !== null &&
    end !== null;

  // Assignment precedence (SAP katman mantığı):
  // 1) Gün template override
  // 2) Gün custom minutes (legacy/custom)
  // 3) Hafta default template
  // 4) Yoksa policy fallback (caller)
  if (dayTplId) {
    const tpl = await getShiftTemplateById(company.id, dayTplId);
    if (tpl) {
      if (isOffShiftTemplate(tpl)) {
        return {
          startMinute: undefined,
          endMinute: undefined,
          hasPlan: true,
        };
      }

      return {
        startMinute: timeToMinute(tpl.startTime),
        endMinute: timeToMinute(tpl.endTime),
        hasPlan: true,
      };
    }
  }
  // IMPORTANT: Custom minutes must override week default template.
  // Otherwise, week template would “shadow” day custom edits in Daily.
  if (hasMinutes) {
    return { startMinute: start, endMinute: end, hasPlan: true };
  }

  if (plan.shiftTemplateId) {
    const tpl = await getShiftTemplateById(company.id, plan.shiftTemplateId);
    if (tpl) {
      if (isOffShiftTemplate(tpl)) {
        return {
          startMinute: undefined,
          endMinute: undefined,
          hasPlan: true,
        };
      }

      return {
        startMinute: timeToMinute(tpl.startTime),
        endMinute: timeToMinute(tpl.endTime),
        hasPlan: true,
      };
    }
  }
  
  return { hasPlan: false };
}

/**
 * Save or update a weekly shift plan. Accepts ISO date strings for week start (Monday) and times in minutes.
 */
export async function saveWeeklyShiftPlan(input: {
  employeeId: string;
  weekStartDate: string; // YYYY-MM-DD (Monday)
  // Stage 3: week-level default template + day overrides.
  shiftTemplateId?: string | null;
  monShiftTemplateId?: string | null;
  tueShiftTemplateId?: string | null;
  wedShiftTemplateId?: string | null;
  thuShiftTemplateId?: string | null;
  friShiftTemplateId?: string | null;
  satShiftTemplateId?: string | null;
  sunShiftTemplateId?: string | null;
  monStartMinute?: number | null;
  monEndMinute?: number | null;
  tueStartMinute?: number | null;
  tueEndMinute?: number | null;
  wedStartMinute?: number | null;
  wedEndMinute?: number | null;
  thuStartMinute?: number | null;
  thuEndMinute?: number | null;
  friStartMinute?: number | null;
  friEndMinute?: number | null;
  satStartMinute?: number | null;
  satEndMinute?: number | null;
  sunStartMinute?: number | null;
  sunEndMinute?: number | null;
}): Promise<void> {
  const { company, policy } = await getCompanyBundle();
  const tz = policy.timezone || "Europe/Istanbul";
  const weekStartUTC = computeWeekStartUTC(input.weekStartDate, tz);

  // ------------------------------------------------------------------
  // Stage 3: week-level default template + day overrides.
  // IMPORTANT SAP rule:
  // Weekly plan (assignment) MUST NOT create ShiftTemplate (master data).
  // We only link to an existing template (by id) or keep NULL.
  // For backward compatibility we still persist legacy minutes.

  const resolveTemplateMinutes = async (tplId: string | null | undefined) => {
    if (!tplId) return null;
    const tpl = await getShiftTemplateById(company.id, tplId);
    if (!tpl) return null;
    return {
      tplId: tpl.id,
      startMinute: timeToMinute(tpl.startTime),
      endMinute: timeToMinute(tpl.endTime),
    };
  };

  const mapDay = async (
    explicitTplId: string | null | undefined,
    s?: number | null,
    e?: number | null
  ): Promise<{ tplId: string | null; startMinute: number | null; endMinute: number | null }> => {
    // 1) If UI sent an explicit template id for this day, prefer it.
    const explicit = await resolveTemplateMinutes(explicitTplId);
    if (explicit) {
      return {
        tplId: explicit.tplId,
        startMinute: explicit.startMinute,
        endMinute: explicit.endMinute,
      };
    }

    // 2) Otherwise, if legacy minutes exist (CUSTOM), try to match to an existing template by signature.
    if (s == null || e == null) {
      return { tplId: null, startMinute: s ?? null, endMinute: e ?? null };
    }
    const sig = buildShiftSignature(minuteToTime(s), minuteToTime(e));
    const existing = await findShiftTemplateBySignature(company.id, sig.signature);
    return {
      tplId: existing ? existing.id : null,
      startMinute: s,
      endMinute: e,
    };
  };

  // Week-level default template is explicit (can be null). Validate it exists; otherwise clear.
  const weekDefault = await resolveTemplateMinutes(input.shiftTemplateId);
  const shiftTemplateId = weekDefault ? weekDefault.tplId : null;

  const mon = await mapDay(input.monShiftTemplateId, input.monStartMinute, input.monEndMinute);
  const tue = await mapDay(input.tueShiftTemplateId, input.tueStartMinute, input.tueEndMinute);
  const wed = await mapDay(input.wedShiftTemplateId, input.wedStartMinute, input.wedEndMinute);
  const thu = await mapDay(input.thuShiftTemplateId, input.thuStartMinute, input.thuEndMinute);
  const fri = await mapDay(input.friShiftTemplateId, input.friStartMinute, input.friEndMinute);
  const sat = await mapDay(input.satShiftTemplateId, input.satStartMinute, input.satEndMinute);
  const sun = await mapDay(input.sunShiftTemplateId, input.sunStartMinute, input.sunEndMinute);
 
  await upsertWeeklyShiftPlan({
    companyId: company.id,
    employeeId: input.employeeId,
    weekStartDate: weekStartUTC,
    shiftTemplateId,
    monShiftTemplateId: mon.tplId,
    tueShiftTemplateId: tue.tplId,
    wedShiftTemplateId: wed.tplId,
    thuShiftTemplateId: thu.tplId,
    friShiftTemplateId: fri.tplId,
    satShiftTemplateId: sat.tplId,
    sunShiftTemplateId: sun.tplId,
    monStartMinute: input.monStartMinute ?? null,
    monEndMinute: input.monEndMinute ?? null,
    tueStartMinute: input.tueStartMinute ?? null,
    tueEndMinute: input.tueEndMinute ?? null,
    wedStartMinute: input.wedStartMinute ?? null,
    wedEndMinute: input.wedEndMinute ?? null,
    thuStartMinute: input.thuStartMinute ?? null,
    thuEndMinute: input.thuEndMinute ?? null,
    friStartMinute: input.friStartMinute ?? null,
    friEndMinute: input.friEndMinute ?? null,
    satStartMinute: input.satStartMinute ?? null,
    satEndMinute: input.satEndMinute ?? null,
    sunStartMinute: input.sunStartMinute ?? null,
    sunEndMinute: input.sunEndMinute ?? null,
  });
}
