"use client";

import { useEffect, useMemo, useState } from "react";

type EmployeeLite = { id: string; employeeCode: string; firstName: string; lastName: string; isActive?: boolean };

type ShiftTemplate = {
  id: string;
  shiftCode: string;
  signature: string;
  startTime: string;
  endTime: string;
  spansMidnight: boolean;
  isActive: boolean;
};

type EmployeeGroup = { id: string; code: string; name: string; isActive?: boolean };
type EmployeeSubgroup = {
  id: string;
  code: string;
  name: string;
  employeeGroup?: { id: string; code: string; name: string } | null;
  isActive?: boolean;
};
type Branch = { id: string; code: string; name: string; isActive: boolean };

type Pattern = {
  id: string;
  code: string;
  name: string;
  cycleLengthDays: number;
  referenceDate: string | Date;
  dayShiftTemplateIds: string[];
  isActive: boolean;
};

type DayCell = string | null; // null => OFF (Enterprise B)

function fmtShiftLabel(t: ShiftTemplate) {
  const sig = t.signature ?? "";
  const code = t.shiftCode ?? "";
  if (code && code !== sig) return `${code} (${sig})`;
  return code || sig || "—";
}

function toDayKey(v: any): string {
  if (!v) return "";
  if (typeof v === "string") {
    // Prisma DATE may serialize as ISO string.
    return v.slice(0, 10);
  }
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function toDayCells(p: Pattern): DayCell[] {
  const cycle = Number(p?.cycleLengthDays ?? 0);
  const raw = Array.isArray(p?.dayShiftTemplateIds) ? p.dayShiftTemplateIds : [];
  const xs: DayCell[] = [];
  for (let i = 0; i < Math.max(0, cycle); i++) {
    const v = String(raw[i] ?? "").trim();
    xs.push(v ? v : null); // "" => OFF (legacy), null => OFF (enterprise)
  }
  return xs;
}

function dayCellToApi(v: DayCell): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function addDaysUtc(isoDayKey: string, add: number): Date {
  // isoDayKey: YYYY-MM-DD
  const d = new Date(`${isoDayKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + add);
  return d;
}

function weekdayFromRef(referenceDayKey: string, dayIndex: number): number {
  // returns 1..7 (Mon..Sun)
  const d = addDaysUtc(referenceDayKey, dayIndex);
  const js = d.getUTCDay(); // 0..6 (Sun..Sat)
  if (js === 0) return 7;
  return js; // 1..6
}

function trWeekdayShort(wd: number): string {
  // 1..7 (Mon..Sun)
  switch (wd) {
    case 1:
      return "Pzt";
    case 2:
      return "Sal";
    case 3:
      return "Çar";
    case 4:
      return "Per";
    case 5:
      return "Cum";
    case 6:
      return "Cmt";
    case 7:
      return "Paz";
    default:
      return "—";
  }
}

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type Tone = "neutral" | "info" | "good" | "warn" | "violet" | "danger";

function toneStyles(tone: Tone) {
  switch (tone) {
    case "info":
      return {
        chip: "bg-sky-50 text-sky-900 ring-sky-200/70",
        soft: "border-sky-200/70 bg-gradient-to-b from-white to-sky-50/40",
        solid: "bg-sky-600 text-white ring-sky-500/30",
      };
    case "good":
      return {
        chip: "bg-emerald-50 text-emerald-900 ring-emerald-200/70",
        soft: "border-emerald-200/70 bg-gradient-to-b from-white to-emerald-50/35",
        solid: "bg-emerald-600 text-white ring-emerald-500/30",
      };
    case "warn":
      return {
        chip: "bg-amber-50 text-amber-950 ring-amber-200/70",
        soft: "border-amber-200/70 bg-gradient-to-b from-white to-amber-50/45",
        solid: "bg-amber-600 text-white ring-amber-500/30",
      };
    case "violet":
      return {
        chip: "bg-violet-50 text-violet-900 ring-violet-200/70",
        soft: "border-violet-200/70 bg-gradient-to-b from-white to-violet-50/40",
        solid: "bg-violet-600 text-white ring-violet-500/30",
      };
    case "danger":
      return {
        chip: "bg-rose-50 text-rose-900 ring-rose-200/70",
        soft: "border-rose-200/70 bg-gradient-to-b from-white to-rose-50/40",
        solid: "bg-rose-600 text-white ring-rose-500/30",
      };
    default:
      return {
        chip: "bg-zinc-100 text-zinc-800 ring-zinc-200/70",
        soft: "border-zinc-200/70 bg-white",
        solid: "bg-zinc-900 text-white ring-zinc-800/30",
      };
  }
}

function PillBadge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  const t = toneStyles(tone);
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-tight ring-1 ring-inset shadow-sm",
        t.chip
      )}
    >
      {children}
    </span>
  );
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
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25 disabled:opacity-60 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
      : variant === "danger"
      ? "bg-rose-600 text-white shadow-sm hover:bg-rose-700"
      : variant === "ghost"
      ? "bg-transparent text-zinc-800 hover:bg-zinc-100"
      : "border border-zinc-200 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50";
  return (
    <button className={cx(base, styles)} onClick={onClick} disabled={disabled} title={title} type={type}>
      {children}
    </button>
  );
}

export default function WorkSchedulesClient() {
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [groups, setGroups] = useState<EmployeeGroup[]>([]);
  const [subgroups, setSubgroups] = useState<EmployeeSubgroup[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // --- pattern day editor (Enterprise OFF) ---
  const [editOpen, setEditOpen] = useState<boolean>(false);
  const [editPatternId, setEditPatternId] = useState<string>("");
  const [editDays, setEditDays] = useState<DayCell[]>([]);
  const [editSaving, setEditSaving] = useState<boolean>(false);
  const [bulkTemplateId, setBulkTemplateId] = useState<string>(""); // quick fill selection

  // --- create pattern form ---
  const [code, setCode] = useState<string>("VR01");
  const [name, setName] = useState<string>("Beyaz Yaka");
  const [cycleLengthDays, setCycleLengthDays] = useState<number>(14);
  const [referenceDayKey, setReferenceDayKey] = useState<string>("1996-01-01");
  const [defaultShiftTemplateId, setDefaultShiftTemplateId] = useState<string>("");

  // --- assignment form (Phase-1: group/subgroup/branch) ---
  const [scope, setScope] = useState<string>("EMPLOYEE_GROUP");
  const [patternId, setPatternId] = useState<string>("");
  const [employeeGroupId, setEmployeeGroupId] = useState<string>("");
  const [employeeSubgroupId, setEmployeeSubgroupId] = useState<string>("");
  const [branchId, setBranchId] = useState<string>("");
  const [employeeId, setEmployeeId] = useState<string>("");

  const [priority, setPriority] = useState<number>(100);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedSubgroupId, setSelectedSubgroupId] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [employeeQuery, setEmployeeQuery] = useState<string>("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [employeeLoading, setEmployeeLoading] = useState<boolean>(false);

  const [validFromDayKey, setValidFromDayKey] = useState<string>("");
  const [validToDayKey, setValidToDayKey] = useState<string>("");

  async function loadAll() {
    setLoading(true);
    try {
      const [stRes, pRes, aRes, gRes, sgRes, bRes] = await Promise.all([
        fetch("/api/shift-templates?includeInactive=1"),
        fetch("/api/policy/work-schedules"),
        fetch("/api/policy/work-schedules/assignments"),
        fetch("/api/workforce/groups", { credentials: "include" }),
        fetch("/api/workforce/subgroups", { credentials: "include" }),
        fetch("/api/org/branches"),
      ]);
      const stJson = await stRes.json();
      const pJson = await pRes.json();
      const aJson = await aRes.json();
      const gJson = await gRes.json().catch(() => null);
      const sgJson = await sgRes.json().catch(() => null);
      const bJson = await bRes.json().catch(() => null);

      setShiftTemplates(Array.isArray(stJson.items) ? stJson.items : []);
      setPatterns(Array.isArray(pJson.items) ? pJson.items : []);
      setAssignments(Array.isArray(aJson.items) ? aJson.items : []);
      setGroups(Array.isArray(gJson?.items) ? gJson.items : []);
      setSubgroups(Array.isArray(sgJson?.items) ? sgJson.items : []);
      setBranches(Array.isArray(bJson) ? bJson : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  // keep ID fields in-sync with selected dropdowns
  useEffect(() => {
    if (scope === "EMPLOYEE_GROUP") {
      setEmployeeGroupId(selectedGroupId);
      setEmployeeSubgroupId("");
      setBranchId("");
      setEmployeeId("");
    } else if (scope === "EMPLOYEE_SUBGROUP") {
      setEmployeeSubgroupId(selectedSubgroupId);
      setEmployeeGroupId("");
      setBranchId("");
      setEmployeeId("");
    } else if (scope === "BRANCH") {
      setBranchId(selectedBranchId);
      setEmployeeGroupId("");
      setEmployeeSubgroupId("");
      setEmployeeId("");
    } else if (scope === "EMPLOYEE") {
      setEmployeeId(selectedEmployeeId);
      setEmployeeGroupId("");
      setEmployeeSubgroupId("");
      setBranchId("");
    }
  }, [scope, selectedGroupId, selectedSubgroupId, selectedBranchId, selectedEmployeeId]);

  async function loadEmployees(q: string) {
    setEmployeeLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("status", "ACTIVE");
      qs.set("pageSize", "50");
      if (q.trim()) qs.set("q", q.trim());
      const res = await fetch(`/api/employees?${qs.toString()}`, { credentials: "include" });
      const json = await res.json().catch(() => null);
      setEmployees(Array.isArray(json?.items) ? json.items : []);
    } finally {
      setEmployeeLoading(false);
    }
  }

  // When employee scope active, keep employee list reasonably fresh.
  useEffect(() => {
    if (scope !== "EMPLOYEE") return;
    const t = setTimeout(() => loadEmployees(employeeQuery), 250);
    return () => clearTimeout(t);
  }, [scope, employeeQuery]);

  const groupOptions = useMemo(() => {
    const xs = (groups ?? []).slice().sort((a, b) => (a.code ?? "").localeCompare(b.code ?? ""));
    return xs;
  }, [groups]);

  const subgroupOptions = useMemo(() => {
    const xs = (subgroups ?? []).slice().sort((a, b) => (a.code ?? "").localeCompare(b.code ?? ""));
    return xs;
  }, [subgroups]);

  const branchOptions = useMemo(() => {
    const xs = (branches ?? []).filter((b) => b.isActive).slice().sort((a, b) => a.code.localeCompare(b.code));
    return xs;
  }, [branches]);

  const shiftOptions = useMemo(() => {
    const items = (shiftTemplates ?? []).filter((x) => x.isActive);
    return items;
  }, [shiftTemplates]);

  const patternOptions = useMemo(() => {
    return (patterns ?? []).filter((p) => p.isActive);
  }, [patterns]);

  const editPattern = useMemo(() => {
    if (!editPatternId) return null;
    return (patterns ?? []).find((p) => p.id === editPatternId) ?? null;
  }, [patterns, editPatternId]);

  async function createPattern() {
    setSaving(true);
    try {
      const cycle = Number(cycleLengthDays);
      const tpl = defaultShiftTemplateId || null;
      // Enterprise OFF: API now supports (string|null). For initial creation, fill all days with selected template.
      const dayShiftTemplateIds = Array.from({ length: cycle }, () => (tpl ? tpl : null));

      const res = await fetch("/api/policy/work-schedules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code,
          name,
          cycleLengthDays: cycle,
          referenceDayKey,
          dayShiftTemplateIds,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(String(json?.error ?? "SAVE_FAILED"));
      await loadAll();
    } finally {
      setSaving(false);
    }
  }

  function openDayEditor(p: Pattern) {
    setEditPatternId(p.id);
    setEditDays(toDayCells(p));
    setEditOpen(true);
  }

  function closeDayEditor() {
    setEditOpen(false);
    setEditPatternId("");
    setEditDays([]);
    setBulkTemplateId("");
  }

  function setDay(i: number, v: DayCell) {
    setEditDays((prev) => {
      const xs = prev.slice();
      xs[i] = v;
      return xs;
    });
  }

  function fillAllOff() {
    setEditDays((prev) => prev.map(() => null));
  }

  function fillAllWithTemplate(tplId: string) {
    const v = String(tplId ?? "").trim();
    if (!v) return;
    setEditDays((prev) => prev.map(() => v));
  }

  function fillWeekdaysTemplateWeekendOff(tplId: string) {
    const v = String(tplId ?? "").trim();
    if (!v || !editPattern) return;
    const ref = toDayKey(editPattern.referenceDate);
    if (!ref) return;
    setEditDays((prev) => {
      const xs = prev.slice();
      for (let i = 0; i < xs.length; i++) {
        const wd = weekdayFromRef(ref, i); // 1..7
        const isWeekend = wd === 6 || wd === 7; // Sat/Sun
        xs[i] = isWeekend ? null : v;
      }
      return xs;
    });
  }

  function copyFirstWeekToAllWeeks() {
    if (!editPattern) return;
    const cycle = Number(editPattern.cycleLengthDays ?? 0);
    if (!Number.isFinite(cycle) || cycle < 7) return;
    setEditDays((prev) => {
      const xs = prev.slice();
      const base = xs.slice(0, 7);
      for (let i = 0; i < xs.length; i++) {
        xs[i] = base[i % 7] ?? null;
      }
      return xs;
    });
  }

  async function saveDayEditor() {
    if (!editPatternId) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/policy/work-schedules/${editPatternId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          // Enterprise OFF: null => OFF (stored as NULL in WorkSchedulePatternDay)
          dayShiftTemplateIds: editDays.map(dayCellToApi),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(json?.error ?? "SAVE_FAILED"));
      await loadAll();
      closeDayEditor();
    } finally {
      setEditSaving(false);
    }
  }

  async function createAssignment() {
    setSaving(true);
    try {
      const body: any = {
        scope,
        patternId,
        priority,
        validFromDayKey: validFromDayKey.trim() || null,
        validToDayKey: validToDayKey.trim() || null,
      };
      if (scope === "EMPLOYEE") body.employeeId = employeeId || null;
      if (scope === "EMPLOYEE_GROUP") body.employeeGroupId = employeeGroupId || null;
      if (scope === "EMPLOYEE_SUBGROUP") body.employeeSubgroupId = employeeSubgroupId || null;
      if (scope === "BRANCH") body.branchId = branchId || null;

      const res = await fetch("/api/policy/work-schedules/assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(String(json?.error ?? "SAVE_FAILED"));
      await loadAll();
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment(id: string) {
    if (!id) return;
    const res = await fetch(`/api/policy/work-schedules/assignments/${id}`, {
      method: "DELETE",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(String(json?.error ?? "DELETE_FAILED"));
    await loadAll();
  }

  return (
    <div className="grid w-full min-w-0 max-w-full gap-6 overflow-x-hidden">
      {/* Hero */}
      <div
        className={cx(
          "w-full min-w-0 max-w-full overflow-hidden rounded-2xl border p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]",
          toneStyles("violet").soft
        )}
      >
        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-lg font-extrabold tracking-tight text-zinc-900">Work Schedules</div>
              <PillBadge tone="violet">Period Work Schedule</PillBadge>
              {loading ? <PillBadge tone="warn">Yükleniyor</PillBadge> : null}
              {saving ? <PillBadge tone="warn">Kaydediliyor</PillBadge> : null}
              {editOpen ? <PillBadge tone="info">Gün Editörü Açık</PillBadge> : null}
            </div>
            <div className="mt-1 text-sm text-zinc-600 font-medium leading-relaxed">
              Dönemsel vardiya döngülerini (<b>pattern</b>) tanımlar ve kapsam bazlı (<b>Employee / Group / Subgroup / Branch</b>) atarsın.
              Bu sayfa yalnızca yönetim UI’ıdır; motor/hiyerarşi davranışı burada değişmez.
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={loadAll} disabled={loading} title="Verileri yenile">
              Yenile
              <span aria-hidden className="text-zinc-400">→</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 1) Pattern */}
      <section
        className={cx(
          "w-full min-w-0 max-w-full overflow-hidden rounded-2xl border p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]",
          toneStyles("info").soft
        )}
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold tracking-tight text-zinc-900">1) Pattern</h2>
              <PillBadge tone="info">VR01 / MV01</PillBadge>
            </div>
            <p className="text-sm text-zinc-600">
              Döngü uzunluğu ve referans güne göre gün bazlı vardiya dizisini oluşturur. (OFF: <span className="font-mono">NULL</span>)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PillBadge tone="neutral">{patterns.length} kayıt</PillBadge>
          </div>
        </div>

        {/* Create pattern form */}
        <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-12">
          <label className="grid gap-1.5 md:col-span-2 min-w-0">
            <span className="text-sm font-extrabold text-zinc-900">Kod</span>
            <input
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="VR01"
            />
          </label>

          <label className="grid gap-1.5 md:col-span-4 min-w-0">
            <span className="text-sm font-extrabold text-zinc-900">Ad</span>
            <input
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Beyaz Yaka"
            />
          </label>

          <label className="grid gap-1.5 md:col-span-2 min-w-0">
            <span className="text-sm font-extrabold text-zinc-900">Döngü (gün)</span>
            <input
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
              type="number"
              min={1}
              max={366}
              value={cycleLengthDays}
              onChange={(e) => setCycleLengthDays(Number(e.target.value))}
            />
          </label>

          <label className="grid gap-1.5 md:col-span-3 min-w-0">
            <span className="text-sm font-extrabold text-zinc-900">Referans gün</span>
            <input
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
              type="date"
              value={referenceDayKey}
              onChange={(e) => setReferenceDayKey(e.target.value)}
            />
          </label>

          <label className="grid gap-1.5 md:col-span-9 min-w-0">
            <span className="text-sm font-extrabold text-zinc-900">İlk sürüm için varsayılan vardiya</span>
            <select
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={defaultShiftTemplateId}
              onChange={(e) => setDefaultShiftTemplateId(e.target.value)}
            >
              <option value="">Seç…</option>
              {shiftOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {fmtShiftLabel(t)}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-zinc-600">
              Not: Gün bazlı edit ile OFF (Enterprise “B şıkkı”) aşağıdan yönetilir.
            </div>
          </label>

          <div className="md:col-span-3 flex items-end justify-end">
            <Button variant="primary" onClick={createPattern} disabled={saving || loading} title="Pattern oluştur">
              Pattern Oluştur
            </Button>
          </div>
        </div>

        {/* Pattern table */}
        <div className="mt-4 max-w-full overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
          <div className="max-h-[420px] overflow-y-auto">
            <table className="min-w-[980px] w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="text-left text-xs font-extrabold uppercase tracking-wide text-zinc-500">
                  <th className="border-b border-zinc-200 px-4 py-3">Kod</th>
                  <th className="border-b border-zinc-200 px-4 py-3">Ad</th>
                  <th className="border-b border-zinc-200 px-4 py-3">Döngü</th>
                  <th className="border-b border-zinc-200 px-4 py-3">Referans</th>
                  <th className="border-b border-zinc-200 px-4 py-3">Aktif</th>
                  <th className="border-b border-zinc-200 px-4 py-3 text-right">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {patterns.map((p) => (
                  <tr
                    key={p.id}
                    className={cx(
                      "border-b border-zinc-100 transition-colors",
                      "hover:bg-indigo-50/70"
                    )}
                  >
                    <td className="px-4 py-3 font-extrabold text-zinc-900">
                      <span className="inline-flex items-center rounded-lg bg-zinc-100 px-2 py-1 font-mono text-xs ring-1 ring-inset ring-zinc-200/70">
                        {p.code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-zinc-900">{p.name}</div>
                      <div className="text-[11px] text-zinc-500">id: <span className="font-mono">{p.id}</span></div>
                    </td>
                    <td className="px-4 py-3">
                      <PillBadge tone="neutral">{p.cycleLengthDays} gün</PillBadge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700">{toDayKey(p.referenceDate)}</td>
                    <td className="px-4 py-3">
                      <PillBadge tone={p.isActive ? "good" : "danger"}>{p.isActive ? "Aktif" : "Pasif"}</PillBadge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="secondary" onClick={() => openDayEditor(p)} title="Gün bazlı düzenle">
                        Gün bazlı edit
                      </Button>
                    </td>
                  </tr>
                ))}
                {patterns.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-zinc-500" colSpan={6}>
                      Kayıt yok.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Day Editor */}
      {editOpen && editPattern ? (
        <section
          className={cx(
            "w-full min-w-0 max-w-full overflow-hidden rounded-2xl border p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]",
            toneStyles("violet").soft
          )}
        >
          <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold tracking-tight text-zinc-900">Pattern Gün Editörü</h3>
                <PillBadge tone="violet">{editPattern.code}</PillBadge>
                <PillBadge tone="neutral">{editPattern.cycleLengthDays} gün</PillBadge>
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-800">{editPattern.name}</div>
              <div className="mt-1 text-xs text-zinc-600">
                Referans: <span className="font-mono">{toDayKey(editPattern.referenceDate)}</span> · OFF ={" "}
                <span className="font-mono">shiftTemplateId = NULL</span> (Policy’ye düşmez)
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-2">
              <Button variant="secondary" onClick={closeDayEditor} disabled={editSaving} title="Kapat">
                Kapat
              </Button>
              <Button variant="primary" onClick={saveDayEditor} disabled={editSaving} title="Kaydet">
                {editSaving ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </div>
          </div>

          {/* Quick Fill Toolbar */}
          <div className="mt-4 max-w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0 md:min-w-[260px]">
                <div className="text-xs font-extrabold uppercase tracking-wide text-zinc-500">Quick Fill</div>
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  value={bulkTemplateId}
                  onChange={(e) => setBulkTemplateId(String(e.target.value ?? ""))}
                  disabled={editSaving}
                >
                  <option value="">Vardiya seç…</option>
                  {shiftOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {fmtShiftLabel(t)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex min-w-0 flex-wrap gap-2">
                <Button variant="secondary" onClick={fillAllOff} disabled={editSaving || editDays.length === 0} title="Tüm günleri OFF yap">
                  Tüm günleri OFF
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => fillAllWithTemplate(bulkTemplateId)}
                  disabled={editSaving || !bulkTemplateId || editDays.length === 0}
                  title="Tüm günleri seçili vardiya yap"
                >
                  Tüm günleri seçili vardiya
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => fillWeekdaysTemplateWeekendOff(bulkTemplateId)}
                  disabled={editSaving || !bulkTemplateId || editDays.length === 0 || !editPattern}
                  title="Hafta içi seçili vardiya, hafta sonu OFF"
                >
                  Hafta içi seçili · Hafta sonu OFF
                </Button>
                <Button
                  variant="secondary"
                  onClick={copyFirstWeekToAllWeeks}
                  disabled={editSaving || editDays.length < 7 || !editPattern}
                  title="1. haftayı tüm döngüye kopyala"
                >
                  1. haftayı tüm döngüye kopyala
                </Button>
              </div>
            </div>

            <div className="mt-3 text-xs text-zinc-500">
              İpucu: Önce 1. haftayı doldur → sonra “1. haftayı kopyala”.
            </div>
          </div>

          {/* Day table */}
          <div className="mt-4 max-w-full overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
            <div className="max-h-[520px] overflow-y-auto">
              <table className="min-w-[980px] w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-white">
                 <tr className="text-left text-xs font-extrabold uppercase tracking-wide text-zinc-500">
                    <th className="border-b border-zinc-200 px-4 py-3">Gün</th>
                    <th className="border-b border-zinc-200 px-4 py-3">Durum</th>
                    <th className="border-b border-zinc-200 px-4 py-3">Vardiya</th>
                  </tr>
                </thead>
                <tbody>
                  {editDays.map((v, i) => {
                    const isOff = v == null;
                    const ref = editPattern ? toDayKey(editPattern.referenceDate) : "";
                    const wd = ref ? weekdayFromRef(ref, i) : 0;
                    const wdLabel = wd ? trWeekdayShort(wd) : "—";
                   const dateLabel = ref ? toDayKey(addDaysUtc(ref, i)) : "";
                    const weekNo = editPattern && editPattern.cycleLengthDays > 7 ? Math.floor(i / 7) + 1 : null;
                    const isWeekend = wd === 6 || wd === 7;

                    return (
                      <tr
                       key={i}
                        className={cx(
                          "border-b border-zinc-100 transition-colors",
                          isWeekend ? "bg-amber-50/40 hover:bg-amber-50/70" : "hover:bg-indigo-50/70"
                        )}
                     >
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-extrabold text-zinc-900">
                             {weekNo ? `Hafta ${weekNo} · ${wdLabel}` : wdLabel}
                            </div>
                            {isWeekend ? <PillBadge tone="warn">Hafta sonu</PillBadge> : <PillBadge tone="info">Hafta içi</PillBadge>}
                            {isOff ? <PillBadge tone="danger">OFF</PillBadge> : <PillBadge tone="good">Aktif</PillBadge>}
                         </div>
                          <div className="mt-1 text-[11px] text-zinc-600">
                            <span className="font-mono">{dateLabel}</span>
                           <span className="ml-2 text-zinc-400">•</span>
                            <span className="ml-2 font-mono text-zinc-500">Index: {i}</span>
                          </div>
                        </td>
                       <td className="px-4 py-3">
                          <label className="inline-flex items-center gap-3 text-sm font-semibold text-zinc-900">
                            <input
                             className="h-4 w-4 accent-indigo-600"
                              type="checkbox"
                              checked={isOff}
                             onChange={(e) => {
                                if (e.target.checked) {
                                  setDay(i, null);
                                } else {
                                  const first = shiftOptions[0]?.id ?? "";
                                  setDay(i, first || null);
                                }
                              }}
                           />
                            OFF
                          </label>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                           value={v ?? ""}
                            onChange={(e) => {
                              const next = String(e.target.value ?? "").trim();
                              setDay(i, next ? next : null);
                            }}
                            disabled={isOff}
                          >
                           <option value="">Seç…</option>
                            {shiftOptions.map((t) => (
                              <option key={t.id} value={t.id}>
                                {fmtShiftLabel(t)}
                              </option>
                            ))}
                          </select>
                        </td>
                     </tr>
                    );
                  })}
                  {editDays.length === 0 ? (
                    <tr>
                      <td className="px-4 py-10 text-center text-sm text-zinc-500" colSpan={3}>
                        Bu pattern için gün listesi boş.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {/* 2) Assignment */}
      <section className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold tracking-tight text-zinc-900">2) Atama</h2>
              <PillBadge tone="neutral">Employee / Group / Subgroup / Branch</PillBadge>
            </div>
            <p className="text-sm text-zinc-600">Pattern’i seçilen kapsama (scope) atarsın. Priority ve geçerlilik aralığı opsiyoneldir.</p>
          </div>
          <PillBadge tone="neutral">{assignments.length} kayıt</PillBadge>
        </div>

        <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-12">
          <label className="grid gap-1.5 md:col-span-3 min-w-0">
            <span className="text-sm font-extrabold text-zinc-900">Scope</span>
            <select
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="EMPLOYEE">Employee (Bireysel)</option>
              <option value="EMPLOYEE_GROUP">Employee Group</option>
              <option value="EMPLOYEE_SUBGROUP">Employee Subgroup</option>
              <option value="BRANCH">Branch</option>
            </select>
          </label>

          <label className="grid gap-1.5 md:col-span-4 min-w-0">
            <span className="text-sm font-extrabold text-zinc-900">Pattern</span>
            <select
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={patternId}
              onChange={(e) => setPatternId(e.target.value)}
            >
              <option value="">Seç…</option>
              {patternOptions.map((p) => (
                <option key={p.id} value={p.id}>
                 {p.code} — {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 md:col-span-2 min-w-0">
            <span className="text-sm font-extrabold text-zinc-900">Priority</span>
            <input
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
              type="number"
             value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
          </label>

          <div className="md:col-span-3 flex items-end justify-end">
            <Button variant="primary" onClick={createAssignment} disabled={saving || loading} title="Atama yap">
              Atama Yap
            </Button>
          </div>
        </div>

        <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-12">
          {/* Target selectors */}
          {scope === "EMPLOYEE" ? (
            <div className="md:col-span-7">
              <div className="flex items-center gap-2">
                <div className="text-sm font-extrabold text-zinc-900">Personel</div>
                {employeeLoading ? <PillBadge tone="warn">Yükleniyor</PillBadge> : null}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Ara: sicil / ad / soyad"
                  value={employeeQuery}
                  onChange={(e) => setEmployeeQuery(e.target.value)}
                  disabled={saving || loading}
                />
                <Button variant="secondary" onClick={() => loadEmployees(employeeQuery)} disabled={saving || loading} title="Ara">
                  Ara
                </Button>
              </div>
              <select
                className="mt-2 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                disabled={saving || loading || employeeLoading}
              >
                <option value="">{employeeLoading ? "Yükleniyor…" : "Seç…"}</option>
                {employees.map((emp) => {
                  const full = `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim();
                  return (
                    <option key={emp.id} value={emp.id}>
                      {emp.employeeCode} — {full || "—"}
                    </option>
                  );
                })}
              </select>
              {selectedEmployeeId ? (
                <div className="mt-1 text-xs text-zinc-500">
                  id: <span className="font-mono">{selectedEmployeeId}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {scope === "EMPLOYEE_GROUP" ? (
            <div className="md:col-span-7">
              <div className="text-sm font-extrabold text-zinc-900">Employee Group</div>
              <select
                className="mt-2 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                disabled={saving || loading}
              >
                <option value="">Seç…</option>
                {groupOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code} — {g.name}
                  </option>
                ))}
              </select>
              {selectedGroupId ? (
                <div className="mt-1 text-xs text-zinc-500">
                  id: <span className="font-mono">{selectedGroupId}</span>
                </div>
              ) : null}
            </div>
          ) : null}
          {scope === "EMPLOYEE_SUBGROUP" ? (
            <div className="md:col-span-7">
              <div className="text-sm font-extrabold text-zinc-900">Employee Subgroup</div>
              <select
                className="mt-2 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={selectedSubgroupId}
                onChange={(e) => setSelectedSubgroupId(e.target.value)}
                disabled={saving || loading}
              >
                <option value="">Seç…</option>
                {subgroupOptions.map((sg) => (
                  <option key={sg.id} value={sg.id}>
                    {sg.code} — {sg.name}
                    {sg.employeeGroup ? ` (${sg.employeeGroup.code})` : ""}
                  </option>
                ))}
              </select>
              {selectedSubgroupId ? (
                <div className="mt-1 text-xs text-zinc-500">
                  id: <span className="font-mono">{selectedSubgroupId}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {scope === "BRANCH" ? (
            <div className="md:col-span-7">
              <div className="text-sm font-extrabold text-zinc-900">Branch</div>
              <select
                className="mt-2 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                disabled={saving || loading}
              >
                <option value="">Seç…</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
              {selectedBranchId ? (
                <div className="mt-1 text-xs text-zinc-500">
                  id: <span className="font-mono">{selectedBranchId}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Validity */}
          <div className="md:col-span-5 grid grid-cols-2 gap-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-extrabold text-zinc-900">Valid From</span>
              <input
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
                type="date"
                value={validFromDayKey}
                onChange={(e) => setValidFromDayKey(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-extrabold text-zinc-900">Valid To</span>
              <input
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
                type="date"
                value={validToDayKey}
                onChange={(e) => setValidToDayKey(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-zinc-500">
          Not: Scope seçimine göre hedef (Employee / Group / Subgroup / Branch) listeden seçilir. Seçilen kaydın id’si audit/debug için altta görünür.
        </div>

        {/* Assignment table */}
        <div className="mt-4 max-w-full overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
          <div className="max-h-[420px] overflow-y-auto">
            <table className="min-w-[1180px] w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="text-left text-xs font-extrabold uppercase tracking-wide text-zinc-500">
                  <th className="border-b border-zinc-200 px-4 py-3">Scope</th>
                  <th className="border-b border-zinc-200 px-4 py-3">Pattern</th>
                  <th className="border-b border-zinc-200 px-4 py-3">Target</th>
                  <th className="border-b border-zinc-200 px-4 py-3">Valid</th>
                  <th className="border-b border-zinc-200 px-4 py-3">Priority</th>
                  <th className="border-b border-zinc-200 px-4 py-3 text-right">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-b border-zinc-100 hover:bg-indigo-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <PillBadge tone="neutral">{String(a.scope ?? "")}</PillBadge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-zinc-900">
                        {a.pattern?.code ?? "—"} — {a.pattern?.name ?? ""}
                      </div>
                      <div className="text-[11px] text-zinc-500">id: <span className="font-mono">{a.id}</span></div>
                    </td>
                    <td className="px-4 py-3">
                      {a.employee ? (
                        <div className="space-y-0.5">
                          <div className="inline-flex items-center gap-2">
                            <span className="rounded-lg bg-zinc-100 px-2 py-1 font-mono text-xs font-extrabold text-zinc-900 ring-1 ring-inset ring-zinc-200/70">
                              {a.employee.employeeCode}
                            </span>
                            <span className="font-semibold text-zinc-900">{`${a.employee.firstName ?? ""} ${a.employee.lastName ?? ""}`.trim() || "—"}</span>
                          </div>
                        </div>
                      ) : a.employeeSubgroup ? (
                        <div className="space-y-0.5">
                          <div className="font-semibold text-zinc-900">
                            {a.employeeSubgroup.code} — {a.employeeSubgroup.name}
                          </div>
                          {a.employeeSubgroup.employeeGroup ? (
                            <div className="text-[11px] text-zinc-500">Group: {a.employeeSubgroup.employeeGroup.code}</div>
                          ) : null}
                        </div>
                      ) : a.employeeGroup ? (
                        <div className="font-semibold text-zinc-900">
                          {a.employeeGroup.code} — {a.employeeGroup.name}
                        </div>
                      ) : a.branch ? (
                        <div className="font-semibold text-zinc-900">
                          {a.branch.code} — {a.branch.name}
                        </div>
                      ) : (
                        <span className="text-zinc-600">
                          {a.employeeGroupId || a.employeeSubgroupId || a.branchId || a.employeeId || "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700">
                      {(a.validFrom ? toDayKey(a.validFrom) : "—") + " → " + (a.validTo ? toDayKey(a.validTo) : "—")}
                    </td>
                    <td className="px-4 py-3">
                      <PillBadge tone="info">{a.priority ?? 0}</PillBadge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="danger" onClick={() => removeAssignment(a.id)} title="Atamayı sil">
                        Sil
                      </Button>
                    </td>
                  </tr>
                ))}
                {assignments.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-zinc-500" colSpan={6}>
                      Kayıt yok.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}