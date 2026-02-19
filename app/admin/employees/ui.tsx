"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { ReactNode } from "react";

type Tone = "neutral" | "info" | "good" | "warn" | "danger" | "violet";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-4 w-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function ChipLink({
  href,
  title,
  children,
  className,
}: {
  href: string;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      title={title}
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold transition",
        "focus:outline-none focus:ring-2 focus:ring-blue-400/40",
        className
      )}
    >
      {children}
    </a>
  );
}

function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  const map: Record<Tone, string> = {
    neutral: "bg-zinc-100 text-zinc-700 ring-zinc-200/60",
    info: "bg-sky-50 text-sky-700 ring-sky-200/60",
    good: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
    warn: "bg-amber-50 text-amber-900 ring-amber-200/60",
    danger: "bg-rose-50 text-rose-800 ring-rose-200/60",
    violet: "bg-violet-50 text-violet-800 ring-violet-200/60",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset shadow-sm uppercase tracking-tight",
        map[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

function Card({
  tone = "neutral",
  title,
  subtitle,
  right,
  children,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const toneBg: Record<Tone, string> = {
    neutral: "from-white to-zinc-50/50",
    info: "from-white to-sky-50/30",
    good: "from-white to-emerald-50/30",
    warn: "from-white to-amber-50/30",
    danger: "from-white to-rose-50/30",
    violet: "from-white to-violet-50/30",
  };
  return (
    <div
      className={cx(
       "rounded-2xl border border-zinc-200/70 bg-gradient-to-b p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] min-w-0 transition-all duration-300 hover:shadow-md",
        toneBg[tone],
        className
      )}
    >
      {(title || subtitle || right) ? (
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-zinc-100 pb-4">
          <div className="min-w-0">
            {title ? <div className="text-lg font-bold text-zinc-900 leading-tight tracking-tight">{title}</div> : null}
            {subtitle ? <div className="mt-1 text-sm text-zinc-500 font-medium leading-relaxed italic">{subtitle}</div> : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function Button({
  variant = "secondary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all active:scale-95 " +
    "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm";
  const map = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-600/20",
    secondary: "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900",
    ghost: "bg-transparent text-zinc-600 hover:bg-zinc-100 border border-transparent",
    danger: "bg-rose-600 text-white hover:bg-rose-700 border border-rose-600/20",
  } as const;
  return <button className={cx(base, map[variant], className)} {...props} />;
}

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white/80 px-3 py-2.5 text-sm shadow-sm font-medium transition-all " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white";

type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  // Source-of-truth for "today" derived from employment periods on server
  derivedIsActive: boolean;
  employment: { startDate: string | null; endDate: string | null };
  branchId: string | null;
  branch: { id: string; code: string; name: string } | null;
};

type Notice = { kind: "success" | "error" | "info"; text: string };

function parseApiErrorText(t: string): string | null {
  // API bazen {"error":"CODE"} döndürüyor; bazen düz text.
  const s = (t ?? "").trim();
  if (!s) return null;
  if (s.startsWith("{") && s.endsWith("}")) {
    try {
      const j = JSON.parse(s);
      if (typeof j?.error === "string" && j.error.trim()) return j.error.trim();
    } catch {
      // ignore
    }
  }
  return s;
}

function humanizeError(codeOrText: string): string {
  const v = (codeOrText ?? "").trim();
  // Bilinen kodları Türkçeleştir
  const map: Record<string, string> = {
    EMPLOYEE_CODE_REQUIRED: "Çalışan kodu zorunludur.",
    FIRST_NAME_REQUIRED: "Ad zorunludur.",
    LAST_NAME_REQUIRED: "Soyad zorunludur.",
    EMPLOYEE_CODE_TAKEN: "Bu çalışan kodu zaten kullanılıyor.",
    EMPLOYEE_CODE_ALREADY_EXISTS: "Bu çalışan kodu zaten kayıtlı.",
    EMPLOYEE_CODE_DUPLICATE: "Bu çalışan kodu zaten kayıtlı.",
    EMPLOYEE_CODE_UNIQUE: "Bu çalışan kodu zaten kayıtlı.",
    INVALID_EMAIL: "E-posta formatı geçersiz.",
    INVALID_START_DATE: "İşe başlama tarihi geçersiz.",
    INVALID_END_DATE: "Çıkış tarihi geçersiz.",
    END_BEFORE_START: "Çıkış tarihi, işe giriş tarihinden önce olamaz.",
    NO_OPEN_EMPLOYMENT: "Açık istihdam kaydı bulunamadı (zaten pasif olabilir).",
    EMPLOYMENT_OVERLAP: "Bu tarihte çalışan zaten aktif görünüyor (çakışan kayıt var).",
    USE_TERMINATE_REHIRE: "Aktif/Pasif güncellemesi için Çıkış / İşe Al işlemini kullanın.",
  };
  if (map[v]) return map[v];
  // Prisma/DB unique benzeri durumları yakala (backend özel kod dönmüyorsa)
  const upper = v.toUpperCase();
  if (
    upper.includes("P2002") ||
    upper.includes("UNIQUE CONSTRAINT") ||
    upper.includes("UNIQUE") ||
    upper.includes("DUPLICATE") ||
    upper.includes("ALREADY EXISTS")
  ) {
    return "Bu çalışan kodu zaten kayıtlı. Farklı bir kod deneyin.";
  }
  // Düz text gelirse olduğu gibi ama aşırı teknikse yumuşat
  if (v.startsWith("Prisma") || v.includes("ECONN")) return "Sunucu hatası oluştu. Lütfen tekrar deneyin.";
  return v;
}

function isLikelyEmail(v: string) {
  const s = v.trim();
  if (!s) return true; // optional
  // Basit ve yeterli bir kontrol
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isISODate(v: string): boolean {
  // yyyy-MM-dd
  return /^\d{4}-\d{2}-\d{2}$/.test((v ?? "").trim());
}

function normSort(v: string | null | undefined): string {
  return String(v ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

function cmpStr(a: string, b: string): number {
  // Türkçe locale ile düzgün sıralama (İ/ı vs.)
  return a.localeCompare(b, "tr-TR", { sensitivity: "base", numeric: true });
}

function fullNameKey(e: { firstName: string; lastName: string }) {
  return `${normSort(e.firstName)} ${normSort(e.lastName)}`.trim();
}

export default function EmployeesClient() {
  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [q, setQ] = useState("");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "PASSIVE">("ALL");
  const [flashRowId, setFlashRowId] = useState<string | null>(null);
  const [flashKind, setFlashKind] = useState<"success" | "danger" | null>(null);
  const [sortBy, setSortBy] = useState<"CODE" | "NAME" | "STATUS">("CODE");
  const [touched, setTouched] = useState<{ [k: string]: boolean }>({});
  const [todayDayKey, setTodayDayKey] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [branches, setBranches] = useState<Array<{ id: string; code: string; name: string; isActive: boolean }>>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkBranchId, setBulkBranchId] = useState<string>(""); // "" => no selection, "CLEAR" => clear
  const [bulkBusy, setBulkBusy] = useState(false);

  const [branchFilter, setBranchFilter] = useState<string>(""); // "" all, "__NULL__" unassigned
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  const [applyMode, setApplyMode] = useState<"SELECTED" | "FILTERED">("FILTERED");
  const [branchStats, setBranchStats] = useState<Array<{ branchId: string | null; branch: any; count: number }>>([]);

  const [form, setForm] = useState({
    employeeCode: "",
    firstName: "",
    lastName: "",
    email: "",
    employmentStartDate: "",
    employmentReason: "",
  });

  const [employmentAction, setEmploymentAction] = useState<null | { mode: "TERMINATE" | "REHIRE"; employee: Employee }>(null);
  const [employmentActionDate, setEmploymentActionDate] = useState<string>("");
  const [employmentActionReason, setEmploymentActionReason] = useState<string>("");

  const fullName = useMemo(() => `${form.firstName} ${form.lastName}`.trim(), [form.firstName, form.lastName]);

  function flash(kind: Notice["kind"], text: string, ms = 2500) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), ms);
  }

  const normalized = useMemo(() => {
    return {
      employeeCode: form.employeeCode.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      employmentStartDate: (form.employmentStartDate || "").trim(),
      employmentReason: (form.employmentReason || "").trim(),
    };
  }, [form.employeeCode, form.firstName, form.lastName, form.email, form.employmentStartDate, form.employmentReason]);

  const fieldErrors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!normalized.employeeCode) e.employeeCode = "Çalışan kodu zorunludur.";
    if (!normalized.firstName) e.firstName = "Ad zorunludur.";
    if (!normalized.lastName) e.lastName = "Soyad zorunludur.";
    if (!isLikelyEmail(normalized.email)) e.email = "E-posta formatı geçersiz.";
    if (normalized.employmentStartDate && !isISODate(normalized.employmentStartDate)) {
      e.employmentStartDate = "İşe başlama tarihi geçersiz (yyyy-AA-gg).";
    }
    return e;
  }, [normalized]);

  const canCreate = useMemo(() => {
    return Object.keys(fieldErrors).length === 0 && !loading;
  }, [fieldErrors, loading]);

  async function refresh() {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      sp.set("status", statusFilter);
      if (branchFilter) sp.set("branchId", branchFilter);
      sp.set("page", String(page));
      sp.set("pageSize", String(pageSize));

      const res = await fetch(`/api/employees?${sp.toString()}`, { credentials: "include" });
      const json = await res.json();
      setItems(json.items ?? []);
      setNotice(null);

      setTotal(Number(json?.meta?.total ?? 0) || 0);
      setTotalPages(Number(json?.meta?.totalPages ?? 1) || 1);

      // Branch stats (summary panel)
      try {
        const sRes = await fetch("/api/employees/branch/stats", { credentials: "include" });
        const sJson = await sRes.json().catch(() => null);
        setBranchStats(Array.isArray(sJson?.items) ? sJson.items : []);
      } catch {
        setBranchStats([]);
      }

      // 4.2) Load branches (Org/Branches)
      // Branch listesi olmadan dropdown çalışmaz. Buradan tek noktadan çekiyoruz.
      try {
        const bRes = await fetch("/api/org/branches", { credentials: "include" });
        const bJson = await bRes.json().catch(() => null);
        // Bazı endpoint'ler {items:[]} döndürebilir; bazıları direkt [] döndürebilir.
        const arr = Array.isArray(bJson) ? bJson : Array.isArray(bJson?.items) ? bJson.items : [];
        setBranches(arr);
      } catch {
        // UI-only; branch listesi yüklenmezse sadece branch seçimi çalışmaz.
        setBranches([]);
      }
      const dk = String(json?.meta?.todayDayKey ?? "").trim();
      if (dk && isISODate(dk)) {
        setTodayDayKey(dk);
        setForm((s) => ({ ...s, employmentStartDate: s.employmentStartDate || dk }));
      } else {
        // fallback: keep local today
        setForm((s) => ({ ...s, employmentStartDate: s.employmentStartDate || todayDayKey }));
      }
    } finally {
      setLoading(false);
    }
  }

  // 4.3) Satır bazında branch değiştir handler
  async function setEmployeeBranch(employeeId: string, branchId: string | null) {
    try {
      const res = await fetch(`/api/employees/${employeeId}/branch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ branchId }),
      });
      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        const codeOrText = parseApiErrorText(raw) ?? "Branch güncellenemedi.";
        flash("error", humanizeError(codeOrText));
        return;
      }
      await refresh();
     flash("success", "Branch güncellendi.");
    } catch {
      flash("error", "Branch güncellenemedi.");
    }
  }

  // 4.3) Bulk branch apply (selected[] -> branchId / clear)
  async function applyBulkBranch() {
    const ids = applyMode === "SELECTED" ? Object.keys(selected).filter((k) => selected[k]) : [];
    if (applyMode === "SELECTED" && ids.length === 0) {
      flash("info", "Toplu işlem için önce çalışan seç (veya Mod: Filtrelenmişler seç).");
      return;
    }
    if (!bulkBranchId) {
      flash("info", "Toplu işlem için Branch seç.");
      return;
    }

    setBulkBusy(true);
    try {
      const branchId = bulkBranchId === "CLEAR" ? null : bulkBranchId;
      // FILTERED modunda server'a filtreleri de gönderiyoruz (ids göndermiyoruz)
      const payload =
        applyMode === "SELECTED"
          ? { employeeIds: ids, branchId }
          : {
              employeeIds: [], // ignored by server in FILTERED mode (faz-5.1.1)
              branchId,
              filter: { q: q.trim(), status: statusFilter, branchId: branchFilter || null },
            };

      const res = await fetch("/api/employees/branch/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        flash("error", humanizeError(j?.error ?? "Toplu işlem başarısız."));
        return;
      }

      setSelected({});
      setBulkBranchId("");
      await refresh();
      flash("success", `Toplu güncellendi: ${j?.updatedCount ?? ids.length} kişi`);
    } finally {
      setBulkBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, statusFilter, branchFilter, page, pageSize]);

  // filtre değişince sayfayı 1'e çek (q/status/branchFilter)
  useEffect(() => {
    setPage(1);
  }, [q, statusFilter, branchFilter, pageSize]);

  async function createEmployee() {
    // Client-side validation
    setTouched({ employeeCode: true, firstName: true, lastName: true, email: true, employmentStartDate: true });
    if (Object.keys(fieldErrors).length > 0) {
      flash("error", "Lütfen zorunlu alanları doldurun.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          employeeCode: normalized.employeeCode,
          firstName: normalized.firstName,
          lastName: normalized.lastName,
          email: normalized.email || null,
          employmentStartDate: normalized.employmentStartDate || todayDayKey,
          employmentReason: normalized.employmentReason || null,
        }),
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        const codeOrText = parseApiErrorText(raw) ?? "Çalışan oluşturulamadı.";
        flash("error", humanizeError(codeOrText));
        return;
      }

      setForm({ employeeCode: "", firstName: "", lastName: "", email: "", employmentStartDate: todayDayKey, employmentReason: "" });
      setTouched({});
      // Başarılı oluşturma sonrası UI'ı tamamen temizle
      setNotice(null);
      setFlashKind("success");
      await refresh();
      // yeni eklenen satırı vurgula
      setFlashRowId(normalized.employeeCode);
      setTimeout(() => setFlashRowId(null), 1500);
      setTimeout(() => setFlashKind(null), 1500);
      flash("success", "Çalışan oluşturuldu.");
    } finally {
      setLoading(false);
    }
  }

  function openTerminate(e: Employee) {
    setEmploymentAction({ mode: "TERMINATE", employee: e });
    setEmploymentActionDate(todayDayKey);
    setEmploymentActionReason("");
  }

  function openRehire(e: Employee) {
    setEmploymentAction({ mode: "REHIRE", employee: e });
    setEmploymentActionDate(todayDayKey);
    setEmploymentActionReason("");
  }

  function closeEmploymentModal() {
    setEmploymentAction(null);
    setEmploymentActionDate("");
    setEmploymentActionReason("");
  }

  async function submitEmploymentAction() {
    if (!employmentAction) return;

    const date = (employmentActionDate || "").trim();
    if (!isISODate(date)) {
      flash("error", "Tarih geçersiz (yyyy-AA-gg).");
      return;
    }

    setLoading(true);
    try {
      const employeeId = employmentAction.employee.id;
      const endpoint =
        employmentAction.mode === "TERMINATE"
          ? `/api/employees/${employeeId}/terminate`
          : `/api/employees/${employeeId}/rehire`;

      const body =
        employmentAction.mode === "TERMINATE"
          ? { endDate: date, reason: employmentActionReason?.trim() || null }
          : { startDate: date, reason: employmentActionReason?.trim() || null };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        const codeOrText = parseApiErrorText(raw) ?? "İşlem başarısız.";
        flash("error", humanizeError(codeOrText));
        return;
      }

      closeEmploymentModal();
      await refresh();
      setFlashRowId(employeeId);
      setFlashKind(employmentAction.mode === "TERMINATE" ? "danger" : "success");
      setTimeout(() => setFlashRowId(null), 1200);
      setTimeout(() => setFlashKind(null), 1200);

      flash(
        "success",
        employmentAction.mode === "TERMINATE"
          ? `Çıkış işlemi uygulandı. (${date})`
          : `İşe alım işlemi uygulandı. (${date})`,
      );
    } finally {
      setLoading(false);
    }
  }

  const visibleItems = useMemo(() => {
    const arr = Array.isArray(items) ? [...items] : [];
    arr.sort((a, b) => {
      if (sortBy === "CODE") {
        return cmpStr(normSort(a.employeeCode), normSort(b.employeeCode));
      }
      if (sortBy === "NAME") {
        return cmpStr(fullNameKey(a), fullNameKey(b));
      }
      // STATUS: Aktifler üstte, eşitse koda göre
      const sa = a.derivedIsActive ? 0 : 1;
      const sb = b.derivedIsActive ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return cmpStr(normSort(a.employeeCode), normSort(b.employeeCode));
    });
    return arr;
  }, [items, sortBy]);

  return (
    <div className="grid gap-6 w-full max-w-full overflow-x-hidden p-2 md:p-6 animate-in fade-in duration-500">
      <Card
        tone="violet"
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span>Çalışan Yönetimi</span>
            <Badge tone="violet">Kayıt • Şube • Durum</Badge>
            {loading ? <Badge tone="info">Yükleniyor…</Badge> : null}
          </div>
        }
        subtitle="Personel kartlarını oluşturun ve kurumsal yapınıza göre sınıflandırın."
        right={
          <div className="flex items-center gap-2">
            <Link
              href="/employees/import"
              className="inline-flex items-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50 shadow-sm"
              title="CSV ile toplu içe aktar"
            >
              Personel İçe Aktar (CSV)
            </Link>
            <Button variant="secondary" onClick={refresh} disabled={loading} title="Listeyi yenile">
              Yenile
            </Button>
          </div>
        }
      >

        {notice && (
          <div
            className={
              "mt-3 rounded-xl border px-3 py-2 text-sm " +
              (notice.kind === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : notice.kind === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-zinc-200 bg-zinc-50 text-zinc-900")
            }
            role="status"
          >
            {notice.text}
          </div>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-800">Çalışan Kodu</span>
            <input
              className={
                "rounded-xl border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 " +
                (touched.employeeCode && fieldErrors.employeeCode
                  ? "border-red-300 bg-red-50"
                  : "border-zinc-200")
              }
              value={form.employeeCode}
              onBlur={() => setTouched((s) => ({ ...s, employeeCode: true }))}
              onChange={(ev) => setForm({ ...form, employeeCode: ev.target.value })}
              placeholder="E001"
            />
            {touched.employeeCode && fieldErrors.employeeCode && (
              <span className="text-xs text-red-700">{fieldErrors.employeeCode}</span>
            )}
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-800">E-posta (opsiyonel)</span>
            <input
              className={
                "rounded-xl border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 " +
                (touched.email && fieldErrors.email ? "border-red-300 bg-red-50" : "border-zinc-200")
              }
              value={form.email}
              onBlur={() => setTouched((s) => ({ ...s, email: true }))}
              onChange={(ev) => setForm({ ...form, email: ev.target.value })}
              placeholder="ornek@firma.com"
            />
            {touched.email && fieldErrors.email && (
              <span className="text-xs text-red-700">{fieldErrors.email}</span>
            )}
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-800">Ad</span>
            <input
              className={
                "rounded-xl border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 " +
                (touched.firstName && fieldErrors.firstName ? "border-red-300 bg-red-50" : "border-zinc-200")
              }
              value={form.firstName}
              onBlur={() => setTouched((s) => ({ ...s, firstName: true }))}
              onChange={(ev) => setForm({ ...form, firstName: ev.target.value })}
              placeholder="Personel İsim"
            />
            {touched.firstName && fieldErrors.firstName && (
              <span className="text-xs text-red-700">{fieldErrors.firstName}</span>
            )}
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-800">Soyad</span>
            <input
              className={
                "rounded-xl border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 " +
                (touched.lastName && fieldErrors.lastName ? "border-red-300 bg-red-50" : "border-zinc-200")
              }
              value={form.lastName}
              onBlur={() => setTouched((s) => ({ ...s, lastName: true }))}
              onChange={(ev) => setForm({ ...form, lastName: ev.target.value })}
              placeholder="Personel Soyisim"
            />
            {touched.lastName && fieldErrors.lastName && (
              <span className="text-xs text-red-700">{fieldErrors.lastName}</span>
            )}
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-800">İşe Başlama Tarihi</span>
            <input
              type="date"
              className={
                "rounded-xl border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 " +
                (touched.employmentStartDate && fieldErrors.employmentStartDate
                  ? "border-red-300 bg-red-50"
                  : "border-zinc-200")
              }
              value={form.employmentStartDate}
              onBlur={() => setTouched((s) => ({ ...s, employmentStartDate: true }))}
              onChange={(ev) => setForm({ ...form, employmentStartDate: ev.target.value })}
            />
            {touched.employmentStartDate && fieldErrors.employmentStartDate && (
              <span className="text-xs text-red-700">{fieldErrors.employmentStartDate}</span>
            )}
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-800">Not (opsiyonel)</span>
            <input
              className={inputClass}
              value={form.employmentReason}
              onChange={(ev) => setForm({ ...form, employmentReason: ev.target.value })}
              placeholder="Örn: İşe giriş notu"
            />
          </label>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4">

          <div className="text-sm font-medium text-zinc-500 italic">
            {fullName ? (
              <>
                Önizleme: <span className="font-bold text-indigo-600">{fullName}</span>
              </>
            ) : (
              "Lütfen bilgileri girin."
            )}
          </div>
          <Button variant="primary" className="px-8 py-2.5 shadow-indigo-200" disabled={!canCreate} onClick={createEmployee}>
            {loading ? "Oluşturuluyor..." : "Personeli Kaydet"}
          </Button>
        </div>
      </Card>

      <Card
        tone="neutral"
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span>Çalışan Listesi</span>
            <Badge tone="info">{loading ? "Yükleniyor…" : `${total} kayıt bulundu`}</Badge>
          </div>
        }
        subtitle="Arama, filtreleme ve toplu işlemlerle veritabanınızı yönetin."
      >
        {/* FILTERS AREA */}
        <div className="mb-6 grid gap-3">
          {/* 1. satır: Arama + Durum + Şube + Sayfa */}
          <div className="grid gap-4 md:grid-cols-2 lg:flex lg:items-end lg:gap-3">
            <div className="flex-1 space-y-1.5 min-w-[260px]">
              <span className="text-[11px] font-bold text-zinc-400 uppercase ml-1 tracking-wider">Arama</span>
              <input
                className={inputClass}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Kod, ad veya soyad ile ara..."
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-zinc-400 uppercase ml-1 tracking-wider">Durum</span>
              <div className="flex gap-1">
                {(["ALL", "ACTIVE", "PASSIVE"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={cx(
                      "px-3 py-2 text-xs font-bold rounded-xl border transition-all",
                      statusFilter === f
                        ? "bg-zinc-900 text-white border-zinc-900 shadow-md"
                        : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                    )}
                  >
                    {f === "ALL" ? "Tümü" : f === "ACTIVE" ? "Aktif" : "Pasif"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 min-w-[220px]">
              <span className="text-[11px] font-bold text-zinc-400 uppercase ml-1 tracking-wider">Şube Filtresi</span>
              <select
                className={inputClass}
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                title="Şube filtresi"
              >
                <option value="">Tümü</option>
                <option value="__NULL__">Şube Atanmamış</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. satır: Sıralama + Toplam */}
          <div className="grid gap-2">
            <div className="text-xs font-semibold text-zinc-500">
              {loading ? "Yükleniyor…" : "Sıralama ve toplam"}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-nowrap">
              <select
                className={cx(inputClass, "w-56 sm:w-64 flex-none")}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                title="Sıralama"
              >
                <option value="CODE">Sırala: Koda göre</option>
                <option value="NAME">Sırala: Ada göre</option>
                <option value="STATUS">Sırala: Duruma göre</option>
              </select>

              <select
                className={cx(inputClass, "!w-28 flex-none")}
                value={String(pageSize)}
                onChange={(e) => setPageSize(Number(e.target.value))}
                title="Sayfa boyutu"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>

              <div className="text-sm font-medium text-zinc-500 whitespace-nowrap sm:ml-0">
                {loading ? "Yükleniyor…" : `Toplam: ${total}`}
              </div>
            </div>
          </div>
        </div>
        
        {/* 4.4) Toplu Branch Atama Barı */}
        <div className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 flex flex-wrap gap-4 items-center shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-md" aria-hidden="true">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-bold text-indigo-900 uppercase tracking-tight">Toplu Şube Atama</div>
              <div className="text-[11px] text-indigo-600 font-medium italic">
                Mod seçin, hedef şubeyi belirleyin ve uygulayın.
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-wrap gap-2 items-center lg:justify-end">
            <select
              className={cx(inputClass, "w-full sm:w-56 bg-white")}
              value={applyMode}
              onChange={(e) => setApplyMode(e.target.value as any)}
              disabled={bulkBusy || loading}
              title="Uygulama modu"
            >
              <option value="FILTERED">Mod: Filtrelenmişler</option>
              <option value="SELECTED">Mod: Seçililer</option>
            </select>

            <select
              className={cx(inputClass, "w-full sm:w-80 bg-white")}
              value={bulkBranchId}
              onChange={(e) => setBulkBranchId(e.target.value)}
              disabled={bulkBusy || loading}
              title="Uygulanacak şube"
            >
              <option value="">Şube seç…</option>
              <option value="CLEAR">Şubeyi kaldır (DEFAULT)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
            <Button variant="primary" onClick={applyBulkBranch} disabled={bulkBusy || loading} className="min-w-[140px]">
              {bulkBusy ? "İşleniyor..." : "Uygula"}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-[1040px] w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-700">
              <tr>
                {/* Select-all checkbox */}
                <th className="w-12 px-4 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={visibleItems.length > 0 && visibleItems.every((x) => !!selected[x.id])}
                    onChange={(e) => {
                      const v = e.target.checked;
                      if (!v) {
                        setSelected({});
                        return;
                      }
                      const next: Record<string, boolean> = {};
                      for (const it of visibleItems) next[it.id] = true;
                      setSelected(next);
                    }}
                    className="rounded-md border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-4 py-4 text-left font-bold text-zinc-500 uppercase text-[11px] tracking-widest">Personel</th>
                <th className="w-[170px] px-4 py-4 text-left font-bold text-zinc-500 uppercase text-[11px] tracking-widest">İşe Giriş</th>
                <th className="px-4 py-4 text-left font-bold text-zinc-500 uppercase text-[11px] tracking-widest">Şube</th>
                <th className="w-[140px] px-4 py-4 text-center font-bold text-zinc-500 uppercase text-[11px] tracking-widest">Durum</th>
                <th className="w-[190px] px-4 py-4 text-right font-bold text-zinc-500 uppercase text-[11px] tracking-widest">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {visibleItems.map((e) => (
                <tr
                  key={e.id}
                  className={
                    "group hover:bg-zinc-50/50 transition-colors " +
                    (focusedId === e.id ? "bg-zinc-100" : "") +
                    (flashRowId === e.id || flashRowId === e.employeeCode
                      ? flashKind === "success"
                        ? " bg-emerald-50/50"
                        : " bg-rose-50/50"
                      : "")
                  }
                  onMouseEnter={() => setFocusedId(e.id)}
                  onMouseLeave={() => setFocusedId(null)}
                > 
                  {/* Row checkbox */}
                  <td className="px-4 py-3 text-center align-middle">
                    <input
                      type="checkbox"
                      checked={!!selected[e.id]}
                      onChange={(ev) => setSelected((s) => ({ ...s, [e.id]: ev.target.checked }))}
                      className="rounded-md border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-zinc-900 truncate" title={`${e.firstName} ${e.lastName}`.trim()}>
                        {e.firstName} {e.lastName}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-zinc-400 truncate">
                        KOD: {e.employeeCode}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 font-medium">
                    {e.employment.startDate ?? "—"}
                  </td>

                  {/* Branch select */}
                  <td className="px-4 py-3">
                    <select
                      className="bg-transparent border-none p-0 text-sm font-bold text-zinc-700 focus:ring-0 cursor-pointer hover:text-indigo-600 disabled:opacity-50"
                      value={e.branchId ?? ""}
                      onChange={(ev) => setEmployeeBranch(e.id, ev.target.value ? ev.target.value : null)}
                      disabled={loading || bulkBusy}
                      title="Personelin bağlı olduğu şube"
                    >
                      <option value="">Atanmamış</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} — {b.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-4 py-3 text-center">
                    <Badge tone={e.derivedIsActive ? "good" : "danger"}>{e.derivedIsActive ? "Aktif" : "Pasif"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <Link
                        href={`/employees/${e.id}`}
                        className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white p-2 text-zinc-400 hover:text-indigo-600 hover:bg-zinc-50 transition-colors"
                        title="Personel 360 (Employee 360) detay ekranı"
                      >
                        <IconEye className="h-4 w-4" />
                      </Link>

                      {e.derivedIsActive ? (
                        <button
                          onClick={() => openTerminate(e)}
                          disabled={loading}
                          className="px-3 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100 disabled:opacity-50"
                          title="İşten çıkar"
                        >
                          İşten Çıkar
                        </button>
                      ) : (
                        <button
                          onClick={() => openRehire(e)}
                          disabled={loading}
                          className="px-3 py-1 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-100 disabled:opacity-50"
                          title="İşe al"
                        >
                          İşe Al
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-zinc-600">
                    Henüz çalışan yok.
                  </td>
                </tr>
              )}
              {items.length > 0 && visibleItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-zinc-600">
                    Arama kriterine uyan çalışan bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-zinc-600">
            Sayfa <span className="font-medium text-zinc-900">{page}</span> /{" "}
            <span className="font-medium text-zinc-900">{totalPages}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Önceki
            </Button>
            <Button
              variant="secondary"
              disabled={loading || page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Sonraki →
            </Button>
          </div>
        </div>
      </Card>
      {employmentAction && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <div className="text-lg font-semibold">
                  {employmentAction.mode === "TERMINATE" ? "İşten Çıkış" : "İşe Al"}
                </div>
                <div className="text-sm text-zinc-600">
                  <span className="font-medium text-zinc-800">
                    {employmentAction.employee.employeeCode}
                  </span>{" "}
                  — {employmentAction.employee.firstName} {employmentAction.employee.lastName}
                </div>
              </div>
              <Button variant="secondary" onClick={closeEmploymentModal} disabled={loading}>
                Kapat
              </Button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-sm text-zinc-700">
                  {employmentAction.mode === "TERMINATE" ? "Çıkış Tarihi" : "İşe Başlama Tarihi"}
                </span>
                <input
                  type="date"
                  className={inputClass}
                  value={employmentActionDate}
                  onChange={(ev) => setEmploymentActionDate(ev.target.value)}
                  disabled={loading}
               />
              </label>

              <label className="grid gap-1">
                <span className="text-sm text-zinc-700">Neden / Not (opsiyonel)</span>
                <input
                  className={inputClass}
                  value={employmentActionReason}
                  onChange={(ev) => setEmploymentActionReason(ev.target.value)}
                  placeholder="Örn: İstifa / İşe dönüş / Deneme süresi"
                  disabled={loading}
                />
             </label>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={closeEmploymentModal} disabled={loading}>
                Vazgeç
              </Button>
              <Button
                variant={employmentAction.mode === "TERMINATE" ? "danger" : "primary"}
                className={employmentAction.mode === "REHIRE" ? "bg-emerald-600 hover:bg-emerald-700 border-emerald-600 focus:ring-emerald-600" : ""}
                onClick={submitEmploymentAction}
                disabled={loading || !isISODate(employmentActionDate)}
              >
                {employmentAction.mode === "TERMINATE" ? "Çıkış Uygula" : "İşe Al Uygula"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
