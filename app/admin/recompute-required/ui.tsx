"use client";

import { useEffect, useMemo, useState } from "react";

type Item = {
  id: string;
  companyId: string;
  reason: string;
  rangeStartDayKey: string | null;
  rangeEndDayKey: string | null;
  status: "PENDING" | "RUNNING" | "DONE";
  createdByUserId: string | null;
  createdAt: string;
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function isDayKey(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function ReasonBadge({ reason }: { reason: string }) {
  const tone =
    reason === "POLICY_UPDATE"
      ? "bg-amber-50 text-amber-900 ring-amber-200/60"
      : reason === "POLICY_ASSIGNMENT_UPDATED"
        ? "bg-sky-50 text-sky-700 ring-sky-200/60"
        : reason === "RULESET_UPDATED"
          ? "bg-violet-50 text-violet-800 ring-violet-200/60"
          : reason === "SHIFT_ASSIGNMENT_UPDATED"
            ? "bg-emerald-50 text-emerald-700 ring-emerald-200/60"
            : "bg-zinc-100 text-zinc-700 ring-zinc-200/60";

  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset shadow-sm", tone)}>
      {reason}
    </span>
  );
}

export default function RecomputeRequiredClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // per-row overrides for range when null
  const [rangeOverrides, setRangeOverrides] = useState<Record<string, { start: string; end: string }>>({});
  const [runningId, setRunningId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/recompute-required", { cache: "no-store" });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setErr(j?.error ?? "LOAD_FAILED");
        setItems([]);
        return;
      }
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "LOAD_FAILED");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const pendingCount = items.length;

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [items]);

  async function runOne(it: Item) {
    if (runningId) return;
    setErr(null);
    setRunningId(it.id);
    try {
      const ov = rangeOverrides[it.id];
      const start = it.rangeStartDayKey ?? ov?.start ?? "";
      const end = it.rangeEndDayKey ?? ov?.end ?? "";

      // If range is unknown, admin must provide it (no guessing).
      if (!isDayKey(start) || !isDayKey(end)) {
        setErr("RANGE_REQUIRED (YYYY-MM-DD)");
        return;
      }
      if (start > end) {
        setErr("RANGE_INVALID (start > end)");
        return;
      }

      const res = await fetch(`/api/admin/recompute-required/${it.id}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rangeStartDayKey: start, rangeEndDayKey: end }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setErr(j?.error ?? "RUN_FAILED");
        return;
      }

      // refresh list (run should turn it DONE -> removed from PENDING list)
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "RUN_FAILED");
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-lg font-bold text-zinc-900 tracking-tight">Bekleyen Recompute İstekleri</div>
          <div className="mt-1 text-sm text-zinc-500">
            Şu an <span className="font-semibold text-zinc-800">{pendingCount}</span> adet PENDING kayıt var.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
            disabled={loading}
          >
            {loading ? "Yükleniyor..." : "Yenile"}
          </button>
        </div>
      </div>

      {err ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <div className="font-bold">Hata</div>
          <div className="mt-1">{err}</div>
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="bg-zinc-50">
              <tr className="border-b border-zinc-200">
                <th className="px-3 py-2 font-bold text-zinc-700">Reason</th>
                <th className="px-3 py-2 font-bold text-zinc-700">Range</th>
                <th className="px-3 py-2 font-bold text-zinc-700">Created</th>
                <th className="px-3 py-2 font-bold text-zinc-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-zinc-500" colSpan={4}>
                    PENDING kayıt yok. (Değişiklik yaptıktan sonra burada görünür.)
                  </td>
                </tr>
              ) : null}

              {sorted.map((it) => {
                const ov = rangeOverrides[it.id] ?? { start: "", end: "" };
                const needsRange = !it.rangeStartDayKey || !it.rangeEndDayKey;

                return (
                  <tr key={it.id} className="border-b border-zinc-100 last:border-b-0">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <ReasonBadge reason={it.reason} />
                        <span className="text-xs text-zinc-500">{it.id.slice(0, 8)}…</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {!needsRange ? (
                        <div className="font-semibold text-zinc-900">
                          {it.rangeStartDayKey} → {it.rangeEndDayKey}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="text-xs text-zinc-500">
                            Range bilinmiyor (tahmin yok). Lütfen tarih aralığı gir.
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              value={ov.start}
                              onChange={(e) =>
                                setRangeOverrides((p) => ({ ...p, [it.id]: { ...ov, start: e.target.value } }))
                              }
                              placeholder="YYYY-MM-DD"
                              className="w-[140px] rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                            />
                            <span className="text-zinc-400">→</span>
                            <input
                              value={ov.end}
                              onChange={(e) =>
                                setRangeOverrides((p) => ({ ...p, [it.id]: { ...ov, end: e.target.value } }))
                              }
                              placeholder="YYYY-MM-DD"
                              className="w-[140px] rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-zinc-600">{new Date(it.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => runOne(it)}
                        disabled={runningId !== null}
                        className={cx(
                          "rounded-xl px-3 py-2 text-sm font-bold shadow-sm border",
                          runningId === it.id
                            ? "border-zinc-200 bg-zinc-100 text-zinc-600"
                            : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                        )}
                      >
                        {runningId === it.id ? "Çalışıyor..." : "Run"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 text-xs text-zinc-500">
        Not: Bu ekran sadece <span className="font-semibold">PENDING</span> kayıtları gösterir. Run sonrası kayıt DONE olur ve listeden düşer.
      </div>
    </div>
  );
}