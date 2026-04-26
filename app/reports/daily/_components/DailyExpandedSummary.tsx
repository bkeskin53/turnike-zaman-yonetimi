"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SummaryMetric, prettyAnomaly, safeText } from "./dailyShared";

type DayViewFilter = "ALL" | "SCHEDULED" | "UNSCHEDULED";

type OwnershipAuditItem = {
  id: string;
  rawEventId: string;
  logicalDayKey: string;
  occurredAt: string;
  direction: "IN" | "OUT";
  ownerLogicalDayKey: string | null;
  ownerSource: "PREVIOUS_DAY" | "CURRENT_DAY" | "NEXT_DAY" | null;
  ownershipScore: number | null;
  ownershipBreakdown: any;
  disposition: "SCHEDULED" | "VISIBLE_UNSCHEDULED" | "OWNED_OTHER_LOGICAL_DAY" | "IGNORED";
  note: string | null;
  shiftSource: string | null;
  shiftSignature: string | null;
  createdAt: string;
  updatedAt: string;
};

function fmtTR(dt: any) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function directionBadge(direction: "IN" | "OUT") {
  return direction === "IN"
    ? "bg-sky-50 text-sky-700"
    : "bg-rose-50 text-rose-700";
}

function ownerSourceTR(src: OwnershipAuditItem["ownerSource"]) {
  switch (src) {
    case "PREVIOUS_DAY":
      return "Önceki Gün";
    case "CURRENT_DAY":
      return "Mevcut Gün";
    case "NEXT_DAY":
      return "Sonraki Gün";
    default:
      return "—";
  }
}

function dispositionTR(disposition: OwnershipAuditItem["disposition"]) {
  switch (disposition) {
    case "VISIBLE_UNSCHEDULED":
      return "Plansız Görünür";
    case "SCHEDULED":
      return "Planlı";
    case "OWNED_OTHER_LOGICAL_DAY":
      return "Başka Güne Ait";
    default:
      return "Yok Sayıldı";
  }
}

function unscheduledExplanation(item: OwnershipAuditItem) {
  if (item.direction === "IN") {
    return "Planlı vardiya dışında kalan giriş aktivitesi.";
  }
  return "Planlı vardiya dışında kalan çıkış aktivitesi.";
}

function anomalyMetaText(meta: any) {
  if (!meta || typeof meta !== "object") return null;

  const actual =
    typeof meta.actual === "number" && Number.isFinite(meta.actual) ? meta.actual : null;
  const limit =
    typeof meta.limit === "number" && Number.isFinite(meta.limit) ? meta.limit : null;
  const exceededMinutes =
    typeof meta.exceededMinutes === "number" && Number.isFinite(meta.exceededMinutes)
      ? meta.exceededMinutes
      : null;

  if (actual === null || limit === null || exceededMinutes === null) return null;

  return `${limit} dk limit • ${actual} dk gerçekleşen • +${exceededMinutes} dk aşım`;
}

export default function DailyExpandedSummary({
  item,
  date,
  employeeId,
  dayViewFilter,
}: {
  item: any;
  date: string;
  employeeId: string;
  dayViewFilter: DayViewFilter;
}) {
  const anomalies = Array.isArray(item.anomalies) ? (item.anomalies as string[]) : [];
  const anomalyMeta =
    item && typeof item.anomalyMeta === "object" && item.anomalyMeta ? item.anomalyMeta : {};
  const detailHref = employeeId ? `/reports/daily/${encodeURIComponent(employeeId)}/${encodeURIComponent(date)}` : "#";

  const [ownershipItems, setOwnershipItems] = useState<OwnershipAuditItem[]>([]);
  const [ownershipLoading, setOwnershipLoading] = useState(false);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOwnership() {
      if (dayViewFilter !== "UNSCHEDULED" || !employeeId) return;

      setOwnershipLoading(true);
      setOwnershipError(null);

      try {
        const res = await fetch(
          `/api/admin/attendance-ownership?employeeId=${encodeURIComponent(employeeId)}&dayKey=${encodeURIComponent(date)}`,
          {
            cache: "no-store",
            credentials: "include",
          }
        );
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.message ?? json?.error ?? `OWNERSHIP_AUDIT_FETCH_FAILED: ${res.status}`);
        }

        if (!cancelled) {
          setOwnershipItems(Array.isArray(json?.items) ? json.items : []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setOwnershipError(e?.message ?? "Plansız event detayları alınamadı");
        }
      } finally {
        if (!cancelled) {
          setOwnershipLoading(false);
        }
      }
    }

    setOwnershipItems([]);
    setOwnershipError(null);

    void loadOwnership();

    return () => {
      cancelled = true;
    };
  }, [dayViewFilter, employeeId, date]);

  const unscheduledEvents = useMemo(
    () => ownershipItems.filter((x) => x.disposition === "VISIBLE_UNSCHEDULED"),
    [ownershipItems]
  );

  if (dayViewFilter === "UNSCHEDULED") {
    return (
      <div className="grid gap-3">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-900">Plansız Aktivite</div>

            <div className="mt-2 grid gap-1 text-sm text-zinc-900">
              <SummaryMetric label="Unscheduled" value={(item as any).unscheduledWorkedMinutes} />
              <SummaryMetric label="Worked" value={item.workedMinutes} />
              <SummaryMetric label="Scheduled" value={(item as any).scheduledWorkedMinutes} />
            </div>

            {ownershipLoading ? (
              <div className="mt-3 text-sm text-zinc-500">Plansız event detayları yükleniyor…</div>
            ) : ownershipError ? (
              <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {ownershipError}
              </div>
            ) : unscheduledEvents.length ? (
              <div className="mt-3 overflow-x-auto rounded-lg border border-amber-200 bg-white">
                <table className="min-w-[760px] w-full table-fixed border-collapse text-sm">
                  <colgroup>
                    <col className="w-[170px]" />
                    <col className="w-[90px]" />
                    <col className="w-[150px]" />
                    <col className="w-[140px]" />
                    <col className="w-[210px]" />
                  </colgroup>
                  <thead className="bg-white">
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                      <th className="border-b border-zinc-200 px-2 py-2">Event Time</th>
                      <th className="border-b border-zinc-200 px-2 py-2">Dir</th>
                      <th className="border-b border-zinc-200 px-2 py-2">Durum</th>
                      <th className="border-b border-zinc-200 px-2 py-2">Owner Source</th>
                      <th className="border-b border-zinc-200 px-2 py-2">Açıklama</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unscheduledEvents.map((ev) => (
                      <tr key={ev.id} className="border-t border-zinc-100 align-top">
                        <td className="px-2 py-2 whitespace-nowrap">{fmtTR(ev.occurredAt)}</td>
                        <td className="px-2 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${directionBadge(ev.direction)}`}>
                            {ev.direction}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            {dispositionTR(ev.disposition)}
                          </span>
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">{ownerSourceTR(ev.ownerSource)}</td>
                        <td className="px-2 py-2 text-zinc-700">{unscheduledExplanation(ev)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-3 rounded-md border border-dashed border-amber-200 bg-white px-3 py-3 text-sm text-amber-900">
                Bu satır için plansız event detayı bulunamadı.
              </div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Hızlı Geçiş</div>
            <div className="mt-2 grid gap-3 text-sm text-zinc-600">
              <div>
                Plansız Gün görünümünde, canonical vardiya özeti yerine plansız event aktivitesi gösterilir.
                Daha geniş teknik çözümleme ayrı detail ekranında yer alır.
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={detailHref}
                  className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                >
                  Teknik Detaya Git
                </Link>
                <Link
                  href={employeeId ? `/employees/${encodeURIComponent(employeeId)}` : "#"}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100"
                >
                  Personel 360
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Issue Önizleme</div>
            <span className="text-xs text-zinc-500">Toplam {anomalies.length}</span>
          </div>
          {anomalies.length ? (
            <ul className="mt-2 grid gap-1 text-sm text-zinc-800">
              {anomalies.slice(0, 2).map((code, idx) => {
                const metaText = anomalyMetaText(anomalyMeta?.[code]);
                return (
                <li key={`${item.id ?? item.employeeId ?? "row"}__anomaly_preview__${idx}`} className="rounded-md bg-zinc-50 px-3 py-2">
                  <span className="font-mono text-xs">{code}</span>
                  <span className="mx-2 text-zinc-300">—</span>
                  <span>{prettyAnomaly(code)}</span>
                  {metaText ? (
                    <div className="mt-1 text-xs font-medium text-amber-700">{metaText}</div>
                  ) : null}
                </li>
              )})}
              {anomalies.length > 2 ? (
                <li className="px-1 text-xs text-zinc-500">Kalan anomaly detayları teknik detail ekranında.</li>
              ) : null}
            </ul>
          ) : (
            <div className="mt-2 text-sm text-zinc-500">Bu satırda issue bulunmuyor.</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Özet Preview</div>
          <div className="mt-2 grid gap-1 text-sm text-zinc-900">
            <div className="flex justify-between gap-3">
              <span className="text-zinc-600">FirstIn</span>
              <span className="tabular-nums">{safeText(item.firstIn ? new Date(item.firstIn).toLocaleString("tr-TR") : "—")}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-zinc-600">LastOut</span>
              <span className="tabular-nums">{safeText(item.lastOut ? new Date(item.lastOut).toLocaleString("tr-TR") : "—")}</span>
            </div>
            <SummaryMetric label="Worked" value={item.workedMinutes} />
            <SummaryMetric label="Scheduled" value={(item as any).scheduledWorkedMinutes} />
            <SummaryMetric label="Unscheduled" value={(item as any).unscheduledWorkedMinutes} />
            <SummaryMetric label="Late" value={item.lateMinutes} />
            <SummaryMetric label="Early" value={item.earlyLeaveMinutes} />
            <SummaryMetric label="OT(Total)" value={item.overtimeMinutes} />

            {(anomalyMeta?.SINGLE_EXIT_LIMIT_EXCEEDED || anomalyMeta?.DAILY_EXIT_LIMIT_EXCEEDED) ? (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-900">
                  Exit Limit Özeti
                </div>
                <div className="mt-2 grid gap-1 text-xs text-amber-900">
                  {anomalyMeta?.SINGLE_EXIT_LIMIT_EXCEEDED ? (
                    <div className="flex justify-between gap-3">
                      <span>Tek çıkış limiti</span>
                      <span className="text-right">
                        {anomalyMeta.SINGLE_EXIT_LIMIT_EXCEEDED.limit} dk limit •{" "}
                        {anomalyMeta.SINGLE_EXIT_LIMIT_EXCEEDED.actual} dk gerçekleşen • +{" "}
                        {anomalyMeta.SINGLE_EXIT_LIMIT_EXCEEDED.exceededMinutes} dk aşım
                      </span>
                    </div>
                  ) : null}
                  {anomalyMeta?.DAILY_EXIT_LIMIT_EXCEEDED ? (
                    <div className="flex justify-between gap-3">
                      <span>Günlük toplam çıkış limiti</span>
                      <span className="text-right">
                        {anomalyMeta.DAILY_EXIT_LIMIT_EXCEEDED.limit} dk limit •{" "}
                        {anomalyMeta.DAILY_EXIT_LIMIT_EXCEEDED.actual} dk gerçekleşen • +{" "}
                        {anomalyMeta.DAILY_EXIT_LIMIT_EXCEEDED.exceededMinutes} dk aşım
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Hızlı Geçiş</div>
          <div className="mt-2 grid gap-3 text-sm text-zinc-600">
            <div>
              Bu alan yalnızca kısa preview gösterir. Kural kaynağı, anomaly açıklamaları ve teknik çözümleme ayrı detail ekranında yer alır.
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={detailHref}
                className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
              >
                Teknik Detaya Git
              </Link>
              <Link
                href={employeeId ? `/employees/${encodeURIComponent(employeeId)}` : "#"}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100"
              >
                Personel 360
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Issue Önizleme</div>
          <span className="text-xs text-zinc-500">Toplam {anomalies.length}</span>
        </div>
        {anomalies.length ? (
          <ul className="mt-2 grid gap-1 text-sm text-zinc-800">
            {anomalies.slice(0, 2).map((code, idx) => {
              const metaText = anomalyMetaText(anomalyMeta?.[code]);
              return (
              <li key={`${item.id ?? item.employeeId ?? "row"}__anomaly_preview__${idx}`} className="rounded-md bg-zinc-50 px-3 py-2">
                <span className="font-mono text-xs">{code}</span>
                <span className="mx-2 text-zinc-300">—</span>
                <span>{prettyAnomaly(code)}</span>
                {metaText ? (
                  <div className="mt-1 text-xs font-medium text-amber-700">{metaText}</div>
                ) : null}
              </li>
            )})}
            {anomalies.length > 2 ? (
              <li className="px-1 text-xs text-zinc-500">Kalan anomaly detayları teknik detail ekranında.</li>
            ) : null}
          </ul>
        ) : (
          <div className="mt-2 text-sm text-zinc-500">Bu satırda issue bulunmuyor.</div>
        )}
      </div>
    </div>
  );
}