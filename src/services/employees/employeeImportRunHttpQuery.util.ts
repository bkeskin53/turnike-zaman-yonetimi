import { EmployeeImportRunMode, EmployeeImportRunOutcome, EmployeeImportRunStatus } from "@prisma/client";
import { EmployeeImportSheetKind } from "@/src/features/employees/importTemplate";
import { EmployeeImportRunListFilters } from "./employeeImportRunQuery.service";

const EMPLOYEE_IMPORT_RUN_SHEET_KINDS: EmployeeImportSheetKind[] = [
  "ALL_FIELDS",
  "FULL_DATA",
  "PERSONAL_DATA",
  "ORG_DATA",
  "WORK_DATA",
];
const EMPLOYEE_IMPORT_RUN_DUPLICATE_LINKAGES = ["DUPLICATE", "REFERENCE", "ANY_LINKED"] as const;

const IMPORT_RUN_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const IMPORT_RUN_TEXT_FILTER_MAX_LENGTH = 120;

export class EmployeeImportRunQueryParseError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "EmployeeImportRunQueryParseError";
    this.code = code;
  }
}

function normalizeOptionalQueryText(value: string | null): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function parseOptionalTextFilter(value: string | null, code: string, message: string): string | null {
  const text = normalizeOptionalQueryText(value);
  if (!text) return null;
  if (text.length > IMPORT_RUN_TEXT_FILTER_MAX_LENGTH) {
    throw new EmployeeImportRunQueryParseError(code, message);
  }
  return text;
}

function parseOptionalPositiveInteger(value: string | null, code: string, message: string): number | null {
  const text = normalizeOptionalQueryText(value);
  if (!text) return null;

  const num = Number(text);
  if (!Number.isFinite(num) || num < 1) {
    throw new EmployeeImportRunQueryParseError(code, message);
  }

  return Math.floor(num);
}

function parseOptionalMode(value: string | null): EmployeeImportRunMode | null {
  const text = normalizeOptionalQueryText(value)?.toUpperCase();
  if (!text) return null;
  if (text === EmployeeImportRunMode.DRY_RUN) return EmployeeImportRunMode.DRY_RUN;
  if (text === EmployeeImportRunMode.APPLY) return EmployeeImportRunMode.APPLY;
  throw new EmployeeImportRunQueryParseError("INVALID_IMPORT_RUN_MODE", "mode filtresi gecersiz.");
}

function parseOptionalSheetKind(value: string | null): EmployeeImportSheetKind | null {
  const text = normalizeOptionalQueryText(value)?.toUpperCase();
  if (!text) return null;
  if (EMPLOYEE_IMPORT_RUN_SHEET_KINDS.includes(text as EmployeeImportSheetKind)) {
    return text as EmployeeImportSheetKind;
  }
  throw new EmployeeImportRunQueryParseError("INVALID_IMPORT_RUN_SHEET_KIND", "sheetKind filtresi gecersiz.");
}

function parseOptionalStatus(value: string | null): EmployeeImportRunStatus | null {
  const text = normalizeOptionalQueryText(value)?.toUpperCase();
  if (!text) return null;
  if (text === EmployeeImportRunStatus.RUNNING) return EmployeeImportRunStatus.RUNNING;
  if (text === EmployeeImportRunStatus.COMPLETED) return EmployeeImportRunStatus.COMPLETED;
  if (text === EmployeeImportRunStatus.FAILED) return EmployeeImportRunStatus.FAILED;
  throw new EmployeeImportRunQueryParseError("INVALID_IMPORT_RUN_STATUS", "status filtresi gecersiz.");
}

function parseOptionalOutcome(value: string | null): EmployeeImportRunOutcome | null {
  const text = normalizeOptionalQueryText(value)?.toUpperCase();
  if (!text) return null;
  if (text === EmployeeImportRunOutcome.CLEAN) return EmployeeImportRunOutcome.CLEAN;
  if (text === EmployeeImportRunOutcome.WARNING) return EmployeeImportRunOutcome.WARNING;
  if (text === EmployeeImportRunOutcome.BLOCKING) return EmployeeImportRunOutcome.BLOCKING;
  if (text === EmployeeImportRunOutcome.PARTIAL) return EmployeeImportRunOutcome.PARTIAL;
  throw new EmployeeImportRunQueryParseError("INVALID_IMPORT_RUN_OUTCOME", "outcome filtresi gecersiz.");
}

function parseOptionalDuplicateLinkage(value: string | null): "DUPLICATE" | "REFERENCE" | "ANY_LINKED" | null {
  const text = normalizeOptionalQueryText(value)?.toUpperCase();
  if (!text) return null;
  if ((EMPLOYEE_IMPORT_RUN_DUPLICATE_LINKAGES as readonly string[]).includes(text)) {
    return text as "DUPLICATE" | "REFERENCE" | "ANY_LINKED";
  }
  throw new EmployeeImportRunQueryParseError(
    "INVALID_IMPORT_RUN_DUPLICATE_LINKAGE",
    "duplicateLinkage filtresi gecersiz.",
  );
}

function parseOptionalStartedAtBoundary(value: string | null, boundary: "start" | "end"): Date | null {
  const text = normalizeOptionalQueryText(value);
  if (!text) return null;

  const isoText = IMPORT_RUN_DATE_ONLY_PATTERN.test(text)
    ? `${text}T${boundary === "start" ? "00:00:00.000" : "23:59:59.999"}Z`
    : text;
  const date = new Date(isoText);

  if (Number.isNaN(date.getTime())) {
    throw new EmployeeImportRunQueryParseError(
      boundary === "start" ? "INVALID_IMPORT_RUN_STARTED_AT_FROM" : "INVALID_IMPORT_RUN_STARTED_AT_TO",
      boundary === "start" ? "startedAtFrom filtresi gecersiz." : "startedAtTo filtresi gecersiz.",
    );
  }

  return date;
}

export function parseEmployeeImportRunListFilters(searchParams: URLSearchParams): EmployeeImportRunListFilters {
  const startedAtFrom = parseOptionalStartedAtBoundary(searchParams.get("startedAtFrom"), "start");
  const startedAtTo = parseOptionalStartedAtBoundary(searchParams.get("startedAtTo"), "end");

  if (startedAtFrom && startedAtTo && startedAtFrom.getTime() > startedAtTo.getTime()) {
    throw new EmployeeImportRunQueryParseError(
      "INVALID_IMPORT_RUN_DATE_RANGE",
      "startedAtFrom filtresi startedAtTo filtresinden buyuk olamaz.",
    );
  }

  return {
    runId: parseOptionalTextFilter(searchParams.get("runId"), "INVALID_IMPORT_RUN_SEARCH_RUN_ID", "runId filtresi cok uzun."),
    actor: parseOptionalTextFilter(searchParams.get("actor"), "INVALID_IMPORT_RUN_SEARCH_ACTOR", "actor filtresi cok uzun."),
    employeeCode: parseOptionalTextFilter(
      searchParams.get("employeeCode"),
      "INVALID_IMPORT_RUN_SEARCH_EMPLOYEE_CODE",
      "employeeCode filtresi cok uzun.",
    ),
    mode: parseOptionalMode(searchParams.get("mode")),
    sheetKind: parseOptionalSheetKind(searchParams.get("sheetKind")),
    status: parseOptionalStatus(searchParams.get("status")),
    outcome: parseOptionalOutcome(searchParams.get("outcome")),
    duplicateLinkage: parseOptionalDuplicateLinkage(searchParams.get("duplicateLinkage")),
    startedAtFrom,
    startedAtTo,
    page: parseOptionalPositiveInteger(searchParams.get("page"), "INVALID_IMPORT_RUN_PAGE", "page filtresi gecersiz."),
    limit: parseOptionalPositiveInteger(
      searchParams.get("limit"),
      "INVALID_IMPORT_RUN_LIMIT",
      "limit filtresi gecersiz.",
    ),
  };
}

export function parseEmployeeImportRunId(value: unknown): string {
  const id = String(value ?? "").trim();
  if (!id) {
    throw new EmployeeImportRunQueryParseError("INVALID_IMPORT_RUN_ID", "runId zorunludur.");
  }
  return id;
}
