import { DateTime } from "luxon";
import { prisma } from "@/src/repositories/prisma";
import { buildShiftSignature, computeWeekStartUTC } from "@/src/services/shiftPlan.service";
import { upsertWeeklyShiftPlan } from "@/src/repositories/shiftPlan.repo";


export type ShiftImportMode = "merge_days" | "skip_existing_days";
export type ShiftImportLayoutType = "ROW" | "GRID_DATE_COLUMNS";
export type ShiftImportSourceType = "text" | "csv" | "xlsx";

export type ShiftImportField = "employeeCode" | "date" | "shiftCode";
export type ShiftImportGridField = "employeeCodeColumn" | "employeeNameColumn";

export type ShiftImportRowMapping = {
  employeeCode: string;
  date: string;
  shiftCode: string;
};

export type ShiftImportGridDateColumnsMapping = {
  employeeCodeColumn: string;
  employeeNameColumn?: string;
  dateHeaderRow?: number;
  dataStartRow?: number;
  firstDateColumn?: string;
};

export type ShiftImportMapping =
  | ShiftImportRowMapping
  | ShiftImportGridDateColumnsMapping;

export type ShiftImportParseOptions = {
  layoutType?: ShiftImportLayoutType;
  mapping?: Partial<ShiftImportMapping>;
};

export type GridCellRef = {
  sourceRowIndex?: number;
  sourceColumnIndex?: number;
  sourceCellRef?: string;
  sourceSheetName?: string;
};

export type CanonicalImportRow = GridCellRef & {
  line: number;
  employeeCode: string;
  date: string;
  shiftCode: string;
  layoutType: ShiftImportLayoutType;
 };

export type ImportRow = CanonicalImportRow;

export type ShiftResolutionSource =
  | "SHIFT_CODE_EXACT"
  | "SHIFT_SIGNATURE_EXACT"
  | "SHIFT_IMPORT_ALIAS"
  | "SHIFT_TEXT_NORMALIZED"
  | "SHIFT_TIME_PARSED";

export type ShiftImportAliasInput = {
  sourceValue: string;
  shiftTemplateId: string;
  persist?: boolean;
};

export type PreviewRow = ImportRow & {
  sourceRowIndex?: number;
  sourceColumnIndex?: number;
  sourceCellRef?: string;
  sourceSheetName?: string;
  layoutType: ShiftImportLayoutType;
  employeeId?: string;
  shiftTemplateId?: string;
  employeeName?: string;
  shiftSignature?: string;
  weekStart?: string;
  normalizedShiftCode?: string;
  parsedShiftSignature?: string;
  suggestedAction?:
    | "REVIEW_ALIAS"
    | "CREATE_TEMPLATE"
    | "CHECK_SHIFT_TEXT"
    | "FIX_REQUIRED_FIELDS"
    | "CHECK_EMPLOYEE";
  suggestedTemplateLabel?: string;
  suggestedReason?: string;
  resolutionSource?: ShiftResolutionSource;
  status: "VALID" | "WARNING" | "SKIPPED" | "ERROR";
  message?: string;
};

export type PreviewTotals = {
  total: number;
  valid: number;
  warnings: number;
  skipped: number;
  errors: number;
  touchedEmployees: number;
  touchedWeeks: number;
};

export type PreviewShiftImportResult = {
  rows: PreviewRow[];
  totals: PreviewTotals;
  mode: ShiftImportMode;
};

export type ApplyShiftImportResult = {
  applied: number;
  touchedEmployees: number;
  touchedWeeks: number;
  startDayKey: string | null;
  endDayKey: string | null;
  totals: PreviewTotals;
  mode: ShiftImportMode;
};

export type ShiftImportHeadersResult = {
  headers: string[];
  suggestedMapping: Partial<ShiftImportRowMapping>;
  detectedLayoutType?: ShiftImportLayoutType;
  gridDateColumns?: string[];
};

function normalizeText(input: string) {
  return String(input ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function toExcelColumnName(index: number) {
  let n = index + 1;
  let result = "";

  while (n > 0) {
    const mod = (n - 1) % 26;
    result = String.fromCharCode(65 + mod) + result;
    n = Math.floor((n - mod) / 26);
  }

  return result;
}

function buildCellRef(rowIndex: number, columnIndex: number) {
  return `${toExcelColumnName(columnIndex)}${rowIndex + 1}`;
}

function normalizePositiveIndex(input: unknown, fallback: number) {
  const value = Number(input);
  if (!Number.isFinite(value)) return fallback;
  if (value < 0) return fallback;
  return Math.floor(value);
}

function isRowMapping(mapping?: Partial<ShiftImportMapping>): mapping is Partial<ShiftImportRowMapping> {
  if (!mapping) return true;
  return "date" in mapping || "shiftCode" in mapping || "employeeCode" in mapping;
}

function isGridDateColumnsMapping(
  mapping?: Partial<ShiftImportMapping>
): mapping is Partial<ShiftImportGridDateColumnsMapping> {
  if (!mapping) return false;
  return "employeeCodeColumn" in mapping || "dateHeaderRow" in mapping || "firstDateColumn" in mapping;
}

function normalizeColumnSelector(value: string) {
  return String(value ?? "").trim();
}

function resolveColumnIndex(headers: string[], selector?: string) {
  const raw = normalizeColumnSelector(selector ?? "");
  if (!raw) return -1;

  const byExact = headers.findIndex((h) => h === raw);
  if (byExact >= 0) return byExact;

  const normalizedRaw = normalizeHeaderKey(raw);
  const byNormalized = headers.findIndex((h) => normalizeHeaderKey(h) === normalizedRaw);
  if (byNormalized >= 0) return byNormalized;

  if (/^[A-Za-z]+$/.test(raw)) {
    const upper = raw.toUpperCase();
    let result = 0;
    for (let i = 0; i < upper.length; i++) {
      result = result * 26 + (upper.charCodeAt(i) - 64);
    }
    return result - 1;
  }

  return -1;
}

function isLikelyIsoDate(value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return false;
  return DateTime.fromISO(raw).isValid;
}

function extractDateLikeToken(value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const directIso = raw.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (directIso) return directIso[0];

  const dotted = raw.match(/\b\d{1,2}[./-]\d{1,2}[./-](?:\d{2}|\d{4})\b/);
  if (dotted) return dotted[0];

  return raw;
}

function tryParseHeaderDate(value: string): string | null {
  const raw = extractDateLikeToken(value);
  if (!raw) return null;

  if (DateTime.fromISO(raw).isValid) {
    return DateTime.fromISO(raw).toISODate();
  }

  const formats = [
    "d.M.yyyy",
    "dd.MM.yyyy",
    "d/M/yyyy",
    "dd/MM/yyyy",
    "d-M-yyyy",
    "dd-MM-yyyy",
    "d.M.yy",
    "dd.MM.yy",
  ];

  for (const fmt of formats) {
    const dt = DateTime.fromFormat(raw, fmt);
    if (dt.isValid) return dt.toISODate();
  }

  return null;
}

function detectDelimiter(headerLine: string): "," | ";" | "\t" {
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const semiCount = (headerLine.match(/;/g) ?? []).length;
  const tabCount = (headerLine.match(/\t/g) ?? []).length;

  if (tabCount > semiCount && tabCount > commaCount) return "\t";
  if (semiCount > commaCount) return ";";
  return ",";
}

function splitCsvLine(line: string, delimiter: "," | ";" | "\t"): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  cells.push(current.trim());
  return cells;
}

function normalizeHeaderKey(key: string) {
  return String(key ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "")
    .replace(/-/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function normalizeShiftLookupKey(value: string) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\u00A0/g, " ")
    .replace(/[–—−]/g, "-")
    .replace(/[()]/g, "")
    .replace(/\s+/g, "")
    .replace(/İ/g, "I")
    .replace(/İ/g, "I")
    .replace(/Ş/g, "S")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/ı/g, "I")
    .replace(/ş/g, "S")
    .replace(/ğ/g, "G")
    .replace(/ü/g, "U")
    .replace(/ö/g, "O")
    .replace(/ç/g, "C");
}

function normalizeTimeToken(token: string): string | null {
  const raw = String(token ?? "").trim();
  if (!raw) return null;

  const compact = raw.replace(/\s+/g, "");

  if (/^\d{1,2}$/.test(compact)) {
    const hh = Number(compact);
    if (hh < 0 || hh > 23) return null;
    return `${String(hh).padStart(2, "0")}:00`;
  }

  if (/^\d{3}$/.test(compact)) {
    const hh = Number(compact.slice(0, 1));
    const mm = Number(compact.slice(1));
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  if (/^\d{4}$/.test(compact)) {
    const hh = Number(compact.slice(0, 2));
    const mm = Number(compact.slice(2));
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  const normalized = compact.replace(/\./g, ":");
  const m = normalized.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;

  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;

  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function normalizeImportedDate(value: string): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  if (DateTime.fromISO(raw).isValid) {
    return DateTime.fromISO(raw).toISODate();
  }

  const formats = ["d.M.yyyy", "dd.MM.yyyy", "d/M/yyyy", "dd/MM/yyyy", "d-M-yyyy", "dd-MM-yyyy"];
  for (const fmt of formats) {
    const dt = DateTime.fromFormat(raw, fmt);
    if (dt.isValid) return dt.toISODate();
  }

  return null;
}

function tryParseShiftSignature(value: string): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const normalized = normalizeShiftLookupKey(raw);

  if (
    normalized === "OFF" ||
    normalized === "OFFDAY" ||
    normalized === "TATIL" ||
    normalized === "ISTIRAHAT"
  ) {
    return "OFF";
  }

  const compact = raw
    .replace(/[–—−]/g, "-")
    .replace(/\u00A0/g, " ")
    .trim();

  const rangeMatch = compact.match(
    /(\d{1,4}(?::\d{1,2})?|\d{1,2}\.\d{1,2}|\d{1,2})\s*(?:-|\/|→|>|TO|to)\s*(\d{1,4}(?::\d{1,2})?|\d{1,2}\.\d{1,2}|\d{1,2})/
  );

  if (!rangeMatch) return null;

  const startTime = normalizeTimeToken(rangeMatch[1]);
  const endTime = normalizeTimeToken(rangeMatch[2]);
  if (!startTime || !endTime) return null;

  return buildShiftSignature(startTime, endTime).signature;
}

function buildShiftResolutionLabel(source?: ShiftResolutionSource) {
  switch (source) {
    case "SHIFT_CODE_EXACT":
      return "shiftCode";
    case "SHIFT_SIGNATURE_EXACT":
      return "signature";
    case "SHIFT_IMPORT_ALIAS":
      return "alias";
    case "SHIFT_TEXT_NORMALIZED":
      return "normalize";
    case "SHIFT_TIME_PARSED":
      return "saat-parse";
    default:
      return null;
  }
}

function buildRequiredFieldsSuggestion() {
  return {
    suggestedAction: "FIX_REQUIRED_FIELDS" as const,
    suggestedTemplateLabel: undefined,
    suggestedReason: "employeeCode, date ve shiftCode alanları zorunludur.",
  };
}

function buildInvalidDateSuggestion() {
  return {
    suggestedAction: "FIX_REQUIRED_FIELDS" as const,
    suggestedTemplateLabel: undefined,
    suggestedReason: "Tarih formatı YYYY-MM-DD olmalıdır.",
  };
}

function buildMissingEmployeeSuggestion(employeeCode: string) {
  const raw = String(employeeCode ?? "").trim();
  return {
    suggestedAction: "CHECK_EMPLOYEE" as const,
    suggestedTemplateLabel: raw || undefined,
    suggestedReason: raw
      ? `Bu employeeCode sistemde bulunamadı: ${raw}`
      : "employeeCode bulunamadı veya boş geldi.",
  };
}

function buildShiftSuggestion(input: {
  rawShiftCode: string;
  parsedShiftSignature?: string;
}) {
  const raw = String(input.rawShiftCode ?? "").trim();
  const normalized = normalizeShiftLookupKey(raw);

  if (input.parsedShiftSignature) {
    return {
      suggestedAction: "CREATE_TEMPLATE" as const,
      suggestedTemplateLabel: input.parsedShiftSignature,
      suggestedReason: `Saat formatı tanındı. Bu imzaya uygun bir vardiya şablonu açılabilir: ${input.parsedShiftSignature}`,
    };
  }

  if (
    normalized === "GECE" ||
    normalized === "GUNDUZ" ||
    normalized === "SABAH" ||
    normalized === "AKSAM" ||
    normalized === "OFF" ||
    normalized === "OFFDAY" ||
    normalized === "TATIL" ||
    normalized === "ISTIRAHAT"
  ) {
    return {
      suggestedAction: "REVIEW_ALIAS" as const,
      suggestedTemplateLabel: undefined,
      suggestedReason: `Bu değer saat içermiyor. Alias eşleme tanımlanırsa sonraki importlarda otomatik çözülebilir: ${raw}`,
    };
  }

  return {
    suggestedAction: "CHECK_SHIFT_TEXT" as const,
    suggestedTemplateLabel: undefined,
    suggestedReason:
      "Değer çözümlenemedi. Kaynak metni kontrol edin veya bu değer için alias/mapping tanımlayın.",
  };
}

function buildRuntimeAliasMap(
  aliases?: ShiftImportAliasInput[]
) {
  const map = new Map<string, string>();

  for (const item of aliases ?? []) {
    const normalizedSourceValue = normalizeShiftLookupKey(item.sourceValue);
    const shiftTemplateId = String(item.shiftTemplateId ?? "").trim();
    if (!normalizedSourceValue || !shiftTemplateId) continue;
    map.set(normalizedSourceValue, shiftTemplateId);
  }

  return map;
}

export async function getShiftImportOptions(companyId: string) {
  const [shiftTemplates, aliases] = await Promise.all([
    prisma.shiftTemplate.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ shiftCode: "asc" }],
      select: {
        id: true,
        shiftCode: true,
        signature: true,
        isActive: true,
      },
    }),
    prisma.shiftImportAlias.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ sourceValueRaw: "asc" }],
      select: {
        id: true,
        sourceValueRaw: true,
        normalizedSourceValue: true,
        shiftTemplateId: true,
        shiftTemplate: {
          select: {
            id: true,
            shiftCode: true,
            signature: true,
          },
        },
      },
    }),
  ]);

  return {
    shiftTemplates,
    aliases,
  };
}

export async function upsertShiftImportAliases(
  companyId: string,
  aliases: ShiftImportAliasInput[]
) {
  for (const item of aliases) {
    const sourceValueRaw = String(item.sourceValue ?? "").trim();
    const normalizedSourceValue = normalizeShiftLookupKey(sourceValueRaw);
    const shiftTemplateId = String(item.shiftTemplateId ?? "").trim();
    if (!sourceValueRaw || !normalizedSourceValue || !shiftTemplateId) continue;

    await prisma.shiftImportAlias.upsert({
      where: { companyId_normalizedSourceValue: { companyId, normalizedSourceValue } },
      update: { sourceValueRaw, shiftTemplateId, isActive: true },
      create: { companyId, sourceValueRaw, normalizedSourceValue, shiftTemplateId, isActive: true },
    });
  }
}

function getWeekStartDayKey(dayKey: string) {
  const dt = DateTime.fromISO(dayKey);
  return dt.minus({ days: dt.weekday - 1 }).toISODate()!;
}

function getDayPrefix(dayKey: string): "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun" {
  const weekday = DateTime.fromISO(dayKey).weekday;
  switch (weekday) {
    case 1:
      return "mon";
    case 2:
      return "tue";
    case 3:
      return "wed";
    case 4:
      return "thu";
    case 5:
      return "fri";
    case 6:
      return "sat";
    default:
      return "sun";
  }
}

const HEADER_ALIASES: Record<ShiftImportField, string[]> = {
  employeeCode: [
    "employeecode",
    "employeecode",
    "employee",
    "employeeno",
    "employeenumber",
    "sicilno",
    "sicil",
    "personelkodu",
    "personelno",
    "kartno",
    "cardno",
    "staffcode",
    "staffno",
    "workerid",
    "employeeref",
  ],
  date: [
    "date",
    "tarih",
    "plandate",
    "workdate",
    "day",
    "gun",
    "calismatarihi",
    "vardiyatarihi",
    "scheduledate",
  ],
  shiftCode: [
    "shiftcode",
    "shift",
    "vardiya",
    "vardiyakodu",
    "vardiyatipi",
    "shifttype",
    "signature",
    "imza",
    "template",
    "templatedcode",
  ],
};

function suggestMapping(headers: string[]): Partial<ShiftImportRowMapping> {
  const normalizedPairs = headers.map((h) => ({
    raw: h,
    normalized: normalizeHeaderKey(h),
  }));

  const result: Partial<ShiftImportRowMapping> = {};

  for (const field of ["employeeCode", "date", "shiftCode"] as const) {
    const aliases = HEADER_ALIASES[field];
    const found = normalizedPairs.find((p) => aliases.includes(p.normalized));
    if (found) result[field] = found.raw;
  }

  return result;
}

function detectLayoutFromHeaders(headers: string[]): {
  layoutType: ShiftImportLayoutType;
  gridDateColumns: string[];
} {
  const suggested = suggestMapping(headers);
  if (suggested.employeeCode && suggested.date && suggested.shiftCode) {
    return {
      layoutType: "ROW",
      gridDateColumns: [],
    };
  }

  const gridDateColumns = headers.filter((h) => isLikelyIsoDate(h) || !!tryParseHeaderDate(h));

  if (gridDateColumns.length >= 2) {
    return {
      layoutType: "GRID_DATE_COLUMNS",
      gridDateColumns,
    };
  }

  return {
    layoutType: "ROW",
    gridDateColumns: [],
  };
}

function toGrid(lines: string[]) {
  if (lines.length === 0) return { delimiter: ", " as never, rows: [] as string[][] };
  const delimiter = detectDelimiter(lines[0]);
  const rows = lines.map((line) => splitCsvLine(line, delimiter));
  return { delimiter, rows };
}

export function extractHeaders(csv: string): ShiftImportHeadersResult {
  const text = normalizeText(csv).trim();
  if (!text) {
    return { headers: [], suggestedMapping: {} };
  }

  const lines = text.split("\n").filter((x) => String(x ?? "").trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], suggestedMapping: {} };
  }

  const { rows } = toGrid(lines);
  const headers = rows[0] ?? [];
  const detected = detectLayoutFromHeaders(headers);

  return {
    headers,
    suggestedMapping: suggestMapping(headers),
    detectedLayoutType: detected.layoutType,
    gridDateColumns: detected.gridDateColumns,
  };
}

function resolveRowMappingIndexes(headers: string[], mapping?: Partial<ShiftImportRowMapping>) {
  const normalizedHeaders = headers.map(normalizeHeaderKey);

  const employeeSource = mapping?.employeeCode ?? "employeeCode";
  const dateSource = mapping?.date ?? "date";
  const shiftSource = mapping?.shiftCode ?? "shiftCode";

  const employeeCodeIndex = resolveColumnIndex(headers, employeeSource);
  const dateIndex = resolveColumnIndex(headers, dateSource);
  const shiftCodeIndex = resolveColumnIndex(headers, shiftSource);

  const fallbackEmployee = normalizedHeaders.indexOf("employeecode");
  const fallbackDate = normalizedHeaders.indexOf("date");
  const fallbackShift = normalizedHeaders.indexOf("shiftcode");

  return {
    employeeCodeIndex: employeeCodeIndex >= 0 ? employeeCodeIndex : fallbackEmployee,
    dateIndex: dateIndex >= 0 ? dateIndex : fallbackDate,
    shiftCodeIndex: shiftCodeIndex >= 0 ? shiftCodeIndex : fallbackShift,
  };
}

function buildEmptyImportErrorRows(message: string): PreviewRow[] {
  return [
    {
      line: 0,
      employeeCode: "",
      date: "",
      shiftCode: "",
      layoutType: "ROW",
      suggestedAction: "FIX_REQUIRED_FIELDS",
      suggestedReason: message,
      status: "ERROR",
      message,
    },
  ];
}

function parseRowLayout(
  rows: string[][],
  mapping?: Partial<ShiftImportRowMapping>
): PreviewRow[] {
  const headers = rows[0] ?? [];
  const { employeeCodeIndex, dateIndex, shiftCodeIndex } = resolveRowMappingIndexes(headers, mapping);

  if (employeeCodeIndex < 0 || dateIndex < 0 || shiftCodeIndex < 0) {
    return [
      {
        line: 1,
        employeeCode: "",
        date: "",
        shiftCode: "",
        layoutType: "ROW",
        suggestedAction: "FIX_REQUIRED_FIELDS",
        suggestedReason: "Başlık eşleştirmesi eksik. employeeCode, date ve shiftCode alanları zorunludur.",
        status: "ERROR",
        message: "Başlık eşleştirmesi eksik. employeeCode, date ve shiftCode alanları zorunludur.",
      },
    ];
  }

  const parsedRows: PreviewRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const lineNo = i + 1;
    const cells = rows[i];

    const employeeCode = String(cells[employeeCodeIndex] ?? "").trim();
    const rawDate = String(cells[dateIndex] ?? "").trim();
    const shiftCode = String(cells[shiftCodeIndex] ?? "").trim();
    const date = normalizeImportedDate(rawDate) ?? rawDate;

    if (!employeeCode && !rawDate && !shiftCode) continue;

    if (!employeeCode || !rawDate || !shiftCode) {
      const suggestion = buildRequiredFieldsSuggestion();
      parsedRows.push({
        line: lineNo,
        employeeCode,
        date,
        shiftCode,
        layoutType: "ROW",
        sourceRowIndex: i,
        status: "ERROR",
        suggestedAction: suggestion.suggestedAction,
        suggestedReason: suggestion.suggestedReason,
        message: "employeeCode, date ve shiftCode zorunludur.",
      });
      continue;
    }

    if (!DateTime.fromISO(date).isValid) {
      const suggestion = buildInvalidDateSuggestion();
      parsedRows.push({
        line: lineNo,
        employeeCode,
        date,
        shiftCode,
        layoutType: "ROW",
        sourceRowIndex: i,
        status: "ERROR",
        suggestedAction: suggestion.suggestedAction,
        suggestedReason: suggestion.suggestedReason,
        message: "Tarih formatı geçersiz. Beklenen format: YYYY-MM-DD",
      });
      continue;
    }

    parsedRows.push({
      line: lineNo,
      employeeCode,
      date,
      shiftCode,
      layoutType: "ROW",
      sourceRowIndex: i,
      weekStart: getWeekStartDayKey(date),
      status: "VALID",
    });
  }

  return parsedRows;
}

function resolveGridDateColumnsMapping(headers: string[], mapping?: Partial<ShiftImportGridDateColumnsMapping>) {
  const employeeCodeIndex =
    resolveColumnIndex(headers, mapping?.employeeCodeColumn) >= 0
      ? resolveColumnIndex(headers, mapping?.employeeCodeColumn)
      : resolveColumnIndex(headers, "employeeCode");

  const employeeNameIndex =
    mapping?.employeeNameColumn
      ? resolveColumnIndex(headers, mapping.employeeNameColumn)
      : headers.findIndex((h) =>
          ["adsoyad", "isim", "ad", "name", "fullname", "employee"].includes(normalizeHeaderKey(h))
        );

  const explicitFirstDateColumn =
    mapping?.firstDateColumn != null ? resolveColumnIndex(headers, mapping.firstDateColumn) : -1;

  const dateColumnIndexes: number[] = [];

  for (let i = 0; i < headers.length; i++) {
    if (i === employeeCodeIndex || i === employeeNameIndex) continue;
    if (explicitFirstDateColumn >= 0 && i < explicitFirstDateColumn) continue;

    const headerValue = String(headers[i] ?? "").trim();
    if (tryParseHeaderDate(headerValue)) {
      dateColumnIndexes.push(i);
    }
  }

  return {
    employeeCodeIndex,
    employeeNameIndex,
    dateColumnIndexes,
    dateHeaderRowIndex: normalizePositiveIndex(mapping?.dateHeaderRow ?? 0, 0),
    dataStartRowIndex: normalizePositiveIndex(mapping?.dataStartRow ?? 1, 1),
  };
}

function parseGridDateColumnsLayout(
  rows: string[][],
  mapping?: Partial<ShiftImportGridDateColumnsMapping>
): PreviewRow[] {
  const dateHeaderRowIndex = normalizePositiveIndex(mapping?.dateHeaderRow ?? 0, 0);
  const dataStartRowIndex = normalizePositiveIndex(mapping?.dataStartRow ?? dateHeaderRowIndex + 1, dateHeaderRowIndex + 1);
  const headers = rows[dateHeaderRowIndex] ?? [];
  const { employeeCodeIndex, employeeNameIndex, dateColumnIndexes } = resolveGridDateColumnsMapping(headers, {
    ...mapping,
    dateHeaderRow: dateHeaderRowIndex,
    dataStartRow: dataStartRowIndex,
  });

  if (employeeCodeIndex < 0) {
    return [
      {
        line: dateHeaderRowIndex + 1,
        employeeCode: "",
        date: "",
        shiftCode: "",
        layoutType: "GRID_DATE_COLUMNS",
        suggestedAction: "FIX_REQUIRED_FIELDS",
        suggestedReason: "Grid import için employeeCode kolonu seçilmelidir.",
        status: "ERROR",
        message: "Grid import için employeeCode kolonu seçilmelidir.",
      },
    ];
  }

  if (dateColumnIndexes.length === 0) {
    return [
      {
        line: dateHeaderRowIndex + 1,
        employeeCode: "",
        date: "",
        shiftCode: "",
        layoutType: "GRID_DATE_COLUMNS",
        suggestedAction: "FIX_REQUIRED_FIELDS",
        suggestedReason: "Tarih sütunları bulunamadı. Grid import için tarih başlıkları gerekli.",
        status: "ERROR",
        message: "Tarih sütunları bulunamadı. Grid import için tarih başlıkları gerekli.",
      },
    ];
  }

  const parsedRows: PreviewRow[] = [];

  for (let rowIndex = dataStartRowIndex; rowIndex < rows.length; rowIndex++) {
    const cells = rows[rowIndex] ?? [];
    const employeeCode = String(cells[employeeCodeIndex] ?? "").trim();
    const employeeName = employeeNameIndex >= 0 ? String(cells[employeeNameIndex] ?? "").trim() : "";

    const hasAnyShiftValue = dateColumnIndexes.some((colIndex) => String(cells[colIndex] ?? "").trim().length > 0);
    if (!employeeCode && !employeeName && !hasAnyShiftValue) continue;

    if (!employeeCode && hasAnyShiftValue) {
      const suggestion = buildRequiredFieldsSuggestion();
      parsedRows.push({
        line: rowIndex + 1,
        employeeCode: "",
        date: "",
        shiftCode: "",
        layoutType: "GRID_DATE_COLUMNS",
        sourceRowIndex: rowIndex,
        status: "ERROR",
        suggestedAction: suggestion.suggestedAction,
        suggestedReason: "Bu satırda vardiya hücreleri var ama employeeCode boş.",
        message: "Grid satırında employeeCode boş.",
      });
      continue;
    }

    for (const colIndex of dateColumnIndexes) {
      const shiftCode = String(cells[colIndex] ?? "").trim();
      if (!shiftCode) continue;

      const headerDateRaw = String(headers[colIndex] ?? "").trim();
      const parsedDate = tryParseHeaderDate(headerDateRaw);

      if (!parsedDate) {
        const suggestion = buildInvalidDateSuggestion();
        parsedRows.push({
          line: rowIndex + 1,
          employeeCode,
          date: headerDateRaw,
          shiftCode,
          layoutType: "GRID_DATE_COLUMNS",
          sourceRowIndex: rowIndex,
          sourceColumnIndex: colIndex,
          sourceCellRef: buildCellRef(rowIndex, colIndex),
          status: "ERROR",
          suggestedAction: suggestion.suggestedAction,
          suggestedReason: "Tarih sütun başlığı çözülemedi.",
          message: "Tarih sütun başlığı geçersiz.",
        });
        continue;
      }

      parsedRows.push({
        line: rowIndex + 1,
        employeeCode,
        date: parsedDate,
        shiftCode,
        layoutType: "GRID_DATE_COLUMNS",
        sourceRowIndex: rowIndex,
        sourceColumnIndex: colIndex,
        sourceCellRef: buildCellRef(rowIndex, colIndex),
        weekStart: getWeekStartDayKey(parsedDate),
        employeeName: employeeName || undefined,
        status: "VALID",
      });
    }
  }

  return parsedRows;
}

export function parseCsv(
  csv: string,
  mapping?: Partial<ShiftImportMapping>,
  layoutType?: ShiftImportLayoutType
): PreviewRow[] {
  const text = normalizeText(csv).trim();
  if (!text) {
    return buildEmptyImportErrorRows("CSV içeriği boş.");
  }

  const lines = text.split("\n").filter((x) => String(x ?? "").trim().length > 0);
  if (lines.length === 0) {
    return buildEmptyImportErrorRows("CSV içeriği boş.");
  }

  const { rows } = toGrid(lines);
  const headers = rows[0] ?? [];
  const detected = detectLayoutFromHeaders(headers);
  const resolvedLayoutType = layoutType ?? detected.layoutType;

  if (resolvedLayoutType === "GRID_DATE_COLUMNS") {
    return parseGridDateColumnsLayout(
      rows,
      isGridDateColumnsMapping(mapping) ? mapping : undefined
    );
  }

  return parseRowLayout(rows, isRowMapping(mapping) ? mapping : undefined);
}

function buildTotals(rows: PreviewRow[], mode: ShiftImportMode): PreviewShiftImportResult {
  const validRows = rows.filter((r) => r.status === "VALID" || r.status === "WARNING");
  const touchedEmployees = new Set(validRows.map((r) => r.employeeId).filter(Boolean)).size;
  const touchedWeeks = new Set(
    validRows
      .map((r) => (r.employeeId && r.weekStart ? `${r.employeeId}:${r.weekStart}` : null))
      .filter(Boolean)
  ).size;

  return {
    rows,
    mode,
    totals: {
      total: rows.length,
      valid: rows.filter((r) => r.status === "VALID").length,
      warnings: rows.filter((r) => r.status === "WARNING").length,
      skipped: rows.filter((r) => r.status === "SKIPPED").length,
      errors: rows.filter((r) => r.status === "ERROR").length,
      touchedEmployees,
      touchedWeeks,
    },
  };
}

export async function previewShiftImport(
  companyId: string,
  csv: string,
  timezoneOrMode?: string | ShiftImportMode,
  modeOrMapping?: ShiftImportMode | Partial<ShiftImportMapping>,
  mappingOrAliases?: Partial<ShiftImportMapping> | ShiftImportAliasInput[],
  aliasInputsOrLayout?: ShiftImportAliasInput[] | ShiftImportLayoutType,
  layoutTypeArg?: ShiftImportLayoutType
): Promise<PreviewShiftImportResult> {
    const timezone =
    typeof timezoneOrMode === "string" &&
    timezoneOrMode !== "merge_days" &&
    timezoneOrMode !== "skip_existing_days"
      ? timezoneOrMode
      : "Europe/Istanbul";

  const resolvedMode =
    (typeof timezoneOrMode === "string" &&
    (timezoneOrMode === "merge_days" || timezoneOrMode === "skip_existing_days")
      ? timezoneOrMode
      : typeof modeOrMapping === "string"
      ? modeOrMapping
      : "merge_days") as ShiftImportMode;
  const mapping = (typeof modeOrMapping === "object" && !Array.isArray(modeOrMapping) ? modeOrMapping : typeof mappingOrAliases === "object" && !Array.isArray(mappingOrAliases) ? mappingOrAliases : undefined) as Partial<ShiftImportMapping> | undefined;
  const aliasInputs = (Array.isArray(mappingOrAliases) ? mappingOrAliases : Array.isArray(aliasInputsOrLayout) ? aliasInputsOrLayout : undefined) as ShiftImportAliasInput[] | undefined;
  const layoutType = (typeof aliasInputsOrLayout === "string" ? aliasInputsOrLayout : layoutTypeArg) as ShiftImportLayoutType | undefined;

  const parsed = parseCsv(csv, mapping, layoutType);
  const candidateRows = parsed.filter((r) => r.status !== "ERROR");

  if (candidateRows.length === 0) {
    return buildTotals(parsed, resolvedMode);
  }

  const employeeCodes = [...new Set(candidateRows.map((r) => r.employeeCode))];

  const employees = await prisma.employee.findMany({
    where: { companyId, employeeCode: { in: employeeCodes } },
    select: { id: true, employeeCode: true, firstName: true, lastName: true, isActive: true },
  });

  const shifts = await prisma.shiftTemplate.findMany({
    where: { companyId },
    select: { id: true, shiftCode: true, signature: true, isActive: true },
  });

  const dbAliases = await prisma.shiftImportAlias.findMany({
    where: { companyId, isActive: true },
    select: {
      id: true,
      sourceValueRaw: true,
      normalizedSourceValue: true,
      shiftTemplateId: true,
    },
  });

  const employeeMap = new Map(employees.map((e) => [e.employeeCode, e]));
  const shiftCodeMap = new Map(shifts.map((s) => [s.shiftCode, s]));
  const shiftSignatureMap = new Map(shifts.map((s) => [s.signature, s]));
  const normalizedShiftMap = new Map<string, (typeof shifts)[number]>();

  for (const shift of shifts) {
    const normalizedCode = normalizeShiftLookupKey(shift.shiftCode);
    const normalizedSignature = normalizeShiftLookupKey(shift.signature);

    if (normalizedCode && !normalizedShiftMap.has(normalizedCode)) {
      normalizedShiftMap.set(normalizedCode, shift);
    }
    if (normalizedSignature && !normalizedShiftMap.has(normalizedSignature)) {
      normalizedShiftMap.set(normalizedSignature, shift);
    }
  }

  const shiftIdMap = new Map(shifts.map((s) => [s.id, s]));
  const runtimeAliasMap = buildRuntimeAliasMap(aliasInputs);
  const dbAliasMap = new Map<string, string>();

  for (const alias of dbAliases) {
    if (alias.normalizedSourceValue && alias.shiftTemplateId) {
      dbAliasMap.set(alias.normalizedSourceValue, alias.shiftTemplateId);
    }
  }

  const validWeekStarts = [...new Set(candidateRows.map((r) => r.weekStart).filter(Boolean))] as string[];

  const existingWeeklyPlans =
    employees.length === 0 || validWeekStarts.length === 0
      ? []
      : await prisma.weeklyShiftPlan.findMany({
          where: {
            companyId,
            employeeId: { in: employees.map((e) => e.id) },
            weekStartDate: {
              in: validWeekStarts.map((w) => computeWeekStartUTC(w, timezone)),
            },
          },
          select: {
            employeeId: true,
            weekStartDate: true,
            monShiftTemplateId: true,
            tueShiftTemplateId: true,
            wedShiftTemplateId: true,
            thuShiftTemplateId: true,
            friShiftTemplateId: true,
            satShiftTemplateId: true,
            sunShiftTemplateId: true,
          },
        });

  const existingMap = new Map<string, (typeof existingWeeklyPlans)[number]>();
  for (const item of existingWeeklyPlans) {
    const weekStart = DateTime.fromJSDate(item.weekStartDate).toISODate();
    if (!weekStart) continue;
    existingMap.set(`${item.employeeId}:${weekStart}`, item);
  }

  const duplicateSeen = new Set<string>();
  const previewRows: PreviewRow[] = [];

  for (const row of parsed) {
    if (row.status === "ERROR") {
      previewRows.push(row);
      continue;
    }

    const normalizedShiftCode = normalizeShiftLookupKey(row.shiftCode);
    const parsedShiftSignature = tryParseShiftSignature(row.shiftCode) ?? undefined;

    let shift = shiftCodeMap.get(row.shiftCode) ?? null;
    let resolutionSource: ShiftResolutionSource | undefined;

    if (shift) {
      resolutionSource = "SHIFT_CODE_EXACT";
    }

    if (!shift) {
      shift = shiftSignatureMap.get(row.shiftCode) ?? null;
      if (shift) {
        resolutionSource = "SHIFT_SIGNATURE_EXACT";
      }
    }

    if (!shift && normalizedShiftCode) {
      shift = normalizedShiftMap.get(normalizedShiftCode) ?? null;
      if (shift) {
        resolutionSource = "SHIFT_TEXT_NORMALIZED";
      }
    }

    if (!shift && normalizedShiftCode) {
      const runtimeAliasShiftId = runtimeAliasMap.get(normalizedShiftCode);
      if (runtimeAliasShiftId) {
        shift = shiftIdMap.get(runtimeAliasShiftId) ?? null;
        if (shift) {
          resolutionSource = "SHIFT_IMPORT_ALIAS";
        }
      }
    }

    if (!shift && normalizedShiftCode) {
      const dbAliasShiftId = dbAliasMap.get(normalizedShiftCode);
      if (dbAliasShiftId) {
        shift = shiftIdMap.get(dbAliasShiftId) ?? null;
        if (shift) resolutionSource = "SHIFT_IMPORT_ALIAS";
      }
    }

    if (!shift && parsedShiftSignature) {
      shift = shiftSignatureMap.get(parsedShiftSignature) ?? null;
      if (shift) {
        resolutionSource = "SHIFT_TIME_PARSED";
      }
    }

    const employee = employeeMap.get(row.employeeCode);

    if (!employee) {
      previewRows.push({
        ...row,
        suggestedAction: buildMissingEmployeeSuggestion(row.employeeCode).suggestedAction,
        suggestedTemplateLabel: buildMissingEmployeeSuggestion(row.employeeCode).suggestedTemplateLabel,
        suggestedReason: buildMissingEmployeeSuggestion(row.employeeCode).suggestedReason,
        status: "ERROR",
        message: "Personel bulunamadı.",
      });
      continue;
    }

    if (!shift) {
      const suggestion = buildShiftSuggestion({
        rawShiftCode: row.shiftCode,
        parsedShiftSignature,
      });

      previewRows.push({
        ...row,
        employeeId: employee.id,
        employeeName: row.employeeName || `${employee.firstName} ${employee.lastName}`.trim(),
        normalizedShiftCode,
        parsedShiftSignature,
        suggestedAction: suggestion.suggestedAction,
        suggestedTemplateLabel: suggestion.suggestedTemplateLabel,
        suggestedReason: suggestion.suggestedReason,
        status: "ERROR",
        message: parsedShiftSignature
          ? `Vardiya şablonu bulunamadı. Saat formatı tanındı fakat bu imzaya uygun aktif şablon yok: ${parsedShiftSignature}`
          : "Vardiya şablonu bulunamadı. shiftCode/signature eşleşmedi ve saat formatı çözülemedi.",
      });
      continue;
    }

    if (!shift.isActive) {
      previewRows.push({
        ...row,
        employeeId: employee.id,
        shiftTemplateId: shift.id,
        employeeName: row.employeeName || `${employee.firstName} ${employee.lastName}`.trim(),
        shiftSignature: shift.signature,
        normalizedShiftCode,
        parsedShiftSignature,
        resolutionSource,
        status: "ERROR",
        message:
          buildShiftResolutionLabel(resolutionSource)
            ? `Pasif vardiya şablonu import edilemez. Çözümleme: ${buildShiftResolutionLabel(resolutionSource)}`
            : "Pasif vardiya şablonu import edilemez.",
      });
      continue;
    }

    const duplicateKey = `${row.employeeCode}:${row.date}`;
    if (duplicateSeen.has(duplicateKey)) {
      previewRows.push({
        ...row,
        employeeId: employee.id,
        shiftTemplateId: shift.id,
        employeeName: row.employeeName || `${employee.firstName} ${employee.lastName}`.trim(),
        shiftSignature: shift.signature,
        normalizedShiftCode,
        parsedShiftSignature,
        resolutionSource,
        suggestedAction: "CHECK_SHIFT_TEXT",
        suggestedTemplateLabel: undefined,
        suggestedReason: "Aynı employeeCode + date kombinasyonu dosyada birden fazla kez geçiyor.",
        status: "ERROR",
        message: "Aynı employeeCode + date satırı tekrar ediyor.",
      });
      continue;
    }
    duplicateSeen.add(duplicateKey);

    const existing = row.weekStart ? existingMap.get(`${employee.id}:${row.weekStart}`) : null;
    const prefix = getDayPrefix(row.date);
    const existingDayValue = existing ? (existing as any)[`${prefix}ShiftTemplateId`] : null;

    if (resolvedMode === "skip_existing_days" && existingDayValue) {
      previewRows.push({
        ...row,
        employeeId: employee.id,
        shiftTemplateId: shift.id,
        employeeName: row.employeeName || `${employee.firstName} ${employee.lastName}`.trim(),
        shiftSignature: shift.signature,
        normalizedShiftCode,
        parsedShiftSignature,
        resolutionSource,
        status: "SKIPPED",
        message: "Bu gün için mevcut override bulunduğu için satır atlandı.",
      });
      continue;
    }

    if (!employee.isActive) {
      previewRows.push({
        ...row,
        employeeId: employee.id,
        shiftTemplateId: shift.id,
        employeeName: row.employeeName || `${employee.firstName} ${employee.lastName}`.trim(),
        shiftSignature: shift.signature,
        normalizedShiftCode,
        parsedShiftSignature,
        resolutionSource,
        status: "WARNING",
        message:
          buildShiftResolutionLabel(resolutionSource)
            ? `Pasif personel. Satır yine de uygulanabilir. Çözümleme: ${buildShiftResolutionLabel(resolutionSource)}`
            : "Pasif personel. Satır yine de uygulanabilir.",
      });
      continue;
    }

    if (existingDayValue) {
      previewRows.push({
        ...row,
        employeeId: employee.id,
        shiftTemplateId: shift.id,
        employeeName: row.employeeName || `${employee.firstName} ${employee.lastName}`.trim(),
        shiftSignature: shift.signature,
        normalizedShiftCode,
        parsedShiftSignature,
        resolutionSource,
        status: "WARNING",
        message:
          buildShiftResolutionLabel(resolutionSource)
            ? `Mevcut day override üzerine yazılacak. Çözümleme: ${buildShiftResolutionLabel(resolutionSource)}`
            : "Mevcut day override üzerine yazılacak.",
      });
      continue;
    }

    previewRows.push({
      ...row,
      employeeId: employee.id,
      shiftTemplateId: shift.id,
      employeeName: row.employeeName || `${employee.firstName} ${employee.lastName}`.trim(),
      shiftSignature: shift.signature,
      normalizedShiftCode,
      parsedShiftSignature,
      resolutionSource,
      status: "VALID",
      message: buildShiftResolutionLabel(resolutionSource)
        ? `Çözümleme: ${buildShiftResolutionLabel(resolutionSource)}`
        : undefined,
    });
  }

  return buildTotals(previewRows, resolvedMode);
}

export async function applyShiftImport(
  companyId: string,
  timezone: string,
  csv: string,
  mode: ShiftImportMode = "merge_days",
  mapping?: Partial<ShiftImportMapping>,
  aliasInputs?: ShiftImportAliasInput[],
  layoutType?: ShiftImportLayoutType
): Promise<ApplyShiftImportResult> {
  const preview = await previewShiftImport(companyId, csv, timezone, mode, mapping, aliasInputs, layoutType);
  const valid = preview.rows.filter((r) => r.status === "VALID" || r.status === "WARNING");

  const grouped = new Map<
    string,
    { employeeId: string; weekStart: string; patch: Record<string, string | number | null> }
  >();

  for (const row of valid) {
    if (!row.employeeId || !row.shiftTemplateId || !row.weekStart) continue;

    const key = `${row.employeeId}:${row.weekStart}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        employeeId: row.employeeId,
        weekStart: row.weekStart,
        patch: {},
      });
    }

    const prefix = getDayPrefix(row.date);
    grouped.get(key)!.patch[`${prefix}ShiftTemplateId`] = row.shiftTemplateId;
    grouped.get(key)!.patch[`${prefix}StartMinute`] = null;
    grouped.get(key)!.patch[`${prefix}EndMinute`] = null;
  }

  const touchedDayKeys = valid
    .map((r) => r.date)
    .filter((x) => DateTime.fromISO(x).isValid)
    .sort();

  for (const item of grouped.values()) {
    await upsertWeeklyShiftPlan({
      companyId,
      employeeId: item.employeeId,
      weekStartDate: computeWeekStartUTC(item.weekStart, timezone),
      ...item.patch,
    });
  }

  return {
    applied: valid.length,
    touchedEmployees: new Set(valid.map((r) => r.employeeId).filter(Boolean)).size,
    touchedWeeks: grouped.size,
    startDayKey: touchedDayKeys[0] ?? null,
    endDayKey: touchedDayKeys[touchedDayKeys.length - 1] ?? null,
    totals: preview.totals,
    mode: preview.mode,
  };
}