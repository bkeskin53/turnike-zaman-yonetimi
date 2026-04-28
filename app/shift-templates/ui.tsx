"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  deriveExpectedWorkMinutes,
  deriveShiftStartTimeFromEndTime,
  deriveShiftTemplateClock,
  formatMinutesAsDecimalHoursText,
  formatMinutesAsHumanDurationText,
  parsePlannedWorkDecimalHoursToMinutes,
} from "@/src/domain/shiftTemplates/shiftTemplateClock";
import type { DataManagementWorkspaceRecordOption } from "@/src/features/data-management/DataManagementModuleSelect";

type ShiftTemplate = {
  id: string;
  name?: string | null;
  shiftCode?: string;
  signature: string;
  startTime: string;
  endTime: string;
  spansMidnight: boolean;
  plannedWorkMinutes?: number;
  plannedWorkHoursText?: string;
  plannedWorkHumanText?: string;
  expectedWorkMinutes?: number;
  expectedWorkHoursText?: string;
  expectedWorkHumanText?: string;
  breakPlanId?: string | null;
  breakPlan?: {
    id: string;
    code: string;
    name: string;
    plannedBreakMinutes: number;
    plannedBreakHoursText?: string | null;
    plannedBreakHumanText?: string | null;
    isPaid: boolean;
    payTypeText?: string | null;
    isActive: boolean;
  } | null;
  isActive: boolean;
  createdAt: string;
};

type BreakPlanLite = {
  id: string;
  code: string;
  name: string;
  plannedBreakMinutes: number;
  plannedBreakHoursText?: string;
  plannedBreakHumanText?: string;
  isPaid: boolean;
  payTypeText?: string;
  isActive: boolean;
};

type Tone = "neutral" | "muted" | "info" | "good" | "warn" | "danger" | "violet";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  const map: Record<Tone, string> = {
    neutral: "bg-slate-100/90 text-slate-700 ring-slate-300/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
    muted: "bg-slate-50/95 text-slate-600 ring-slate-200/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
    info: "bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(56,189,248,0.10))] text-sky-800 ring-sky-300/45 shadow-[0_8px_22px_rgba(14,165,233,0.12)]",
    good: "bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(52,211,153,0.10))] text-emerald-800 ring-emerald-300/45 shadow-[0_8px_22px_rgba(16,185,129,0.12)]",
    warn: "bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(251,191,36,0.10))] text-amber-900 ring-amber-300/45 shadow-[0_8px_22px_rgba(245,158,11,0.10)]",
    danger: "bg-[linear-gradient(135deg,rgba(244,63,94,0.16),rgba(251,113,133,0.10))] text-rose-800 ring-rose-300/45 shadow-[0_8px_22px_rgba(244,63,94,0.10)]",
    violet: "bg-[linear-gradient(135deg,rgba(99,102,241,0.18),rgba(139,92,246,0.10))] text-indigo-900 ring-indigo-300/45 shadow-[0_10px_24px_rgba(99,102,241,0.12)]",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        map[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

function ShiftCodeBadge({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-xl px-2.5 py-1 font-mono text-[11px] font-semibold",
        "border border-indigo-200/70 bg-[linear-gradient(135deg,rgba(238,242,255,0.96),rgba(255,255,255,0.96))] text-indigo-950",
        "shadow-[0_10px_24px_rgba(99,102,241,0.10)]",
        className
      )}
    >
      <span className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_0_4px_rgba(99,102,241,0.12)]" />
      <span>{code}</span>
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
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const toneBg: Record<Tone, string> = {
    neutral: "border-slate-200/70 from-white via-slate-50/70 to-slate-100/60",
    muted: "border-slate-200/60 from-white via-slate-50/60 to-slate-50/40",
    info: "border-sky-200/60 from-white via-sky-50/65 to-cyan-50/55",
    good: "border-emerald-200/60 from-white via-emerald-50/65 to-teal-50/55",
    warn: "border-amber-200/65 from-white via-amber-50/70 to-orange-50/55",
    danger: "border-rose-200/65 from-white via-rose-50/65 to-pink-50/55",
    violet: "border-indigo-200/65 from-white via-indigo-50/70 to-violet-50/60",
  };
  return (
    <div
      className={cx(
        "rounded-2xl border bg-gradient-to-br p-4 shadow-[0_14px_35px_rgba(15,23,42,0.08)] min-w-0",
        "hover:shadow-[0_20px_45px_rgba(79,70,229,0.12)] transition-shadow",
        toneBg[tone],
        className
      )}
    >
      {(title || subtitle || right) ? (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <div className="text-sm font-semibold text-slate-950 leading-5">{title}</div> : null}
            {subtitle ? <div className="mt-1 text-xs text-slate-600 leading-5">{subtitle}</div> : null}
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
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition " +
    "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed";
  const map = {
    primary: "border border-indigo-400/30 bg-[linear-gradient(135deg,#4f46e5,#7c3aed)] text-white shadow-[0_14px_28px_rgba(79,70,229,0.24)] hover:brightness-105",
    secondary: "border border-slate-200/80 bg-white/88 text-slate-900 hover:border-indigo-200 hover:bg-indigo-50/50 shadow-[0_10px_24px_rgba(15,23,42,0.05)]",
    ghost: "bg-transparent text-slate-700 hover:bg-indigo-50/70 hover:text-indigo-700 border border-transparent",
    danger: "border border-rose-300/30 bg-[linear-gradient(135deg,#e11d48,#f43f5e)] text-white shadow-[0_14px_28px_rgba(225,29,72,0.18)] hover:brightness-105",
  } as const;
  return <button className={cx(base, map[variant], className)} {...props} />;
}

const inputClass =
  "w-full rounded-xl border border-slate-200/80 bg-white/88 px-3 py-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300";

function isValidTimeHHmm(v: string) {
  return /^\d{2}:\d{2}$/.test(v);
}

function normalizeShiftCode(v: string) {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
}

function normalizeShiftNameInput(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
}

function normalizeTimeHHmm(v: string) {
  // Accept "HH:mm" and "HH:mm:ss" from some browsers, normalize to "HH:mm"
  // Also trims whitespace.
  const s = (v || "").trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);
  return s;
}

function toHHmmCompact(v: string) {
  // "09:00" -> "0900"
  if (!isValidTimeHHmm(v)) return "";
  return v.replace(":", "");
}

function parseMinutes(v: string) {
  // "HH:mm" -> minutes since 00:00
  if (!isValidTimeHHmm(v)) return null;
  const [hh, mm] = v.split(":").map((x) => Number(x));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}s ${m}dk`;
}

function formatPlannedWorkHoursText(minutes: number | null | undefined) {
  if (typeof minutes !== "number" || !Number.isFinite(minutes)) return "—";
  try {
    return formatMinutesAsDecimalHoursText(minutes);
  } catch {
    return "—";
  }
}

function formatPlannedWorkHumanText(minutes: number | null | undefined) {
  if (typeof minutes !== "number" || !Number.isFinite(minutes)) return "—";
  try {
    return formatMinutesAsHumanDurationText(minutes);
  } catch {
    return "—";
  }
}

function normalizePlannedWorkHoursInput(value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    return formatMinutesAsDecimalHoursText(parsePlannedWorkDecimalHoursToMinutes(raw));
  } catch {
    return raw.replace(".", ",");
  }
}

function getShiftPlannedWorkMinutes(it: Partial<ShiftTemplate> | null | undefined) {
  if (!it) return null;
  if (typeof it.plannedWorkMinutes === "number" && Number.isFinite(it.plannedWorkMinutes)) {
    return it.plannedWorkMinutes;
  }
  return calcDurationMinutes(String(it.startTime ?? ""), String(it.endTime ?? ""), Boolean(it.spansMidnight));
}

function humanizeShiftTemplateError(code: string) {
  if (code === "SHIFT_TEMPLATE_NAME_REQUIRED") return "Vardiya adı zorunludur.";
  if (code === "SHIFT_TEMPLATE_NAME_TOO_LONG") return "Vardiya adı 120 karakteri aşamaz.";
  if (code === "PLANNED_WORK_HOURS_REQUIRED") return "Planlanan çalışma saati zorunludur.";
  if (code === "PLANNED_WORK_HOURS_INVALID_FORMAT") {
    return "Planlanan çalışma saati ondalık formatta olmalıdır. Örn: 9,00 / 7,50 / 8,25.";
  }
  if (code === "PLANNED_WORK_HOURS_MUST_BE_POSITIVE") return "Planlanan çalışma saati 0’dan büyük olmalıdır.";
  if (code === "PLANNED_WORK_HOURS_MAX_12_HOURS") return "Planlanan çalışma saati 12,00 saati aşamaz.";
  if (code === "SHIFT_START_TIME_INVALID_FORMAT") return "Vardiya başlangıç saati HH:mm formatında olmalıdır.";
  if (code === "BREAK_PLAN_NOT_FOUND") return "Seçilen mola planı bulunamadı veya pasif. Listeyi yenileyip tekrar deneyin.";
  if (code === "BREAK_PLAN_EXCEEDS_PLANNED_WORK") return "Mola süresi planlanan çalışma süresinden büyük olamaz.";
  if (code === "BREAK_PLAN_MINUTES_INVALID") return "Seçilen mola planının süresi geçersiz.";
  if (code.startsWith("PLANNED_WORK_") || code.startsWith("SHIFT_START_TIME_")) return code;
  return code;
}

function calcDurationMinutes(startTime: string, endTime: string, spansMidnight?: boolean) {
  const startM = parseMinutes(startTime);
  const endM = parseMinutes(endTime);
  if (startM == null || endM == null) return null;
  const overnight = typeof spansMidnight === "boolean" ? spansMidnight : (endM < startM);
  if (startM === endM) return 0;
  return overnight ? (24 * 60 - startM) + endM : (endM - startM);
}

function isOffTemplate(t: Partial<ShiftTemplate> | null | undefined): boolean {
  if (!t) return false;
  const code = String((t as any)?.shiftCode ?? "").trim().toUpperCase();
  const sig = String((t as any)?.signature ?? "").trim().toUpperCase();
  return code === "OFF" || sig === "OFF";
}

function resolveCreatedShiftTemplateId(payload: any): string {
  const candidates = [
    payload?.item?.id,
    payload?.data?.id,
    payload?.shiftTemplate?.id,
    payload?.template?.id,
    payload?.id,
  ];

  for (const candidate of candidates) {
    const value = String(candidate ?? "").trim();
    if (value) return value;
  }

  return "";
}

function findCreatedShiftTemplateId(
  items: ShiftTemplate[],
  draft: {
    shiftCode: string;
    signature: string;
    startTime: string;
    plannedWorkMinutes: number | null;
    breakPlanId: string | null;
  }
): string {
  const draftCode = normalizeShiftCode(draft.shiftCode);
  const draftSignature = String(draft.signature ?? "").trim();

  const match = items
    .slice()
    .reverse()
    .find((item) => {
      const itemCode = normalizeShiftCode(item.shiftCode ?? item.signature ?? "");
      const itemSignature = String(item.signature ?? "").trim();
      const itemPlannedWorkMinutes = getShiftPlannedWorkMinutes(item);
      const itemBreakPlanId = item.breakPlanId ?? null;

      const codeMatches = draftCode ? itemCode === draftCode : itemSignature === draftSignature;
      const plannedMatches =
        draft.plannedWorkMinutes == null || itemPlannedWorkMinutes === draft.plannedWorkMinutes;

      return (
        codeMatches &&
        plannedMatches &&
        item.startTime === draft.startTime &&
        itemBreakPlanId === draft.breakPlanId
      );
    });

  return String(match?.id ?? "").trim();
}

export default function ShiftTemplatesClient({
  canWrite,
  embedded = false,
  onDirtyStateChange,
  selectedShiftTemplateId,
  embeddedCreateRequested = false,
  onSelectedShiftTemplateIdChange,
  onEmbeddedShiftTemplateOptionsChange,
}: {
  canWrite: boolean;
  embedded?: boolean;
  onDirtyStateChange?: (isDirty: boolean) => void;
  selectedShiftTemplateId?: string;
  embeddedCreateRequested?: boolean;
  onSelectedShiftTemplateIdChange?: (nextValue: string) => void;
  onEmbeddedShiftTemplateOptionsChange?: (options: DataManagementWorkspaceRecordOption[]) => void;
}) {
  const readOnly = !canWrite;
  const [embeddedEditMode, setEmbeddedEditMode] = useState(false);
  const [embeddedActionsOpen, setEmbeddedActionsOpen] = useState(false);
  const embeddedSelectedRecord = embedded && !!selectedShiftTemplateId && !embeddedCreateRequested;
  const embeddedReadOnlyRecord = embeddedSelectedRecord && !embeddedEditMode;
  const effectiveReadOnly = readOnly || embeddedReadOnlyRecord;
  const [items, setItems] = useState<ShiftTemplate[]>([]);
  const [breakPlans, setBreakPlans] = useState<BreakPlanLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; signature: string } | null>(null);
  const [editBaseline, setEditBaseline] = useState<{
    id: string;
    shiftCode: string;
    name: string;
    startTime: string;
    plannedWorkMinutes: number;
    breakPlanId: string | null;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"signature" | "startTime" | "createdAt">("signature");

  const [form, setForm] = useState({
    id: "",
    shiftCode: "",
    name: "",
    plannedWorkHours: "",
    startTime: "",
    breakPlanId: "",
    mode: "create" as "create" | "edit",
  });
  const [touched, setTouched] = useState({
    plannedWorkHours: false,
    startTime: false,
  });

  const preview = useMemo(() => {
    if (!String(form.plannedWorkHours ?? "").trim()) return null;
    try {
      return {
        ...deriveShiftTemplateClock({
          shiftCode: normalizeShiftCode(form.shiftCode) || undefined,
          plannedWorkHours: form.plannedWorkHours,
          startTime: form.startTime,
        }),
        invalidReason: null as string | null,
      };
    } catch (e: any) {
      return {
        plannedWorkMinutes: null,
        plannedWorkHoursText: "",
        plannedWorkHumanText: "",
        expectedWorkMinutes: null,
        expectedWorkHoursText: "",
        expectedWorkHumanText: "",
        startTime: form.startTime || "00:00",
        endTime: "",
        spansMidnight: false,
        signature: "",
        invalidReason: humanizeShiftTemplateError(String(e?.message || "PLANNED_WORK_HOURS_INVALID_FORMAT")),
      };
    }
    }, [form.plannedWorkHours, form.startTime, form.shiftCode]);

  const selectedBreakPlan = useMemo(() => {
    return breakPlans.find((x) => x.id === form.breakPlanId) ?? null;
  }, [breakPlans, form.breakPlanId]);

  const expectedPreview = useMemo(() => {
    if (!preview || preview.invalidReason || typeof preview.plannedWorkMinutes !== "number") return null;
    try {
      const expectedWorkMinutes = deriveExpectedWorkMinutes({
        plannedWorkMinutes: preview.plannedWorkMinutes,
        breakPlan: selectedBreakPlan
          ? {
              plannedBreakMinutes: selectedBreakPlan.plannedBreakMinutes,
              isPaid: selectedBreakPlan.isPaid,
            }
          : null,
      });

      return {
        expectedWorkMinutes,
        expectedWorkHoursText: formatMinutesAsDecimalHoursText(expectedWorkMinutes),
        expectedWorkHumanText: formatMinutesAsHumanDurationText(expectedWorkMinutes),
        invalidReason: null as string | null,
      };
    } catch (e: any) {
      return {
        expectedWorkMinutes: null,
        expectedWorkHoursText: "",
        expectedWorkHumanText: "",
        invalidReason: humanizeShiftTemplateError(String(e?.message || "BREAK_PLAN_EXCEEDS_PLANNED_WORK")),
      };
    }
  }, [preview, selectedBreakPlan]);

  const canSubmit = useMemo(() => {
    return (
      normalizeShiftNameInput(form.name).length > 0 &&
      !!preview &&
      !preview.invalidReason &&
      !expectedPreview?.invalidReason
    );
  }, [form.name, preview, expectedPreview]);

  const hasCreateDraft = useMemo(() => {
    if (form.mode !== "create") return false;
    return (
      !!normalizeShiftCode(form.shiftCode) ||
      !!normalizeShiftNameInput(form.name) ||
      !!form.plannedWorkHours ||
      !!form.startTime ||
      !!form.breakPlanId
    );
  }, [form.mode, form.shiftCode, form.name, form.plannedWorkHours, form.startTime, form.breakPlanId]);

  const isDirty = useMemo(() => {
    if (form.mode !== "edit") return false;
    if (!editBaseline) return false;
    if (editBaseline.id !== form.id) return false;
    const currentStartTime = preview && !preview.invalidReason ? preview.startTime : normalizeTimeHHmm(form.startTime || "00:00");
    const currentPlannedMinutes = preview && !preview.invalidReason ? preview.plannedWorkMinutes : null;
    return (
      editBaseline.shiftCode !== normalizeShiftCode(form.shiftCode) ||
      editBaseline.name !== normalizeShiftNameInput(form.name) ||
      editBaseline.startTime !== currentStartTime ||
      editBaseline.plannedWorkMinutes !== currentPlannedMinutes ||
      editBaseline.breakPlanId !== (form.breakPlanId || null)
    );
  }, [form.mode, form.id, form.shiftCode, form.name, form.startTime, form.breakPlanId, preview, editBaseline]);

  const hasWorkspaceDraft = form.mode === "edit" ? isDirty : hasCreateDraft;
  
  useEffect(() => {
    onDirtyStateChange?.(hasWorkspaceDraft);
  }, [hasWorkspaceDraft, onDirtyStateChange]);

  useEffect(() => {
    if (form.mode !== "edit") return;
    if (!form.shiftCode.trim() && preview?.signature) {
      setForm((s) => ({
        ...s,
        shiftCode: preview.signature,
      }));
    }
  }, [form.mode, form.shiftCode, preview?.signature]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2000);
    return () => clearTimeout(t);
  }, [notice]);

  const visibleItems = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = items;
    if (query) {
      list = items.filter((it) => {
        const plannedText = it.plannedWorkHoursText ?? formatPlannedWorkHoursText(getShiftPlannedWorkMinutes(it));
        const humanText = it.plannedWorkHumanText ?? formatPlannedWorkHumanText(getShiftPlannedWorkMinutes(it));
        const hay = `${it.shiftCode ?? ""} ${it.name ?? ""} ${it.signature} ${it.startTime} ${it.endTime} ${plannedText} ${humanText} ${it.breakPlan?.code ?? ""} ${it.breakPlan?.name ?? ""}`.toLowerCase();
        return hay.includes(query);
      });
    }
    const sorted = [...list].sort((a, b) => {
      if (sort === "signature") {
        const ac = String(a.shiftCode ?? a.signature);
        const bc = String(b.shiftCode ?? b.signature);
        return ac.localeCompare(bc) || a.signature.localeCompare(b.signature);
      }
      if (sort === "startTime") {
        const am = parseMinutes(a.startTime) ?? Number.MAX_SAFE_INTEGER;
        const bm = parseMinutes(b.startTime) ?? Number.MAX_SAFE_INTEGER;
        if (am !== bm) return am - bm;
        return a.signature.localeCompare(b.signature);
      }
      // createdAt: newest first
      const at = Date.parse(a.createdAt);
      const bt = Date.parse(b.createdAt);
      const av = Number.isFinite(at) ? at : 0;
      const bv = Number.isFinite(bt) ? bt : 0;
      if (av !== bv) return bv - av;
      return a.signature.localeCompare(b.signature);
    });
    return sorted;
  }, [items, q, sort]);

  const editingItem = useMemo(() => {
    if (form.mode !== "edit") return null;
    const it = items.find((x) => x.id === form.id) || null;
    return it;
  }, [form.mode, form.id, items]);

  const selectedEmbeddedShiftTemplate = useMemo(() => {
    if (!selectedShiftTemplateId) return null;
    return items.find((item) => item.id === selectedShiftTemplateId) ?? null;
  }, [items, selectedShiftTemplateId]);

  const editingIsOff = useMemo(() => {
    return isOffTemplate(editingItem);
  }, [editingItem]);
  
  const embeddedReadonlyDetails = useMemo(() => {
    if (!embeddedReadOnlyRecord || !selectedEmbeddedShiftTemplate) return null;

    const item = selectedEmbeddedShiftTemplate;
    const plannedMinutes = getShiftPlannedWorkMinutes(item);
    const plannedHoursText = item.plannedWorkHoursText ?? formatPlannedWorkHoursText(plannedMinutes);
    const expectedHoursText = item.expectedWorkHoursText ?? plannedHoursText;
    const breakText = item.breakPlan
      ? `${item.breakPlan.name} / ${item.breakPlan.isPaid ? "Ücretli" : "Ücretsiz"}`
      : "Mola yok";

    return {
      code: item.shiftCode ?? item.signature,
      name: item.name ?? "",
      plannedHoursText,
      startTime: item.startTime,
      endTime: `${item.endTime}${item.spansMidnight ? " +1" : ""}`,
      breakText,
      expectedHoursText,
      signature: item.signature,
    };
  }, [embeddedReadOnlyRecord, selectedEmbeddedShiftTemplate]);

  function beginEdit(it: ShiftTemplate) {
    if (effectiveReadOnly) return;
    if (isOffTemplate(it)) {
      setError("OFF template özel sistem şablonudur. Düzenleme desteklenmez.");
      return;
    }
    setError(null);
    setForm({
      id: it.id,
      shiftCode: it.shiftCode ?? it.signature,
      name: it.name ?? "",
      plannedWorkHours: it.plannedWorkHoursText ?? formatPlannedWorkHoursText(getShiftPlannedWorkMinutes(it)),
      startTime: it.startTime,
      breakPlanId: it.breakPlanId ?? "",
      mode: "edit",
    });
    setTouched({ plannedWorkHours: true, startTime: true });
    setEditBaseline({
      id: it.id,
      shiftCode: it.shiftCode ?? it.signature,
      name: it.name ?? "",
      startTime: it.startTime,
      plannedWorkMinutes: getShiftPlannedWorkMinutes(it) ?? 0,
      breakPlanId: it.breakPlanId ?? null,
    });
  }

  async function load(): Promise<ShiftTemplate[]> {
    setLoading(true);
    setError(null);
    try {
      const [res, breakRes] = await Promise.all([
        fetch("/api/shift-templates?includeInactive=1", {
          cache: "no-store",
          credentials: "include",
        }),
        fetch("/api/break-plans", {
          cache: "no-store",
          credentials: "include",
        }),
      ]);

      const shiftData = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(shiftData?.error ?? "LOAD_FAILED"));

      const breakData = await breakRes.json().catch(() => null);
      if (!breakRes.ok) throw new Error(String(breakData?.error ?? "BREAK_PLANS_LOAD_FAILED"));

      const next = Array.isArray(shiftData?.items)
        ? shiftData.items.map((it: any) => ({
            ...it,
            shiftCode: typeof it?.shiftCode === "string" ? it.shiftCode : undefined,
          }))
        : [];

      setItems(next);
      setBreakPlans(Array.isArray(breakData?.items) ? breakData.items : []);
      return next;
    } catch (e: any) {
      setError(e?.message || "LOAD_FAILED");
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!embedded) return;

    const options = items.map((item) => {
      const code = item.shiftCode ?? item.signature;
      const name = normalizeShiftNameInput(item.name);

      return {
        value: item.id,
        label: name ? `${code} — ${name}` : code,
      };
    });

    onEmbeddedShiftTemplateOptionsChange?.(options);
  }, [embedded, items, onEmbeddedShiftTemplateOptionsChange]);

  useEffect(() => {
    if (!embedded || embeddedCreateRequested) return;
    if (!selectedShiftTemplateId) return;

    const item = items.find((x) => x.id === selectedShiftTemplateId);
    if (!item) return;

    setError(null);
    setNotice(null);
    setDeleteConfirm(null);
    setEmbeddedEditMode(false);
    setEmbeddedActionsOpen(false);
    setForm({
      id: item.id,
      shiftCode: item.shiftCode ?? item.signature,
      name: item.name ?? "",
      plannedWorkHours: item.plannedWorkHoursText ?? formatPlannedWorkHoursText(getShiftPlannedWorkMinutes(item)),
      startTime: item.startTime,
      breakPlanId: item.breakPlanId ?? "",
      mode: "edit",
    });
    setTouched({ plannedWorkHours: true, startTime: true });
    setEditBaseline({
      id: item.id,
      shiftCode: item.shiftCode ?? item.signature,
      name: item.name ?? "",
      startTime: item.startTime,
      plannedWorkMinutes: getShiftPlannedWorkMinutes(item) ?? 0,
      breakPlanId: item.breakPlanId ?? null,
    });
  }, [embedded, embeddedCreateRequested, selectedShiftTemplateId, items]);

  useEffect(() => {
    if (!embedded || !embeddedCreateRequested) return;

    setEmbeddedEditMode(false);
    setEmbeddedActionsOpen(false);
    setError(null);
    setNotice(null);
    setDeleteConfirm(null);
    setForm({
      id: "",
      shiftCode: "",
      name: "",
      plannedWorkHours: "",
      startTime: "",
      breakPlanId: "",
      mode: "create",
    });
    setEditBaseline(null);
    setTouched({ plannedWorkHours: false, startTime: false });
  }, [embedded, embeddedCreateRequested]);

  function resetForm() {
    setForm({ id: "", shiftCode: "", name: "", plannedWorkHours: "", startTime: "", breakPlanId: "", mode: "create" });
    setEditBaseline(null);
    setTouched({ plannedWorkHours: false, startTime: false });
  }

  function restoreSelectedEmbeddedShiftTemplateForm() {
    if (!embeddedSelectedRecord || !selectedEmbeddedShiftTemplate) return false;

    setForm({
      id: selectedEmbeddedShiftTemplate.id,
      shiftCode: selectedEmbeddedShiftTemplate.shiftCode ?? selectedEmbeddedShiftTemplate.signature,
      name: selectedEmbeddedShiftTemplate.name ?? "",
      plannedWorkHours:
        selectedEmbeddedShiftTemplate.plannedWorkHoursText ??
        formatPlannedWorkHoursText(getShiftPlannedWorkMinutes(selectedEmbeddedShiftTemplate)),
      startTime: selectedEmbeddedShiftTemplate.startTime,
      breakPlanId: selectedEmbeddedShiftTemplate.breakPlanId ?? "",
      mode: "edit",
    });
    setTouched({ plannedWorkHours: true, startTime: true });
    setEditBaseline({
      id: selectedEmbeddedShiftTemplate.id,
      shiftCode: selectedEmbeddedShiftTemplate.shiftCode ?? selectedEmbeddedShiftTemplate.signature,
      name: selectedEmbeddedShiftTemplate.name ?? "",
      startTime: selectedEmbeddedShiftTemplate.startTime,
      plannedWorkMinutes: getShiftPlannedWorkMinutes(selectedEmbeddedShiftTemplate) ?? 0,
      breakPlanId: selectedEmbeddedShiftTemplate.breakPlanId ?? null,
    });

    return true;
  }

  function cancelFormEdit() {
    if (restoreSelectedEmbeddedShiftTemplateForm()) {
      setEmbeddedEditMode(false);
      setEmbeddedActionsOpen(false);
      setError(null);
      setNotice(null);
      return;
    }

    resetForm();
  }

  function closeEmbeddedSelectedRecord() {
    setEmbeddedActionsOpen(false);
    setEmbeddedEditMode(false);
    onSelectedShiftTemplateIdChange?.("");
    resetForm();
  }

  function beginEmbeddedSelectedEdit() {
    if (readOnly || !selectedEmbeddedShiftTemplate || isOffTemplate(selectedEmbeddedShiftTemplate)) return;
    setEmbeddedActionsOpen(false);
    setEmbeddedEditMode(true);
  }

  function requestEmbeddedSelectedDelete() {
    if (readOnly || !selectedEmbeddedShiftTemplate || isOffTemplate(selectedEmbeddedShiftTemplate)) return;
    setEmbeddedActionsOpen(false);
    setDeleteConfirm({
      id: selectedEmbeddedShiftTemplate.id,
      signature: selectedEmbeddedShiftTemplate.signature,
    });
  }

  async function onSubmit() {
      if (form.mode === "edit" && editingIsOff) {
      setError("OFF template özel sistem şablonudur. Güncelleme desteklenmez.");
      return;
    }

    if (effectiveReadOnly) return;
    if (!normalizeShiftNameInput(form.name)) {
      setError("Vardiya adı zorunludur.");
      return;
    }
    if (!canSubmit) {
      setError(preview?.invalidReason || expectedPreview?.invalidReason || "Planlanan çalışma saati zorunludur.");
      return;
    }
    if (preview?.invalidReason) { setError(preview.invalidReason); return; }
    if (expectedPreview?.invalidReason) { setError(expectedPreview.invalidReason); return; }
    if (form.mode === "edit" && !isDirty) {
      setError("Güncellenecek bir değişiklik yok.");
      return;
    }
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const normalizedShiftCode = normalizeShiftCode(form.shiftCode);
      const isCreateSubmit = form.mode === "create";
      const createdMatchDraft =
        isCreateSubmit && preview && !preview.invalidReason
          ? {
              shiftCode: normalizedShiftCode,
              signature: String(preview.signature ?? ""),
              startTime: String(preview.startTime ?? ""),
              plannedWorkMinutes:
                typeof preview.plannedWorkMinutes === "number" ? preview.plannedWorkMinutes : null,
              breakPlanId: form.breakPlanId || null,
            }
          : null;

      const body = {
        shiftCode: normalizedShiftCode || undefined,
        name: normalizeShiftNameInput(form.name),
        plannedWorkHours: normalizePlannedWorkHoursInput(form.plannedWorkHours),
        startTime: form.startTime || undefined,
        breakPlanId: form.breakPlanId || null,
      };
      const res =
        form.mode === "create"
          ? await fetch("/api/shift-templates", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            })
          : await fetch(`/api/shift-templates/${form.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "SAVE_FAILED");
      const nextItems = await load();
      const createdId = createdMatchDraft
        ? resolveCreatedShiftTemplateId(data) || findCreatedShiftTemplateId(nextItems, createdMatchDraft)
        : "";

      if (embeddedSelectedRecord && form.mode === "edit") {
        setEmbeddedEditMode(false);
      } else if (embedded && isCreateSubmit && createdId) {
        onSelectedShiftTemplateIdChange?.(createdId);
        setEmbeddedEditMode(false);
        setEmbeddedActionsOpen(false);
      } else {
        resetForm();
      }
      setNotice(form.mode === "create" ? "Template oluşturuldu." : "Template güncellendi.");
    } catch (e: any) {
      const code = String(e?.message || "SAVE_FAILED");
      if (code === "SHIFT_TEMPLATE_ALREADY_EXISTS") {
        const sig = preview?.signature ?? "";
        if (form.shiftCode.trim()) setQ(normalizeShiftCode(form.shiftCode)); else if (sig) setQ(sig);
        setError("Bu vardiya template’i zaten mevcut. Listeden bulup kullanabilir veya (pasifse) Aktifleştir diyebilirsin.");
      } else {
        setError(humanizeShiftTemplateError(code));
      }
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: string) {
    if (readOnly) return;
    setError(null);
    setNotice(null);

    const target = items.find((x) => x.id === id) ?? null;
    if (isOffTemplate(target)) {
      setError("OFF template özel sistem şablonudur. Pasifleştirme bu ekrandan desteklenmez.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/shift-templates/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "DELETE_FAILED");
      await load();
      if (form.id === id) resetForm();
      if (selectedShiftTemplateId === id) {
        onSelectedShiftTemplateIdChange?.("");
        setEmbeddedEditMode(false);
        setEmbeddedActionsOpen(false);
      }
      setNotice("Template pasifleştirildi.");
    } catch (e: any) {
      setError(e?.message || "DELETE_FAILED");
    } finally {
      setLoading(false);
    }
  }

  async function onActivate(id: string) {
    if (readOnly) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/shift-templates/${id}/activate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "ACTIVATE_FAILED");
      await load();
      setNotice("Template aktifleştirildi.");
    } catch (e: any) {
      setError(e?.message || "ACTIVATE_FAILED");
    } finally {
      setLoading(false);
    }
  }

  const previewShiftCode = useMemo(() => {
    return normalizeShiftCode(form.shiftCode) || preview?.signature || "";
  }, [form.shiftCode, preview?.signature]);

  const editingShiftCode = useMemo(() => {
    if (editingItem?.shiftCode) return editingItem.shiftCode;
    if (form.mode === "edit") return previewShiftCode || null;
    return null;
  }, [editingItem?.shiftCode, form.mode, previewShiftCode]);

  const showHardValidation =
    form.mode === "edit" || touched.plannedWorkHours || touched.startTime;

  return (
    <div className={cx("relative grid min-w-0 max-w-full overflow-x-clip", embedded ? "gap-4" : "gap-6")}>      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            // backdrop click closes
            if (e.target === e.currentTarget) setDeleteConfirm(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white/95 shadow-[0_24px_50px_rgba(15,23,42,0.14)] border border-slate-200/80 p-4 backdrop-blur-sm">
            <div className="text-lg font-semibold">Şablon pasifleştirilsin mi?</div>
            <div className="mt-1 text-sm text-slate-600">
              Bu işlem şablonu pasif yapar. İstersen daha sonra tekrar <b>Aktifleştir</b>.
              Seçili şablon:{" "}
              <span className="font-mono font-medium text-slate-900">{deleteConfirm.signature}</span>
            </div>
            {readOnly ? (
              <div className="mt-3 rounded-xl border border-amber-200/80 bg-[linear-gradient(135deg,rgba(254,243,199,0.96),rgba(255,255,255,0.94))] px-3 py-2 text-sm text-amber-900 shadow-[0_10px_24px_rgba(245,158,11,0.06)]">
                İnceleme modu: Bu işlem için yetkin yok.
              </div>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)} disabled={loading}>
                İptal
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  if (readOnly) return;
                  const id = deleteConfirm.id;
                  setDeleteConfirm(null);
                  await onDelete(id);
                }}
                disabled={loading || readOnly}
              >
                Pasifleştir
              </Button>
            </div>
          </div>
        </div>
      )}

        {readOnly ? (
          <div className="rounded-xl border border-amber-200/80 bg-[linear-gradient(135deg,rgba(254,243,199,0.96),rgba(255,255,255,0.94))] px-3 py-2 text-sm text-amber-900 shadow-[0_10px_24px_rgba(245,158,11,0.06)]">
            İnceleme modu: şablon <b>oluşturamaz</b>, <b>güncelleyemez</b>, <b>pasifleştiremez</b> veya <b>aktifleştiremezsin</b>.
          </div>
        ) : null}

        {error && (
          <div className="mt-3 rounded-xl border border-rose-200/80 bg-[linear-gradient(135deg,rgba(255,241,242,0.96),rgba(255,255,255,0.94))] px-3 py-2 text-sm text-rose-800 shadow-[0_10px_24px_rgba(244,63,94,0.06)]">
            {error}
          </div>
        )}
        
        {notice && (
          <div className="mt-3 rounded-xl border border-emerald-200/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(255,255,255,0.94))] px-3 py-2 text-sm text-emerald-800 shadow-[0_10px_24px_rgba(16,185,129,0.06)]">
            {notice}
          </div>
        )}

        {form.mode === "edit" && (
          editingIsOff ? (
            <div className="mt-2 rounded-xl border border-amber-200/80 bg-[linear-gradient(135deg,rgba(254,243,199,0.96),rgba(255,255,255,0.94))] px-3 py-2 text-xs text-amber-900 shadow-[0_10px_24px_rgba(245,158,11,0.06)]">
              OFF template özel sistem şablonudur. Düzenleme bu ekrandan desteklenmez.
            </div>
          ) : null
        )}

        <Card tone="neutral" className="p-4 sm:p-5">
          <div className="relative">
            {embeddedSelectedRecord ? (
              <div className="absolute right-0 top-0 z-30">
                <div className="relative">
                  <Button
                    variant="secondary"
                    onClick={() => setEmbeddedActionsOpen((open) => !open)}
                    disabled={loading}
                    className="min-w-[112px]"
                  >
                    İşlemler
                    <span className="text-[10px] leading-none">{embeddedActionsOpen ? "▲" : "▼"}</span>
                  </Button>

                  {embeddedActionsOpen ? (
                    <div className="absolute right-0 z-40 mt-2 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_22px_55px_rgba(15,23,42,0.16)]">
                      <button
                        type="button"
                        className="block w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                        onClick={closeEmbeddedSelectedRecord}
                      >
                        Kapat
                      </button>
                      <button
                        type="button"
                        className="block w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={beginEmbeddedSelectedEdit}
                        disabled={readOnly || !selectedEmbeddedShiftTemplate || isOffTemplate(selectedEmbeddedShiftTemplate)}
                      >
                        Düzenle
                      </button>
                      <div className="h-px bg-slate-100" />
                      <button
                        type="button"
                        className="block w-full px-4 py-3 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={requestEmbeddedSelectedDelete}
                        disabled={readOnly || !selectedEmbeddedShiftTemplate || isOffTemplate(selectedEmbeddedShiftTemplate)}
                      >
                        Sil
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          {embeddedReadonlyDetails ? (
            <div className="mx-auto w-full max-w-[760px] rounded-[28px] border border-slate-200/80 bg-white/70 px-6 py-5 text-center shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
              <div className="grid justify-items-center gap-3">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Kod</div>
                  <div className="mt-1 font-mono text-sm font-semibold text-slate-950">
                    {embeddedReadonlyDetails.code}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Ad</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">
                    {embeddedReadonlyDetails.name || "—"}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Planlanan</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">
                    {embeddedReadonlyDetails.plannedHoursText} saat
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Başlangıç</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">
                    {embeddedReadonlyDetails.startTime}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Bitiş</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">
                    {embeddedReadonlyDetails.endTime}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Mola Planı</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">
                    {embeddedReadonlyDetails.breakText}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Beklenen</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">
                    {embeddedReadonlyDetails.expectedHoursText} saat
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Vardiya Planı</div>
                  <div className="mt-1 font-mono text-sm font-semibold text-slate-950">
                    {embeddedReadonlyDetails.signature}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
          <div className="mx-auto w-full max-w-[360px] rounded-[26px] border border-slate-200/80 bg-white/72 px-5 py-5 shadow-[0_16px_38px_rgba(15,23,42,0.06)]">            <div className="grid gap-3">
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-slate-800">Vardiya Kodu</span>
                <input
                  type="text"
                  className={inputClass}
                  value={form.shiftCode}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, shiftCode: normalizeShiftCode(e.target.value) }))
                  }
                  placeholder="Örn: S1 / GNDA"
                  disabled={loading || effectiveReadOnly || editingIsOff}
                  maxLength={4}
                />
              </label>
              
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-slate-800">Vardiya Adı</span>
                <input
                  type="text"
                  className={inputClass}
                  value={form.name}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, name: normalizeShiftNameInput(e.target.value) }))
                  }
                  placeholder="Örn: Gündüz Mesaisi"
                  disabled={loading || effectiveReadOnly || editingIsOff}
                  maxLength={120}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-slate-800">Planlanan Çalışma Saati</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className={inputClass}
                  value={form.plannedWorkHours}
                  onChange={(e) => {
                    const next = e.target.value.replace(".", ",");
                    setTouched((s) => ({ ...s, plannedWorkHours: true }));
                    setForm((s) => ({
                      ...s,
                      plannedWorkHours: next,
                      startTime: next.trim() && !s.startTime ? "00:00" : s.startTime,
                    }));
                  }}
                  onBlur={() => {
                    setForm((s) => ({ ...s, plannedWorkHours: normalizePlannedWorkHoursInput(s.plannedWorkHours) }));
                  }}
                  placeholder="Örn: 9,00"
                  disabled={loading || effectiveReadOnly || editingIsOff}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-slate-800">Başlangıç</span>
                <input
                  type="time"
                  className={inputClass}
                  value={form.startTime}
                  onChange={(e) => {
                    setTouched((s) => ({ ...s, startTime: true }));
                    setForm((s) => ({ ...s, startTime: normalizeTimeHHmm(e.target.value) }));
                  }}
                  onBlur={() => {
                    setForm((s) => ({
                      ...s,
                      startTime: s.plannedWorkHours.trim() && !s.startTime ? "00:00" : s.startTime,
                    }));
                  }}
                  disabled={loading || effectiveReadOnly || editingIsOff}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-slate-800">Bitiş</span>
                <input
                   type="time"
                  className={inputClass}
                  value={preview && !preview.invalidReason ? preview.endTime : ""}
                  onChange={(e) => {
                    const nextEndTime = normalizeTimeHHmm(e.target.value);
                    if (!nextEndTime || !preview || preview.invalidReason || typeof preview.plannedWorkMinutes !== "number") {
                      return;
                    }
                    setTouched((s) => ({ ...s, startTime: true }));
                    setForm((s) => ({
                      ...s,
                      startTime: deriveShiftStartTimeFromEndTime(nextEndTime, preview.plannedWorkMinutes),
                    }));
                  }}
                  disabled={loading || effectiveReadOnly || editingIsOff || !preview || !!preview.invalidReason}
                />
              </label>
              
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-slate-800">Mola Planı</span>
                <select
                  className={inputClass}
                  value={form.breakPlanId}
                  onChange={(e) => setForm((s) => ({ ...s, breakPlanId: e.target.value }))}
                  disabled={loading || effectiveReadOnly || editingIsOff}
                >
                  <option value="">Mola yok</option>
                  {breakPlans.map((bp) => (
                    <option key={bp.id} value={bp.id}>
                      {bp.name} / {bp.isPaid ? "Ücretli" : "Ücretsiz"}
                    </option>
                  ))}
                </select>
              </label>

              {!embeddedReadOnlyRecord ? (
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  {form.mode === "edit" && (
                    <Button variant="secondary" onClick={cancelFormEdit}>
                      Vazgeç
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    onClick={onSubmit}
                    disabled={
                      loading ||
                      effectiveReadOnly ||
                      editingIsOff ||
                      !canSubmit ||
                      !!preview?.invalidReason ||
                      (form.mode === "edit" && !isDirty)
                    }
                  >
                    {form.mode === "create" ? "Plan Oluştur" : "Değişiklikleri Kaydet"}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

        <div className="mx-auto mt-3 grid w-full max-w-[860px] gap-2 rounded-2xl border border-slate-200/75 bg-slate-50/70 p-3 sm:grid-cols-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Süre karşılığı</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {preview && !preview.invalidReason ? preview.plannedWorkHumanText : "—"}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Mola Planı</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {selectedBreakPlan ? `${selectedBreakPlan.code} / ${selectedBreakPlan.isPaid ? "Ücretli" : "Ücretsiz"}` : "Mola yok"}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Gerçekleşmesi beklenen</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {expectedPreview && !expectedPreview.invalidReason ? `${expectedPreview.expectedWorkHoursText} saat` : "—"}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Vardiya Planı</div>
            <div className="mt-1 font-mono text-sm font-semibold text-slate-900">
              {preview && !preview.invalidReason ? preview.signature : "—"}
            </div>
          </div>
        </div>

        {preview?.invalidReason ? (
          <div className={cx("mt-3 text-sm", showHardValidation ? "text-rose-600" : "text-slate-500")}>
            {showHardValidation ? preview.invalidReason : "Planlanan çalışma saati ondalık formatta olmalıdır."}
          </div>
        ) : null}
        {expectedPreview?.invalidReason ? (
          <div className="mt-3 text-sm text-rose-600">
            {expectedPreview.invalidReason}
          </div>
        ) : null}
              </>
          )}
          </div>
      </Card>
      
      {!embedded ? (
      <Card
        tone="neutral"
        className="p-0"
        title="Kayıtlı Günlük Çalışma Programları"
        right={
          <Badge tone="neutral">
            {visibleItems.length}{q.trim() ? ` / ${items.length}` : ""} kayıt
          </Badge>
        }
      >
        <div className="px-4 py-3 border-b border-slate-200 min-w-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-[linear-gradient(180deg,rgba(238,242,255,0.70),rgba(255,255,255,0.40))]">
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={cx("w-full sm:w-64", inputClass)}
                placeholder="Ara: kod / planlanan / başlangıç / bitiş"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <select
                className={cx("w-full sm:w-auto min-w-0", inputClass)}
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
              >
                <option value="signature">Sırala: Kod</option>
                <option value="startTime">Sırala: Başlangıç</option>
                <option value="createdAt">Sırala: En Yeni</option>
              </select>
              {q.trim() && (
                <Button variant="secondary" onClick={() => setQ("")} disabled={loading}>
                  Temizle
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={load} disabled={loading}>
              Yenile
            </Button>
          </div>
        </div>

        {/* Mobile-first: no horizontal overflow. Use cards on small/medium screens, table on lg+ */}
        <div className="lg:hidden p-3">
          <div className="grid gap-3">
            {visibleItems.map((it) => {
              const isEditingRow = form.mode === "edit" && form.id === it.id;
              const plannedMinutes = getShiftPlannedWorkMinutes(it);
              const plannedText = it.plannedWorkHoursText ?? formatPlannedWorkHoursText(plannedMinutes);
              const humanText = it.plannedWorkHumanText ?? formatPlannedWorkHumanText(plannedMinutes);
              const expectedText = it.expectedWorkHoursText ?? plannedText;
              return (
                <div
                  key={it.id}
                  className={
                    "rounded-2xl border bg-white p-3 shadow-sm " +
                   (isOffTemplate(it) ? "border-violet-300/80 bg-violet-50/70 shadow-[0_10px_24px_rgba(99,102,241,0.08)] " : "") +
                   (isEditingRow ? "border-amber-300/80 bg-amber-50/70 shadow-[0_10px_24px_rgba(245,158,11,0.06)]" : "border-slate-200/80 bg-white/90 shadow-[0_10px_24px_rgba(15,23,42,0.04)]")
                  }
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <ShiftCodeBadge code={it.shiftCode || "—"} />
                        {isOffTemplate(it) ? <Badge tone="violet">OFF</Badge> : null}
                        {!it.isActive ? <Badge tone="neutral">Pasif</Badge> : null}
                        {it.spansMidnight ? <Badge tone="good">+1</Badge> : null}
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-slate-600">
                        <div>
                          <span className="text-slate-500">Planlanan:</span>{" "}
                          <span className="font-semibold text-slate-900">{plannedText} saat</span>{" "}
                          <span className="text-slate-500">({humanText})</span>
                        </div>
                        <div>
                          <span className="font-medium">{it.startTime}</span> →{" "}
                          <span className="font-medium">{it.endTime}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Beklenen:</span>{" "}
                          <span className="font-medium">{expectedText} saat</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Mola:</span>{" "}
                          {it.breakPlan ? (
                            <span className="font-medium">
                              {it.breakPlan.code} / {it.breakPlan.isPaid ? "Ücretli" : "Ücretsiz"}
                            </span>
                          ) : (
                            <span className="text-slate-400">Mola yok</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-wrap justify-end gap-2">
                      {
                        !it.isActive ? (
                          <Button variant="secondary" onClick={() => onActivate(it.id)} disabled={loading || readOnly} title={readOnly ? "Read-only" : undefined}>
                            Aktifleştir
                          </Button>
                        ) : null
                      }
                      <Button
                        variant="secondary"
                        className="px-3 py-1.5"
                        disabled={readOnly || isOffTemplate(it)}
                        onClick={() => beginEdit(it)}
                        title={readOnly ? "Read-only" : isOffTemplate(it) ? "OFF template düzenlenemez" : undefined}
                      >
                        Düzenle
                      </Button>
                      <Button
                        variant="secondary"
                        className="px-3 py-1.5 text-rose-700 border-rose-200 hover:bg-rose-50/80"
                        onClick={() =>
                          !isOffTemplate(it) &&
                          setDeleteConfirm({
                            id: it.id,
                            signature: it.signature,
                          })
                        }
                        disabled={loading || readOnly || isOffTemplate(it)}
                        title={readOnly ? "Read-only" : undefined}
                      >
                        Pasifleştir
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {visibleItems.length === 0 && (
              <div className="rounded-2xl border border-slate-200/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.94))] p-4 text-sm text-slate-600 shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
                {items.length === 0 ? "Henüz şablon yok." : "Aramanla eşleşen şablon bulunamadı."}
              </div>
            )}
          </div>
        </div>

        {/* Table view (lg+). Keep any overflow inside this card to prevent page-level horizontal scroll. */}
        <div className="hidden lg:block overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full text-sm">
            <thead className="bg-[linear-gradient(180deg,rgba(238,242,255,0.96),rgba(248,250,252,0.96))] text-slate-700">
              <tr>
                <th className="text-left px-4 py-3">Kod</th>
                <th className="text-left px-4 py-3">Planlanan</th>
                <th className="text-left px-4 py-3">Süre</th>
                <th className="text-left px-4 py-3">Başlangıç</th>
                <th className="text-left px-4 py-3">Bitiş</th>
                <th className="text-left px-4 py-3">Mola</th>
                <th className="text-left px-4 py-3">Beklenen</th>
                <th className="text-left px-4 py-3">
                  <div className="leading-tight">+1</div>
                  <div className="text-[11px] font-normal text-slate-500">Gece</div>
                </th>
                <th className="text-right px-4 py-3">İşlemler</th>
              </tr>
            </thead>
           <tbody className="divide-y divide-slate-100/90">
              {visibleItems.map((it) => (
                (() => {
                  const isEditingRow = form.mode === "edit" && form.id === it.id;
                  return (
                <tr
                  key={it.id}
                  className={
                    isEditingRow
                      ? "bg-amber-50/80 text-slate-900"
                      : "hover:bg-slate-50/70 transition-colors"
                  }
                >
                  <td
                    className={
                      "px-4 py-3 font-mono " +
                      (isEditingRow ? "border-l-4 border-amber-400 pl-3" : "")
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <ShiftCodeBadge code={it.shiftCode || "—"} />
                      {!it.isActive ? <Badge tone="neutral">Pasif</Badge> : null}
                      {isOffTemplate(it) ? <Badge tone="violet">OFF</Badge> : null}
                      {it.spansMidnight ? <Badge tone="good">+1</Badge> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {it.plannedWorkHoursText ?? formatPlannedWorkHoursText(getShiftPlannedWorkMinutes(it))} saat
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {it.plannedWorkHumanText ?? formatPlannedWorkHumanText(getShiftPlannedWorkMinutes(it))}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{it.startTime}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{it.endTime}</td>
                  <td className="px-4 py-3">
                    {it.breakPlan ? (
                      <div className="grid gap-0.5">
                        <div className="font-semibold text-slate-900">
                          {it.breakPlan.code} — {it.breakPlan.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {it.breakPlan.plannedBreakHoursText ?? "—"} saat /{" "}
                          {it.breakPlan.isPaid ? "Ücretli" : "Ücretsiz"}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">Mola yok</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {it.expectedWorkHoursText ?? it.plannedWorkHoursText ?? formatPlannedWorkHoursText(getShiftPlannedWorkMinutes(it))} saat
                  </td>
                  <td className="px-4 py-3">
                    {it.spansMidnight ? <Badge tone="good">+1 / Gece</Badge> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {!it.isActive ? (
                        <Button variant="secondary" onClick={() => onActivate(it.id)} disabled={loading || readOnly} title={readOnly ? "Read-only" : undefined}>
                          Aktifleştir
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            className="px-3 py-1.5"
                            disabled={loading || readOnly || isOffTemplate(it)}
                            onClick={() => beginEdit(it)}
                            title={readOnly ? "Read-only" : isOffTemplate(it) ? "OFF template düzenlenemez" : undefined}
                          >
                            Düzenle
                          </Button>
                          <Button
                            variant="secondary"
                            className="px-3 py-1.5 text-rose-700 border-rose-200 hover:bg-rose-50/80"
                            onClick={() =>
                              !isOffTemplate(it) &&
                              setDeleteConfirm({
                                id: it.id,
                                signature: it.signature,
                              })
                            }
                            disabled={loading || readOnly || isOffTemplate(it)}
                            title={readOnly ? "Read-only" : undefined}
                          >
                            Pasifleştir
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                );
                })()
              ))}
             {visibleItems.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-600" colSpan={9}>
                    {items.length === 0 ? "Henüz şablon yok." : "Aramanla eşleşen şablon bulunamadı."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      ) : null}
    </div>
  );
}