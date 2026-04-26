"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  formatBreakMinutesAsDecimalHoursText,
  formatBreakMinutesAsHumanDurationText,
  parseBreakDurationDecimalHoursToMinutes,
} from "@/src/domain/breakPlans/breakPlanDuration";
import type { DataManagementWorkspaceRecordOption } from "@/src/features/data-management/DataManagementModuleSelect";

type BreakPlan = {
  id: string;
  code: string;
  name: string;
  plannedBreakMinutes: number;
  plannedBreakHoursText?: string;
  plannedBreakHumanText?: string;
  isPaid: boolean;
  payType?: "PAID" | "UNPAID";
  payTypeText?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Button({
  variant = "secondary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60";
  const styles =
    variant === "primary"
      ? "bg-indigo-600 text-white hover:bg-indigo-700"
      : variant === "danger"
        ? "bg-rose-600 text-white hover:bg-rose-700"
        : variant === "ghost"
          ? "border border-transparent bg-transparent text-slate-700 hover:bg-slate-100"
          : "border border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50";

  return <button className={cx(base, styles, className)} type="button" {...props} />;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-[13px] font-semibold text-slate-700">{children}</span>;
}

function RequiredMark() {
  return <span className="text-rose-500">*</span>;
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 disabled:bg-slate-50 disabled:text-slate-500";

function normalizeBreakCodeInput(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
}

function normalizeBreakNameInput(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeBreakHoursInput(value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    return formatBreakMinutesAsDecimalHoursText(parseBreakDurationDecimalHoursToMinutes(raw));
  } catch {
    return raw.replace(".", ",");
  }
}

function humanizeBreakPlanError(code: string) {
  switch (String(code ?? "").trim()) {
    case "BREAK_PLAN_CODE_REQUIRED":
      return "Mola kodu zorunludur.";
    case "BREAK_PLAN_CODE_INVALID_FORMAT":
      return "Mola kodu tam 4 karakter olmalı ve yalnızca harf/rakam içermelidir.";
    case "BREAK_PLAN_NAME_REQUIRED":
      return "Mola adı zorunludur.";
    case "BREAK_PLAN_NAME_TOO_LONG":
      return "Mola adı 120 karakteri aşamaz.";
    case "BREAK_DURATION_HOURS_REQUIRED":
      return "Mola süresi zorunludur.";
    case "BREAK_DURATION_HOURS_INVALID_FORMAT":
      return "Mola süresi ondalık saat formatında olmalıdır. Örn: 1,00 / 0,50 / 1,50.";
    case "BREAK_DURATION_HOURS_MUST_BE_POSITIVE":
      return "Mola süresi 0’dan büyük olmalıdır.";
    case "BREAK_DURATION_HOURS_MAX_12_HOURS":
      return "Mola süresi 12,00 saati aşamaz.";
    case "BREAK_PLAN_CODE_ALREADY_EXISTS":
      return "Bu mola kodu zaten kayıtlı.";
    case "BREAK_PLAN_NOT_FOUND":
      return "Mola planı bulunamadı. Listeyi yenileyip tekrar deneyin.";
    default:
      return code || "İşlem tamamlanamadı.";
  }
}

function getBreakHoursText(item: Partial<BreakPlan> | null | undefined) {
  if (!item) return "—";
  if (item.plannedBreakHoursText) return item.plannedBreakHoursText;
  if (typeof item.plannedBreakMinutes === "number" && Number.isFinite(item.plannedBreakMinutes)) {
    try {
      return formatBreakMinutesAsDecimalHoursText(item.plannedBreakMinutes);
    } catch {
      return "—";
    }
  }
  return "—";
}

function getBreakHumanText(item: Partial<BreakPlan> | null | undefined) {
  if (!item) return "—";
  if (item.plannedBreakHumanText) return item.plannedBreakHumanText;
  if (typeof item.plannedBreakMinutes === "number" && Number.isFinite(item.plannedBreakMinutes)) {
    try {
      return formatBreakMinutesAsHumanDurationText(item.plannedBreakMinutes);
    } catch {
      return "—";
    }
  }
  return "—";
}

export default function BreakPlansClient({
  canWrite,
  embedded = false,
  onDirtyStateChange,
  selectedBreakPlanId,
  embeddedCreateRequested = false,
  onSelectedBreakPlanIdChange,
  onEmbeddedBreakPlanOptionsChange,
}: {
  canWrite: boolean;
  embedded?: boolean;
  onDirtyStateChange?: (isDirty: boolean) => void;
  selectedBreakPlanId?: string;
  embeddedCreateRequested?: boolean;
  onSelectedBreakPlanIdChange?: (nextValue: string) => void;
  onEmbeddedBreakPlanOptionsChange?: (options: DataManagementWorkspaceRecordOption[]) => void;
}) {
  const readOnly = !canWrite;
  const [embeddedEditMode, setEmbeddedEditMode] = useState(false);
  const [embeddedActionsOpen, setEmbeddedActionsOpen] = useState(false);
  const embeddedSelectedRecord = embedded && !!selectedBreakPlanId && !embeddedCreateRequested;
  const embeddedReadOnlyRecord = embeddedSelectedRecord && !embeddedEditMode;
  const effectiveReadOnly = readOnly || embeddedReadOnlyRecord;
  const [items, setItems] = useState<BreakPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<BreakPlan | null>(null);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState<BreakPlan | null>(null);
  const [form, setForm] = useState({
    id: "",
    code: "",
    name: "",
    plannedBreakHours: "",
    isPaid: false,
    mode: "create" as "create" | "edit",
  });
  const [touched, setTouched] = useState({
    code: false,
    name: false,
    plannedBreakHours: false,
  });
  const [editBaseline, setEditBaseline] = useState<{
    id: string;
    code: string;
    name: string;
    plannedBreakMinutes: number;
    isPaid: boolean;
  } | null>(null);

  const preview = useMemo(() => {
    if (!String(form.plannedBreakHours ?? "").trim()) return null;
    try {
      const plannedBreakMinutes = parseBreakDurationDecimalHoursToMinutes(form.plannedBreakHours);
      return {
        plannedBreakMinutes,
        plannedBreakHoursText: formatBreakMinutesAsDecimalHoursText(plannedBreakMinutes),
        plannedBreakHumanText: formatBreakMinutesAsHumanDurationText(plannedBreakMinutes),
        invalidReason: null as string | null,
      };
    } catch (e: any) {
      return {
        plannedBreakMinutes: null,
        plannedBreakHoursText: "",
        plannedBreakHumanText: "",
        invalidReason: humanizeBreakPlanError(String(e?.message || "BREAK_DURATION_HOURS_INVALID_FORMAT")),
      };
    }
  }, [form.plannedBreakHours]);

  const canSubmit = useMemo(() => {
    return (
      normalizeBreakCodeInput(form.code).length === 4 &&
      normalizeBreakNameInput(form.name).length > 0 &&
      !!preview &&
      !preview.invalidReason
    );
  }, [form.code, form.name, preview]);

  const isDirty = useMemo(() => {
    if (form.mode !== "edit") {
      return (
        !!normalizeBreakCodeInput(form.code) ||
        !!normalizeBreakNameInput(form.name) ||
        !!String(form.plannedBreakHours ?? "").trim() ||
        form.isPaid
      );
    }
    if (!editBaseline) return false;
    if (editBaseline.id !== form.id) return false;

    return (
      editBaseline.code !== normalizeBreakCodeInput(form.code) ||
      editBaseline.name !== normalizeBreakNameInput(form.name) ||
      editBaseline.plannedBreakMinutes !== (preview?.plannedBreakMinutes ?? null) ||
      editBaseline.isPaid !== form.isPaid
    );
  }, [form, editBaseline, preview?.plannedBreakMinutes]);

  useEffect(() => {
    onDirtyStateChange?.(isDirty);
  }, [isDirty, onDirtyStateChange]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!embedded) return;
    setEmbeddedEditMode(false);
    setEmbeddedActionsOpen(false);
    setHardDeleteConfirm(null);
  }, [embedded, selectedBreakPlanId, embeddedCreateRequested]);

  const visibleItems = useMemo(() => {
    const query = q.trim().toLocaleLowerCase("tr");
    const list = query
      ? items.filter((item) => {
          const haystack = [
            item.code,
            item.name,
            getBreakHoursText(item),
            getBreakHumanText(item),
            item.isPaid ? "ücretli paid" : "ücretsiz unpaid",
            item.isActive ? "aktif" : "pasif",
          ]
            .join(" ")
            .toLocaleLowerCase("tr");
          return haystack.includes(query);
        })
      : items;

    return [...list].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.code.localeCompare(b.code, "tr");
    });
  }, [items, q]);

  const selectedEmbeddedBreakPlan = useMemo(() => {
    if (!selectedBreakPlanId) return null;
    return items.find((item) => item.id === selectedBreakPlanId) ?? null;
  }, [items, selectedBreakPlanId]);

  const embeddedReadonlyDetails = useMemo(() => {
    if (!embeddedReadOnlyRecord || !selectedEmbeddedBreakPlan) return null;

    return {
      code: selectedEmbeddedBreakPlan.code,
      name: selectedEmbeddedBreakPlan.name,
      plannedBreakHoursText: getBreakHoursText(selectedEmbeddedBreakPlan),
      plannedBreakHumanText: getBreakHumanText(selectedEmbeddedBreakPlan),
      payText: selectedEmbeddedBreakPlan.isPaid ? "Ücretli" : "Ücretsiz",
      statusText: selectedEmbeddedBreakPlan.isActive ? "Aktif" : "Pasif",
    };
  }, [embeddedReadOnlyRecord, selectedEmbeddedBreakPlan]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/break-plans?includeInactive=1", {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "LOAD_FAILED");
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      setError(humanizeBreakPlanError(String(e?.message || "LOAD_FAILED")));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!embedded) return;

    const options = items.map((item) => ({
      value: item.id,
      label: `${item.code} — ${item.name} / ${getBreakHoursText(item)} saat / ${
        item.isPaid ? "Ücretli" : "Ücretsiz"
      }${item.isActive ? "" : " / Pasif"}`,
    }));

    onEmbeddedBreakPlanOptionsChange?.(options);
  }, [embedded, items, onEmbeddedBreakPlanOptionsChange]);

  useEffect(() => {
    if (!embedded || embeddedCreateRequested) return;
    if (!selectedBreakPlanId) return;

    const item = items.find((x) => x.id === selectedBreakPlanId);
    if (!item) return;

    setError(null);
    setNotice(null);
    setDeleteConfirm(null);
    setHardDeleteConfirm(null);
    setForm({
      id: item.id,
      code: item.code,
      name: item.name,
      plannedBreakHours: getBreakHoursText(item),
      isPaid: Boolean(item.isPaid),
      mode: "edit",
    });
    setTouched({ code: true, name: true, plannedBreakHours: true });
    setEditBaseline({
      id: item.id,
      code: item.code,
      name: item.name,
      plannedBreakMinutes: item.plannedBreakMinutes,
      isPaid: Boolean(item.isPaid),
    });
  }, [embedded, embeddedCreateRequested, selectedBreakPlanId, items]);

  useEffect(() => {
    if (!embedded || !embeddedCreateRequested) return;

    setEmbeddedEditMode(false);
    setEmbeddedActionsOpen(false);
    setError(null);
    setNotice(null);
    setDeleteConfirm(null);
    setHardDeleteConfirm(null);
    setForm({
      id: "",
      code: "",
      name: "",
      plannedBreakHours: "",
      isPaid: false,
      mode: "create",
    });
    setTouched({ code: false, name: false, plannedBreakHours: false });
    setEditBaseline(null);
  }, [embedded, embeddedCreateRequested]);

  function resetForm() {
    setForm({
      id: "",
      code: "",
      name: "",
      plannedBreakHours: "",
      isPaid: false,
      mode: "create",
    });
    setTouched({ code: false, name: false, plannedBreakHours: false });
    setEditBaseline(null);
  }

  function restoreSelectedEmbeddedBreakPlanForm() {
    if (!embeddedSelectedRecord || !selectedEmbeddedBreakPlan) return false;

    setForm({
      id: selectedEmbeddedBreakPlan.id,
      code: selectedEmbeddedBreakPlan.code,
      name: selectedEmbeddedBreakPlan.name,
      plannedBreakHours: getBreakHoursText(selectedEmbeddedBreakPlan),
      isPaid: Boolean(selectedEmbeddedBreakPlan.isPaid),
      mode: "edit",
    });
    setTouched({ code: true, name: true, plannedBreakHours: true });
    setEditBaseline({
      id: selectedEmbeddedBreakPlan.id,
      code: selectedEmbeddedBreakPlan.code,
      name: selectedEmbeddedBreakPlan.name,
      plannedBreakMinutes: selectedEmbeddedBreakPlan.plannedBreakMinutes,
      isPaid: Boolean(selectedEmbeddedBreakPlan.isPaid),
    });

    return true;
  }

  function cancelFormEdit() {
    if (restoreSelectedEmbeddedBreakPlanForm()) {
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
    onSelectedBreakPlanIdChange?.("");
    resetForm();
  }

  function beginEmbeddedSelectedEdit() {
    if (readOnly || !selectedEmbeddedBreakPlan) return;
    setEmbeddedActionsOpen(false);
    setEmbeddedEditMode(true);
  }

  function requestEmbeddedSelectedDelete() {
    if (readOnly || !selectedEmbeddedBreakPlan) return;
    setEmbeddedActionsOpen(false);
    setHardDeleteConfirm(selectedEmbeddedBreakPlan);
  }

  function beginEdit(item: BreakPlan) {
    if (effectiveReadOnly) return;
    setError(null);
    setNotice(null);
    setDeleteConfirm(null);
    setHardDeleteConfirm(null);
    setForm({
      id: item.id,
      code: item.code,
      name: item.name,
      plannedBreakHours: getBreakHoursText(item),
      isPaid: Boolean(item.isPaid),
      mode: "edit",
    });
    setTouched({ code: true, name: true, plannedBreakHours: true });
    setEditBaseline({
      id: item.id,
      code: item.code,
      name: item.name,
      plannedBreakMinutes: item.plannedBreakMinutes,
      isPaid: Boolean(item.isPaid),
    });
  }

  async function onSubmit() {
    if (effectiveReadOnly) return;

    if (!canSubmit) {
      setTouched({ code: true, name: true, plannedBreakHours: true });
      setError(preview?.invalidReason || "Mola planı bilgilerini kontrol edin.");
      return;
    }

    if (form.mode === "edit" && !isDirty) {
      setError("Güncellenecek bir değişiklik yok.");
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const body = {
        code: normalizeBreakCodeInput(form.code),
        name: normalizeBreakNameInput(form.name),
        plannedBreakHours: normalizeBreakHoursInput(form.plannedBreakHours),
        isPaid: form.isPaid,
      };

      const res =
        form.mode === "create"
          ? await fetch("/api/break-plans", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(body),
            })
          : await fetch(`/api/break-plans/${form.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(body),
            });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "SAVE_FAILED");
      await load();
      if (embeddedSelectedRecord && form.mode === "edit") {
        setEmbeddedEditMode(false);
      } else {
        resetForm();
      }
      setNotice(form.mode === "create" ? "Mola planı oluşturuldu." : "Mola planı güncellendi.");
    } catch (e: any) {
      const code = String(e?.message || "SAVE_FAILED");
      if (code === "BREAK_PLAN_CODE_ALREADY_EXISTS") setQ(normalizeBreakCodeInput(form.code));
      setError(humanizeBreakPlanError(code));
    } finally {
      setLoading(false);
    }
  }

  async function onDeactivate(item: BreakPlan) {
    if (readOnly) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/break-plans/${item.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "DELETE_FAILED");
      await load();
      if (form.id === item.id) resetForm();
      if (selectedBreakPlanId === item.id) {
        onSelectedBreakPlanIdChange?.("");
        setEmbeddedEditMode(false);
        setEmbeddedActionsOpen(false);
      }
      setDeleteConfirm(null);
      setNotice("Mola planı pasifleştirildi.");
    } catch (e: any) {
      setError(humanizeBreakPlanError(String(e?.message || "DELETE_FAILED")));
    } finally {
      setLoading(false);
    }
  }

  async function onHardDelete(item: BreakPlan) {
    if (readOnly) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/break-plans/${item.id}/hard-delete`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "HARD_DELETE_FAILED");

      await load();
      if (selectedBreakPlanId === item.id) {
        onSelectedBreakPlanIdChange?.("");
      }
      setEmbeddedEditMode(false);
      setEmbeddedActionsOpen(false);
      setDeleteConfirm(null);
      setHardDeleteConfirm(null);
      resetForm();
      setNotice("Mola planı kalıcı olarak silindi.");
    } catch (e: any) {
      setError(humanizeBreakPlanError(String(e?.message || "HARD_DELETE_FAILED")));
    } finally {
      setLoading(false);
    }
  }

  async function onActivate(item: BreakPlan) {
    if (effectiveReadOnly) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/break-plans/${item.id}/activate`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "ACTIVATE_FAILED");
      await load();
      setNotice("Mola planı aktifleştirildi.");
    } catch (e: any) {
      setError(humanizeBreakPlanError(String(e?.message || "ACTIVATE_FAILED")));
    } finally {
      setLoading(false);
    }
  }

  const showCodeError = touched.code && normalizeBreakCodeInput(form.code).length !== 4;
  const showNameError = touched.name && normalizeBreakNameInput(form.name).length === 0;
  const showDurationError = touched.plannedBreakHours && !!preview?.invalidReason;

  return (
    <div className={cx("relative grid min-w-0 max-w-full gap-5", embedded ? "gap-4" : "gap-6")}>      
    {deleteConfirm ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="text-base font-semibold text-slate-950">Mola planı pasifleştirilsin mi?</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              <span className="font-semibold text-slate-900">{deleteConfirm.code}</span> kodlu mola planı pasif hale getirilecek.
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)} disabled={loading}>
                Vazgeç
              </Button>
              <Button variant="danger" onClick={() => onDeactivate(deleteConfirm)} disabled={loading}>
                Pasifleştir
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {hardDeleteConfirm ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600">
                ⚠
              </div>
              <div className="min-w-0">
                <div className="text-base font-semibold text-slate-950">Mola planı kalıcı silinsin mi?</div>
                <div className="mt-2 text-sm leading-6 text-slate-600">
                  Bu kaydı kalıcı olarak silmek istediğinizden emin misiniz? Bu mola planı vardiya
                  şablonlarında kullanılıyorsa bağlantılar kaldırılır ve ilgili zaman sonuçları yeniden
                  hesaplama kuyruğuna alınır.
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-sm font-semibold text-slate-950">
                {hardDeleteConfirm.code} — {hardDeleteConfirm.name}
              </div>
              <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                {getBreakHoursText(hardDeleteConfirm)} saat · {hardDeleteConfirm.isPaid ? "Ücretli" : "Ücretsiz"}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setHardDeleteConfirm(null)} disabled={loading}>
                Vazgeç
              </Button>
              <Button variant="danger" onClick={() => onHardDelete(hardDeleteConfirm)} disabled={loading || readOnly}>
                Kaydı Kalıcı Sil
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {embeddedSelectedRecord ? (
        <div className="absolute right-6 top-6 z-30">
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
                  disabled={readOnly || !selectedEmbeddedBreakPlan}
                >
                  Düzenle
                </button>
                <div className="h-px bg-slate-100" />
                <button
                  type="button"
                  className="block w-full px-4 py-3 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={requestEmbeddedSelectedDelete}
                  disabled={readOnly || !selectedEmbeddedBreakPlan}
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
            "mx-auto w-full",
            embeddedReadonlyDetails
              ? "max-w-[760px]"
              : "max-w-[360px] rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-sm"
          )}
        >
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
                  {embeddedReadonlyDetails.name}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Mola Süresi</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">
                  {embeddedReadonlyDetails.plannedBreakHoursText} saat
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Süre Karşılığı</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">
                  {embeddedReadonlyDetails.plannedBreakHumanText}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Ücret Durumu</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">
                  {embeddedReadonlyDetails.payText}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Durum</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">
                  {embeddedReadonlyDetails.statusText}
                </div>
              </div>
            </div>
          </div>
        ) : (
        <div className="mx-auto grid w-full max-w-[280px] gap-3">
          <label className="grid gap-1.5">
            <FieldLabel>
              Kod <RequiredMark />
            </FieldLabel>
            <input
              className={inputClass}
              value={form.code}
              onChange={(e) => {
                setTouched((s) => ({ ...s, code: true }));
                setForm((s) => ({ ...s, code: normalizeBreakCodeInput(e.target.value) }));
              }}
              onBlur={() => setTouched((s) => ({ ...s, code: true }))}
              maxLength={4}
              placeholder="M001"
              disabled={loading || effectiveReadOnly}
            />
            {showCodeError ? (
              <span className="text-xs font-medium text-rose-600">
                Kod tam 4 karakter olmalı; yalnızca harf ve rakam kullanılabilir.
              </span>
            ) : null}
          </label>

          <label className="grid gap-1.5">
            <FieldLabel>
              Ad <RequiredMark />
            </FieldLabel>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => {
                setTouched((s) => ({ ...s, name: true }));
                setForm((s) => ({ ...s, name: e.target.value }));
              }}
              onBlur={() => {
                setTouched((s) => ({ ...s, name: true }));
               setForm((s) => ({ ...s, name: normalizeBreakNameInput(s.name) }));
              }}
              maxLength={120}
              placeholder="Öğle Molası"
              disabled={loading || effectiveReadOnly}
            />
            {showNameError ? (
             <span className="text-xs font-medium text-rose-600">Ad zorunludur.</span>
            ) : null}
          </label>

          <label className="grid gap-1.5">
            <FieldLabel>
              Mola Süresi <RequiredMark />
           </FieldLabel>
            <input
              className={inputClass}
              value={form.plannedBreakHours}
              onChange={(e) => {
                setTouched((s) => ({ ...s, plannedBreakHours: true }));
                setForm((s) => ({ ...s, plannedBreakHours: e.target.value.replace(".", ",") }));
              }}
              onBlur={() => {
                setTouched((s) => ({ ...s, plannedBreakHours: true }));
                setForm((s) => ({ ...s, plannedBreakHours: normalizeBreakHoursInput(s.plannedBreakHours) }));
              }}
              inputMode="decimal"
              placeholder="1,00"
              disabled={loading || effectiveReadOnly}
            />
            {showDurationError ? (
              <span className="text-xs font-medium text-rose-600">{preview?.invalidReason}</span>
            ) : null}
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Süre karşılığı
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-950">
              {preview && !preview.invalidReason ? preview.plannedBreakHumanText : "—"}
            </div>
          </div>
          <fieldset className="grid gap-1.5">
            <FieldLabel>Ücret Durumu</FieldLabel>
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                className={cx(
                  "rounded-xl px-3 py-2 text-sm font-semibold transition",
                 !form.isPaid ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
                onClick={() => setForm((s) => ({ ...s, isPaid: false }))}
                disabled={loading || effectiveReadOnly}
              >
                Ücretsiz
              </button>
              <button
                type="button"
                className={cx(
                  "rounded-xl px-3 py-2 text-sm font-semibold transition",
                  form.isPaid ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
                onClick={() => setForm((s) => ({ ...s, isPaid: true }))}
                disabled={loading || effectiveReadOnly}
              >
                Ücretli
              </button>
            </div>
          </fieldset>

          {!embeddedReadOnlyRecord ? (
            <div
              className={cx(
                "flex gap-2 pt-1",
                form.mode === "edit" ? "flex-wrap justify-center" : "justify-end"
              )}
            >
              {form.mode === "edit" ? (
                <Button variant="secondary" onClick={cancelFormEdit} disabled={loading}>
                  Vazgeç
                </Button>
              ) : null}
              <Button variant="primary" onClick={onSubmit} disabled={loading || effectiveReadOnly || !canSubmit}>
                {form.mode === "edit" ? "Değişiklikleri Kaydet" : "Oluştur"}
              </Button>
            </div>
          ) : null}
        </div>
        )}

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            {notice}
          </div>
        ) : null}
      </div>

      {!embedded ? (
      <div className="rounded-[28px] border border-slate-200 bg-white/95 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-950">Kayıtlı Mola Planları</div>
            <div className="mt-1 text-xs text-slate-500">
              {visibleItems.length} kayıt gösteriliyor
            </div>
          </div>
          <input
            className={cx(inputClass, "max-w-xs")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ara: kod / ad / süre"
          />
        </div>

        <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-slate-200 md:block">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Kod</th>
                <th className="px-4 py-3 text-left">Ad</th>
                <th className="px-4 py-3 text-left">Mola Süresi</th>
                <th className="px-4 py-3 text-left">Süre Karşılığı</th>
                <th className="px-4 py-3 text-left">Ücret Durumu</th>
                <th className="px-4 py-3 text-left">Durum</th>
                <th className="px-4 py-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleItems.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={7}>
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                visibleItems.map((item) => (
                  <tr key={item.id} className={cx(!item.isActive && "bg-slate-50/80 text-slate-500")}>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-950">{item.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{getBreakHoursText(item)} saat</td>
                    <td className="px-4 py-3 text-slate-600">{getBreakHumanText(item)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cx(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          item.isPaid ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-800"
                        )}
                      >
                        {item.isPaid ? "Ücretli" : "Ücretsiz"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cx(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {item.isActive ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {item.isActive ? (
                          <>
                            <Button variant="secondary" onClick={() => beginEdit(item)} disabled={loading || effectiveReadOnly}>
                              Düzenle
                            </Button>
                            <Button variant="danger" onClick={() => setDeleteConfirm(item)} disabled={loading || effectiveReadOnly}>
                              Pasifleştir
                            </Button>
                          </>
                        ) : (
                          <Button variant="secondary" onClick={() => onActivate(item)} disabled={loading || effectiveReadOnly}>
                            Aktifleştir
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid gap-3 md:hidden">
          {visibleItems.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              Kayıt bulunamadı.
            </div>
          ) : (
            visibleItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-sm font-semibold text-slate-950">{item.code}</div>
                    <div className="mt-1 text-sm font-medium text-slate-800">{item.name}</div>
                  </div>
                  <span
                    className={cx(
                      "rounded-full px-2.5 py-1 text-xs font-semibold",
                      item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {item.isActive ? "Aktif" : "Pasif"}
                  </span>
                </div>
                <div className="mt-3 grid gap-1 text-sm text-slate-600">
                  <div>
                    <span className="text-slate-500">Mola:</span>{" "}
                    <span className="font-semibold text-slate-900">{getBreakHoursText(item)} saat</span>{" "}
                    <span>({getBreakHumanText(item)})</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Ücret Durumu:</span>{" "}
                    <span className="font-semibold text-slate-900">{item.isPaid ? "Ücretli" : "Ücretsiz"}</span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  {item.isActive ? (
                    <>
                      <Button variant="secondary" onClick={() => beginEdit(item)} disabled={loading || effectiveReadOnly}>
                        Düzenle
                      </Button>
                      <Button variant="danger" onClick={() => setDeleteConfirm(item)} disabled={loading || effectiveReadOnly}>
                        Pasifleştir
                      </Button>
                    </>
                  ) : (
                    <Button variant="secondary" onClick={() => onActivate(item)} disabled={loading || effectiveReadOnly}>
                      Aktifleştir
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      ) : null}
    </div>
  );
}