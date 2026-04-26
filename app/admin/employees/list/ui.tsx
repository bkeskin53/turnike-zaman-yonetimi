"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { subscribeEmployeesListChanged } from "@/src/features/employees/employeeListSync";

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
    neutral: "bg-slate-100/90 text-slate-700 ring-slate-300/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
    info: "bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(56,189,248,0.10))] text-sky-800 ring-sky-300/45 shadow-[0_8px_22px_rgba(14,165,233,0.12)]",
    good: "bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(52,211,153,0.10))] text-emerald-800 ring-emerald-300/45 shadow-[0_8px_22px_rgba(16,185,129,0.12)]",
    warn: "bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(251,191,36,0.10))] text-amber-900 ring-amber-300/45 shadow-[0_8px_22px_rgba(245,158,11,0.10)]",
    danger: "bg-[linear-gradient(135deg,rgba(244,63,94,0.16),rgba(251,113,133,0.10))] text-rose-800 ring-rose-300/45 shadow-[0_8px_22px_rgba(244,63,94,0.10)]",
    violet: "bg-[linear-gradient(135deg,rgba(99,102,241,0.18),rgba(139,92,246,0.10))] text-indigo-900 ring-indigo-300/45 shadow-[0_10px_24px_rgba(99,102,241,0.12)]",
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
    neutral: "border-slate-200/70 from-white via-slate-50/70 to-slate-100/60",
    info: "border-sky-200/60 from-white via-sky-50/65 to-cyan-50/55",
    good: "border-emerald-200/60 from-white via-emerald-50/65 to-teal-50/55",
    warn: "border-amber-200/65 from-white via-amber-50/70 to-orange-50/55",
    danger: "border-rose-200/65 from-white via-rose-50/65 to-pink-50/55",
    violet: "border-indigo-200/65 from-white via-indigo-50/70 to-violet-50/60",
  };
  return (
    <div
      className={cx(
        "rounded-2xl border bg-gradient-to-br p-5 shadow-[0_14px_35px_rgba(15,23,42,0.08)] min-w-0 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(79,70,229,0.12)]",
        toneBg[tone],
        className
      )}
    >
      {title || subtitle || right ? (
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-white/65 pb-4">
          <div className="min-w-0">
            {title ? <div className="text-lg font-bold leading-tight tracking-tight text-slate-950">{title}</div> : null}
            {subtitle ? <div className="mt-1 text-sm font-medium leading-relaxed text-slate-600">{subtitle}</div> : null}
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
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all active:scale-95 " +
    "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm";
  const map = {
    primary:
      "border border-indigo-400/30 bg-[linear-gradient(135deg,#4f46e5,#7c3aed)] text-white shadow-[0_14px_28px_rgba(79,70,229,0.24)] hover:brightness-105",
    secondary:
      "border border-slate-200/80 bg-white/85 text-slate-700 backdrop-blur-sm hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-slate-950",
    ghost: "bg-transparent text-slate-600 hover:bg-indigo-50/60 hover:text-indigo-700 border border-transparent",
    danger:
      "border border-rose-300/30 bg-[linear-gradient(135deg,#e11d48,#f43f5e)] text-white shadow-[0_14px_28px_rgba(225,29,72,0.18)] hover:brightness-105",
  } as const;
  return <button className={cx(base, map[variant], className)} {...props} />;
}

const inputClass =
  "w-full rounded-xl border border-slate-200/80 bg-white/88 px-3 py-2.5 text-sm shadow-[0_8px_24px_rgba(15,23,42,0.04)] font-medium text-slate-800 transition-all " +
  "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 focus:bg-white";

type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  cardNo?: string | null;
  deviceUserId?: string | null;
  isActive: boolean;
  derivedIsActive: boolean;
  employment: { startDate: string | null; endDate: string | null };
  branchId: string | null;
  branch: { id: string; code: string; name: string } | null;
};

type Notice = { kind: "success" | "error" | "info"; text: string };
type ScopeRedirectIntent = "TERMINATE" | "REHIRE";

function isISODate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test((v ?? "").trim());
}

function normSort(v: string | null | undefined): string {
  return String(v ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

function cmpStr(a: string, b: string): number {
  return a.localeCompare(b, "tr-TR", { sensitivity: "base", numeric: true });
}

function fullNameKey(e: { firstName: string; lastName: string }) {
  return `${normSort(e.firstName)} ${normSort(e.lastName)}`.trim();
}

const STATUS_FILTER_META: Record<
  "ALL" | "ACTIVE" | "PASSIVE",
  {
    label: string;
    hint: string;
    activeClass: string;
    idleClass: string;
    badgeTone: Tone;
  }
> = {
  ALL: {
    label: "Tümü",
    hint: "Aktif ve pasif kayıtları birlikte gösterir",
    activeClass: "border-slate-900 bg-slate-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]",
    idleClass: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
    badgeTone: "neutral",
  },
  ACTIVE: {
    label: "Aktif",
    hint: "Günlük operasyonlarda kullanılan çalışanlar",
    activeClass: "border-emerald-600 bg-emerald-600 text-white shadow-[0_10px_24px_rgba(5,150,105,0.20)]",
    idleClass: "border-emerald-200/80 bg-white text-emerald-700 hover:bg-emerald-50",
    badgeTone: "good",
  },
  PASSIVE: {
    label: "Pasif",
    hint: "Kapsamı kapanmış kayıt havuzu",
    activeClass: "border-amber-500 bg-amber-500 text-white shadow-[0_10px_24px_rgba(245,158,11,0.20)]",
    idleClass: "border-amber-200/80 bg-white text-amber-800 hover:bg-amber-50",
    badgeTone: "warn",
  },
};

export default function EmployeesListClient(props: { canWrite: boolean }) {
  const { canWrite } = props;
  const searchParams = useSearchParams();
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const crossTabRefreshAtRef = useRef<number>(0);

  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [q, setQ] = useState("");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "PASSIVE">("ACTIVE");
  const [flashRowId, setFlashRowId] = useState<string | null>(null);
  const [flashKind, setFlashKind] = useState<"success" | "danger" | null>(null);
  const [sortBy, setSortBy] = useState<"CODE" | "NAME" | "STATUS">("CODE");
  const [todayDayKey, setTodayDayKey] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [branches, setBranches] = useState<Array<{ id: string; code: string; name: string; isActive: boolean }>>([]);

  const [branchFilter, setBranchFilter] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  const [scopeRedirectAction, setScopeRedirectAction] = useState<null | {
    mode: ScopeRedirectIntent;
    employee: Employee;
  }>(null);

  const hardDeleted = searchParams.get("hardDeleted") === "1";
  const hardDeletedEmployeeCode = (searchParams.get("employeeCode") ?? "").trim();
  const hardDeleteAuditHref = hardDeletedEmployeeCode
    ? `/admin/audit?view=EMPLOYEE_HARD_DELETE&q=${encodeURIComponent(hardDeletedEmployeeCode)}`
    : "/admin/audit?view=EMPLOYEE_HARD_DELETE";

  function flash(kind: Notice["kind"], text: string, ms = 2500) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), ms);
  }

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

      try {
        const bRes = await fetch("/api/org/branches", { credentials: "include" });
        const bJson = await bRes.json().catch(() => null);
        const arr = Array.isArray(bJson) ? bJson : Array.isArray(bJson?.items) ? bJson.items : [];
        setBranches(arr);
      } catch {
        setBranches([]);
      }

      const dk = String(json?.meta?.todayDayKey ?? "").trim();
      if (dk && isISODate(dk)) setTodayDayKey(dk);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshRef.current = refresh;
  });

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, statusFilter, branchFilter, page, pageSize]);

  useEffect(() => {
    return subscribeEmployeesListChanged(() => {
      const now = Date.now();
      if (now - crossTabRefreshAtRef.current < 800) {
        return;
      }
      crossTabRefreshAtRef.current = now;
      void refreshRef.current();
    });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [q, statusFilter, branchFilter, pageSize]);

  function openScopeRedirect(e: Employee, mode: ScopeRedirectIntent) {
    if (!canWrite) return;
    setScopeRedirectAction({ mode, employee: e });
  }

  function closeScopeRedirectModal() {
    setScopeRedirectAction(null);
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
      const sa = a.derivedIsActive ? 0 : 1;
      const sb = b.derivedIsActive ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return cmpStr(normSort(a.employeeCode), normSort(b.employeeCode));
    });
    return arr;
  }, [items, sortBy]);

  return (
    <div className="grid w-full max-w-full animate-in gap-6 overflow-x-hidden px-2 pb-2 pt-0 fade-in duration-500 md:px-6 md:pb-6 md:pt-1">
      {hardDeleted ? (
        <div className="rounded-2xl border border-emerald-200/70 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(209,250,229,0.92),rgba(240,253,244,0.95))] p-4 shadow-[0_16px_34px_rgba(16,185,129,0.10)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Hard Delete Tamamlandı
              </div>
              <div className="mt-1 text-base font-bold text-emerald-950">
                {hardDeletedEmployeeCode
                  ? `${hardDeletedEmployeeCode} sicilli personel kalıcı olarak silindi.`
                  : "Personel kalıcı olarak silindi."}
              </div>
              <div className="mt-1 text-sm font-medium text-emerald-800/90">
                Operational employee graph sistemden kaldırıldı. Historical payroll ledger korunmuş olabilir.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={hardDeleteAuditHref}
                className="inline-flex items-center justify-center rounded-xl border border-emerald-200/80 bg-white/85 px-4 py-2 text-sm font-bold text-emerald-800 shadow-sm transition hover:bg-white"
              >
                Audit Kaydını Gör
              </Link>
              <Link
                href="/employees?status=ALL"
                className="inline-flex items-center justify-center rounded-xl border border-emerald-200/80 bg-white/85 px-4 py-2 text-sm font-bold text-emerald-800 shadow-sm transition hover:bg-white"
              >
                Bildirimi Temizle
              </Link>
            </div>
          </div>
        </div>
      ) : null}
      {!canWrite ? (
        <div className="rounded-2xl border border-amber-300/55 bg-[linear-gradient(135deg,rgba(254,243,199,0.9),rgba(255,251,235,0.92))] p-4 shadow-[0_12px_30px_rgba(245,158,11,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-bold text-amber-900">Read-only</div>
              <div className="mt-1 text-sm text-amber-800">
                Bu ekranda yalnızca çalışan listesini görüntüleyebilirsin. Lokasyon atama işlemleri Organizasyon modülüne taşındı.
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">
              Yetki: OPS_WRITE gerekli
            </span>
          </div>
        </div>
      ) : null}

      <Card
        tone="neutral"
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span>Çalışan Listesi</span>
            <Badge tone="info">{loading ? "Yükleniyor…" : `${total} kayıt bulundu`}</Badge>
          </div>
        }
        subtitle="Varsayılan görünüm aktif çalışanları gösterir. Pasif kayıt havuzuna durum filtresinden tek tıkla geçebilirsiniz."
        right={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/employees"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-xl border border-slate-200/80 bg-white/88 px-3 py-2 text-sm font-semibold text-slate-800 shadow-[0_10px_24px_rgba(15,23,42,0.06)] hover:border-indigo-300 hover:bg-indigo-50/60"
              title="Yeni çalışan kaydına dön"
            >
              <span className="mr-2 inline-flex h-5 w-5 items-center justify-center text-base font-black leading-none text-slate-900">+</span>
              Yeni Çalışan Ekle
            </Link>
            <Link
              href="/employees/import"
              className="inline-flex items-center rounded-xl border border-indigo-200/60 bg-white/88 px-3 py-2 text-sm font-semibold text-slate-800 shadow-[0_10px_24px_rgba(15,23,42,0.06)] hover:border-indigo-300 hover:bg-indigo-50/60"
              title="CSV ile toplu içe aktar"
            >
              Toplu Çalışan İçe Aktar
            </Link>
          </div>
        }
      >
        {notice && (
          <div
            className={
              "mt-3 rounded-xl border px-3 py-2 text-sm " +
              (notice.kind === "error"
                ? "border-rose-200 bg-rose-50/90 text-rose-800"
                : notice.kind === "success"
                  ? "border-emerald-200 bg-emerald-50/90 text-emerald-800"
                  : "border-indigo-200 bg-indigo-50/80 text-indigo-950")
            }
            role="status"
          >
            {notice.text}
          </div>
        )}

        <div className="mb-6 grid gap-3">
          <div className="grid gap-4 md:grid-cols-2 lg:flex lg:items-end lg:gap-3">
            <div className="min-w-[260px] flex-1 space-y-1.5">
              <span className="ml-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Arama</span>
              <input
                className={inputClass}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Kod, ad, soyad, Kart ID veya cihaz no ile ara..."
              />
            </div>

            <div className="space-y-1.5">
              <span className="ml-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Durum</span>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["ALL", "ACTIVE", "PASSIVE"] as const).map((f) => (
                  (() => {
                    const meta = STATUS_FILTER_META[f];
                    const isActive = statusFilter === f;
                    return (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={cx(
                      "rounded-2xl border px-3 py-3 text-left transition-all",
                      isActive ? meta.activeClass : meta.idleClass
                    )}
                    aria-pressed={isActive}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold tracking-tight">{meta.label}</span>
                      {isActive ? (
                        <Badge tone={meta.badgeTone} className="bg-white/20 text-current ring-white/30 shadow-none">
                          {loading ? "…" : total}
                        </Badge>
                      ) : null}
                    </div>
                    <div
                      className={cx(
                        "mt-1 text-[11px] font-medium leading-relaxed",
                        isActive ? "text-current/90" : "text-slate-500"
                      )}
                    >
                      {meta.hint}
                    </div>
                  </button>
                    );
                  })()
                ))}
              </div>
            </div>

            <div className="min-w-[220px] space-y-1.5">
              <span className="ml-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Lokasyon Filtresi</span>
              <select
                className={inputClass}
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                title="Lokasyon filtresi"
              >
                <option value="">Tümü</option>
                <option value="__NULL__">Lokasyon atanmamış</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="text-xs font-semibold text-zinc-500">
              {loading ? "Yükleniyor…" : "Sıralama ve toplam"}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-nowrap sm:items-center">
              <select
                className={cx(inputClass, "w-56 flex-none sm:w-64")}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "CODE" | "NAME" | "STATUS")}
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

              <div className="whitespace-nowrap text-sm font-medium text-zinc-500">
                {loading ? "Yükleniyor…" : `Toplam: ${total}`}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/75 bg-white/86 shadow-[0_16px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-[linear-gradient(180deg,rgba(238,242,255,0.96),rgba(248,250,252,0.96))] text-slate-700">
              <tr>
                <th className="px-4 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-zinc-500">Çalışan</th>
                <th className="w-[170px] px-4 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                  Zaman Kapsam Başlangıcı
                </th>
                <th className="px-4 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-zinc-500">Lokasyon</th>
                <th className="w-[140px] px-4 py-4 text-center text-[11px] font-bold uppercase tracking-widest text-zinc-500">Durum</th>
                <th className="w-[190px] px-4 py-4 text-right text-[11px] font-bold uppercase tracking-widest text-zinc-500">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/90">
              {visibleItems.map((e) => (
                <tr
                  key={e.id}
                  className={
                    "group transition-colors hover:bg-zinc-50/50 " +
                    (focusedId === e.id ? "bg-indigo-50/70" : "") +
                    (flashRowId === e.id || flashRowId === e.employeeCode
                      ? flashKind === "success"
                        ? " bg-emerald-50/50"
                        : " bg-rose-50/50"
                      : "")
                  }
                  onMouseEnter={() => setFocusedId(e.id)}
                  onMouseLeave={() => setFocusedId(null)}
                >

                  <td className="px-4 py-3">
                    <div className="flex min-w-0 flex-col">
                      <Link
                        href={`/employees/${e.id}`}
                        className="group/name inline-flex min-w-0 items-center rounded-md outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                        title="Çalışan Zaman Profili detay ekranını aç"
                      >
                        <span className="truncate font-bold text-zinc-900 transition-all duration-150 group-hover/name:text-indigo-700 group-hover/name:underline group-hover/name:decoration-indigo-300 group-hover/name:underline-offset-4">
                          {e.firstName} {e.lastName}
                        </span>
                      </Link>
                      <span className="truncate font-mono text-[10px] font-bold text-zinc-400">
                        KOD: {e.employeeCode}
                      </span>
                      {(e.cardNo || e.deviceUserId) && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {e.cardNo ? (
                            <Badge tone="violet" className="normal-case tracking-normal">
                              Kart ID: {e.cardNo}
                            </Badge>
                          ) : null}
                          {e.deviceUserId ? (
                            <Badge tone="info" className="normal-case tracking-normal">
                              Cihaz: {e.deviceUserId}
                            </Badge>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 font-medium text-zinc-600">{e.employment.startDate ?? "—"}</td>

                  <td className="px-4 py-3">
                    {e.branch ? (
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-bold text-zinc-800">
                          {e.branch.code} — {e.branch.name}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500">Read-only görünüm</span>
                      </div>
                    ) : (
                      <Badge tone="neutral" className="normal-case tracking-normal">
                        Atanmamış
                      </Badge>
                    )}
                  </td>

                  <td className="px-4 py-3 text-center">
                    <Badge tone={e.derivedIsActive ? "good" : "danger"}>
                      {e.derivedIsActive ? "Aktif" : "Pasif"}
                    </Badge>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <Link
                        href={`/employees/${e.id}`}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 p-2 text-slate-400 transition-colors hover:bg-indigo-50/70 hover:text-indigo-700"
                        title="Çalışan Zaman Profili detay ekranı"
                      >
                        <IconEye className="h-4 w-4" />
                      </Link>

                      {e.derivedIsActive ? (
                        <button
                          onClick={() => openScopeRedirect(e, "TERMINATE")}
                          disabled={!canWrite || loading}
                          className="rounded-lg border border-rose-100 px-3 py-1 text-[11px] font-bold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                          title="Zaman kapsamını sonlandır"
                        >
                          Kapsamı Sonlandır
                        </button>
                      ) : (
                        <button
                          onClick={() => openScopeRedirect(e, "REHIRE")}
                          disabled={!canWrite || loading}
                          className="rounded-lg border border-indigo-100 px-3 py-1 text-[11px] font-bold text-indigo-600 transition-colors hover:bg-indigo-50 disabled:opacity-50"
                          title="Yeni kapsam dönemi başlat"
                        >
                          Kapsamı Aç
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-zinc-600">
                    {statusFilter === "PASSIVE"
                      ? "Pasif kayıt havuzunda çalışan bulunamadı."
                      : statusFilter === "ACTIVE"
                        ? "Aktif kapsamda çalışan bulunamadı."
                        : "Henüz kayıtlı çalışan yok."}
                  </td>
                </tr>
              )}

              {items.length > 0 && visibleItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-zinc-600">
                    {statusFilter === "PASSIVE"
                      ? "Pasif kayıt filtresine uyan çalışan bulunamadı."
                      : statusFilter === "ACTIVE"
                        ? "Aktif çalışan filtresine uyan kayıt bulunamadı."
                        : "Filtrelere uyan çalışan bulunamadı."}
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

      {scopeRedirectAction && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <div className="text-lg font-semibold text-slate-950">
                  {scopeRedirectAction.mode === "TERMINATE"
                    ? "Kapsam Yönetimi Ekranına Git"
                    : "Yeni Kapsam Ekranına Git"}
                </div>
                <div className="text-sm text-slate-600">
                  <span className="font-medium text-slate-900">
                    {scopeRedirectAction.employee.employeeCode}
                  </span>{" "}
                  — {scopeRedirectAction.employee.firstName} {scopeRedirectAction.employee.lastName}
                </div>
              </div>
              <Button variant="secondary" onClick={closeScopeRedirectModal}>
                Kapat
              </Button>
            </div>

            <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-950">
              {scopeRedirectAction.mode === "TERMINATE" ? (
                <>
                  Bu çalışanın <span className="font-semibold">kapsam sonlandırma</span> işlemi artık liste ekranında yapılmaz.
                  Devam edersen çalışan düzenleme ekranındaki <span className="font-semibold">Kart Kapsamı</span> alanına yönlendirilirsin.
                </>
              ) : (
                <>
                  Bu çalışanın <span className="font-semibold">yeni kapsam açma</span> işlemi artık liste ekranında yapılmaz.
                  Devam edersen çalışan düzenleme ekranındaki <span className="font-semibold">Kart Kapsamı</span> alanına yönlendirilirsin.
                </>
              )}
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Amaç: kapsam işlemlerini tek merkezde toplamak, güçlü uyarı/preview akışını yalnızca düzenleme ekranında yürütmek.
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={closeScopeRedirectModal}>
                Vazgeç
              </Button>
              <Link
                href={`/employees/${scopeRedirectAction.employee.id}/edit?intent=${scopeRedirectAction.mode === "TERMINATE" ? "terminate" : "rehire"}`}
                className={cx(
                  "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition-all active:scale-95",
                  scopeRedirectAction.mode === "TERMINATE"
                    ? "border border-rose-300/30 bg-[linear-gradient(135deg,#e11d48,#f43f5e)] text-white shadow-[0_14px_28px_rgba(225,29,72,0.18)] hover:brightness-105"
                    : "border border-indigo-400/30 bg-[linear-gradient(135deg,#4f46e5,#7c3aed)] text-white shadow-[0_14px_28px_rgba(79,70,229,0.24)] hover:brightness-105"
                )}
                onClick={closeScopeRedirectModal}
              >
                {scopeRedirectAction.mode === "TERMINATE"
                  ? "Kapsam Ekranına Git"
                  : "Yeni Kapsam İçin Git"}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
