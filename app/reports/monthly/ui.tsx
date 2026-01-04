"use client";

import { useEffect, useState } from "react";

type MonthlyItem = any;

function getCode(item: MonthlyItem) {
  return item.employeeCode ?? item.employee?.employeeCode ?? "";
}

function getName(item: MonthlyItem) {
  if (item.fullName) return item.fullName;
  if (item.employee?.firstName || item.employee?.lastName) {
    return `${item.employee?.firstName ?? ""} ${item.employee?.lastName ?? ""}`.trim();
  }
  return item.name ?? "";
}

export default function MonthlyReportClient() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [items, setItems] = useState<MonthlyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/monthly?month=${encodeURIComponent(month)}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`GET monthly failed: ${res.status}`);
      const json = await res.json();
      setItems(json.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Load failed");
    } finally {
      setLoading(false);
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
          <span style={{ minWidth: 50 }}>Month</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{ padding: "6px 8px" }}
          />
        </label>

        <button
          onClick={load}
          disabled={loading}
          style={{ padding: "6px 10px", cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
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
              <th style={{ padding: 10 }}>Worked</th>
              <th style={{ padding: 10 }}>Late</th>
              <th style={{ padding: 10 }}>Early</th>
              <th style={{ padding: 10 }}>OT</th>
              <th style={{ padding: 10 }}>PresentDays</th>
              <th style={{ padding: 10 }}>AbsentDays</th>
              <th style={{ padding: 10 }}>MissingPunch</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any) => (
              <tr key={it.employeeId ?? `${getCode(it)}-${getName(it)}`} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: 10 }}>{getCode(it)}</td>
                <td style={{ padding: 10 }}>{getName(it)}</td>
                <td style={{ padding: 10 }}>{it.workedMinutes ?? 0}</td>
                <td style={{ padding: 10 }}>{it.lateMinutes ?? 0}</td>
                <td style={{ padding: 10 }}>{it.earlyLeaveMinutes ?? 0}</td>
                <td style={{ padding: 10 }}>{it.overtimeMinutes ?? it.otMinutes ?? 0}</td>
                <td style={{ padding: 10 }}>{it.presentDays ?? 0}</td>
                <td style={{ padding: 10 }}>{it.absentDays ?? 0}</td>
                <td style={{ padding: 10 }}>{it.missingPunchDays ?? it.missingPunch ?? 0}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: 16, color: "#666" }}>
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
