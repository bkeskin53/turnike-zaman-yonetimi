import { DateTime } from "luxon";
import { EventDirection, NormalizedStatus } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { computeDailyAttendance } from "@/src/domain/attendance/computeDaily";
import { normalizePunches } from "@/src/domain/attendance/normalizePunches";
import { upsertDailyAttendance } from "@/src/repositories/attendance.repo";
import { upsertNormalizedForRawEvent } from "@/src/repositories/normalizedEvent.repo";

export async function recomputeAttendanceForDate(date: string) {
  const companyId = await getActiveCompanyId();
  const bundle = await getCompanyBundle();
  const policy = bundle.policy;

  const tz = policy.timezone || "Europe/Istanbul";

  const startUtc = DateTime.fromISO(date, { zone: tz }).startOf("day").toUTC();
  const endUtc = startUtc.plus({ days: 1 });

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

  const workDate = new Date(`${date}T00:00:00.000Z`);
  const computedAt = new Date();

  let presentCount = 0;
  let absentCount = 0;
  let missingPunchCount = 0;

  for (const e of employees) {
    const empEvents = rawByEmployee.get(e.id) ?? [];

    // 1) Normalize (reject invalid punches, build segments)
    const norm = normalizePunches(empEvents);

    // 2) Persist NormalizedEvent per RawEvent
    for (const raw of empEvents) {
      const d = norm.decisions[raw.id] ?? { status: "ACCEPTED" as const };
      const status =
        d.status === "ACCEPTED" ? NormalizedStatus.PROCESSED : NormalizedStatus.REJECTED;

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

    // 3) Compute daily from normalized segments
    const computed = computeDailyAttendance({
      date,
      timezone: tz,
      policy: {
        shiftStartMinute: policy.shiftStartMinute,
        shiftEndMinute: policy.shiftEndMinute,

        breakAutoDeductEnabled: policy.breakAutoDeductEnabled,
        breakMinutes: policy.breakMinutes,

        lateGraceMinutes: policy.lateGraceMinutes,
        earlyLeaveGraceMinutes: policy.earlyLeaveGraceMinutes,

        offDayEntryBehavior: policy.offDayEntryBehavior,
        overtimeEnabled: policy.overtimeEnabled,
      },
      normalized: norm,
    });

    if (computed.status === "PRESENT") presentCount++;
    if (computed.status === "ABSENT") absentCount++;
    if (computed.anomalies.includes("MISSING_PUNCH")) missingPunchCount++;

    await upsertDailyAttendance({
      companyId,
      employeeId: e.id,
      workDate,
      firstIn: computed.firstIn,
      lastOut: computed.lastOut,
      workedMinutes: computed.workedMinutes,
      lateMinutes: computed.lateMinutes,
      earlyLeaveMinutes: computed.earlyLeaveMinutes,
      overtimeMinutes: computed.overtimeMinutes,
      status: computed.status,
      anomalies: computed.anomalies,
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
