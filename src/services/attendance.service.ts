import { DateTime } from "luxon";
import { EventDirection, NormalizedStatus } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { getShiftTimesForEmployeeOnDate, resolveShiftForDayWithFallbackMinutes } from "@/src/services/shiftPlan.service";
import { computeDailyAttendance, computeOvertimeDynamicBreak } from "@/src/domain/attendance/computeDaily";
import { normalizePunches } from "@/src/domain/attendance/normalizePunches";
import { isEmployeeOnLeave } from "@/src/services/leave.service";
import { resolvePolicyRuleSetForEmployeeOnDate } from "@/src/services/policyResolver.service";
import { resolveShiftPolicyRuleSetForEmployeeOnDate } from "@/src/services/shiftPolicyResolver.service";
import { upsertDailyAttendance } from "@/src/repositories/attendance.repo";
import { upsertNormalizedForRawEvent } from "@/src/repositories/normalizedEvent.repo";
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
  const startUtc = dayStartLocal.toUTC();
  const endUtc = dayStartLocal.plus({ days: 2 }).toUTC();

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
    select: { id: true },
  });

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

  for (const e of employees) {
    // Phase-2: resolve optional policy ruleset assignment.
    // Backwards compatible: if none, we use legacy CompanyPolicy (no behaviour change).
    const resolvedRuleSet = await resolvePolicyRuleSetForEmployeeOnDate({
      companyId,
      employeeId: e.id,
      dayKey: date,
    });
    // NOTE (Model-A): This is the *only* place where work rules are chosen.
    // Shift assignment MUST NOT affect which rules are picked.
    const workforcePolicy = resolvedRuleSet?.ruleSet
      ? mergePolicyRules(companyPolicy, resolvedRuleSet.ruleSet)
      : companyPolicy;

    // 1) First pass: resolve planner/template shift WITHOUT fallback minutes.
    // We mainly need shiftCode here to resolve shift-policy overrides (Model-B).
    const plannerResolved = await resolveShiftForDayWithFallbackMinutes({
      employeeId: e.id,
      date,
    });

    // 2) Resolve shift-policy override (Model-B layer) using shiftCode.
    const shiftPolicy = await resolveShiftPolicyRuleSetForEmployeeOnDate({
      companyId,
      employeeId: e.id,
      dayKey: date,
      shiftCode: plannerResolved.shiftCode ?? null,
    });

    // 3) Effective policy = workforce policy (+ shift override if present)
    const effectivePolicy = shiftPolicy?.ruleSet
      ? mergePolicyRules(workforcePolicy, shiftPolicy.ruleSet)
      : workforcePolicy;

    // 4) Final pass: resolve shift with correct fallback minutes from effective policy
    // (If no plan/template exists, rule-set shiftStart/End should be used; not company default.)
    const resolved = await resolveShiftForDayWithFallbackMinutes({
      employeeId: e.id,
      date,
      fallbackStartMinute: (effectivePolicy as any).shiftStartMinute,
      fallbackEndMinute: (effectivePolicy as any).shiftEndMinute,
    });

    // Keep engine behavior stable: computeDaily has defaults, but windowing needs numbers.
    const policyStartExplicit =
      typeof (effectivePolicy as any).shiftStartMinute === "number" ? (effectivePolicy as any).shiftStartMinute : undefined;
    const policyEndExplicit =
      typeof (effectivePolicy as any).shiftEndMinute === "number" ? (effectivePolicy as any).shiftEndMinute : undefined;

    const empShiftStart = resolved.startMinute ?? policyStartExplicit ?? 8 * 60;
    const empShiftEnd = resolved.endMinute ?? policyEndExplicit ?? 17 * 60;

    // Employee-specific event window
    // Stage 7 fix: add buffer so early IN / late OUT won't be dropped (prevents ABSENT / ORPHAN_OUT)
    const windowBufferMinutes = 720; // 12 saat güvenli pencere
     
    let empWindowStartLocal: DateTime;
    let empWindowEndLocal: DateTime;
    if (empShiftEnd <= empShiftStart) {
      // Overnight shift: start on day D, end on day D+1
      empWindowStartLocal = dayStartLocal
        .plus({ minutes: empShiftStart })
        .minus({ minutes: windowBufferMinutes });
      empWindowEndLocal = dayStartLocal
        .plus({ days: 1, minutes: empShiftEnd })
        .plus({ minutes: windowBufferMinutes });
    } else {
      // Regular shift: narrow to shift window + buffer (prevents early IN / late OUT from being dropped)
      empWindowStartLocal = dayStartLocal
        .plus({ minutes: empShiftStart })
        .minus({ minutes: windowBufferMinutes });
      empWindowEndLocal = dayStartLocal
        .plus({ minutes: empShiftEnd })
        .plus({ minutes: windowBufferMinutes });
    }
    const empWindowStartUtc = empWindowStartLocal.toUTC().toJSDate();
    const empWindowEndUtc = empWindowEndLocal.toUTC().toJSDate();

    const empEventsAll = rawByEmployee.get(e.id) ?? [];

    // Track whether we captured an OUT outside the base window (next-day spillover).
    let lateOutCaptured = false;

    // FIX: Late OUT after window cutoff was being dropped -> MISSING_PUNCH
    // Keep base window tight; additionally allow ONLY OUT after the base window
    // up to next-day "cap" (default 12:00 local). This prevents pulling next-day INs.
    const capMinuteRaw =
      typeof (effectivePolicy as any).lateOutCaptureUntilMinute === "number"
        ? (effectivePolicy as any).lateOutCaptureUntilMinute
        : 12 * 60; // default 12:00
    const capMinute = Math.max(0, Math.min(23 * 60 + 59, capMinuteRaw)); // clamp 00:00..23:59
    const lateOutCapUtc = dayStartLocal.plus({ days: 1, minutes: capMinute }).toUTC().toJSDate();

    const isOvernight = empShiftEnd <= empShiftStart;
    const empEvents = empEventsAll.filter((ev) => {
      // Base window (IN/OUT)
      if (ev.occurredAt >= empWindowStartUtc && ev.occurredAt <= empWindowEndUtc) return true;

      // Extra late OUT allowance (ONLY for regular shifts)
      if (!isOvernight) {
        if (
          ev.direction === "OUT" &&
          ev.occurredAt > empWindowEndUtc &&
          ev.occurredAt <= lateOutCapUtc
        ) {
          lateOutCaptured = true;
          return true;
        }
      }
      return false;
    });

    const norm = normalizePunches(empEvents);

    for (const raw of empEvents) {
      const d = norm.decisions[raw.id] ?? { status: "ACCEPTED" as const };
      const status = d.status === "ACCEPTED" ? NormalizedStatus.PROCESSED : NormalizedStatus.REJECTED;

      await upsertNormalizedForRawEvent({
        rawEventId: raw.id,
        companyId,
        employeeId: e.id,
        occurredAt: raw.occurredAt,
        direction: raw.direction,
        status,
        rejectReason: d.status === "REJECTED" ? d.reason ?? "REJECTED" : null,
      });
    }

    // Model-A: computeDaily'ye giden "policy" nesnesi bir engine-input'tur.
    // Work rules workforcePolicy'den gelir; shiftStart/End ise shift plan resolver'dan gelir.
    const baseComputePolicy = toComputePolicy(effectivePolicy);
    let computePolicyInput = applyResolvedShiftMinutesToComputePolicy({
      base: baseComputePolicy,
      resolved: { startMinute: resolved.startMinute, endMinute: resolved.endMinute },
    });

    // Enterprise OFF propagation: resolver decided today is OFF => computeDaily must know it
    if (resolved.isOffDay) {
      computePolicyInput = { ...(computePolicyInput as any), isOffDay: true } as any;
    }

    // Compute daily attendance using either the weekly plan (if present) or the policy defaults.
    // The policyOverride already incorporates default shiftStart/End and any overrides from the weekly plan.
    const computed = computeDailyAttendance({
      date,
      timezone: tz,
      policy: computePolicyInput,
      normalized: norm,
    });

    // ------------------------------------------------------------------
    // Leave day integration
    // Eğer çalışan bu tarihle kesişen onaylı bir izin içindeyse,
    // durum ve süreler şirket politikasına göre güncellenir.
    const leave = await isEmployeeOnLeave(e.id, date);
    let finalComputed = { ...computed };
    if (leave) {
      // Bu günde herhangi bir giriş/çıkış var mı?
      const hasAnyPunch =
        (empEvents?.length ?? 0) > 0 || norm.acceptedEvents.length > 0;
      const anomalies = new Set(computed.anomalies);
      // İzin günü NO_PLAN anomalisi bastırılır
      anomalies.delete("NO_PLAN");
      if (!hasAnyPunch) {
        // Hiç giriş/çıkış yoksa tüm süreler sıfırlanır
        finalComputed = {
          firstIn: null,
          lastOut: null,
          workedMinutes: 0,
          lateMinutes: 0,
          earlyLeaveMinutes: 0,
          overtimeMinutes: 0,
          overtimeEarlyMinutes: 0,
          overtimeLateMinutes: 0,
          otBreakCount: 0,
          otBreakDeductMinutes: 0,
          status: "LEAVE",
          anomalies: [],
        };
      } else {
        // En az bir giriş/çıkış varsa leaveEntryBehavior uygulanır
        const leb: any = (effectivePolicy as any).leaveEntryBehavior ?? "FLAG";
        if (leb === "IGNORE") {
          anomalies.add("LEAVE_PUNCH_IGNORED");
          finalComputed = {
            ...computed,
            workedMinutes: 0,
            overtimeMinutes: 0,
            overtimeEarlyMinutes: 0,
            overtimeLateMinutes: 0,
            otBreakCount: 0,
            otBreakDeductMinutes: 0,
            lateMinutes: 0,
            earlyLeaveMinutes: 0,
            status: "LEAVE",
            anomalies: Array.from(anomalies),
          };
        } else if (leb === "COUNT_AS_OT") {
          anomalies.add("LEAVE_PUNCH_OT");
          // Enterprise: apply dynamic OT break on leave-day OT as well (keep behavior consistent with OFF day)
          const otAdjusted = computeOvertimeDynamicBreak({
            overtimeMinutes: computed.workedMinutes,
            overtimeEarlyMinutes: 0,
            overtimeLateMinutes: computed.workedMinutes,
            otBreakInterval: computePolicyInput.otBreakInterval ?? undefined,
            otBreakDuration: computePolicyInput.otBreakDuration ?? undefined,
          });
          finalComputed = {
            ...computed,
            overtimeMinutes: otAdjusted.overtimeMinutes,
            overtimeEarlyMinutes: otAdjusted.overtimeEarlyMinutes,
            overtimeLateMinutes: otAdjusted.overtimeLateMinutes,
            otBreakCount: otAdjusted.otBreakCount,
            otBreakDeductMinutes: otAdjusted.otBreakDeductMinutes,
            workedMinutes: 0,
            lateMinutes: 0,
            earlyLeaveMinutes: 0,
            status: "LEAVE",
            anomalies: Array.from(anomalies),
          };
        } else {
          // FLAG: çalışma süresi hesaplanır, fazla mesai 0 olur
          anomalies.add("LEAVE_PUNCH_FLAG");
          finalComputed = {
            ...computed,
            overtimeMinutes: 0,
            overtimeEarlyMinutes: 0,
            overtimeLateMinutes: 0,
            otBreakCount: 0,
            otBreakDeductMinutes: 0,
            lateMinutes: 0,
            earlyLeaveMinutes: 0,
            status: "LEAVE",
            anomalies: Array.from(anomalies),
          };
        }
     }
    }

    // Sonraki işlemler için finalComputed referansı
    const computedRef = finalComputed;

    // Add anomaly for visibility: we captured a next-day late OUT to close the day.
    // (This is operationally important: workedMinutes may look "too long", and should be reviewed.)
    if (lateOutCaptured) {
      if (!computedRef.anomalies.includes("LATE_OUT_CAPTURED")) {
        computedRef.anomalies.push("LATE_OUT_CAPTURED");
      }
    }

    // -- Policy Fallback & NO_PLAN
    // Sadece referans vardiya tanımlı değilse ve gün OFF veya LEAVE değilse
    // punches varsa NO_PLAN anomalisi eklenir.
    if (computedRef.status !== "OFF" && computedRef.status !== "LEAVE") {
      const hasReferenceShift =
        computePolicyInput.shiftStartMinute !== undefined &&
        computePolicyInput.shiftEndMinute !== undefined;
      if (!hasReferenceShift) {
        // Yalnızca giriş/çıkış veya çalışılan dakika varsa NO_PLAN ekle
        if (
          computedRef.workedMinutes > 0 ||
          computedRef.firstIn !== null ||
          computedRef.lastOut !== null
        ) {
          if (!computedRef.anomalies.includes("NO_PLAN")) {
            computedRef.anomalies.push("NO_PLAN");
         }
        }
      }
    }
    // Duruma göre sayaçları artır
    if (computedRef.status === "PRESENT") presentCount++;
    if (computedRef.status === "ABSENT") absentCount++;
    if (computedRef.anomalies.includes("MISSING_PUNCH")) missingPunchCount++;
    // Günlük kaydı final değerlerle güncelle
    await upsertDailyAttendance({
      companyId,
      employeeId: e.id,
      workDate,
      firstIn: computedRef.firstIn,
      lastOut: computedRef.lastOut,
      workedMinutes: computedRef.workedMinutes,
      lateMinutes: computedRef.lateMinutes,
      earlyLeaveMinutes: computedRef.earlyLeaveMinutes,
      overtimeMinutes: computedRef.overtimeMinutes,
      overtimeEarlyMinutes: computedRef.overtimeEarlyMinutes ?? 0,
      overtimeLateMinutes: computedRef.overtimeLateMinutes ?? 0,
      otBreakCount: (computedRef as any).otBreakCount ?? 0,
      otBreakDeductMinutes: (computedRef as any).otBreakDeductMinutes ?? 0,
      status: computedRef.status as any,
      anomalies: computedRef.anomalies,

      // Persist engine-used shift meta for audit/debug & UI.
      shiftSource: resolved.source,
      shiftSignature: resolved.signature,
      // IMPORTANT: persist the exact minutes actually used by the engine (including policy fallback)
      shiftStartMinute: empShiftStart,
      shiftEndMinute: empShiftEnd,
      // Prefer resolved spansMidnight; otherwise derive from effective minutes.
      shiftSpansMidnight: resolved.spansMidnight ?? (empShiftEnd <= empShiftStart),

      computedAt,
    });
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
