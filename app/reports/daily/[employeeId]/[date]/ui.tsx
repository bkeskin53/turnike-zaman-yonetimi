"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DailyInitialLoading from "../../_components/DailyInitialLoading";
import DailyModuleNav from "../../_components/DailyModuleNav";
import {
  buildPolicyTooltip,
  buildShiftTooltip,
  fmt,
  fmtMin,
  formatPolicySourceTR,
  getCode,
  getName,
  prettyAnomaly,
  reviewBadge,
  shiftDisplay,
  statusBadge,
} from "../../_components/dailyShared";
import DetailAccessBanner from "./_components/DetailAccessBanner";

type DailyItem = any;

const detailCardTone = {
  summary:
    "rounded-2xl border border-sky-200/80 bg-[linear-gradient(180deg,rgba(248,252,255,0.98),rgba(240,249,255,0.92))] p-5 shadow-[0_12px_30px_rgba(14,165,233,0.08)]",
  time:
    "rounded-2xl border border-sky-200/80 bg-[linear-gradient(180deg,rgba(248,252,255,1),rgba(240,249,255,0.94))] p-4 shadow-[0_10px_26px_rgba(14,165,233,0.08)]",
  calc:
    "rounded-2xl border border-violet-200/80 bg-[linear-gradient(180deg,rgba(250,245,255,1),rgba(245,243,255,0.94))] p-4 shadow-[0_10px_26px_rgba(139,92,246,0.08)]",
  rule:
    "rounded-2xl border border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,1),rgba(255,247,237,0.96))] p-4 shadow-[0_10px_26px_rgba(245,158,11,0.08)]",
  ops:
    "rounded-2xl border border-rose-200/80 bg-[linear-gradient(180deg,rgba(255,241,242,1),rgba(255,245,245,0.96))] p-4 shadow-[0_10px_26px_rgba(244,63,94,0.08)]",
  issues:
    "rounded-2xl border border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,1),rgba(255,247,237,0.96))] p-4 shadow-[0_12px_28px_rgba(245,158,11,0.08)]",
} as const;

function cardKicker(tone: "sky" | "violet" | "amber" | "rose") {
  switch (tone) {
    case "sky":
      return "text-sky-700";
    case "violet":
      return "text-violet-700";
    case "amber":
      return "text-amber-800";
    case "rose":
      return "text-rose-700";
    default:
      return "text-zinc-500";
  }
}

export default function DailyDetailClient({
  employeeId,
  date,
  canRecompute,
  role,
}: {
  employeeId: string;
  date: string;
  canRecompute: boolean;
  role: string;
}) {
  const [item, setItem] = useState<DailyItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
        const found =
          (json.items ?? []).find((it: any) => String(it.employeeId ?? it.employee?.id ?? "") === employeeId) ?? null;
        setItem(found);
      } catch (e: any) {
        setError(e?.message ?? "Load failed");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [employeeId, date]);

  const anomalies = useMemo(() => (Array.isArray(item?.anomalies) ? item.anomalies : []), [item]);
  const st = statusBadge(String(item?.status ?? ""));
  const review = reviewBadge(String(item?.reviewStatus ?? "NONE"));

  return (
    <div className="grid gap-4">
      <DetailAccessBanner role={role} canRecompute={canRecompute} />
      <DailyModuleNav mode="detail" date={date} employeeId={employeeId} />

      {loading ? <DailyInitialLoading /> : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}
      {!loading && !error && !item ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Seçilen personele ait günlük satır bulunamadı. Tarihi veya personel bağlamını kontrol et.
        </div>
      ) : null}

      {item ? (
        <>
          <div className={detailCardTone.summary}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Teknik Çözümleme</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900">{getName(item)}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
                  <span>
                    Kod: <span className="font-medium text-zinc-900">{getCode(item) || "—"}</span>
                  </span>
                  <span>•</span>
                  <span>
                    Tarih: <span className="font-medium text-zinc-900">{date}</span>
                  </span>
                  <span>•</span>
                  <span>
                    Vardiya: <span className="font-medium text-zinc-900">{shiftDisplay(item)}</span>
                  </span>
                </div>
                <div className="mt-2 text-sm leading-relaxed text-zinc-700">
                  Bu ekran, seçili gün sonucunun neden bu şekilde üretildiğini incelemek içindir. Review aksiyonları ayrı operasyonda kalır.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                {review ? (
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${review.cls}`}>
                    {review.label}
                  </span>
                ) : null}
                {item.manualOverrideApplied ? (
                  <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                    MANUAL
                  </span>
                ) : null}
                <Link
                  href={`/employees/${encodeURIComponent(employeeId)}`}
                  className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Personel 360
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className={detailCardTone.time}>
              <div className={`text-xs font-semibold uppercase tracking-[0.12em] ${cardKicker("sky")}`}>Zaman</div>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-sky-900/75">FirstIn</span>
                  <span className="tabular-nums font-medium text-sky-950">{fmt(item.firstIn) || "—"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-sky-900/75">LastOut</span>
                  <span className="tabular-nums font-medium text-sky-950">{fmt(item.lastOut) || "—"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-sky-900/75">Shift</span>
                  <span className="tabular-nums text-right font-medium text-sky-950" title={buildShiftTooltip(item)}>
                    {shiftDisplay(item)}
                  </span>
                </div>
              </div>
            </section>

            <section className={detailCardTone.calc}>
              <div className={`text-xs font-semibold uppercase tracking-[0.12em] ${cardKicker("violet")}`}>Hesap</div>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-violet-950/75">Worked</span>
                  <span className="tabular-nums font-semibold text-violet-950">{fmtMin(item.workedMinutes)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-violet-950/75">Scheduled</span>
                  <span className="tabular-nums font-semibold text-violet-950">{fmtMin(item.scheduledWorkedMinutes)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-violet-950/75">Unscheduled</span>
                  <span className="tabular-nums font-semibold text-violet-950">{fmtMin(item.unscheduledWorkedMinutes)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-violet-950/75">Late</span>
                  <span className="tabular-nums font-semibold text-violet-950">{fmtMin(item.lateMinutes)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-violet-950/75">Early</span>
                  <span className="tabular-nums font-semibold text-violet-950">{fmtMin(item.earlyLeaveMinutes)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-violet-950/75">OT Total</span>
                  <span className="tabular-nums font-semibold text-violet-950">{fmtMin(item.overtimeMinutes)}</span>
                </div>
              </div>
            </section>

            <section className={detailCardTone.rule}>
              <div className={`text-xs font-semibold uppercase tracking-[0.12em] ${cardKicker("amber")}`}>Kural ve Kaynak</div>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-amber-950/75">Policy Source</span>
                  <span className="text-right font-medium text-amber-950">{formatPolicySourceTR(item.policySource) || "—"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-amber-950/75">RuleSet</span>
                  <span className="text-right font-medium text-amber-950" title={buildPolicyTooltip(item)}>
                    {item.policyRuleSetCode ?? item.policyRuleSetName ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-amber-950/75">Rule Code</span>
                  <span className="text-right font-medium text-amber-950">{item.policyRuleSetCode || "—"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-zinc-600">Rule Name</span>
                  <span className="text-right text-zinc-900">{item.policyRuleSetName || "—"}</span>
                </div>
              </div>
            </section>

            <section className={detailCardTone.ops}>
              <div className={`text-xs font-semibold uppercase tracking-[0.12em] ${cardKicker("rose")}`}>Operasyon Notu</div>
              <div className="mt-3 grid gap-2 text-sm text-rose-950/80">
                <div>Bu ekran teknik çözümleme içindir. Review aksiyonları ayrı operasyonda kalır.</div>
                <div className="rounded-xl border border-rose-200 bg-white/75 px-3 py-2 text-xs text-rose-800">
                  Review durumu: <span className="font-semibold text-rose-950">{item.reviewStatus || "NONE"}</span>
                </div>
              </div>
            </section>
          </div>

          <section className={detailCardTone.issues}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-900">Issues</div>
              <span className="text-xs font-semibold text-amber-900">Toplam {anomalies.length}</span>
            </div>
            {anomalies.length ? (
              <ul className="mt-3 grid gap-2 text-sm text-amber-900">
                {anomalies.map((code: string, idx: number) => (
                  <li key={`${employeeId}-${date}-${idx}`} className="rounded-xl border border-amber-200/70 bg-white/85 px-3 py-2">
                    <span className="font-mono text-xs">{code}</span>
                    <span className="mx-2 text-amber-300">—</span>
                    <span>{prettyAnomaly(code)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-amber-200 bg-white/70 px-3 py-3 text-sm text-amber-900">
                Bu satırda anomaly bulunmuyor.
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}