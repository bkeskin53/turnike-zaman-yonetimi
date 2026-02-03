/**
 * Minimal CSV parser (comma or semicolon) for small admin imports.
 * Supports quoted fields and CRLF.
 * Also supports TAB-separated (TSV) paste from Excel/LibreOffice.
 *
 * Notes:
 * - Designed for Excel-exported CSV and copy/paste.
 * - Not intended for huge files (no streaming).
 */

export type CsvParseResult = {
  delimiter: "," | ";" | "\t";
  rows: string[][];
};

function stripBom(s: string) {
  if (!s) return s;
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function detectDelimiter(firstLine: string): "," | ";" | "\t" {
  const line = firstLine ?? "";
  const commas = (line.match(/,/g) ?? []).length;
  const semis = (line.match(/;/g) ?? []).length;
  const tabs = (line.match(/\t/g) ?? []).length;

  // Excel/LibreOffice copy-paste is usually TSV => prefer TAB when it looks dominant.
  if (tabs > semis && tabs > commas) return "\t";
  if (semis > commas) return ";";
  return ",";
}

function parseLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1];
        if (next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === delimiter) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out.map((v) => v.trim());
}

/**
 * Parses CSV text into rows. Empty rows are ignored.
 */
export function parseCsvText(text: string): CsvParseResult {
  const raw = stripBom(String(text ?? ""));
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { delimiter: ",", rows: [] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const rows = lines.map((l) => parseLine(l, delimiter));
  return { delimiter, rows };
}