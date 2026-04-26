import { describe, expect, it } from "vitest";
import {
  deriveExpectedWorkMinutes,
  derivePlannedWorkMinutesFromShiftTimes,
  deriveShiftStartTimeFromEndTime,
  deriveShiftTemplateClock,
  formatMinutesAsDecimalHoursText,
  formatMinutesAsHumanDurationText,
  normalizeShiftStartTime,
  parsePlannedWorkDecimalHoursToMinutes,
} from "../shiftTemplateClock";

describe("shiftTemplateClock", () => {
  it("parses mathematical decimal hours into canonical minutes", () => {
    expect(parsePlannedWorkDecimalHoursToMinutes("9")).toBe(540);
    expect(parsePlannedWorkDecimalHoursToMinutes("9,00")).toBe(540);
    expect(parsePlannedWorkDecimalHoursToMinutes("7,50")).toBe(450);
    expect(parsePlannedWorkDecimalHoursToMinutes("8.25")).toBe(495);
    expect(parsePlannedWorkDecimalHoursToMinutes("8,75")).toBe(525);
  });

  it("rounds non-minute decimal hour values deterministically", () => {
    expect(parsePlannedWorkDecimalHoursToMinutes("7,83")).toBe(470);
    expect(formatMinutesAsDecimalHoursText(470)).toBe("7,83");
  });

  it("formats canonical minutes for UI display", () => {
    expect(formatMinutesAsDecimalHoursText(540)).toBe("9,00");
    expect(formatMinutesAsDecimalHoursText(450)).toBe("7,50");
    expect(formatMinutesAsHumanDurationText(495)).toBe("8 saat 15 dakika");
  });

  it("guards invalid planned work values", () => {
    expect(() => parsePlannedWorkDecimalHoursToMinutes("0")).toThrow("PLANNED_WORK_HOURS_MUST_BE_POSITIVE");
    expect(() => parsePlannedWorkDecimalHoursToMinutes("12,01")).toThrow("PLANNED_WORK_HOURS_MAX_12_HOURS");
    expect(() => parsePlannedWorkDecimalHoursToMinutes("abc")).toThrow("PLANNED_WORK_HOURS_INVALID_FORMAT");
    expect(() => parsePlannedWorkDecimalHoursToMinutes("7,123")).toThrow("PLANNED_WORK_HOURS_INVALID_FORMAT");
  });

  it("defaults blank start time to 00:00", () => {
    expect(normalizeShiftStartTime(null)).toBe("00:00");
    expect(normalizeShiftStartTime("")).toBe("00:00");
    expect(normalizeShiftStartTime("8:5")).toBe("08:05");
  });

  it("derives end time, signature, and expected work from planned work first", () => {
    expect(deriveShiftTemplateClock({ plannedWorkHours: "9", startTime: null })).toMatchObject({
      plannedWorkMinutes: 540,
      plannedWorkHoursText: "9,00",
      expectedWorkMinutes: 540,
      expectedWorkHoursText: "9,00",
      startTime: "00:00",
      endTime: "09:00",
      spansMidnight: false,
      signature: "0000-0900",
    });

    expect(deriveShiftTemplateClock({ plannedWorkHours: "9,00", startTime: "08:00" })).toMatchObject({
      startTime: "08:00",
      endTime: "17:00",
      signature: "0800-1700",
    });

    expect(deriveShiftTemplateClock({ plannedWorkHours: "7,50", startTime: "22:00" })).toMatchObject({
      startTime: "22:00",
      endTime: "05:30",
      spansMidnight: true,
      signature: "2200-0530+1",
    });

    expect(deriveShiftTemplateClock({ plannedWorkHours: "12,00", startTime: "20:00" })).toMatchObject({
      startTime: "20:00",
      endTime: "08:00",
      spansMidnight: true,
      signature: "2000-0800+1",
    });
  });

  it("derives planned work minutes from legacy start/end pairs for migration-safe writes", () => {
    expect(derivePlannedWorkMinutesFromShiftTimes("08:00", "17:00")).toBe(540);
    expect(derivePlannedWorkMinutesFromShiftTimes("22:00", "05:30")).toBe(450);
    expect(() => derivePlannedWorkMinutesFromShiftTimes("00:00", "00:00")).toThrow(
      "PLANNED_WORK_MINUTES_MAX_12_HOURS"
    );
  });

  it("derives start time from an edited end time and planned work", () => {
    expect(deriveShiftStartTimeFromEndTime("17:00", 540)).toBe("08:00");
    expect(deriveShiftStartTimeFromEndTime("05:30", 450)).toBe("22:00");
    expect(deriveShiftStartTimeFromEndTime("08:00", 720)).toBe("20:00");
  });

  it("allows zero planned work only for OFF templates", () => {
    expect(deriveShiftTemplateClock({ shiftCode: "OFF", plannedWorkMinutes: 0 })).toMatchObject({
      plannedWorkMinutes: 0,
      plannedWorkHoursText: "0,00",
      startTime: "00:00",
      endTime: "00:00",
      spansMidnight: false,
      signature: "OFF",
    });

    expect(() => deriveShiftTemplateClock({ shiftCode: "GND", plannedWorkMinutes: 0 })).toThrow(
      "PLANNED_WORK_MINUTES_MUST_BE_POSITIVE"
    );
  });

  it("keeps the SAP decimal planned-work regression matrix stable", () => {
    const cases = [
      {
        input: { plannedWorkHours: "9", startTime: null },
        expected: {
          plannedWorkMinutes: 540,
          plannedWorkHoursText: "9,00",
          plannedWorkHumanText: "9 saat 00 dakika",
          expectedWorkMinutes: 540,
          expectedWorkHoursText: "9,00",
          expectedWorkHumanText: "9 saat 00 dakika",
          startTime: "00:00",
          endTime: "09:00",
          spansMidnight: false,
          signature: "0000-0900",
        },
      },
      {
        input: { plannedWorkHours: "9,00", startTime: "08:00" },
        expected: {
          plannedWorkMinutes: 540,
          plannedWorkHoursText: "9,00",
          plannedWorkHumanText: "9 saat 00 dakika",
          startTime: "08:00",
          endTime: "17:00",
          spansMidnight: false,
          signature: "0800-1700",
        },
      },
      {
        input: { plannedWorkHours: "7,50", startTime: "22:00" },
        expected: {
          plannedWorkMinutes: 450,
          plannedWorkHoursText: "7,50",
          plannedWorkHumanText: "7 saat 30 dakika",
          startTime: "22:00",
          endTime: "05:30",
          spansMidnight: true,
          signature: "2200-0530+1",
        },
      },
      {
        input: { plannedWorkHours: "8,25", startTime: "08:00" },
        expected: {
          plannedWorkMinutes: 495,
          plannedWorkHoursText: "8,25",
          plannedWorkHumanText: "8 saat 15 dakika",
          startTime: "08:00",
          endTime: "16:15",
          spansMidnight: false,
          signature: "0800-1615",
        },
      },
      {
        input: { plannedWorkHours: "8,75", startTime: "20:00" },
        expected: {
          plannedWorkMinutes: 525,
          plannedWorkHoursText: "8,75",
          plannedWorkHumanText: "8 saat 45 dakika",
          startTime: "20:00",
          endTime: "04:45",
          spansMidnight: true,
          signature: "2000-0445+1",
        },
      },
      {
        input: { plannedWorkHours: "12,00", startTime: "20:00" },
        expected: {
          plannedWorkMinutes: 720,
          plannedWorkHoursText: "12,00",
          plannedWorkHumanText: "12 saat 00 dakika",
          startTime: "20:00",
          endTime: "08:00",
          spansMidnight: true,
          signature: "2000-0800+1",
        },
      },
    ];

    for (const item of cases) {
      expect(deriveShiftTemplateClock(item.input)).toMatchObject(item.expected);
    }
  });

  it("rejects invalid decimal planned-work regression boundaries", () => {
    const invalidValues = ["", "0", "0,00", "-1", "12,01", "13,00", "abc", "8,123"];

    for (const value of invalidValues) {
      expect(() => parsePlannedWorkDecimalHoursToMinutes(value)).toThrow();
    }
  });

  it("deducts only unpaid break plans from expected work", () => {
    expect(
      deriveExpectedWorkMinutes({
        plannedWorkMinutes: 540,
        breakPlan: null,
      })
    ).toBe(540);

    expect(
      deriveExpectedWorkMinutes({
        plannedWorkMinutes: 540,
        breakPlan: { plannedBreakMinutes: 60, isPaid: false },
      })
    ).toBe(480);

    expect(
      deriveExpectedWorkMinutes({
        plannedWorkMinutes: 540,
        breakPlan: { plannedBreakMinutes: 60, isPaid: true },
      })
    ).toBe(540);

    expect(() =>
      deriveExpectedWorkMinutes({
        plannedWorkMinutes: 480,
        breakPlan: { plannedBreakMinutes: 540, isPaid: false },
      })
    ).toThrow("BREAK_PLAN_EXCEEDS_PLANNED_WORK");
  });
});