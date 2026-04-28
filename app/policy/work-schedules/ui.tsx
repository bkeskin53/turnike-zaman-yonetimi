"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type EmployeeLite = { id: string; employeeCode: string; firstName: string; lastName: string; isActive?: boolean };

type ShiftTemplate = {
  id: string;
  name?: string | null;
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

type DayCell = string | null;
type AssignmentScope = "EMPLOYEE" | "EMPLOYEE_SUBGROUP" | "EMPLOYEE_GROUP" | "BRANCH";

type StagedAssignmentDraft = {
  clientId: string;
  scope: AssignmentScope;
  patternId: string;
  employeeId: string | null;
  employeeSubgroupId: string | null;
  employeeGroupId: string | null;
  branchId: string | null;
  priority: number;
  validFromDayKey: string | null;
  validToDayKey: string | null;
  targetLabel: string;
};

function fmtShiftLabel(t: ShiftTemplate) {
  const name = String(t.name ?? "").trim();
  const sig = t.signature ?? "";
  const code = t.shiftCode ?? "";
  if (name && code) return `${name} (${code})`;
  if (name) return name;
  if (code && code !== sig) return `${code} (${sig})`;
  return code || sig || "—";
}

function toDayKey(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
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
    xs.push(v ? v : null);
  }
  return xs;
}

function dayCellToApi(v: DayCell): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function addDaysUtc(isoDayKey: string, add: number): Date {
  const d = new Date(`${isoDayKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + add);
  return d;
}

function weekdayFromRef(referenceDayKey: string, dayIndex: number): number {
  const d = addDaysUtc(referenceDayKey, dayIndex);
  const js = d.getUTCDay();
  if (js === 0) return 7;
  return js;
}

function trWeekdayShort(wd: number): string {
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

function Button({
  variant = "secondary",
  disabled,
  onClick,
  children,
  title,
  type = "button",
  className,
}: {
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
  type?: "button" | "submit";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60";
  const styles =
    variant === "primary"
      ? "bg-indigo-600 text-white hover:bg-indigo-700"
      : variant === "danger"
      ? "bg-rose-600 text-white hover:bg-rose-700"
      : "border border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50";

  return (
    <button className={cx(base, styles, className)} onClick={onClick} disabled={disabled} title={title} type={type}>
      {children}
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] font-semibold text-slate-700">{children}</span>;
}

function normalizePatternCodeValue(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function normalizePatternNameValue(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function humanizePatternFormError(code: string): string {
  switch (String(code ?? "").trim()) {
    case "CODE_REQUIRED":
      return "Kod zorunludur.";
    case "NAME_REQUIRED":
      return "Ad zorunludur.";
    case "CYCLE_INVALID":
      return "Döngü bilgisi zorunludur.";
    case "REFERENCE_DATE_INVALID":
      return "Referans gün zorunludur.";
    case "CODE_ALREADY_EXISTS":
      return "Bu rota kodu zaten kayıtlı.";
    case "NAME_ALREADY_EXISTS":
      return "Bu rota adı zaten kayıtlı.";
    case "DAY_SHIFT_TEMPLATE_IDS_LENGTH_MISMATCH":
      return "Döngü ile vardiya günleri uzunluğu uyumlu olmalıdır.";
    case "NON_OFF_TAIL_REMOVAL_FORBIDDEN":
      return "Döngü küçültülmeden önce kaldırılacak son günlerdeki vardiyalar OFF olmalıdır.";
    case "SAVE_FAILED":
      return "Rota kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin.";
    case "INTERNAL_SERVER_ERROR":
      return "Rota oluşturulamadı. Aynı ad veya kod kullanımı kontrol edin.";
    default:
      return "Rota oluşturulamadı. Lütfen bilgileri kontrol edip tekrar deneyin.";
  }
}

function humanizeAssignmentFormError(code: string): string {
  switch (String(code ?? "").trim()) {
    case "SCOPE_REQUIRED":
      return "Atama kapsamı zorunludur.";
    case "EMPLOYEE_REQUIRED":
      return "Personel kapsamı için personel seçmelisiniz.";
    case "SUBGROUP_REQUIRED":
      return "Personel alt grubu kapsamı için alt grup seçmelisiniz.";
    case "GROUP_REQUIRED":
      return "Personel grubu kapsamı için grup seçmelisiniz.";
    case "BRANCH_REQUIRED":
      return "Şube kapsamı için şube seçmelisiniz.";
    case "VALID_FROM_INVALID":
      return "Geçerlilik başlangıcı geçerli bir tarih olmalıdır.";
    case "VALID_TO_INVALID":
      return "Geçerlilik bitişi geçerli bir tarih olmalıdır.";
    case "VALID_RANGE_INVALID":
      return "Geçerlilik bitişi başlangıçtan önce olamaz.";
    case "ASSIGNMENT_NOT_FOUND":
      return "Silinmek üzere işaretlenen atamalardan en az biri artık bulunamadı. Listeyi yenileyip tekrar deneyin.";
    case "ASSIGNMENT_PATTERN_MISMATCH":
      return "Silinmek üzere işaretlenen atamalar bu rota ile uyumlu değil. Listeyi yenileyip tekrar deneyin.";
    case "DELETE_FAILED":
      return "Atama silme değişikliği kaydedilemedi. Lütfen tekrar deneyin.";
    case "UNSTAGED_ASSIGNMENT_FORM":
      return "Atama formundaki bekleyen bilgileri önce listeye ekleyin veya alanları temizleyin.";
    case "SAVE_FAILED":
      return "Atama değişiklikleri kaydedilemedi. Lütfen tekrar deneyin.";
    default:
      return "Atama bilgileri kaydedilemedi. Lütfen kontrol edip tekrar deneyin.";
  }
}

function isIsoDayKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "").trim());
}

const inputClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15 disabled:opacity-60";

const quickShiftSelectClass =
  "h-10 w-full sm:w-[220px] md:w-[250px] rounded-xl border border-slate-200 bg-slate-50/90 px-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition hover:border-slate-300 hover:bg-white focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none";

const dayShiftSelectClass =
  "h-10 w-full max-w-[320px] rounded-xl border border-slate-200 bg-slate-50/90 px-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition hover:border-slate-300 hover:bg-white focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none";

const assignmentControlClass = cx(inputClass, "max-w-[320px]");

const assignmentPersonSearchRowClass =
  "grid max-w-[390px] gap-2 md:grid-cols-[minmax(0,320px)_auto]";

const cardClass = "rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5";

type EmbeddedPatternOption = {
  value: string;
  label: string;
};

export default function WorkSchedulesClient({
  canWrite,
  embedded = false,
  onDirtyStateChange,
  embeddedCreateRequested = false,
  selectedPatternId,
  onSelectedPatternIdChange,
  onEmbeddedPatternOptionsChange,
  hideEmbeddedPatternPicker = false,
}: {
  canWrite: boolean;
  embedded?: boolean;
  embeddedCreateRequested?: boolean;
  onDirtyStateChange?: (isDirty: boolean) => void;
  selectedPatternId?: string;
  onSelectedPatternIdChange?: (nextValue: string) => void;
  onEmbeddedPatternOptionsChange?: (options: EmbeddedPatternOption[]) => void;
  hideEmbeddedPatternPicker?: boolean;
}) {
  const readOnly = !canWrite;
  const surfaceCardClass = embedded
    ? "rounded-2xl border border-slate-200 bg-white p-3.5 md:p-4"
    : cardClass;
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [groups, setGroups] = useState<EmployeeGroup[]>([]);
  const [subgroups, setSubgroups] = useState<EmployeeSubgroup[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [activePatternIdState, setActivePatternIdState] = useState<string>("");
  const [freshCreatedPatternId, setFreshCreatedPatternId] = useState<string>("");
  const [selectedRouteEditMode, setSelectedRouteEditMode] = useState<boolean>(false);
  const [editDays, setEditDays] = useState<DayCell[]>([]);
  const [dayPlanErrorIndexes, setDayPlanErrorIndexes] = useState<number[]>([]);
  const [dayPlanErrorMessage, setDayPlanErrorMessage] = useState<string>("");
  const [dayPlanErrorFocusTick, setDayPlanErrorFocusTick] = useState<number>(0);
  const [bulkTemplateId, setBulkTemplateId] = useState<string>("");

  const [code, setCode] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [cycleLengthDays, setCycleLengthDays] = useState<number>(7);
  const [referenceDayKey, setReferenceDayKey] = useState<string>("1990-01-01");

  const [scope, setScope] = useState<string>("");
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
  const [stagedAssignments, setStagedAssignments] = useState<StagedAssignmentDraft[]>([]);
  const [removedAssignmentIds, setRemovedAssignmentIds] = useState<string[]>([]);
  const [assignmentDraftError, setAssignmentDraftError] = useState<string>("");
  const [workspaceSaving, setWorkspaceSaving] = useState<boolean>(false);
  const [pendingSelectedRouteExit, setPendingSelectedRouteExit] = useState<boolean>(false);
  const [pendingPatternSwitchId, setPendingPatternSwitchId] = useState<string>("");
  const [createPatternError, setCreatePatternError] = useState<string>("");
  const [pendingPatternDelete, setPendingPatternDelete] = useState<boolean>(false);
  const [deleteSaving, setDeleteSaving] = useState<boolean>(false);
  const [selectedRouteActionMenuOpen, setSelectedRouteActionMenuOpen] = useState<boolean>(false);
  const [portalReady, setPortalReady] = useState(false);
  const selectedRouteActionMenuRef = useRef<HTMLDivElement | null>(null);
  const dayPlanErrorRef = useRef<HTMLDivElement | null>(null);
  const previousActivePatternIdRef = useRef<string>("");
  const createdPatternActivationRef = useRef<string>("");
  const stagedAssignmentSequenceRef = useRef<number>(0);

  const activePatternId = embedded
    ? String(selectedPatternId ?? "")
    : activePatternIdState;

  const setResolvedActivePatternId = (
    nextValue: string | ((prev: string) => string),
  ) => {
    const resolvedValue =
      typeof nextValue === "function"
        ? nextValue(activePatternId)
        : nextValue;

    if (embedded) {
      onSelectedPatternIdChange?.(resolvedValue);
      return;
    }

    setActivePatternIdState(resolvedValue);
  };

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
      const stJson = await stRes.json().catch(() => null);
      const pJson = await pRes.json().catch(() => null);
      const aJson =
        aRes.status === 404
          ? { items: [] }
          : await aRes.json().catch(() => null);
      const gJson = await gRes.json().catch(() => null);
      const sgJson = await sgRes.json().catch(() => null);
      const bJson = await bRes.json().catch(() => null);

      if (!stRes.ok) {
        throw new Error(String(stJson?.error ?? "SHIFT_TEMPLATES_LOAD_FAILED"));
      }

      if (!pRes.ok) {
        throw new Error(String(pJson?.error ?? "WORK_SCHEDULES_LOAD_FAILED"));
      }

      if (!aRes.ok && aRes.status !== 404) {
        throw new Error(String(aJson?.error ?? "ASSIGNMENTS_LOAD_FAILED"));
      }

      setShiftTemplates(Array.isArray(stJson.items) ? stJson.items : []);
      setPatterns(Array.isArray(pJson.items) ? pJson.items : []);
      setAssignments(Array.isArray(aJson?.items) ? aJson.items : []);
      setGroups(Array.isArray(gJson?.items) ? gJson.items : []);
      setSubgroups(Array.isArray(sgJson?.items) ? sgJson.items : []);
      setBranches(Array.isArray(bJson) ? bJson : []);
    } catch (e) {
      console.error("[work-schedules] loadAll failed", e);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!selectedRouteActionMenuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (selectedRouteActionMenuRef.current?.contains(target)) return;
      setSelectedRouteActionMenuOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedRouteActionMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [selectedRouteActionMenuOpen]);

  useEffect(() => {
    if (!dayPlanErrorMessage || dayPlanErrorFocusTick <= 0) return;

    const frame = window.requestAnimationFrame(() => {
      const target = dayPlanErrorRef.current;
      if (!target) return;

      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
      target.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [dayPlanErrorMessage, dayPlanErrorFocusTick]);

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

  useEffect(() => {
    if (!patterns.length) {
      setResolvedActivePatternId("");
      return;
    }
    
    setResolvedActivePatternId((prev) => {
      if (prev && patterns.some((p) => p.id === prev)) return prev;
      return "";
    });
  }, [patterns]);

  useEffect(() => {
    if (activePatternId) return;
    setCode("");
    setName("");
    setCycleLengthDays(7);
    setReferenceDayKey("1990-01-01");
    setCreatePatternError("");
  }, [activePatternId]);

  useEffect(() => {
    if (!embedded) return;
    if (embeddedCreateRequested) return;
    if (activePatternId) return;
    setCode("");
    setName("");
    setCycleLengthDays(7);
    setReferenceDayKey("1990-01-01");
    setCreatePatternError("");
  }, [embedded, embeddedCreateRequested, activePatternId]);

  useEffect(() => {
    const previousActivePatternId = previousActivePatternIdRef.current;

    if (!activePatternId) {
      previousActivePatternIdRef.current = "";
      createdPatternActivationRef.current = "";
      setSelectedRouteEditMode(false);
      return;
    }

    if (activePatternId === previousActivePatternId) {
      return;
    }

    const openedFromCreateFlow = createdPatternActivationRef.current === activePatternId;

    setSelectedRouteEditMode(openedFromCreateFlow);
    previousActivePatternIdRef.current = activePatternId;
    createdPatternActivationRef.current = "";
  }, [activePatternId]);

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

  useEffect(() => {
    if (scope !== "EMPLOYEE") return;
    const t = setTimeout(() => loadEmployees(employeeQuery), 250);
    return () => clearTimeout(t);
  }, [scope, employeeQuery]);

  const activePattern = useMemo(() => {
    if (!activePatternId) return null;
    return patterns.find((p) => p.id === activePatternId) ?? null;
  }, [patterns, activePatternId]);

  useEffect(() => {
    if (!activePattern) return;
    if (selectedRouteEditMode) return;
    setCode(String(activePattern.code ?? ""));
    setName(String(activePattern.name ?? ""));
    setCycleLengthDays(Number(activePattern.cycleLengthDays ?? 7) || 7);
    setReferenceDayKey(toDayKey(activePattern.referenceDate) || "1990-01-01");
    setCreatePatternError("");
  }, [activePattern, selectedRouteEditMode]);

  useEffect(() => {
    if (!activePattern) {
      setEditDays([]);
      setDayPlanErrorIndexes([]);
      setDayPlanErrorMessage("");
      setBulkTemplateId("");
      return;
    }
    const sourceDays = toDayCells(activePattern);
    const shouldOpenBlankDays =
      freshCreatedPatternId === activePattern.id && sourceDays.every((day) => day == null);

    setEditDays(
      shouldOpenBlankDays
        ? Array.from({ length: Number(activePattern.cycleLengthDays ?? 0) }, () => "")
        : sourceDays
    );
    setDayPlanErrorIndexes([]);
    setDayPlanErrorMessage("");
    setBulkTemplateId("");
  }, [activePattern, freshCreatedPatternId]);

  useEffect(() => {
    setStagedAssignments([]);
    setRemovedAssignmentIds([]);
    setAssignmentDraftError("");
  }, [activePatternId]);

  const groupOptions = useMemo(
    () => (groups ?? []).slice().sort((a, b) => (a.code ?? "").localeCompare(b.code ?? "")),
    [groups]
  );

  const subgroupOptions = useMemo(
    () => (subgroups ?? []).slice().sort((a, b) => (a.code ?? "").localeCompare(b.code ?? "")),
    [subgroups]
  );

  const branchOptions = useMemo(
    () => (branches ?? []).filter((b) => b.isActive).slice().sort((a, b) => a.code.localeCompare(b.code)),
    [branches]
  );

  const shiftOptions = useMemo(() => (shiftTemplates ?? []).filter((x) => x.isActive), [shiftTemplates]);

  const patternOptions = useMemo(() => (patterns ?? []).filter((p) => p.isActive), [patterns]);

  const embeddedPatternOptions = useMemo<EmbeddedPatternOption[]>(
    () =>
      patternOptions.map((pattern) => ({
        value: pattern.id,
        label: `${pattern.code} — ${pattern.name}`,
      })),
    [patternOptions],
  );

  useEffect(() => {
    if (!embedded) return;
    onEmbeddedPatternOptionsChange?.(embeddedPatternOptions);
  }, [embedded, embeddedPatternOptions, onEmbeddedPatternOptionsChange]);

  const persistedActiveAssignments = useMemo(() => {
    if (!activePatternId) return [];
    return assignments.filter((a) => a.patternId === activePatternId || a.pattern?.id === activePatternId);
  }, [assignments, activePatternId]);

  const activeAssignmentRows = useMemo(() => {
    const stagedRows = stagedAssignments.map((draft) => ({ kind: "staged" as const, draft }));
    const persistedRows = persistedActiveAssignments.map((assignment) => ({
      kind: "persisted" as const,
      assignment,
      pendingDelete: removedAssignmentIds.includes(String(assignment.id ?? "")),
    }));
    return [...stagedRows, ...persistedRows];
  }, [persistedActiveAssignments, stagedAssignments, removedAssignmentIds]);

  const pendingPatternSwitchTarget = useMemo(() => {
    if (!pendingPatternSwitchId) return null;
    return patterns.find((pattern) => pattern.id === pendingPatternSwitchId) ?? null;
  }, [patterns, pendingPatternSwitchId]);

  const isCreateMode = !activePattern && (!embedded || embeddedCreateRequested);

  const shouldRenderEmbeddedWorkspace =
    !embedded || !!activePatternId || embeddedCreateRequested;

  const centerCreateCard =
    embedded && hideEmbeddedPatternPicker && isCreateMode;

  const centerSelectedRouteCard =
    embedded && hideEmbeddedPatternPicker && !isCreateMode && !!activePattern;

  const centerTopCard = centerCreateCard || centerSelectedRouteCard;
  const selectedRouteMode = selectedRouteEditMode ? "edit" : "view";
  const selectedRouteDayReferenceDayKey = activePattern
    ? selectedRouteEditMode
      ? String(referenceDayKey ?? "").trim() || toDayKey(activePattern.referenceDate)
      : toDayKey(activePattern.referenceDate)
    : "";
  const hasSelectedRouteMetaDraft = useMemo(() => {
    if (!activePattern || !selectedRouteEditMode) return false;
    return (
      normalizePatternCodeValue(code) !== normalizePatternCodeValue(activePattern.code) ||
      normalizePatternNameValue(name) !== normalizePatternNameValue(activePattern.name) ||
      Number(cycleLengthDays) !== Number(activePattern.cycleLengthDays ?? 0) ||
      String(referenceDayKey ?? "").trim() !== toDayKey(activePattern.referenceDate)
    );
  }, [activePattern, selectedRouteEditMode, code, name, cycleLengthDays, referenceDayKey]);
  const selectedRouteCycleLengthChanged =
    !!activePattern &&
    selectedRouteEditMode &&
    Number(cycleLengthDays) !== Number(activePattern.cycleLengthDays ?? 0);
  const selectedRouteCycleHint =
    selectedRouteEditMode && activePattern && selectedRouteCycleLengthChanged
      ? Number(cycleLengthDays) > Number(activePattern.cycleLengthDays ?? 0)
        ? "Döngü büyütülürse yeni eklenen günler OFF olarak açılır."
        : "Döngü küçültülürse sadece sondaki OFF günler güvenle kaldırılabilir."
      : "";
  const selectedRouteMutationsLocked = !!activePattern && !selectedRouteEditMode;
  const selectedRouteMutationDisabled = readOnly || selectedRouteMutationsLocked;
  const selectedRouteMutationTitle = readOnly
    ? "Salt okunur"
    : selectedRouteMutationsLocked
      ? "Düzenlemek için önce üst karttan Düzenle'yi kullanın"
      : undefined;
  const selectedRouteEditActionLabel = selectedRouteEditMode ? "Düzenleme Açık" : "Düzenle";
  const selectedRouteEditActionTitle = readOnly
    ? "Salt okunur"
    : selectedRouteEditMode
      ? "Sayfanın altındaki kaydet alanını kullanın"
      : "Düzenlemeyi aç";
  const selectedRouteWorkspaceActionDisabled =
    workspaceSaving || loading || saving || deleteSaving || readOnly || !selectedRouteEditMode;
  const selectedRouteWorkspaceActionTitle = readOnly
    ? "Salt okunur"
    : !selectedRouteEditMode
      ? "Önce düzenlemeyi açın"
      : undefined;
  const selectedRouteCloseActionDisabled = loading || saving || deleteSaving || workspaceSaving || readOnly;
  const selectedRouteEditActionDisabled =
    loading ||
    saving ||
    deleteSaving ||
    workspaceSaving ||
    readOnly ||
    selectedRouteEditMode;
  const selectedRouteDeleteActionDisabled =
    loading || saving || deleteSaving || workspaceSaving || readOnly || !activePattern;
  const selectedRouteActionMenuDisabled =
    !activePattern ||
    (selectedRouteCloseActionDisabled &&
      selectedRouteEditActionDisabled &&
      selectedRouteDeleteActionDisabled);
  const hasPendingPatternSwitch = !!pendingPatternSwitchId;
  const selectedRouteExitDialogTitle = hasPendingPatternSwitch
    ? "Kayıt değiştirilsin mi?"
    : "Bu sekme kapatılsın mı?";
  const selectedRouteExitDialogDescription = hasPendingPatternSwitch
    ? "Kaydedilmemiş rota değişiklikleri silinecek. Başka bir kayıt açmak istiyor musunuz?"
    : "Kaydedilmemiş rota değişiklikleri silinecek. Bu sekmeyi kapatmak istiyor musunuz?";
  const selectedRouteExitConfirmText = hasPendingPatternSwitch
    ? "Kaydı Değiştir"
    : "Sekmeyi Kapat";

  const topCardStackMarginClass =
    embedded && hideEmbeddedPatternPicker ? "mt-1.5" : "mt-2";

  function resolveCreatedPatternId(payload: any): string {
    const candidates = [
      payload?.item?.id,
      payload?.data?.id,
      payload?.pattern?.id,
      payload?.id,
    ];
    for (const candidate of candidates) {
      const value = String(candidate ?? "").trim();
      if (value) return value;
    }
    return "";
  }

  const hasDayPlanDraft = useMemo(() => {
    if (!activePattern) return false;
    const source = toDayCells(activePattern);
    if (source.length !== editDays.length) return true;
    for (let i = 0; i < source.length; i++) {
      if ((source[i] ?? null) !== (editDays[i] ?? null)) return true;
    }
    return false;
  }, [activePattern, editDays]);

  const canCopyFirstWeekToAllWeeks = useMemo(() => {
    if (editDays.length < 7) return false;
    return editDays.slice(0, 7).every((value) => {
      if (value === null) return true;
      return String(value ?? "").trim().length > 0;
    });
  }, [editDays]);

  const hasAssignmentComposerDraft =
    !!String(scope ?? "").trim() ||
    priority !== 100 ||
    !!selectedGroupId ||
    !!selectedSubgroupId ||
    !!selectedBranchId ||
    !!selectedEmployeeId ||
    !!employeeQuery.trim() ||
    !!validFromDayKey ||
    !!validToDayKey;

  const hasAssignmentStagingDraft = stagedAssignments.length > 0 || removedAssignmentIds.length > 0;

  const hasSelectedRouteDraft =
    !!activePattern &&
    selectedRouteEditMode &&
    (hasSelectedRouteMetaDraft || hasDayPlanDraft || hasAssignmentComposerDraft || hasAssignmentStagingDraft);

  const hasCreatePatternDraft = useMemo(() => {
    if (!isCreateMode) return false;
    return (
      !!String(code ?? "").trim() ||
      !!String(name ?? "").trim() ||
      Number(cycleLengthDays) !== 7 ||
      String(referenceDayKey ?? "").trim() !== "1990-01-01"
    );
  }, [isCreateMode, code, name, cycleLengthDays, referenceDayKey]);

  const hasWorkspaceDraft = useMemo(() => {
    if (readOnly) return false;
    if (hasCreatePatternDraft) return true;
    if (hasSelectedRouteDraft) return true;
    return false;
  }, [readOnly, hasCreatePatternDraft, hasSelectedRouteDraft]);

  useEffect(() => {
    onDirtyStateChange?.(hasWorkspaceDraft);
  }, [hasWorkspaceDraft, onDirtyStateChange]);

  function changeAssignmentScope(nextScope: string) {
    setScope(nextScope);
    setEmployeeGroupId("");
    setEmployeeSubgroupId("");
    setBranchId("");
    setEmployeeId("");
    setSelectedGroupId("");
    setSelectedSubgroupId("");
    setSelectedBranchId("");
    setSelectedEmployeeId("");
    setEmployees([]);
    setEmployeeQuery("");
    setAssignmentDraftError("");
  }

  function resetAssignmentComposer() {
    setScope("");
    setEmployeeGroupId("");
    setEmployeeSubgroupId("");
    setBranchId("");
    setEmployeeId("");
    setPriority(100);
    setSelectedGroupId("");
    setSelectedSubgroupId("");
    setSelectedBranchId("");
    setEmployees([]);
    setEmployeeQuery("");
    setSelectedEmployeeId("");
    setValidFromDayKey("");
    setValidToDayKey("");
    setAssignmentDraftError("");
  }

  function clearStagedAssignmentChanges() {
    setStagedAssignments([]);
    setRemovedAssignmentIds([]);
    setAssignmentDraftError("");
  }

  function revertSelectedRouteEditorToActivePattern() {
    if (!activePattern) return;
    setCode(String(activePattern.code ?? ""));
    setName(String(activePattern.name ?? ""));
    setCycleLengthDays(Number(activePattern.cycleLengthDays ?? 7) || 7);
    setReferenceDayKey(toDayKey(activePattern.referenceDate) || "1990-01-01");
    setEditDays(toDayCells(activePattern));
    setDayPlanErrorIndexes([]);
    setDayPlanErrorMessage("");
    setBulkTemplateId("");
    setCreatePatternError("");
    clearStagedAssignmentChanges();
    resetAssignmentComposer();
  }

  function resetSelectedRouteWorkspace() {
    setPendingSelectedRouteExit(false);
    setPendingPatternSwitchId("");
    setPendingPatternDelete(false);
    setDeleteSaving(false);
    setWorkspaceSaving(false);
    setSelectedRouteEditMode(false);
    setResolvedActivePatternId("");
    setFreshCreatedPatternId("");
    setDayPlanErrorIndexes([]);
    setDayPlanErrorMessage("");
    setCreatePatternError("");
    setCode("");
    setName("");
    setCycleLengthDays(7);
    setReferenceDayKey("1990-01-01");
    clearStagedAssignmentChanges();
    resetAssignmentComposer();
  }

  function cancelSelectedRouteEditing() {
    if (!activePattern || !selectedRouteEditMode) return;
    revertSelectedRouteEditorToActivePattern();
    setPendingPatternDelete(false);
    setPendingPatternSwitchId("");
    setPendingSelectedRouteExit(false);
    setSelectedRouteEditMode(false);
  }

  function handleCloseSelectedRouteWorkspace() {
    if (hasSelectedRouteDraft) {
      setPendingPatternSwitchId("");
      setPendingSelectedRouteExit(true);
      return;
    }
    resetSelectedRouteWorkspace();
  }

  function handleSelectedRoutePickerChange(nextPatternId: string) {
    const nextValue = String(nextPatternId ?? "");
    if (nextValue === activePatternId) return;
    if (hasSelectedRouteDraft) {
      setPendingPatternSwitchId(nextValue);
      setPendingSelectedRouteExit(true);
      return;
    }
    setResolvedActivePatternId(nextValue);
  }

  function openSelectedRouteEditMode() {
    if (!activePattern || readOnly || selectedRouteEditMode) return;
    setPendingPatternDelete(false);
    setCreatePatternError("");
    setAssignmentDraftError("");
    setPendingPatternSwitchId("");
    setPendingSelectedRouteExit(false);
    setSelectedRouteEditMode(true);
  }

  function confirmSelectedRouteExitIntent() {
    const nextPatternId = pendingPatternSwitchId;
    setPendingSelectedRouteExit(false);
    setPendingPatternSwitchId("");
    if (nextPatternId) {
      setSelectedRouteEditMode(false);
      setResolvedActivePatternId(nextPatternId);
      return;
    }
    resetSelectedRouteWorkspace();
  }

  function validateDayPlanDraftState(): boolean {
    const invalidIndexes = editDays.reduce<number[]>((acc, value, index) => {
      if (value !== null && String(value).trim() === "") {
        acc.push(index);
      }
      return acc;
    }, []);
    if (invalidIndexes.length > 0) {
      setDayPlanErrorIndexes(invalidIndexes);
      setDayPlanErrorMessage("OFF olmayan günler için vardiya seçmelisiniz.");
      setDayPlanErrorFocusTick((value) => value + 1);
      return false;
    }

    setDayPlanErrorIndexes([]);
    setDayPlanErrorMessage("");
    return true;
  }

  function buildSelectedRoutePatternPayload(): { body: Record<string, unknown> } | { error: string } {
    if (!activePattern) return { error: "SAVE_FAILED" };

    const validationError = validateCreatePatternDraft();
    if (validationError) {
      return { error: validationError };
    }

    if (!validateDayPlanDraftState()) {
      return { error: "DAY_PLAN_INVALID" };
    }

    const nextCycle = Number(cycleLengthDays);
    const normalizedEditDays = editDays.map(dayCellToApi);
    let nextDayShiftTemplateIds = normalizedEditDays.slice();

    if (nextCycle < normalizedEditDays.length) {
      const removedTail = normalizedEditDays.slice(nextCycle);
      if (removedTail.some((value) => value !== null)) {
        return { error: "Döngü küçültülmeden önce kaldırılacak son günlerdeki vardiyalar OFF olmalıdır." };
      }
      nextDayShiftTemplateIds = normalizedEditDays.slice(0, nextCycle);
    }

    if (nextCycle > normalizedEditDays.length) {
      nextDayShiftTemplateIds = [
        ...normalizedEditDays,
        ...Array.from({ length: nextCycle - normalizedEditDays.length }, () => null),
      ];
    }

    return {
      body: {
        code,
        name,
        cycleLengthDays: nextCycle,
        referenceDayKey,
      dayShiftTemplateIds: nextDayShiftTemplateIds,
      },
    };
  }

  function validateCreatePatternDraft(): string | null {
    if (!String(code ?? "").trim()) return "Kod zorunludur.";
    if (!String(name ?? "").trim()) return "Ad zorunludur.";
    const cycle = Number(cycleLengthDays);
    if (!Number.isInteger(cycle) || cycle <= 0 || cycle > 366) return "Döngü bilgisi zorunludur.";
    if (!String(referenceDayKey ?? "").trim()) return "Referans gün zorunludur.";
    return null;
  }

  function validateAssignmentComposerDraft(): { error: string | null; targetLabel: string } {
    const normalizedScope = String(scope ?? "").trim() as AssignmentScope;
    if (!normalizedScope) return { error: "SCOPE_REQUIRED", targetLabel: "" };

    let targetLabel = "";

    if (normalizedScope === "EMPLOYEE") {
      const employee = employees.find((item) => item.id === selectedEmployeeId);
      if (!selectedEmployeeId) return { error: "EMPLOYEE_REQUIRED", targetLabel: "" };
      const full = `${employee?.firstName ?? ""} ${employee?.lastName ?? ""}`.trim();
      targetLabel = employee ? `${employee.employeeCode} — ${full || "—"}` : selectedEmployeeId;
    }

    if (normalizedScope === "EMPLOYEE_GROUP") {
      const group = groupOptions.find((item) => item.id === selectedGroupId);
      if (!selectedGroupId) return { error: "GROUP_REQUIRED", targetLabel: "" };
      targetLabel = group ? `${group.code} — ${group.name}` : selectedGroupId;
    }

    if (normalizedScope === "EMPLOYEE_SUBGROUP") {
      const subgroup = subgroupOptions.find((item) => item.id === selectedSubgroupId);
      if (!selectedSubgroupId) return { error: "SUBGROUP_REQUIRED", targetLabel: "" };
      targetLabel = subgroup ? `${subgroup.code} — ${subgroup.name}` : selectedSubgroupId;
    }

    if (normalizedScope === "BRANCH") {
      const branch = branchOptions.find((item) => item.id === selectedBranchId);
      if (!selectedBranchId) return { error: "BRANCH_REQUIRED", targetLabel: "" };
      targetLabel = branch ? `${branch.code} — ${branch.name}` : selectedBranchId;
    }

    const normalizedValidFrom = String(validFromDayKey ?? "").trim();
    const normalizedValidTo = String(validToDayKey ?? "").trim();

    if (normalizedValidFrom && !isIsoDayKey(normalizedValidFrom)) {
      return { error: "VALID_FROM_INVALID", targetLabel };
    }

    if (normalizedValidTo && !isIsoDayKey(normalizedValidTo)) {
      return { error: "VALID_TO_INVALID", targetLabel };
    }

    if (normalizedValidFrom && normalizedValidTo && normalizedValidTo < normalizedValidFrom) {
      return { error: "VALID_RANGE_INVALID", targetLabel };
    }

    return { error: null, targetLabel };
  }

  function buildAssignmentWorkspacePayload(draft: StagedAssignmentDraft) {
    const body: Record<string, unknown> = {
      scope: draft.scope,
      priority: draft.priority,
      validFromDayKey: draft.validFromDayKey,
      validToDayKey: draft.validToDayKey,
    };

    if (draft.scope === "EMPLOYEE") body.employeeId = draft.employeeId;
    if (draft.scope === "EMPLOYEE_GROUP") body.employeeGroupId = draft.employeeGroupId;
    if (draft.scope === "EMPLOYEE_SUBGROUP") body.employeeSubgroupId = draft.employeeSubgroupId;
    if (draft.scope === "BRANCH") body.branchId = draft.branchId;

    return body;
  }

  async function createPattern() {
    if (readOnly) return;
    const validationError = validateCreatePatternDraft();
    if (validationError) {
      setCreatePatternError(validationError);
      return;
    }

    setCreatePatternError("");
    setSaving(true);
    try {
      const cycle = Number(cycleLengthDays);
      const dayShiftTemplateIds = Array.from({ length: cycle }, () => null);

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
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(json?.error ?? "SAVE_FAILED"));
      const createdId = resolveCreatedPatternId(json);
      if (createdId) {
        createdPatternActivationRef.current = createdId;
        const optimisticPattern: Pattern = {
          id: createdId,
          code,
          name,
          cycleLengthDays: cycle,
          referenceDate: referenceDayKey,
          dayShiftTemplateIds: dayShiftTemplateIds.map((x) => x ?? ""),
          isActive: true,
        };
        setPatterns((prev) => {
          const rest = prev.filter((p) => p.id !== createdId);
          return [...rest, optimisticPattern];
        });
        setFreshCreatedPatternId(createdId);
        setResolvedActivePatternId(createdId);
        setEditDays(Array.from({ length: cycle }, () => ""));
        setBulkTemplateId("");
      }
      await loadAll();

      let resolvedId = createdId;
      if (!resolvedId) {
        const listRes = await fetch("/api/policy/work-schedules");
        const listJson = await listRes.json().catch(() => null);
        const items = Array.isArray(listJson?.items) ? (listJson.items as Pattern[]) : [];
        if (items.length) {
          setPatterns(items);
          const matched = items
            .slice()
            .reverse()
            .find(
              (p) =>
                String(p.code ?? "").trim() === code.trim() &&
                String(p.name ?? "").trim() === name.trim() &&
                Number(p.cycleLengthDays ?? 0) === cycle &&
                toDayKey(p.referenceDate) === referenceDayKey
            );
          resolvedId = String(matched?.id ?? "").trim();
        }
      }

      if (resolvedId) {
        createdPatternActivationRef.current = resolvedId;
        setFreshCreatedPatternId(resolvedId);
        setResolvedActivePatternId(resolvedId);
      }
    } catch (e: any) {
      const code = String(e?.message ?? "SAVE_FAILED");
      setCreatePatternError(humanizePatternFormError(code));
    } finally {
      setSaving(false);
    }
  }

  function setDay(i: number, v: DayCell) {
    if (selectedRouteMutationDisabled) return;
    setEditDays((prev) => {
      const xs = prev.slice();
      xs[i] = v;
      return xs;
    });
    setDayPlanErrorIndexes((prev) => prev.filter((idx) => idx !== i));
    setDayPlanErrorMessage("");
  }

  function fillAllOff() {
    if (selectedRouteMutationDisabled) return;
    setEditDays((prev) => prev.map(() => null));
    setDayPlanErrorIndexes([]);
    setDayPlanErrorMessage("");
  }

  function fillAllWithTemplate(tplId: string) {
    if (selectedRouteMutationDisabled) return;
    const v = String(tplId ?? "").trim();
    if (!v) return;
    setEditDays((prev) => prev.map(() => v));
    setDayPlanErrorIndexes([]);
    setDayPlanErrorMessage("");
  }

  function fillWeekdaysTemplateWeekendOff(tplId: string) {
    if (selectedRouteMutationDisabled) return;
    const v = String(tplId ?? "").trim();
    if (!v || !activePattern) return;
    const ref = selectedRouteDayReferenceDayKey;
    if (!ref) return;
    setEditDays((prev) => {
      const xs = prev.slice();
      for (let i = 0; i < xs.length; i++) {
        const wd = weekdayFromRef(ref, i);
        const isWeekend = wd === 6 || wd === 7;
        xs[i] = isWeekend ? null : v;
      }
      return xs;
    });
    setDayPlanErrorIndexes([]);
    setDayPlanErrorMessage("");
  }

  function copyFirstWeekToAllWeeks() {
    if (selectedRouteMutationDisabled) return;
    const cycle = editDays.length;
    if (!Number.isFinite(cycle) || cycle < 7) return;
    setEditDays((prev) => {
      const xs = prev.slice();
      const base = xs.slice(0, 7);
      for (let i = 0; i < xs.length; i++) xs[i] = base[i % 7] ?? null;
      return xs;
    });
    setDayPlanErrorIndexes([]);
    setDayPlanErrorMessage("");
  }

  function stageAssignmentDraft() {
    if (selectedRouteMutationDisabled || !activePatternId) return;

    const validation = validateAssignmentComposerDraft();
    if (validation.error) {
      setAssignmentDraftError(humanizeAssignmentFormError(validation.error));
      return;
    }

    stagedAssignmentSequenceRef.current += 1;
    const clientId = `assignment-draft-${stagedAssignmentSequenceRef.current}`;
    const normalizedScope = String(scope ?? "").trim() as AssignmentScope;

    setStagedAssignments((prev) => [
      ...prev,
      {
        clientId,
        scope: normalizedScope,
        patternId: activePatternId,
        employeeId: normalizedScope === "EMPLOYEE" ? selectedEmployeeId || null : null,
        employeeSubgroupId: normalizedScope === "EMPLOYEE_SUBGROUP" ? selectedSubgroupId || null : null,
        employeeGroupId: normalizedScope === "EMPLOYEE_GROUP" ? selectedGroupId || null : null,
        branchId: normalizedScope === "BRANCH" ? selectedBranchId || null : null,
        priority: Number.isFinite(priority) ? Math.trunc(priority) : 0,
        validFromDayKey: String(validFromDayKey ?? "").trim() || null,
        validToDayKey: String(validToDayKey ?? "").trim() || null,
        targetLabel: validation.targetLabel,
      },
    ]);

    resetAssignmentComposer();
  }

  function removeStagedAssignmentDraft(clientId: string) {
    if (!clientId || selectedRouteMutationDisabled) return;
    setStagedAssignments((prev) => prev.filter((draft) => draft.clientId !== clientId));
    setAssignmentDraftError("");
  }

  function togglePersistedAssignmentRemoval(id: string) {
    if (!id || selectedRouteMutationDisabled) return;
    setRemovedAssignmentIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
    setAssignmentDraftError("");
  }

  async function saveSelectedRouteWorkspace() {
    if (!activePattern || selectedRouteWorkspaceActionDisabled) return;

    if (hasAssignmentComposerDraft) {
      setAssignmentDraftError(humanizeAssignmentFormError("UNSTAGED_ASSIGNMENT_FORM"));
      return;
    }

    const payloadResult = buildSelectedRoutePatternPayload();
    if ("error" in payloadResult) {
      if (payloadResult.error !== "DAY_PLAN_INVALID") {
        setCreatePatternError(humanizePatternFormError(payloadResult.error));
      }
      return;
    }

    setCreatePatternError("");
    setAssignmentDraftError("");
    setWorkspaceSaving(true);
    try {
      const res = await fetch("/api/policy/work-schedules/workspace-save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          patternId: activePattern.id,
          pattern: payloadResult.body,
          assignmentCreateDrafts: stagedAssignments.map((draft) => buildAssignmentWorkspacePayload(draft)),
          assignmentDeleteIds: removedAssignmentIds,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(json?.error ?? "SAVE_FAILED"));

      await loadAll();
      setFreshCreatedPatternId("");
      setSelectedRouteEditMode(false);
      setCreatePatternError("");
      setAssignmentDraftError("");
      setDayPlanErrorIndexes([]);
      setDayPlanErrorMessage("");
      clearStagedAssignmentChanges();
      resetAssignmentComposer();
    } catch (e: any) {
      const errorCode = String(e?.message ?? "SAVE_FAILED");
      if (
        errorCode === "ASSIGNMENT_NOT_FOUND" ||
        errorCode === "ASSIGNMENT_PATTERN_MISMATCH" ||
        errorCode === "EMPLOYEE_REQUIRED" ||
        errorCode === "SUBGROUP_REQUIRED" ||
        errorCode === "GROUP_REQUIRED" ||
        errorCode === "BRANCH_REQUIRED" ||
        errorCode === "VALID_FROM_INVALID" ||
        errorCode === "VALID_TO_INVALID" ||
        errorCode === "VALID_RANGE_INVALID"
      ) {
        setAssignmentDraftError(humanizeAssignmentFormError(errorCode));
      } else {
        setCreatePatternError(humanizePatternFormError(errorCode));
      }
    } finally {
      setWorkspaceSaving(false);
    }
  }

  async function deleteActivePattern() {
    if (!activePatternId || readOnly) return;
    setDeleteSaving(true);
    try {
      const res = await fetch(`/api/policy/work-schedules/${activePatternId}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error ?? "DELETE_FAILED"));
      resetSelectedRouteWorkspace();
      await loadAll();
    } finally {
      setDeleteSaving(false);
    }
  }

  if (!shouldRenderEmbeddedWorkspace) {
    return null;
  }

  return (
    <div className={cx("grid w-full pb-2", embedded ? "gap-3" : "gap-5")} data-selected-route-mode={selectedRouteMode}>
      <section className={cx(surfaceCardClass, "relative")}>
        {!embedded ? (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Çalışma Rota</h1>
          </div>
        ) : null}

        {activePattern ? (
          <div className="absolute right-4 top-4 z-30 md:right-5 md:top-5">
            <div className="relative" ref={selectedRouteActionMenuRef}>
              <Button
                variant="secondary"
                onClick={() => {
                  if (selectedRouteActionMenuDisabled) return;
                  setSelectedRouteActionMenuOpen((prev) => !prev);
                }}
                disabled={selectedRouteActionMenuDisabled}
                title={selectedRouteActionMenuDisabled ? "Şu anda kullanılabilir işlem yok" : "İşlemler"}
                className="min-w-[108px] justify-between gap-2"
              >
                <span>İşlemler</span>
                <span className={cx("text-[11px] transition-transform", selectedRouteActionMenuOpen && "rotate-180")} aria-hidden="true">
                  ▾
                </span>
              </Button>
              
              {selectedRouteActionMenuOpen ? (
                <div className="absolute right-0 z-20 mt-2 min-w-[190px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
                  <button
                    type="button"
                    className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => {
                      setSelectedRouteActionMenuOpen(false);
                      if (selectedRouteCloseActionDisabled) return;
                      (selectedRouteEditMode ? cancelSelectedRouteEditing : handleCloseSelectedRouteWorkspace)();
                    }}
                    disabled={selectedRouteCloseActionDisabled}
                    title={readOnly ? "Salt okunur" : undefined}
                  >
                    {selectedRouteEditMode ? "İptal" : "Kapat"}
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => {
                      setSelectedRouteActionMenuOpen(false);
                      if (selectedRouteEditActionDisabled) return;
                      openSelectedRouteEditMode();
                    }}
                    disabled={selectedRouteEditActionDisabled}
                    title={selectedRouteEditActionTitle}
                  >
                    {selectedRouteEditActionLabel}
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => {
                      setSelectedRouteActionMenuOpen(false);
                      if (selectedRouteDeleteActionDisabled) return;
                      setPendingPatternDelete(true);
                    }}
                    disabled={selectedRouteDeleteActionDisabled}
                    title={readOnly ? "Salt okunur" : "Sil"}
                  >
                    Sil
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div
          className={cx(
            topCardStackMarginClass,
            "grid gap-4",
            centerTopCard
              ? "justify-items-center"
              : "xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]",
          )}
        >
          <div
            className={cx(
              "rounded-2xl border border-slate-200 p-3.5",
              centerCreateCard && "w-full max-w-[360px] min-h-[360px]",
              centerSelectedRouteCard && selectedRouteEditMode && "w-full max-w-[360px] min-h-[360px]",
              centerSelectedRouteCard && !selectedRouteEditMode && "w-full max-w-[760px]",
            )}
          >
            {isCreateMode ? (
              <div className="grid justify-items-center gap-3">
                <div className="grid w-full max-w-[280px] gap-2.5">
                  <label className="grid w-full gap-1">
                    <FieldLabel>
                      <span className="inline-flex items-center gap-1">
                        Kod
                        <span className="text-rose-500">*</span>
                      </span>
                    </FieldLabel>
                    <input
                      className={inputClass}
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value);
                        if (createPatternError) setCreatePatternError("");
                      }}
                      placeholder="VR01"
                      disabled={saving || loading || readOnly}
                    />
                  </label>

                  <label className="grid w-full gap-1">
                    <FieldLabel>
                      <span className="inline-flex items-center gap-1">
                        Ad
                        <span className="text-rose-500">*</span>
                      </span>
                    </FieldLabel>
                    <input
                      className={inputClass}
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (createPatternError) setCreatePatternError("");
                      }}
                      placeholder="Ad"
                      disabled={saving || loading || readOnly}
                    />
                  </label>

                  <label className="grid w-full gap-1">
                    <FieldLabel>
                      <span className="inline-flex items-center gap-1">
                        Döngü
                        <span className="text-rose-500">*</span>
                      </span>
                    </FieldLabel>
                    <input
                      className={inputClass}
                      type="number"
                      min={1}
                      max={366}
                      value={cycleLengthDays}
                      onChange={(e) => {
                        setCycleLengthDays(Number(e.target.value));
                        if (createPatternError) setCreatePatternError("");
                      }}
                      disabled={saving || loading || readOnly}
                    />
                  </label>

                  <label className="grid w-full gap-1">
                    <FieldLabel>
                      <span className="inline-flex items-center gap-1">
                        Referans Gün
                        <span className="text-rose-500">*</span>
                      </span>
                    </FieldLabel>
                    <input
                      className={inputClass}
                      type="date"
                      value={referenceDayKey}
                      onChange={(e) => {
                        setReferenceDayKey(e.target.value);
                        if (createPatternError) setCreatePatternError("");
                      }}
                      disabled={saving || loading || readOnly}
                    />
                  </label>

                  {createPatternError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700">
                      {createPatternError}
                    </div>
                  ) : null}

                  <div className="flex justify-center pt-1">
                    <Button
                      variant="primary"
                      onClick={createPattern}
                      disabled={saving || loading || readOnly}
                      title={readOnly ? "Salt okunur" : "Rota oluştur"}
                    >
                      Rota Oluştur
                    </Button>
                  </div>
                </div>
              </div>
            ) : activePattern ? (
              <div className="grid justify-items-center gap-3">

                {selectedRouteEditMode ? (
                  <div className="grid w-full max-w-[280px] gap-2.5">
                    <label className="grid w-full gap-1">
                      <FieldLabel>
                        <span className="inline-flex items-center gap-1">
                          Kod
                          <span className="text-rose-500">*</span>
                        </span>
                      </FieldLabel>
                      <input
                        className={inputClass}
                        value={code}
                        onChange={(e) => {
                          setCode(e.target.value);
                          if (createPatternError) setCreatePatternError("");
                        }}
                        placeholder="VR01"
                        disabled={loading || saving || deleteSaving || workspaceSaving || readOnly}
                      />
                    </label>

                    <label className="grid w-full gap-1">
                      <FieldLabel>
                        <span className="inline-flex items-center gap-1">
                          Ad
                          <span className="text-rose-500">*</span>
                        </span>
                      </FieldLabel>
                      <input
                        className={inputClass}
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (createPatternError) setCreatePatternError("");
                        }}
                        placeholder="Ad"
                        disabled={loading || saving || deleteSaving || workspaceSaving || readOnly}
                      />
                    </label>

                    <label className="grid w-full gap-1">
                      <FieldLabel>
                        <span className="inline-flex items-center gap-1">
                          Döngü
                          <span className="text-rose-500">*</span>
                        </span>
                      </FieldLabel>
                      <input
                        className={inputClass}
                        type="number"
                        min={1}
                        max={366}
                        value={cycleLengthDays}
                        onChange={(e) => {
                          setCycleLengthDays(Number(e.target.value));
                          if (createPatternError) setCreatePatternError("");
                        }}
                        disabled={loading || saving || deleteSaving || workspaceSaving || readOnly}
                      />
                    </label>

                    <label className="grid w-full gap-1">
                      <FieldLabel>
                        <span className="inline-flex items-center gap-1">
                          Referans Gün
                          <span className="text-rose-500">*</span>
                        </span>
                      </FieldLabel>
                      <input
                        className={inputClass}
                        type="date"
                        value={referenceDayKey}
                        onChange={(e) => {
                          setReferenceDayKey(e.target.value);
                          if (createPatternError) setCreatePatternError("");
                        }}
                        disabled={loading || saving || deleteSaving || workspaceSaving || readOnly}
                      />
                    </label>

                    {selectedRouteCycleHint ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm font-medium text-amber-800">
                        {selectedRouteCycleHint}
                      </div>
                    ) : null}

                    {createPatternError ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700">
                        {createPatternError}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid w-full max-w-[240px] justify-items-center gap-2.5 text-center">
                    <div className="grid w-full gap-1">
                      <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Kod</div>
                      <div className="text-sm font-semibold text-slate-900">{activePattern.code}</div>
                    </div>
                    <div className="grid w-full gap-1">
                      <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Ad</div>
                      <div className="text-sm font-semibold text-slate-900">{activePattern.name}</div>
                    </div>
                    <div className="grid w-full gap-1">
                      <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Döngü</div>
                      <div className="text-sm font-semibold text-slate-900">{activePattern.cycleLengthDays} gün</div>
                    </div>
                    <div className="grid w-full gap-1">
                      <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Referans</div>
                      <div className="text-sm font-semibold text-slate-900">{toDayKey(activePattern.referenceDate)}</div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-500">Seçili kayıt yükleniyor…</div>
            )}
          </div>

          {!embedded || !hideEmbeddedPatternPicker ? (
            <div className="rounded-2xl border border-slate-200 p-3.5">
              <label className="grid gap-1">
                <FieldLabel>Kayıtlı Rota</FieldLabel>
                <select
                  className={inputClass}
                  value={activePatternId}
                  onChange={(e) => handleSelectedRoutePickerChange(e.target.value)}
                  disabled={loading || saving || workspaceSaving || deleteSaving}
                >
                  <option value="">Seç…</option>
                  {patternOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>
      </section>

      {activePattern ? (
        <section className={surfaceCardClass}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                {activePattern.code} — {activePattern.name}
              </h2>
              <p className="mt-1 text-sm text-slate-500">Vardiya değişiklikleri sayfanın altındaki tek kaydet alanında uygulanır.</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/40 p-3.5">
            <div className="grid gap-2.5 lg:grid-cols-[minmax(220px,280px)_1fr] lg:items-end">
              <label className="grid gap-1.5">
                <FieldLabel>Hızlı Vardiya Seçimi</FieldLabel>
                <select
                  className={quickShiftSelectClass}
                  value={bulkTemplateId}
                  onChange={(e) => setBulkTemplateId(String(e.target.value ?? ""))}
                  disabled={workspaceSaving || deleteSaving || selectedRouteMutationDisabled}
                >
                  <option value="">Seç…</option>
                  {shiftOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {fmtShiftLabel(t)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={fillAllOff}
                  disabled={workspaceSaving || deleteSaving || selectedRouteMutationDisabled || editDays.length === 0}
                >
                  Tümünü OFF
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => fillAllWithTemplate(bulkTemplateId)}
                  disabled={workspaceSaving || deleteSaving || selectedRouteMutationDisabled || !bulkTemplateId || editDays.length === 0}
                >
                  Tümüne Uygula
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => fillWeekdaysTemplateWeekendOff(bulkTemplateId)}
                  disabled={workspaceSaving || deleteSaving || selectedRouteMutationDisabled || !bulkTemplateId || editDays.length === 0}
                >
                  Hafta İçi Uygula
                </Button>
                <Button
                  variant="secondary"
                  onClick={copyFirstWeekToAllWeeks}
                  disabled={
                    workspaceSaving ||
                    deleteSaving ||
                    selectedRouteMutationDisabled ||
                    !canCopyFirstWeekToAllWeeks
                  }
                >
                  1. Haftayı Kopyala
                </Button>
              </div>
            </div>
          </div>
          
          {dayPlanErrorMessage ? (
            <div
              ref={dayPlanErrorRef}
              tabIndex={-1}
              role="alert"
              className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700 outline-none focus:ring-4 focus:ring-rose-500/10"
            >
              {dayPlanErrorMessage}
            </div>
          ) : null}

          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[900px] w-full border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <th className="border-b border-slate-200 px-4 py-2.5">Gün</th>
                  <th className="border-b border-slate-200 px-4 py-2.5">OFF</th>
                  <th className="border-b border-slate-200 px-4 py-2.5">Vardiya</th>
                </tr>
              </thead>
              <tbody>
                {editDays.map((v, i) => {
                  const ref = toDayKey(activePattern.referenceDate);
                  const wd = ref ? weekdayFromRef(ref, i) : 0;
                  const dateLabel = ref ? toDayKey(addDaysUtc(ref, i)) : "";
                  const isOff = v == null;
                  const hasError = dayPlanErrorIndexes.includes(i);
                  return (
                    <tr key={i} className={cx("border-b border-slate-100 last:border-b-0", hasError && "bg-rose-50/60")}>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900">{i + 1}. Gün — {trWeekdayShort(wd)}</div>
                        <div className="mt-1 text-xs text-slate-500">{dateLabel}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                          <input
                            className="h-4 w-4 accent-indigo-600"
                            type="checkbox"
                            checked={isOff}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setDay(i, null);
                              } else {
                                setDay(i, "");
                              }
                            }}
                            disabled={selectedRouteMutationDisabled || workspaceSaving || deleteSaving}
                          />
                          OFF
                        </label>
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          className={cx(
                            dayShiftSelectClass,
                            hasError && "border-rose-300 bg-rose-50/60 hover:border-rose-300 focus:border-rose-300 focus:ring-rose-500/15",
                          )}
                          value={v ?? ""}
                          onChange={(e) => {
                            const next = String(e.target.value ?? "").trim();
                            setDay(i, next ? next : null);
                          }}
                          disabled={isOff || selectedRouteMutationDisabled || workspaceSaving || deleteSaving}
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
                    <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={3}>
                      Kayıt yok.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activePattern ? (
        <section className={surfaceCardClass}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">{activePattern.code} — Atamalar</h2>
              <p className="mt-1 text-sm text-slate-500">Atama ekleme ve silme işlemleri önce taslağa alınır, sonra alttaki tek kaydet alanında uygulanır.</p>
            </div>
            <Button
              variant="primary"
              onClick={stageAssignmentDraft}
              disabled={saving || loading || deleteSaving || workspaceSaving || selectedRouteMutationDisabled}
              title={selectedRouteMutationTitle ?? "Atamayı listeye ekle"}
            >
              Listeye Ekle
            </Button>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-3.5 md:p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">Sıra:</span>
              <span>Kapsam</span>
              <span>→</span>
              <span>Hedef</span>
              <span>→</span>
              <span>Geçerlilik</span>
              <span>→</span>
              <span>Öncelik</span>
            </div>
          <div className="grid gap-3 xl:grid-cols-[minmax(460px,1.15fr)_minmax(360px,0.95fr)] xl:items-start">
            <div className="grid gap-3">
                <label className="grid gap-1.5">
                  <FieldLabel>1. Kapsam</FieldLabel>
                  <select
                    className={assignmentControlClass}
                    value={scope}
                    onChange={(e) => changeAssignmentScope(e.target.value)}
                    disabled={saving || loading || deleteSaving || workspaceSaving || selectedRouteMutationDisabled}
                  >
                    <option value="">Seç…</option>
                    <option value="EMPLOYEE">Personel</option>
                    <option value="EMPLOYEE_GROUP">Personel Grubu</option>
                    <option value="EMPLOYEE_SUBGROUP">Personel Alt Grubu</option>
                    <option value="BRANCH">Şube</option>
                  </select>
                </label>

                {scope === "EMPLOYEE" ? (
                  <div className="grid gap-2">
                    <FieldLabel>2. Hedef — Personel</FieldLabel>
                    <div className={assignmentPersonSearchRowClass}>
                      <input
                        className={assignmentControlClass}
                        placeholder="Personel ara"
                        value={employeeQuery}
                        onChange={(e) => setEmployeeQuery(e.target.value)}
                        disabled={saving || loading || deleteSaving || workspaceSaving || selectedRouteMutationDisabled}
                      />
                      <Button
                        variant="secondary"
                        onClick={() => loadEmployees(employeeQuery)}
                        disabled={saving || loading || deleteSaving || workspaceSaving || selectedRouteMutationDisabled}
                      >
                        Ara
                      </Button>
                    </div>
                    <div className="grid gap-2">
                      <select
                        className={assignmentControlClass}
                        value={selectedEmployeeId}
                        onChange={(e) => setSelectedEmployeeId(e.target.value)}
                        disabled={saving || loading || employeeLoading || deleteSaving || workspaceSaving || selectedRouteMutationDisabled}
                      >
                        <option value="">Personel seç…</option>
                        {employees.map((emp) => {
                          const full = `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim();
                          return (
                            <option key={emp.id} value={emp.id}>
                              {emp.employeeCode} — {full || "—"}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                ) : null}

                {scope === "EMPLOYEE_GROUP" ? (
                  <div className="grid gap-1.5">
                    <FieldLabel>2. Hedef — Personel Grubu</FieldLabel>
                    <select
                      className={assignmentControlClass}
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                    disabled={saving || loading || deleteSaving || workspaceSaving || selectedRouteMutationDisabled}
                    >
                      <option value="">Personel grubu seç…</option>
                      {groupOptions.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.code} — {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {scope === "EMPLOYEE_SUBGROUP" ? (
                  <div className="grid gap-1.5">
                    <FieldLabel>2. Hedef — Personel Alt Grubu</FieldLabel>
                    <select
                      className={assignmentControlClass}
                      value={selectedSubgroupId}
                      onChange={(e) => setSelectedSubgroupId(e.target.value)}
                    disabled={saving || loading || deleteSaving || workspaceSaving || selectedRouteMutationDisabled}
                    >
                      <option value="">Personel alt grubu seç…</option>
                      {subgroupOptions.map((sg) => (
                        <option key={sg.id} value={sg.id}>
                          {sg.code} — {sg.name}
                          {sg.employeeGroup ? ` (${sg.employeeGroup.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {scope === "BRANCH" ? (
                  <div className="grid gap-1.5">
                    <FieldLabel>2. Hedef — Şube</FieldLabel>
                    <select
                      className={assignmentControlClass}
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                    disabled={saving || loading || deleteSaving || workspaceSaving || selectedRouteMutationDisabled}
                    >
                      <option value="">Şube seç…</option>
                      {branchOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} — {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 rounded-2xl border border-slate-200/80 bg-white/80 p-4 md:p-5">
                <label className="grid gap-1.5">
                  <FieldLabel>3. Öncelik</FieldLabel>
                  <input
                    className={inputClass}
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    disabled={saving || loading || deleteSaving || workspaceSaving || selectedRouteMutationDisabled}
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <FieldLabel>4. Geçerlilik Başlangıcı</FieldLabel>
                  <input
                    className={inputClass}
                    type="date"
                    value={validFromDayKey}
                    onChange={(e) => setValidFromDayKey(e.target.value)}
                    disabled={saving || loading || deleteSaving || workspaceSaving || selectedRouteMutationDisabled}
                  />
                </label>
                  <label className="grid gap-1.5">
                    <FieldLabel>5. Geçerlilik Bitişi</FieldLabel>
                  <input
                    className={inputClass}
                    type="date"
                    value={validToDayKey}
                    onChange={(e) => setValidToDayKey(e.target.value)}
                    disabled={saving || loading || deleteSaving || workspaceSaving || selectedRouteMutationDisabled}
                  />
                  </label>
                </div>
              </div>
            </div>
          </div>
          
          {assignmentDraftError ? (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700">
              {assignmentDraftError}
            </div>
          ) : null}

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-[980px] w-full border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <th className="border-b border-slate-200 px-4 py-3">Scope</th>
                  <th className="border-b border-slate-200 px-4 py-3">Target</th>
                  <th className="border-b border-slate-200 px-4 py-3">Valid</th>
                  <th className="border-b border-slate-200 px-4 py-3">Priority</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {activeAssignmentRows.map((row) => {
                  if (row.kind === "staged") {
                    const draft = row.draft;
                    return (
                      <tr key={draft.clientId} className="border-b border-slate-100 bg-indigo-50/35 last:border-b-0">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          <div>{String(draft.scope ?? "")}</div>
                          <div className="mt-1 inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                            Yeni
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{draft.targetLabel || "—"}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {(draft.validFromDayKey ? draft.validFromDayKey : "—") + " → " + (draft.validToDayKey ? draft.validToDayKey : "—")}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{draft.priority ?? 0}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="secondary"
                            onClick={() => removeStagedAssignmentDraft(draft.clientId)}
                            disabled={saving || loading || deleteSaving || workspaceSaving || selectedRouteMutationDisabled}
                            title={selectedRouteMutationTitle ?? "Listeden çıkar"}
                          >
                            Geri Al
                          </Button>
                        </td>
                      </tr>
                    );
                  }

                  const assignment = row.assignment;
                  const targetContent = assignment.employee ? (
                    <div className="font-medium text-slate-900">{assignment.employee.employeeCode} — {`${assignment.employee.firstName ?? ""} ${assignment.employee.lastName ?? ""}`.trim() || "—"}</div>
                  ) : assignment.employeeSubgroup ? (
                    <div className="font-medium text-slate-900">{assignment.employeeSubgroup.code} — {assignment.employeeSubgroup.name}</div>
                  ) : assignment.employeeGroup ? (
                    <div className="font-medium text-slate-900">{assignment.employeeGroup.code} — {assignment.employeeGroup.name}</div>
                  ) : assignment.branch ? (
                    <div className="font-medium text-slate-900">{assignment.branch.code} — {assignment.branch.name}</div>
                  ) : (
                    <span className="text-slate-500">—</span>
                  );

                  return (
                    <tr key={assignment.id} className={cx("border-b border-slate-100 last:border-b-0", row.pendingDelete && "bg-rose-50/45") }>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        <div>{String(assignment.scope ?? "")}</div>
                        {row.pendingDelete ? (
                          <div className="mt-1 inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                            Kaydedilince silinecek
                          </div>
                        ) : null}
                      </td>
                      <td className={cx("px-4 py-3", row.pendingDelete && "line-through opacity-70")}>
                        {targetContent}
                      </td>
                      <td className={cx("px-4 py-3 text-slate-700", row.pendingDelete && "line-through opacity-70")}>
                        {(assignment.validFrom ? toDayKey(assignment.validFrom) : "—") + " → " + (assignment.validTo ? toDayKey(assignment.validTo) : "—")}
                      </td>
                      <td className={cx("px-4 py-3 text-slate-700", row.pendingDelete && "line-through opacity-70")}>
                        {assignment.priority ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant={row.pendingDelete ? "secondary" : "danger"}
                          onClick={() => togglePersistedAssignmentRemoval(String(assignment.id ?? ""))}
                          disabled={saving || loading || deleteSaving || workspaceSaving || selectedRouteMutationDisabled}
                          title={selectedRouteMutationTitle ?? (row.pendingDelete ? "Silmeyi geri al" : "Silmek üzere işaretle")}
                        >
                          {row.pendingDelete ? "Geri Al" : "Sil"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {activeAssignmentRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={5}>
                      Kayıt yok.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activePattern && selectedRouteEditMode ? (
        <div className="sticky bottom-3 z-20 flex justify-end">
          <div className="flex w-full max-w-[720px] items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">Sayfa kaydı tek noktadan tamamlanır</div>
              <div className="mt-1 text-xs text-slate-500">
                {stagedAssignments.length > 0 ? `${stagedAssignments.length} yeni atama taslağı` : "Yeni atama taslağı yok"}
                {removedAssignmentIds.length > 0 ? ` · ${removedAssignmentIds.length} silme işareti` : ""}
                {hasDayPlanDraft ? " · Gün planı değişti" : ""}
                {hasSelectedRouteMetaDraft ? " · Üst kart değişti" : ""}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="secondary"
                onClick={cancelSelectedRouteEditing}
                disabled={workspaceSaving || deleteSaving}
              >
                İptal
              </Button>
              <Button
                variant="primary"
                onClick={saveSelectedRouteWorkspace}
                disabled={
                  selectedRouteWorkspaceActionDisabled ||
                  (!hasSelectedRouteMetaDraft &&
                    !hasDayPlanDraft &&
                    !hasAssignmentStagingDraft)
                }
                title={selectedRouteWorkspaceActionTitle}
              >
                {workspaceSaving ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingPatternDelete && activePattern && portalReady
        ? createPortal(
            <div className="fixed inset-0 z-[145] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-pattern-modal-title"
                aria-describedby="delete-pattern-modal-description"
                className="w-full max-w-md rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-5 shadow-[0_28px_80px_rgba(15,23,42,0.24)]"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-700 ring-1 ring-rose-200/80">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v4m0 4h.01M10.29 3.86l-7.5 13A1 1 0 003.65 18h16.7a1 1 0 00.86-1.5l-7.5-13a1 1 0 00-1.72 0z"
                      />
                    </svg>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div id="delete-pattern-modal-title" className="text-base font-bold text-slate-950">
                      Kayıtlı rota silinsin mi?
                    </div>
                    <div id="delete-pattern-modal-description" className="mt-1 text-sm leading-6 text-slate-600">
                      Bu kaydı silmek istediğinizden emin misiniz? Bununla ilişkilendirilen tüm veriler silinecek.
                    </div>
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700">
                      <div className="font-semibold text-slate-900">{activePattern.code} — {activePattern.name}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.08em] text-slate-500">
                        {activePattern.cycleLengthDays} Gün · Referans {toDayKey(activePattern.referenceDate)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setPendingPatternDelete(false)}
                    disabled={deleteSaving}
                    className="min-w-[110px]"
                  >
                    Vazgeç
                  </Button>

                  <Button
                    variant="danger"
                    type="button"
                    onClick={deleteActivePattern}
                    disabled={deleteSaving || readOnly}
                    className="min-w-[170px]"
                  >
                    {deleteSaving ? "Siliniyor..." : "Kaydı Kalıcı Sil"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {pendingSelectedRouteExit && portalReady
        ? createPortal(
            <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="selected-route-exit-modal-title"
                aria-describedby="selected-route-exit-modal-description"
                className="w-full max-w-md rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-5 shadow-[0_28px_80px_rgba(15,23,42,0.24)]"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-200/80">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v4m0 4h.01M10.29 3.86l-7.5 13A1 1 0 003.65 18h16.7a1 1 0 00.86-1.5l-7.5-13a1 1 0 00-1.72 0z"
                      />
                    </svg>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div id="selected-route-exit-modal-title" className="text-base font-bold text-slate-950">
                      {selectedRouteExitDialogTitle}
                    </div>
                    <div id="selected-route-exit-modal-description" className="mt-1 text-sm leading-6 text-slate-600">
                      {selectedRouteExitDialogDescription}
                    </div>
                    {pendingPatternSwitchTarget ? (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700">
                        <div className="font-semibold text-slate-900">{pendingPatternSwitchTarget.code} — {pendingPatternSwitchTarget.name}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.08em] text-slate-500">
                          {pendingPatternSwitchTarget.cycleLengthDays} Gün · Referans {toDayKey(pendingPatternSwitchTarget.referenceDate)}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      setPendingSelectedRouteExit(false);
                      setPendingPatternSwitchId("");
                    }}
                    className="min-w-[110px]"
                  >
                    Vazgeç
                  </Button>

                  <Button
                    variant="primary"
                    type="button"
                    onClick={confirmSelectedRouteExitIntent}
                    className="min-w-[170px]"
                  >
                    {selectedRouteExitConfirmText}
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
