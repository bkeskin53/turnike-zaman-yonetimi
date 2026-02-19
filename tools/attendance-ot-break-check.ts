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
  return DateTime.fromISO(isoLocal, { zone }).toJSDate();
}

const zone = "Europe/Istanbul";
const date = "2026-02-06";

// Senaryo: Shift 09:00-18:00
// Kişi 09:00-23:20 çalışsın.
// Brüt OT (late) = 18:00->23:20 = 320 dk.
// Dynamic OT break: her 180 dk'da 30 dk => floor(320/180)=1 => 30 dk düş => net 290.
{
  const res = computeDailyAttendance({
    date,
    timezone: zone,
    policy: {
      timezone: zone,
      shiftStartMinute: 9 * 60,
      shiftEndMinute: 18 * 60,
      workedCalculationMode: "CLAMP_TO_SHIFT",

      // OT hesap bloğunu aktifleştir
      overtimeEnabled: true,
      overtimeMode: "BOTH",

      // feature ON:
      otBreakInterval: 180,
      otBreakDuration: 30,
    },
    events: [
      { occurredAt: d(`${date}T09:00:00`, zone), direction: EventDirection.IN },
      { occurredAt: d(`${date}T23:20:00`, zone), direction: EventDirection.OUT },
    ],
  });

  assertEq("OT raw should be reduced (OT total)", res.overtimeMinutes, 290);
  assertEq("OT should be all late in this scenario (OT early)", res.overtimeEarlyMinutes, 0);
  assertEq("OT late after break deduction", res.overtimeLateMinutes, 290);
}

if (process.exitCode && process.exitCode !== 0) {
  // eslint-disable-next-line no-console
  console.error("\nOne or more overtime dynamic break checks failed.");
  process.exit(process.exitCode);
} else {
  // eslint-disable-next-line no-console
  console.log("\nAll overtime dynamic break checks passed.");
}
