/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useMemo, useState } from "react";

// Convert a datetime-local string to ISO string with current timezone offset
function toIsoWithLocalOffset(local: string) {
  // Input format: YYYY-MM-DDTHH:mm
  const offMin = -new Date().getTimezoneOffset(); // minutes east of UTC
  const sign = offMin >= 0 ? "+" : "-";
  const abs = Math.abs(offMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${local}:00${sign}${hh}:${mm}`;
}

// Format a date/time into a human-readable string (Turkish locale)
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

// Types for API data
type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  isActive: boolean;
};

type DailyItem =
  | {
      id: string;
      employeeId: string;
      firstIn: string | null;
      lastOut: string | null;
      workedMinutes: number;
      overtimeMinutes: number;
      lateMinutes: number;
      earlyLeaveMinutes: number;
      status: string;
      anomalies: string[];

      // UI-only shift source visibility
      shiftSource?: "POLICY" | "WEEK_TEMPLATE" | "DAY_TEMPLATE" | "CUSTOM";
      shiftSignature?: string;
      shiftBadge?: string;
    }
  | null;

type RawEvent = {
  id: string;
  employeeId: string;
  occurredAt: string;
  direction: string;
  source: string;
  door: { id: string; code: string; name: string } | null;
  device: { id: string; name: string; ip: string | null } | null;
};

type NormalizedEvent = {
  id: string;
  rawEventId: string;
  occurredAt: string;
  direction: string;
  status: string;
  rejectReason: string | null;
};

type Door = {
  id: string;
  code: string;
  name: string;
  defaultDirection: string | null;
};

export default function Employee360Client({ id }: { id: string }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [date, setDate] = useState(() => {
    // Default to today's date in local timezone, format YYYY-MM-DD
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  });
  const [daily, setDaily] = useState<DailyItem>(null);
  const [rawEvents, setRawEvents] = useState<RawEvent[]>([]);
  const [normEvents, setNormEvents] = useState<NormalizedEvent[]>([]);
  const [doors, setDoors] = useState<Door[]>([]);
  const [loadingEmployee, setLoadingEmployee] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual event form state
  const [manualDateTime, setManualDateTime] = useState("");
  const [manualDirection, setManualDirection] = useState<"IN" | "OUT">(
    "IN",
  );
  const [manualDoorId, setManualDoorId] = useState<string>("");
  const [savingManual, setSavingManual] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [toggling, setToggling] = useState(false);

  // Manual daily adjustment form state. Empty string means no override.
  const [adjustment, setAdjustment] = useState({
    statusOverride: "",
    workedMinutesOverride: "",
    overtimeMinutesOverride: "",
    overtimeEarlyMinutesOverride: "",
    overtimeLateMinutesOverride: "",
    lateMinutesOverride: "",
    earlyLeaveMinutesOverride: "",
    note: "",
  });
  const [otSplitMode, setOtSplitMode] = useState(false);
  const [loadingAdjustment, setLoadingAdjustment] = useState(false);
  const [savingAdjustment, setSavingAdjustment] = useState(false);

  // Compute full name for display
  const fullName = useMemo(() => {
    if (!employee) return "";
    return `${employee.firstName} ${employee.lastName}`.trim();
  }, [employee]);

  // Load employee details
  async function loadEmployee() {
    setLoadingEmployee(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${id}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || "Failed to load employee");
      }
      const data = await res.json();
      setEmployee(data.item ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Employee load failed");
      setEmployee(null);
    } finally {
      setLoadingEmployee(false);
    }
  }

  // Load list of doors for manual event
  async function loadDoors() {
    try {
      const res = await fetch(`/api/org/doors`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const arr: Door[] = Array.isArray(data) ? data : data.items ?? [];
      setDoors(arr);
    } catch {
      // ignore door errors
    }
  }

  // Load daily summary, raw events, and normalized events
  async function loadDailyRawNorm() {
    setLoadingData(true);
    setError(null);
    try {
      // Daily attendance
      const dRes = await fetch(
        `/api/employees/${id}/daily?date=${encodeURIComponent(date)}`,
        { credentials: "include" },
      );
      if (dRes.ok) {
        const dJson = await dRes.json();
        setDaily(dJson.item ?? null);
      } else if (dRes.status === 404) {
        setDaily(null);
      } else {
        const txt = await dRes.text().catch(() => dRes.statusText);
        throw new Error(txt || "Failed to load daily");
      }

      // Raw events
      const rRes = await fetch(
        `/api/events?${new URLSearchParams({
          employeeId: id,
          date,
        }).toString()}`,
        { credentials: "include" },
      );
      if (rRes.ok) {
        const rJson = await rRes.json();
        setRawEvents(rJson.items ?? []);
      } else {
        const txt = await rRes.text().catch(() => rRes.statusText);
        throw new Error(txt || "Failed to load events");
      }

      // Normalized events
      const nRes = await fetch(
        `/api/employees/${id}/normalized-events?${new URLSearchParams({
          date,
        }).toString()}`,
        { credentials: "include" },
      );
      if (nRes.ok) {
        const nJson = await nRes.json();
        setNormEvents(nJson.items ?? []);
      } else if (nRes.status === 404) {
        setNormEvents([]);
      } else {
        const txt = await nRes.text().catch(() => nRes.statusText);
        throw new Error(txt || "Failed to load normalized events");
      }
    } catch (e: any) {
      setError(e?.message ?? "Data load failed");
    } finally {
      setLoadingData(false);
    }
  }

  // Load existing manual adjustment for the selected employee and date.
  async function loadAdjustment() {
    if (!id || !date) return;
    setLoadingAdjustment(true);
    try {
      const res = await fetch(
        `/api/employees/${id}/daily-adjustment?date=${encodeURIComponent(date)}`,
        { credentials: "include" },
      );
      if (res.ok) {
        const data = await res.json();
        const item = data?.item ?? null;
        if (item) {
          setAdjustment({
            statusOverride: item.statusOverride ?? "",
            workedMinutesOverride:
              item.workedMinutesOverride != null
                ? String(item.workedMinutesOverride)
                : "",
            overtimeMinutesOverride:
              item.overtimeMinutesOverride != null
                ? String(item.overtimeMinutesOverride)
                : "",
                overtimeEarlyMinutesOverride:
              item.overtimeEarlyMinutesOverride != null
                ? String(item.overtimeEarlyMinutesOverride)
                : "",
            overtimeLateMinutesOverride:
              item.overtimeLateMinutesOverride != null
                ? String(item.overtimeLateMinutesOverride)
                : "",
            lateMinutesOverride:
              item.lateMinutesOverride != null
                ? String(item.lateMinutesOverride)
                : "",
            earlyLeaveMinutesOverride:
              item.earlyLeaveMinutesOverride != null
                ? String(item.earlyLeaveMinutesOverride)
                : "",
            note: item.note ?? "",
          });
          setOtSplitMode(
            item.overtimeEarlyMinutesOverride != null || item.overtimeLateMinutesOverride != null
          );
        } else {
          setAdjustment({
            statusOverride: "",
            workedMinutesOverride: "",
            overtimeMinutesOverride: "",
            overtimeEarlyMinutesOverride: "",
            overtimeLateMinutesOverride: "",
            lateMinutesOverride: "",
            earlyLeaveMinutesOverride: "",
            note: "",
          });
          setOtSplitMode(false);
        }
      }
    } catch {
      // ignore adjustment load errors
    } finally {
      setLoadingAdjustment(false);
    }
  }

  // Save manual adjustment (upsert).
  async function saveAdjustment() {
    if (!id || !date || savingAdjustment) return;
    const hasOverride =
      adjustment.statusOverride !== "" ||
      adjustment.workedMinutesOverride !== "" ||
      adjustment.overtimeMinutesOverride !== "" ||
      adjustment.overtimeEarlyMinutesOverride !== "" ||
      adjustment.overtimeLateMinutesOverride !== "" ||
      adjustment.lateMinutesOverride !== "" ||
      adjustment.earlyLeaveMinutesOverride !== "";

      const hasOtSplit = otSplitMode;
    const hasOtTotal = adjustment.overtimeMinutesOverride !== "";
    if (hasOtSplit && hasOtTotal) {
      setError("OT override için ya Total ya da Early/Late girin (ikisi birlikte olmaz).");
      return;
    }

    const noteEmpty = (adjustment.note ?? "").trim() === "";
    if (hasOverride && noteEmpty) {
      setError("Not zorunludur (manuel düzeltme için açıklama girin).");
      return;
    }
    setSavingAdjustment(true);
    setError(null);
    try {
      const body: any = {};
      // Status override: empty string means null override
      if (adjustment.statusOverride !== "") {
        body.statusOverride = adjustment.statusOverride || null;
      } else {
        body.statusOverride = null;
      }
      // Helper to parse numeric overrides. Blank string results in null.
      const parseNum = (v: string) => {
       if (v === "" || v == null) return null;
        const n = Number(v);
        return Number.isNaN(n) ? null : n;
      };
      body.workedMinutesOverride = parseNum(adjustment.workedMinutesOverride);
      body.overtimeMinutesOverride = parseNum(adjustment.overtimeMinutesOverride);
      body.overtimeEarlyMinutesOverride = otSplitMode
        ? parseNum(adjustment.overtimeEarlyMinutesOverride)
        : null;
      body.overtimeLateMinutesOverride = otSplitMode
        ? parseNum(adjustment.overtimeLateMinutesOverride)
        : null;
      body.lateMinutesOverride = parseNum(adjustment.lateMinutesOverride);
      body.earlyLeaveMinutesOverride = parseNum(adjustment.earlyLeaveMinutesOverride);
      body.note = adjustment.note ?? null;
      const res = await fetch(
        `/api/employees/${id}/daily-adjustment?date=${encodeURIComponent(date)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || "Failed to save adjustment");
      }
      // Reload daily summary and adjustment after saving
     await loadDailyRawNorm();
      await loadAdjustment();
    } catch (e: any) {
      setError(e?.message ?? "Save adjustment failed");
    } finally {
      setSavingAdjustment(false);
    }
  }

  // Clear manual adjustment for selected date.
  async function clearAdjustment() {
    if (!id || !date) return;
    setSavingAdjustment(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/employees/${id}/daily-adjustment?date=${encodeURIComponent(date)}`,
        { method: "DELETE", credentials: "include" },
     );
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || "Failed to clear adjustment");
      }
      // Reset form and reload data
      setAdjustment({
        statusOverride: "",
        workedMinutesOverride: "",
        overtimeMinutesOverride: "",
        overtimeEarlyMinutesOverride: "",
        overtimeLateMinutesOverride: "",
        lateMinutesOverride: "",
        earlyLeaveMinutesOverride: "",
        note: "",
      });
      setOtSplitMode(false);
      await loadDailyRawNorm();
      await loadAdjustment();
    } catch (e: any) {
      setError(e?.message ?? "Clear adjustment failed");
    } finally {
      setSavingAdjustment(false);
    }
  }

  // Toggle employee active status
  async function toggleActive() {
    if (!employee) return;
    setToggling(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: employee.id,
          isActive: !employee.isActive,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || "Failed to toggle active");
      }
      await loadEmployee();
    } catch (e: any) {
      setError(e?.message ?? "Toggle failed");
    } finally {
      setToggling(false);
    }
  }

  // Recompute daily attendance for selected date (company-wide)
  async function recompute() {
    setRecomputing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/attendance/recompute?date=${encodeURIComponent(date)}`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || "Failed to recompute");
      }
      // Reload daily, raw, and normalized after recompute
      await loadDailyRawNorm();
    } catch (e: any) {
      setError(e?.message ?? "Recompute failed");
    } finally {
      setRecomputing(false);
    }
  }

  // Create a manual raw event
  async function createManualEvent() {
    if (!manualDateTime || savingManual) return;
    setSavingManual(true);
    setError(null);
    try {
      const iso = toIsoWithLocalOffset(manualDateTime);
      const body: any = {
        employeeId: id,
        occurredAt: iso,
        direction: manualDirection,
      };
      if (manualDoorId) body.doorId = manualDoorId;
      const res = await fetch(`/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        let errMsg =
          typeof data?.error === "string"
            ? data.error
            : `create_failed_${res.status}`;
        // Map internal error codes to human messages (Turkish as in UI)
        if (errMsg === "auto_direction_needs_door")
          errMsg = "Auto direction seçildiyse bir kapı seçmelisiniz.";
        else if (errMsg === "no_default_direction")
          errMsg = "Seçili kapı için default direction tanımlı değil.";
        else if (errMsg === "employee_not_found")
          errMsg = "Personel bulunamadı.";
        else if (errMsg === "door_not_found")
          errMsg = "Kapı bulunamadı.";
        else if (errMsg === "device_not_found")
          errMsg = "Cihaz bulunamadı.";
        setError(errMsg);
        return;
      }
      // Reset manual input fields
      setManualDateTime("");
      setManualDoorId("");
      // Recompute and reload data after adding manual event
      await recompute();
    } catch (e: any) {
      setError(e?.message ?? "Manual event failed");
    } finally {
      setSavingManual(false);
    }
  }

  // Load employee and doors once
  useEffect(() => {
    loadEmployee();
    loadDoors();
  }, [id]);

  // Reload daily/raw/normalized when date or id changes
  useEffect(() => {
    if (id) {
      loadDailyRawNorm();
    }
  }, [id, date]);

  // Reload manual adjustment whenever employee or date changes
  useEffect(() => {
    if (id) {
      loadAdjustment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, date]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Display error if exists */}
      {error && (
        <div
          style={{
            padding: 12,
            background: "#ffe6e6",
            border: "1px solid #ff9999",
            borderRadius: 12,
            color: "#990000",
          }}
        >
          {error}
        </div>
      )}

      {/* Employee information card */}
      <section
        style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Employee Info</h2>
        {loadingEmployee && !employee ? (
          <div style={{ marginTop: 8 }}>Loading...</div>
        ) : employee ? (
          <div
            style={{
              marginTop: 8,
              display: "grid",
              gap: 8,
              alignItems: "center",
            }}
          >
            <div>
              <strong>Code:</strong> {employee.employeeCode}
            </div>
            <div>
              <strong>Name:</strong> {fullName || "-"}
            </div>
            <div>
              <strong>Email:</strong> {employee.email ?? "-"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <strong>Active:</strong>&nbsp;
              {employee.isActive ? "Yes" : "No"}
              <button
                onClick={toggleActive}
                disabled={toggling}
                style={{ padding: "4px 8px" }}
              >
                {toggling
                  ? "Saving..."
                  : employee.isActive
                  ? "Deactivate"
                  : "Activate"}
              </button>
            </div>
            {/* Link to weekly shift plan page */}
            <div>
              <a
                href={`/employees/${id}/weekly-plan`}
                style={{ color: "#0066cc", textDecoration: "underline" }}
              >
                Haftalık Plan
              </a>
            </div>
            {/* Link to leave management page */}
            <div>
              <a
                href={`/employees/${id}/leaves`}
                style={{ color: "#0066cc", textDecoration: "underline" }}
              >
                İzinler
              </a>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>No employee found.</div>
        )}
      </section>

      {/* Date selector and actions */}
      <section
        style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>
          Select Date &amp; Actions
        </h2>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            marginTop: 8,
          }}
        >
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <button
            onClick={loadDailyRawNorm}
            disabled={loadingData}
            style={{ padding: "6px 10px" }}
          >
            {loadingData ? "Loading..." : "Refresh"}
          </button>
          <button
            onClick={recompute}
            disabled={recomputing}
            style={{ padding: "6px 10px" }}
          >
            {recomputing ? "Recomputing..." : "Recompute Daily"}
          </button>
        </div>
      </section>

      {/* Daily attendance summary */}
      <section
        style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>
          Daily Attendance Summary
        </h2>
        {loadingData ? (
          <div style={{ marginTop: 8 }}>Loading...</div>
        ) : daily ? (
          <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
            <div>
              <strong>Status:</strong> {daily.status}
            </div>
            <div>
              <strong>Vardiya Kaynağı:</strong>&nbsp;
              {daily.shiftBadge
                ? daily.shiftBadge
                : daily.shiftSignature
                  ? daily.shiftSignature
                  : "—"}
            </div>
            <div>
              <strong>First In:</strong> {fmt(daily.firstIn)}
            </div>
            <div>
              <strong>Last Out:</strong> {fmt(daily.lastOut)}
            </div>
            <div>
              <strong>Worked Minutes:</strong>&nbsp;
              {daily.workedMinutes ?? 0}
            </div>
            <div>
              <strong>Late Minutes:</strong>&nbsp;
              {daily.lateMinutes ?? 0}
            </div>
            <div>
              <strong>Early Leave Minutes:</strong>&nbsp;
              {daily.earlyLeaveMinutes ?? 0}
            </div>
            <div>
              <strong>Overtime Minutes:</strong>&nbsp;
              {daily.overtimeMinutes ?? 0}
            </div>
            <div>
              <strong>Anomalies:</strong>&nbsp;
              {Array.isArray(daily.anomalies) && daily.anomalies.length > 0
                ? daily.anomalies.join(", ")
                : "None"}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            No attendance data for this date.
          </div>
        )}
      </section>

      {/* Manual Adjustment */}
      <section
        style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Manual Adjustment</h2>
        {loadingAdjustment ? (
          <div style={{ marginTop: 8 }}>Loading...</div>
        ) : (
          <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
            {/* Show a badge if any override values are provided */}
            {(adjustment.statusOverride ||
              adjustment.workedMinutesOverride ||
              adjustment.overtimeMinutesOverride ||
              adjustment.lateMinutesOverride ||
              adjustment.earlyLeaveMinutesOverride ||
              adjustment.note) && (
              <div
                style={{
                  background: "#e0f3ff",
                  color: "#004a75",
                  padding: "4px 8px",
                  borderRadius: 6,
                  fontSize: 12,
                  marginBottom: 8,
                  maxWidth: 200,
                }}
              >
                Manual override applied
              </div>
            )}
            <label style={{ display: "grid", gap: 6 }}>
              <span>Status Override</span>
              <select
                value={adjustment.statusOverride}
                onChange={(e) =>
                  setAdjustment((a) => ({
                    ...a,
                    statusOverride: e.target.value,
                  }))
                }
              >
                <option value="">— None —</option>
                <option value="PRESENT">PRESENT</option>
               <option value="ABSENT">ABSENT</option>
                <option value="OFF">OFF</option>
                <option value="LEAVE">LEAVE</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Worked Minutes Override</span>
              <input
                type="number"
                value={adjustment.workedMinutesOverride}
                onChange={(e) =>
                  setAdjustment((a) => ({
                    ...a,
                    workedMinutesOverride: e.target.value,
                  }))
                }
                placeholder="Leave blank for none"
              />
            </label>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                 checked={otSplitMode}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setOtSplitMode(v);
                    if (v) {
                     // Split mode: clear total override (mutually exclusive)
                      setAdjustment((a) => ({ ...a, overtimeMinutesOverride: "" }));
                    } else {
                      // Total mode: clear split overrides
                      setAdjustment((a) => ({
                        ...a,
                        overtimeEarlyMinutesOverride: "",
                       overtimeLateMinutesOverride: "",
                      }));
                    }
                  }}
                />
                <span>Advanced: Override OT Early/Late</span>
              </label>
              {otSplitMode && (
               <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span>OT Early Override</span>
                    <input
                      type="number"
                      value={adjustment.overtimeEarlyMinutesOverride}
                      onChange={(e) =>
                        setAdjustment((a) => ({
                          ...a,
                          overtimeEarlyMinutesOverride: e.target.value,
                        }))
                      }
                      placeholder="Leave blank for none"
                    />
                  </label>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span>OT Late Override</span>
                    <input
                      type="number"
                      value={adjustment.overtimeLateMinutesOverride}
                      onChange={(e) =>
                        setAdjustment((a) => ({
                          ...a,
                          overtimeLateMinutesOverride: e.target.value,
                        }))
                      }
                      placeholder="Leave blank for none"
                    />
                  </label>
                </div>
              )}
            </div>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Overtime Minutes Override</span>
              <input
                type="number"
                value={adjustment.overtimeMinutesOverride}
                onChange={(e) =>
                  setAdjustment((a) => ({
                    ...a,
                    overtimeMinutesOverride: e.target.value,
                  }))
                }
                placeholder="Leave blank for none"
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Late Minutes Override</span>
              <input
                type="number"
                value={adjustment.lateMinutesOverride}
                onChange={(e) =>
                  setAdjustment((a) => ({
                    ...a,
                    lateMinutesOverride: e.target.value,
                  }))
                }
                placeholder="Leave blank for none"
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Early Leave Minutes Override</span>
              <input
                type="number"
                value={adjustment.earlyLeaveMinutesOverride}
                onChange={(e) =>
                  setAdjustment((a) => ({
                    ...a,
                    earlyLeaveMinutesOverride: e.target.value,
                  }))
               }
                placeholder="Leave blank for none"
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Note</span>
              <input
                type="text"
                value={adjustment.note}
                onChange={(e) =>
                  setAdjustment((a) => ({
                    ...a,
                    note: e.target.value,
                  }))
                }
                placeholder="Optional note"
              />
            </label>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button
                onClick={saveAdjustment}
                disabled={savingAdjustment}
                style={{ padding: "6px 10px" }}
              >
                {savingAdjustment ? "Saving..." : "Save"}
              </button>
              <button
                onClick={clearAdjustment}
                disabled={savingAdjustment}
                style={{ padding: "6px 10px" }}
              >
                {savingAdjustment ? "Clearing..." : "Clear"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Raw events list */}
      <section
        style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Raw Events</h2>
        {loadingData ? (
          <div style={{ marginTop: 8 }}>Loading...</div>
        ) : rawEvents.length === 0 ? (
          <div style={{ marginTop: 8 }}>No raw events.</div>
        ) : (
          <div style={{ marginTop: 8, overflowX: "auto" }}>
            <table
              style={{ width: "100%", borderCollapse: "collapse" }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    When
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    Dir
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    Source
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    Door
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    Device
                  </th>
                </tr>
              </thead>
              <tbody>
                {rawEvents.map((ev) => (
                  <tr key={ev.id}>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: "1px solid #f2f2f2",
                      }}
                    >
                      {fmt(ev.occurredAt)}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: "1px solid #f2f2f2",
                      }}
                    >
                      {ev.direction}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: "1px solid #f2f2f2",
                      }}
                    >
                      {ev.source}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: "1px solid #f2f2f2",
                      }}
                    >
                      {ev.door
                        ? `${ev.door.code} - ${ev.door.name}`
                        : "—"}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: "1px solid #f2f2f2",
                      }}
                    >
                      {ev.device ? ev.device.name : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Normalized events list */}
      <section
        style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Normalized Events</h2>
        {loadingData ? (
          <div style={{ marginTop: 8 }}>Loading...</div>
        ) : normEvents.length === 0 ? (
          <div style={{ marginTop: 8 }}>No normalized events.</div>
        ) : (
          <div style={{ marginTop: 8, overflowX: "auto" }}>
            <table
              style={{ width: "100%", borderCollapse: "collapse" }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    When
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    Dir
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody>
                {normEvents.map((ev) => (
                  <tr key={ev.id}>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: "1px solid #f2f2f2",
                      }}
                    >
                      {fmt(ev.occurredAt)}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: "1px solid #f2f2f2",
                      }}
                    >
                      {ev.direction}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: "1px solid #f2f2f2",
                      }}
                    >
                      {ev.status}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: "1px solid #f2f2f2",
                      }}
                    >
                      {ev.rejectReason ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Manual event form */}
      <section
        style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Add Manual Event</h2>
        <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Occurred At</span>
            <input
              type="datetime-local"
              value={manualDateTime}
              onChange={(e) => setManualDateTime(e.target.value)}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Direction</span>
            <select
              value={manualDirection}
              onChange={(e) =>
                setManualDirection(e.target.value as any)
              }
            >
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Door (optional)</span>
            <select
              value={manualDoorId}
              onChange={(e) => setManualDoorId(e.target.value)}
            >
              <option value="">— None —</option>
              {doors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={savingManual || !manualDateTime}
            onClick={createManualEvent}
            style={{ padding: "6px 10px" }}
          >
            {savingManual ? "Saving..." : "Create Event"}
          </button>
        </div>
      </section>
    </div>
  );
}
