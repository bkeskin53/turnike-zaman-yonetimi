"use client";

import { useEffect, useMemo, useState } from "react";

type ShiftImportMode = "merge_days" | "skip_existing_days";
type ShiftImportLayoutType = "ROW" | "GRID_DATE_COLUMNS";
type PreviewStatus = "VALID" | "WARNING" | "SKIPPED" | "ERROR";
type RowFilter = "ALL" | PreviewStatus;

type ShiftImportRowMapping = {
  employeeCode: string;
  date: string;
  shiftCode: string;
};

type ShiftImportGridMapping = {
  employeeCodeColumn: string;
  employeeNameColumn: string;
  dateHeaderRow: number;
  dataStartRow: number;
  firstDateColumn: string;
};

type ShiftResolutionSource =
  | "SHIFT_CODE_EXACT"
  | "SHIFT_SIGNATURE_EXACT"
  | "SHIFT_IMPORT_ALIAS"
  | "SHIFT_TEXT_NORMALIZED"
  | "SHIFT_TIME_PARSED";

type SuggestedAction =
  | "REVIEW_ALIAS"
  | "CREATE_TEMPLATE"
  | "CHECK_SHIFT_TEXT"
  | "FIX_REQUIRED_FIELDS"
  | "CHECK_EMPLOYEE";

type ShiftImportAliasInput = {
  sourceValue: string;
  shiftTemplateId: string;
  persist?: boolean;
};

type ShiftTemplateOption = {
  id: string;
  shiftCode: string;
  signature: string;
  isActive?: boolean;
};

type PreviewRow = {
  line?: number;
  employeeCode: string;
  employeeName?: string;
  date: string;
  shiftCode: string;
  layoutType?: ShiftImportLayoutType;
  normalizedShiftCode?: string;
  parsedShiftSignature?: string;
  resolutionSource?: ShiftResolutionSource;
  suggestedAction?: SuggestedAction;
  suggestedTemplateLabel?: string;
  suggestedReason?: string;
  shiftSignature?: string;
  weekStart?: string;
  sourceRowIndex?: number;
  sourceColumnIndex?: number;
  sourceCellRef?: string;
  sourceSheetName?: string;
  status: PreviewStatus;
  message?: string;
};

type OptionsResponse = {
  ok: true;
  shiftTemplates: ShiftTemplateOption[];
  aliases: Array<{
    rawKey?: string;
    sourceValueRaw?: string;
    normalizedSourceValue?: string;
    shiftTemplateId: string;
  }>;
  supportedLayouts?: Array<{
    code: ShiftImportLayoutType;
    label: string;
  }>;
  supportedFileTypes?: string[];
  limits?: {
    maxPreviewRows?: number;
    maxApplyRows?: number;
  };
};

type PreviewResponse = {
  ok: true;
  rows: PreviewRow[];
  totals: {
    total: number;
    valid: number;
    warnings: number;
    skipped: number;
    errors: number;
    touchedEmployees: number;
    touchedWeeks: number;
  };
  mode: ShiftImportMode;
};

type ParsedGrid = {
  rows: string[][];
  headerRow: string[];
};

type GridDateColumnInfo = {
  index: number;
  header: string;
  isoDate: string;
  cellRef: string;
};

type GridValidationIssue = {
  level: "ERROR" | "WARNING" | "INFO";
  text: string;
};

type LayoutQualitySummary = {
  score: number;
  issues: GridValidationIssue[];
};

type ImportedWorkbookSheet = {
  name: string;
  text: string;
  rowCount: number;
  columnCount: number;
};

type ParsedImportFile =
  | {
      kind: "text";
      text: string;
    }
  | {
      kind: "xlsx";
      text: string;
      sheets: ImportedWorkbookSheet[];
      selectedSheetName: string;
    };

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function looksBrokenTurkish(text: string) {
  if (!text) return false;
  return /�|Ã|Ä|Å|Þ|Ð|Ý/.test(text);
}

function decodeArrayBufferWithFallback(buffer: ArrayBuffer): string {
  const tryDecode = (encoding: string, fatal = false) => {
    try {
      return new TextDecoder(encoding, { fatal }).decode(buffer);
    } catch {
      return null;
    }
  };

  const candidates = [
    tryDecode("utf-8", true),
    tryDecode("utf-8"),
    tryDecode("windows-1254"),
    tryDecode("iso-8859-9"),
    tryDecode("windows-1252"),
  ].filter((x): x is string => typeof x === "string");

  if (!candidates.length) {
    return new TextDecoder().decode(buffer);
  }

  const scored = candidates.map((text) => {
    let score = 0;

    if (!looksBrokenTurkish(text)) score += 10;
    if (/[çğıöşüÇĞİÖŞÜ]/.test(text)) score += 8;
    if (!/�/.test(text)) score += 5;
    if (!/Ã|Ä|Å/.test(text)) score += 3;

    return { text, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.text ?? candidates[0];
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) {
        resolve(result);
        return;
      }
      reject(new Error("FILE_READ_FAILED"));
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function escapeTsvCell(value: string) {
  const text = String(value ?? "");
  if (!/[\t\n\r"]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function matrixToTsv(rows: string[][]): string {
  return rows
    .map((row) => row.map((cell) => escapeTsvCell(cell)).join("\t"))
    .join("\n");
}

async function parseXlsxFile(file: File): Promise<ParsedImportFile> {
  const buffer = await readFileAsArrayBuffer(file);
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, {
    type: "array",
    dense: true,
    cellDates: true,
  });

  const sheets: ImportedWorkbookSheet[] = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = (XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
      dateNF: "yyyy-mm-dd",
    }) as unknown[][]).map((row) => row.map((cell) => String(cell ?? "")));

    const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);

    return {
      name: sheetName,
      text: matrixToTsv(rows),
      rowCount: rows.length,
      columnCount,
    };
  });

  const firstNonEmptySheet = sheets.find((sheet) => normalizeText(sheet.text).trim());
  const selectedSheet = firstNonEmptySheet ?? sheets[0];

  return {
    kind: "xlsx",
    text: selectedSheet?.text ?? "",
    sheets,
    selectedSheetName: selectedSheet?.name ?? "",
  };
}

async function parseFile(file: File): Promise<ParsedImportFile> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "xlsx" || ext === "xls") {
    return parseXlsxFile(file);
  }

  const buffer = await readFileAsArrayBuffer(file);
  return {
    kind: "text",
    text: decodeArrayBufferWithFallback(buffer),
  };
}

const SAMPLE_CSV = `employeeCode,date,shiftCode
E001,2026-03-17,0800-1700
E001,2026-03-18,OFF`;

const SAMPLE_GRID = `employeeCode	employeeName	2026-03-17	2026-03-18	2026-03-19	2026-03-20
E001	Ahmet Yılmaz	0800-1700	0800-1700	OFF	2200-0600
E002	Ayşe Kaya	GECE	GECE	OFF	A2`;

function normalizeText(input: string) {
  return String(input ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function normalizeHeaderKey(input: string) {
  return String(input ?? "")
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

function extractDateLikeToken(value: string): string {
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

  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (iso.test(raw)) return raw;

  const m1 = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (m1) {
    const dd = Number(m1[1]);
    const mm = Number(m1[2]);
    let yy = Number(m1[3]);
    if (yy < 100) yy += 2000;
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${String(yy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }

  return null;
}

function isLikelyDateHeader(value: string) {
  return !!tryParseHeaderDate(value);
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

function findBestHeaderRowIndex(text: string): number {
  const normalized = normalizeText(text).trim();
  if (!normalized) return 0;

  const lines = normalized.split("\n").filter((x) => String(x ?? "").trim().length > 0);
  if (!lines.length) return 0;

  let bestIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const delimiter = detectDelimiter(lines[i]);
    const cells = splitCsvLine(lines[i], delimiter);
    const score = cells.filter((c) => isLikelyDateHeader(c)).length + (cells.length >= 2 ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function parseTextGrid(text: string, headerRowIndex = 0): ParsedGrid {
  const normalized = normalizeText(text).trim();
  if (!normalized) {
    return { rows: [], headerRow: [] };
  }

  const lines = normalized.split("\n").filter((x) => String(x ?? "").trim().length > 0);
  if (!lines.length) {
    return { rows: [], headerRow: [] };
  }

  const safeHeaderRowIndex =
    headerRowIndex >= 0 && headerRowIndex < lines.length
      ? headerRowIndex
      : Math.min(findBestHeaderRowIndex(text), lines.length - 1);

  const sampleLine = lines[safeHeaderRowIndex] ?? lines[0];
  const delimiter = detectDelimiter(sampleLine);
  const rows = lines.map((line) => splitCsvLine(line, delimiter));
  const headerRow = rows[safeHeaderRowIndex] ?? [];

  if (headerRow.length > 0) {
    return {
      rows,
      headerRow,
    };
  }

  const fallbackIndex = Math.min(findBestHeaderRowIndex(text), rows.length - 1);

  return {
    rows,
    headerRow: rows[fallbackIndex] ?? rows[0] ?? [],
  };
}

function detectLayoutFromHeaders(headers: string[]): ShiftImportLayoutType {
  const normalized = headers.map(normalizeHeaderKey);
  const hasEmployeeCode = normalized.some((h) =>
    [
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
    ].includes(h)
  );
  const hasDate = normalized.some((h) =>
    ["date", "tarih", "plandate", "workdate", "day", "gun", "calismatarihi", "vardiyatarihi", "scheduledate"].includes(h)
  );
  const hasShift = normalized.some((h) =>
    ["shiftcode", "shift", "vardiya", "vardiyakodu", "vardiyatipi", "shifttype", "signature", "imza", "template", "templatedcode"].includes(h)
  );

  if (hasEmployeeCode && hasDate && hasShift) return "ROW";

  const dateColumnCount = headers.filter((h) => isLikelyDateHeader(h)).length;
  if (dateColumnCount >= 2 && hasEmployeeCode) return "GRID_DATE_COLUMNS";

  return "ROW";
}

function buildGridValidationSummary(input: {
  headers: string[];
  gridMapping: ShiftImportGridMapping;
  gridDateColumns: GridDateColumnInfo[];
  parsedGrid: ParsedGrid;
}): LayoutQualitySummary {
  const { headers, gridMapping, gridDateColumns, parsedGrid } = input;
  const issues: GridValidationIssue[] = [];
  let score = 100;

  if (!headers.length) {
    return {
      score: 0,
      issues: [{ level: "ERROR", text: "Başlık satırı okunamadı." }],
    };
  }

  const employeeCodeIndex = headers.findIndex((h) => h === gridMapping.employeeCodeColumn);
  const employeeNameIndex = headers.findIndex((h) => h === gridMapping.employeeNameColumn);
  const firstDateIndex = headers.findIndex((h) => h === gridMapping.firstDateColumn);

  if (employeeCodeIndex < 0) {
    issues.push({ level: "ERROR", text: "employeeCodeColumn seçimi geçersiz veya başlık satırında bulunamadı." });
    score -= 40;
  }

  if (gridMapping.employeeNameColumn && employeeNameIndex < 0) {
    issues.push({ level: "WARNING", text: "employeeNameColumn başlıklarda bulunamadı. İsim kolonu olmadan devam edilebilir." });
    score -= 8;
  }

  if (gridMapping.dateHeaderRow < 0) {
    issues.push({ level: "ERROR", text: "dateHeaderRow 0 veya daha büyük olmalıdır." });
    score -= 30;
  }

  if (gridMapping.dataStartRow <= gridMapping.dateHeaderRow) {
    issues.push({ level: "ERROR", text: "dataStartRow, dateHeaderRow satırından sonra başlamalıdır." });
    score -= 30;
  }

  if (gridDateColumns.length === 0) {
    issues.push({ level: "ERROR", text: "Tarih sütunu algılanamadı. Header satırını veya firstDateColumn seçimini kontrol edin." });
    score -= 40;
  }

  if (firstDateIndex < 0) {
    issues.push({ level: "ERROR", text: "firstDateColumn başlıklarda bulunamadı." });
    score -= 25;
  } else {
    const dateColumnsAfterStart = gridDateColumns.filter((c) => c.index >= firstDateIndex);
    if (dateColumnsAfterStart.length === 0) {
      issues.push({
        level: "ERROR",
        text: "Seçilen firstDateColumn sonrasında tarih sütunu kalmıyor.",
      });
      score -= 30;
    } else if (dateColumnsAfterStart.length < 3) {
      issues.push({
        level: "WARNING",
        text: "Seçilen firstDateColumn sonrasında az sayıda tarih sütunu var. Çok haftalı plan için başlangıç kolonu yanlış olabilir.",
      });
      score -= 10;
    }
  }

  if (parsedGrid.rows.length > 0 && gridMapping.dataStartRow >= parsedGrid.rows.length) {
    issues.push({
      level: "ERROR",
      text: "dataStartRow dosyadaki toplam satır sayısından büyük veya eşit.",
    });
    score -= 35;
  }

  const sampleRows = parsedGrid.rows.slice(gridMapping.dataStartRow, gridMapping.dataStartRow + 5);
  const hasAnyDataRow = sampleRows.some((row) => row.some((cell) => String(cell ?? "").trim().length > 0));
  if (!hasAnyDataRow) {
    issues.push({
      level: "WARNING",
      text: "Seçilen dataStartRow sonrasında örnek veri satırı görünmüyor.",
    });
    score -= 8;
  }

  if (employeeCodeIndex >= 0) {
    const emptyEmployeeCount = sampleRows.filter((row) => !String(row[employeeCodeIndex] ?? "").trim()).length;
    if (sampleRows.length > 0 && emptyEmployeeCount === sampleRows.length) {
      issues.push({
        level: "WARNING",
        text: "Örnek veri satırlarında employeeCode kolonu boş görünüyor. Yanlış kolon seçilmiş olabilir.",
      });
      score -= 12;
    }
  }

  if (issues.length === 0) {
    issues.push({
      level: "INFO",
      text: "Grid mapping kaliteli görünüyor. Preview güvenle çalıştırılabilir.",
    });
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
  };
}

export default function ShiftImportClient({ canWrite }: { canWrite: boolean }) {
  const [csv, setCsv] = useState(SAMPLE_CSV);
  const [fileName, setFileName] = useState<string>("");
  const [importSourceType, setImportSourceType] = useState<"text" | "xlsx">("text");
  const [xlsxSheets, setXlsxSheets] = useState<ImportedWorkbookSheet[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState<string>("");

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [mode, setMode] = useState<ShiftImportMode>("merge_days");
  const [layoutType, setLayoutType] = useState<ShiftImportLayoutType>("ROW");
  const [rowFilter, setRowFilter] = useState<RowFilter>("ALL");
  const [mapping, setMapping] = useState<ShiftImportRowMapping>({
    employeeCode: "employeeCode",
    date: "date",
    shiftCode: "shiftCode",
  });
  const [gridMapping, setGridMapping] = useState<ShiftImportGridMapping>({
    employeeCodeColumn: "employeeCode",
    employeeNameColumn: "employeeName",
    dateHeaderRow: 0,
    dataStartRow: 1,
    firstDateColumn: "C",
  });
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplateOption[]>([]);
  const [aliasMappings, setAliasMappings] = useState<Record<string, ShiftImportAliasInput>>({});
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [showAliasPanel, setShowAliasPanel] = useState(true);
  const [supportedLayouts, setSupportedLayouts] = useState<Array<{ code: ShiftImportLayoutType; label: string }>>([
    { code: "ROW", label: "Satır Bazlı" },
    { code: "GRID_DATE_COLUMNS", label: "Tarih Sütunlu Grid" },
  ]);
  const [precheckTouched, setPrecheckTouched] = useState(false);

  const rows = preview?.rows ?? [];
  const filteredRows = rowFilter === "ALL" ? rows : rows.filter((r) => r.status === rowFilter); 
  const parsedGrid = useMemo(() => parseTextGrid(csv, gridMapping.dateHeaderRow), [csv, gridMapping.dateHeaderRow]);
  const csvHeaders = parsedGrid.headerRow;
  const availableHeaderRows = useMemo(() => {
    const normalized = normalizeText(csv).trim();
    if (!normalized) return [] as Array<{ index: number; preview: string }>;
    const lines = normalized.split("\n").filter((x) => String(x ?? "").trim().length > 0);
    return lines.slice(0, 12).map((line, index) => ({
      index,
      preview: line.length > 90 ? `${line.slice(0, 90)}…` : line,
    }));
  }, [csv]);
  const effectiveHeaderRowIndex = useMemo(() => {
    if (!availableHeaderRows.length) return 0;
    if (gridMapping.dateHeaderRow >= 0 && gridMapping.dateHeaderRow < availableHeaderRows.length) {
      return gridMapping.dateHeaderRow;
    }
    return findBestHeaderRowIndex(csv);
  }, [availableHeaderRows, gridMapping.dateHeaderRow, csv]);
  const detectedLayoutType = useMemo(() => detectLayoutFromHeaders(csvHeaders), [csvHeaders]);
  const gridDateColumns = useMemo<GridDateColumnInfo[]>(() => {
    return csvHeaders
      .map((header, index) => {
        const isoDate = tryParseHeaderDate(header);
        if (!isoDate) return null;
        return {
          index,
          header,
          isoDate,
          cellRef: buildCellRef(effectiveHeaderRowIndex, index),
        };
      })
      .filter(Boolean) as GridDateColumnInfo[];
  }, [csvHeaders, effectiveHeaderRowIndex]);
  const gridValidation = useMemo(
    () =>
      buildGridValidationSummary({
        headers: csvHeaders,
        gridMapping,
        gridDateColumns,
        parsedGrid,
      }),
    [csvHeaders, gridMapping, gridDateColumns, parsedGrid]
  );
  const gridValidationErrors = gridValidation.issues.filter((x) => x.level === "ERROR");
  const gridValidationWarnings = gridValidation.issues.filter((x) => x.level === "WARNING");
  const canRunPreview = useMemo(() => {
    if (loading) return false;
    if (!normalizeText(csv).trim()) return false;
    if (layoutType !== "GRID_DATE_COLUMNS") return true;
    return gridValidationErrors.length === 0;
  }, [loading, csv, layoutType, gridValidationErrors]);
  const sourceAutoDetectedLayout = useMemo(() => {
    const normalized = normalizeText(csv).trim();
    if (!normalized) return "ROW" as ShiftImportLayoutType;

    const bestHeaderRowIndex = findBestHeaderRowIndex(csv);
    const parsed = parseTextGrid(csv, bestHeaderRowIndex);
    return detectLayoutFromHeaders(parsed.headerRow);
  }, [csv]);
  const dateColumnRange = useMemo(() => {
    if (!gridDateColumns.length) return null;
    return {
      start: gridDateColumns[0].isoDate,
      end: gridDateColumns[gridDateColumns.length - 1].isoDate,
      count: gridDateColumns.length,
    };
  }, [gridDateColumns]);

  const selectedXlsxSheet = useMemo(
    () => xlsxSheets.find((sheet) => sheet.name === selectedSheetName) ?? null,
    [xlsxSheets, selectedSheetName]
  );

  useEffect(() => {
    let mounted = true;

    async function loadOptions() {
      setOptionsLoading(true);
      try {
        const res = await fetch("/api/shift-import/options");
        const json: OptionsResponse | null = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) return;
        if (!mounted) return;
        setShiftTemplates(json.shiftTemplates ?? []);
        if (Array.isArray(json.supportedLayouts) && json.supportedLayouts.length > 0) {
          setSupportedLayouts(json.supportedLayouts);
        }
      } finally {
        if (mounted) setOptionsLoading(false);
      }
    }

    loadOptions();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setLayoutType(sourceAutoDetectedLayout);

    const bestHeaderRowIndex = findBestHeaderRowIndex(csv);
    const bestParsed = parseTextGrid(csv, bestHeaderRowIndex);
    const bestHeaders = bestParsed.headerRow;

    if (!bestHeaders.length) return;

    if (sourceAutoDetectedLayout === "ROW") {
      applySuggestedMappingFromHeaders(bestHeaders);
      return;
    }

    setGridMapping((prev) => ({
      ...prev,
      dateHeaderRow: bestHeaderRowIndex,
    }));
    applySuggestedGridMappingFromHeaders(bestHeaders);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csv, sourceAutoDetectedLayout]);

  useEffect(() => {
    if (layoutType !== "GRID_DATE_COLUMNS") return;
    if (!gridDateColumns.length) return;

    const currentIndex = csvHeaders.findIndex((h) => h === gridMapping.firstDateColumn);
    if (currentIndex >= 0 && gridDateColumns.some((x) => x.index === currentIndex)) return;

    setGridMapping((prev) => ({
      ...prev,
      firstDateColumn: csvHeaders[gridDateColumns[0].index] ?? prev.firstDateColumn,
    }));
  }, [layoutType, gridDateColumns, csvHeaders, gridMapping.firstDateColumn]);

  useEffect(() => {
    if (!csvHeaders.length) return;
    if (layoutType === "ROW" && !mapping.employeeCode && !mapping.date && !mapping.shiftCode) {
      applySuggestedMappingFromHeaders(csvHeaders);
    }
  }, [layoutType, csvHeaders, mapping]);

  const dateRange = useMemo(() => {
    if (!rows.length) return null;

    const dates = rows
      .map((r:any)=>r.date)
      .filter(Boolean)
      .sort();

    if (!dates.length) return null;

    return {
      start: dates[0],
      end: dates[dates.length - 1],
    };
  }, [rows]);

  const reasonSummary = useMemo(() => {
    const map: Record<string, number> = {};

    for (const r of rows) {
      if (!r.message) continue;

      const key = r.message;
      map[key] = (map[key] ?? 0) + 1;
    }

    return map;
  }, [rows]);

  const unresolvedAliasRows = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{
      sourceValue: string;
      normalizedSourceValue: string;
      suggestedAction?: SuggestedAction;
      count: number;
    }> = [];

    const counts = new Map<string, number>();
    for (const row of rows) {
      if (row.status !== "ERROR") continue;
      if (row.suggestedAction !== "REVIEW_ALIAS" && row.suggestedAction !== "CHECK_SHIFT_TEXT") continue;
      const normalized = String(row.normalizedShiftCode ?? "").trim();
      const sourceValue = String(row.shiftCode ?? "").trim() || normalized;
      const key = normalized || sourceValue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      list.push({
        sourceValue,
        normalizedSourceValue: normalized || sourceValue,
        suggestedAction: row.suggestedAction,
        count: 0,
      });
    }

    return list.map((item) => ({ ...item, count: counts.get(item.normalizedSourceValue || item.sourceValue) ?? 1 }));
  }, [rows]);

  function copyRowsByStatus(status: string) {
    if (!rows.length) return;
    const filtered = rows.filter((r) => r.status === status);

    const lines = filtered.map((r) =>
      [
        r.employeeCode,
        r.date,
        r.shiftCode,
        r.sourceCellRef ?? "",
        r.message ?? "",
      ]
        .map((v) => String(v ?? "").replace(/"/g, '""'))
        .map((v) => (/[,"\n]/.test(v) ? `"${v}"` : v))
        .join(",")
    );

    const csv = ["employeeCode,date,shiftCode,sourceCellRef,message", ...lines].join("\n");

    navigator.clipboard.writeText(csv);
    setNotice(`${status} satırları panoya kopyalandı`);
  }

  function setAliasTemplate(sourceValue: string, shiftTemplateId: string) {
    setAliasMappings((prev) => ({
      ...prev,
      [sourceValue]: {
        sourceValue,
        shiftTemplateId,
        persist: prev[sourceValue]?.persist ?? true,
      },
    }));
  }

  function setAliasPersist(sourceValue: string, persist: boolean) {
    setAliasMappings((prev) => ({
      ...prev,
      [sourceValue]: {
        sourceValue,
        shiftTemplateId: prev[sourceValue]?.shiftTemplateId ?? "",
        persist,
      },
    }));
  }

  const aliasMappingList = useMemo(
    () =>
      Object.values(aliasMappings).filter(
        (item) => item.sourceValue && item.shiftTemplateId
      ),
    [aliasMappings]
  );

  const stats = useMemo(() => {
    return {
      total: preview?.totals?.total ?? rows.length,
      valid: preview?.totals?.valid ?? rows.filter((row) => row?.status === "VALID").length,
      warnings:
        preview?.totals?.warnings ?? rows.filter((row) => row?.status === "WARNING").length,
      skipped:
        preview?.totals?.skipped ?? rows.filter((row) => row?.status === "SKIPPED").length,
      errors: preview?.totals?.errors ?? rows.filter((row) => row?.status === "ERROR").length,
      touchedEmployees: preview?.totals?.touchedEmployees ?? 0,
      touchedWeeks: preview?.totals?.touchedWeeks ?? 0,
    };
  }, [preview, rows]);

  const canApply = useMemo(() => {
    if (!canWrite) return false;
    if (loading) return false;
    return (stats.valid > 0 || stats.warnings > 0) && rows.length > 0;
  }, [canWrite, loading, preview]);
  
  async function runPreview() {
    setLoading(true);
    setNotice(null);
    setError(null);
    setRowFilter("ALL");
    setPrecheckTouched(true);

    if (layoutType === "GRID_DATE_COLUMNS" && gridValidationErrors.length > 0) {
      setPreview(null);
      setError("Grid mapping doğrulaması başarısız. Ön kontrol kartındaki hataları düzeltin.");
      setLoading(false);
      return;
    }

    setPreview(null);

    try {
      const res = await fetch("/api/shift-import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileText: csv,
          mode,
          layoutType,
          sourceType: importSourceType,
          sourceSheetName: importSourceType === "xlsx" ? selectedSheetName : undefined,
          mapping: layoutType === "GRID_DATE_COLUMNS" ? gridMapping : mapping,
          aliasMappings: aliasMappingList,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error || "Preview başarısız");
        return;
      }

      setPreview(json);
      setNotice("Dry-run tamamlandı. Sonuçları kontrol edin.");
    } catch {
      setError("Preview sırasında bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  }

  async function runApply() {
    if (!canWrite) return;

    setLoading(true);
    setNotice(null);
    setError(null);

    try {
      const res = await fetch("/api/shift-import/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileText: csv,
          mode,
          layoutType,
          sourceType: importSourceType,
          sourceSheetName: importSourceType === "xlsx" ? selectedSheetName : undefined,
          mapping: layoutType === "GRID_DATE_COLUMNS" ? gridMapping : mapping,
          aliasMappings: aliasMappingList,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error || "Apply başarısız");
        return;
      }

      setNotice(
        [
          `Import tamamlandı`,
          `${json?.result?.applied ?? 0} satır uygulandı`,
          `${json?.result?.touchedEmployees ?? 0} employee etkilendi`,
          `${json?.result?.touchedWeeks ?? 0} hafta etkilendi`,
          json?.result?.startDayKey && json?.result?.endDayKey
            ? `Aralık: ${json.result.startDayKey} → ${json.result.endDayKey}`
            : null,
        ].filter(Boolean).join(" • ")
      );
    } catch {
      setError("Apply sırasında bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  }

  function fillGridSample() {
    setCsv(SAMPLE_GRID);
    setImportSourceType("text");
    setXlsxSheets([]);
    setSelectedSheetName("");
    setFileName("");
    setPreview(null);
    setPrecheckTouched(false);
    setLayoutType("GRID_DATE_COLUMNS");
    setGridMapping({
      employeeCodeColumn: "employeeCode",
      employeeNameColumn: "employeeName",
      dateHeaderRow: 0,
      dataStartRow: 1,
      firstDateColumn: "2026-03-17",
    });
    setAliasMappings({});
    setNotice("Tarih sütunlu grid örneği yüklendi");
  }

  function fillSample() {
    setCsv(SAMPLE_CSV);
    setImportSourceType("text");
    setXlsxSheets([]);
    setSelectedSheetName("");
    setFileName("");
    setPreview(null);
    setPrecheckTouched(false);
    setAliasMappings({});
    setNotice(null);
    setError(null);
  }

  function applyParsedImportFile(parsed: ParsedImportFile, fileNameValue: string) {
    setFileName(fileNameValue || "");
    setPrecheckTouched(false);
    setPreview(null);
    setAliasMappings({});
    setError(null);

    if (parsed.kind === "xlsx") {
      setImportSourceType("xlsx");
      setXlsxSheets(parsed.sheets);
      setSelectedSheetName(parsed.selectedSheetName);
      setCsv(parsed.text);
      setNotice(
        parsed.selectedSheetName
          ? `Excel dosyası yüklendi. Aktif sheet: ${parsed.selectedSheetName}. Layout ve mapping kontrol edin.`
          : "Excel dosyası yüklendi. Layout ve mapping kontrol edin."
      );
      return;
    }

    setImportSourceType("text");
    setXlsxSheets([]);
    setSelectedSheetName("");
    setCsv(parsed.text);
    setNotice("Dosya yüklendi. Layout ve mapping kontrol edin.");
  }

  async function handleFileUpload(e:any){
    const file = e.target.files?.[0];
    if(!file) return;

    try {
      const parsed = await parseFile(file);
      applyParsedImportFile(parsed, file.name || "");
    } catch {
      setError("Dosya okunamadı. Lütfen dosya formatını kontrol edin.");
    } finally {
      e.target.value = "";
    }
  }

  async function handleDrop(e:any){
    e.preventDefault();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if(!file) return;

    try {
      const parsed = await parseFile(file);
      applyParsedImportFile(parsed, file.name || "");
    } catch {
      setError("Dosya okunamadı. Lütfen dosya formatını kontrol edin.");
    }
  }

  function handleSheetChange(sheetName: string) {
    setSelectedSheetName(sheetName);
    const sheet = xlsxSheets.find((item) => item.name === sheetName);
    if (!sheet) return;

    setPrecheckTouched(false);
    setPreview(null);
    setAliasMappings({});
    setCsv(sheet.text);
    setNotice(`Excel sheet değiştirildi: ${sheet.name}. Preview'i yeniden çalıştırın.`);
  }

  function clearAll() {
    setCsv("employeeCode,date,shiftCode\n");
    setFileName("");
    setImportSourceType("text");
    setXlsxSheets([]);
    setSelectedSheetName("");
    setPrecheckTouched(false);
    setPreview(null);
    setRowFilter("ALL");
    setNotice(null);
    setError(null);
    setAliasMappings({});
  }

  function applySuggestedMappingFromHeaders(headers: string[]) {
    const lower = headers.map((h) => ({
      raw: h,
      normalized: normalizeHeaderKey(h),
    }));

    const pick = (aliases: string[]) => lower.find((x) => aliases.includes(x.normalized))?.raw;

    setMapping({
      employeeCode: pick(["employeecode", "employee", "employeeno", "employeenumber", "sicilno", "sicil", "personelkodu", "personelno", "kartno", "cardno", "staffcode", "staffno", "workerid", "employeeref"]) ?? headers[0] ?? "",
      date: pick(["date", "tarih", "plandate", "workdate", "day", "gun", "calismatarihi", "vardiyatarihi", "scheduledate"]) ?? headers[1] ?? "",
      shiftCode: pick(["shiftcode", "shift", "vardiya", "vardiyakodu", "vardiyatipi", "shifttype", "signature", "imza", "template", "templatedcode"]) ?? headers[2] ?? "",
    });
  }

  function applySuggestedGridMappingFromHeaders(headers: string[]) {
    const lower = headers.map((h) => ({
      raw: h,
      normalized: normalizeHeaderKey(h),
    }));

    const pick = (aliases: string[]) => lower.find((x) => aliases.includes(x.normalized))?.raw;
    const firstDate = headers.find((h) => isLikelyDateHeader(h)) ?? headers[2] ?? "";

    setGridMapping((prev) => ({
      ...prev,
      employeeCodeColumn:
        pick(["employeecode", "employee", "employeeno", "employeenumber", "sicilno", "sicil", "personelkodu", "personelno", "kartno", "cardno", "staffcode", "staffno", "workerid", "employeeref"]) ??
        headers[0] ??
        "",
      employeeNameColumn:
        pick(["employeename", "employeeshortname", "fullname", "adsoyad", "isim", "ad", "name", "employee"]) ??
        headers[1] ??
        "",
      dateHeaderRow: 0,
      dataStartRow: 1,
      firstDateColumn: firstDate,
    }));
  }

  const activeMappingSummary =
    layoutType === "GRID_DATE_COLUMNS"
      ? `employeeCode → ${gridMapping.employeeCodeColumn || "—"}, employeeName → ${gridMapping.employeeNameColumn || "—"}, dateHeaderRow → ${gridMapping.dateHeaderRow}, dataStartRow → ${gridMapping.dataStartRow}, firstDateColumn → ${gridMapping.firstDateColumn || "—"}`
      : `employeeCode → ${mapping.employeeCode || "—"}, date → ${mapping.date || "—"}, shiftCode → ${mapping.shiftCode || "—"}`;

  const previewLayoutLabel =
    layoutType === "GRID_DATE_COLUMNS" ? "Tarih Sütunlu Grid" : "Satır Bazlı";

  return (
    <div className="grid gap-6 min-w-0">
      <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_16px_48px_rgba(0,0,0,0.06)]">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
          <div className="min-w-0">
            <div className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
              Enterprise Import Akışı
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-zinc-950">
              Çok Gün / Çok Hafta Import
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              Satır bazlı import ile <span className="font-semibold text-zinc-900">employeeCode,date,shiftCode</span> formatını;
              tarih sütunlu grid ile solda personel, üstte gün başlıkları bulunan çok haftalı planları içeri alabilirsin.
              Shift alanında sistemdeki <span className="font-semibold text-zinc-900">shiftCode</span>, <span className="font-semibold text-zinc-900">signature</span>,
              <span className="font-semibold text-zinc-900"> 2200-0600</span>, <span className="font-semibold text-zinc-900">22:00-06:00</span> gibi saat metinleri veya
              <span className="font-semibold text-zinc-900"> GECE / GÜNDÜZ / A2</span> gibi alias değerleri kullanılabilir.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {supportedLayouts.map((layout) => (
                <label
                  key={layout.code}
                  className={cx(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium",
                    layoutType === layout.code
                      ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                      : "border-zinc-200 bg-white text-zinc-700"
                  )}
                >
                  <input
                    type="radio"
                    checked={layoutType === layout.code}
                    onChange={() => setLayoutType(layout.code)}
                  />
                  {layout.label}
                </label>
              ))}
            </div>

              <div className="mt-2 flex flex-wrap gap-2">

              <label className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700">
                <input
                  type="radio"
                  checked={mode === "merge_days"}
                  onChange={() => setMode("merge_days")}
                />
                merge_days
              </label>

              <label className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700">
                <input
                  type="radio"
                  checked={mode === "skip_existing_days"}
                  onChange={() => setMode("skip_existing_days")}
                />
                skip_existing_days
              </label>
            </div>
          </div>
        
          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              <div className="rounded-[24px] border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 px-5 py-4 shadow-[0_10px_24px_rgba(24,24,27,0.05)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Toplam
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-zinc-950">
                  {stats.total}
                </div>
              </div>
              <div className="rounded-[24px] border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white px-5 py-4 shadow-[0_10px_24px_rgba(16,185,129,0.08)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  Valid
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-emerald-950">
                  {stats.valid}
                </div>
              </div>
              <div className="rounded-[24px] border border-amber-200 bg-gradient-to-b from-amber-50 to-white px-5 py-4 shadow-[0_10px_24px_rgba(245,158,11,0.08)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Warning
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-amber-950">
                  {stats.warnings}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/70 p-3">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Hızlı İşlemler
              </div>

              <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                <button
                  type="button"
                  onClick={fillSample}
                  className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-900 shadow-[0_8px_18px_rgba(99,102,241,0.10)] transition hover:border-indigo-300 hover:bg-indigo-100"
                >
                  Satır Örneği
                </button>

                <button
                  type="button"
                  onClick={fillGridSample}
                  className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-900 shadow-[0_8px_18px_rgba(139,92,246,0.10)] transition hover:border-violet-300 hover:bg-violet-100"
                >
                  Grid Örneği
                </button>

                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 shadow-[0_8px_18px_rgba(24,24,27,0.05)] transition hover:bg-zinc-50"
                >
                  Alanı Temizle
                </button>
              </div>

              <div className="mt-3 text-[11px] leading-5 text-zinc-500">
                Satır örneği tek günlük klasik importu, grid örneği ise çok gün / çok hafta import akışını hızlıca doldurur.
              </div>
            </div>
          </div>
        </div>

        {/* File Upload */}

        <div
          className={cx(
            "mt-4 rounded-xl border-2 border-dashed p-6 text-center text-sm",
            dragActive
              ? "border-indigo-400 bg-indigo-50"
              : "border-zinc-300 bg-zinc-50"
          )}
          onDragOver={(e)=>{
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={()=>setDragActive(false)}
          onDrop={handleDrop}
        >
          CSV, TXT veya Excel (.xlsx / .xls) dosyasını sürükleyin
          veya Excel’den tabloyu yapıştırın

          <div className="mt-3">
            <input
              type="file"
              accept="
              .csv,
              .txt,
              .xlsx,
              .xls,
              text/csv,
              text/plain,
              application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,
              application/vnd.ms-excel
              "
              onChange={handleFileUpload}
              className="text-xs"
            />
          </div>

          <div className="mt-3 text-[11px] text-zinc-500">
            {fileName ? `Yüklenen dosya: ${fileName}` : "Henüz dosya seçilmedi"}
          </div>
        </div>
        
        {importSourceType === "xlsx" && xlsxSheets.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                  Excel Sheet
                </div>
                <select
                  value={selectedSheetName}
                  onChange={(e) => handleSheetChange(e.target.value)}
                  className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                >
                  {xlsxSheets.map((sheet) => (
                    <option key={sheet.name} value={sheet.name}>
                      {sheet.name} • {sheet.rowCount} satır • {sheet.columnCount} kolon
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-900">
                {selectedXlsxSheet
                  ? `Aktif: ${selectedXlsxSheet.name} • ${selectedXlsxSheet.rowCount} satır • ${selectedXlsxSheet.columnCount} kolon`
                  : "Sheet seçin"}
              </div>
            </div>
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700">
              Aktif Layout
            </div>
            <div className="mt-2 text-sm font-semibold text-indigo-950">{previewLayoutLabel}</div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Otomatik Algı
            </div>
            <div className="mt-2 text-sm font-semibold text-zinc-950">
              {detectedLayoutType === "GRID_DATE_COLUMNS" ? "GRID_DATE_COLUMNS" : "ROW"}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Tarih Kolonları
            </div>
            <div className="mt-2 text-sm font-semibold text-zinc-950">{gridDateColumns.length}</div>
          </div>
        </div>
        
        {layoutType === "GRID_DATE_COLUMNS" ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-950">Grid Ön Kontrol</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Preview öncesi mapping ve tarih kolon kalitesini kontrol eder.
                  </div>
                </div>
                <div
                  className={cx(
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    gridValidation.score >= 85
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : gridValidation.score >= 65
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-rose-200 bg-rose-50 text-rose-900"
                  )}
                >
                  Kalite Skoru: {gridValidation.score}/100
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {gridValidation.issues.map((issue, idx) => (
                  <div
                    key={`${issue.level}-${idx}-${issue.text}`}
                    className={cx(
                      "rounded-xl border px-3 py-2 text-xs",
                      issue.level === "ERROR"
                        ? "border-rose-200 bg-rose-50 text-rose-900"
                        : issue.level === "WARNING"
                        ? "border-amber-200 bg-amber-50 text-amber-900"
                        : "border-emerald-200 bg-emerald-50 text-emerald-900"
                    )}
                  >
                    <span className="font-semibold">{issue.level}</span> • {issue.text}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-sm font-semibold text-zinc-950">Grid Özeti</div>
              <div className="mt-3 space-y-2 text-xs text-zinc-600">
                <div>
                  Başlık satırı:
                  <span className="ml-1 font-semibold text-zinc-900">
                    seçilen {gridMapping.dateHeaderRow}
                    {effectiveHeaderRowIndex !== gridMapping.dateHeaderRow
                      ? ` • kullanılan ${effectiveHeaderRowIndex}`
                      : ""}
                  </span>
                </div>
                <div>
                  Veri başlangıcı:
                  <span className="ml-1 font-semibold text-zinc-900">{gridMapping.dataStartRow}</span>
                </div>
                <div>
                  Employee kod kolonu:
                  <span className="ml-1 font-semibold text-zinc-900">{gridMapping.employeeCodeColumn || "—"}</span>
                </div>
                <div>
                  İlk tarih kolonu:
                  <span className="ml-1 font-semibold text-zinc-900">{gridMapping.firstDateColumn || "—"}</span>
                </div>
                <div>
                  Algılanan tarih kolonları:
                  <span className="ml-1 font-semibold text-zinc-900">{gridDateColumns.length}</span>
                </div>
                <div>
                  Tarih aralığı:
                  <span className="ml-1 font-semibold text-zinc-900">
                    {dateColumnRange ? `${dateColumnRange.start} → ${dateColumnRange.end}` : "—"}
                  </span>
                </div>
              </div>

              {availableHeaderRows.length > 0 ? (
                <div className="mt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    İlk satırlar
                  </div>
                  <div className="space-y-2">
                    {availableHeaderRows.map((row) => (
                      <button
                        key={`header-row-preview-${row.index}`}
                        type="button"
                        onClick={() => setGridMapping((m) => ({ ...m, dateHeaderRow: row.index }))}
                        className={cx(
                          "w-full rounded-xl border px-3 py-2 text-left text-[11px]",
                          row.index === gridMapping.dateHeaderRow
                            ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                        )}
                      >
                        <span className="font-semibold">Satır {row.index}</span> • {row.preview}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {(csvHeaders.length > 0 || layoutType === "GRID_DATE_COLUMNS") ? (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-950">Başlık Eşleştirme</div>
                <div className="mt-1 text-xs text-zinc-500">
                  Dış dosyadaki kolonları sistemin beklediği alanlarla eşleştir.
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  layoutType === "GRID_DATE_COLUMNS"
                    ? applySuggestedGridMappingFromHeaders(csvHeaders)
                    : applySuggestedMappingFromHeaders(csvHeaders)
                }
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Otomatik Eşleştir
              </button>
            </div>
            
            {csvHeaders.length === 0 ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                Seçili başlık satırında okunabilir kolon bulunamadı. Yukarıdaki “İlk satırlar” listesinden farklı bir satır seç.
              </div>
            ) : null}

            {layoutType === "GRID_DATE_COLUMNS" ? (
              <>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      employeeCodeColumn
                    </div>
                    <select
                      value={gridMapping.employeeCodeColumn}
                      onChange={(e) => setGridMapping((m) => ({ ...m, employeeCodeColumn: e.target.value }))}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                    >
                      <option value="">Kolon seç</option>
                      {csvHeaders.map((h, index) => (
                        <option key={`grid-employee-${index}-${h}`} value={h}>{toExcelColumnName(index)} • {h}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      employeeNameColumn
                    </div>
                    <select
                      value={gridMapping.employeeNameColumn}
                      onChange={(e) => setGridMapping((m) => ({ ...m, employeeNameColumn: e.target.value }))}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                    >
                      <option value="">Seçme</option>
                      {csvHeaders.map((h, index) => (
                        <option key={`grid-name-${index}-${h}`} value={h}>{toExcelColumnName(index)} • {h}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      dateHeaderRow
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={gridMapping.dateHeaderRow}
                      onChange={(e) =>
                        setGridMapping((m) => ({
                          ...m,
                          dateHeaderRow: Math.max(0, Number(e.target.value || 0)),
                        }))
                      }
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      dataStartRow
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={gridMapping.dataStartRow}
                      onChange={(e) =>
                        setGridMapping((m) => ({
                          ...m,
                          dataStartRow: Math.max(0, Number(e.target.value || 0)),
                        }))
                      }
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      firstDateColumn
                    </div>
                    <select
                      value={gridMapping.firstDateColumn}
                      onChange={(e) => setGridMapping((m) => ({ ...m, firstDateColumn: e.target.value }))}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                    >
                      <option value="">Kolon seç</option>
                      {csvHeaders.map((h, index) => (
                        <option key={`grid-first-date-${h}-${index}`} value={h}>
                          {toExcelColumnName(index)} • {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-900">
                  Algılanan tarih sütunları:
                  <span className="ml-1 font-semibold">
                    {gridDateColumns.length
                      ? gridDateColumns.map((c) => `${toExcelColumnName(c.index)}=${c.isoDate}`).join(" • ")
                      : "bulunamadı"}
                  </span>
                </div>

                <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                  <table className="min-w-[760px] w-full text-xs">
                    <thead>
                      <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                        <th className="border-b border-zinc-200 px-3 py-2">Kolon</th>
                        <th className="border-b border-zinc-200 px-3 py-2">Başlık</th>
                        <th className="border-b border-zinc-200 px-3 py-2">ISO Tarih</th>
                        <th className="border-b border-zinc-200 px-3 py-2">Header Hücresi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gridDateColumns.length === 0 ? (
                        <tr>
                          <td className="px-3 py-3 text-zinc-500" colSpan={4}>
                            Tarih kolonu algılanamadı.
                          </td>
                        </tr>
                      ) : (
                        gridDateColumns.map((col) => (
                          <tr key={`${col.index}-${col.header}`} className="border-b border-zinc-100">
                            <td className="px-3 py-2 font-medium text-zinc-900">
                              {toExcelColumnName(col.index)}
                            </td>
                            <td className="px-3 py-2 text-zinc-700">{col.header}</td>
                            <td className="px-3 py-2 text-zinc-700">{col.isoDate}</td>
                            <td className="px-3 py-2 text-zinc-500">{col.cellRef}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    employeeCode
                  </div>
                  <select
                    value={mapping.employeeCode}
                    onChange={(e) => setMapping((m) => ({ ...m, employeeCode: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                  >
                    {csvHeaders.map((h, index) => (
                      <option key={`employee-${index}-${h}`} value={h}>{toExcelColumnName(index)} • {h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    date
                  </div>
                  <select
                    value={mapping.date}
                    onChange={(e) => setMapping((m) => ({ ...m, date: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                  >
                    {csvHeaders.map((h, index) => (
                      <option key={`date-${index}-${h}`} value={h}>{toExcelColumnName(index)} • {h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    shiftCode
                  </div>
                  <select
                    value={mapping.shiftCode}
                    onChange={(e) => setMapping((m) => ({ ...m, shiftCode: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                  >
                    {csvHeaders.map((h, index) => (
                      <option key={`shift-${index}-${h}`} value={h}>{toExcelColumnName(index)} • {h}</option>
                    ))}
                  </select>
                </div>
              </div>

              )}
          </div>
        ) : null}

        <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-950">Alias Eşleme</div>
              <div className="mt-1 text-xs text-zinc-500">
                GECE / GÜNDÜZ / A2 gibi değerleri vardiya şablonlarına bağla. İstersen şirkete kalıcı kaydet.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAliasPanel((v) => !v)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              {showAliasPanel ? "Gizle" : "Göster"}
            </button>
          </div>

          {showAliasPanel ? (
            <div className="mt-4 grid gap-3">
              {optionsLoading ? (
                <div className="text-xs text-zinc-500">Vardiya seçenekleri yükleniyor...</div>
              ) : unresolvedAliasRows.length === 0 ? (
                <div className="text-xs text-zinc-500">
                  Preview sonrası alias gerektiren satırlar burada listelenecek.
                </div>
              ) : (
                unresolvedAliasRows.map((item) => {
                  const current = aliasMappings[item.sourceValue] ?? aliasMappings[item.normalizedSourceValue];
                  return (
                    <div
                      key={item.normalizedSourceValue || item.sourceValue}
                      className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-3 md:grid-cols-[1.2fr_1.5fr_auto]"
                    >
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                          Kaynak değer
                        </div>
                        <div className="mt-1 text-sm font-medium text-zinc-950">
                          {item.sourceValue}
                        </div>
                        <div className="mt-1 text-[11px] text-zinc-500">
                          norm: {item.normalizedSourceValue} • satır: {item.count}
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                          Shift template
                        </div>
                        <select
                          value={current?.shiftTemplateId ?? ""}
                          onChange={(e) => setAliasTemplate(item.sourceValue, e.target.value)}
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                        >
                          <option value="">Template seç</option>
                          {shiftTemplates.map((shift) => (
                            <option key={shift.id} value={shift.id}>
                              {shift.shiftCode} • {shift.signature}
                            </option>
                          ))}
                        </select>
                      </div>

                      <label className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700">
                        <input
                          type="checkbox"
                          checked={current?.persist ?? true}
                          onChange={(e) => setAliasPersist(item.sourceValue, e.target.checked)}
                        />
                        Kalıcı kaydet
                      </label>
                    </div>
                  );
                })
              )}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
            {importSourceType === "xlsx" ? "Sheet içeriği (TSV dönüştürülmüş)" : "İçe aktarım metni"}
          </div>
          {importSourceType === "xlsx" && selectedSheetName ? (
            <div className="text-[11px] text-zinc-500">Sheet: {selectedSheetName}</div>
          ) : null}
        </div>

        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          spellCheck={false}
          className="mt-2 h-[320px] w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm text-zinc-900 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={runPreview}
            disabled={!canRunPreview}
            className="rounded-2xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-800 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(24,24,27,0.22)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Çalışıyor..." : "Preview"}
          </button>

          <button
            disabled={!canApply || (layoutType === "GRID_DATE_COLUMNS" && gridValidationErrors.length > 0)}
            onClick={runApply}
            className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply
          </button>
        </div>
        
        {layoutType === "GRID_DATE_COLUMNS" && precheckTouched && gridValidationWarnings.length > 0 && gridValidationErrors.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            Preview çalıştırılabilir; ancak grid ön kontrolde uyarılar bulundu. Mapping seçimlerini tekrar gözden geçirmen faydalı olur.
          </div>
        ) : null}

        {/* Date range summary */}

        {dateRange && (
          <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-900">
            Import aralığı: {dateRange.start} → {dateRange.end}
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Skipped
            </div>
            <div className="mt-2 text-2xl font-semibold text-zinc-900">{stats.skipped}</div>
          </div>

          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-700">
              Error
            </div>
            <div className="mt-2 text-2xl font-semibold text-rose-900">{stats.errors}</div>
          </div>

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700">
              Employee
            </div>
            <div className="mt-2 text-2xl font-semibold text-indigo-900">
              {stats.touchedEmployees}
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700">
              Hafta
            </div>
            <div className="mt-2 text-2xl font-semibold text-indigo-900">{stats.touchedWeeks}</div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs leading-6 text-zinc-600">
          <div><span className="font-semibold text-zinc-900">merge_days:</span> gelen günleri yazar, diğer günlere dokunmaz.</div>
          <div><span className="font-semibold text-zinc-900">skip_existing_days:</span> o gün için mevcut override varsa satırı atlar.</div>
          <div>
            Layout seçimi ile satır bazlı veya tarih sütunlu çok haftalı dosya okuyabilirsin.
          </div>
          <div>
            Grid modunda preview butonu, mapping ön kontrolünde kritik hata varsa pasif kalır.
          </div>
          <div>
            Tarih sütunu audit tablosu ile hangi kolonların gün olarak algılandığını net görebilirsin.
          </div>
          <div>
            İpucu: Excel’den tabloyu direkt yapıştırırsan tab ayrımlı veri de desteklenir.
          </div>
          <div>
            Aktif eşleşme:
            <span className="ml-1 font-semibold text-zinc-900">
              {activeMappingSummary}
            </span>
          </div>
        </div>
        
        {preview && rows.length > 0 ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Preview Satırı
              </div>
              <div className="mt-2 text-2xl font-semibold text-zinc-950">{rows.length}</div>
            </div>
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700">
                Tarih Aralığı
              </div>
              <div className="mt-2 text-sm font-semibold text-indigo-950">
                {dateRange ? `${dateRange.start} → ${dateRange.end}` : "—"}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Alias Eşleme
              </div>
              <div className="mt-2 text-2xl font-semibold text-zinc-950">
                {aliasMappingList.length}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Kaynak Dosya
              </div>
              <div className="mt-2 truncate text-sm font-semibold text-zinc-950">
                {fileName || "Yapıştırılan veri"}
              </div>
            </div>
          </div>
        ) : null}

        {/* Conflict Summary */}
        {rows.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">

            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <div className="text-sm font-semibold text-rose-900 mb-2">
                Hata Özeti
              </div>

              {Object.entries(reasonSummary).length === 0 ? (
                <div className="text-xs text-rose-800">Kritik hata özeti bulunmuyor.</div>
              ) : null}

              {Object.entries(reasonSummary)
                .filter(([msg]) => msg?.toLowerCase().includes("bulunamadı"))
                .map(([msg, count]) => (
                  <div key={msg} className="text-xs text-rose-800">
                    {msg} • {count}
                  </div>
                ))}

              {stats.errors > 0 && (
                <button
                  onClick={() => copyRowsByStatus("ERROR")}
                  className="mt-3 text-xs font-semibold text-rose-900 underline"
                >
                  Hatalı satırları kopyala
                </button>
              )}
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-semibold text-amber-900 mb-2">
                Warning Özeti
              </div>

              {Object.entries(reasonSummary).length === 0 ? (
                <div className="text-xs text-amber-800">Warning özeti bulunmuyor.</div>
              ) : null}

              {Object.entries(reasonSummary)
                .filter(([msg]) => msg?.toLowerCase().includes("override") || msg?.toLowerCase().includes("pasif"))
                .map(([msg, count]) => (
                  <div key={msg} className="text-xs text-amber-800">
                    {msg} • {count}
                  </div>
                ))}

              {stats.warnings > 0 && (
                <button
                  onClick={() => copyRowsByStatus("WARNING")}
                  className="mt-3 text-xs font-semibold text-amber-900 underline"
                >
                  Warning satırlarını kopyala
                </button>
              )}
            </div>
          </div>
        )}

        {notice ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
            {error}
          </div>
        ) : null}
      </div>

      {preview ? (
        <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_16px_48px_rgba(0,0,0,0.06)]">
          
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
              Toplam: {stats.total}
            </span>
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900">
              Valid: {stats.valid}
            </span>
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
              Warning: {stats.warnings}
            </span>
            <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-900">
              Error: {stats.errors}
            </span>
          </div>

          <h3 className="mb-4 text-lg font-semibold tracking-[-0.02em] text-zinc-950">
            Preview
          </h3>
          
          <div className="mb-4 flex flex-wrap gap-2">
            {(["ALL", "VALID", "WARNING", "SKIPPED", "ERROR"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setRowFilter(f)}
                className={cx(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  rowFilter === f
                    ? f === "VALID"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                      : f === "WARNING"
                        ? "border-amber-300 bg-amber-50 text-amber-900"
                        : f === "SKIPPED"
                          ? "border-zinc-300 bg-zinc-100 text-zinc-800"
                          : f === "ERROR"
                            ? "border-rose-300 bg-rose-50 text-rose-900"
                            : "border-indigo-300 bg-indigo-50 text-indigo-900"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                )}
              >
                {f === "ALL" ? "Tümü" : f}
                {f === "ALL"
                  ? ` (${stats.total})`
                  : ` (${rows.filter((r) => r.status === f).length})`}
              </button>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 font-medium text-zinc-700">
              Mod: {preview.mode}
            </span>
            <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 font-medium text-indigo-800">
              Employee: {stats.touchedEmployees}
            </span>
            <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 font-medium text-indigo-800">
              Hafta: {stats.touchedWeeks}
            </span>
            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
              Layout: {previewLayoutLabel}
            </span>
          </div>
          
          <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
            Gösterilen satırlar:{" "}
            <span className="font-semibold text-zinc-900">
              {filteredRows.length}
            </span>
            {rowFilter !== "ALL" ? (
              <span> • Filtre: {rowFilter}</span>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  <th className="border-b border-zinc-200 px-3 pb-3">Durum</th>
                  <th className="border-b border-zinc-200 px-3 pb-3">Satır</th>
                  <th className="border-b border-zinc-200 px-3 pb-3">Kaynak</th>
                  <th className="border-b border-zinc-200 px-3 pb-3">Layout</th>
                  <th className="border-b border-zinc-200 px-3 pb-3">Employee</th>
                  <th className="border-b border-zinc-200 px-3 pb-3">Tarih</th>
                  <th className="border-b border-zinc-200 px-3 pb-3">Shift</th>
                  <th className="border-b border-zinc-200 px-3 pb-3">Çözümleme</th>
                  <th className="border-b border-zinc-200 px-3 pb-3">Öneri</th>
                  <th className="border-b border-zinc-200 px-3 pb-3">Hafta</th>
                  <th className="border-b border-zinc-200 px-3 pb-3">Mesaj</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
                  <tr
                    key={`${row.employeeCode}-${row.date}-${row.shiftCode}-${row.sourceCellRef ?? idx}`}
                    className={cx(
                      "border-b border-zinc-100",
                      row.status === "ERROR" && "bg-rose-50/40",
                      row.status === "WARNING" && "bg-amber-50/40"
                    )}
                  >
                    <td className="px-3 py-3">
                      <span
                        className={cx(
                          "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                          row.status === "VALID"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                            : row.status === "WARNING"
                              ? "border-amber-200 bg-amber-50 text-amber-900"
                              : row.status === "SKIPPED"
                                ? "border-zinc-200 bg-zinc-100 text-zinc-700"
                                : "border-rose-200 bg-rose-50 text-rose-900"
                        )}
                      >
                        {row.status}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-zinc-500">{row.line ?? idx + 2}</td>

                    <td className="px-3 py-3 text-zinc-600">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-zinc-900">
                          {row.sourceCellRef ?? "—"}
                        </span>
                        {row.sourceSheetName ? (
                          <span className="text-[11px] text-zinc-500">{row.sourceSheetName}</span>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-zinc-600">
                      {row.layoutType ?? layoutType}
                    </td>

                    <td className="px-3 py-3 font-medium text-zinc-900">
                      {row.employeeCode}
                      {row.employeeName ? ` • ${row.employeeName}` : ""}
                    </td>

                    <td className="px-3 py-3 text-zinc-700">{row.date}</td>

                    <td className="px-3 py-3 text-zinc-700">
                      {row.shiftCode}
                      {row.shiftSignature ? ` • ${row.shiftSignature}` : ""}
                    </td>
                    
                    <td className="px-3 py-3 text-zinc-700">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-zinc-900">
                          {row.resolutionSource === "SHIFT_CODE_EXACT"
                            ? "shiftCode"
                            : row.resolutionSource === "SHIFT_SIGNATURE_EXACT"
                              ? "signature"
                              : row.resolutionSource === "SHIFT_IMPORT_ALIAS"
                                ? "alias"
                                : row.resolutionSource === "SHIFT_TEXT_NORMALIZED"
                                  ? "normalize"
                                  : row.resolutionSource === "SHIFT_TIME_PARSED"
                                    ? "saat-parse"
                                    : "—"}
                        </span>

                        {row.parsedShiftSignature ? (
                          <span className="text-[11px] text-zinc-500">parsed: {row.parsedShiftSignature}</span>
                        ) : row.normalizedShiftCode ? (
                          <span className="text-[11px] text-zinc-500">norm: {row.normalizedShiftCode}</span>
                        ) : null}
                      </div>
                    </td>
                    
                    <td className="px-3 py-3 text-zinc-700">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-zinc-900">
                          {row.suggestedAction === "CREATE_TEMPLATE"
                            ? "Template açılabilir"
                            : row.suggestedAction === "REVIEW_ALIAS"
                              ? "Alias tanımlanmalı"
                              : row.suggestedAction === "FIX_REQUIRED_FIELDS"
                                ? "Veri düzeltilmeli"
                                : row.suggestedAction === "CHECK_EMPLOYEE"
                                  ? "Employee kontrol edilmeli"
                                  : row.suggestedAction === "CHECK_SHIFT_TEXT"
                                    ? "Kaynak değer kontrol edilmeli"
                                    : "—"}
                        </span>
                        {row.suggestedTemplateLabel ? <span className="text-[11px] text-zinc-500">{row.suggestedTemplateLabel}</span> : null}
                        {row.suggestedReason ? <span className="text-[11px] text-zinc-500">{row.suggestedReason}</span> : null}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-zinc-700">{row.weekStart ?? "—"}</td>

                    <td className="px-3 py-3 text-zinc-600">{row.message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}