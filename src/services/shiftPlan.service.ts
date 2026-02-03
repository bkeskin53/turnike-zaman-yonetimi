import { DateTime } from "luxon";
import { getCompanyBundle } from "@/src/services/company.service";
import {
  findWeeklyShiftPlan,
  upsertWeeklyShiftPlan,
} from "@/src/repositories/shiftPlan.repo";
import { getShiftTemplateById } from "@/src/services/shiftTemplate.service";
import { findShiftTemplateBySignature } from "@/src/repositories/shiftTemplate.repo";

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

export type ShiftSource = "POLICY" | "WEEK_TEMPLATE" | "DAY_TEMPLATE" | "CUSTOM";

export type ResolvedShift = {
  source: ShiftSource;
  signature: ShiftSignature;
};

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
  date: string
): Promise<ResolvedShift> {
  const { company, policy } = await getCompanyBundle();
 const tz = policy.timezone || "Europe/Istanbul";
  const weekStart = computeWeekStartUTC(date, tz);
  const plan = await findWeeklyShiftPlan(company.id, employeeId, weekStart);

  // Day index 1..7 (Monday..Sunday) in local timezone
  const dayIndex = DateTime.fromISO(date, { zone: tz }).weekday; // 1..7

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
        return {
          source: "DAY_TEMPLATE",
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
      return { source: "CUSTOM", signature: sig };
    }

    // 3) Week default template
    if (plan.shiftTemplateId) {
      const tpl = await getShiftTemplateById(company.id, plan.shiftTemplateId);
      if (tpl) {
        return {
          source: "WEEK_TEMPLATE",
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

  // 4) Policy fallback
  const startMin = (policy as any).shiftStartMinute;
  const endMin = (policy as any).shiftEndMinute;
  if (typeof startMin === "number" && typeof endMin === "number") {
    const sig = buildShiftSignature(minuteToTime(startMin), minuteToTime(endMin));
    return { source: "POLICY", signature: sig };
  }

  // Policy minutes missing -> return stable placeholder (UI only)
  return {
    source: "POLICY",
    signature: { startTime: "--:--", endTime: "--:--", spansMidnight: false, signature: "Policy" },
  };
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
