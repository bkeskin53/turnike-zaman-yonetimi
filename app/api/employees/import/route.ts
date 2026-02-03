import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { getSessionOrNull } from "@/src/auth/guard";
import { getActiveCompanyId } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import { parseCsvText } from "@/src/utils/csv";

type ImportIssue = {
  // CSV line number (1-based). 0 means "general / not tied to a single line".
  line: number;
  code: string;
  message: string;
  field?: "employeeCode" | "firstName" | "lastName" | "email" | "isActive";
  value?: string;
};

type ImportChange = {
  employeeCode: string;
  action: "CREATE" | "UPDATE" | "SKIP";
  // only for UPDATE: which fields would change
  changedFields?: Array<"firstName" | "lastName" | "email" | "isActive">;
  // for display/debug (small payload)
  before?: { firstName: string; lastName: string; email: string | null; isActive: boolean };
  after?: { firstName: string; lastName: string; email: string | null; isActive: boolean };
};

async function requireAdminOrHr() {
  const session = await getSessionOrNull();
  if (!session) return null;
  if (session.role !== UserRole.ADMIN && session.role !== UserRole.HR) return null;
  return session;
}

type ImportRow = {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  isActive: boolean;
};

type ImportMapping = {
  mode: "HEADER" | "INDEX";
  // HEADER: normalized header key string; INDEX: column index number
  columns: {
    employeeCode: string | number;
    firstName: string | number;
    lastName: string | number;
    email?: string | number;
    isActive?: string | number;
  };
};

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
  const isActive = parseBool(raw.isActive ?? raw.ap ?? raw.durum ?? raw.status ?? raw.aktif ?? raw.active);
  return {
    employeeCode,
    firstName,
    lastName,
    email: emailRaw ? emailRaw : null,
    isActive,
  };
}

export async function POST(req: NextRequest) {
  const session = await requireAdminOrHr();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const companyId = await getActiveCompanyId();

  const body = await req.json().catch(() => null);
  const csvText = String(body?.csvText ?? "");
  const dryRun = body?.dryRun === true;
  const mapping = (body?.mapping ?? null) as ImportMapping | null;

  if (!csvText.trim()) {
    return NextResponse.json({ error: "CSV_TEXT_REQUIRED" }, { status: 400 });
  }

  const { rows } = parseCsvText(csvText);
  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV_EMPTY" }, { status: 400 });
  }
  const first = rows[0].map((c) => normalizeHeaderKey(c));
  // Header tespiti: false-positive (başlıksız ilk satırın header sanılması) olmasın diye
  // aynı satırda EN AZ 2 header ipucu arıyoruz.
  const headerHintRe =
    /(^|_)?(employeecode|employee_code|sicil|sicilno|pernr|personel|kod|code|numara|adi|ad|isim|soyadi|soyad|soyisim|firstname|lastname|email|mail|eposta|isactive|aktif|durum|status|ap)($|_)?/;
  const headerHits = first.reduce((acc, h) => acc + (headerHintRe.test(h) ? 1 : 0), 0);
  const looksLikeHeader = headerHits >= 2;

  let header: string[];
  let dataRows: string[][];

  if (looksLikeHeader) {
    header = rows[0].map((c) => normalizeHeaderKey(c));
    dataRows = rows.slice(1);
  } else {
    header = ["employeecode", "firstname", "lastname", "email", "isactive"];
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
    return "";
  }

  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const parsed: ImportRow[] = [];
  const parsedLineByCode = new Map<string, number>();
  const seenCodeCounts = new Map<string, number>();
  const sameNameSource = mappingUsesSameSourceForName(mapping);

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
    };

    const row = toImportRow(canon);

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
      errors.push({
        line: lineNo,
        code: "EMPLOYEE_CODE_REQUIRED",
        field: "employeeCode",
        message: "Sicil / employeeCode boş olamaz.",
      });
      continue;
    }
    if (!row.firstName) {
      errors.push({
        line: lineNo,
        code: "FIRST_NAME_REQUIRED",
        field: "firstName",
        message: "Ad (firstName) boş olamaz.",
      });
      continue;
    }
    if (!row.lastName) {
      errors.push({
        line: lineNo,
        code: "LAST_NAME_REQUIRED",
        field: "lastName",
        message: "Soyad (lastName) boş olamaz.",
      });
      continue;
    }
    // Email is optional. If invalid, treat as WARNING and ignore email for this row.
    if (row.email && !isLikelyEmail(row.email)) {
      warnings.push({
        line: lineNo,
        code: "INVALID_EMAIL",
        field: "email",
        value: row.email,
        message: `Mail alanı geçersiz olduğu için yok sayıldı: "${row.email}". (Email opsiyoneldir)`,
      });
      row.email = null;
    }

    // Duplicate detection (CSV içinde aynı sicil birden fazla kez gelirse)
    const prevCount = seenCodeCounts.get(row.employeeCode) ?? 0;
    seenCodeCounts.set(row.employeeCode, prevCount + 1);
    // İlk kez görüyorsak satır numarasını sakla (debug)
    if (!parsedLineByCode.has(row.employeeCode)) parsedLineByCode.set(row.employeeCode, lineNo);

    parsed.push(row);
  }

  const byCode = new Map<string, ImportRow>();
  for (const r of parsed) byCode.set(r.employeeCode, r); // last-one-wins
  const uniqueRows = [...byCode.values()];


  // Emit duplicate warnings (informational)
  for (const [code, count] of seenCodeCounts.entries()) {
    if (count > 1) {
      warnings.push({
        line: 0,
        code: "DUPLICATE_EMPLOYEE_CODE_IN_FILE",
        field: "employeeCode",
        value: code,
        message: `Bilgi: employeeCode "${code}" dosyada ${count} kez geçti. Son satır geçerli kabul edildi.`,
      });
    }
  }

  // For UX: compute a preview of what would change (create/update/skip)
  const existingPreview = await prisma.employee.findMany({
    where: { companyId, employeeCode: { in: uniqueRows.map((r) => r.employeeCode) } },
    select: { employeeCode: true, firstName: true, lastName: true, email: true, isActive: true },
  });
  const existingPreviewByCode = new Map(existingPreview.map((e) => [e.employeeCode, e]));
  const changes: ImportChange[] = uniqueRows.map((r) => {
    const ex = existingPreviewByCode.get(r.employeeCode) ?? null;
    if (!ex) return { employeeCode: r.employeeCode, action: "CREATE" };
    const changedFields: ImportChange["changedFields"] = [];
    if (ex.firstName !== r.firstName) changedFields.push("firstName");
    if (ex.lastName !== r.lastName) changedFields.push("lastName");
    if ((ex.email ?? null) !== (r.email ?? null)) changedFields.push("email");
    if (Boolean(ex.isActive) !== Boolean(r.isActive)) changedFields.push("isActive");
    if (changedFields.length === 0) return { employeeCode: r.employeeCode, action: "SKIP" };
    return {
      employeeCode: r.employeeCode,
      action: "UPDATE",
      changedFields,
      before: { firstName: ex.firstName, lastName: ex.lastName, email: ex.email ?? null, isActive: ex.isActive },
      after: { firstName: r.firstName, lastName: r.lastName, email: r.email ?? null, isActive: r.isActive },
    };
  });

  if (uniqueRows.length === 0) {
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
    where: { companyId, employeeCode: { in: uniqueRows.map((r) => r.employeeCode) } },
    select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true, isActive: true },
  });
  const existingByCode = new Map(existing.map((e) => [e.employeeCode, e] as const));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  if (!dryRun) {
    await prisma.$transaction(async (tx) => {
      for (const row of uniqueRows) {
        const prev = existingByCode.get(row.employeeCode);
        if (!prev) {
          try {
            await tx.employee.create({
              data: {
                companyId,
                employeeCode: row.employeeCode.trim(),
                firstName: row.firstName.trim(),
                lastName: row.lastName.trim(),
                email: row.email?.trim() || null,
                isActive: row.isActive,
              },
            });
            created++;
          } catch (e: any) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
              errors.push({
                line: 0,
                code: "EMPLOYEE_CODE_TAKEN",
                field: "employeeCode",
                value: row.employeeCode,
                message: `employeeCode "${row.employeeCode}" zaten mevcut (unique constraint).`,
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
          prev.isActive !== row.isActive;

        if (!changed) {
          skipped++;
          continue;
        }

        await tx.employee.update({
          where: { id: prev.id },
          data: {
            firstName: row.firstName.trim(),
            lastName: row.lastName.trim(),
            email: row.email?.trim() || null,
            isActive: row.isActive,
          },
        });
        updated++;
      }
    });
  } else {
    for (const row of uniqueRows) {
      const prev = existingByCode.get(row.employeeCode);
      if (!prev) {
        created++;
        continue;
      }
      const changed =
        prev.firstName !== row.firstName ||
        prev.lastName !== row.lastName ||
        (prev.email ?? null) !== (row.email ?? null) ||
        prev.isActive !== row.isActive;
      if (changed) updated++;
      else skipped++;
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    totals: {
      rows: dataRows.length,
      unique: uniqueRows.length,
      created,
      updated,
      skipped,
    },
    errors,
    warnings,
    changes,
  });
}
