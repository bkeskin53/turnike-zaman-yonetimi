import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { getSessionOrNull } from "@/src/auth/guard";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import { dbDateFromDayKey, dayKeyToday, isISODate } from "@/src/utils/dayKey";
import { parseCsvText } from "@/src/utils/csv";

type ImportIssue = {
  // CSV line number (1-based). 0 means "general / not tied to a single line".
  line: number;
  // Which employeeCode caused this issue (preferred identifier for UX).
  employeeCode?: string;
  code: string;
  message: string;
  field?: "employeeCode" | "firstName" | "lastName" | "email" | "isActive" | "branchCode" | "hireDate" | "terminationDate" | "employmentAction";
  value?: string;
};

type ImportChange = {
  employeeCode: string;
  action: "CREATE" | "UPDATE" | "SKIP";
  // only for UPDATE: which fields would change
  changedFields?: Array<"firstName" | "lastName" | "email" | "isActive" | "branchCode" | "hireDate" | "terminationDate" | "employmentAction">;
  // for display/debug (small payload)
  before?: { firstName: string; lastName: string; email: string | null; isActive: boolean; branchCode: string | null; hireDate: string | null; terminationDate: string | null; employmentAction: string | null };
  after?: { firstName: string; lastName: string; email: string | null; isActive: boolean; branchCode: string | null; hireDate: string | null; terminationDate: string | null; employmentAction: string | null };
};

async function requireAdminOrHr() {
  const session = await getSessionOrNull();
  if (!session) return null;
  if (session.role !== UserRole.SYSTEM_ADMIN && session.role !== UserRole.HR_OPERATOR) return null;
  return session;
}

type ImportRow = {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  isActive: boolean;
  // Optional: if provided, employee will be assigned to that Branch (by Branch.code).
  branchCode: string | null;
  hireDate: string | null; // "YYYY-MM-DD"
  terminationDate: string | null; // "YYYY-MM-DD"
  employmentAction: "HIRE" | "TERMINATE" | "REHIRE" | null;
};

type ResolvedImportRow = ImportRow & { branchId: string | null };

type ImportMapping = {
  mode: "HEADER" | "INDEX";
  // HEADER: normalized header key string; INDEX: column index number
  columns: {
    employeeCode: string | number;
    firstName: string | number;
    lastName: string | number;
    email?: string | number;
    isActive?: string | number;
    branchCode?: string | number;
    hireDate?: string | number;
    terminationDate?: string | number;
    employmentAction?: string | number;
  };
};

function isValidIsoDayKey(s: string): boolean {
  if (!isISODate(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === s;
}

function computeIsActiveFromDates(args: { todayDb: Date; hireDateDb: Date | null; terminationDateDb: Date | null }): boolean {
  const { todayDb, hireDateDb, terminationDateDb } = args;
  if (hireDateDb && todayDb < hireDateDb) return false; // scheduled hire
  // SAP-like: terminationDate is effective from that date (inclusive)
  if (terminationDateDb && todayDb >= terminationDateDb) return false; // termination today or in the past
  return true; // active (including future termination, or termination today)
}

function normalizeEmploymentAction(v: string | null | undefined): "HIRE" | "TERMINATE" | "REHIRE" | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s) return null;
  if (s === "HIRE") return "HIRE";
  if (s === "TERMINATE") return "TERMINATE";
  if (s === "REHIRE") return "REHIRE";
  return null;
}

function isLikelyEmail(v: string) {
  const s = (v ?? "").trim();
  if (!s) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function normalizeHeaderKey(k: string) {
  // Kurumsal kopyala-yapıştır dünyası:
  // - Türkçe karakterler (İ/ı/ş/ğ/ü/ö/ç)
  // - Noktalama (A/P)
  // - Boşluklar
  // hepsini stabil bir anahtara çeviriyoruz.
  return String(k ?? "")
    .trim()
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/i̇/g, "i") // "İ" lower-case bazı ortamlarda i + combining dot üretebiliyor
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_]/g, ""); // "/" gibi karakterleri temizle (A/P => ap)
}

function parseBool(v: string | null | undefined): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return true; // default true
  if (["0", "false", "hayir", "no", "n", "pasif", "inactive"].includes(s)) return false;
  // A/P gibi kısaltmalar da gelsin: A=aktif, P=pasif
  if (["p"].includes(s)) return false;
  if (["1", "true", "evet", "yes", "y", "aktif", "active", "a"].includes(s)) return true;
  return true;
}

function mappingUsesSameSourceForName(mapping: ImportMapping | null): boolean {
  if (!mapping) return false;
  const a = (mapping.columns as any)?.firstName;
  const b = (mapping.columns as any)?.lastName;
  if (mapping.mode === "INDEX") {
    const ai = typeof a === "number" ? a : Number.isFinite(Number(a)) ? Number(a) : null;
    const bi = typeof b === "number" ? b : Number.isFinite(Number(b)) ? Number(b) : null;
    return ai !== null && bi !== null && ai === bi;
  }
  // HEADER
  return String(a ?? "").trim() !== "" && String(a ?? "").trim() === String(b ?? "").trim();
}

function splitFullNameHeuristic(full: string): { firstName: string; lastName: string } | null {
  const s = String(full ?? "").trim().replace(/\s+/g, " ");
  if (!s) return null;
  const parts = s.split(" ").filter(Boolean);
  if (parts.length < 2) return null;
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(" ");
  if (!firstName || !lastName) return null;
  return { firstName, lastName };
}

function toImportRow(raw: Record<string, string>): ImportRow {
  const employeeCode = String(
    raw.employeeCode ?? raw.code ?? raw.kod ?? raw.numara ?? raw.sicil ?? raw.sicilno ?? ""
  ).trim();
  const firstName = String(raw.firstName ?? raw.firstname ?? raw.ad ?? raw.adi ?? raw.isim ?? raw.name ?? "").trim();
  const lastName = String(
    raw.lastName ?? raw.lastname ?? raw.soyad ?? raw.soyadi ?? raw.soyisim ?? raw.surname ?? ""
  ).trim();
  const emailRaw = String(raw.email ?? raw.eposta ?? raw.mail ?? "").trim();
  const isActiveRaw = String(raw.isActive ?? raw.isactive ?? raw.ap ?? raw.durum ?? raw.status ?? raw.aktif ?? raw.active ?? "").trim();
  const isActive = parseBool(isActiveRaw);
  const branchCodeRaw = String(raw.branchCode ?? raw.branch ?? raw.sube ?? raw.subekodu ?? raw.lokasyon ?? raw.lokasyonkodu ?? "").trim();
  const hireDateRaw = String(raw.hireDate ?? raw.isegiristarihi ?? raw.isegiris ?? raw.startdate ?? raw.baslangictarihi ?? "").trim();
  const terminationDateRaw = String(raw.terminationDate ?? raw.cikistarihi ?? raw.istenayrilistarihi ?? raw.enddate ?? raw.bitistarihi ?? "").trim();
  const employmentActionRaw = String(raw.employmentAction ?? raw.action ?? raw.islem ?? raw.personnelaction ?? "").trim();

  return {
    employeeCode,
    firstName,
    lastName,
    email: emailRaw ? emailRaw : null,
    isActive,
    branchCode: branchCodeRaw ? branchCodeRaw : null,
    hireDate: hireDateRaw ? hireDateRaw : null,
    terminationDate: terminationDateRaw ? terminationDateRaw : null,
    employmentAction: normalizeEmploymentAction(employmentActionRaw),
  };
}

export async function POST(req: NextRequest) {
  const session = await requireAdminOrHr();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const companyId = await getActiveCompanyId();
  const bundle = await getCompanyBundle();
  const tz = bundle.policy?.timezone || "Europe/Istanbul";
  const todayKey = dayKeyToday(tz);
  const todayDb = dbDateFromDayKey(todayKey);

  const body = await req.json().catch(() => null);
  const csvText = String(body?.csvText ?? "");
  const dryRun = body?.dryRun === true;
  const mapping = (body?.mapping ?? null) as ImportMapping | null;

  if (!csvText.trim()) {
    return NextResponse.json({ error: "CSV_TEXT_REQUIRED", message: "CSV metni boş olamaz." }, { status: 400 });
  }

  const { rows } = parseCsvText(csvText);
  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV_EMPTY", message: "CSV içinde hiç satır bulunamadı." }, { status: 400 });
  }
  const first = rows[0].map((c) => normalizeHeaderKey(c));
  // Header tespiti: false-positive (başlıksız ilk satırın header sanılması) olmasın diye
  // aynı satırda EN AZ 2 header ipucu arıyoruz.
  const headerHintRe =
    /(^|_)?(employeecode|employee_code|sicil|sicilno|pernr|personel|kod|code|numara|adi|ad|isim|soyadi|soyad|soyisim|firstname|lastname|email|mail|eposta|isactive|aktif|durum|status|ap|branch|branchcode|sube|subekodu|lokasyon|lokasyonkodu|hiredate|terminationdate|employmentaction|action|islem)($|_)?/;
  const headerHits = first.reduce((acc, h) => acc + (headerHintRe.test(h) ? 1 : 0), 0);
  const looksLikeHeader = headerHits >= 2;

  let header: string[];
  let dataRows: string[][];

  if (looksLikeHeader) {
    header = rows[0].map((c) => normalizeHeaderKey(c));
    dataRows = rows.slice(1);
  } else {
    header = ["employeecode", "firstname", "lastname", "email", "isactive", "branchcode", "hiredate", "terminationdate", "employmentaction"];
    dataRows = rows;
  }

  // Helper: read value by mapping
  function pickValue(row: string[], hdr: string[], key: string, mp: ImportMapping | null): string {
    if (mp?.mode === "INDEX") {
      const rawIdx = (mp.columns as any)?.[key];
      let idx: number | null = null;

      if (typeof rawIdx === "number" && Number.isFinite(rawIdx)) idx = rawIdx;
      else if (typeof rawIdx === "string" && rawIdx.trim() && /^[0-9]+$/.test(rawIdx.trim())) {
        idx = Number.parseInt(rawIdx.trim(), 10);
      }

      if (idx !== null && idx >= 0 && idx < row.length) {
        return String(row[idx] ?? "").trim();
      }
      return "";
    }
    if (mp?.mode === "HEADER") {
      const h = (mp.columns as any)?.[key];
      if (typeof h === "string" && h.trim()) {
        const target = normalizeHeaderKey(h);
        const j = hdr.indexOf(target);
        if (j >= 0) return String(row[j] ?? "").trim();
      }
      return "";
    }
    // Fallback: existing alias logic (header-based)
    const obj: Record<string, string> = {};
    for (let j = 0; j < hdr.length; j++) obj[hdr[j]] = String(row[j] ?? "").trim();
    if (key === "employeeCode") return obj.employeecode ?? obj.code ?? obj.kod ?? obj.numara ?? obj.sicil ?? obj.sicilno ?? "";
    if (key === "firstName") return obj.firstname ?? obj.ad ?? obj.adi ?? obj.isim ?? obj.name ?? "";
    if (key === "lastName") return obj.lastname ?? obj.soyad ?? obj.soyadi ?? obj.soyisim ?? obj.surname ?? "";
    if (key === "email") return obj.email ?? obj.eposta ?? obj.mail ?? "";
    if (key === "isActive") return obj.isactive ?? obj.ap ?? obj.durum ?? obj.status ?? obj.aktif ?? obj.active ?? "";
    if (key === "branchCode") return obj.branchcode ?? obj.branch ?? obj.sube ?? obj.subekodu ?? obj.lokasyon ?? obj.lokasyonkodu ?? "";
    if (key === "hireDate") return obj.hiredate ?? obj.isegiristarihi ?? obj.isegiris ?? obj.startdate ?? obj.baslangictarihi ?? "";
    if (key === "terminationDate") return obj.terminationdate ?? obj.cikistarihi ?? obj.istenayrilistarihi ?? obj.enddate ?? obj.bitistarihi ?? "";
    if (key === "employmentAction") return obj.employmentaction ?? obj.action ?? obj.islem ?? obj.personnelaction ?? "";

    return "";
  }

  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const parsed: ImportRow[] = [];
  const parsedLineByCode = new Map<string, number>();
  const seenCodeCounts = new Map<string, number>();
  const sameNameSource = mappingUsesSameSourceForName(mapping);

  // Central helper: always attach employeeCode when we know it.
  function pushError(issue: ImportIssue) {
    errors.push(issue);
  }
  function pushWarning(issue: ImportIssue) {
    warnings.push(issue);
  }

  for (let i = 0; i < dataRows.length; i++) {
    const lineNo = looksLikeHeader ? i + 2 : i + 1;
    const r = dataRows[i];
    if (!r || r.every((c) => !String(c ?? "").trim())) continue;

    const canon: Record<string, string> = {
      employeeCode: pickValue(r, header, "employeeCode", mapping),
      firstName: pickValue(r, header, "firstName", mapping),
      lastName: pickValue(r, header, "lastName", mapping),
      email: pickValue(r, header, "email", mapping),
      isActive: pickValue(r, header, "isActive", mapping),
      branchCode: pickValue(r, header, "branchCode", mapping),
      hireDate: pickValue(r, header, "hireDate", mapping),
      terminationDate: pickValue(r, header, "terminationDate", mapping),
      employmentAction: pickValue(r, header, "employmentAction", mapping),
    };

    const row = toImportRow(canon);
    const codeForIssue = row.employeeCode ? row.employeeCode : (String(canon.employeeCode ?? "").trim() || undefined);

    // Kurumsal HR Excel senaryosu: "Ad Soyad" tek kolonda.
    // Eğer firstName+lastName aynı kaynaktan geliyorsa ve değer boşluk içeriyorsa:
    // "Ahmet Ali Yılmaz" => firstName="Ahmet Ali", lastName="Yılmaz"
    if (
      sameNameSource &&
      row.firstName &&
      (!row.lastName || row.lastName === row.firstName) &&
      /\s/.test(row.firstName)
    ) {
     const split = splitFullNameHeuristic(row.firstName);
      if (split) {
        const before = row.firstName;
        row.firstName = split.firstName;
        row.lastName = split.lastName;
        warnings.push({
         line: lineNo,
          code: "FULL_NAME_SPLIT",
          field: "firstName",
          value: before,
          message: `Bilgi: "Ad Soyad" tek kolonda göründüğü için otomatik ayırdım → Ad: "${row.firstName}", Soyad: "${row.lastName}".`,
        });
      }
    }

    if (!row.employeeCode) {
      pushError({
        line: lineNo,
        employeeCode: codeForIssue,
        code: "EMPLOYEE_CODE_REQUIRED",
        field: "employeeCode",
        message: "Sicil No (employeeCode) boş olamaz.",
      });
      continue;
    }
    if (!row.firstName) {
      pushError({
        line: lineNo,
        employeeCode: codeForIssue,
        code: "FIRST_NAME_REQUIRED",
        field: "firstName",
        message: `Ad (firstName) boş olamaz. (Sicil: ${row.employeeCode})`,
      });
      continue;
    }
    if (!row.lastName) {
      pushError({
        line: lineNo,
        employeeCode: codeForIssue,
        code: "LAST_NAME_REQUIRED",
        field: "lastName",
        message: `Soyad (lastName) boş olamaz. (Sicil: ${row.employeeCode})`,
      });
      continue;
    }
    // Email is optional. If invalid, treat as WARNING and ignore email for this row.
    if (row.email && !isLikelyEmail(row.email)) {
      pushWarning({
        line: lineNo,
        employeeCode: row.employeeCode,
        code: "INVALID_EMAIL",
        field: "email",
        value: row.email,
        message: `E-posta geçersiz görünüyor; bu satırda e-posta yok sayıldı: "${row.email}". (E-posta alanı opsiyoneldir)`,
      });
      row.email = null;
    }

    // employmentAction validation (optional)
    if (canon.employmentAction && !row.employmentAction) {
      pushError({
        line: lineNo,
        employeeCode: row.employeeCode,
        code: "INVALID_EMPLOYMENT_ACTION",
        field: "employmentAction",
        value: canon.employmentAction,
        message: `İşlem türü (employmentAction) geçersiz: "${canon.employmentAction}". Kabul edilen değerler: HIRE | TERMINATE | REHIRE.`,
      });
      continue;
    }

    // Dates (SAP-like): if provided, they become authoritative for employment status.
    if (row.hireDate && !isValidIsoDayKey(row.hireDate)) {
      pushError({
        line: lineNo,
        employeeCode: row.employeeCode,
        code: "INVALID_HIRE_DATE",
        field: "hireDate",
        value: row.hireDate,
        message: `İşe giriş tarihi (hireDate) ISO formatında olmalı: YYYY-MM-DD (örn. 2026-02-10).`,
      });
      continue;
    }
    if (row.terminationDate && !isValidIsoDayKey(row.terminationDate)) {
      pushError({
        line: lineNo,
        employeeCode: row.employeeCode,
        code: "INVALID_TERMINATION_DATE",
        field: "terminationDate",
        value: row.terminationDate,
        message: `İşten çıkış tarihi (terminationDate) ISO formatında olmalı: YYYY-MM-DD (örn. 2026-12-31).`,
      });
      continue;
    }
    if (row.hireDate && row.terminationDate && row.terminationDate < row.hireDate) {
      pushError({
        line: lineNo,
        employeeCode: row.employeeCode,
        code: "TERMINATION_BEFORE_HIRE",
        field: "terminationDate",
        value: row.terminationDate,
        message: `İşten çıkış tarihi (terminationDate=${row.terminationDate}), işe giriş tarihinden (hireDate=${row.hireDate}) önce olamaz.`,
      });
      continue;
    }

    // Duplicate detection (CSV içinde aynı sicil birden fazla kez gelirse)
    const prevCount = seenCodeCounts.get(row.employeeCode) ?? 0;
    seenCodeCounts.set(row.employeeCode, prevCount + 1);
    // İlk kez görüyorsak satır numarasını sakla (debug)
    // Keep the latest line number for this employeeCode (last-one-wins semantics)
    parsedLineByCode.set(row.employeeCode, lineNo);

    parsed.push(row);
  }

  const byCode = new Map<string, ImportRow>();
  for (const r of parsed) byCode.set(r.employeeCode, r); // last-one-wins
  const uniqueRows = [...byCode.values()];

  // Resolve optional branchCode → branchId (by Branch.code within the active company).
  const branchCodes = Array.from(
    new Set(uniqueRows.map((r) => (r.branchCode ? String(r.branchCode).trim() : "")).filter(Boolean))
  );

  const branchByCode = new Map<string, { id: string; code: string }>();
  if (branchCodes.length > 0) {
    const branches = await prisma.branch.findMany({
      where: { companyId, code: { in: branchCodes } },
      select: { id: true, code: true },
    });
    for (const b of branches) branchByCode.set(b.code, b);
  }

  // Rows with an unknown branchCode are rejected (line-specific) to avoid silent mis-assignments.
  const branchErrorsByEmployeeCode = new Set<string>();
  for (const r of uniqueRows) {
    if (!r.branchCode) continue;
    const key = String(r.branchCode).trim();
    if (!branchByCode.has(key)) {
      const lineNo = parsedLineByCode.get(r.employeeCode) ?? 0;
      pushError({
        line: lineNo,
        employeeCode: r.employeeCode,
        code: "BRANCH_CODE_NOT_FOUND",
        field: "branchCode",
        value: key,
        message: `Şube/Branch kodu bulunamadı: "${key}". (Önce /org ekranından bu Branch'i oluşturmalısın.)`,
      });
      branchErrorsByEmployeeCode.add(r.employeeCode);
    }
  }

  const resolvedRows: ResolvedImportRow[] = uniqueRows
    .map((r) => {
      const branchId = r.branchCode ? branchByCode.get(String(r.branchCode).trim())?.id ?? null : null;
      return { ...r, branchId };
    })
    .filter((r) => !branchErrorsByEmployeeCode.has(r.employeeCode));

  // ---- SAP-safe termination validation (no silent wrong) ----
  // If terminationDate is provided for an existing employee, there MUST be an open employment period.
  // Also terminationDate cannot be before open.startDate.
  const terminationErrorsByEmployeeCode = new Set<string>();
  const rowsNeedingTerminationCheck = resolvedRows.filter((r) => Boolean(r.terminationDate));
  if (rowsNeedingTerminationCheck.length > 0) {
    const codes = rowsNeedingTerminationCheck.map((r) => r.employeeCode);
    const existingForTermination = await prisma.employee.findMany({
      where: { companyId, employeeCode: { in: codes } },
      select: { id: true, employeeCode: true },
    });
    const exByCode = new Map(existingForTermination.map((e) => [e.employeeCode, e]));
   const employeeIdsForTermination = existingForTermination.map((e) => e.id);

    const openPeriods = employeeIdsForTermination.length
      ? await prisma.employeeEmploymentPeriod.findMany({
          where: { companyId, employeeId: { in: employeeIdsForTermination }, endDate: null },
          select: { employeeId: true, startDate: true },
        })
      : [];
    const openByEmployeeId = new Map(openPeriods.map((p) => [p.employeeId, p]));

    for (const r of rowsNeedingTerminationCheck) {
      const ex = exByCode.get(r.employeeCode);
      // New employee create case: terminationDate is allowed (we will create one period with endDate).
      if (!ex) continue;

      const termKey = String(r.terminationDate).trim();
      const terminationDateDb = termKey ? dbDateFromDayKey(termKey) : null;
      if (!terminationDateDb) continue;

      const open = openByEmployeeId.get(ex.id) ?? null;
      const lineNo = parsedLineByCode.get(r.employeeCode) ?? 0;
      if (!open) {
        pushError({
          line: lineNo,
          employeeCode: r.employeeCode,
          code: "TERMINATION_NO_OPEN_PERIOD",
          field: "terminationDate",
          value: termKey,
          message: `İşten çıkış tarihi girilmiş; ancak personelin açık istihdam dönemi yok (endDate=null). Önce açık dönem bulunmalı / oluşturulmalı.`,
        });
        terminationErrorsByEmployeeCode.add(r.employeeCode);
        continue;
      }
      const openStartKey = open.startDate.toISOString().slice(0, 10);
      if (termKey < openStartKey) {
        pushError({
          line: lineNo,
          employeeCode: r.employeeCode,
          code: "TERMINATION_BEFORE_OPEN_PERIOD",
          field: "terminationDate",
          value: termKey,
          message: `İşten çıkış tarihi (${termKey}), açık istihdam dönemi başlangıcından (${openStartKey}) önce olamaz.`,
        });
        terminationErrorsByEmployeeCode.add(r.employeeCode);
        continue;
      }
    }
  }

  const effectiveRows: ResolvedImportRow[] = resolvedRows.filter(
    (r) => !terminationErrorsByEmployeeCode.has(r.employeeCode)
  );

  // ---- SAP-safe hireDate rules + REHIRE gate ----
  // Option-1:
  // - UPDATE hireDate cannot change silently.
  // - If hireDate differs and employmentAction=REHIRE => allowed (creates a new period).
  // - Otherwise => error HIRE_DATE_UPDATE_NOT_ALLOWED and row rejected.
  const hireRuleErrorsByEmployeeCode = new Set<string>();
  const hireRuleCandidates = effectiveRows.filter((r) => Boolean(r.hireDate));
  if (hireRuleCandidates.length > 0) {
    const codes = hireRuleCandidates.map((r) => r.employeeCode);
    const existingForHireRule = await prisma.employee.findMany({
      where: { companyId, employeeCode: { in: codes } },
      select: { id: true, employeeCode: true },
    });
    const exByCode = new Map(existingForHireRule.map((e) => [e.employeeCode, e]));
    const ids = existingForHireRule.map((e) => e.id);
    const latestPeriods = ids.length
      ? await prisma.employeeEmploymentPeriod.findMany({
          where: { companyId, employeeId: { in: ids } },
          select: { employeeId: true, startDate: true, endDate: true },
          orderBy: [{ startDate: "desc" }],
        })
      : [];
    const latestByEmployeeId = new Map<string, { startDate: Date; endDate: Date | null }>();
    for (const p of latestPeriods) {
      if (!latestByEmployeeId.has(p.employeeId)) latestByEmployeeId.set(p.employeeId, { startDate: p.startDate, endDate: p.endDate });
    }

    // Open period lookup (used by REHIRE checks)
    const openPeriods = ids.length
      ? await prisma.employeeEmploymentPeriod.findMany({
          where: { companyId, employeeId: { in: ids }, endDate: null },
          select: { employeeId: true, startDate: true },
        })
      : [];
    const openByEmployeeId = new Map(openPeriods.map((p) => [p.employeeId, p]));

    for (const r of hireRuleCandidates) {
      const ex = exByCode.get(r.employeeCode) ?? null;
      // CREATE: hireDate is allowed (handled in create path)
      if (!ex) continue;

      const lp = latestByEmployeeId.get(ex.id) ?? null;
      const lineNo = parsedLineByCode.get(r.employeeCode) ?? 0;

      if (!lp) {
        pushError({
          line: lineNo,
          employeeCode: r.employeeCode,
          code: "HIRE_DATE_NO_PERIOD",
          field: "hireDate",
          value: r.hireDate ?? "",
          message: `Personelin istihdam dönemi (employment period) kaydı bulunamadı. Bu nedenle işe giriş tarihi (hireDate) kontrolü yapılamıyor (veri tutarsız).`,
        });
        hireRuleErrorsByEmployeeCode.add(r.employeeCode);
        continue;
      }

      const currentHireKey = lp.startDate.toISOString().slice(0, 10);
      const incomingHireKey = r.hireDate ?? "";
      if (!incomingHireKey || incomingHireKey === currentHireKey) continue; // no change

      // hireDate differs => only allowed with explicit REHIRE
      if (r.employmentAction !== "REHIRE") {
        pushError({
          line: lineNo,
          employeeCode: r.employeeCode,
          code: "HIRE_DATE_UPDATE_NOT_ALLOWED",
          field: "hireDate",
          value: incomingHireKey,
          message: `İşe giriş tarihi (hireDate) UPDATE edilemez. Mevcut: ${currentHireKey}, CSV: ${incomingHireKey}. Eğer bu bir yeniden işe giriş ise employmentAction=REHIRE kullanılmalıdır.`,
        });
        hireRuleErrorsByEmployeeCode.add(r.employeeCode);
        continue;
      }

      // REHIRE checks:
      // - must have NO open period
      // - last period must be closed (endDate exists)
      // - new hireDate must be strictly after last endDate (avoid overlap)
      const open = openByEmployeeId.get(ex.id) ?? null;
      if (open) {
        pushError({
          line: lineNo,
          employeeCode: r.employeeCode,
          code: "REHIRE_HAS_OPEN_PERIOD",
          field: "employmentAction",
          value: "REHIRE",
          message: `Yeniden işe giriş (REHIRE) için personelin açık dönemi olmamalı (endDate=null). Önce mevcut açık dönem, işten çıkış tarihi (termination) ile kapatılmalıdır.`,
        });
        hireRuleErrorsByEmployeeCode.add(r.employeeCode);
        continue;
      }
      if (!lp.endDate) {
        pushError({
          line: lineNo,
          employeeCode: r.employeeCode,
          code: "REHIRE_LAST_PERIOD_NOT_CLOSED",
          field: "hireDate",
          value: incomingHireKey,
          message: `Yeniden işe giriş (REHIRE) için önceki istihdam dönemi kapalı olmalı (endDate dolu olmalı).`,
        });
        hireRuleErrorsByEmployeeCode.add(r.employeeCode);
        continue;
      }

      const lastEndKey = lp.endDate.toISOString().slice(0, 10);
      if (incomingHireKey <= lastEndKey) {
        pushError({
          line: lineNo,
          employeeCode: r.employeeCode,
          code: "REHIRE_BEFORE_OR_ON_TERMINATION",
          field: "hireDate",
          value: incomingHireKey,
          message: `Yeniden işe giriş hireDate (${incomingHireKey}), önceki çıkış tarihinden (${lastEndKey}) sonra olmalı. (Dönem çakışması olamaz.)`,
        });
        hireRuleErrorsByEmployeeCode.add(r.employeeCode);
        continue;
      }
    }
  }

  const finalRows: ResolvedImportRow[] = effectiveRows.filter(
    (r) => !hireRuleErrorsByEmployeeCode.has(r.employeeCode)
  );

  // Emit duplicate warnings (informational)
  for (const [code, count] of seenCodeCounts.entries()) {
    if (count > 1) {
      pushWarning({
        line: 0,
        employeeCode: code,
        code: "DUPLICATE_EMPLOYEE_CODE_IN_FILE",
        field: "employeeCode",
        value: code,
        message: `Bilgi: Bu Sicil No "${code}" dosyada ${count} kez geçti. Sistem son görünen satırı esas aldı (last-one-wins).`,
      });
    }
  }

  // For UX: compute a preview of what would change (create/update/skip)
  const existingPreview = await prisma.employee.findMany({
    where: { companyId, employeeCode: { in: finalRows.map((r) => r.employeeCode) } },
    select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true, isActive: true, branchId: true, branch: { select: { code: true } } },
  });
  const existingPreviewByCode = new Map(existingPreview.map((e) => [e.employeeCode, e]));

  // Employment preview (latest period per employee)
  const employeeIds = existingPreview.map((e: any) => e.id).filter(Boolean);
  const periods = employeeIds.length
    ? await prisma.employeeEmploymentPeriod.findMany({
        where: { companyId, employeeId: { in: employeeIds } },
        select: { employeeId: true, startDate: true, endDate: true },
        orderBy: [{ startDate: "desc" }],
      })
    : [];
  const latestPeriodByEmployeeId = new Map<string, { startDate: Date; endDate: Date | null }>();
  for (const p of periods) {
    if (!latestPeriodByEmployeeId.has(p.employeeId)) latestPeriodByEmployeeId.set(p.employeeId, { startDate: p.startDate, endDate: p.endDate });
  }

  const changes: ImportChange[] = finalRows.map((r) => {
    const ex = existingPreviewByCode.get(r.employeeCode) ?? null;
    if (!ex) return { employeeCode: r.employeeCode, action: "CREATE" };
    const changedFields: ImportChange["changedFields"] = [];
    if (ex.firstName !== r.firstName) changedFields.push("firstName");
    if (ex.lastName !== r.lastName) changedFields.push("lastName");
    if ((ex.email ?? null) !== (r.email ?? null)) changedFields.push("email");
    // If dates are provided, status comes from dates; otherwise from isActive.
    const hasDates = Boolean(r.hireDate || r.terminationDate);
    let computedIsActive = r.isActive;
    if (hasDates) {
      const hireDb = r.hireDate ? dbDateFromDayKey(r.hireDate) : null;
      const termDb = r.terminationDate ? dbDateFromDayKey(r.terminationDate) : null;
      computedIsActive = computeIsActiveFromDates({ todayDb, hireDateDb: hireDb, terminationDateDb: termDb });
      if (Boolean(ex.isActive) !== Boolean(computedIsActive)) changedFields.push("isActive");
      // compare latest period for date changes (best-effort)
      const lp = latestPeriodByEmployeeId.get(ex.id);
      const beforeHire = lp ? lp.startDate.toISOString().slice(0, 10) : null;
      const beforeTerm = lp?.endDate ? lp.endDate.toISOString().slice(0, 10) : null;
      if (r.hireDate && beforeHire !== r.hireDate) changedFields.push("hireDate");
      if (r.terminationDate && beforeTerm !== r.terminationDate) changedFields.push("terminationDate");
    } else {
      if (Boolean(ex.isActive) !== Boolean(r.isActive)) changedFields.push("isActive");
    }

    if (r.employmentAction === "REHIRE") changedFields.push("employmentAction");

    // Only consider branch changes if branchCode is explicitly provided in this row.
    if (r.branchCode && (ex.branch?.code ?? null) !== (r.branchCode ?? null)) changedFields.push("branchCode");

    if (changedFields.length === 0) return { employeeCode: r.employeeCode, action: "SKIP" };
    return {
      employeeCode: r.employeeCode,
      action: "UPDATE",
      changedFields,
      before: {
        firstName: ex.firstName,
        lastName: ex.lastName,
        email: ex.email ?? null,
        isActive: ex.isActive,
        branchCode: ex.branch?.code ?? null,
        hireDate: latestPeriodByEmployeeId.get(ex.id)?.startDate?.toISOString().slice(0, 10) ?? null,
        terminationDate: latestPeriodByEmployeeId.get(ex.id)?.endDate?.toISOString().slice(0, 10) ?? null,
        employmentAction: null,
      },
      after: { firstName: r.firstName, lastName: r.lastName, email: r.email ?? null, isActive: r.isActive, branchCode: r.branchCode ?? null, hireDate: r.hireDate ?? null, terminationDate: r.terminationDate ?? null, employmentAction: r.employmentAction ?? null },
    };
  });

  if (finalRows.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        dryRun,
        totals: { rows: 0, unique: 0, created: 0, updated: 0, skipped: 0 },
        errors,
        warnings,
        changes,
      },
      { status: 200 }
    );
  }

  const existing = await prisma.employee.findMany({
    where: { companyId, employeeCode: { in: finalRows.map((r) => r.employeeCode) } },
    select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true, isActive: true, branchId: true },
  });
  const existingByCode = new Map(existing.map((e) => [e.employeeCode, e] as const));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  if (!dryRun) {
    await prisma.$transaction(async (tx) => {
      for (const row of finalRows) {
        const hasDates = Boolean(row.hireDate || row.terminationDate);
        const hireDateDb = row.hireDate ? dbDateFromDayKey(row.hireDate) : null;
        const terminationDateDb = row.terminationDate ? dbDateFromDayKey(row.terminationDate) : null;
        const computedIsActive = hasDates
          ? computeIsActiveFromDates({ todayDb, hireDateDb, terminationDateDb })
          : row.isActive;

        if (hasDates && row.isActive !== computedIsActive) {
          pushWarning({
            line: parsedLineByCode.get(row.employeeCode) ?? 0,
            employeeCode: row.employeeCode,
            code: "DATE_STATUS_CONFLICT",
            field: "isActive",
            value: String(row.isActive),
            message: `Uyarı: İşe Giriş/Çıkış (hireDate/terminationDate) girildiği için aktiflik (isActive) tarihlerden hesaplandı. (CSV isActive=${row.isActive} → sistem=${computedIsActive})`,
          });
        }
        const prev = existingByCode.get(row.employeeCode);
        if (!prev) {
          try {
            const employee = await tx.employee.create({
              data: {
                companyId,
                employeeCode: row.employeeCode.trim(),
                firstName: row.firstName.trim(),
                lastName: row.lastName.trim(),
                email: row.email?.trim() || null,
                isActive: computedIsActive,
                ...(row.branchId ? { branchId: row.branchId } : {}),
              },
              select: { id: true },
            });

            const startDate = hireDateDb ?? todayDb;
            // IMPORTANT: Future termination must NOT close the period yet.
            const shouldCloseOnCreate = Boolean(terminationDateDb && todayDb >= terminationDateDb);
            const endDate = shouldCloseOnCreate ? terminationDateDb : null;

            await tx.employeeEmploymentPeriod.create({
              data: {
                companyId,
                employeeId: employee.id,
                startDate,
                endDate,
                reason: hasDates ? "CSV_IMPORT_CREATE_DATES" : "CSV_IMPORT_CREATE",
              },
            });

            await tx.employeeAction.create({
              data: {
               companyId,
                employeeId: employee.id,
                type: "HIRE",
                effectiveDate: startDate,
                note: hasDates ? "CSV_IMPORT_CREATE_DATES" : "CSV_IMPORT_CREATE",
                details: { source: "CSV_IMPORT" },
              },
            });

            // Termination action (including future termination)
            if (terminationDateDb) {
              await tx.employeeAction.create({
                data: {
                  companyId,
                  employeeId: employee.id,
                  type: "TERMINATE",
                  effectiveDate: terminationDateDb,
                  note: "CSV_IMPORT_SET_TERMINATION_DATE",
                  details: { source: "CSV_IMPORT", mode: "SCHEDULED_OR_PAST" },
                },
              });
            }
            created++;
          } catch (e: any) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
              pushError({
                line: 0,
                employeeCode: row.employeeCode,
                code: "EMPLOYEE_CODE_TAKEN",
                field: "employeeCode",
                value: row.employeeCode,
                message: `Bu Sicil No (employeeCode) zaten sistemde kayıtlı: "${row.employeeCode}".`,
              });
              continue;
            }
            throw e;
          }
          continue;
        }

        const changed =
          prev.firstName !== row.firstName ||
          prev.lastName !== row.lastName ||
          (prev.email ?? null) !== (row.email ?? null) ||
          prev.isActive !== computedIsActive ||
          (row.branchCode ? (prev.branchId ?? null) !== (row.branchId ?? null) : false);

        if (!changed) {
          skipped++;
          continue;
        }

        const updateData: Prisma.EmployeeUpdateInput = {
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          email: row.email?.trim() || null,
          // isActive is maintained via employment periods below
        };

        // Only change branch when branchCode is explicitly provided.
        if (row.branchCode) {
          updateData.branch = row.branchId ? { connect: { id: row.branchId } } : { disconnect: true };
        }

        await tx.employee.update({
          where: { id: prev.id },
          data: updateData,
        });
        
        // Employment period updates (safe mode):
        // - If terminationDate is provided: close the latest open period (endDate = terminationDate)
        // - If computedIsActive becomes true and there is no overlap: create a new open period starting todayDb (rehire)
        // - hireDate UPDATE is forbidden (SAP Option-1). (We reject those rows earlier.)

        if (hasDates) {
          // hireDate handling:
          // - if hireDate differs => only allowed when employmentAction=REHIRE (pre-validated above)
          // - in REHIRE: create a new period starting hireDate
          if (row.hireDate && row.employmentAction === "REHIRE") {
            if (!hireDateDb) {
              pushError({
                line: parsedLineByCode.get(row.employeeCode) ?? 0,
                employeeCode: row.employeeCode,
                code: "REHIRE_HIREDATE_REQUIRED",
                field: "hireDate",
                value: row.hireDate ?? "",
                message: `Yeniden işe giriş (REHIRE) için hireDate zorunludur.`,
              });
              skipped++;
              continue;
            }

            // Safety: ensure still no open period (should be true by pre-validation)
            const openNow = await tx.employeeEmploymentPeriod.findFirst({
              where: { companyId, employeeId: prev.id, endDate: null },
              select: { id: true, startDate: true },
              orderBy: [{ startDate: "desc" }],
            });
            if (openNow) {
              pushError({
                line: parsedLineByCode.get(row.employeeCode) ?? 0,
                employeeCode: row.employeeCode,
                code: "REHIRE_HAS_OPEN_PERIOD",
                field: "employmentAction",
                value: "REHIRE",
                message: `REHIRE sırasında personelin açık dönemi bulundu. İşlem güvenlik nedeniyle atlandı.`,
              });
              skipped++;
              continue;
            }

            // Overlap guard (must not overlap any existing period)
            const overlap = await tx.employeeEmploymentPeriod.findFirst({
              where: {
                companyId,
                employeeId: prev.id,
                startDate: { lte: hireDateDb },
                OR: [{ endDate: null }, { endDate: { gte: hireDateDb } }],
              },
              select: { id: true },
            });
            if (overlap) {
              pushError({
                line: parsedLineByCode.get(row.employeeCode) ?? 0,
                employeeCode: row.employeeCode,
                code: "REHIRE_OVERLAP",
                field: "hireDate",
                value: row.hireDate ?? "",
                message: `REHIRE hireDate mevcut istihdam dönemi ile çakışıyor (overlap). İşlem güvenlik nedeniyle atlandı.`,
              });
              skipped++;
              continue;
            }

            // Future termination must not close the period now
            const shouldCloseOnRehire = Boolean(terminationDateDb && todayDb >= terminationDateDb);
            const newEndDate = shouldCloseOnRehire ? terminationDateDb : null;

            const newPeriod = await tx.employeeEmploymentPeriod.create({
              data: {
                companyId,
                employeeId: prev.id,
                startDate: hireDateDb,
                endDate: newEndDate,
                reason: "CSV_IMPORT_REHIRE",
              },
              select: { id: true },
            });

            await tx.employeeAction.create({
              data: {
                companyId,
                employeeId: prev.id,
                type: "REHIRE",
                effectiveDate: hireDateDb,
                note: "CSV_IMPORT_REHIRE",
                details: { source: "CSV_IMPORT", periodId: newPeriod.id },
             },
            });
          } else if (row.hireDate) {
            // Non-REHIRE update attempt already rejected earlier; keep a defensive warning
            pushWarning({
              line: parsedLineByCode.get(row.employeeCode) ?? 0,
              employeeCode: row.employeeCode,
              code: "HIRE_DATE_UPDATE_NOT_ALLOWED",
              field: "hireDate",
              value: row.hireDate,
              message: `İşe giriş tarihi (hireDate) UPDATE edilemez (SAP uyumlu). Yeniden işe giriş için employmentAction=REHIRE kullanılmalıdır.`,
            });
          }
          if (terminationDateDb) {
            const open = await tx.employeeEmploymentPeriod.findFirst({
              where: { companyId, employeeId: prev.id, endDate: null },
              orderBy: [{ startDate: "desc" }],
            });
            if (!open) {
              // Safety net (should not happen because we filtered earlier). Do not write action/update.
              pushError({
                line: parsedLineByCode.get(row.employeeCode) ?? 0,
                employeeCode: row.employeeCode,
                code: "TERMINATION_NO_OPEN_PERIOD",
                field: "terminationDate",
                value: row.terminationDate ?? "",
                message: `İşten çıkış tarihi girildi; ancak personelin açık dönemi bulunamadı. İşlem güvenlik nedeniyle atlandı.`,
              });
              // Do not update employee.isActive, do not create TERMINATE action
              skipped++;
              continue;
            }
            const openStartKey = open.startDate.toISOString().slice(0, 10);
            const termKey = row.terminationDate ?? "";
            if (termKey && termKey < openStartKey) {
              pushError({
                line: parsedLineByCode.get(row.employeeCode) ?? 0,
                employeeCode: row.employeeCode,
                code: "TERMINATION_BEFORE_OPEN_PERIOD",
                field: "terminationDate",
                value: termKey,
                message: `İşten çıkış tarihi (${termKey}), açık dönem başlangıcından (${openStartKey}) önce olamaz. İşlem güvenlik nedeniyle atlandı.`,
              });
              skipped++;
              continue;
            }

            // IMPORTANT: Future termination must NOT close the period yet.
            if (todayDb >= terminationDateDb) {
              await tx.employeeEmploymentPeriod.update({
                where: { id: open.id },
                data: { endDate: terminationDateDb, reason: "CSV_IMPORT_SET_TERMINATION_DATE" },
              });
            }

            await tx.employeeAction.create({
              data: {
                companyId,
                employeeId: prev.id,
                type: "TERMINATE",
                effectiveDate: terminationDateDb,
                note: "CSV_IMPORT_SET_TERMINATION_DATE",
                details: { source: "CSV_IMPORT", mode: "SCHEDULED_OR_PAST" },
              },
            });
          }
          await tx.employee.update({ where: { id: prev.id }, data: { isActive: computedIsActive } });
        } else {
          // old behavior (isActive-driven) stays as-is
          if (prev.isActive !== row.isActive) {
            if (row.isActive === false) {
              const open = await tx.employeeEmploymentPeriod.findFirst({
                where: { companyId, employeeId: prev.id, endDate: null },
                orderBy: [{ startDate: "desc" }],
              });
              if (open) {
                await tx.employeeEmploymentPeriod.update({
                  where: { id: open.id },
                  data: { endDate: todayDb, reason: "CSV_IMPORT_TERMINATE" },
                });
              }

              await tx.employeeAction.create({
                data: {
                  companyId,
                  employeeId: prev.id,
                  type: "TERMINATE",
                  effectiveDate: todayDb,
                  note: "CSV_IMPORT_TERMINATE",
                  details: { source: "CSV_IMPORT" },
                },
              });

              await tx.employee.update({ where: { id: prev.id }, data: { isActive: false } });
            } else {
              const overlap = await tx.employeeEmploymentPeriod.findFirst({
                where: {
                  companyId,
                  employeeId: prev.id,
                  startDate: { lte: todayDb },
                  OR: [{ endDate: null }, { endDate: { gte: todayDb } }],
                },
                select: { id: true },
              });
              if (!overlap) {
                const createdPeriod = await tx.employeeEmploymentPeriod.create({
                  data: {
                    companyId,
                    employeeId: prev.id,
                    startDate: todayDb,
                    endDate: null,
                    reason: "CSV_IMPORT_REHIRE",
                  },
                  select: { id: true },
                });

                await tx.employeeAction.create({
                  data: {
                    companyId,
                    employeeId: prev.id,
                    type: "REHIRE",
                    effectiveDate: todayDb,
                    note: "CSV_IMPORT_REHIRE",
                    details: { source: "CSV_IMPORT", periodId: createdPeriod.id },
                  },
                });
              }

              await tx.employee.update({ where: { id: prev.id }, data: { isActive: true } });
            }
          }
        }
        updated++;
      }
    });
  } else {
    for (const row of finalRows) {
      const prev = existingByCode.get(row.employeeCode);
      if (!prev) {
        created++;
        continue;
      }
      const hasDates = Boolean(row.hireDate || row.terminationDate);
      const hireDateDb = row.hireDate ? dbDateFromDayKey(row.hireDate) : null;
      const terminationDateDb = row.terminationDate ? dbDateFromDayKey(row.terminationDate) : null;
      const computedIsActive = hasDates
        ? computeIsActiveFromDates({ todayDb, hireDateDb, terminationDateDb })
        : row.isActive;
      const changed =
        prev.firstName !== row.firstName ||
          prev.lastName !== row.lastName ||
          (prev.email ?? null) !== (row.email ?? null) ||
          prev.isActive !== computedIsActive ||
          (row.branchCode ? (prev.branchId ?? null) !== (row.branchId ?? null) : false);
      if (changed) updated++;
      else skipped++;
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    totals: {
      rows: dataRows.length,
      unique: finalRows.length,
      created,
      updated,
      skipped,
    },
    errors,
    warnings,
    changes,
  });
}
