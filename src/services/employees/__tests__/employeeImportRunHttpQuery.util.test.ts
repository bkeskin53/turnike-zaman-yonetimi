import { EmployeeImportRunMode, EmployeeImportRunOutcome, EmployeeImportRunStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  EmployeeImportRunQueryParseError,
  parseEmployeeImportRunId,
  parseEmployeeImportRunListFilters,
} from "../employeeImportRunHttpQuery.util";

function expectParseError(fn: () => unknown, code: string) {
  try {
    fn();
    throw new Error(`Expected parse error ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(EmployeeImportRunQueryParseError);
    expect((error as EmployeeImportRunQueryParseError).code).toBe(code);
  }
}

describe("employeeImportRunHttpQuery.util", () => {
  it("parses valid list filters and expands date-only boundaries", () => {
    const filters = parseEmployeeImportRunListFilters(
      new URLSearchParams({
        runId: "run_123",
        actor: "ops@example.com",
        employeeCode: "EMP-001",
        mode: EmployeeImportRunMode.APPLY,
        sheetKind: "FULL_DATA",
        status: EmployeeImportRunStatus.COMPLETED,
        outcome: EmployeeImportRunOutcome.PARTIAL,
        duplicateLinkage: "ANY_LINKED",
        startedAtFrom: "2026-04-01",
        startedAtTo: "2026-04-08",
        page: "3",
        limit: "75",
      }),
    );

    expect(filters).toEqual({
      runId: "run_123",
      actor: "ops@example.com",
      employeeCode: "EMP-001",
      mode: EmployeeImportRunMode.APPLY,
      sheetKind: "FULL_DATA",
      status: EmployeeImportRunStatus.COMPLETED,
      outcome: EmployeeImportRunOutcome.PARTIAL,
      duplicateLinkage: "ANY_LINKED",
      startedAtFrom: new Date("2026-04-01T00:00:00.000Z"),
      startedAtTo: new Date("2026-04-08T23:59:59.999Z"),
      page: 3,
      limit: 75,
    });
  });

  it("rejects invalid mode filters with a stable parse error", () => {
    expectParseError(
      () =>
      parseEmployeeImportRunListFilters(
        new URLSearchParams({
          mode: "IMPORT",
        }),
      ),
      "INVALID_IMPORT_RUN_MODE",
    );
  });

  it("rejects invalid startedAt ranges", () => {
    expectParseError(
      () =>
      parseEmployeeImportRunListFilters(
        new URLSearchParams({
          startedAtFrom: "2026-04-09",
          startedAtTo: "2026-04-08",
        }),
      ),
      "INVALID_IMPORT_RUN_DATE_RANGE",
    );
  });

  it("rejects invalid duplicate linkage filters", () => {
    expectParseError(
      () =>
        parseEmployeeImportRunListFilters(
          new URLSearchParams({
            duplicateLinkage: "LINKED",
          }),
        ),
      "INVALID_IMPORT_RUN_DUPLICATE_LINKAGE",
    );
  });

  it("parses and trims non-empty run ids", () => {
    expect(parseEmployeeImportRunId("  run_123  ")).toBe("run_123");
  });

  it("rejects empty run ids", () => {
    expectParseError(() => parseEmployeeImportRunId("   "), "INVALID_IMPORT_RUN_ID");
  });
});
