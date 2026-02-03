"use client";

import { useEffect, useState } from "react";

type LeaveItem = {
  id: string;
  dateFrom: string;
  dateTo: string;
  type: string;
  note: string | null;
};

export default function LeavesClient({ id }: { id: string }) {
  const [items, setItems] = useState<LeaveItem[]>([]);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [type, setType] = useState<string>("ANNUAL");
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(
        `/api/employees/${id}/leaves?${params.toString()}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(text || "Failed to load leaves");
      }
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setError(e?.message ?? "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function create() {
    if (!dateFrom || !dateTo || !type) return;
    setError(null);
    try {
      const res = await fetch(`/api/employees/${id}/leaves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          dateFrom,
          dateTo,
          type,
          note: note || undefined,
        }),
      });

      if (res.status === 400) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? "İzin başlangıç tarihi bitiş tarihinden büyük olamaz.");
        return;
      }

      if (res.status === 409) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? "Bu tarihlerde zaten izin kaydı var.");
        return;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(text || "Create failed");
      }
      // Reset form and reload list
      setDateFrom("");
      setDateTo("");
      setType("ANNUAL");
      setNote("");
     await load();
    } catch (e: any) {
      setError(e?.message ?? "Create failed");
    }
  }

  async function remove(leaveId: string) {
    try {
      const res = await fetch(`/api/employees/${id}/leaves/${leaveId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(text || "Delete failed");
      }
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Delete failed");
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Filter and list section */}
      <section
        style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Leave Records</h2>
        <div
          style={{
            marginTop: 8,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span>From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span>To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Filter"}
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          {items.length === 0 ? (
            <div>No leave records.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 6 }}>From</th>
                  <th style={{ textAlign: "left", padding: 6 }}>To</th>
                  <th style={{ textAlign: "left", padding: 6 }}>Type</th>
                  <th style={{ textAlign: "left", padding: 6 }}>Note</th>
                  <th style={{ textAlign: "left", padding: 6 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td style={{ padding: 6 }}>{it.dateFrom}</td>
                    <td style={{ padding: 6 }}>{it.dateTo}</td>
                    <td style={{ padding: 6 }}>{it.type}</td>
                    <td style={{ padding: 6 }}>{it.note ?? ""}</td>
                    <td style={{ padding: 6 }}>
                      <button onClick={() => remove(it.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
      {/* Create section */}
      <section
        style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Add Leave</h3>
        <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
         <label style={{ display: "grid", gap: 6 }}>
            <span>Date From</span>
            <input
              type="date"
              value={dateFrom}
             onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Date To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
             <option value="ANNUAL">ANNUAL</option>
              <option value="SICK">SICK</option>
              <option value="EXCUSED">EXCUSED</option>
              <option value="UNPAID">UNPAID</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Note</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button onClick={create}>Add Leave</button>
          {error && (
            <div style={{ color: "#b00", marginTop: 8 }}>{error}</div>
          )}
        </div>
      </section>
    </div>
  );
}