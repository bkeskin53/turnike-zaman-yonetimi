import { DateTime } from "luxon";
import { EventDirection, NormalizedStatus } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { getShiftTimesForEmployeeOnDate } from "@/src/services/shiftPlan.service";
import { computeDailyAttendance } from "@/src/domain/attendance/computeDaily";
import { normalizePunches } from "@/src/domain/attendance/normalizePunches";
import { isEmployeeOnLeave } from "@/src/services/leave.service";
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

    // Worked minutes calculation mode (default handled in computeDaily)
    workedCalculationMode: policy.workedCalculationMode ?? undefined,
  };
}

export async function recomputeAttendanceForDate(date: string) {
  const companyId = await getActiveCompanyId();
  const bundle = await getCompanyBundle();
  const policy = bundle.policy;

  const tz = policy.timezone || "Europe/Istanbul";

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

  const employees = await prisma.employee.findMany({
    where: { companyId, isActive: true },
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
    // Determine shift times for this date and employee (weekly plan / template aware)
    const shift = await getShiftTimesForEmployeeOnDate(e.id, date);
    const fallbackShiftStart = policy.shiftStartMinute ?? 8 * 60;
    const fallbackShiftEnd = policy.shiftEndMinute ?? 17 * 60;
    const empShiftStart = shift.startMinute ?? fallbackShiftStart;
    const empShiftEnd = shift.endMinute ?? fallbackShiftEnd;

    // Employee-specific event window
    // Stage 7 fix: add buffer so early IN / late OUT won't be dropped (prevents ABSENT / ORPHAN_OUT)
    const windowBufferMinutes = 180; // 3 hours safety buffer (minimal, policy-independent)
     
    let empWindowStartLocal: DateTime;
    let empWindowEndLocal: DateTime;
    if (empShiftEnd <= empShiftStart) {
      empWindowStartLocal = dayStartLocal
        .plus({ minutes: empShiftStart })
        .minus({ minutes: windowBufferMinutes });
      empWindowEndLocal = dayStartLocal
        .plus({ days: 1, minutes: empShiftEnd })
        .plus({ minutes: windowBufferMinutes });
    } else {
      empWindowStartLocal = dayStartLocal;
      empWindowEndLocal = dayStartLocal.plus({ days: 1 });
    }
    const empWindowStartUtc = empWindowStartLocal.toUTC().toJSDate();
    const empWindowEndUtc = empWindowEndLocal.toUTC().toJSDate();

    const empEventsAll = rawByEmployee.get(e.id) ?? [];
    const empEvents = empEventsAll.filter(
      (ev) => ev.occurredAt >= empWindowStartUtc && ev.occurredAt < empWindowEndUtc
    );

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

    // Derive policy overriding shift times if plan exists
    const policyOverride: any = toComputePolicy(policy);
    if (shift.startMinute !== undefined && shift.endMinute !== undefined) {
      policyOverride.shiftStartMinute = shift.startMinute;
      policyOverride.shiftEndMinute = shift.endMinute;
    }
    // Compute daily attendance using either the weekly plan (if present) or the policy defaults.
    // The policyOverride already incorporates default shiftStart/End and any overrides from the weekly plan.
    const computed = computeDailyAttendance({
      date,
      timezone: tz,
      policy: policyOverride,
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
          status: "LEAVE",
          anomalies: [],
        };
      } else {
        // En az bir giriş/çıkış varsa leaveEntryBehavior uygulanır
        const leb: any = policy.leaveEntryBehavior ?? "FLAG";
        if (leb === "IGNORE") {
          anomalies.add("LEAVE_PUNCH_IGNORED");
          finalComputed = {
            ...computed,
            workedMinutes: 0,
            overtimeMinutes: 0,
            overtimeEarlyMinutes: 0,
            overtimeLateMinutes: 0,
            lateMinutes: 0,
            earlyLeaveMinutes: 0,
            status: "LEAVE",
            anomalies: Array.from(anomalies),
          };
        } else if (leb === "COUNT_AS_OT") {
          anomalies.add("LEAVE_PUNCH_OT");
          finalComputed = {
            ...computed,
            overtimeMinutes: computed.workedMinutes,
            overtimeEarlyMinutes: 0,
            overtimeLateMinutes: computed.workedMinutes,
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

    // -- Policy Fallback & NO_PLAN
    // Sadece referans vardiya tanımlı değilse ve gün OFF veya LEAVE değilse
    // punches varsa NO_PLAN anomalisi eklenir.
    if (computedRef.status !== "OFF" && computedRef.status !== "LEAVE") {
      const hasReferenceShift =
        policyOverride.shiftStartMinute !== undefined &&
        policyOverride.shiftEndMinute !== undefined;
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
      status: computedRef.status as any,
      anomalies: computedRef.anomalies,
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
