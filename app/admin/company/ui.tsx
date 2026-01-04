"use client";

import { useEffect, useMemo, useState } from "react";

type Bundle = {
  company: { id: string; name: string };
  policy: {
    id: string;
    companyId: string;

    timezone: string;
    shiftStartMinute: number;
    shiftEndMinute: number;
    breakMinutes: number;
    lateGraceMinutes: number;
    earlyLeaveGraceMinutes: number;

    breakAutoDeductEnabled: boolean;
    offDayEntryBehavior: "IGNORE" | "FLAG" | "COUNT_AS_OT";
    overtimeEnabled: boolean;
  };
};

function minutesToHHMM(m: number) {
  const h = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${h}:${mm}`;
}

function hhmmToMinutes(s: string) {
  const [h, m] = s.split(":").map((x) => Number(x));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export default function CompanySettingsClient() {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Europe/Istanbul");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [breakMin, setBreakMin] = useState(60);
  const [lateGrace, setLateGrace] = useState(5);
  const [earlyGrace, setEarlyGrace] = useState(5);

  const [breakAutoDeductEnabled, setBreakAutoDeductEnabled] = useState(true);
  const [offDayEntryBehavior, setOffDayEntryBehavior] = useState<"IGNORE" | "FLAG" | "COUNT_AS_OT">("IGNORE");
  const [overtimeEnabled, setOvertimeEnabled] = useState(false);

  const canSave = useMemo(() => !!name && !!timezone, [name, timezone]);

  async function load() {
    setError(null);
    const res = await fetch("/api/company", { method: "GET" });
    if (!res.ok) {
      setError(`Load failed (${res.status})`);
      return;
    }
    const data = (await res.json()) as Bundle;
    setBundle(data);

    setName(data.company.name);
    setTimezone(data.policy.timezone);
    setStart(minutesToHHMM(data.policy.shiftStartMinute));
    setEnd(minutesToHHMM(data.policy.shiftEndMinute));
    setBreakMin(data.policy.breakMinutes);
    setLateGrace(data.policy.lateGraceMinutes);
    setEarlyGrace(data.policy.earlyLeaveGraceMinutes);

    setBreakAutoDeductEnabled(Boolean(data.policy.breakAutoDeductEnabled));
    setOffDayEntryBehavior(data.policy.offDayEntryBehavior);
    setOvertimeEnabled(Boolean(data.policy.overtimeEnabled));
  }

  useEffect(() => {
    load();
  }, []);

  async function saveCompany() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        setError(`Save company failed (${res.status})`);
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function savePolicy() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/company/policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone,
          shiftStartMinute: hhmmToMinutes(start),
          shiftEndMinute: hhmmToMinutes(end),
          breakMinutes: Number(breakMin),
          lateGraceMinutes: Number(lateGrace),
          earlyLeaveGraceMinutes: Number(earlyGrace),

          breakAutoDeductEnabled,
          offDayEntryBehavior,
          overtimeEnabled,
        }),
      });
      if (!res.ok) {
        setError(`Save policy failed (${res.status})`);
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div>
        <div style={{ padding: 12, background: "#fee", border: "1px solid #f99" }}>{error}</div>
        <button style={{ marginTop: 12 }} onClick={load}>Tekrar dene</button>
      </div>
    );
  }

  if (!bundle) return <div>Loading...</div>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Company</h2>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <button disabled={!canSave || saving} onClick={saveCompany}>
            {saving ? "Saving..." : "Save Company (ADMIN)"}
          </button>
        </div>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Company Policy</h2>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Timezone</span>
            <input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Shift Start</span>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Shift End</span>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Break Minutes</span>
            <input type="number" value={breakMin} onChange={(e) => setBreakMin(Number(e.target.value))} />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Late Grace Minutes</span>
              <input type="number" value={lateGrace} onChange={(e) => setLateGrace(Number(e.target.value))} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Early Leave Grace Minutes</span>
              <input type="number" value={earlyGrace} onChange={(e) => setEarlyGrace(Number(e.target.value))} />
            </label>
          </div>

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={breakAutoDeductEnabled}
              onChange={(e) => setBreakAutoDeductEnabled(e.target.checked)}
            />
            <span>Break Auto Deduct Enabled</span>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Off Day Entry Behavior</span>
            <select value={offDayEntryBehavior} onChange={(e) => setOffDayEntryBehavior(e.target.value as any)}>
              <option value="IGNORE">IGNORE</option>
              <option value="FLAG">FLAG</option>
              <option value="COUNT_AS_OT">COUNT_AS_OT</option>
            </select>
          </label>

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={overtimeEnabled}
              onChange={(e) => setOvertimeEnabled(e.target.checked)}
            />
            <span>Overtime Enabled</span>
          </label>

          <button disabled={!canSave || saving} onClick={savePolicy}>
            {saving ? "Saving..." : "Save Policy (ADMIN/HR)"}
          </button>
        </div>
      </section>
    </div>
  );
}
