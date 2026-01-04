"use client";

import { useEffect, useMemo, useState } from "react";

type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  isActive: boolean;
};

export default function EmployeesClient() {
  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    employeeCode: "",
    firstName: "",
    lastName: "",
    email: "",
    isActive: true,
  });

  const fullName = useMemo(() => `${form.firstName} ${form.lastName}`.trim(), [form.firstName, form.lastName]);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/employees", { credentials: "include" });
      const json = await res.json();
      setItems(json.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createEmployee() {
    setLoading(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          employeeCode: form.employeeCode,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email || null,
          isActive: form.isActive,
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        alert(t);
        return;
      }

      setForm({ employeeCode: "", firstName: "", lastName: "", email: "", isActive: true });
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(e: Employee) {
    setLoading(true);
    try {
      const res = await fetch("/api/employees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: e.id, isActive: !e.isActive }),
      });

      if (!res.ok) {
        const t = await res.text();
        alert(t);
        return;
      }

      await refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Create Employee</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Employee Code</span>
            <input value={form.employeeCode} onChange={(ev) => setForm({ ...form, employeeCode: ev.target.value })} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Email (optional)</span>
            <input value={form.email} onChange={(ev) => setForm({ ...form, email: ev.target.value })} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>First Name</span>
            <input value={form.firstName} onChange={(ev) => setForm({ ...form, firstName: ev.target.value })} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Last Name</span>
            <input value={form.lastName} onChange={(ev) => setForm({ ...form, lastName: ev.target.value })} />
          </label>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(ev) => setForm({ ...form, isActive: ev.target.checked })}
            />
            Active
          </label>

          <button disabled={loading} onClick={createEmployee}>
            Create
          </button>

          <button disabled={loading} onClick={refresh}>
            Refresh
          </button>

          <span style={{ marginLeft: "auto", color: "#666" }}>{fullName ? `Preview: ${fullName}` : ""}</span>
        </div>
      </div>

      <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Employee List</h2>

        <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
              <th style={{ padding: 8 }}>Code</th>
              <th style={{ padding: 8 }}>Name</th>
              <th style={{ padding: 8 }}>Email</th>
              <th style={{ padding: 8 }}>Active</th>
              <th style={{ padding: 8 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td style={{ padding: 8 }}>{e.employeeCode}</td>
                <td style={{ padding: 8 }}>{e.firstName} {e.lastName}</td>
                <td style={{ padding: 8 }}>{e.email ?? "-"}</td>
                <td style={{ padding: 8 }}>{e.isActive ? "Yes" : "No"}</td>
                <td style={{ padding: 8 }}>
                  <button disabled={loading} onClick={() => toggleActive(e)}>
                    {e.isActive ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}

            {items.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 12, color: "#666" }}>
                  No employees yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
