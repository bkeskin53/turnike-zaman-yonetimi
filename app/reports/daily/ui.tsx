"use client";

import { useEffect, useMemo, useState } from "react";

type DailyItem = any;

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

function getCode(item: DailyItem) {
  return item.employee?.employeeCode ?? item.employeeCode ?? "";
}

function getName(item: DailyItem) {
  if (item.employee?.firstName || item.employee?.lastName) {
    return `${item.employee?.firstName ?? ""} ${item.employee?.lastName ?? ""}`.trim();
  }
  return item.fullName ?? item.name ?? "";
}

export default function DailyReportClient() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<DailyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecompute, setLoadingRecompute] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => {
    const s = { PRESENT: 0, ABSENT: 0, OFF: 0, MISSING_PUNCH: 0 };
    for (const it of items) {
      if (it.status === "PRESENT") s.PRESENT++;
      else if (it.status === "ABSENT") s.ABSENT++;
      else if (it.status === "OFF") s.OFF++;
      const an = it.anomalies ?? [];
      if (Array.isArray(an) && an.includes("MISSING_PUNCH")) s.MISSING_PUNCH++;
    }
    return s;
  }, [items]);

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
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ minWidth: 40 }}>Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ padding: "6px 8px" }}
          />
        </label>

        <button
          onClick={recompute}
          disabled={loadingRecompute}
          style={{ padding: "6px 10px", cursor: loadingRecompute ? "not-allowed" : "pointer" }}
        >
          {loadingRecompute ? "Recomputing..." : "Recompute"}
        </button>

        <button
          onClick={load}
          disabled={loading}
          style={{ padding: "6px 10px", cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>

        <div style={{ marginLeft: "auto", color: "#555" }}>
          Present: {summary.PRESENT} · Absent: {summary.ABSENT} · Off: {summary.OFF} · MissingPunch:{" "}
          {summary.MISSING_PUNCH}
        </div>
      </div>

      {error && (
        <div style={{ padding: 10, border: "1px solid #f99", background: "#fff5f5", color: "#900" }}>
          {error}
        </div>
      )}

      <div style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafafa", textAlign: "left" }}>
              <th style={{ padding: 10 }}>Code</th>
              <th style={{ padding: 10 }}>Name</th>
              <th style={{ padding: 10 }}>Status</th>
              <th style={{ padding: 10 }}>FirstIn</th>
              <th style={{ padding: 10 }}>LastOut</th>
              <th style={{ padding: 10 }}>Worked</th>
              <th style={{ padding: 10 }}>Late</th>
              <th style={{ padding: 10 }}>Early</th>
              <th style={{ padding: 10 }}>OT</th>
              <th style={{ padding: 10 }}>Anomalies</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any) => (
              <tr key={it.id ?? `${it.employeeId}-${it.workDate}`} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: 10 }}>{getCode(it)}</td>
                <td style={{ padding: 10 }}>{getName(it)}</td>
                <td style={{ padding: 10 }}>{it.status}</td>
                <td style={{ padding: 10 }}>{fmt(it.firstIn)}</td>
                <td style={{ padding: 10 }}>{fmt(it.lastOut)}</td>
                <td style={{ padding: 10 }}>{it.workedMinutes ?? 0}</td>
                <td style={{ padding: 10 }}>{it.lateMinutes ?? 0}</td>
                <td style={{ padding: 10 }}>{it.earlyLeaveMinutes ?? it.earlyLeaveMinutes ?? 0}</td>
                <td style={{ padding: 10 }}>{it.overtimeMinutes ?? 0}</td>
                <td style={{ padding: 10 }}>
                  {Array.isArray(it.anomalies) ? it.anomalies.join(", ") : ""}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={10} style={{ padding: 16, color: "#666" }}>
                  No data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
