import { describe, expect, it } from "vitest";
import {
  deriveBreakPlanDuration,
  formatBreakMinutesAsDecimalHoursText,
  formatBreakMinutesAsHumanDurationText,
  normalizeBreakPlanCode,
  parseBreakDurationDecimalHoursToMinutes,
} from "../breakPlanDuration";

describe("breakPlanDuration", () => {
  it("normalizes 4-character alphanumeric break plan codes", () => {
    expect(normalizeBreakPlanCode("m001")).toBe("M001");
    expect(normalizeBreakPlanCode(" br01 ")).toBe("BR01");
    expect(normalizeBreakPlanCode("0100")).toBe("0100");
  });

  it("rejects invalid break plan codes", () => {
    expect(() => normalizeBreakPlanCode("")).toThrow("BREAK_PLAN_CODE_REQUIRED");
    expect(() => normalizeBreakPlanCode("M01")).toThrow("BREAK_PLAN_CODE_INVALID_FORMAT");
    expect(() => normalizeBreakPlanCode("M0011")).toThrow("BREAK_PLAN_CODE_INVALID_FORMAT");
    expect(() => normalizeBreakPlanCode("M-01")).toThrow("BREAK_PLAN_CODE_INVALID_FORMAT");
  });

  it("parses mathematical decimal break duration into canonical minutes", () => {
    expect(parseBreakDurationDecimalHoursToMinutes("1")).toBe(60);
    expect(parseBreakDurationDecimalHoursToMinutes("1,00")).toBe(60);
    expect(parseBreakDurationDecimalHoursToMinutes("0,50")).toBe(30);
    expect(parseBreakDurationDecimalHoursToMinutes("0,25")).toBe(15);
    expect(parseBreakDurationDecimalHoursToMinutes("0,75")).toBe(45);
    expect(parseBreakDurationDecimalHoursToMinutes("1,50")).toBe(90);
  });

  it("formats canonical break minutes for UI display", () => {
    expect(formatBreakMinutesAsDecimalHoursText(60)).toBe("1,00");
    expect(formatBreakMinutesAsDecimalHoursText(30)).toBe("0,50");
    expect(formatBreakMinutesAsDecimalHoursText(90)).toBe("1,50");
    expect(formatBreakMinutesAsHumanDurationText(90)).toBe("1 saat 30 dakika");
  });

  it("guards invalid break durations", () => {
    expect(() => parseBreakDurationDecimalHoursToMinutes("")).toThrow("BREAK_DURATION_HOURS_REQUIRED");
    expect(() => parseBreakDurationDecimalHoursToMinutes("0")).toThrow("BREAK_DURATION_HOURS_MUST_BE_POSITIVE");
    expect(() => parseBreakDurationDecimalHoursToMinutes("0,00")).toThrow("BREAK_DURATION_HOURS_MUST_BE_POSITIVE");
    expect(() => parseBreakDurationDecimalHoursToMinutes("12,01")).toThrow("BREAK_DURATION_HOURS_MAX_12_HOURS");
    expect(() => parseBreakDurationDecimalHoursToMinutes("abc")).toThrow("BREAK_DURATION_HOURS_INVALID_FORMAT");
    expect(() => parseBreakDurationDecimalHoursToMinutes("1,123")).toThrow("BREAK_DURATION_HOURS_INVALID_FORMAT");
  });

  it("derives break plan duration master data", () => {
    expect(
      deriveBreakPlanDuration({
        code: "m001",
        name: " Öğle Molası ",
        plannedBreakHours: "1,00",
        isPaid: false,
      })
    ).toMatchObject({
      code: "M001",
      name: "Öğle Molası",
      plannedBreakMinutes: 60,
      plannedBreakHoursText: "1,00",
      plannedBreakHumanText: "1 saat 00 dakika",
      isPaid: false,
    });

    expect(
      deriveBreakPlanDuration({
        code: "P001",
        name: "Ücretli Dinlenme",
        plannedBreakMinutes: 30,
        isPaid: true,
      })
    ).toMatchObject({
      code: "P001",
      plannedBreakMinutes: 30,
      plannedBreakHoursText: "0,50",
      plannedBreakHumanText: "0 saat 30 dakika",
      isPaid: true,
    });
  });

  it("requires break plan name", () => {
    expect(() =>
      deriveBreakPlanDuration({
        code: "M001",
        name: "",
        plannedBreakHours: "1,00",
      })
    ).toThrow("BREAK_PLAN_NAME_REQUIRED");
  });
});