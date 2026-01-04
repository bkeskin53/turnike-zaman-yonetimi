"use client";

import { useEffect, useMemo, useState } from "react";

type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
};

type RawEventRow = {
  id: string;
  employeeId: string;
  companyId: string;
  occurredAt: string;
  direction: "IN" | "OUT";
  source: "MANUAL" | "DEVICE";
  createdAt: string;
  employee: { id: string; employeeCode: string; firstName: string; lastName: string };
};

function toIsoWithLocalOffset(local: string) {
  // local: "YYYY-MM-DDTHH:mm"
  const offMin = -new Date().getTimezoneOffset(); // + for east
  const sign = offMin >= 0 ? "+" : "-";
  const abs = Math.abs(offMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${local}:00${sign}${hh}:${mm}`;
}

export default function EventsClient() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [items, setItems] = useState<RawEventRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [occurredAtLocal, setOccurredAtLocal] = useState("");
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");

  const [filterDate, setFilterDate] = useState("");
  const [filterEmployeeId, setFilterEmployeeId] = useState("");

  const canSave = useMemo(() => employeeId && occurredAtLocal, [employeeId, occurredAtLocal]);

  async function loadEmployees() {
    const res = await fetch("/api/employees", { method: "GET" });
    if (!res.ok) throw new Error(`employees_load_failed_${res.status}`);
    const data = await res.json();
    setEmployees(data.items ?? []);
  }

  async function loadEvents() {
    const qs = new URLSearchParams();
    if (filterDate) qs.set("date", filterDate);
    if (filterEmployeeId) qs.set("employeeId", filterEmployeeId);

    const url = `/api/events${qs.toString() ? `?${qs.toString()}` : ""}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`events_load_failed_${res.status}`);
    const data = await res.json();
    setItems(data.items ?? []);
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      await loadEmployees();
      await loadEvents();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function createEvent() {
    if (!canSave) return;
    setSaving(true);
    setError(null);

    try {
      const iso = toIsoWithLocalOffset(occurredAtLocal);

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, occurredAt: iso, direction }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ? String(data.error) : `create_failed_${res.status}`);
        return;
      }

      setOccurredAtLocal("");
      await loadEvents();
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {error && (
        <div style={{ padding: 12, background: "#fee", border: "1px solid #f99", borderRadius: 12 }}>
          {error}
        </div>
      )}

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Add Manual Event</h2>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Employee</span>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Select...</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.employeeCode} - {e.firstName} {e.lastName}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Occurred At</span>
            <input
              type="datetime-local"
              value={occurredAtLocal}
              onChange={(e) => setOccurredAtLocal(e.target.value)}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Direction</span>
            <select value={direction} onChange={(e) => setDirection(e.target.value as any)}>
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
            </select>
          </label>

          <button disabled={!canSave || saving} onClick={createEvent}>
            {saving ? "Saving..." : "Create Event"}
          </button>
        </div>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Event List</h2>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Filter Date</span>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Filter Employee</span>
            <select value={filterEmployeeId} onChange={(e) => setFilterEmployeeId(e.target.value)}>
              <option value="">All</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.employeeCode} - {e.firstName} {e.lastName}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "flex", alignItems: "end", gap: 10 }}>
            <button onClick={loadEvents}>Apply</button>
            <button
              onClick={() => {
                setFilterDate("");
                setFilterEmployeeId("");
                setTimeout(loadEvents, 0);
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div style={{ marginTop: 12, color: "#666" }}>No events.</div>
        ) : (
          <div style={{ marginTop: 12, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>When</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>Employee</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>Dir</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>Source</th>
                </tr>
              </thead>
              <tbody>
                {items.map((ev) => (
                  <tr key={ev.id}>
                    <td style={{ borderBottom: "1px solid #f2f2f2", padding: 8 }}>
                      {new Date(ev.occurredAt).toLocaleString()}
                    </td>
                    <td style={{ borderBottom: "1px solid #f2f2f2", padding: 8 }}>
                      {ev.employee.employeeCode} - {ev.employee.firstName} {ev.employee.lastName}
                    </td>
                    <td style={{ borderBottom: "1px solid #f2f2f2", padding: 8 }}>{ev.direction}</td>
                    <td style={{ borderBottom: "1px solid #f2f2f2", padding: 8 }}>{ev.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
