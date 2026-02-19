"use client";

import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";

type Tone = "neutral" | "info" | "good" | "warn" | "danger" | "violet";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  const map: Record<Tone, string> = {
    neutral: "bg-zinc-100 text-zinc-700 ring-zinc-200/60",
    info: "bg-sky-50 text-sky-700 ring-sky-200/60",
    good: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
    warn: "bg-amber-50 text-amber-900 ring-amber-200/60",
    danger: "bg-rose-50 text-rose-800 ring-rose-200/60",
    violet: "bg-violet-50 text-violet-800 ring-violet-200/60",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset shadow-sm uppercase tracking-tight",
        map[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

function Card({
  tone = "neutral",
  title,
  subtitle,
  right,
  children,
  className,
}: {
  tone?: Tone;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const toneBg: Record<Tone, string> = {
    neutral: "from-white to-zinc-50/50",
    info: "from-white to-sky-50/30",
    good: "from-white to-emerald-50/30",
    warn: "from-white to-amber-50/30",
    danger: "from-white to-rose-50/30",
    violet: "from-white to-violet-50/30",
  };
  return (
    <div
      className={cx(
        "rounded-2xl border border-zinc-200/70 bg-gradient-to-b p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] min-w-0 transition-all duration-300 hover:shadow-md",
        toneBg[tone],
        className
      )}
    >
      {(title || subtitle || right) ? (
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-zinc-100 pb-4">
          <div className="min-w-0">
            {title ? (
              <div className="text-lg font-bold text-zinc-900 leading-tight tracking-tight">
                {title}
              </div>
            ) : null}
            {subtitle ? (
              <div className="mt-1 text-sm text-zinc-500 font-medium leading-relaxed italic">
                {subtitle}
              </div>
            ) : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
     ) : null}
      {children}
    </div>
  );
}

function Button({
  variant = "secondary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all active:scale-95 " +
    "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm";
  const map = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-600/20",
    secondary: "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900",
    ghost: "bg-transparent text-zinc-600 hover:bg-zinc-100 border border-transparent",
    danger: "bg-rose-600 text-white hover:bg-rose-700 border border-rose-600/20",
  } as const;
  return <button className={cx(base, map[variant], className)} {...props} />;
}

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white/80 px-3 py-2.5 text-sm shadow-sm font-medium transition-all " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white";

type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  branch?: { id: string; name: string } | null;
};

type ShiftTemplate = {
  id: string;
  signature: string;
  startTime: string;
  endTime: string;
  spansMidnight: boolean;
  isActive: boolean;
};

type PlannerPlan = {
  employeeId: string;
  weekTemplateId: string | null;
  dayTemplateIds: Array<string | null>; // length 7 (Mon..Sun)
};

function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getThisWeeksMondayISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7; // Mon->0, Sun->6
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - diffToMonday);
  return toISODate(monday);
}

function nameOf(e: Employee) {
  return `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim();
}

function weekdayLabel(i: number) {
  return ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"][i] ?? "";
}

function weekdayHeadClass(i: number) {
  // 0..4 hafta içi, 5..6 hafta sonu
  return i >= 5
    ? "bg-amber-50/70 text-amber-800"
    : "bg-sky-50/60 text-sky-800";
}

function weekdayCellClass(i: number) {
  // body’de çok daha hafif tint
  return i >= 5 ? "bg-amber-50/30" : "bg-sky-50/20";
}

export default function ShiftPlannerClient() {
  const [weekStartDate, setWeekStartDate] = useState(getThisWeeksMondayISO);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [plansByEmployeeId, setPlansByEmployeeId] = useState<Record<string, PlannerPlan>>({});
  const [dirtyEmployeeIds, setDirtyEmployeeIds] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState<string>("");
  const [onlyActive, setOnlyActive] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // sticky layout jump fix (optional but nice)
  // (no behavior change)

  const isWeekStartMonday = useMemo(() => {
    const dt = DateTime.fromISO(weekStartDate);
    return dt.isValid && dt.weekday === 1;
  }, [weekStartDate]);

  const templateLabelById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of templates) {
      m[t.id] = `${t.signature} (${t.startTime}-${t.endTime}${t.spansMidnight ? "+1" : ""})${t.isActive ? "" : " [pasif]"}`;
    }
    return m;
  }, [templates]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = onlyActive ? employees.filter((e) => e.isActive) : employees;
    if (!q) return base;
    return base.filter((e) => {
      const code = (e.employeeCode ?? "").toLowerCase();
      const nm = nameOf(e).toLowerCase();
      const br = (e.branch?.name ?? "").toLowerCase();
      return code.includes(q) || nm.includes(q) || br.includes(q);
    });
  }, [employees, onlyActive, search]);

  const dirtyCount = useMemo(() => Object.values(dirtyEmployeeIds).filter(Boolean).length, [dirtyEmployeeIds]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 7000);
    return () => window.clearTimeout(t);
  }, [error]);

  async function loadAll(forWeekStart: string) {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const [empRes, tplRes, planRes] = await Promise.all([
        fetch("/api/employees?pageSize=200", { cache: "no-store", credentials: "include" }),
        fetch("/api/shift-templates?includeInactive=1", { cache: "no-store", credentials: "include" }),
        fetch(`/api/shift-assignments/planner?weekStartDate=${encodeURIComponent(forWeekStart)}`, {
          cache: "no-store",
          credentials: "include",
        }),
      ]);

      if (!empRes.ok) throw new Error(`GET /api/employees failed: ${empRes.status}`);
      if (!tplRes.ok) throw new Error(`GET /api/shift-templates failed: ${tplRes.status}`);

      const empJson = await empRes.json();
      const tplJson = await tplRes.json();
      const planJson = await planRes.json().catch(() => ({}));

      // API contracts:
      // - /api/employees => { items: Employee[] }
      // - /api/shift-templates => { items: ShiftTemplate[] }
      setEmployees(Array.isArray(empJson?.items) ? empJson.items : []);
      setTemplates(Array.isArray(tplJson?.items) ? tplJson.items : []);

      if (!planRes.ok) {
        setPlansByEmployeeId({});
        setDirtyEmployeeIds({});
        setError(planJson?.error ? String(planJson.error) : `Planner load failed (${planRes.status})`);
        return;
      }
      setPlansByEmployeeId(planJson.plansByEmployeeId ?? {});
      setDirtyEmployeeIds({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!weekStartDate) return;
    if (!DateTime.fromISO(weekStartDate).isValid) return;
    if (!isWeekStartMonday) return;
    loadAll(weekStartDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartDate, isWeekStartMonday]);

  function ensurePlan(employeeId: string): PlannerPlan {
    const existing = plansByEmployeeId[employeeId];
    if (existing) return existing;
    return { employeeId, weekTemplateId: null, dayTemplateIds: [null, null, null, null, null, null, null] };
  }

  function markDirty(employeeId: string) {
    setDirtyEmployeeIds((prev) => ({ ...prev, [employeeId]: true }));
  }

  function setWeekTemplate(employeeId: string, nextId: string | null) {
    setPlansByEmployeeId((prev) => {
      const plan = ensurePlan(employeeId);
      return {
        ...prev,
        [employeeId]: { ...plan, weekTemplateId: nextId },
      };
    });
    markDirty(employeeId);
  }

  function setDayTemplate(employeeId: string, dayIndex: number, nextId: string | null) {
    setPlansByEmployeeId((prev) => {
      const plan = ensurePlan(employeeId);
      const copy = [...plan.dayTemplateIds];
      copy[dayIndex] = nextId;
      return {
        ...prev,
        [employeeId]: { ...plan, dayTemplateIds: copy },
      };
    });
    markDirty(employeeId);
  }

  async function save() {
    if (saving) return;
    if (!isWeekStartMonday) {
      setError("WEEK_START_MUST_BE_MONDAY");
      return;
    }
    const dirtyIds = Object.entries(dirtyEmployeeIds)
      .filter(([, v]) => v)
      .map(([id]) => id);
    if (dirtyIds.length === 0) {
      setNotice("Değişiklik yok.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        weekStartDate,
        plans: dirtyIds.map((employeeId) => {
          const p = ensurePlan(employeeId);
          return {
            employeeId,
            weekTemplateId: p.weekTemplateId,
            dayTemplateIds: p.dayTemplateIds,
          };
        }),
      };

      const res = await fetch("/api/shift-assignments/planner", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ? String(json.error) : `SAVE_FAILED_${res.status}`);
        return;
      }
      setNotice(`Kaydedildi. Güncellenen: ${json.updated ?? dirtyIds.length}`);
      // Reload to reflect any server-side normalization
      await loadAll(weekStartDate);
    } finally {
      setSaving(false);
    }
  }

  async function copyLastWeek() {
    if (copying) return;
    if (!isWeekStartMonday) {
      setError("WEEK_START_MUST_BE_MONDAY");
      return;
    }
    const dt = DateTime.fromISO(weekStartDate);
    if (!dt.isValid) {
      setError("INVALID_WEEK_START");
      return;
    }

    const srcWeekStart = dt.minus({ weeks: 1 }).toISODate();
    if (!srcWeekStart) {
      setError("COPY_SRC_WEEK_INVALID");
      return;
    }

    setCopying(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/shift-assignments/planner?weekStartDate=${encodeURIComponent(srcWeekStart)}`,
        { cache: "no-store", credentials: "include" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ? String(json.error) : `COPY_LOAD_FAILED_${res.status}`);
        return;
      }

      const srcPlans: Record<string, PlannerPlan> = json?.plansByEmployeeId ?? {};
      const srcEmployeeIds = new Set(Object.keys(srcPlans));
      if (srcEmployeeIds.size === 0) {
        setNotice("Geçen hafta için plan bulunamadı.");
        return;
      }

      // Apply only for employees that exist in current employee list (avoid stale ids)
      // IMPORTANT: do NOT compute appliedIds inside setState updater. React may execute the updater later,
      // which would leave appliedIds empty here and therefore Save would say "Değişiklik yok".
      const currentEmployeeIds = new Set(employees.map((e) => e.id));
      const appliedIds: string[] = [];

      const patchPlans: Record<string, PlannerPlan> = {};

      for (const [employeeId, plan] of Object.entries(srcPlans)) {
        if (!currentEmployeeIds.has(employeeId)) continue;

        const dayTemplateIds =
          Array.isArray(plan.dayTemplateIds) && plan.dayTemplateIds.length === 7
            ? [...plan.dayTemplateIds]
            : [null, null, null, null, null, null, null];

        patchPlans[employeeId] = {
          employeeId,
          weekTemplateId: plan.weekTemplateId ?? null,
          dayTemplateIds,
        };
        appliedIds.push(employeeId);
      }

      if (appliedIds.length === 0) {
        setNotice("Geçen hafta planı bulundu ama mevcut personel listesiyle eşleşmedi.");
        return;
      }

      setPlansByEmployeeId((prev) => ({ ...prev, ...patchPlans }));
      
      // Mark all applied employees as dirty (SAP behavior: copy then Save)
      setDirtyEmployeeIds((prev) => {
        const next = { ...prev };
        for (const id of appliedIds) next[id] = true;
        return next;
      });

      setNotice(`Geçen hafta kopyalandı. Etkilenen: ${appliedIds.length}. Kaydetmeyi unutma.`);
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="grid gap-6 w-full max-w-full overflow-x-hidden p-2 md:p-6 animate-in fade-in duration-500">
      <Card
        tone="violet"
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span>Shift Planner</span>
            <Badge tone="violet">Haftalık Plan • Week + Day Override</Badge>
            {loading ? <Badge tone="info">Yükleniyor…</Badge> : null}
            {dirtyCount > 0 ? <Badge tone="warn">Değişiklik: {dirtyCount}</Badge> : <Badge tone="good">Temiz</Badge>}
          </div>
        }
        subtitle="Week Template ataması + istersen gün bazında override. Değişiklikler kaydetmeden uygulanmaz."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={copyLastWeek}
              disabled={loading || saving || copying || !isWeekStartMonday}
              title="Bir önceki haftanın planını kopyala (kaydetmez)"
            >
              {copying ? "Kopyalanıyor…" : "↺ Geçen Haftayı Kopyala"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => loadAll(weekStartDate)}
              disabled={loading || !isWeekStartMonday}
              title="Yenile"
            >
              Yenile
            </Button>
            <Button
              variant="primary"
              onClick={save}
              disabled={saving || loading || !isWeekStartMonday}
              title="Kaydet"
            >
              {saving ? "Kaydediliyor…" : `Kaydet${dirtyCount > 0 ? ` (${dirtyCount})` : ""}`}
            </Button>
          </div>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold text-zinc-400 uppercase ml-1 tracking-wider">
                Hafta Başlangıcı (Pazartesi)
              </span>
              <input
                className={cx(
                  inputClass,
                  "h-11",
                  !isWeekStartMonday && "border-rose-300 bg-rose-50 focus:ring-rose-500"
                )}
                type="date"
                value={weekStartDate}
                onChange={(e) => setWeekStartDate(e.target.value)}
              />
              <div
                className="h-4 text-[11px] font-semibold text-rose-700"
                style={{ visibility: isWeekStartMonday ? "hidden" : "visible" }}
              >
                Hafta başlangıcı Pazartesi olmalı.
              </div>
            </label>

            <label className="grid gap-1.5 md:col-span-1 lg:col-span-2">
              <span className="text-[11px] font-bold text-zinc-400 uppercase ml-1 tracking-wider">
                Arama (Kod / İsim / Şube)
              </span>
              <input
                className={cx(inputClass, "h-11")}
                placeholder="E1001, Ahmet, İstanbul…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="h-4 text-[11px] text-zinc-500">
                İpucu: Şube adında da arar.
              </div>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label
              className={cx(
                "inline-flex h-11 select-none items-center gap-2 rounded-xl border px-3 text-sm font-semibold shadow-sm",
                onlyActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-zinc-200 bg-white text-zinc-700"
              )}
              title="Kapalıysa pasif personeller de görünür"
            >
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
                className="h-4 w-4"
              />
              Sadece aktif
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info">{loading ? "Yükleniyor…" : `Toplam: ${filteredEmployees.length}`}</Badge>
              <Badge tone="neutral">Week: {weekStartDate}</Badge>
              <Badge tone="warn">Day override, Week’i ezer</Badge>
            </div>
          </div>

          {(notice || error) ? (
            <div className="grid gap-2">
              {notice ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  {notice}
                </div>
              ) : null}
              {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {error}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      <Card
        tone="neutral"
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span>Plan Tablosu</span>
            <Badge tone="info">{loading ? "Yükleniyor…" : `${filteredEmployees.length} personel`}</Badge>
          </div>
        }
        subtitle="Satır sarı ise değişmiş demektir (dirty). Kaydetmeden DB’ye yazılmaz."
      >
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-[1180px] w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-700 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-zinc-500 uppercase text-[11px] tracking-widest">Kod</th>
                <th className="px-4 py-3 text-left font-bold text-zinc-500 uppercase text-[11px] tracking-widest">Personel</th>
                <th className="px-4 py-3 text-left font-bold text-zinc-500 uppercase text-[11px] tracking-widest">Şube</th>
                <th className="px-4 py-3 text-left font-bold uppercase text-[11px] tracking-widest bg-violet-50/60 text-violet-800">
                  Haftalık Çalışma Çizelgesi
                </th>
                {Array.from({ length: 7 }).map((_, i) => (
                  <th
                    key={i}
                    className={cx(
                      "px-4 py-3 text-left font-bold uppercase text-[11px] tracking-widest",
                      weekdayHeadClass(i)
                    )}
                    title={i >= 5 ? "Hafta sonu" : "Hafta içi"}
                  >
                    {weekdayLabel(i)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredEmployees.map((e) => {
                const p = ensurePlan(e.id);
                const dirty = !!dirtyEmployeeIds[e.id];
                return (
                  <tr
                    key={e.id}
                    className={cx(
                      "group transition-colors border-l-4",
                      dirty ? "bg-amber-50/60" : "bg-white",
                      dirty ? "border-amber-400" : "border-transparent",
                      "hover:bg-zinc-50/60"
                    )}
                    title={dirty ? "Değişti (Kaydet bekliyor)" : ""}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-bold text-zinc-700">
                      {e.employeeCode}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="min-w-0">
                          <div className="font-bold text-zinc-900 truncate">{nameOf(e)}</div>
                          <div className="text-[11px] text-zinc-500">
                            {e.isActive ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Aktif
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                                Pasif
                              </span>
                            )}
                            {dirty ? <span className="ml-2 font-bold text-amber-700">• Değişti</span> : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {e.branch?.name ? (
                        <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                          {e.branch.name}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className={cx(inputClass, "h-10 w-72 font-semibold")}
                        value={p.weekTemplateId ?? ""}
                        onChange={(ev) => setWeekTemplate(e.id, ev.target.value ? ev.target.value : null)}
                      >
                        <option value="">(inherit / none)</option>
                        <optgroup label="Aktif Template'ler">
                          {templates.filter((t) => t.isActive).map((t) => (
                            <option key={t.id} value={t.id}>
                              {templateLabelById[t.id] ?? t.signature}
                            </option>
                          ))}
                        </optgroup>
                        {templates.some((t) => !t.isActive) ? (
                          <optgroup label="Pasif Template'ler">
                            {templates.filter((t) => !t.isActive).map((t) => (
                              <option key={t.id} value={t.id}>
                                {templateLabelById[t.id] ?? t.signature}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                      </select>
                    </td>
                    {p.dayTemplateIds.map((tplId, idx) => (
                      <td
                        key={idx}
                        className={cx(
                          "px-4 py-3 transition-colors",
                          weekdayCellClass(idx),
                          "group-hover:bg-zinc-50/60"
                        )}
                      >
                        <select
                          className={cx(inputClass, "h-10 w-56")}
                          value={tplId ?? ""}
                          onChange={(ev) => setDayTemplate(e.id, idx, ev.target.value ? ev.target.value : null)}
                          title="Day override (boş = week template/policy)"
                        >
                          <option value="">(inherit)</option>
                          <optgroup label="Aktif Template'ler">
                            {templates.filter((t) => t.isActive).map((t) => (
                              <option key={t.id} value={t.id}>
                                {templateLabelById[t.id] ?? t.signature}
                              </option>
                            ))}
                          </optgroup>
                          {templates.some((t) => !t.isActive) ? (
                            <optgroup label="Pasif Template'ler">
                              {templates.filter((t) => !t.isActive).map((t) => (
                                <option key={t.id} value={t.id}>
                                  {templateLabelById[t.id] ?? t.signature}
                                </option>
                              ))}
                            </optgroup>
                          ) : null}
                        </select>
                      </td>
                    ))}
                  </tr>
                );
              })}

              {filteredEmployees.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-zinc-500" colSpan={4 + 7}>
                    Personel bulunamadı.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}