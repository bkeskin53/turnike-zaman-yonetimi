"use client";

import { useEffect, useMemo, useState } from "react";

type ToastKind = "success" | "info" | "warn" | "error";
type ToastState = { kind: ToastKind; message: string } | null;

type ImportIssue = {
  line: number;
  employeeCode?: string;
  code: string;
  message: string;
  field?: string;
  value?: string;
};

function issuePrimaryId(issue: ImportIssue): string {
  const code = String(issue.employeeCode ?? "").trim();
  if (code) return code;
  // employeeCode yoksa satırı fallback gösteriyoruz (yine de boş bırakmayalım)
  if (issue.line && issue.line > 0) return `Satır ${issue.line}`;
  return "—";
}

type ImportChange = {
  employeeCode: string;
  action: "CREATE" | "UPDATE" | "SKIP";
  changedFields?: string[];
  before?: { firstName: string; lastName: string; email: string | null; isActive: boolean; branchCode: string | null; hireDate: string | null; terminationDate: string | null };
  after?: { firstName: string; lastName: string; email: string | null; isActive: boolean; branchCode: string | null; hireDate: string | null; terminationDate: string | null };
};

type ImportResult = {
  ok: boolean;
  dryRun: boolean;
  totals: {
    rows: number;
    unique: number;
    created: number;
    updated: number;
    skipped: number;
  };
  errors: ImportIssue[];
  warnings?: ImportIssue[];
  changes?: ImportChange[];
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function normalizeCsvText(s: string) {
  // Keep user content as-is, but trim leading BOM-like whitespace.
  // The server already strips BOM; this is just UX.
  return s.replace(/^\uFEFF/, "");
}

function normalizeKeyClient(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/i̇/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_]/g, "");
}

type ProfileItem = {
  id: string;
  kind: "EMPLOYEES";
  mapping: any;
  updatedAt: string;
};

type ImportMapping = {
  mode: "HEADER" | "INDEX";
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

function isSameNameSource(mapping: ImportMapping | null) {
  if (!mapping) return false;
  const a = (mapping.columns as any)?.firstName;
  const b = (mapping.columns as any)?.lastName;
  if (mapping.mode === "INDEX") {
    // allow numbers or numeric strings
    const ai =
      typeof a === "number" ? a : typeof a === "string" && /^[0-9]+$/.test(a.trim()) ? Number.parseInt(a.trim(), 10) : null;
    const bi =
      typeof b === "number" ? b : typeof b === "string" && /^[0-9]+$/.test(b.trim()) ? Number.parseInt(b.trim(), 10) : null;
    // -1 means "none" in our UI; ignore that
    if (ai === null || bi === null) return false;
    if (ai < 0 || bi < 0) return false;
    return ai === bi;
  }
  // HEADER
  const as = String(a ?? "").trim();
  const bs = String(b ?? "").trim();
  if (!as || !bs) return false;
  return as === bs;
}

function isNoneValue(mode: "HEADER" | "INDEX", v: string | number | undefined) {
  if (mode === "INDEX") return typeof v === "number" && v < 0;
  return typeof v === "string" && !String(v ?? "").trim();
}

function detectDelimiterClient(firstLine: string): "," | ";" | "\t" {
  const line = firstLine ?? "";
  const commas = (line.match(/,/g) ?? []).length;
  const semis = (line.match(/;/g) ?? []).length;
  const tabs = (line.match(/\t/g) ?? []).length;
  if (tabs > semis && tabs > commas) return "\t";
  if (semis > commas) return ";";
  return ",";
}

function splitLineClient(line: string, delimiter: "," | ";" | "\t"): string[] {
  // Simple client splitter for preview purposes (no heavy quoting logic needed for Excel paste).
  // Server will do the authoritative parse.
  return String(line ?? "")
    .split(delimiter)
    .map((s) => s.trim());
}

function sampleCsvComma() {
  return [
    "employeeCode,firstName,lastName,email,isActive,branchCode,hireDate,terminationDate,employmentAction",
    "E001,Burak,Keskin,,true,IST,2026-01-10,,",
    "E002,Aylin,Yılmaz,aylin@firma.com,true,ANK,2026-01-12,2026-02-01,",
    "E003,Mehmet,Demir,,true,IST,2026-01-20,,REHIRE",
  ].join("\n");
}

function sampleCsvSemi() {
  return [
    "employeeCode;firstName;lastName;email;isActive;branchCode;hireDate;terminationDate;employmentAction",
    "E001;Burak;Keskin;;true;IST;2026-01-10;;",
    "E002;Aylin;Yılmaz;aylin@firma.com;true;ANK;2026-01-12;2026-02-01;",
    "E003;Mehmet;Demir;;true;IST;2026-01-20;;REHIRE",
  ].join("\n");
}

export default function EmployeesImportClient() {
  const [csvText, setCsvText] = useState<string>(sampleCsvComma());
  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [hideEmptyCols, setHideEmptyCols] = useState(true);

  const [profile, setProfile] = useState<ProfileItem | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [useProfileMapping, setUseProfileMapping] = useState(true);
  const [draftMapping, setDraftMapping] = useState<ImportMapping | null>(null);

  const hasContent = useMemo(() => normalizeCsvText(csvText).trim().length > 0, [csvText]);

  function showToast(kind: ToastKind, message: string) {
    setToast({ kind, message });
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(null), 3200);
  }

  // Build a lightweight column preview from pasted text
  const preview = useMemo(() => {
    const t = normalizeCsvText(csvText).trim();
    if (!t) return null;
    const lines = t.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
    if (lines.length === 0) return null;
    const delimiter = detectDelimiterClient(lines[0]);
    const firstRow = splitLineClient(lines[0], delimiter);
    const secondRow = lines.length > 1 ? splitLineClient(lines[1], delimiter) : [];

    const looksLikeHeader =
      firstRow.some((h) => /employee|sicil|code|firstname|lastname|email|aktif|active/i.test(h));

    const header = looksLikeHeader ? firstRow : firstRow.map((_, i) => `col_${i + 1}`);
    const sample = looksLikeHeader ? secondRow : firstRow;

    const visibleIdx: number[] = [];
    for (let i = 0; i < header.length; i++) {
      const h = String(header[i] ?? "").trim();
      // When looksLikeHeader is false, headers are synthetic (col_1...) => never treat as empty.
      const isEmptyHeader = looksLikeHeader && !h;
      const isEmptySample = !String(sample?.[i] ?? "").trim();
      if (hideEmptyCols && isEmptyHeader && isEmptySample) continue;
      visibleIdx.push(i);
    }

    return { delimiter, looksLikeHeader, header, sample, visibleIdx };
  }, [csvText, hideEmptyCols]);

  const effectiveMapping: ImportMapping | null = useMemo(() => {
    if (useProfileMapping && profile?.mapping) return profile.mapping as ImportMapping;
    return draftMapping;
  }, [useProfileMapping, profile, draftMapping]);

  const mappingStatus = useMemo(() => {
    const m = effectiveMapping;
    if (!m) {
      return {
        ok: false,
        missing: ["employeeCode", "firstName", "lastName"] as Array<"employeeCode" | "firstName" | "lastName">,
      };
    }
    const miss: Array<"employeeCode" | "firstName" | "lastName"> = [];
    if (isNoneValue(m.mode, m.columns.employeeCode)) miss.push("employeeCode");
    if (isNoneValue(m.mode, m.columns.firstName)) miss.push("firstName");
    if (isNoneValue(m.mode, m.columns.lastName)) miss.push("lastName");
    return { ok: miss.length === 0, missing: miss };
  }, [effectiveMapping]);

  const stepStatus = useMemo(() => {
    const step1 = hasContent;
    const step2 = step1 && mappingStatus.ok;
    const step3 = !!last && last.dryRun === true;
    const step4 = !!last && last.dryRun === false;
    return { step1, step2, step3, step4 };
  }, [hasContent, mappingStatus.ok, last]);

  function buildRecommendedMappingFromPreview(): ImportMapping | null {
    if (!preview) {
      return {
        mode: "INDEX",
        columns: { employeeCode: 0, firstName: 1, lastName: 2, email: 3, isActive: 4, branchCode: -1, hireDate: -1, terminationDate: -1, employmentAction: -1 },
      };
    }

    // If we have real headers, try smart HEADER matching; otherwise fallback to INDEX.
    if (preview.looksLikeHeader) {
      const keys = preview.header.map((h: string) => normalizeKeyClient(h));
      const findHeader = (re: RegExp) => {
        for (let i = 0; i < keys.length; i++) if (re.test(keys[i])) return preview.header[i];
        return "";
      };

      const employeeCode =
        findHeader(/^(employeecode|employee_code|sicil|sicilno|pernr|personel|kod|code|numara)$/) ||
        findHeader(/(sicil|pernr|employeecode|numara|code)/);

      const firstName =
        findHeader(/^(firstname|ad|adi|isim|name)$/) || findHeader(/(firstname|ad|isim|name)/);

      const lastName =
        findHeader(/^(lastname|soyad|soyadi|soyisim|surname)$/) || findHeader(/(lastname|soyad|soy)/);

      const email = findHeader(/^(email|mail|eposta)$/) || findHeader(/(email|mail|eposta)/);
      const isActive = findHeader(/^(isactive|aktif|durum|status|ap)$/) || findHeader(/(aktif|durum|status|ap)/);

      const branchCode =
        findHeader(/^(branchcode|branch|sube|subekodu|lokasyon|lokasyonkodu)$/) ||
        findHeader(/(branchcode|branch|sube|subekodu|lokasyon|lokasyonkodu)/);

      const hireDate =
        findHeader(/^(hiredate|isegiristarihi|isegiris|giris|startdate|baslangictarihi)$/) ||
        findHeader(/(hiredate|isegir|startdate|baslangic)/);

      const terminationDate =
        findHeader(/^(terminationdate|cikistarihi|istenayrilistarihi|ayrilis|enddate|bitistarihi)$/) ||
        findHeader(/(terminationdate|cikis|ayrilis|enddate|bitis)/);

      const employmentAction =
        findHeader(/^(employmentaction|employment_action|action|hareket|islem)$/) ||
        findHeader(/(employmentaction|employment_action|action|hareket|islem|rehire)/);
        
      return {
        mode: "HEADER",
        columns: {
          employeeCode: employeeCode || "",
          firstName: firstName || "",
          lastName: lastName || "",
          email: email || "",
          isActive: isActive || "",
          branchCode: branchCode || "",
          hireDate: hireDate || "",
          terminationDate: terminationDate || "",
          employmentAction: employmentAction || "",
        },
      };
    }

    // No header -> INDEX is more stable.
    return {
      mode: "INDEX",
      columns: { employeeCode: 0, firstName: 1, lastName: 2, email: 3, isActive: 4, branchCode: -1, hireDate: -1, terminationDate: -1, employmentAction: -1 },
    };
  }

  async function loadProfile() {
    setProfileLoading(true);
    try {
      const res = await fetch("/api/employees/import/profile", { method: "GET" });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setProfile(null);
        showToast("warn", "Kayıtlı profil bulunamadı.");
        return;
      }
      setProfile((data?.item ?? null) as ProfileItem | null);
      if (data?.item) showToast("success", "Profil yüklendi.");
    } finally {
      setProfileLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  // Initialize draft mapping from profile (if exists) or from preview (best-effort)
  useEffect(() => {
    if (profile?.mapping && !draftMapping) {
      setDraftMapping(profile.mapping as ImportMapping);
      return;
    }
    if (!draftMapping && preview) {
      // Best-effort: default to index mapping
      setDraftMapping({
        mode: "INDEX",
        columns: { employeeCode: 0, firstName: 1, lastName: 2, email: 3, isActive: 4, branchCode: -1, hireDate: -1, terminationDate: -1, employmentAction: -1 },
      });
    }
  }, [profile, preview, draftMapping]);

  const sameNameSource = useMemo(() => isSameNameSource(draftMapping), [draftMapping]);

  async function run(dryRun: boolean): Promise<ImportResult | null> {
    if (!mappingStatus.ok) {
      showToast("warn", "Önce zorunlu alanları eşleştir: employeeCode, firstName, lastName.");
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const mappingToSend =
        useProfileMapping && profile?.mapping ? (profile.mapping as ImportMapping) : draftMapping;

      const res = await fetch("/api/employees/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          csvText: normalizeCsvText(csvText),
          dryRun,
          mapping: mappingToSend ?? null,
        }),
      });

      const data = (await res.json().catch(() => null)) as any;

      if (!res.ok) {
        setLast(null);
        setError(data?.error ? String(data.error) : `HTTP_${res.status}`);
        return null;
      }

      setLast(data as ImportResult);
      return data as ImportResult;
    } catch (e: any) {
      setLast(null);
      setError(e?.message ? String(e.message) : "NETWORK_ERROR");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function runApplyWithConfirm() {
    // First do a dry-run to learn what will happen (and show it in UI)
    const plan = await run(true);
    if (!plan) return;
    const updates = (plan?.changes ?? []).filter((c) => c.action === "UPDATE");
    if (updates.length > 0) {
      const sample = updates.slice(0, 8).map((u) => u.employeeCode).join(", ");
      const msg =
        `Bu işlem ${updates.length} personeli GÜNCELLEYECEK (mevcut kayıtların üzerine yazacak).\n\n` +
        `Örnek siciller: ${sample}${updates.length > 8 ? "..." : ""}\n\n` +
        `Devam etmek istiyor musun?`;
      const ok = window.confirm(msg);
      if (!ok) return;
    }
    await run(false);
  }

  function resetToSampleComma() {
    setCsvText(sampleCsvComma());
    setLast(null);
    setError(null);
  }

  function resetToSampleSemi() {
    setCsvText(sampleCsvSemi());
    setLast(null);
    setError(null);
  }

  async function saveDraftAsProfile() {
    if (!draftMapping) return;
    setProfileLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/employees/import/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mapping: draftMapping }),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setError(data?.error ? String(data.error) : `HTTP_${res.status}`);
        showToast("error", "Profil kaydedilemedi.");
        return;
      }
      setProfile((data?.item ?? null) as ProfileItem | null);
      setUseProfileMapping(true);
      showToast("success", "Eşleştirme profili kaydedildi.");
    } catch (e: any) {
      setError(e?.message ? String(e.message) : "NETWORK_ERROR");
      showToast("error", "Network hatası (profil kaydı).");
    } finally {
      setProfileLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {toast ? (
        <div
          className={cx(
            "rounded-2xl border px-4 py-3 text-sm",
            toast.kind === "success" && "border-emerald-200 bg-emerald-50 text-emerald-900",
            toast.kind === "info" && "border-zinc-200 bg-zinc-50 text-zinc-900",
            toast.kind === "warn" && "border-amber-200 bg-amber-50 text-amber-900",
            toast.kind === "error" && "border-red-200 bg-red-50 text-red-900"
          )}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold tracking-tight">Employees • CSV İçe Aktar</div>
            <div className="mt-1 text-sm text-zinc-600">
              Excel’den CSV (tercihen UTF-8) oluşturup buraya yapıştır. “Ön izleme (Dry-run)” ile
              kontrol et, sonra “Yaz ve uygula”.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
              onClick={resetToSampleComma}
              disabled={loading}
              title="Virgüllü örnek"
            >
              Örnek ( , )
            </button>
            <button
              type="button"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
              onClick={resetToSampleSemi}
              disabled={loading}
              title="Noktalı virgüllü örnek"
            >
              Örnek ( ; )
            </button>
            <button
              type="button"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
              onClick={() => run(true)}
              disabled={loading || !hasContent || !mappingStatus.ok}
              title="DB’ye yazmadan kontrol et"
            >
              Ön izleme (Dry-run)
            </button>
            <button
              type="button"
              className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              onClick={runApplyWithConfirm}
              disabled={loading || !hasContent || !mappingStatus.ok}
              title="DB’ye yaz ve upsert uygula"
            >
              Yaz ve uygula
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold text-zinc-800">Akış</div>
            <div className="text-xs text-zinc-600">
              {preview ? (
                <span>
                  Ayırıcı: <span className="font-mono">{preview.delimiter === "\t" ? "TAB" : preview.delimiter}</span>{" "}
                  • Header: <b>{preview.looksLikeHeader ? "var" : "yok"}</b>
                </span>
              ) : (
                <span>Veriyi yapıştırınca algılama burada görünür.</span>
              )}
            </div>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-4">
            <StepBadge title="1) Yapıştır" ok={stepStatus.step1} hint="Excel/LibreOffice → kopyala/yapıştır" />
            <StepBadge title="2) Eşleştir" ok={stepStatus.step2} hint="Kolonlar karışık olsa bile" />
            <StepBadge title="3) Ön izleme" ok={stepStatus.step3} hint="Dry-run ile planı gör" />
            <StepBadge title="4) Uygula" ok={stepStatus.step4} hint="Create/Update DB’ye yaz" />
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-800">CSV İçeriği</label>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={14}
              spellCheck={false}
              className="w-full resize-y rounded-xl border border-zinc-200 bg-white p-3 font-mono text-xs leading-5 outline-none focus:border-zinc-400"
              placeholder="employeeCode,firstName,lastName,email,isActive,branchCode,hireDate,terminationDate,employmentAction"
            />
            <div className="mt-2 text-xs text-zinc-500">
              Zorunlu sütunlar: <span className="font-mono">employeeCode</span>,{" "}
              <span className="font-mono">firstName</span>, <span className="font-mono">lastName</span>
              . Opsiyonel: <span className="font-mono">email</span>,{" "}
              <span className="font-mono">isActive</span>,{" "}
              <span className="font-mono">branchCode</span>,{" "}
              <span className="font-mono">hireDate</span>,{" "}
              <span className="font-mono">terminationDate</span>,{" "}
              <span className="font-mono">employmentAction</span>.
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="text-sm font-semibold text-zinc-800">Kurallar</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-zinc-700">
              <li>
                Header varsa otomatik algılanır. Header yoksa sıra:{" "}
                <span className="font-mono">employeeCode, firstName, lastName, email, isActive, branchCode, hireDate, terminationDate, employmentAction</span>
              </li>
              <li>
                Ayırıcı: <span className="font-mono">,</span> veya <span className="font-mono">;</span> veya{" "}
                <span className="font-mono">TAB</span> (Excel/LibreOffice kopyala-yapıştır) — ilk satıra göre otomatik
              </li>
              <li>
                Aynı <span className="font-mono">employeeCode</span> CSV içinde birden çok kez varsa{" "}
                <b>son satır</b> geçerli olur
              </li>
              <li>
                DB’de varsa <b>update</b>, yoksa <b>create</b>
              </li>
              <li>
                <span className="font-mono">isActive</span> boşsa varsayılan <b>true</b>
              </li>
            </ul>

            <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-2">
              <div className="text-xs font-semibold text-zinc-800">Örnek satır</div>
              <div className="mt-1 font-mono text-[11px] text-zinc-700">
                E001,Ad,Soyad,,true,IST,2025-01-10,
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mapping panel */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-zinc-900">Akıllı Kolon Eşleştirme (V2)</div>
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                KURUMSAL
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-900">
                Excel-sırası önemli değil
              </span>
            </div>
            <div className="mt-1 text-xs text-zinc-600">
              Şirket CSV’sinin kolon adları/sırası farklı olabilir. Buradan alanları eşleştirip kaydedebilirsin.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={hideEmptyCols}
                onChange={(e) => setHideEmptyCols(e.target.checked)}
              />
              Boş kolonları gizle
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={useProfileMapping}
                onChange={(e) => setUseProfileMapping(e.target.checked)}
              />
              Kayıtlı eşleştirmeyi kullan
            </label>
            <button
              type="button"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
              onClick={loadProfile}
              disabled={profileLoading}
            >
              Profili Yenile
            </button>
            <button
              type="button"
              className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              onClick={saveDraftAsProfile}
              disabled={profileLoading || !draftMapping}
              title="Bu eşleştirmeyi şirket profiline kaydet"
            >
              Eşleştirmeyi Kaydet
            </button>
          </div>
        </div>
        
        {!mappingStatus.ok ? (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="font-semibold">Zorunlu alanlar eşleşmeli</div>
            <div className="mt-1 text-xs">
              Eksik:{" "}
              <span className="font-mono">
                {mappingStatus.missing.join(", ")}
              </span>
              . Ön izleme ve uygulama için önce eşleştir.
            </div>
          </div>
        ) : null}

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="text-xs font-semibold text-zinc-800">Algılanan kolonlar</div>
            {preview ? (
              <div className="mt-2 overflow-auto rounded-xl border border-zinc-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 text-zinc-700">
                    <tr>
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Kolon</th>
                      <th className="px-3 py-2 font-medium">Örnek</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(preview.visibleIdx ?? []).map((i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono">{i}</td>
                        <td className="px-3 py-2">
                          {String(preview.header?.[i] ?? "").trim() ? preview.header[i] : <span className="text-zinc-400">(boş)</span>}
                        </td>
                        <td className="px-3 py-2 font-mono">{String(preview.sample?.[i] ?? "")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-2 text-xs text-zinc-600">CSV yapıştırınca kolonlar burada görünecek.</div>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-zinc-800">Eşleştirme</div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1 hover:bg-zinc-50 disabled:opacity-50"
                  disabled={!draftMapping}
                  onClick={() => setDraftMapping((m) => (m ? { ...m, mode: "INDEX" } : m))}
                >
                  INDEX
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1 hover:bg-zinc-50 disabled:opacity-50"
                  disabled={!draftMapping}
                  onClick={() => setDraftMapping((m) => (m ? { ...m, mode: "HEADER" } : m))}
                >
                  HEADER
                </button>
                <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                  Önerilen: INDEX
                </span>
              </div>
            </div>

            <div className="mt-2 text-xs text-zinc-600">
              INDEX: kolon numarası seçersin. HEADER: header adı seçersin. (Kurumsalda genelde INDEX daha sağlamdır.)
            </div>

            {sameNameSource ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="font-semibold">Ad Soyad tek kolonda mı?</div>
                <div className="mt-1 text-amber-800">
                  <b>firstName</b> ve <b>lastName</b> aynı kolona eşlendi. Değer “Ad Soyad” şeklindeyse sistem otomatik ayırır:
                  <span className="font-mono"> "Ahmet Ali Yılmaz" → Ad: "Ahmet Ali", Soyad: "Yılmaz"</span>.
                </div>
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white p-2">
              <div className="text-xs text-zinc-700">
                <b>İpucu:</b> Kolon sırası karışık mı? “Önerilen eşleştirme” ile hızlı başla.
              </div>
              <button
                type="button"
                className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50"
                disabled={!preview}
                onClick={() => {
                  const rec = buildRecommendedMappingFromPreview();
                  if (!rec) return;
                  setDraftMapping(rec);
                  setUseProfileMapping(false);
                  showToast("success", "Önerilen eşleştirme uygulandı.");
                }}
              >
                Önerilen eşleştirmeyi uygula
              </button>
            </div>

            <div className="mt-3 space-y-2">
              <MappingRow
                label="employeeCode (zorunlu)"
                preview={preview}
                value={draftMapping?.columns.employeeCode ?? 0}
                mode={draftMapping?.mode ?? "INDEX"}
                onChange={(v) =>
                  setDraftMapping((m) => (m ? { ...m, columns: { ...m.columns, employeeCode: v } } : m))
                }
              />
              <MappingRow
                label="firstName (zorunlu)"
                preview={preview}
                value={draftMapping?.columns.firstName ?? 1}
                mode={draftMapping?.mode ?? "INDEX"}
                onChange={(v) =>
                  setDraftMapping((m) => (m ? { ...m, columns: { ...m.columns, firstName: v } } : m))
                }
              />
              <MappingRow
                label="lastName (zorunlu)"
                preview={preview}
                value={draftMapping?.columns.lastName ?? 2}
                mode={draftMapping?.mode ?? "INDEX"}
                onChange={(v) =>
                  setDraftMapping((m) => (m ? { ...m, columns: { ...m.columns, lastName: v } } : m))
                }
              />
              <MappingRow
                label="email (opsiyonel)"
                preview={preview}
                value={draftMapping?.columns.email ?? 3}
                mode={draftMapping?.mode ?? "INDEX"}
                allowNone
                onChange={(v) =>
                  setDraftMapping((m) => (m ? { ...m, columns: { ...m.columns, email: v } } : m))
                }
              />
              <MappingRow
                label="isActive (opsiyonel)"
                preview={preview}
                value={draftMapping?.columns.isActive ?? 4}
                mode={draftMapping?.mode ?? "INDEX"}
                allowNone
                onChange={(v) =>
                  setDraftMapping((m) => (m ? { ...m, columns: { ...m.columns, isActive: v } } : m))
                }
              />
              <MappingRow
                label="branchCode (opsiyonel)"
                preview={preview}
                value={draftMapping?.columns.branchCode ?? -1}
                mode={draftMapping?.mode ?? "INDEX"}
                allowNone
                onChange={(v) =>
                  setDraftMapping((m) => (m ? { ...m, columns: { ...m.columns, branchCode: v } } : m))
                }
              />
              <MappingRow
                label="hireDate (opsiyonel)"
                preview={preview}
                value={draftMapping?.columns.hireDate ?? -1}
                mode={draftMapping?.mode ?? "INDEX"}
                allowNone
                onChange={(v) =>
                  setDraftMapping((m) => (m ? { ...m, columns: { ...m.columns, hireDate: v } } : m))
                }
              />
              <MappingRow
                label="terminationDate (opsiyonel)"
                preview={preview}
                value={draftMapping?.columns.terminationDate ?? -1}
                mode={draftMapping?.mode ?? "INDEX"}
                allowNone
                onChange={(v) =>
                  setDraftMapping((m) => (m ? { ...m, columns: { ...m.columns, terminationDate: v } } : m))
                }
              />
              <MappingRow
                label="employmentAction (opsiyonel)"
                preview={preview}
                value={draftMapping?.columns.employmentAction ?? -1}
                mode={draftMapping?.mode ?? "INDEX"}
                allowNone
                onChange={(v) =>
                  setDraftMapping((m) => (m ? { ...m, columns: { ...m.columns, employmentAction: v } } : m))
                }
              />           
            </div>
            
            <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-2">
              <div className="text-xs font-semibold text-zinc-800">Eşleştirme özeti</div>
              <div className="mt-1 text-[11px] text-zinc-700">
                {effectiveMapping ? (
                  <div className="space-y-1 font-mono">
                    <div>employeeCode ← {formatMappingValue(effectiveMapping, "employeeCode", preview)}</div>
                    <div>firstName ← {formatMappingValue(effectiveMapping, "firstName", preview)}</div>
                    <div>lastName ← {formatMappingValue(effectiveMapping, "lastName", preview)}</div>
                    <div>email ← {formatMappingValue(effectiveMapping, "email", preview, true)}</div>
                    <div>isActive ← {formatMappingValue(effectiveMapping, "isActive", preview, true)}</div>
                    <div>branchCode ← {formatMappingValue(effectiveMapping, "branchCode", preview, true)}</div>
                    <div>hireDate ← {formatMappingValue(effectiveMapping, "hireDate", preview, true)}</div>
                    <div>terminationDate ← {formatMappingValue(effectiveMapping, "terminationDate", preview, true)}</div>
                    <div>employmentAction ← {formatMappingValue(effectiveMapping, "employmentAction", preview, true)}</div>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-600">Eşleştirme seçince özet burada görünür.</div>
                )}
              </div>
            </div>

            <div className="mt-3 text-xs text-zinc-500">
              Import çalıştırırken: “Kayıtlı eşleştirmeyi kullan” açıksa önce profile mapping kullanılır, yoksa draft kullanılır.
            </div>
          </div>
        </div>
      </div>

      {(error || last) && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-zinc-800">Sonuç</div>
            {last ? (
              <div
                className={cx(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  last.dryRun ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                )}
              >
                {last.dryRun ? "Dry-run" : "Uygulandı"}
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {last ? (
            <div className="mt-3 grid gap-3 md:grid-cols-5">
              <Stat label="Satır" value={last.totals.rows} />
              <Stat label="Unique" value={last.totals.unique} />
              <Stat label="Create" value={last.totals.created} />
              <Stat label="Update" value={last.totals.updated} />
              <Stat label="Skip" value={last.totals.skipped} />

              <div className="md:col-span-5">
                <div className="mt-1 text-xs text-zinc-500">
                  Not: Dry-run’da DB’ye yazılmaz; sadece kaç create/update olacağını hesaplar.
                </div>
              </div>

              {/* Warnings */}
              <div className="md:col-span-5">
                <div className="mt-3 text-sm font-semibold text-zinc-800">Uyarılar</div>
                {last.warnings?.length ? (
                  <div className="mt-2 overflow-auto rounded-xl border border-zinc-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-50 text-zinc-700">
                        <tr>
                          <th className="px-3 py-2 font-medium">Sicil</th>
                          <th className="px-3 py-2 font-medium">Satır</th>
                          <th className="px-3 py-2 font-medium">Kod</th>
                          <th className="px-3 py-2 font-medium">Mesaj</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {last.warnings.slice(0, 200).map((w, i) => (
                          <tr key={`${w.code}-${w.employeeCode ?? "no-code"}-${w.line}-${i}`} className="hover:bg-zinc-50">
                            <td className="px-3 py-2 font-mono">{issuePrimaryId(w)}</td>
                            <td className="px-3 py-2 font-mono">{w.line ? w.line : "—"}</td>
                            <td className="px-3 py-2 font-mono">{w.code}</td>
                            <td className="px-3 py-2">{w.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                    Uyarı yok.
                  </div>
                )}
              </div>

              <div className="md:col-span-5">
                <div className="mt-3 text-sm font-semibold text-zinc-800">Hatalar</div>
                {last.errors?.length ? (
                  <div className="mt-2 overflow-auto rounded-xl border border-zinc-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-50 text-zinc-700">
                        <tr>
                          <th className="px-3 py-2 font-medium">Sicil</th>
                          <th className="px-3 py-2 font-medium">Satır</th>
                          <th className="px-3 py-2 font-medium">Kod</th>
                          <th className="px-3 py-2 font-medium">Mesaj</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {last.errors.slice(0, 200).map((e, i) => (
                          <tr key={`${e.code}-${e.employeeCode ?? "no-code"}-${e.line}-${i}`} className="hover:bg-zinc-50">
                            <td className="px-3 py-2 font-mono">{issuePrimaryId(e)}</td>
                            <td className="px-3 py-2 font-mono">{e.line ? e.line : "—"}</td>
                            <td className="px-3 py-2 font-mono">{e.code}</td>
                            <td className="px-3 py-2">{e.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    Hata yok.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
      <div className="text-xs text-zinc-600">{label}</div>
      <div className="mt-1 text-lg font-semibold tracking-tight text-zinc-900">{value}</div>
    </div>
  );
}

function StepBadge(props: { title: string; ok: boolean; hint: string }) {
  const { title, ok, hint } = props;
  return (
    <div
      className={cx(
        "rounded-2xl border px-3 py-2",
        ok ? "border-emerald-200 bg-emerald-50" : "border-zinc-200 bg-white"
      )}
    >
      <div className={cx("text-xs font-semibold", ok ? "text-emerald-900" : "text-zinc-800")}>{title}</div>
      <div className={cx("mt-0.5 text-[11px]", ok ? "text-emerald-800" : "text-zinc-600")}>{hint}</div>
    </div>
  );
}

function formatMappingValue(
  m: ImportMapping,
  key:
    | "employeeCode"
    | "firstName"
    | "lastName"
    | "email"
    | "isActive"
    | "branchCode"
    | "hireDate"
    | "terminationDate"
    | "employmentAction",
  preview: any,
  optional?: boolean
) {
  const v: any = (m.columns as any)?.[key];
  if (m.mode === "INDEX") {
    if (typeof v !== "number" || v < 0) return optional ? "— Yok" : "⚠ seçilmedi";
    const hdr = preview?.header?.[v] ?? `col_${v}`;
    return `${v} — ${String(hdr)}`;
  }
  const s = String(v ?? "").trim();
  if (!s) return optional ? "— Yok" : "⚠ seçilmedi";
  return s;
}

function MappingRow(props: {
  label: string;
  preview: any;
  mode: "HEADER" | "INDEX";
  value: string | number;
  allowNone?: boolean;
  onChange: (v: string | number) => void;
}) {
  const { label, preview, mode, value, allowNone, onChange } = props;

  const options = useMemo(() => {
    if (!preview) return [];
    if (mode === "HEADER") {
      const idxs: number[] = Array.isArray(preview.visibleIdx) ? preview.visibleIdx : preview.header.map((_: any, i: number) => i);
      return idxs.map((i: number) => {
        const h = String(preview.header?.[i] ?? "");
        return {
        key: `H:${i}`, // unique even if header text is empty/duplicate
        value: h,
        label: h && String(h).trim() ? h : `(boş kolon #${i})`,
        };
      });
    }
    const idxs: number[] = Array.isArray(preview.visibleIdx) ? preview.visibleIdx : preview.header.map((_: any, i: number) => i);
    return idxs.map((i: number) => {
      const h = String(preview.header?.[i] ?? "");
      return {
        key: `I:${i}`,
        value: String(i),
        label: `${i} — ${h && String(h).trim() ? h : "(boş kolon)"}`,
      };
    });
  }, [preview, mode]);

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-2">
      <div className="text-xs font-medium text-zinc-800">{label}</div>
      <select
        className="max-w-[55%] rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs"
        value={String(value)}
        onChange={(e) => {
          const v = e.target.value;
          if (allowNone && v === "__NONE__") {
            onChange(mode === "INDEX" ? -1 : "");
            return;
          }
          if (mode === "INDEX") onChange(Number(v));
          else onChange(v);
        }}
      >
        {allowNone ? <option value="__NONE__">— Yok</option> : null}
        {options.map((o: any) => (
          <option key={o.key} value={mode === "INDEX" ? o.value : o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
