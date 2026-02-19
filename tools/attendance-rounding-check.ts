import { DateTime } from "luxon";
import { EventDirection } from "@prisma/client";
import { computeDailyAttendance } from "@/src/domain/attendance/computeDaily";

function assertEq(name: string, actual: unknown, expected: unknown) {
  if (actual !== expected) {
    // eslint-disable-next-line no-console
    console.error(`❌ ${name}: expected=${expected} actual=${actual}`);
    process.exitCode = 1;
  } else {
    // eslint-disable-next-line no-console
    console.log(`✅ ${name}: ${actual}`);
  }
}

function d(isoLocal: string, zone: string) {
  // isoLocal: "2026-02-06T09:00:59"
  return DateTime.fromISO(isoLocal, { zone }).toJSDate();
}

const zone = "Europe/Istanbul";
const date = "2026-02-06";

// --- Senaryo-1: 29dk55sn exit gap => 30 dk sayılmalı (workedMinutes doğru çıkmalı)
{
  const res = computeDailyAttendance({
    date,
    timezone: zone,
    policy: {
      timezone: zone,
      shiftStartMinute: 9 * 60,
      shiftEndMinute: 17 * 60,
      breakAutoDeductEnabled: true,
      breakMinutes: 0,
      exitConsumesBreak: true,
      workedCalculationMode: "CLAMP_TO_SHIFT",
    },
    events: [
      { occurredAt: d(`${date}T09:00:00`, zone), direction: EventDirection.IN },
      { occurredAt: d(`${date}T12:00:00`, zone), direction: EventDirection.OUT },
      // gap: 12:00:00 -> 12:29:55  (29:55) => 30 dk
      { occurredAt: d(`${date}T12:29:55`, zone), direction: EventDirection.IN },
      { occurredAt: d(`${date}T17:00:00`, zone), direction: EventDirection.OUT },
    ],
  });

  // Açıklama:
  // Shift duration = 480
  // exitGap = 29:55 => 30 dk
  // workedMinutes beklenen = 450
  assertEq("S1 workedMinutes", res.workedMinutes, 450);
}

// --- Senaryo-2: 09:00:59 giriş => 1 dk geç (lateMinutes 1 olmalı)
{
  const res = computeDailyAttendance({
    date,
    timezone: zone,
    policy: {
      timezone: zone,
      shiftStartMinute: 9 * 60,
      shiftEndMinute: 17 * 60,
      breakAutoDeductEnabled: false,
      lateGraceMinutes: 0,
      workedCalculationMode: "CLAMP_TO_SHIFT",
    },
    events: [
      { occurredAt: d(`${date}T09:00:59`, zone), direction: EventDirection.IN },
      { occurredAt: d(`${date}T17:00:00`, zone), direction: EventDirection.OUT },
    ],
  });

  assertEq("S2 lateMinutes", res.lateMinutes, 1);
}

// --- Senaryo-3: 16:59:29 çıkış => 1 dk erken çıkış (earlyLeaveMinutes 1 olmalı)
{
  const res = computeDailyAttendance({
    date,
    timezone: zone,
    policy: {
      timezone: zone,
      shiftStartMinute: 9 * 60,
      shiftEndMinute: 17 * 60,
      breakAutoDeductEnabled: false,
      earlyLeaveGraceMinutes: 0,
      workedCalculationMode: "CLAMP_TO_SHIFT",
    },
    events: [
      { occurredAt: d(`${date}T09:00:00`, zone), direction: EventDirection.IN },
      { occurredAt: d(`${date}T16:59:29`, zone), direction: EventDirection.OUT },
    ],
  });

  assertEq("S3 earlyLeaveMinutes", res.earlyLeaveMinutes, 1);
}

// --- Senaryo-4: Grace sonrası negatif bariyeri (Math.max(0, ...)) korunuyor mu?
// 09:00:20 giriş => late ~0 dk/1 dk yuvarlanabilir, ama grace=5 olduğunda sonuç negatif olmamalı => 0
{
  const res = computeDailyAttendance({
    date,
    timezone: zone,
    policy: {
      timezone: zone,
      shiftStartMinute: 9 * 60,
      shiftEndMinute: 17 * 60,
      breakAutoDeductEnabled: false,
      lateGraceMinutes: 5,
      workedCalculationMode: "CLAMP_TO_SHIFT",
    },
    events: [
      { occurredAt: d(`${date}T09:00:20`, zone), direction: EventDirection.IN },
      { occurredAt: d(`${date}T17:00:00`, zone), direction: EventDirection.OUT },
    ],
  });

  assertEq("S4 lateMinutes (grace clamp)", res.lateMinutes, 0);
}

if (process.exitCode && process.exitCode !== 0) {
  // eslint-disable-next-line no-console
  console.error("\nOne or more attendance rounding checks failed.");
  process.exit(process.exitCode);
} else {
  // eslint-disable-next-line no-console
  console.log("\nAll attendance rounding checks passed.");
}
