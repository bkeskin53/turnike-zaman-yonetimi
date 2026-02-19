"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

type DailyItem = any;

function formatShiftSourceTR(src: string | null | undefined): string {
  switch (src) {
    case "POLICY":
      return "Policy";
    case "WORK_SCHEDULE":
      return "Work Schedule";
    case "WEEK_TEMPLATE":
      return "Week Template";
    case "DAY_TEMPLATE":
      return "Day Template";
    case "CUSTOM":
      return "Custom";
    default:
      return src ? String(src) : "";
  }
}

function formatPolicySourceTR(src: string | null | undefined): string {
  switch (src) {
    case "EMPLOYEE":
      return "Personel";
    case "EMPLOYEE_SUBGROUP":
      return "Alt Grup";
    case "EMPLOYEE_GROUP":
      return "Grup";
    case "BRANCH":
      return "Şube";
    case "COMPANY":
      return "Şirket (Default)";
    default:
      return src ? String(src) : "";
  }
}

function buildPolicyTooltip(it: any): string {
  const src = formatPolicySourceTR(it.policySource);
  const code = (it.policyRuleSetCode ?? "").toString();
  const name = (it.policyRuleSetName ?? "").toString();
  const parts: string[] = [];
  if (src) parts.push(`Kaynak: ${src}`);
  if (code) parts.push(`Kod: ${code}`);
  if (name) parts.push(`Ad: ${name}`);
  if (!code && !name) parts.push("RuleSet: (atanmamış)");
  return parts.join("\n");
}

function isOvernightBadge(badgeOrLabel: string | null | undefined): boolean {
  if (!badgeOrLabel) return false;
  // Badge may contain "🌙" or signature may contain "+1"
  return badgeOrLabel.includes("🌙") || badgeOrLabel.includes("+1");
}

function buildShiftTooltip(it: any): string {
  const src = formatShiftSourceTR(it.shiftSource);
  const label = (it.shiftLabel ?? it.shiftSignature ?? "").toString();
  const badge = (it.shiftBadge ?? "").toString();
  const overnight = isOvernightBadge(badge || label) ? "Evet" : "Hayır";
  const parts = [];
  if (src) parts.push(`Kaynak: ${src}`);
  if (label) parts.push(`Vardiya: ${label}`);
  if (src || label) parts.push(`Gece: ${overnight}`);
  return parts.join("\n");
}

function stripEmoji(input: string) {
  // UI-only: remove emoji/pictographs that make the Shift column look childish / misaligned.
  // Keep "+1" etc. as-is.
  return input
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "") // most emoji blocks
    .replace(/[\u{2600}-\u{26FF}]/gu, "")   // misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, "")   // dingbats
    .replace(/\s{2,}/g, " ")
    .trim();
}

function fmt(dt: any) {
  if (!dt) return "";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return new Intl.DateTimeFormat("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

function n0(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function hasNum(v: any): boolean {
  const n = Number(v);
  return Number.isFinite(n);
}

function fmtMin(v: any): string {
  // minutes -> "480" etc (UI only)
  const n = n0(v);
  return String(n);
}

function issuesBadge(anomalies: string[]) {
  const c = anomalies.length;
  if (!c) return { label: "—", cls: "bg-zinc-100 text-zinc-600" };
  if (c >= 3) return { label: `${c} issue`, cls: "bg-rose-50 text-rose-700" };
  return { label: `${c} issue`, cls: "bg-amber-50 text-amber-800" };
}

function prettyAnomaly(code: string): string {
  // Minimal, safe mapping (unknown codes are shown as-is)
  switch (code) {
    case "LATE_OUT_CAPTURED":
      return "Geç OUT yakalandı (pencere dışı, ertesi güne sarkan çıkış bugünü kapattı)";
    case "MISSING_PUNCH":
      return "Eksik punch (IN/OUT eksik)";
    case "MISSING_IN":
      return "IN eksik";
    case "MISSING_OUT":
      return "OUT eksik";
    case "DUPLICATE_PUNCH":
      return "Duplicate punch";
    case "CONSECUTIVE_IN":
      return "Arka arkaya IN (önceki IN kapanmadan yeni IN)";
    case "CONSECUTIVE_OUT":
      return "Arka arkaya OUT (önceki OUT’tan sonra tekrar OUT)";
    case "ORPHAN_OUT":
      return "Yetim OUT (öncesinde kabul edilmiş IN yok)";
    case "UNSCHEDULED_WORK":
      return "Vardiya dışı fiili çalışma (planlanan vardiya ile uyuşmuyor)";
    case "OUTSIDE_SHIFT_IGNORED":
      return "Vardiya penceresi dışında punch (CLAMP: worked'e dahil edilmedi)";
    case "DUPLICATE_EVENT":
      return "Duplicate event (aynı kayıt tekrarlandı)";
    case "EARLY_IN":
      return "Vardiya öncesi giriş";
    case "LATE_IN":
      return "Geç giriş";
    case "EARLY_OUT":
      return "Erken çıkış";
    case "LATE_OUT":
      return "Geç çıkış";
    case "OVERNIGHT":
      return "Gece sınırı (+1) aşıldı";
    case "PUNCH_BEFORE_SHIFT":
      return "Vardiya başlamadan punch";
    case "PUNCH_AFTER_SHIFT":
      return "Vardiya bitince punch";
    default:
      return code;
  }
}

function getCode(item: DailyItem) {
  return item.employee?.employeeCode ?? item.employeeCode ?? "";
}

function getName(item: DailyItem) {
  if (item.employee?.firstName || item.employee?.lastName) {
    return `${item.employee?.firstName ?? ""} ${item.employee?.lastName ?? ""}`.trim();
  }
  return item.fullName ?? item.name ?? "";
}

function badgeClass(kind: "ok" | "warn" | "bad" | "neutral") {
  if (kind === "ok") return "bg-emerald-50 text-emerald-700";
  if (kind === "warn") return "bg-amber-50 text-amber-800";
  if (kind === "bad") return "bg-rose-50 text-rose-700";
  return "bg-zinc-100 text-zinc-700";
}

function statusBadge(status: string) {
  switch (status) {
    case "PRESENT":
      return { label: "PRESENT", cls: badgeClass("ok") };
    case "ABSENT":
      return { label: "ABSENT", cls: badgeClass("bad") };
    case "OFF":
      return { label: "OFF", cls: badgeClass("neutral") };
    default:
      return { label: String(status ?? ""), cls: badgeClass("neutral") };
  }
}

export default function DailyReportClient() {
  const [date, setDate] = useState(() => {
    // Local tarih (UTC değil): 00:00-03:00 arası "dün"e kayma bug'ını engeller
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [items, setItems] = useState<DailyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecompute, setLoadingRecompute] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [exNotEmployed, setExNotEmployed] = useState<{
    count: number;
    limited: number;
    limit: number;
    items: Array<{
      employeeId: string;
      employeeCode: string;
      fullName: string;
      lastEmployment: { startDate: string | null; endDate: string | null; reason: string | null } | null;
    }>;
  } | null>(null);
  const [showExNotEmployed, setShowExNotEmployed] = useState(false);

  const summary = useMemo(() => {
    const s = { PRESENT: 0, ABSENT: 0, OFF: 0, LEAVE: 0, MISSING_PUNCH: 0 };
    for (const it of items) {
      if (it.status === "PRESENT") s.PRESENT++;
      else if (it.status === "ABSENT") s.ABSENT++;
      else if (it.status === "OFF") s.OFF++;
      else if (it.status === "LEAVE") s.LEAVE++;
      const an = it.anomalies ?? [];
      if (Array.isArray(an) && an.includes("MISSING_PUNCH")) s.MISSING_PUNCH++;
    }
    return s;
  }, [items]);

  function rowKey(it: any) {
    // stable key: prefer attendance id; fallback to employeeId+date
    return String(it.id ?? `${it.employeeId ?? "emp"}__${it.workDate ?? "day"}`);
  }

  function onToolbarKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") load();
  }

  function onRowKeyDown(e: React.KeyboardEvent, key: string) {
    if (e.key === "Enter" || e.key === " ") toggleRow(key);
  }

  function toggleRow(key: string) {
    setOpenRows((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/daily?date=${encodeURIComponent(date)}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`GET daily failed: ${res.status}`);
      const json = await res.json();
      setItems(json.items ?? []);
      setExNotEmployed(json?.meta?.exclusions?.notEmployed ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Load failed");
    } finally {
      setLoading(false);
    }
  }

  async function recompute() {
    setLoadingRecompute(true);
    setError(null);
    try {
      const res = await fetch(`/api/attendance/recompute?date=${encodeURIComponent(date)}`, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`POST recompute failed: ${res.status}`);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Recompute failed");
    } finally {
      setLoadingRecompute(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid max-w-full gap-4 overflow-x-hidden">
      {/* Hide scrollbar but keep scroll */}
      <style jsx global>{`
      /* Only hide VERTICAL scrollbar (keep horizontal visible) */
        .y-scrollbar-hide::-webkit-scrollbar {
          width: 0px;
        }
        .y-scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          width: 0px;
          height: 0px;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Toolbar */}
      <div className="flex w-full min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-700">Date</span>
            <input
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-300"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onKeyDown={onToolbarKeyDown}
            />
          </label>

          <button
            type="button"
            onClick={recompute}
            disabled={loadingRecompute}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {loadingRecompute ? "Recomputing…" : "Recompute"}
          </button>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>

          <a
            href={`/api/reports/daily/export?date=${encodeURIComponent(date)}`}
            className={
              "inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 " +
              (loading ? "pointer-events-none opacity-50" : "")
            }
            title="CSV indir (Excel)"
          >
            CSV
          </a>

          <a
            href={`/api/reports/anomalies/export?from=${encodeURIComponent(date)}&to=${encodeURIComponent(date)}`}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
            title="Bu günün anomalilerini CSV indir (Excel)"
          >
            Anomali CSV
          </a>
        </div>

        {/* Summary chips (horizontal scroll when needed) */}
        <div className="max-w-full overflow-x-auto">
          <div className="flex min-w-max items-center gap-2 text-sm sm:flex-wrap sm:min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
            Present <span className="font-semibold">{summary.PRESENT}</span>
          </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-rose-700">
            Absent <span className="font-semibold">{summary.ABSENT}</span>
          </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">
            Leave <span className="font-semibold">{summary.LEAVE}</span>
          </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-zinc-700">
            Off <span className="font-semibold">{summary.OFF}</span>
          </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-amber-800">
            MissingPunch <span className="font-semibold">{summary.MISSING_PUNCH}</span>
          </span>
          </div>
        </div>
      </div>
      
      {exNotEmployed?.count ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-1">
              <div className="font-semibold">Bilgi: Employment validity dışında kalan personel var</div>
              <div className="text-sm">
                Seçilen tarihte <span className="font-medium">{exNotEmployed.count}</span> personel “iş ilişkisi” aralığı dışında olduğu için
                değerlendirmeye alınmadı (DailyAttendance üretilmedi).
              </div>
              {exNotEmployed.count > exNotEmployed.limited ? (
                <div className="text-xs opacity-80">
                  Not: Liste ilk {exNotEmployed.limited} kişi ile sınırlıdır (limit {exNotEmployed.limit}).
                </div>
              ) : null}
            </div>
            <button
              className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm hover:bg-amber-100"
              onClick={() => setShowExNotEmployed((s) => !s)}
            >
              {showExNotEmployed ? "Gizle" : "Detayı göster"}
            </button>
          </div>

          {showExNotEmployed ? (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[760px] w-full table-fixed text-sm">
                <thead className="text-amber-900/90">
                  <tr>
                   <th className="w-[140px] text-left px-2 py-2">Kod</th>
                    <th className="text-left px-2 py-2">Ad Soyad</th>
                    <th className="w-[130px] text-left px-2 py-2">İşe Baş.</th>
                    <th className="w-[130px] text-left px-2 py-2">Çıkış</th>
                    <th className="w-[220px] text-left px-2 py-2">Not</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-200/60">
                  {exNotEmployed.items.map((x) => (
                    <tr key={x.employeeId} className="bg-white/40">
                      <td className="px-2 py-2 font-mono text-xs">{x.employeeCode}</td>
                      <td className="px-2 py-2">{x.fullName || "—"}</td>
                      <td className="px-2 py-2">{x.lastEmployment?.startDate ?? "—"}</td>
                      <td className="px-2 py-2">{x.lastEmployment?.endDate ?? "—"}</td>
                      <td className="px-2 py-2">{x.lastEmployment?.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      )}
      
      {/* Table */}
        <div className="relative max-w-full overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <div className="max-h-[520px] w-full overflow-y-auto">
            <table className="w-full min-w-full table-fixed border-collapse text-sm">
            {/* colgroup: içinde yorum/boşluk bırakma (hydration warning yapar) */}
            <colgroup>
              {/* Code */}
              <col className="w-[clamp(64px,8vw,88px)]" />
              {/* Name */}
              <col className="w-[clamp(120px,20vw,200px)]" />
              {/* Status */}
              <col className="w-[clamp(84px,10vw,120px)]" />
              {/* Rule */}
              <col className="w-[clamp(140px,22vw,260px)]" />
              {/* Shift */}
              <col className="w-[clamp(140px,22vw,260px)]" />
              {/* Worked */}
              <col className="w-[clamp(72px,9vw,108px)]" />
              {/* Issues */}
              <col className="w-[clamp(72px,9vw,108px)]" />
              {/* Actions */}
              <col className="w-[clamp(84px,10vw,120px)]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                <th className="border-b border-zinc-200 px-2 py-2">Code</th>
                <th className="border-b border-zinc-200 px-2 py-2">Name</th>
                <th className="border-b border-zinc-200 px-2 py-2 text-center">Status</th>
                <th className="border-b border-zinc-200 px-2 py-2">Rule</th>
                <th className="border-b border-zinc-200 px-2 py-2">Shift</th>
                <th className="border-b border-zinc-200 px-2 py-2">Worked</th>
                <th className="border-b border-zinc-200 px-2 py-2">Issues</th>
                <th className="border-b border-zinc-200 px-2 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
            {items.map((it: any) => {
              const key = rowKey(it);
              const anomalies = Array.isArray(it.anomalies) ? (it.anomalies as string[]) : [];
              const hasAnomaly = anomalies.length > 0;
              const isOpen = !!openRows[key];
              const st = statusBadge(String(it.status ?? ""));
              const ib = issuesBadge(anomalies);
              return (
                <Fragment key={key}>
                  <tr
                    className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50"
                    onClick={() => toggleRow(key)}
                    onKeyDown={(e) => onRowKeyDown(e, key)}
                    tabIndex={0}
                    role="button"
                    aria-expanded={isOpen}
                    title="Detay için tıkla"
                  >
                    <td className="whitespace-nowrap px-2 py-2">{getCode(it)}</td>

                    <td className="px-2 py-2">
                      <div className="min-w-0 truncate">{getName(it)}</div>
                    </td>

                    <td className="px-2 py-2 text-center">
                      <div className="inline-flex items-center justify-center gap-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>
                          {st.label}
                        </span>
                        {it.manualOverrideApplied ? (
                          <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                            MANUAL
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* Rule (Policy RuleSet) */}
                    <td className="px-2 py-2">
                      <span title={buildPolicyTooltip(it)} className="block min-w-0">
                        <span className="block truncate whitespace-nowrap">
                          {String(it.policyRuleSetCode ?? it.policyRuleSetName ?? "—")}
                        </span>
                      </span>
                    </td>

                    <td className="px-2 py-2">
                      <span title={buildShiftTooltip(it)} className="block min-w-0">
                        <span className="block truncate whitespace-nowrap">
                          {stripEmoji(String(it.shiftLabel ?? it.shiftSignature ?? it.shiftBadge ?? ""))}
                        </span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                      {it.workedMinutes ?? 0}
                    </td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${ib.cls}`}>
                        {ib.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <div className="flex justify-start">
                        <span className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                          <span className="font-mono">{isOpen ? "▾" : "▸"}</span>
                          Details
                        </span>
                      </div>
                    </td>
                  </tr>

                  {isOpen ? (
                    <tr key={`${key}__details`} className="bg-zinc-50/50">
                      <td colSpan={8} className="border-t border-dashed border-zinc-200 px-3 py-3">
                        <div className="grid gap-3 md:grid-cols-4">
                          {/* Policy */}
                          <div className="rounded-lg border border-zinc-200 bg-white p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Policy</div>
                            <div className="mt-2 grid gap-1 text-sm text-zinc-900">
                              <div className="flex justify-between gap-3">
                                <span className="text-zinc-600">Source</span>
                                <span className="tabular-nums">{formatPolicySourceTR(it.policySource) || "—"}</span>
                              </div>
                              <div className="flex justify-between gap-3">
                                <span className="text-zinc-600">Code</span>
                                <span className="tabular-nums">{it.policyRuleSetCode || "—"}</span>
                              </div>
                              <div className="flex justify-between gap-3">
                                <span className="text-zinc-600">Name</span>
                                <span className="tabular-nums">{it.policyRuleSetName || "—"}</span>
                              </div>
                            </div>
                          </div>
                          {/* Zaman */}
                          <div className="rounded-lg border border-zinc-200 bg-white p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Zaman</div>
                            <div className="mt-2 grid gap-1 text-sm text-zinc-900">
                              <div className="flex justify-between gap-3">
                                <span className="text-zinc-600">FirstIn</span>
                                <span className="tabular-nums">{fmt(it.firstIn) || "—"}</span>
                              </div>
                              <div className="flex justify-between gap-3">
                                <span className="text-zinc-600">LastOut</span>
                                <span className="tabular-nums">{fmt(it.lastOut) || "—"}</span>
                              </div>
                            </div>
                          </div>

                          {/* Hesap */}
                          <div className="rounded-lg border border-zinc-200 bg-white p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Hesap</div>
                            <div className="mt-2 grid gap-1 text-sm text-zinc-900">
                              <div className="flex justify-between gap-3">
                                <span className="text-zinc-600">Worked</span>
                                <span className="tabular-nums">{fmtMin(it.workedMinutes)}</span>
                              </div>
                              <div className="flex justify-between gap-3">
                                <span className="text-zinc-600">Late</span>
                                <span className="tabular-nums">{fmtMin(it.lateMinutes)}</span>
                              </div>
                              <div className="flex justify-between gap-3">
                                <span className="text-zinc-600">Early</span>
                                <span className="tabular-nums">{fmtMin(it.earlyLeaveMinutes)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Overtime */}
                          <div className="rounded-lg border border-zinc-200 bg-white p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Overtime</div>
                            <div className="mt-2 grid gap-1 text-sm text-zinc-900">
                              <div className="flex justify-between gap-3">
                                <span className="text-zinc-600">OT(Early)</span>
                                <span className="tabular-nums">{fmtMin(it.overtimeEarlyMinutes)}</span>
                              </div>
                              <div className="flex justify-between gap-3">
                                <span className="text-zinc-600">OT(Late)</span>
                                <span className="tabular-nums">{fmtMin(it.overtimeLateMinutes)}</span>
                              </div>
                              <div className="flex justify-between gap-3">
                                <span className="text-zinc-600">OT(Total)</span>
                                <span className="tabular-nums">{fmtMin(it.overtimeMinutes)}</span>
                              </div>

                              {/* Enterprise: OT Dynamic Break (DB/API’den gelirse göster) */}
                              {hasNum((it as any).otBreakCount) || hasNum((it as any).otBreakDeductMinutes) ? (
                                <div className="mt-2 border-t border-zinc-100 pt-2">
                                  {hasNum((it as any).otBreakInterval) && hasNum((it as any).otBreakDuration) ? (
                                    <div className="flex justify-between gap-3">
                                      <span className="text-zinc-600">OT Break Rule</span>
                                      <span className="tabular-nums">
                                        {fmtMin((it as any).otBreakInterval)} / {fmtMin((it as any).otBreakDuration)}
                                      </span>
                                    </div>
                                  ) : null}

                                  {hasNum((it as any).otBreakCount) ? (
                                    <div className="flex justify-between gap-3">
                                      <span className="text-zinc-600">OT Break Count</span>
                                      <span className="tabular-nums">{String(n0((it as any).otBreakCount))}</span>
                                    </div>
                                  ) : null}

                                  {hasNum((it as any).otBreakDeductMinutes) ? (
                                    <div className="flex justify-between gap-3">
                                      <span className="text-zinc-600">OT Break Deduct</span>
                                      <span className="tabular-nums">{fmtMin((it as any).otBreakDeductMinutes)}</span>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {hasAnomaly ? (
                          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-amber-900">Issues</div>
                            <ul className="m-0 mt-2 list-disc pl-5 text-sm text-amber-900">
                              {anomalies.map((a, idx) => (
                                <li key={`${key}__a__${idx}`} className="py-0.5">
                                  <span className="font-mono text-xs">{a}</span>
                                  <span className="text-amber-700"> — </span>
                                  <span>{prettyAnomaly(a)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-zinc-500">No issues.</div>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-zinc-600">
                  No data.
                </td>
              </tr>
            )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
