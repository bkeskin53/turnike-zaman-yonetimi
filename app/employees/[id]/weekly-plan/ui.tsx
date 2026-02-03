"use client";

import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";

// Convert minutes to HH:mm string. Returns empty string if value is null or undefined.
function minutesToHHMM(mins: number | null | undefined): string {
  if (mins === null || mins === undefined || isNaN(mins)) return "";
  const hh = Math.floor(mins / 60)
    .toString()
    .padStart(2, "0");
  const mm = (mins % 60)
    .toString()
    .padStart(2, "0");
  return `${hh}:${mm}`;
}

// Compute the Monday (week start) in ISO YYYY-MM-DD for a given date, using policy timezone.
function computeWeekStart(date: Date, tz: string): string {
  const dt = DateTime.fromJSDate(date, { zone: tz }).startOf("day");
  const monday = dt.minus({ days: dt.weekday - 1 });
  return monday.toISODate()!;
}

// Add days to an ISO date string (YYYY-MM-DD), using policy timezone.
function addDays(dateStr: string, days: number, tz: string): string {
  const dt = DateTime.fromISO(dateStr, { zone: tz }).startOf("day").plus({ days });
  return dt.toISODate()!;
}

// Days keys and their human-readable Turkish names
const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const dayNames = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
] as const;

// Type for time fields state
type TimesState = {
  monStart: string;
  monEnd: string;
  tueStart: string;
  tueEnd: string;
  wedStart: string;
  wedEnd: string;
  thuStart: string;
  thuEnd: string;
  friStart: string;
  friEnd: string;
  satStart: string;
  satEnd: string;
  sunStart: string;
  sunEnd: string;
  };

type ShiftTemplateItem = {
  id: string;
  signature: string;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  spansMidnight: boolean;
};

export default function WeeklyPlanClient({ id }: { id: string }) {
const [timezone, setTimezone] = useState<string>("Europe/Istanbul");
 const [weekStart, setWeekStart] = useState<string>(() =>
    computeWeekStart(new Date(), "Europe/Istanbul")
  );
  const [times, setTimes] = useState<TimesState>(() => ({
    monStart: "",
    monEnd: "",
    tueStart: "",
    tueEnd: "",
    wedStart: "",
    wedEnd: "",
  thuStart: "",
    thuEnd: "",
    friStart: "",
    friEnd: "",
    satStart: "",
    satEnd: "",
    sunStart: "",
    sunEnd: "",
  }));

  const [defaultStart, setDefaultStart] = useState<string>("");
  const [defaultEnd, setDefaultEnd] = useState<string>("");
  // Stage 3: week-level default template + day overrides
  const [templates, setTemplates] = useState<ShiftTemplateItem[]>([]);
  const [weekTemplateId, setWeekTemplateId] = useState<string>("NONE");
  const [dayMode, setDayMode] = useState<Record<(typeof dayKeys)[number], string>>({
    mon: "DEFAULT",
    tue: "DEFAULT",
    wed: "DEFAULT",
    thu: "DEFAULT",
    fri: "DEFAULT",
    sat: "DEFAULT",
    sun: "DEFAULT",
  });
  const [loadingPlan, setLoadingPlan] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [templateQuery, setTemplateQuery] = useState<string>("");
  const [highlightDays, setHighlightDays] = useState<Record<string, boolean>>({});

  // ------------------------------------------------------------
  // Week summary (UI only)
  const weekSummary = useMemo(() => {
    let weekTemplateDays = 0;
    let policyDays = 0;
    let dayTemplateDays = 0;
    let customDays = 0;
    let overnightDays = 0;

    dayKeys.forEach((key) => {
      const mode = dayMode[key];

      const isExplicitDayTemplate = !!mode && mode !== "DEFAULT" && mode !== "CUSTOM";
      const isWeekTemplateDefault = mode === "DEFAULT" && weekTemplateId !== "NONE";
      const isPolicyDefault = mode === "DEFAULT" && (weekTemplateId === "NONE" || !weekTemplateId);
      const isCustom = mode === "CUSTOM";

      const overnightByDayTemplate = isOvernightMode(mode);
      const overnightByWeekTemplate =
        mode === "DEFAULT" && weekTemplateId !== "NONE" ? !!getWeekTemplate()?.spansMidnight : false;
      // For CUSTOM, we can infer overnight from displayed times
      const startKey = `${key}Start` as keyof TimesState;
      const endKey = `${key}End` as keyof TimesState;
      const s = (times[startKey] as string) || "";
      const e = (times[endKey] as string) || "";
      const overnightByCustom = isCustom && s && e ? e <= s : false;

      const isOvernight = overnightByDayTemplate || overnightByWeekTemplate || overnightByCustom;

      if (isExplicitDayTemplate) dayTemplateDays += 1;
      else if (isCustom) customDays += 1;
      else if (isWeekTemplateDefault) weekTemplateDays += 1;
      else if (isPolicyDefault) policyDays += 1;

      if (isOvernight) overnightDays += 1;
    });

    return { weekTemplateDays, policyDays, dayTemplateDays, customDays, overnightDays };
  }, [dayMode, weekTemplateId, times, templates]);
  
  function classifyDay(key: (typeof dayKeys)[number]) {
    const mode = dayMode[key];
    const isExplicitDayTemplate = !!mode && mode !== "DEFAULT" && mode !== "CUSTOM";
    const isWeekTemplateDefault = mode === "DEFAULT" && weekTemplateId !== "NONE";
    const isPolicyDefault = mode === "DEFAULT" && (weekTemplateId === "NONE" || !weekTemplateId);
    const isCustom = mode === "CUSTOM";

    const overnightByDayTemplate = isOvernightMode(mode);
    const overnightByWeekTemplate =
      mode === "DEFAULT" && weekTemplateId !== "NONE" ? !!getWeekTemplate()?.spansMidnight : false;
    const startKey = `${key}Start` as keyof TimesState;
    const endKey = `${key}End` as keyof TimesState;
    const s = (times[startKey] as string) || "";
    const e = (times[endKey] as string) || "";
    const overnightByCustom = isCustom && s && e ? e <= s : false;

    const isOvernight = overnightByDayTemplate || overnightByWeekTemplate || overnightByCustom;

    return {
      isExplicitDayTemplate,
      isWeekTemplateDefault,
      isPolicyDefault,
      isCustom,
      isOvernight,
    };
  }

  function scrollToDays(keys: (typeof dayKeys)[number][]) {
    if (!keys.length) return;
    // highlight
    const next: Record<string, boolean> = {};
    keys.forEach((k) => (next[k] = true));
    setHighlightDays(next);
    // scroll to first match
    const el = document.querySelector(`[data-day-row="${keys[0]}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // auto clear highlight
    window.setTimeout(() => setHighlightDays({}), 1800);
  }

  function onSummaryClick(kind: "WEEK" | "POLICY" | "DAY_TEMPLATE" | "CUSTOM" | "OVERNIGHT") {
    const keys: (typeof dayKeys)[number][] = [];
    dayKeys.forEach((k) => {
      const c = classifyDay(k);
      if (kind === "WEEK" && c.isWeekTemplateDefault) keys.push(k);
      if (kind === "POLICY" && c.isPolicyDefault) keys.push(k);
      if (kind === "DAY_TEMPLATE" && c.isExplicitDayTemplate) keys.push(k);
      if (kind === "CUSTOM" && c.isCustom) keys.push(k);
      if (kind === "OVERNIGHT" && c.isOvernight) keys.push(k);
    });
    scrollToDays(keys);
  }

  async function loadTemplates() {
    try {
      const res = await fetch(`/api/shift-templates`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const items = Array.isArray((data as any)?.items) ? (data as any).items : [];
      setTemplates(items);
    } catch {
      // ignore
    }
  }

  function getTemplateById(tplId: string | null | undefined): ShiftTemplateItem | null {
    if (!tplId) return null;
    return templates.find((t) => t.id === tplId) ?? null;
  }

  function getWeekTemplate(): ShiftTemplateItem | null {
    if (!weekTemplateId || weekTemplateId === "NONE") return null;
    return getTemplateById(weekTemplateId);
  }

  function getFilteredTemplates(): ShiftTemplateItem[] {
    const q = templateQuery.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => {
      const sig = (t.signature ?? "").toLowerCase();
      return sig.includes(q);
    });
  }
  
  function signatureAlreadyHasPlus1(sig: string): boolean {
    // Handle common forms: "+1" or "(+1)" anywhere in signature
    return /\(\s*\+1\s*\)|\+1/.test(sig);
  }

  function formatTemplateLabel(t: ShiftTemplateItem): string {
    if (!t.spansMidnight) return t.signature;
    if (signatureAlreadyHasPlus1(t.signature)) return t.signature;
    return `${t.signature} (+1)`;
  }

  function isOvernightMode(mode: string): boolean {
    if (!mode || mode === "DEFAULT" || mode === "CUSTOM") return false;
    const tpl = getTemplateById(mode);
    return !!tpl?.spansMidnight;
  }

  function getTemplatesForSelect(selectedId?: string | null): ShiftTemplateItem[] {
    const list = getFilteredTemplates();
    if (!selectedId) return list;
    // selectedId may be "NONE" or special mode strings; only handle real template ids
    if (selectedId === "NONE" || selectedId === "DEFAULT" || selectedId === "CUSTOM") return list;
    const already = list.some((t) => t.id === selectedId);
    if (already) return list;
    const selected = getTemplateById(selectedId);
    if (!selected) return list;
    // Ensure selected template remains visible even when filtered out
    return [selected, ...list];
  }

  function getDefaultDayLabel(): string {
    return weekTemplateId && weekTemplateId !== "NONE"
      ? "(Default \u2192 Week Template)"
      : "(Default \u2192 Policy)";
  }

  function getDisplayedTime(day: (typeof dayKeys)[number], kind: "start" | "end"): string {
    const mode = dayMode[day];
    // Day override template
    if (mode && mode !== "DEFAULT" && mode !== "CUSTOM") {
      const tpl = getTemplateById(mode);
      if (tpl) return kind === "start" ? tpl.startTime : tpl.endTime;
    }

    // Default (week template -> policy)
    if (mode === "DEFAULT") {
      const wk = getWeekTemplate();
      if (wk) return kind === "start" ? wk.startTime : wk.endTime;
      return kind === "start" ? defaultStart : defaultEnd;
    }

    // Custom: state values
    const startKey = `${day}Start` as keyof TimesState;
    const endKey = `${day}End` as keyof TimesState;
    return kind === "start" ? (times[startKey] as string) : (times[endKey] as string);
  }

  // Load company policy to get default shift times
  async function loadPolicy() {
    try {
      const res = await fetch(`/api/company`, { credentials: "include" });
     if (!res.ok) return;
      const data = await res.json();
      const policy = data?.policy ?? {};
      if (typeof policy.timezone === "string" && policy.timezone.trim()) {
        setTimezone(policy.timezone);
      }
      const startMin = policy.shiftStartMinute;
      const endMin = policy.shiftEndMinute;
      if (typeof startMin === "number") setDefaultStart(minutesToHHMM(startMin));
      if (typeof endMin === "number") setDefaultEnd(minutesToHHMM(endMin));
    } catch {
      // ignore policy errors
    }
  }

  // Load weekly plan for the current weekStart
  async function loadPlan() {
   if (!id || !weekStart) return;
    setLoadingPlan(true);
    setError(null);
    setNotice(null);
    // Load is the source of truth; it resets dirty state.
    setIsDirty(false);
    try {
      const res = await fetch(
        `/api/employees/${id}/weekly-plan?weekStart=${encodeURIComponent(
          weekStart
        )}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        const item = data?.item;
        if (item) {
          // Week default template
          setWeekTemplateId(item.shiftTemplateId ?? "NONE");

          // Day modes: templateId > custom(minutes) > default
          setDayMode({
            mon: item.monShiftTemplateId ?? (item.monStartMinute != null || item.monEndMinute != null ? "CUSTOM" : "DEFAULT"),
            tue: item.tueShiftTemplateId ?? (item.tueStartMinute != null || item.tueEndMinute != null ? "CUSTOM" : "DEFAULT"),
            wed: item.wedShiftTemplateId ?? (item.wedStartMinute != null || item.wedEndMinute != null ? "CUSTOM" : "DEFAULT"),
            thu: item.thuShiftTemplateId ?? (item.thuStartMinute != null || item.thuEndMinute != null ? "CUSTOM" : "DEFAULT"),
            fri: item.friShiftTemplateId ?? (item.friStartMinute != null || item.friEndMinute != null ? "CUSTOM" : "DEFAULT"),
            sat: item.satShiftTemplateId ?? (item.satStartMinute != null || item.satEndMinute != null ? "CUSTOM" : "DEFAULT"),
            sun: item.sunShiftTemplateId ?? (item.sunStartMinute != null || item.sunEndMinute != null ? "CUSTOM" : "DEFAULT"),
          });
          // Set times from plan
          setTimes({
            monStart: minutesToHHMM(item.monStartMinute),
            monEnd: minutesToHHMM(item.monEndMinute),
            tueStart: minutesToHHMM(item.tueStartMinute),
           tueEnd: minutesToHHMM(item.tueEndMinute),
            wedStart: minutesToHHMM(item.wedStartMinute),
            wedEnd: minutesToHHMM(item.wedEndMinute),
            thuStart: minutesToHHMM(item.thuStartMinute),
            thuEnd: minutesToHHMM(item.thuEndMinute),
            friStart: minutesToHHMM(item.friStartMinute),
            friEnd: minutesToHHMM(item.friEndMinute),
            satStart: minutesToHHMM(item.satStartMinute),
            satEnd: minutesToHHMM(item.satEndMinute),
            sunStart: minutesToHHMM(item.sunStartMinute),
            sunEnd: minutesToHHMM(item.sunEndMinute),
          });
        } else {
          // No plan: prefill with default shift times if available
          setWeekTemplateId("NONE");
          setDayMode({
            mon: "DEFAULT",
            tue: "DEFAULT",
            wed: "DEFAULT",
            thu: "DEFAULT",
            fri: "DEFAULT",
            sat: "DEFAULT",
            sun: "DEFAULT",
          });
          setTimes({
            monStart: defaultStart,
            monEnd: defaultEnd,
            tueStart: defaultStart,
            tueEnd: defaultEnd,
           wedStart: defaultStart,
            wedEnd: defaultEnd,
            thuStart: defaultStart,
            thuEnd: defaultEnd,
            friStart: defaultStart,
            friEnd: defaultEnd,
            satStart: defaultStart,
           satEnd: defaultEnd,
            sunStart: defaultStart,
            sunEnd: defaultEnd,
          });
        }
      } else if (res.status === 404) {
        // Not found: treat as no plan
        setWeekTemplateId("NONE");
        setDayMode({
          mon: "DEFAULT",
          tue: "DEFAULT",
          wed: "DEFAULT",
          thu: "DEFAULT",
          fri: "DEFAULT",
          sat: "DEFAULT",
          sun: "DEFAULT",
        });
       setTimes({
          monStart: defaultStart,
          monEnd: defaultEnd,
          tueStart: defaultStart,
          tueEnd: defaultEnd,
          wedStart: defaultStart,
          wedEnd: defaultEnd,
          thuStart: defaultStart,
         thuEnd: defaultEnd,
          friStart: defaultStart,
          friEnd: defaultEnd,
          satStart: defaultStart,
          satEnd: defaultEnd,
          sunStart: defaultStart,
          sunEnd: defaultEnd,
        });
      } else {
       const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || "Failed to load plan");
      }
   } catch (e: any) {
      setError(e?.message ?? "Plan load failed");
    } finally {
     setLoadingPlan(false);
    }
  }

  // Copy previous week's plan into current week
  async function copyPreviousWeek() {
    const prevWeek = addDays(weekStart, -7, timezone);
    try {
      setError(null);
      setNotice(null);
     const res = await fetch(
        `/api/employees/${id}/weekly-plan?weekStart=${encodeURIComponent(
          prevWeek
        )}`,
       { credentials: "include" }
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        setError(txt || "Önceki hafta planı okunamadı.");
        return;
      }
      const data = await res.json();
      const item = data?.item;

      if (item) {
        setIsDirty(true);
        // Week default template (can be null)
        setWeekTemplateId(item.shiftTemplateId ?? "NONE");

       // Day modes: templateId > custom(minutes) > default
        setDayMode({
          mon:
            item.monShiftTemplateId ??
            (item.monStartMinute != null || item.monEndMinute != null ? "CUSTOM" : "DEFAULT"),
          tue:
            item.tueShiftTemplateId ??
            (item.tueStartMinute != null || item.tueEndMinute != null ? "CUSTOM" : "DEFAULT"),
          wed:
            item.wedShiftTemplateId ??
            (item.wedStartMinute != null || item.wedEndMinute != null ? "CUSTOM" : "DEFAULT"),
          thu:
            item.thuShiftTemplateId ??
            (item.thuStartMinute != null || item.thuEndMinute != null ? "CUSTOM" : "DEFAULT"),
          fri:
            item.friShiftTemplateId ??
            (item.friStartMinute != null || item.friEndMinute != null ? "CUSTOM" : "DEFAULT"),
          sat:
            item.satShiftTemplateId ??
            (item.satStartMinute != null || item.satEndMinute != null ? "CUSTOM" : "DEFAULT"),
          sun:
            item.sunShiftTemplateId ??
            (item.sunStartMinute != null || item.sunEndMinute != null ? "CUSTOM" : "DEFAULT"),
        });

        // Copy legacy minutes as visible times (Custom days will reflect these)
        setTimes({
          monStart: minutesToHHMM(item.monStartMinute),
          monEnd: minutesToHHMM(item.monEndMinute),
          tueStart: minutesToHHMM(item.tueStartMinute),
          tueEnd: minutesToHHMM(item.tueEndMinute),
          wedStart: minutesToHHMM(item.wedStartMinute),
          wedEnd: minutesToHHMM(item.wedEndMinute),
          thuStart: minutesToHHMM(item.thuStartMinute),
          thuEnd: minutesToHHMM(item.thuEndMinute),
          friStart: minutesToHHMM(item.friStartMinute),
          friEnd: minutesToHHMM(item.friEndMinute),
          satStart: minutesToHHMM(item.satStartMinute),
          satEnd: minutesToHHMM(item.satEndMinute),
          sunStart: minutesToHHMM(item.sunStartMinute),
          sunEnd: minutesToHHMM(item.sunEndMinute),
        });
        setNotice("Geçen haftanın planı kopyalandı. Kaydetmeyi unutma.");
      } else {
        // No previous plan: fill with default
        setIsDirty(true);
        setWeekTemplateId("NONE");
          setDayMode({
            mon: "DEFAULT",
            tue: "DEFAULT",
            wed: "DEFAULT",
            thu: "DEFAULT",
            fri: "DEFAULT",
            sat: "DEFAULT",
            sun: "DEFAULT",
          });
       setTimes({
          monStart: defaultStart,
          monEnd: defaultEnd,
          tueStart: defaultStart,
          tueEnd: defaultEnd,
          wedStart: defaultStart,
          wedEnd: defaultEnd,
          thuStart: defaultStart,
          thuEnd: defaultEnd,
          friStart: defaultStart,
          friEnd: defaultEnd,
          satStart: defaultStart,
          satEnd: defaultEnd,
          sunStart: defaultStart,
          sunEnd: defaultEnd,
        });
        setNotice("Önceki hafta için kayıtlı plan yok; varsayılan değerler yüklendi.");
      }
    } catch {
     setError("Önceki hafta planı kopyalanırken bir hata oluştu.");
    }
  }

 // Save the current plan
  async function save() {
    if (!id || !weekStart) return;
   setSaving(true);
    setError(null);
    setNotice(null);
    try {
      // Build payload; empty strings should be sent as null
     const payload: any = {
        weekStartDate: weekStart,
        shiftTemplateId: weekTemplateId !== "NONE" ? weekTemplateId : null,
      };

      dayKeys.forEach((key) => {
        const mode = dayMode[key];
        // Template override: send day template id, keep times null (server will derive)
        if (mode && mode !== "DEFAULT" && mode !== "CUSTOM") {
          payload[`${key}ShiftTemplateId`] = mode;
          payload[`${key}Start`] = null;
          payload[`${key}End`] = null;
          return;
        }
        // Default: inherit week template (or policy). Keep everything null.
        if (mode === "DEFAULT") {
          payload[`${key}ShiftTemplateId`] = null;
          payload[`${key}Start`] = null;
          payload[`${key}End`] = null;
          return;
        }
        // Custom: send explicit times
        const startKey = `${key}Start` as keyof TimesState;
        const endKey = `${key}End` as keyof TimesState;
        payload[`${key}ShiftTemplateId`] = null;
        payload[`${key}Start`] = times[startKey] || null;
        payload[`${key}End`] = times[endKey] || null;
      });

      const res = await fetch(`/api/employees/${id}/weekly-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
     });
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || "Failed to save");
      }
      // Reload plan after save to reflect normalization (server may coerce undefined -> null)
      await loadPlan();
      setNotice("Plan kaydedildi.");
      setIsDirty(false);
    } catch (e: any) {
      setError(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // Change week by delta weeks (-1 for previous, +1 for next)
  function changeWeek(delta: number) {
    const newWeek = addDays(weekStart, delta * 7, timezone);
   setWeekStart(newWeek);
  }

  // Load policy once on mount
  useEffect(() => {
    loadPolicy();
    loadTemplates();
  }, []);

  // When timezone is known/updated, normalize weekStart to Monday in that timezone.
  // This prevents "Sunday" or "shifted day" issues on machines with different timezone settings.
  useEffect(() => {
    setWeekStart(computeWeekStart(new Date(), timezone));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timezone]);

  // Reload plan whenever weekStart or id changes
  useEffect(() => {
    loadPlan();
   // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, weekStart]);

  // Auto-dismiss notice after a short delay
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => {
      setNotice(null);
    }, 4000);
    return () => clearTimeout(t);
  }, [notice]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
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
      {notice && (
        <div
          style={{
            padding: 12,
            background: "#eef6ff",
            border: "1px solid #bcdcff",
            borderRadius: 12,
            color: "#123a66",
          }}
        >
          {notice}
        </div>
      )}
      {/* Week selector and actions */}
      <section
        style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Hafta Seçimi</h2>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
           marginTop: 8,
          }}
        >
          {isDirty && (
            <span style={{ color: "#b45309", fontWeight: 600 }}>
              ● Kaydedilmedi
            </span>
          )}
          <button
            onClick={() => changeWeek(-1)}
            style={{ padding: "4px 8px" }}
          >
            ← Önceki Hafta
         </button>
          <div>
            <strong>Hafta başlangıcı:</strong> {weekStart}
          </div>
          <button
            onClick={() => changeWeek(1)}
            style={{ padding: "4px 8px" }}
          >
            Sonraki Hafta →
          </button>
          <button
            onClick={copyPreviousWeek}
            style={{ padding: "4px 8px" }}
         >
            Geçen Haftayı Kopyala
          </button>
        </div>
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gap: 6,
            maxWidth: 520,
          }}
        >
          <label style={{ fontSize: 13, color: "#555" }}>
            Hafta Varsayılan Template
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={templateQuery}
              onChange={(e) => setTemplateQuery(e.target.value)}
              placeholder="Template ara (örn. 0900, 22:00...)"
              style={{
                padding: "6px 8px",
                borderRadius: 10,
                border: "1px solid #ddd",
                width: "100%",
              }}
            />
            {templateQuery.trim() && (
              <button
                type="button"
                onClick={() => setTemplateQuery("")}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Temizle
              </button>
            )}
          </div>
          <select
            value={weekTemplateId}
            onChange={(e) => {
              setWeekTemplateId(e.target.value);
              setIsDirty(true);
            }}
            style={{
              padding: "6px 8px",
              borderRadius: 10,
              border: "1px solid #ddd",
              width: "100%",
            }}
          >
            <option value="NONE">(Policy Default)</option>
            {getTemplatesForSelect(weekTemplateId).map((t) => (
              <option key={t.id} value={t.id}>
                {formatTemplateLabel(t)}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginTop: 8 }}>
          <em>
            Varsayılan vardiya: {defaultStart || "--"} - {defaultEnd || "--"}
          </em>
        </div>
        {/* Week Summary Bar (UI only) */}
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            border: "1px solid #ddd",
            borderRadius: 12,
            background: "#fafafa",
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <strong>Hafta Özeti:</strong>
          <button
            type="button"
            onClick={() => onSummaryClick("WEEK")}
            title="DEFAULT ve Week Template seçili günler"
            style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0 }}
          >
            📅 {weekSummary.weekTemplateDays} gün Week Template
          </button>
          <button
            type="button"
            onClick={() => onSummaryClick("POLICY")}
            title="DEFAULT ve Week Template yoksa (Policy fallback)"
            style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0 }}
          >
            🧩 {weekSummary.policyDays} gün Policy
          </button>
          <button
            type="button"
            onClick={() => onSummaryClick("DAY_TEMPLATE")}
            title="Gün bazlı template seçili günler"
            style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0 }}
          >
            📌 {weekSummary.dayTemplateDays} gün Day Template
          </button>
          <button
            type="button"
            onClick={() => onSummaryClick("CUSTOM")}
            title="Gün bazlı custom saat girilen günler"
            style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0 }}
          >
            ✏️ {weekSummary.customDays} gün Custom
          </button>
          <button
            type="button"
            onClick={() => onSummaryClick("OVERNIGHT")}
            title="Gece vardiyası (+1)"
            style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0 }}
          >
            🌙 {weekSummary.overnightDays} gün Gece
          </button>
        </div>
      </section>
      {/* Times input grid */}
      <section
        style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Vardiya Saatleri</h2>
        {loadingPlan ? (
         <div style={{ marginTop: 8 }}>Loading...</div>
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
                    Gün
                 </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #eee",
                      width: 260,
                    }}
                  >
                    Template
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #eee",
                      width: 140,
                    }}
                  >
                    Başlangıç
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #eee",
                      width: 140,
                    }}
                  >
                    Bitiş
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #eee",
                      width: 140,
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {dayKeys.map((key, idx) => {
                  const mode = dayMode[key];
                  const startKey = `${key}Start` as keyof TimesState;
                  const endKey = `${key}End` as keyof TimesState;
                  // Day is template-driven if:
                  // 1) explicit day template override selected OR
                  // 2) day is DEFAULT but weekTemplateId is set (Default -> Week Template)
                  const isExplicitDayTemplate = !!mode && mode !== "DEFAULT" && mode !== "CUSTOM";
                  const isWeekTemplateDefault = mode === "DEFAULT" && weekTemplateId !== "NONE";
                  const isTemplateDriven = isExplicitDayTemplate || isWeekTemplateDefault;  
                  const overnightByDayTemplate = isOvernightMode(mode);
                  const overnightByWeekTemplate =
                    mode === "DEFAULT" && weekTemplateId !== "NONE"
                      ? !!getWeekTemplate()?.spansMidnight
                      : false;
                  const isOvernight = overnightByDayTemplate || overnightByWeekTemplate;                
                  return (
                    <tr
                      key={key}
                      data-day-row={key}
                      style={
                        highlightDays[key]
                          ? { outline: "2px solid #f59e0b", outlineOffset: -2, borderRadius: 6 }
                          : undefined
                      }
                    >
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f2f2f2",
                        }}
                      >
                        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                          {dayNames[idx]}
                          {isOvernight && (
                            <span
                              title="Gece vardiyası (+1)"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "2px 6px",
                                borderRadius: 999,
                                border: "1px solid #ddd",
                                fontSize: 12,
                                lineHeight: "14px",
                                background: "#fff",
                              }}
                            >
                              🌙
                            </span>
                          )}
                        </span>
                      </td>
                      <td>
                        <select
                          value={mode}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDayMode((prev) => ({ ...prev, [key]: v }));
                            setIsDirty(true);
                            // Keep times state roughly aligned for a predictable Save
                            if (v !== "DEFAULT" && v !== "CUSTOM") {
                              const tpl = getTemplateById(v);
                              if (tpl) {
                                setTimes((prev) => ({
                                  ...prev,
                                  [startKey]: tpl.startTime,
                                  [endKey]: tpl.endTime,
                                }));
                              }
                            } else if (v === "DEFAULT") {
                              const wk = getWeekTemplate();
                              const s = wk ? wk.startTime : defaultStart;
                              const e2 = wk ? wk.endTime : defaultEnd;
                              setTimes((prev) => ({
                                ...prev,
                                [startKey]: s,
                                [endKey]: e2,
                              }));
                            }
                          }}
                        >
                          <option value="DEFAULT">{getDefaultDayLabel()}</option>
                          <option value="CUSTOM">Custom</option>
                          {getTemplatesForSelect(mode).map((t) => (
                            <option key={t.id} value={t.id}>
                              {formatTemplateLabel(t)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f2f2f2",
                        }}
                      >
                        <input
                          type="time"
                          value={getDisplayedTime(key, "start")}
                          disabled={isTemplateDriven}
                          onChange={(e) => {
                            setDayMode((prev) => ({ ...prev, [key]: "CUSTOM" }));
                            setTimes((prev) => ({ ...prev, [startKey]: e.target.value }));
                            setIsDirty(true);
                          }}
                        />
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f2f2f2",
                        }}
                      >
                        <input
                          type="time"
                          value={getDisplayedTime(key, "end")}
                          disabled={isTemplateDriven}
                          onChange={(e) => {
                            setDayMode((prev) => ({ ...prev, [key]: "CUSTOM" }));
                            setTimes((prev) => ({ ...prev, [endKey]: e.target.value }));
                            setIsDirty(true);
                          }}
                        />
                      </td>
                      
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f2f2f2",
                        }}
                      >
                        {isTemplateDriven ? (
                          <button
                            type="button"
                            onClick={() => {
                              const currentStart = getDisplayedTime(key, "start");
                              const currentEnd = getDisplayedTime(key, "end");
                              setDayMode((prev) => ({ ...prev, [key]: "CUSTOM" }));
                              setTimes((prev) => ({
                                ...prev,
                                [startKey]: currentStart,
                                [endKey]: currentEnd,
                              }));
                              setIsDirty(true);
                            }}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 8,
                              border: "1px solid #ddd",
                              background: "#fff",
                              cursor: "pointer",
                            }}
                          >
                            Custom&apos;a geç
                          </button>
                        ) : (
                          <span style={{ color: "#999" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {/* Save button */}
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{ padding: "6px 12px" }}
        >
          {saving ? "Kaydediliyor..." : "Planı Kaydet"}
        </button>
      </div>
    </div>
  );
}