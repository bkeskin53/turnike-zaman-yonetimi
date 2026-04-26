import {
  EmployeeImportFieldKey,
  EmployeeImportSheetKind,
  getEmployeeImportSheet,
  normalizeEmployeeImportHeader,
} from "@/src/features/employees/importTemplate";
import { parseCsvText } from "@/src/utils/csv";
import { isISODate } from "@/src/utils/dayKey";

export type EmployeeImportValidationIssue = {
  line: number;
  employeeCode?: string;
  code: string;
  message: string;
  field?: EmployeeImportFieldKey;
  value?: string;
};

export type EmployeeImportPreviewRow = {
  line: number;
  employeeCode: string;
  cardNo: string;
  scopeStartDate: string;
  scopeEndDate: string | null;
  values: Partial<Record<EmployeeImportFieldKey, string | null>>;
};

export type EmployeeImportHeaderSummary = {
  receivedHeaders: string[];
  missingRequiredHeaders: EmployeeImportFieldKey[];
  unknownHeaders: string[];
  duplicateHeaders: string[];
  emptyHeaderIndexes: number[];
};

export type EmployeeImportValidationTotals = {
  rows: number;
  unique: number;
  valid: number;
  invalid: number;
  empty: number;
};

export type EmployeeImportCodeResolutionBucket = {
  provided: number;
  resolved: number;
  missing: number;
  inactive: number;
  mismatchedGroup: number;
};

export type EmployeeImportCodeResolutionSummary = {
  branch: EmployeeImportCodeResolutionBucket;
  employeeGroup: EmployeeImportCodeResolutionBucket;
  employeeSubgroup: EmployeeImportCodeResolutionBucket;
  workSchedulePattern: EmployeeImportCodeResolutionBucket;
};

export type EmployeeImportValidationResult = {
  ok: boolean;
  dryRun: true;
  applyEnabled: boolean;
  sheetKind: EmployeeImportSheetKind;
  sheetTitle: string;
  isTemplateValid: boolean;
  canProceedToNextPhase: boolean;
  totals: EmployeeImportValidationTotals;
  headerSummary: EmployeeImportHeaderSummary;
  errors: EmployeeImportValidationIssue[];
  warnings: EmployeeImportValidationIssue[];
  previewRows: EmployeeImportPreviewRow[];
  codeResolutionSummary?: EmployeeImportCodeResolutionSummary;
  message: string;
};

export type EmployeeImportValidatedTable = EmployeeImportValidationResult & {
  validRows: EmployeeImportPreviewRow[];
};

function issue(line: number, code: string, message: string, opts?: Partial<EmployeeImportValidationIssue>): EmployeeImportValidationIssue {
  return {
    line,
    code,
    message,
    employeeCode: opts?.employeeCode,
    field: opts?.field,
    value: opts?.value,
  };
}

function isValidIsoDayKey(value: string): boolean {
  if (!isISODate(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === value;
}

function isRowEmpty(row: string[]): boolean {
  return row.every((cell) => !String(cell ?? "").trim());
}

function readCell(row: string[], headerLookup: Map<EmployeeImportFieldKey, number>, key: EmployeeImportFieldKey): string {
  const idx = headerLookup.get(key);
  if (idx === undefined || idx < 0) return "";
  return String(row[idx] ?? "").trim();
}

function normalizeEmploymentAction(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

export function validateEmployeeImportHeaders(sheetKind: EmployeeImportSheetKind, rawHeader: string[]): {
  summary: EmployeeImportHeaderSummary;
  normalizedHeaderKeys: string[];
  headerLookup: Map<EmployeeImportFieldKey, number>;
} {
  const sheet = getEmployeeImportSheet(sheetKind);
  const receivedHeaders = rawHeader.map((cell) => String(cell ?? "").trim());
  const normalizedHeaderKeys = receivedHeaders.map((cell) => normalizeEmployeeImportHeader(cell));
  const allowedHeaderKeys = new Set(sheet.headers.map((item) => normalizeEmployeeImportHeader(item)));

  const emptyHeaderIndexes: number[] = [];
  const duplicateHeaders: string[] = [];
  const duplicateSet = new Set<string>();
  const seen = new Set<string>();
  const unknownHeaders: string[] = [];

  normalizedHeaderKeys.forEach((key, idx) => {
    const original = receivedHeaders[idx] || `col_${idx + 1}`;
    if (!key) {
      emptyHeaderIndexes.push(idx + 1);
      return;
    }
    if (!allowedHeaderKeys.has(key)) {
      unknownHeaders.push(original);
      return;
    }
    if (seen.has(key)) {
      if (!duplicateSet.has(original)) {
        duplicateHeaders.push(original);
        duplicateSet.add(original);
      }
      return;
    }
    seen.add(key);
  });

  const missingRequiredHeaders = sheet.required.filter((key) => !seen.has(normalizeEmployeeImportHeader(key)));
  const headerLookup = new Map<EmployeeImportFieldKey, number>();
  sheet.headers.forEach((field) => {
    const idx = normalizedHeaderKeys.findIndex((item) => item === normalizeEmployeeImportHeader(field));
    if (idx >= 0) headerLookup.set(field, idx);
  });

  const summary: EmployeeImportHeaderSummary = {
    receivedHeaders,
    missingRequiredHeaders,
    unknownHeaders,
    duplicateHeaders,
    emptyHeaderIndexes,
  };

  return { summary, normalizedHeaderKeys, headerLookup };
}

export function validateEmployeeImportTable(params: {
  csvText: string;
  sheetKind: EmployeeImportSheetKind;
}): EmployeeImportValidatedTable {
  const { csvText, sheetKind } = params;
  const sheet = getEmployeeImportSheet(sheetKind);
  const { rows } = parseCsvText(csvText);
  const rawHeader = rows[0].map((cell) => String(cell ?? "").trim());
  const { summary: headerSummary, headerLookup } = validateEmployeeImportHeaders(sheetKind, rawHeader);

  const errors: EmployeeImportValidationIssue[] = [];
  const warnings: EmployeeImportValidationIssue[] = [];
  const previewRows: EmployeeImportPreviewRow[] = [];
  const validRows: EmployeeImportPreviewRow[] = [];
  const dedupeKeys = new Set<string>();
  let validCount = 0;
  let invalidCount = 0;
  let emptyCount = 0;
  let rowCount = 0;

  if (headerSummary.emptyHeaderIndexes.length > 0) {
    errors.push(
      issue(1, "EMPTY_HEADERS", `Başlık satırında boş kolon(lar) var: ${headerSummary.emptyHeaderIndexes.map((n) => `#${n}`).join(", ")}`)
    );
  }
  if (headerSummary.duplicateHeaders.length > 0) {
    errors.push(
      issue(1, "DUPLICATE_HEADERS", `Bu tab için yinelenen kolon(lar) bulundu: ${headerSummary.duplicateHeaders.join(", ")}`)
    );
  }
  if (headerSummary.unknownHeaders.length > 0) {
    errors.push(
      issue(1, "UNKNOWN_HEADERS", `Bu tab için tanımsız kolon(lar) bulundu: ${headerSummary.unknownHeaders.join(", ")}`)
    );
  }
  if (headerSummary.missingRequiredHeaders.length > 0) {
    errors.push(
      issue(1, "MISSING_REQUIRED_HEADERS", `Bu tab için zorunlu kolon(lar) eksik: ${headerSummary.missingRequiredHeaders.join(", ")}`)
    );
  }

  const dataRows = rows.slice(1);

  for (let index = 0; index < dataRows.length; index++) {
    const row = dataRows[index].map((cell) => String(cell ?? ""));
    if (isRowEmpty(row)) {
      emptyCount += 1;
      continue;
    }

    rowCount += 1;
    const line = index + 2;
    const values: Partial<Record<EmployeeImportFieldKey, string | null>> = {};
    for (const field of sheet.headers) {
      const rawValue = readCell(row, headerLookup, field);
      values[field] = rawValue ? rawValue : null;
    }

    if (row.length > rawHeader.length) {
      const trailing = row.slice(rawHeader.length).some((cell) => String(cell ?? "").trim());
      if (trailing) {
        errors.push(
          issue(line, "ROW_HAS_EXTRA_COLUMNS", "Satırda header sözleşmesinin dışında ekstra kolon verisi bulundu.")
        );
        invalidCount += 1;
        continue;
      }
    }

    const employeeCode = String(values.employeeCode ?? "").trim();
    const cardNo = String(values.cardNo ?? "").trim();
    const scopeStartDate = String(values.scopeStartDate ?? "").trim();
    const scopeEndDate = String(values.scopeEndDate ?? "").trim() || null;
    const employeeCodeForIssue = employeeCode || undefined;
    const rowErrors: EmployeeImportValidationIssue[] = [];

    for (const requiredField of sheet.required) {
      const rawValue = String(values[requiredField] ?? "").trim();
      if (!rawValue) {
        rowErrors.push(
          issue(line, `MISSING_${requiredField.toUpperCase()}`, `${requiredField} alanı zorunludur.`, {
            employeeCode: employeeCodeForIssue,
            field: requiredField,
          })
        );
      }
    }

    const dateFields: EmployeeImportFieldKey[] = ["scopeStartDate", "scopeEndDate", "hireDate", "terminationDate"];
    for (const field of dateFields) {
      const rawValue = String(values[field] ?? "").trim();
      if (!rawValue) continue;
      if (!isValidIsoDayKey(rawValue)) {
        rowErrors.push(
          issue(line, `INVALID_${field.toUpperCase()}`, `${field} ISO formatında olmalıdır (YYYY-MM-DD).`, {
            employeeCode: employeeCodeForIssue,
            field,
            value: rawValue,
          })
        );
      }
    }

    const hireDate = String(values.hireDate ?? "").trim();
    const terminationDate = String(values.terminationDate ?? "").trim();
    const employmentAction = normalizeEmploymentAction(values.employmentAction);
    if (scopeStartDate && scopeEndDate && scopeEndDate < scopeStartDate) {
      rowErrors.push(
        issue(line, "SCOPE_END_BEFORE_START", "scopeEndDate, scopeStartDate tarihinden önce olamaz.", {
          employeeCode: employeeCodeForIssue,
          field: "scopeEndDate",
          value: scopeEndDate,
        })
      );
    }
    if (hireDate && terminationDate && terminationDate < hireDate) {
      rowErrors.push(
        issue(line, "TERMINATION_BEFORE_HIRE", "terminationDate, hireDate tarihinden önce olamaz.", {
          employeeCode: employeeCodeForIssue,
          field: "terminationDate",
          value: terminationDate,
        })
      );
    }

    if (employmentAction && !["HIRE", "TERMINATE", "REHIRE"].includes(employmentAction)) {
      rowErrors.push(
        issue(
          line,
          "INVALID_EMPLOYMENT_ACTION",
          "employmentAction yalnizca HIRE / TERMINATE / REHIRE olabilir.",
          {
            employeeCode: employeeCodeForIssue,
            field: "employmentAction",
            value: employmentAction,
          }
        )
      );
    }

    const email = String(values.email ?? "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      warnings.push(
        issue(line, "INVALID_EMAIL_FORMAT", "E-posta biçimi geçersiz görünüyor.", {
          employeeCode: employeeCodeForIssue,
          field: "email",
          value: email,
        })
      );
    }

    const gender = String(values.gender ?? "").trim();
    if (gender && !["MALE", "FEMALE", "M", "F", "ERKEK", "KADIN"].includes(gender.toUpperCase())) {
      warnings.push(
        issue(line, "UNKNOWN_GENDER_VALUE", "Cinsiyet değeri tanımsız görünüyor. Sonraki patchte stricter validation gelecek.", {
          employeeCode: employeeCodeForIssue,
          field: "gender",
          value: gender,
        })
      );
    }

    const dedupeKey = `${employeeCode}__${cardNo}__${scopeStartDate}__${scopeEndDate ?? ""}`;
    if (employeeCode && cardNo && scopeStartDate) {
      if (dedupeKeys.has(dedupeKey)) {
        rowErrors.push(
          issue(line, "DUPLICATE_SCOPE_ROW", "Aynı Sicil + Kart ID + kapsam başlangıç/bitiş kombinasyonu birden fazla kez gönderilmiş.", {
            employeeCode: employeeCodeForIssue,
          })
        );
      } else {
        dedupeKeys.add(dedupeKey);
      }
    }

    if (rowErrors.length > 0) {
      invalidCount += 1;
      errors.push(...rowErrors);
      continue;
    }

    validCount += 1;
    const normalizedRow: EmployeeImportPreviewRow = {
      line,
      employeeCode,
      cardNo,
      scopeStartDate,
      scopeEndDate,
      values,
    };
    validRows.push(normalizedRow);
    if (previewRows.length < 25) {
      previewRows.push(normalizedRow);
    }
  }

  if (rowCount === 0) {
    errors.push(issue(1, "NO_DATA_ROWS", "Header satırı dışında işlenecek veri satırı bulunamadı."));
  }

  const result: EmployeeImportValidatedTable = {
    ok: errors.length === 0,
    dryRun: true,
    applyEnabled: false,
    sheetKind,
    sheetTitle: sheet.title,
    isTemplateValid:
      headerSummary.missingRequiredHeaders.length === 0 &&
      headerSummary.unknownHeaders.length === 0 &&
      headerSummary.duplicateHeaders.length === 0 &&
      headerSummary.emptyHeaderIndexes.length === 0,
    canProceedToNextPhase: errors.length === 0,
    totals: {
      rows: rowCount,
      unique: dedupeKeys.size,
      valid: validCount,
      invalid: invalidCount,
      empty: emptyCount,
    },
    headerSummary,
    errors,
    warnings,
    previewRows,
    validRows,
    message:
      "Sablon yapisi dogrulandi. Baslik sozlesmesi, zorunlu alanlar ve temel tarih kontrolleri tamamlandi.",
  };

  return result;
}

export function buildEmployeeImportValidationPreview(params: {
  csvText: string;
  sheetKind: EmployeeImportSheetKind;
}): EmployeeImportValidationResult {
  const result = validateEmployeeImportTable(params);
  const { validRows, ...publicResult } = result;
  void validRows;
  return publicResult;
}

