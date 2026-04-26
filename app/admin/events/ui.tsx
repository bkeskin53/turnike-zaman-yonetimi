"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DateTime } from "luxon";

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

function fullNameEmp(e: Pick<Employee, "firstName" | "lastName">) {
  return `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim();
}

function EmployeePicker({
  value,
  onChange,
  employees,
  disabled,
  allowAll = false,
  placeholder,
}: {
  value: string;
  onChange: (id: string) => void;
  employees: Employee[];
  disabled?: boolean;
  allowAll?: boolean; // filter kısmında "Tümü"
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(() => employees.find((e) => e.id === value) ?? null, [employees, value]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((e) => {
      const hay = `${e.employeeCode} ${fullNameEmp(e)}`.toLowerCase();
      return hay.includes(term);
    });
  }, [employees, q]);

  useEffect(() => {
    function onDocDown(ev: MouseEvent) {
      const el = wrapRef.current;
      if (!el) return;
      if (!el.contains(ev.target as any)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((s) => !s)}
        className={cx(
          "h-10 w-full rounded-xl border px-3 text-left text-sm font-semibold shadow-sm transition-all",
          "border-slate-200/80 bg-white/90 text-slate-900 hover:border-indigo-200 hover:bg-indigo-50/50",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300",

          disabled ? "opacity-60 cursor-not-allowed" : ""
        )}
        title="Personel seç"
      >
        {selected ? (
          <span className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate font-semibold">{fullNameEmp(selected)}</span>
              <span className="block truncate text-[11px] font-bold tracking-wide text-slate-500">
                KOD: <span className="font-mono">{selected.employeeCode}</span>
              </span>
            </span>
            <span aria-hidden className="text-slate-400">▾</span>
          </span>
        ) : (
          <span className="flex items-center justify-between">
            <span className="text-slate-500 font-semibold">{placeholder ?? (allowAll ? "Tümü" : "Seç…")}</span>
            <span aria-hidden className="text-slate-400">▾</span>
          </span>
        )}
      </button>

      {open ? (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_18px_40px_rgba(15,23,42,0.10)] backdrop-blur-sm">
          <div className="border-b border-slate-200/70 bg-[linear-gradient(180deg,rgba(238,242,255,0.92),rgba(248,250,252,0.94))] p-2">
            <input
              className="h-9 w-full rounded-xl border border-slate-200/80 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Ara: kod / ad soyad…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-auto">
            {allowAll ? (
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-indigo-50/50"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                  setQ("");
                }}
              >
                <div className="text-sm font-semibold text-slate-900">Tümü</div>
                <div className="text-[11px] font-bold tracking-wide text-slate-500">Filtreyi temizler</div>
              </button>
            ) : null}

            {filtered.map((e) => (
              <button
                key={e.id}
                type="button"
                className={cx(
                  "w-full px-3 py-2 text-left hover:bg-indigo-50/50",
                  value === e.id ? "bg-indigo-50/60" : ""
                )}
                onClick={() => {
                  onChange(e.id);
                  setOpen(false);
                  setQ("");
                }}
              >
                <div className="text-sm font-semibold text-slate-900 truncate">{fullNameEmp(e)}</div>
                <div className="text-[11px] font-bold tracking-wide text-slate-500">
                  KOD: <span className="font-mono">{e.employeeCode}</span>
                </div>
              </button>
            ))}
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-slate-500">Sonuç yok.</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type Tone = "neutral" | "info" | "good" | "warn" | "violet" | "danger";

function toneStyles(tone: Tone) {
  switch (tone) {
    case "info":
      return {
        chip: "bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(56,189,248,0.10))] text-sky-800 ring-sky-300/45",
        soft: "border-sky-200/70 bg-gradient-to-br from-white via-sky-50/65 to-cyan-50/55",
        solid: "bg-sky-600 text-white ring-sky-500/30",
      };
    case "good":
      return {
        chip: "bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(52,211,153,0.10))] text-emerald-800 ring-emerald-300/45",
        soft: "border-emerald-200/70 bg-gradient-to-br from-white via-emerald-50/65 to-teal-50/55",
        solid: "bg-emerald-600 text-white ring-emerald-500/30",
      };
    case "warn":
      return {
        chip: "bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(251,191,36,0.10))] text-amber-900 ring-amber-300/45",
        soft: "border-amber-200/70 bg-gradient-to-br from-white via-amber-50/70 to-orange-50/55",
        solid: "bg-amber-600 text-white ring-amber-500/30",
      };
    case "violet":
      return {
        chip: "bg-[linear-gradient(135deg,rgba(99,102,241,0.18),rgba(139,92,246,0.10))] text-indigo-900 ring-indigo-300/45",
        soft: "border-indigo-200/70 bg-gradient-to-br from-white via-indigo-50/70 to-violet-50/60",
        solid: "bg-violet-600 text-white ring-violet-500/30",
      };
    case "danger":
      return {
        chip: "bg-[linear-gradient(135deg,rgba(244,63,94,0.16),rgba(251,113,133,0.10))] text-rose-800 ring-rose-300/45",
        soft: "border-rose-200/70 bg-gradient-to-br from-white via-rose-50/65 to-pink-50/55",
        solid: "bg-rose-600 text-white ring-rose-500/30",
      };
    default:
      return {
        chip: "bg-slate-100/90 text-slate-700 ring-slate-300/55",
        soft: "border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.94))]",
        solid: "bg-zinc-900 text-white ring-zinc-800/30",
      };
  }
}

function PillBadge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  const t = toneStyles(tone);
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-tight ring-1 ring-inset shadow-sm",
        t.chip
      )}
    >
      {children}
    </span>
  );
}

function roleLabel(role: string) {
  switch (role) {
    case "SYSTEM_ADMIN":
    case "HR_CONFIG_ADMIN":
    case "HR_OPERATOR":
    case "SUPERVISOR":
      return role;
    default:
      return role || "UNKNOWN";
  }
}

function Button({
  variant = "secondary",
  disabled,
  onClick,
  children,
  title,
  type = "button",
}: {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "border border-indigo-400/30 bg-[linear-gradient(135deg,#4f46e5,#7c3aed)] text-white shadow-[0_14px_28px_rgba(79,70,229,0.22)] hover:brightness-105"
      : variant === "danger"
      ? "border border-rose-300/30 bg-[linear-gradient(135deg,#e11d48,#f43f5e)] text-white shadow-[0_14px_28px_rgba(225,29,72,0.16)] hover:brightness-105"
      : variant === "ghost"
      ? "bg-transparent text-slate-700 hover:bg-indigo-50/70 hover:text-indigo-700"
      : "border border-slate-200/80 bg-white/90 text-slate-800 hover:border-indigo-200 hover:bg-indigo-50/50 shadow-[0_10px_24px_rgba(15,23,42,0.05)]";
  return (
    <button className={cx(base, styles)} onClick={onClick} disabled={disabled} title={title} type={type}>
      {children}
    </button>
  );
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateTimeLocalForZone(dt: DateTime) {
  return `${dt.year}-${pad2(dt.month)}-${pad2(dt.day)}T${pad2(dt.hour)}:${pad2(dt.minute)}`;
 }

function nowLocalInputValueForPolicyTimezone(policyTimezone: string) {
  const dt = DateTime.now().setZone(policyTimezone);
  if (!dt.isValid) {
    const fallback = DateTime.now().setZone("Europe/Istanbul");
    return formatDateTimeLocalForZone(fallback);
  }
  return formatDateTimeLocalForZone(dt);
}

function formatPolicyDateTime(iso: string, policyTimezone: string) {
  const dt = DateTime.fromISO(iso, { setZone: true });
  if (!dt.isValid) return iso;

  const zoned = dt.setZone(policyTimezone);
  if (!zoned.isValid) return iso;

  return zoned.toFormat("dd.MM.yyyy HH:mm");
}

function localPolicyDateTimeToUtcIso(local: string, policyTimezone: string) {
  // local: "YYYY-MM-DDTHH:mm"
  const dt = DateTime.fromFormat(local, "yyyy-MM-dd'T'HH:mm", {
    zone: policyTimezone,
  });

  if (!dt.isValid) {
    throw new Error("INVALID_LOCAL_DATETIME");
  }

  const utc = dt.toUTC();
  const iso = utc.toISO({
    suppressMilliseconds: true,
    includeOffset: true,
  });

  if (!iso) {
    throw new Error("INVALID_LOCAL_DATETIME");
  }

  return iso;
}

export default function EventsClient({
  canEditEvents,
  role,
  policyTimezone,
}: {
  canEditEvents: boolean;
  role: string;
  policyTimezone: string;
}) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [items, setItems] = useState<RawEventRow[]>([]);
  const [doors, setDoors] = useState<Door[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [occurredAtLocal, setOccurredAtLocal] = useState("");
  // direction artık “AUTO” opsiyonunu da destekliyor. (UI only)
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
    setForbidden(false);
    setNotice(null);
    try {
      await loadEmployees();
      await loadDoors();
      await loadDevices();
      // UX: default to "now" for quicker manual entry
      setOccurredAtLocal((prev) => prev || nowLocalInputValueForPolicyTimezone(policyTimezone));
      await loadEvents();
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      // HR_CONFIG_ADMIN / SUPERVISOR gibi roller bazı endpointlerde 403 alabiliyor.
      // Bu durumda kırmızı hata yerine “Yetki yok” bannerı gösterelim.
      if (msg.endsWith("_403")) {
        setForbidden(true);
        setError(null);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function createEvent() {
    if (!canEditEvents) {
      setNotice("Supervisor modu: manuel event ekleme kapalı.");
      return;
    }
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const iso = localPolicyDateTimeToUtcIso(occurredAtLocal, policyTimezone);

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
      setOccurredAtLocal(nowLocalInputValueForPolicyTimezone(policyTimezone));
      setDoorId("");
      setDeviceId("");
      await loadEvents();
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg === "INVALID_LOCAL_DATETIME") {
        setError(`Geçersiz tarih/saat. Saat bilgisi ${policyTimezone} zaman dilimine göre yorumlanır.`);
        return;
      }
      throw e;
    } finally {
      setSaving(false);
    }
  }

  const activeFilterCount = useMemo(() => {
    return [
      filterDate ? 1 : 0,
      filterEmployeeId ? 1 : 0,
      filterDoorId ? 1 : 0,
      filterDeviceId ? 1 : 0,
      filterSource ? 1 : 0,
      quickFilter.trim() ? 1 : 0,
    ].reduce((a, b) => a + b, 0);
  }, [filterDate, filterEmployeeId, filterDoorId, filterDeviceId, filterSource, quickFilter]);

  useEffect(() => {
    loadAll();
  }, []);

  if (loading) {
    return <div className="py-10 text-center text-sm text-slate-600">Event’ler yükleniyor…</div>;
  }

  return (
    <div className="grid gap-5">
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

      {/* Hero */}
      <div className={cx("rounded-2xl border p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]", toneStyles("violet").soft)}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-lg font-extrabold tracking-tight text-slate-950">Events</div>
              <PillBadge tone="violet">RawEvent</PillBadge>
              {saving ? <PillBadge tone="warn">Kaydediliyor</PillBadge> : null}
              {copied ? <PillBadge tone="good">Kopyalandı</PillBadge> : null}
              {!canEditEvents ? <PillBadge tone="neutral">Read-only</PillBadge> : null}
              <PillBadge tone={canEditEvents ? "good" : "warn"}>ROL: {roleLabel(role)}</PillBadge>
              <PillBadge tone="info">TZ: {policyTimezone}</PillBadge>
            </div>
            <div className="mt-1 text-sm text-slate-600 font-medium leading-relaxed">
              Bu ekran turnike/manuel <b>ham olay</b> kayıtlarını gösterir. Puantaj ve vardiya hesapları{" "}
              <b>Time Evaluation</b> katmanında üretilir. (Burada motor değiştirilmez.)
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Saat girişi ve gösterimi policy timezone üzerinden yapılır: <b>{policyTimezone}</b>.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => loadEvents()} title="Listeyi yenile">
              Yenile
              <span aria-hidden className="text-slate-400">→</span>
            </Button>
            <Button
              variant="secondary"
              disabled={!canEditEvents}
              onClick={() => setOccurredAtLocal(nowLocalInputValueForPolicyTimezone(policyTimezone))}
              title={!canEditEvents ? "Supervisor: manuel giriş kapalı" : "Şimdi"}
            >
              Şimdi
              <span aria-hidden className="text-slate-400">→</span>
            </Button>
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm font-semibold text-slate-800 shadow-[0_10px_24px_rgba(15,23,42,0.05)] hover:border-indigo-200 hover:bg-indigo-50/50"
              href="/"
              title="Ana sayfa"
            >
              Panel
              <span aria-hidden className="text-slate-400">→</span>
            </Link>
          </div>
        </div>
      </div>
      
      {/* Yetki bannerı: 403 olduğunda veya edit yetkisi yokken bilgi ver */}
      {(!canEditEvents || forbidden) ? (
        <div className="rounded-2xl border border-amber-200/80 bg-[linear-gradient(135deg,rgba(254,243,199,0.96),rgba(255,255,255,0.94))] px-4 py-3 shadow-[0_10px_24px_rgba(245,158,11,0.06)]">
          <div className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">Yetki bilgisi</div>
          <div className="mt-1 text-sm text-amber-900/90 font-semibold">
            Bu ekranda manuel event ekleme yetkin yok.
            {forbidden ? " Ayrıca listeleme/veri okuma da bu rolde kapalı." : ""}
          </div>
          <div className="mt-1 text-[11px] text-amber-900/70">
            Gerekli rol: <b>OPS_WRITE</b> (SYSTEM_ADMIN veya HR_OPERATOR)
          </div>
        </div>
      ) : null}

      {error && (
        <div className={cx("flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm", toneStyles("danger").soft)}>
          <div className="text-rose-900 font-semibold">{error}</div>
          <Button variant="ghost" onClick={() => setError(null)} title="Kapat">
            <span className="text-rose-800 font-semibold">Kapat</span>
          </Button>
        </div>
      )}
        {notice && (
        <div className={cx("flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm", toneStyles("good").soft)}>
          <div className="text-emerald-900 font-semibold">{notice}</div>
          <Button variant="ghost" onClick={() => setNotice(null)} title="Kapat">
            <span className="text-emerald-800 font-semibold">Kapat</span>
          </Button>
        </div>
      )}

      {/* Manuel Olay Giriş Formu */}
      {/* ✅ %500 gibi ekstremde taşarsa bu kart kendi içinde X-scroll versin */}
      <section className={cx("rounded-2xl border p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)] overflow-x-auto max-w-full", toneStyles("info").soft)}>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold tracking-tight text-slate-950">Manuel Olay Ekle</h2>
              <PillBadge tone="info">Giriş</PillBadge>
              {!canEditEvents ? <PillBadge tone="neutral">Supervisor: kapalı</PillBadge> : null}
            </div>
            <p className="text-sm text-slate-600">
              {canEditEvents
                ? `Ham olay ekler; hesap motorunu değiştirmez. Girilen saat ${policyTimezone} zaman dilimine göre yorumlanır.`
                : "Supervisor modu: manuel ham olay girişi kapalıdır. Sadece listeleme/filtreleme yapılabilir."}
            </p>
          </div>
          <Button
            variant="secondary"
            disabled={!canEditEvents}
            onClick={() => setOccurredAtLocal(nowLocalInputValueForPolicyTimezone(policyTimezone))}
            title={!canEditEvents ? "Supervisor: manuel giriş kapalı" : "Şimdi"}
          >
            Şimdi
          </Button>
        </div>

        <div className={cx("mt-4 grid gap-3 md:grid-cols-2", !canEditEvents ? "opacity-70" : "")}>
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Personel</span>
            <EmployeePicker
              value={employeeId}
              onChange={setEmployeeId}
              employees={employees}
              disabled={saving || !canEditEvents}
              placeholder="Seç…"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Tarih / Saat</span>
            <input
              className="h-10 rounded-xl border border-slate-200/80 bg-white/90 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
              type="datetime-local"
              value={occurredAtLocal}
              onChange={(e) => setOccurredAtLocal(e.target.value)}
              disabled={!canEditEvents}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Yön</span>
            <select
              className="h-10 rounded-xl border border-slate-200/80 bg-white/90 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
              value={direction}
              onChange={(e) => setDirection(e.target.value as any)}
              disabled={!canEditEvents}
            >
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
              <option value="AUTO">Auto (kapı default)</option>
            </select>
            {direction === "AUTO" && !doorId && (
              <span className="inline-flex items-center gap-2 text-xs text-amber-800">
                <PillBadge tone="warn">Uyarı</PillBadge>
                Auto seçildi: kapı seçimi zorunlu.
              </span>
            )}
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">
              Kapı <span className="text-slate-500 font-medium">(opsiyonel)</span>
            </span>
            <select
              className="h-10 rounded-xl border border-slate-200/80 bg-white/90 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
              value={doorId}
              onChange={(e) => setDoorId(e.target.value)}
              disabled={!canEditEvents}
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
            <span className="text-sm font-semibold text-slate-800">
              Cihaz <span className="text-slate-500 font-medium">(opsiyonel)</span>
            </span>
            <select
              className="h-10 rounded-xl border border-slate-200/80 bg-white/90 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              disabled={!canEditEvents}
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
          <div className="text-xs text-slate-500">
            Kaydetmeden önce personel ve tarih/saat seçtiğinizden emin olun.
          </div>
          <Button
            variant="primary"
            disabled={!canEditEvents || !canSave || saving}
            onClick={createEvent}
            title={!canEditEvents ? "Supervisor: manuel event ekleme kapalı" : "Olayı oluştur"}
          >
            {saving ? "Kaydediliyor…" : "Olayı Oluştur"}
          </Button>
        </div>
      </section>

      {/* Olay Listeleme ve Filtreleme */}
      <section className="rounded-2xl border border-slate-200/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.94))] p-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold tracking-tight text-slate-950">Olay Listesi</h2>
              <PillBadge tone="neutral">{items.length} kayıt</PillBadge>
            </div>
            <p className="text-sm text-slate-600">
              {quickFilter.trim() ? `${displayedItems.length} / ${items.length} kayıt görüntüleniyor.` : `${items.length} kayıt görüntüleniyor.`}
            </p>
          </div>
          <Button variant="secondary" onClick={() => loadEvents()} title="Listeyi yenile">
            Yenile
          </Button>
        </div>
        
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-sm font-extrabold text-slate-950">Filtreler</div>
            <PillBadge tone={activeFilterCount ? "warn" : "neutral"}>{activeFilterCount} aktif</PillBadge>
          </div>
          <div className="text-xs text-slate-500">Enter: uygula • Esc: hızlı aramayı temizle</div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-12">
          <label className="grid gap-1.5 md:col-span-3 min-w-0">
            <span className="text-sm font-semibold text-slate-800">Tarih</span>
            <input
              className="h-10 rounded-xl border border-slate-200/80 bg-white/90 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              onKeyDown={onFilterKeyDown}
            />
          </label>

          <label className="grid gap-1.5 md:col-span-5 min-w-0">
            <span className="text-sm font-semibold text-slate-800">Personel</span>
            <EmployeePicker
              value={filterEmployeeId}
              onChange={setFilterEmployeeId}
              employees={employees}
              disabled={false}
              allowAll
              placeholder="Tümü"
            />
          </label>
          
          <label className="grid gap-1.5 md:col-span-4 min-w-0">
            <span className="text-sm font-semibold text-slate-800">Kaynak</span>
            <select
              className="h-10 w-full min-w-0 rounded-xl border border-slate-200/80 bg-white/90 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value as any)}
              onKeyDown={onFilterKeyDown as any}
            >
              <option value="">Tümü</option>
              <option value="DEVICE">Cihaz</option>
              <option value="MANUAL">Manuel</option>
            </select>
          </label>

          <label className="grid gap-1.5 md:col-span-4 min-w-0">
            <span className="text-sm font-semibold text-slate-800">Kapı</span>
            <select
              className="h-10 w-full min-w-0 rounded-xl border border-slate-200/80 bg-white/90 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
              value={filterDoorId}
              onChange={(e) => setFilterDoorId(e.target.value)}
              onKeyDown={onFilterKeyDown as any}
            >
              <option value="">Tümü</option>
              {doors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 md:col-span-4 min-w-0">
            <span className="text-sm font-semibold text-slate-800">Cihaz</span>
            <select
              className="h-10 w-full min-w-0 rounded-xl border border-slate-200/80 bg-white/90 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
              value={filterDeviceId}
              onChange={(e) => setFilterDeviceId(e.target.value)}
              onKeyDown={onFilterKeyDown as any}
            >
              <option value="">Tümü</option>
              {devices.map((dv) => (
                <option key={dv.id} value={dv.id}>
                  {dv.name}
                  {dv.ip ? ` (${dv.ip})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 md:col-span-4 min-w-0">
            <span className="text-sm font-semibold text-slate-800">Hızlı Arama</span>
            <input
              className="h-10 w-full min-w-0 rounded-xl border border-slate-200/80 bg-white/90 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Personel / kapı / cihaz / IN-OUT"
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              onKeyDown={onFilterKeyDown}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <Button variant="primary" onClick={() => loadEvents()} title="Filtreleri uygula">
            Filtreleri Uygula
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setFilterDate("");
              setFilterEmployeeId("");
              setFilterDoorId("");
              setFilterDeviceId("");
              setFilterSource("");
              loadEvents({ date: "", employeeId: "", doorId: "", deviceId: "" });
            }}
            title="Filtreleri temizle"
          >
            Temizle
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200/80 bg-slate-50/80 px-4 py-10 text-center text-sm text-slate-600">
            Henüz event yok.
          </div>
        ) : (
          <div className="mt-4 min-w-0 max-w-full">
            {/* Haftalık Plan mantığı: sığmazsa içeriden yatay scroll */}
            <div className="overflow-x-auto max-w-full">
              {/* ✅ Kritik: overflow-y-auto yüzünden yatay overflow bu div'e kaymasın.
                  Yatay overflow'u dış wrapper (overflow-x-auto) yakalasın. */}
              <div className="scrollbar-hide max-h-[520px] overflow-y-auto overflow-x-visible rounded-2xl border border-slate-200/75 bg-white/88 shadow-[0_18px_38px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            {/* min-w-max: tablo doğal genişliğine çıkar, wrapper scroll verir */}
            <table className="min-w-max w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(238,242,255,0.96),rgba(248,250,252,0.96))]">
                <tr className="text-left text-xs font-extrabold uppercase tracking-wide text-slate-600">
                  <th className="border-b border-slate-200 px-3 py-3">Zaman</th>
                  <th className="border-b border-slate-200 px-3 py-3">Personel</th>
                  <th className="border-b border-slate-200 px-3 py-3">Kapı</th>
                  <th className="border-b border-slate-200 px-3 py-3">Cihaz</th>
                  <th className="border-b border-slate-200 px-3 py-3">Yön</th>
                  <th className="border-b border-slate-200 px-3 py-3">Kaynak</th>
                  <th className="border-b border-slate-200 px-3 py-3 text-right">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {displayedItems.map((ev) => (
                  <Fragment key={ev.id}>
                  <tr
                    className={cx(
                      "group cursor-pointer transition-colors",
                      openEventId === ev.id ? "bg-indigo-50/60" : "",
                      "hover:bg-indigo-50/50"
                    )}
                    onClick={() => toggleOpen(ev.id)}
                    title="Detay için tıkla"
                  >
                    {/* left accent bar */}
                    <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2">
                      <span className="relative block pl-2">
                        <span
                          aria-hidden
                          className={cx(
                            "absolute left-0 top-0 h-full w-[3px] rounded-full bg-indigo-200/0 transition-colors",
                            openEventId === ev.id ? "bg-indigo-300/80" : "group-hover:bg-indigo-300/70"
                          )}
                        />
                        {formatPolicyDateTime(ev.occurredAt, policyTimezone)}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-flex items-center rounded-xl bg-gradient-to-b from-indigo-50 to-white px-2 py-1 font-mono text-xs font-extrabold text-indigo-800 ring-1 ring-inset ring-indigo-200/70 shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-md hover:ring-indigo-300/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                          title="Sicil No (tıklanabilir görünüm)"
                        >
                          {ev.employee.employeeCode}
                        </span>
                        <span className="font-semibold text-slate-950">{ev.employee.firstName} {ev.employee.lastName}</span>
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      {ev.door ? `${ev.door.code} - ${ev.door.name}` : "—"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">{ev.device ? ev.device.name : "—"}</td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      <PillBadge tone={ev.direction === "IN" ? "good" : "danger"}>{ev.direction}</PillBadge>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      <PillBadge tone={ev.source === "DEVICE" ? "info" : "neutral"}>{ev.source}</PillBadge>
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          className="rounded-xl border border-slate-200/80 bg-white/90 px-2 py-1 text-xs font-semibold text-slate-800 hover:border-indigo-200 hover:bg-indigo-50/50"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(ev.id, "ID kopyalandı");
                          }}
                        >
                          ID Kopyala
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-slate-200/80 bg-white/90 px-2 py-1 text-xs font-semibold text-slate-800 hover:border-indigo-200 hover:bg-indigo-50/50"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(ev.occurredAt, "OccurredAt kopyalandı");
                          }}
                        >
                          Zaman Kopyala
                        </button>
                      </div>
                    </td>
                  </tr>
                  {openEventId === ev.id ? (
                    <tr className="bg-indigo-50/30">
                      <td colSpan={7} className="border-b border-slate-100 px-3 py-3">
                        {/* Detay kartları da sığmazsa içeriden scroll versin */}
                        <div className="overflow-x-auto max-w-full">
                          {/* ✅ Burada da aynı prensip: grid taşarsa X-scroll dış wrapper'da olsun */}
                          <div className="grid gap-3 md:grid-cols-3 min-w-max md:min-w-0 overflow-x-visible">
                          <div className={cx("rounded-2xl border p-4 shadow-[0_10px_24px_rgba(99,102,241,0.06)]", toneStyles("violet").soft)}>
                              <div className="flex items-center gap-2">
                                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Kimlik</div>
                                <PillBadge tone="violet">ID</PillBadge>
                              </div>
                              <div className="mt-2 text-sm text-slate-900">
                                Event ID: <span className="font-mono text-xs">{ev.id}</span>
                              </div>
                              <div className="mt-1 text-sm text-slate-900">
                                EmployeeId: <span className="font-mono text-xs">{ev.employeeId}</span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button variant="secondary" onClick={() => copyToClipboard(ev.id, "ID kopyalandı")}>
                                  ID Kopyala
                                </Button>
                                <Button variant="secondary" onClick={() => copyToClipboard(ev.employeeId, "EmployeeId kopyalandı")}>
                                  EmployeeId Kopyala
                                </Button>
                              </div>
                            </div>

                            <div className={cx("rounded-2xl border p-4 shadow-[0_10px_24px_rgba(14,165,233,0.06)]", toneStyles("info").soft)}>
                              <div className="flex items-center gap-2">
                                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Zaman</div>
                                <PillBadge tone="info">Local / Raw</PillBadge>
                              </div>
                              <div className="mt-2 text-sm text-slate-900">
                                Policy TZ: <span className="font-semibold">{formatPolicyDateTime(ev.occurredAt, policyTimezone)}</span>
                              </div>
                              <div className="mt-1 text-xs text-slate-600">
                                Raw: <span className="font-mono">{ev.occurredAt}</span>
                              </div>
                              <div className="mt-1 text-xs text-slate-600">
                                Timezone: <span className="font-mono">{policyTimezone}</span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button variant="secondary" onClick={() => copyToClipboard(ev.occurredAt, "OccurredAt kopyalandı")}>
                                  Zaman Kopyala
                                </Button>
                              </div>
                            </div>

                            <div className={cx("rounded-2xl border p-4 shadow-[0_10px_24px_rgba(245,158,11,0.06)]", toneStyles("warn").soft)}>
                              <div className="flex items-center gap-2">
                                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Kaynak</div>
                                <PillBadge tone="warn">Meta</PillBadge>
                              </div>
                             <div className="mt-2 text-sm text-slate-900">
                                <span className="font-semibold">Yön:</span> {ev.direction} · <span className="font-semibold">Kaynak:</span> {ev.source}
                              </div>
                              <div className="mt-1 text-xs text-slate-600">Kapı: {ev.door ? `${ev.door.code} - ${ev.door.name}` : "—"}</div>
                              <div className="mt-1 text-xs text-slate-600">Cihaz: {ev.device ? ev.device.name : "—"}</div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  variant="secondary"
                                  onClick={() => {
                                    const payload = {
                                      id: ev.id,
                                      employeeId: ev.employeeId,
                                      occurredAt: ev.occurredAt,
                                      direction: ev.direction,
                                      source: ev.source,
                                      doorId: ev.door?.id ?? null,
                                      deviceId: ev.device?.id ?? null,
                                    };
                                    copyToClipboard(JSON.stringify(payload, null, 2), "JSON kopyalandı");
                                  }}
                                >
                                  JSON Kopyala
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {copied ? (
                          <div className="mt-3 text-xs text-emerald-700 font-semibold">{copied}</div>
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
          </div>
        )}
      </section>
    </div>
  );
}
