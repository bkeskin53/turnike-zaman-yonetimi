"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
};

type Door = {
  id: string;
  code: string;
  name: string;
};
type Device = {
  id: string;
  name: string;
  ip: string | null;
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

  door: null | { id: string; code: string; name: string };
  device: null | { id: string; name: string; ip: string | null };
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function nowLocalInputValue() {
  // datetime-local expects local time without timezone: YYYY-MM-DDTHH:mm
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`;
}

function formatLocalDateTime(iso: string) {
  // UI-only formatting (does not affect canonical time handling in the engine)
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  const [doors, setDoors] = useState<Door[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [occurredAtLocal, setOccurredAtLocal] = useState("");
  // direction artık “AUTO” opsiyonunu da destekliyor.
  const [direction, setDirection] = useState<"IN" | "OUT" | "AUTO">("IN");

  // Manuel girişte kapı ve cihaz seçimi (opsiyonel)
  const [doorId, setDoorId] = useState<string>("");
  const [deviceId, setDeviceId] = useState<string>("");

  // Liste filtreleri
  const [filterDate, setFilterDate] = useState("");
  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [filterDoorId, setFilterDoorId] = useState("");
  const [filterDeviceId, setFilterDeviceId] = useState("");
  const [filterSource, setFilterSource] = useState<"" | "MANUAL" | "DEVICE">("");

  const [quickFilter, setQuickFilter] = useState("");
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function toggleOpen(id: string) {
    setOpenEventId((prev) => (prev === id ? null : id));
  }

  async function copyToClipboard(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(message);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      // Fallback
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(message);
        window.setTimeout(() => setCopied(null), 1800);
      } catch {
        setCopied("Kopyalama başarısız");
        window.setTimeout(() => setCopied(null), 1800);
      }
    }
  }

  const canSave = useMemo(() => {
    if (!employeeId || !occurredAtLocal) return false;
    if (direction === "AUTO" && !doorId) return false;
    return true;
  }, [employeeId, occurredAtLocal, direction, doorId]);

  const displayedItems = useMemo(() => {
  const q = quickFilter.trim().toLowerCase();

  let base = items;
  if (filterSource) {
    base = base.filter((ev) => ev.source === filterSource);
  }

  if (!q) return base;

  return base.filter((ev) => {
    const hay = [
      ev.employee?.employeeCode,
      ev.employee?.firstName,
      ev.employee?.lastName,
      ev.door?.code,
      ev.door?.name,
      ev.device?.name,
      ev.direction,
      ev.source,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return hay.includes(q);
  });
}, [items, quickFilter, filterSource]);

  async function loadEmployees() {
    const res = await fetch("/api/employees", { credentials: "include" });
    if (!res.ok) throw new Error(`employees_load_failed_${res.status}`);
    const data = await res.json();
    setEmployees(data.items ?? []);
  }

  async function loadDoors() {
    const res = await fetch("/api/org/doors", { credentials: "include" });
    if (!res.ok) throw new Error(`doors_load_failed_${res.status}`);
    const data = await res.json();
    setDoors(Array.isArray(data) ? data : data.items ?? []);
  }

  async function loadDevices() {
    const res = await fetch("/api/org/devices", { credentials: "include" });
    if (!res.ok) throw new Error(`devices_load_failed_${res.status}`);
    const data = await res.json();
    setDevices(Array.isArray(data) ? data : data.items ?? []);
  }

  // NOT: toggleOpen ve copyToClipboard fonksiyonlarını dosyada yalnızca 1 kez tanımlıyoruz.
  // Aksi halde TS2393 (yinelenen işlev) hatası verir.

  async function loadEvents(params?: {
    date?: string;
    employeeId?: string;
    doorId?: string;
    deviceId?: string;
    }) {
    const qs = new URLSearchParams();
    const date = params?.date ?? filterDate;
    const employeeId = params?.employeeId ?? filterEmployeeId;
    const doorId = params?.doorId ?? filterDoorId;
    const deviceId = params?.deviceId ?? filterDeviceId;

    if (date) qs.set("date", date);
    if (employeeId) qs.set("employeeId", employeeId);
    if (doorId) qs.set("doorId", doorId);
    if (deviceId) qs.set("deviceId", deviceId);

    const url = `/api/events${qs.toString() ? `?${qs.toString()}` : ""}`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`events_load_failed_${res.status}`);
    const data = await res.json();
    setItems(data.items ?? []);
  }

  function onFilterKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      loadEvents();
      return;
    }
    if (e.key === "Escape") {
      // ESC: only clears quick search (doesn't touch API filters)
      if (quickFilter.trim()) {
        e.preventDefault();
        setQuickFilter("");
      }
    }
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      await loadEmployees();
      await loadDoors();
      await loadDevices();
      // UX: default to "now" for quicker manual entry
      setOccurredAtLocal((prev) => prev || nowLocalInputValue());
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
        credentials: "include",
        body: JSON.stringify({
          employeeId,
          occurredAt: iso,
          direction,
          // Opsiyonel doorId/deviceId alanlarını yalnızca doluysa gönder
          ...(doorId ? { doorId } : {}),
          ...(deviceId ? { deviceId } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // API’den dönen hata kodlarını kullanarak kullanıcı dostu mesajlar üret
        let errMsg = data?.error ? String(data.error) : `create_failed_${res.status}`;
        if (errMsg === "auto_direction_needs_door") {
          errMsg = "Auto direction seçildiyse bir kapı seçmelisiniz.";
        } else if (errMsg === "no_default_direction") {
          errMsg = "Seçili kapı için default direction tanımlı değil.";
        } else if (errMsg === "employee_not_found") {
          errMsg = "Personel bulunamadı.";
        } else if (errMsg === "door_not_found") {
          errMsg = "Kapı bulunamadı.";
        } else if (errMsg === "device_not_found") {
          errMsg = "Cihaz bulunamadı.";
        }
        setError(errMsg);
        return;
      }

      // Başarılı ise formu temizle ve listeyi yenile
      setOccurredAtLocal(nowLocalInputValue());
      setDoorId("");
      setDeviceId("");
      await loadEvents();
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  if (loading) {
    return <div className="py-10 text-center text-sm text-zinc-600">Loading events…</div>;
  }

  return (
    <div className="grid gap-4">
      {/* Local helper: hide scrollbar but keep scroll */}
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          width: 0px;
          height: 0px;
        }
        .scrollbar-hide {
          -ms-overflow-style: none; /* IE/Edge legacy */
          scrollbar-width: none; /* Firefox */
        }
      `}</style>
      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <div>{error}</div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="rounded-md px-2 py-1 text-xs font-medium text-rose-900 hover:bg-rose-100"
          >
            Kapat
          </button>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
        <div className="font-medium text-zinc-900">Events = ham kayıt</div>
        <div className="mt-1">
          Bu ekran turnike/manuel <span className="font-medium">RawEvent</span> kayıtlarını gösterir.
          Puantaj hesapları <span className="font-medium">Time Evaluation</span> katmanında üretilir.
        </div>
      </div>

      {/* Manuel Olay Giriş Formu */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Add manual event</h2>
            <p className="text-sm text-zinc-600">Ham olay ekler; hesap motorunu değiştirmez.</p>
          </div>
          <button
            type="button"
            onClick={() => setOccurredAtLocal(nowLocalInputValue())}
            className="mt-2 inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 sm:mt-0"
          >
            Now
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-700">Employee</span>
            <select
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-300"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">Select…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.employeeCode} - {e.firstName} {e.lastName}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-700">Occurred at</span>
            <input
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-300"
              type="datetime-local"
              value={occurredAtLocal}
              onChange={(e) => setOccurredAtLocal(e.target.value)}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-700">Direction</span>
            <select
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-300"
              value={direction}
              onChange={(e) => setDirection(e.target.value as any)}
            >
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
              <option value="AUTO">Auto (door default)</option>
            </select>
            {direction === "AUTO" && !doorId && (
              <span className="text-xs text-amber-700">Auto seçildi: kapı seçimi zorunlu.</span>
            )}
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-700">
              Door <span className="text-zinc-500">(optional)</span>
            </span>
            <select
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-300"
              value={doorId}
              onChange={(e) => setDoorId(e.target.value)}
            >
              <option value="">— None —</option>
              {doors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 md:col-span-2">
            <span className="text-sm font-medium text-zinc-700">
              Device <span className="text-zinc-500">(optional)</span>
            </span>
            <select
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-300"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
            >
              <option value="">— None —</option>
              {devices.map((dv) => (
                <option key={dv.id} value={dv.id}>
                  {dv.name}
                  {dv.ip ? ` (${dv.ip})` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-zinc-500">
            Kaydetmeden önce personel ve tarih/saat seçtiğinizden emin olun.
          </div>
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={createEvent}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {saving ? "Saving…" : "Create event"}
          </button>
        </div>
      </section>

      {/* Olay Listeleme ve Filtreleme */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Event list</h2>
            <p className="text-sm text-zinc-600">
              {quickFilter.trim() ? `${displayedItems.length} / ${items.length} kayıt görüntüleniyor.` : `${items.length} kayıt görüntüleniyor.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadEvents()}
            className="mt-2 inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 sm:mt-0"
          >
            Refresh
          </button>
        </div>
        
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm font-medium text-zinc-900">Filters</div>
          <div className="text-xs text-zinc-500">
            {[
              filterDate ? 1 : 0,
              filterEmployeeId ? 1 : 0,
              filterDoorId ? 1 : 0,
              filterDeviceId ? 1 : 0,
              filterSource ? 1 : 0,
              quickFilter.trim() ? 1 : 0,
            ].reduce((a, b) => a + b, 0)}
            {" "}active
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-12">
          <label className="grid gap-1.5 md:col-span-3 min-w-0">
            <span className="text-sm font-medium text-zinc-700">Date</span>
            <input
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-300"
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              onKeyDown={onFilterKeyDown}
            />
          </label>

          <label className="grid gap-1.5 md:col-span-5 min-w-0">
            <span className="text-sm font-medium text-zinc-700">Employee</span>
            <select
              className="h-10 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-300"
              value={filterEmployeeId}
              onChange={(e) => setFilterEmployeeId(e.target.value)}
              onKeyDown={onFilterKeyDown as any}
            >
              <option value="">All</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.employeeCode} - {e.firstName} {e.lastName}
                </option>
              ))}
            </select>
          </label>
          
          <label className="grid gap-1.5 md:col-span-4 min-w-0">
            <span className="text-sm font-medium text-zinc-700">Source</span>
            <select
              className="h-10 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-300"
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value as any)}
              onKeyDown={onFilterKeyDown as any}
            >
              <option value="">All</option>
              <option value="DEVICE">Device</option>
              <option value="MANUAL">Manual</option>
            </select>
          </label>

          <label className="grid gap-1.5 md:col-span-4 min-w-0">
            <span className="text-sm font-medium text-zinc-700">Door</span>
            <select
              className="h-10 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-300"
              value={filterDoorId}
              onChange={(e) => setFilterDoorId(e.target.value)}
              onKeyDown={onFilterKeyDown as any}
            >
              <option value="">All</option>
              {doors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 md:col-span-4 min-w-0">
            <span className="text-sm font-medium text-zinc-700">Device</span>
            <select
              className="h-10 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-300"
              value={filterDeviceId}
              onChange={(e) => setFilterDeviceId(e.target.value)}
              onKeyDown={onFilterKeyDown as any}
            >
              <option value="">All</option>
              {devices.map((dv) => (
                <option key={dv.id} value={dv.id}>
                  {dv.name}
                  {dv.ip ? ` (${dv.ip})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 md:col-span-4 min-w-0">
            <span className="text-sm font-medium text-zinc-700">Search</span>
            <input
              className="h-10 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-300"
              placeholder="Personel / kapı / cihaz / IN-OUT"
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              onKeyDown={onFilterKeyDown}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => loadEvents()}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterDate("");
              setFilterEmployeeId("");
              setFilterDoorId("");
              setFilterDeviceId("");
              setFilterSource("");
              loadEvents({ date: "", employeeId: "", doorId: "", deviceId: "" });
            }}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
          >
            Clear filters
          </button>
        </div>

        {items.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-600">
            No events.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <div className="scrollbar-hide max-h-[520px] overflow-y-auto rounded-lg">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="border-b border-zinc-200 px-3 py-2">When</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Employee</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Door</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Device</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Dir</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Source</th>
                  <th className="border-b border-zinc-200 px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedItems.map((ev) => (
                  <Fragment key={ev.id}>
                  <tr
                    className="cursor-pointer hover:bg-zinc-50"
                    onClick={() => toggleOpen(ev.id)}
                    title="Detay için tıkla"
                  >
                    <td className="whitespace-nowrap border-b border-zinc-100 px-3 py-2">
                      {formatLocalDateTime(ev.occurredAt)}
                    </td>
                    <td className="border-b border-zinc-100 px-3 py-2">
                      {ev.employee.employeeCode} - {ev.employee.firstName} {ev.employee.lastName}
                    </td>
                    <td className="border-b border-zinc-100 px-3 py-2">
                      {ev.door ? `${ev.door.code} - ${ev.door.name}` : "—"}
                    </td>
                    <td className="border-b border-zinc-100 px-3 py-2">{ev.device ? ev.device.name : "—"}</td>
                    <td className="border-b border-zinc-100 px-3 py-2">
                      <span
                        className={
                          ev.direction === "IN"
                            ? "inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                            : "inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700"
                        }
                      >
                        {ev.direction}
                      </span>
                    </td>
                    <td className="border-b border-zinc-100 px-3 py-2">
                      <span
                        className={
                          ev.source === "DEVICE"
                            ? "inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                            : "inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700"
                        }
                      >
                        {ev.source}
                      </span>
                    </td>
                    <td className="whitespace-nowrap border-b border-zinc-100 px-3 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(ev.id, "ID kopyalandı");
                          }}
                        >
                          Copy ID
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(ev.occurredAt, "OccurredAt kopyalandı");
                          }}
                        >
                          Copy time
                        </button>
                      </div>
                    </td>
                  </tr>
                  {openEventId === ev.id ? (
                    <tr className="bg-zinc-50/50">
                      <td colSpan={7} className="border-b border-zinc-100 px-3 py-3">
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="rounded-lg border border-zinc-200 bg-white p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Kimlik</div>
                            <div className="mt-1 text-sm text-zinc-900">ID: <span className="font-mono text-xs">{ev.id}</span></div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                                onClick={(e) => { e.stopPropagation(); copyToClipboard(ev.id, 'ID kopyalandı'); }}
                              >
                                Copy ID
                              </button>
                              <button
                                type="button"
                                className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                                onClick={(e) => { e.stopPropagation(); copyToClipboard(ev.employeeId, 'EmployeeId kopyalandı'); }}
                              >
                                Copy EmployeeId
                              </button>
                            </div>
                          </div>

                          <div className="rounded-lg border border-zinc-200 bg-white p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Zaman</div>
                            <div className="mt-1 text-sm text-zinc-900">Occurred (local): {formatLocalDateTime(ev.occurredAt)}</div>
                            <div className="mt-1 text-xs text-zinc-600">Occurred (raw): <span className="font-mono">{ev.occurredAt}</span></div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                                onClick={(e) => { e.stopPropagation(); copyToClipboard(ev.occurredAt, 'OccurredAt kopyalandı'); }}
                              >
                                Copy occurredAt
                              </button>
                            </div>
                          </div>

                          <div className="rounded-lg border border-zinc-200 bg-white p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Kaynak</div>
                            <div className="mt-1 text-sm text-zinc-900">Direction: {ev.direction} · Source: {ev.source}</div>
                            <div className="mt-1 text-xs text-zinc-600">Door: {ev.door ? `${ev.door.code} - ${ev.door.name}` : '—'}</div>
                            <div className="mt-1 text-xs text-zinc-600">Device: {ev.device ? ev.device.name : '—'}</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const payload = {
                                    id: ev.id,
                                    employeeId: ev.employeeId,
                                    occurredAt: ev.occurredAt,
                                    direction: ev.direction,
                                    source: ev.source,
                                    doorId: ev.door?.id ?? null,
                                    deviceId: ev.device?.id ?? null,
                                  };
                                  copyToClipboard(JSON.stringify(payload, null, 2), 'JSON kopyalandı');
                                }}
                              >
                                Copy JSON
                              </button>
                            </div>
                          </div>
                        </div>

                        {copied ? (
                          <div className="mt-3 text-xs text-emerald-700">{copied}</div>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
