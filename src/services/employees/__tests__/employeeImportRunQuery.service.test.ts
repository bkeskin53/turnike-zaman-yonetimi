import { EmployeeImportRunMode, EmployeeImportRunOutcome, EmployeeImportRunStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildEmployeeImportRunWhere,
  coerceEmployeeImportRunIssuePreviewList,
  normalizeEmployeeImportRunEmployeeCodeSearchValue,
  normalizeEmployeeImportRunSearchText,
  normalizeEmployeeImportRunListLimit,
  normalizeEmployeeImportRunListPage,
} from "../employeeImportRunQuery.service";

describe("employeeImportRunQuery.service", () => {
  it("normalizes invalid and fractional pages to a safe positive integer", () => {
    expect(normalizeEmployeeImportRunListPage(null)).toBe(1);
    expect(normalizeEmployeeImportRunListPage(0)).toBe(1);
    expect(normalizeEmployeeImportRunListPage(-3)).toBe(1);
    expect(normalizeEmployeeImportRunListPage(2.9)).toBe(2);
  });

  it("normalizes limits to defaults and caps them at the max page size", () => {
    expect(normalizeEmployeeImportRunListLimit(null)).toBe(20);
    expect(normalizeEmployeeImportRunListLimit(0)).toBe(20);
    expect(normalizeEmployeeImportRunListLimit(12.8)).toBe(12);
    expect(normalizeEmployeeImportRunListLimit(999)).toBe(100);
  });

  it("returns an empty issue preview list for non-array JSON values", () => {
    expect(coerceEmployeeImportRunIssuePreviewList(null)).toEqual([]);
    expect(coerceEmployeeImportRunIssuePreviewList("scalar")).toEqual([]);
    expect(coerceEmployeeImportRunIssuePreviewList({ code: "NOT_ARRAY" })).toEqual([]);
  });

  it("coerces issue preview arrays with safe defaults", () => {
    const previews = coerceEmployeeImportRunIssuePreviewList([
      {
        line: 4,
        employeeCode: "EMP-001",
        code: "SUBGROUP_MISMATCH",
        message: "Subgroup mismatch",
        field: "employeeSubgroupCode",
        value: "ALT",
      },
      {
        line: "bad",
        employeeCode: 123,
      },
      "scalar",
    ]);

    expect(previews).toEqual([
      {
        line: 4,
        employeeCode: "EM***01",
        code: "SUBGROUP_MISMATCH",
        message: "Subgroup mismatch",
        field: "employeeSubgroupCode",
        value: "ALT",
      },
      {
        line: 0,
        employeeCode: null,
        code: "UNKNOWN",
        message: null,
        field: null,
        value: null,
      },
      {
        line: 0,
        employeeCode: null,
        code: "UNKNOWN",
        message: null,
        field: null,
        value: null,
      },
    ]);
  });

  it("builds a minimal where clause when no filters are provided", () => {
    expect(
      buildEmployeeImportRunWhere({
        companyId: "company_1",
      }),
    ).toEqual({
      companyId: "company_1",
    });
  });

  it("builds a bounded where clause for list filters", () => {
    const startedAtFrom = new Date("2026-04-01T00:00:00.000Z");
    const startedAtTo = new Date("2026-04-08T23:59:59.999Z");

    expect(
      buildEmployeeImportRunWhere({
        companyId: "company_1",
        filters: {
          runId: "run_123",
          actor: "ops@example.com",
          employeeCode: "EMP-001",
          mode: EmployeeImportRunMode.APPLY,
          sheetKind: "FULL_DATA",
          status: EmployeeImportRunStatus.COMPLETED,
          outcome: EmployeeImportRunOutcome.PARTIAL,
          duplicateLinkage: "ANY_LINKED",
          startedAtFrom,
          startedAtTo,
        },
        actorUserIds: ["user_ops_1", "user_ops_2"],
        employeeCodeMasked: "EM***01",
      }),
    ).toEqual({
      AND: [
        { companyId: "company_1" },
        { id: { contains: "run_123" } },
        { actorUserId: { in: ["user_ops_1", "user_ops_2"] } },
        { changedEmployeeCodesPreview: { has: "EM***01" } },
        { mode: EmployeeImportRunMode.APPLY },
        { sheetKind: "FULL_DATA" },
        { status: EmployeeImportRunStatus.COMPLETED },
        { outcome: EmployeeImportRunOutcome.PARTIAL },
        {
          OR: [{ duplicateOfRunId: { not: null } }, { duplicateRuns: { some: {} } }],
        },
        {
          startedAt: {
            gte: startedAtFrom,
            lte: startedAtTo,
          },
        },
      ],
    });
  });

  it("normalizes bounded free-text search values", () => {
    expect(normalizeEmployeeImportRunSearchText("  run_123  ")).toBe("run_123");
    expect(normalizeEmployeeImportRunSearchText("   ")).toBeNull();
    expect(normalizeEmployeeImportRunEmployeeCodeSearchValue("EMP-001")).toBe("EM***01");
  });
});
