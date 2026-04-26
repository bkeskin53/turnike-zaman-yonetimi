"use client";

import { DateTime } from "luxon";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  buildEmployeeAssignmentEditDraft,
  humanizeEmployeeAssignmentEditValidation,
  normalizeEmployeeAssignmentEditDraft,
  toEmployeeAssignmentEditPayload,
  validateEmployeeAssignmentEditDraft,
  type EmployeeAssignmentEditDraft,
  type EmployeeAssignmentEditSource,
} from "@/src/features/employees/assignmentEditForm";
import {
  buildEmployeeMasterProfileEditDraft,
  humanizeEmployeeMasterProfileEditValidation,
  normalizeEmployeeMasterProfileEditDraft,
  toEmployeeMasterProfileEditPayload,
  validateEmployeeMasterProfileEditDraft,
  type EmployeeMasterProfileEditDraft,
  type EmployeeMasterProfileEditSource,
} from "@/src/features/employees/masterProfileEditForm";
import {
  buildEmployeeWorkScheduleProfileEditDraft,
  humanizeEmployeeWorkScheduleProfileEditValidation,
  normalizeEmployeeWorkScheduleProfileEditDraft,
  toEmployeeWorkScheduleProfileEditPayload,
  validateEmployeeWorkScheduleProfileEditDraft,
  type EmployeeWorkScheduleProfileEditDraft,
  type EmployeeWorkScheduleProfileEditSource,
} from "@/src/features/employees/workScheduleProfileEditForm";
import type { EmployeeMasterHistoryDisplayResolvedConfiguration } from "@/src/features/employees/employeeMasterHistoryDisplayConfiguration";
import type { EmployeeMasterHistoryFormResolvedConfiguration } from "@/src/features/employees/employeeMasterHistoryFormConfiguration";
import type { EmployeeMasterHistoryListResolvedConfiguration } from "@/src/features/employees/employeeMasterHistoryListConfiguration";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function buildPersonFullName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  return `${String(firstName ?? "").trim()} ${String(lastName ?? "").trim()}`.trim();
}

type NavKey =
  | "profile"
  | "assignments"
  | "weekly-plan"
  | "leaves"
  | "master"
  | "records";

type SupportedNavKey = "master" | "assignments" | "profile";
type Variant = "default" | "icon";

type BranchOption = { id: string; code: string; name: string; isActive: boolean };
type EmployeeGroupOption = { id: string; code: string; name: string };
type EmployeeSubgroupOption = { id: string; code: string; name: string; groupId: string };
type WorkScheduleOption = { id: string; code: string; name: string; isActive: boolean };

type EmployeeSummary = {
  id: string;
  employeeCode: string;
  cardNo: string | null;
  fullName: string;
};

type BaseHistoryItem = {
  id: string;
  recordId: string;
  dayKey: string;
  title: string;
  subtitle: string;
  rangeLabel: string | null;
  createdAt: string;
  updatedAt: string;
  createdAtLabel: string;
  updatedAtLabel: string;
};

type MasterHistoryItem = BaseHistoryItem & {
  detail: {
    scopeStartDate: string;
    scopeEndDate: string | null;
    employeeCode: string;
    cardNo: string;
    firstName: string;
    lastName: string;
    nationalId: string;
    gender: string;
    email: string;
    phone: string;
  };
};

type AssignmentsHistoryItem = BaseHistoryItem & {
  detail: {
    scopeStartDate: string;
    scopeEndDate: string | null;
    branchId: string;
    employeeGroupId: string;
    employeeSubgroupId: string;
  };
};

type ProfileHistoryItem = BaseHistoryItem & {
  detail: {
    scopeStartDate: string;
    scopeEndDate: string | null;
    workSchedulePatternId: string;
    workScheduleLabel: string;
    timeManagementStatus: string | null;
    dailyWorkLabel: string;
    weeklyWorkLabel: string;
    weeklyWorkDaysLabel: string;
  };
};

type HistoryListPayload<TItem extends BaseHistoryItem> = {
  employee: EmployeeSummary;
  todayDayKey: string;
  items: TItem[];
};

type HistoryListResponse<TItem extends BaseHistoryItem> = {
  item: HistoryListPayload<TItem>;
};

type MutationResult = {
  item?: {
    recordId?: string;
    effectiveDayKey?: string;
    previousEffectiveDayKey?: string;
    deletedRecordId?: string;
  };
};

type CommonProps = {
  employeeId: string;
  variant?: Variant;
  canEdit?: boolean;
  onChanged?: () => void | Promise<void>;
};

type MasterProps = CommonProps & {
  current: "master";
  source: EmployeeMasterProfileEditSource;
  masterHistoryDisplayConfiguration?: EmployeeMasterHistoryDisplayResolvedConfiguration;
  masterHistoryFormConfiguration?: EmployeeMasterHistoryFormResolvedConfiguration;
  masterHistoryListConfiguration?: EmployeeMasterHistoryListResolvedConfiguration;
};

type AssignmentsProps = CommonProps & {
  current: "assignments";
  source: EmployeeAssignmentEditSource;
  branches: BranchOption[];
  employeeGroups: EmployeeGroupOption[];
  employeeSubgroups: EmployeeSubgroupOption[];
};

type ProfileProps = CommonProps & {
  current: "profile";
  source: EmployeeWorkScheduleProfileEditSource;
  workSchedules: WorkScheduleOption[];
};

type EmployeeHistoryDialogProps = CommonProps & {
  current: NavKey;
  source?: EmployeeMasterProfileEditSource | EmployeeAssignmentEditSource | EmployeeWorkScheduleProfileEditSource;
  masterHistoryDisplayConfiguration?: EmployeeMasterHistoryDisplayResolvedConfiguration;
  masterHistoryFormConfiguration?: EmployeeMasterHistoryFormResolvedConfiguration;
  masterHistoryListConfiguration?: EmployeeMasterHistoryListResolvedConfiguration;
  branches?: BranchOption[];
  employeeGroups?: EmployeeGroupOption[];
  employeeSubgroups?: EmployeeSubgroupOption[];
  workSchedules?: WorkScheduleOption[];
};

type GroupedItems<TItem extends BaseHistoryItem> = Array<{ dayKey: string; items: TItem[] }>;

type ReloadPreference = {
  preferredRecordId?: string | null;
  preferredDayKey?: string | null;
};

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm transition " +
  "placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/25";

const buttonBaseClass =
  "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-sm transition " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const defaultMasterHistoryDisplayFieldVisibility: EmployeeMasterHistoryDisplayResolvedConfiguration["fields"] = {
  gender: { isVisible: true },
  email: { isVisible: true },
  phone: { isVisible: true },
};

const defaultMasterHistoryFormFieldVisibility: EmployeeMasterHistoryFormResolvedConfiguration["fields"] = {
  gender: { isVisible: true },
  email: { isVisible: true },
  phone: { isVisible: true },
};

const defaultMasterHistoryListFieldVisibility: EmployeeMasterHistoryListResolvedConfiguration["fields"] = {
  email: { isVisible: true },
  phone: { isVisible: true },
};

const FIRST_HISTORY_RECORD_START_DATE_LOCKED_NOTICE = "İlk kaydın geçerlilik başlangıcı değiştirilemez.";
const FIRST_HISTORY_RECORD_DELETE_BLOCKED_NOTICE = "İlk kayıt silinemez.";

function normalizeNationalIdInput(value: string) {
  return value.replace(/\D+/g, "").slice(0, 11);
}

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D+/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 4) return digits;

  const area = digits.slice(0, 4);
  const first = digits.slice(4, 7);
  const second = digits.slice(7, 9);
  const third = digits.slice(9, 11);

  let formatted = `(${area})`;
  if (first) formatted += ` ${first}`;
  if (second) formatted += ` ${second}`;
  if (third) formatted += ` ${third}`;
  return formatted;
}

function normalizeEmailInput(value: string) {
  return value.trim();
}

type MasterHistoryFieldName =
  | "scopeStartDate"
  | "firstName"
  | "lastName"
  | "nationalId"
  | "email"
  | "phone";

type MasterHistoryFieldErrors = Partial<Record<MasterHistoryFieldName, string>>;

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "").trim());
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

function buildMasterHistoryFieldErrors(args: {
  draft: EmployeeMasterProfileEditDraft;
  visibleFields: EmployeeMasterHistoryFormResolvedConfiguration["fields"];
}): MasterHistoryFieldErrors {
  const errors: MasterHistoryFieldErrors = {};
  const scopeStartDate = String(args.draft.scopeStartDate ?? "").trim();
  const firstName = String(args.draft.firstName ?? "").trim();
  const lastName = String(args.draft.lastName ?? "").trim();
  const nationalId = String(args.draft.nationalId ?? "").trim();
  const email = String(args.draft.email ?? "").trim();
  const phoneDigits = String(args.draft.phone ?? "").replace(/\D+/g, "");

  if (!scopeStartDate) {
    errors.scopeStartDate = "Bu alan zorunludur.";
  } else if (!isValidIsoDate(scopeStartDate)) {
    errors.scopeStartDate = "Geçerli bir tarih seçin.";
  }

  if (!firstName) errors.firstName = "Bu alan zorunludur.";
  if (!lastName) errors.lastName = "Bu alan zorunludur.";

  if (nationalId && !/^\d{11}$/.test(nationalId)) {
    errors.nationalId = "TC Kimlik 11 haneli olmalıdır.";
  }

  if (args.visibleFields.email.isVisible && email && !isValidEmail(email)) {
    errors.email = "E-posta formatı geçersiz.";
  }

  if (args.visibleFields.phone.isVisible && phoneDigits && phoneDigits.length !== 11) {
    errors.phone = "Telefon numarası geçersiz.";
  }

  return errors;
}

type AssignmentsHistoryFieldName =
  | "scopeStartDate"
  | "branchId"
  | "employeeGroupId"
  | "employeeSubgroupId";

type AssignmentsHistoryFieldErrors = Partial<Record<AssignmentsHistoryFieldName, string>>;

function buildAssignmentsHistoryFieldErrors(args: {
  draft: EmployeeAssignmentEditDraft;
}): AssignmentsHistoryFieldErrors {
  const errors: AssignmentsHistoryFieldErrors = {};
  const scopeStartDate = String(args.draft.scopeStartDate ?? "").trim();
  const branchId = String(args.draft.branchId ?? "").trim();
  const employeeGroupId = String(args.draft.employeeGroupId ?? "").trim();
  const employeeSubgroupId = String(args.draft.employeeSubgroupId ?? "").trim();

  if (!scopeStartDate) errors.scopeStartDate = "Bu alan zorunludur.";
  else if (!isValidIsoDate(scopeStartDate)) errors.scopeStartDate = "Geçerli bir tarih seçin.";
  if (!branchId) errors.branchId = "Bu alan zorunludur.";
  if (!employeeGroupId) errors.employeeGroupId = "Bu alan zorunludur.";
  if (!employeeSubgroupId) errors.employeeSubgroupId = "Bu alan zorunludur.";
  return errors;
}

type ProfileHistoryFieldName =
  | "scopeStartDate"
  | "workSchedulePatternId";

type ProfileHistoryFieldErrors = Partial<Record<ProfileHistoryFieldName, string>>;

function buildProfileHistoryFieldErrors(args: {
  draft: EmployeeWorkScheduleProfileEditDraft;
}): ProfileHistoryFieldErrors {
  const errors: ProfileHistoryFieldErrors = {};
  const scopeStartDate = String(args.draft.scopeStartDate ?? "").trim();
  const workSchedulePatternId = String(args.draft.workSchedulePatternId ?? "").trim();

  if (!scopeStartDate) {
    errors.scopeStartDate = "Bu alan zorunludur.";
  } else if (!isValidIsoDate(scopeStartDate)) {
    errors.scopeStartDate = "Geçerli bir tarih seçin.";
  }

  if (!workSchedulePatternId) {
    errors.workSchedulePatternId = "Bu alan zorunludur.";
  }

  return errors;
}

function isSupportedCurrent(value: NavKey): value is SupportedNavKey {
  return value === "master" || value === "assignments" || value === "profile";
}

function formatDayLabel(dayKey: string): string {
  const dt = DateTime.fromISO(dayKey, { zone: "Europe/Istanbul" }).setLocale("tr");
  if (!dt.isValid) return dayKey;
  return dt.toFormat("dd LLL yyyy");
}

function formatGender(value: string | null | undefined) {
  if (!value) return "—";
  if (value === "MALE") return "Erkek";
  if (value === "FEMALE") return "Kadın";
  if (value === "OTHER") return "Diğer";
  if (value === "UNSPECIFIED") return "Belirtilmedi";
  return value;
}

function buildHistoryPersonLabel(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
) {
  return `${String(firstName ?? "").trim()} ${String(lastName ?? "").trim()}`.trim();
}

function buildMasterHistoryListSubtitle(args: {
  item: MasterHistoryItem;
  fields: EmployeeMasterHistoryListResolvedConfiguration["fields"];
}) {
  const parts = [
    buildHistoryPersonLabel(
      args.item.detail.firstName,
      args.item.detail.lastName,
    ) || null,
    args.fields.email.isVisible && args.item.detail.email
      ? `E-posta: ${args.item.detail.email}`
      : null,
    args.fields.phone.isVisible && args.item.detail.phone
      ? `Telefon: ${args.item.detail.phone}`
      : null,
  ].filter(Boolean) as string[];

  return parts.join(" \u00b7 ") || args.item.subtitle || "Kimlik bilgisi kaydi";
}

type MasterHistoryPreviewField = {
  key: string;
  label: string;
  value: string | null;
  previousValue: string | null;
};

function normalizeHistoryPreviewValue(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized.length ? normalized : null;
}

function normalizeHistoryPreviewGender(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return formatGender(normalized);
}

function buildMasterHistoryListPreviewFields(args: {
  item: MasterHistoryItem;
  previousItem: MasterHistoryItem | null;
  fields: EmployeeMasterHistoryListResolvedConfiguration["fields"];
  showGender: boolean;
}) {
  const candidates: MasterHistoryPreviewField[] = [
    {
      key: "firstName",
      label: "AD",
      value: normalizeHistoryPreviewValue(args.item.detail.firstName),
      previousValue: args.previousItem ? normalizeHistoryPreviewValue(args.previousItem.detail.firstName) : null,
    },
    {
      key: "lastName",
      label: "SOYAD",
      value: normalizeHistoryPreviewValue(args.item.detail.lastName),
      previousValue: args.previousItem ? normalizeHistoryPreviewValue(args.previousItem.detail.lastName) : null,
    },
    {
      key: "nationalId",
      label: "TC KİMLİK",
      value: normalizeHistoryPreviewValue(args.item.detail.nationalId),
      previousValue: args.previousItem ? normalizeHistoryPreviewValue(args.previousItem.detail.nationalId) : null,
    },
    ...(args.showGender
      ? [
          {
            key: "gender",
            label: "CİNSİYET",
            value: normalizeHistoryPreviewGender(args.item.detail.gender),
            previousValue: args.previousItem ? normalizeHistoryPreviewGender(args.previousItem.detail.gender) : null,
          },
        ]
      : []),
    ...(args.fields.email.isVisible
      ? [
          {
            key: "email",
            label: "E-POSTA",
            value: normalizeHistoryPreviewValue(args.item.detail.email),
            previousValue: args.previousItem ? normalizeHistoryPreviewValue(args.previousItem.detail.email) : null,
          },
        ]
      : []),
    ...(args.fields.phone.isVisible
      ? [
          {
            key: "phone",
            label: "TELEFON",
            value: normalizeHistoryPreviewValue(args.item.detail.phone),
            previousValue: args.previousItem ? normalizeHistoryPreviewValue(args.previousItem.detail.phone) : null,
          },
        ]
      : []),
  ];

  if (!args.previousItem) {
    return [];
  }

  return candidates.filter((field) => {
    return field.previousValue !== field.value;
  });
}

function readOptionPreviewValue(
  id: string | null | undefined,
  options: Array<{ id: string; code: string; name: string }>,
) {
  const value = String(id ?? "").trim();
  if (!value) return null;
  const option = options.find((item) => item.id === value);
  if (!option) return null;
  return `${option.code} — ${option.name}`;
}

type AssignmentsHistoryPreviewField = {
  key: string;
  label: string;
  value: string | null;
  previousValue: string | null;
};

function buildAssignmentsHistoryListPreviewFields(args: {
  item: AssignmentsHistoryItem;
  previousItem: AssignmentsHistoryItem | null;
  branches: BranchOption[];
  employeeGroups: EmployeeGroupOption[];
  employeeSubgroups: EmployeeSubgroupOption[];
}) {
  const candidates: AssignmentsHistoryPreviewField[] = [
    {
      key: "branchId",
      label: "LOKASYON",
      value: readOptionPreviewValue(args.item.detail.branchId, args.branches),
      previousValue: args.previousItem
        ? readOptionPreviewValue(args.previousItem.detail.branchId, args.branches)
        : null,
    },
    {
      key: "employeeGroupId",
      label: "GRUP",
      value: readOptionPreviewValue(args.item.detail.employeeGroupId, args.employeeGroups),
      previousValue: args.previousItem
        ? readOptionPreviewValue(args.previousItem.detail.employeeGroupId, args.employeeGroups)
        : null,
    },
    {
      key: "employeeSubgroupId",
      label: "ALT GRUP",
      value: readOptionPreviewValue(args.item.detail.employeeSubgroupId, args.employeeSubgroups),
      previousValue: args.previousItem
        ? readOptionPreviewValue(args.previousItem.detail.employeeSubgroupId, args.employeeSubgroups)
        : null,
    },
  ];

  if (!args.previousItem) {
    return [];
  }

  return candidates.filter((field) => field.previousValue !== field.value);
}

type ProfileHistoryPreviewField = {
  key: string;
  label: string;
  value: string | null;
  previousValue: string | null;
};

function buildProfileHistoryListPreviewFields(args: {
  item: ProfileHistoryItem;
  previousItem: ProfileHistoryItem | null;
}) {
  const candidates: ProfileHistoryPreviewField[] = [
    {
      key: "workScheduleLabel",
      label: "ÇALIŞMA PLANI",
      value: normalizeHistoryPreviewValue(args.item.detail.workScheduleLabel),
      previousValue: args.previousItem ? normalizeHistoryPreviewValue(args.previousItem.detail.workScheduleLabel) : null,
    },
    {
      key: "timeManagementStatus",
      label: "ZAMAN YÖNETİMİ DURUMU",
      value: normalizeHistoryPreviewValue(args.item.detail.timeManagementStatus),
      previousValue: args.previousItem ? normalizeHistoryPreviewValue(args.previousItem.detail.timeManagementStatus) : null,
    },
    {
      key: "dailyWorkLabel",
      label: "GÜNLÜK ÇALIŞMA",
      value: normalizeHistoryPreviewValue(args.item.detail.dailyWorkLabel),
      previousValue: args.previousItem ? normalizeHistoryPreviewValue(args.previousItem.detail.dailyWorkLabel) : null,
    },
    {
      key: "weeklyWorkLabel",
      label: "HAFTALIK ÇALIŞMA",
      value: normalizeHistoryPreviewValue(args.item.detail.weeklyWorkLabel),
      previousValue: args.previousItem ? normalizeHistoryPreviewValue(args.previousItem.detail.weeklyWorkLabel) : null,
    },
    {
      key: "weeklyWorkDaysLabel",
      label: "HAFTALIK İŞ GÜNLERİ",
      value: normalizeHistoryPreviewValue(args.item.detail.weeklyWorkDaysLabel),
      previousValue: args.previousItem ? normalizeHistoryPreviewValue(args.previousItem.detail.weeklyWorkDaysLabel) : null,
    },
  ];

  if (!args.previousItem) {
    return [];
  }

  return candidates.filter((field) => field.previousValue !== field.value);
}

function parseApiErrorText(text: string): string | null {
  const value = String(text ?? "").trim();
  if (!value) return null;
  if (value.startsWith("{") && value.endsWith("}")) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed?.error === "string" && parsed.error.trim()) return parsed.error.trim();
    } catch {
      return value;
    }
  }
  return value;
}

function buildGroupedItems<TItem extends BaseHistoryItem>(items: TItem[]): GroupedItems<TItem> {
  const groups = new Map<string, TItem[]>();
  for (const item of items) {
    if (!groups.has(item.dayKey)) groups.set(item.dayKey, []);
    groups.get(item.dayKey)!.push(item);
  }
  return Array.from(groups.entries()).map(([dayKey, groupItems]) => ({ dayKey, items: groupItems }));
}

function pickPreferredItem<TItem extends BaseHistoryItem>(
  items: TItem[],
  args: {
    preferredRecordId?: string | null;
    preferredDayKey?: string | null;
    fallbackRecordId?: string | null;
  },
): TItem | null {
  if (!items.length) return null;
  if (args.preferredRecordId) {
    const match = items.find((item) => item.recordId === args.preferredRecordId);
    if (match) return match;
  }
  if (args.preferredDayKey) {
    const match = items.find((item) => item.dayKey === args.preferredDayKey);
    if (match) return match;
  }
  if (args.fallbackRecordId) {
    const match = items.find((item) => item.recordId === args.fallbackRecordId);
    if (match) return match;
  }
  return items[0] ?? null;
}

function useDialogPortal(persistKey?: string) {
  const [open, setOpen] = useState(false);
  const mounted = typeof document !== "undefined";

  useEffect(() => {
    if (!mounted || !persistKey) return;
    try {
      const persisted = window.sessionStorage.getItem(persistKey);
      if (persisted === "1") {
        setOpen(true);
      }
    } catch {
      // ignore storage access issues
    }
  }, [mounted, persistKey]);

  const setOpenWithPersistence = useCallback(
    (value: boolean) => {
      setOpen(value);

      if (!mounted || !persistKey) return;
      try {
        if (value) {
          window.sessionStorage.setItem(persistKey, "1");
        } else {
          window.sessionStorage.removeItem(persistKey);
        }
      } catch {
        // ignore storage access issues
      }
    },
    [mounted, persistKey],
  );

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return { mounted, open, setOpen: setOpenWithPersistence };
}

function useContextHistoryList<TItem extends BaseHistoryItem>(args: {
  open: boolean;
  endpoint: string;
  asOf: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HistoryListPayload<TItem> | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  async function reload(preference?: ReloadPreference) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(args.endpoint, { credentials: "include" });
      const text = await response.text();
      if (!response.ok) throw new Error(parseApiErrorText(text) ?? response.statusText);
      const json = JSON.parse(text) as HistoryListResponse<TItem>;
      const nextData = json.item;
      const nextItems = Array.isArray(nextData?.items) ? nextData.items : [];
      const nextSelected = pickPreferredItem(nextItems, {
        preferredRecordId: preference?.preferredRecordId ?? null,
        preferredDayKey: preference?.preferredDayKey ?? args.asOf ?? null,
        fallbackRecordId: selectedRecordId,
      });
      setData(nextData);
      setSelectedRecordId(nextSelected?.recordId ?? null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
      setData(null);
      setSelectedRecordId(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!args.open) return;
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.open, args.endpoint, args.asOf]);

  const groupedItems = useMemo(() => buildGroupedItems(data?.items ?? []), [data]);

  const selectedItem = useMemo(() => {
    if (!data?.items?.length || !selectedRecordId) return null;
    return data.items.find((item) => item.recordId === selectedRecordId) ?? null;
  }, [data, selectedRecordId]);

  const displayWinnerRecordIds = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groupedItems) {
      const winner = group.items[0];
      if (winner) map.set(group.dayKey, winner.recordId);
    }
    return map;
  }, [groupedItems]);

  return {
    loading,
    error,
    data,
    groupedItems,
    selectedItem,
    selectedRecordId,
    setSelectedRecordId,
    displayWinnerRecordIds,
    reload,
  };
}

function TriggerButton(props: {
  variant: Variant;
  activeLabel: string | null;
  onClick: () => void;
}) {
  if (props.variant === "icon") {
    return (
      <button
        type="button"
        onClick={props.onClick}
        title={props.activeLabel ? `Tarihçe · ${props.activeLabel}` : "Tarihçe"}
        aria-label={props.activeLabel ? `Tarihçe · ${props.activeLabel}` : "Tarihçe"}
        className={cx(
          "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/25",
          props.activeLabel
            ? "border-sky-200 bg-sky-50 text-sky-700 shadow-[0_8px_18px_rgba(14,116,144,0.10)] hover:border-sky-300 hover:bg-sky-100"
            : "border-slate-200 bg-slate-50 text-slate-600 shadow-[0_4px_12px_rgba(15,23,42,0.06)] hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700",
        )}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none">
          <path d="M4 6v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.2 14.8A7 7 0 1 0 7.1 6.7L4 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 8.3v4.1l2.7 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cx(
        "inline-flex min-h-[46px] items-center justify-center rounded-2xl border px-4 py-2.5 text-sm font-semibold transition",
        props.activeLabel
          ? "border-amber-200 bg-amber-50 text-amber-800 shadow-[0_8px_18px_rgba(180,83,9,0.10)] hover:border-amber-300 hover:bg-amber-100"
          : "border-white/80 bg-white/78 text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.05)] hover:-translate-y-[1px] hover:border-indigo-200 hover:bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(238,242,255,0.95))] hover:text-indigo-700 hover:shadow-[0_12px_24px_rgba(79,70,229,0.10)]",
      )}
    >
      <span className="truncate">{props.activeLabel ? `Tarihçe · ${props.activeLabel}` : "Tarihçe"}</span>
    </button>
  );
}

function HistoryDialogFrame(props: {
  mounted: boolean;
  open: boolean;
  setOpen: (value: boolean) => void;
  variant: Variant;
  activeLabel: string | null;
  title: string;
  subtitle?: string;
  employee?: EmployeeSummary | null;
  listCount: number;
  listPanel: ReactNode;
  detailTitle?: string;
  detailSubtitle?: string;
  detailPanel: ReactNode;
  detailFooter?: ReactNode;
  floatingNotice?: ReactNode;
}) {
  const modalContent =
    props.open && props.mounted ? (
      <div className="fixed inset-0 z-[10000] overflow-y-auto bg-slate-950/38 p-6 backdrop-blur-[3px]">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[980px] items-center justify-center">
          <div className="flex h-[94vh] w-full flex-col overflow-hidden rounded-[28px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.985),rgba(248,250,252,0.975))] shadow-[0_24px_70px_rgba(15,23,42,0.22)]">            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="flex min-h-0 flex-col border-b border-zinc-200 bg-zinc-50/70 lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                  <div className="text-sm font-semibold text-zinc-900">Değişiklik Geçmişi</div>
                  <div className="text-xs text-zinc-500">{props.listCount} kayıt</div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">{props.listPanel}</div>
              </div>

              <div className="relative flex min-h-0 flex-col bg-white">
                {(props.detailTitle || props.detailSubtitle) ? (
                  <div className="border-b border-zinc-200 px-5 py-3">
                    {props.detailTitle ? <div className="text-sm font-semibold text-zinc-900">{props.detailTitle}</div> : null}
                    {props.detailSubtitle ? <div className="mt-0.5 text-xs text-zinc-500">{props.detailSubtitle}</div> : null}
                  </div>
                ) : null}
                {props.floatingNotice}
                <div className="min-h-0 flex-1 overflow-y-auto p-5">{props.detailPanel}</div>
                {props.detailFooter ? (
                  <div className="border-t border-zinc-200 bg-white/95 px-5 py-4 backdrop-blur-sm">
                    {props.detailFooter}
                  </div>
                ) : null}
              </div>
            </div>

          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <TriggerButton variant={props.variant} activeLabel={props.activeLabel} onClick={() => props.setOpen(true)} />
      {props.mounted ? createPortal(modalContent, document.body) : null}
    </>
  );
}

function HistoryList<TItem extends BaseHistoryItem>(props: {
  loading: boolean;
  error: string | null;
  groupedItems: GroupedItems<TItem>;
  selectedRecordId: string | null;
  selectedDayKey: string | null;
  tagLabel: string;
  emptyText: string;
  renderItemBody?: (item: TItem) => ReactNode;
  showItemMetaRow?: boolean;
  onSelect: (item: TItem) => void;
}) {
  if (props.loading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="h-4 w-24 animate-pulse rounded bg-zinc-100" />
            <div className="mt-3 h-4 w-48 animate-pulse rounded bg-zinc-100" />
            <div className="mt-2 h-3 w-full animate-pulse rounded bg-zinc-100" />
          </div>
        ))}
      </div>
    );
  }

  if (props.error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <div className="font-semibold">Tarihçe yüklenemedi</div>
        <div className="mt-1 break-words">{props.error}</div>
      </div>
    );
  }

  if (!props.groupedItems.length) {
    return <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">{props.emptyText}</div>;
  }

  const showItemMetaRow = props.showItemMetaRow ?? true;

  return (
    <div className="grid gap-4">
      {props.groupedItems.map((group) => {
        const groupActive = group.dayKey === props.selectedDayKey;
        return (
          <div
            key={group.dayKey}
            className={cx(
              "grid gap-2 rounded-3xl border p-3 transition",
              groupActive
                ? "border-indigo-300 bg-[linear-gradient(180deg,rgba(224,231,255,0.98),rgba(238,242,255,0.96),rgba(255,255,255,0.98))] shadow-[0_18px_40px_rgba(79,70,229,0.14)] ring-1 ring-indigo-200/70"
                : "border-transparent bg-transparent",
            )}
          >
            <div className={cx("px-1 text-sm font-semibold", groupActive ? "text-indigo-900" : "text-zinc-800")}>{formatDayLabel(group.dayKey)}</div>
            <div className="grid gap-2">
              {group.items.map((item) => {
                const active = item.recordId === props.selectedRecordId;
                const inSelectedGroup = item.dayKey === props.selectedDayKey;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => props.onSelect(item)}
                    className={cx(
                      "grid gap-2 rounded-2xl border p-4 text-left transition focus-visible:outline-none",
                      active
                        ? "border-blue-900 bg-white ring-2 ring-blue-900/80 shadow-[0_14px_28px_rgba(15,23,42,0.18)]"
                        : inSelectedGroup
                          ? "border-indigo-200 bg-[linear-gradient(135deg,rgba(238,242,255,0.92),rgba(255,255,255,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] ring-1 ring-indigo-100/80"
                          : "border-zinc-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/70",
                    )}
                  >
                    {showItemMetaRow ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700 ring-1 ring-zinc-200">
                          {props.tagLabel}
                        </span>
                        {item.rangeLabel ? <span className="text-[11px] text-zinc-500">{item.rangeLabel}</span> : null}
                      </div>
                    ) : null}
                    <div className="text-sm font-semibold text-zinc-900">{item.title}</div>
                    {props.renderItemBody ? (
                      props.renderItemBody(item)
                    ) : (
                      <div className="text-sm text-zinc-600">{item.subtitle}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionCard(props: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3">
        <div className="grid gap-0.5">
          <div className="text-sm font-semibold text-zinc-900">{props.title}</div>
          {props.subtitle ? <div className="text-xs text-zinc-500">{props.subtitle}</div> : null}
        </div>
        {props.right ? <div className="shrink-0">{props.right}</div> : null}
      </div>
      <div className="p-4">{props.children}</div>
    </div>
  );
}

function DetailValue(props: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{props.label}</div>
      <div className="text-sm text-zinc-900">{props.value}</div>
    </div>
  );
}

function NoticeBanner(props: { tone?: "info" | "warn" | "error"; title: string; text: string }) {
  const tone = props.tone ?? "info";
  const className =
    tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-900"
        : "border-sky-200 bg-sky-50 text-sky-900";

  return (
    <div className={cx("rounded-2xl border px-4 py-3 text-sm", className)}>
      <div className="font-semibold">{props.title}</div>
      <div className="mt-1 leading-6">{props.text}</div>
    </div>
  );
}

function FormTextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  onBlur?: () => void;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "search" | "email" | "url" | "none";
  maxLength?: number;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-semibold text-slate-800">
        {props.label}
        {props.required ? <span className="text-rose-600"> *</span> : null}
      </span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        inputMode={props.inputMode}
        maxLength={props.maxLength}
        onChange={(event) => props.onChange(event.target.value)}
        onBlur={props.onBlur}
        placeholder={props.placeholder}
        disabled={props.disabled}
        className={cx(
          inputClass,
          props.error ? "border-rose-300 bg-rose-50/70 focus:border-rose-300 focus:ring-rose-500/20" : undefined,
          props.disabled ? "cursor-not-allowed bg-slate-50 text-slate-500" : undefined
        )}
      />
      {props.error ? (
        <span className="text-xs font-medium text-rose-600">{props.error}</span>
      ) : null}
    </label>
  );
}

function FormSelectField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-semibold text-slate-800">
        {props.label}
        {props.required ? <span className="text-rose-600"> *</span> : null}
      </span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className={cx(
          inputClass,
          props.error ? "border-rose-300 bg-rose-50/70 focus:border-rose-300 focus:ring-rose-500/20" : undefined
        )}
      >
        <option value="">{props.placeholder}</option>
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {props.error ? (
        <span className="text-xs font-medium text-rose-600">{props.error}</span>
      ) : null}
    </label>
  );
}

function ContextViewFooter(props: {
  canEdit: boolean;
  hasSelection: boolean;
  onCreate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  deleting?: boolean;
  canDelete?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center">
        {props.canEdit ? (
          <button type="button" onClick={props.onCreate} className={cx(buttonBaseClass, "border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100")}>
            Yeni kayıt ekle
          </button>
        ) : <div />}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {props.canEdit && props.hasSelection ? (
          <button type="button" onClick={props.onEdit} className={cx(buttonBaseClass, "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50")}>
            Düzenle
          </button>
        ) : null}
        {props.canEdit && (props.canDelete ?? true) && props.hasSelection ? (
          <button type="button" onClick={props.onDelete} disabled={props.deleting} className={cx(buttonBaseClass, "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100")}>
            {props.deleting ? "Siliniyor..." : "Sil"}
          </button>
        ) : null}
        <button type="button" onClick={props.onClose} className={cx(buttonBaseClass, "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50")}>
          İptal
        </button>
      </div>
    </div>
  );
}

function ContextMetaSummary(props: {
  updatedAtLabel: string;
  scopeStartDate: string;
}) {
  return (
    <div className="grid gap-1.5 border-b border-zinc-100 pb-4">
      <div className="text-sm text-zinc-700">
        En son <span className="font-semibold text-zinc-900">{props.updatedAtLabel}</span> tarihinde güncellendi.
      </div>
      <div className="text-xs text-zinc-500">
        Şu tarihten itibaren geçerli: <span className="font-medium text-zinc-700">{formatDayLabel(props.scopeStartDate)}</span>
      </div>
    </div>
  );
}

function ContextActionBar(props: {
  canEdit: boolean;
  mode: "view" | "create" | "edit";
  hasSelection: boolean;
  onCreate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCancelMode: () => void;
  deleting?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {props.mode === "view" ? (
        <>
          {props.canEdit ? (
            <button type="button" onClick={props.onCreate} className={cx(buttonBaseClass, "border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100")}>
              Yeni kayıt ekle
            </button>
          ) : null}
          {props.canEdit && props.hasSelection ? (
            <button type="button" onClick={props.onEdit} className={cx(buttonBaseClass, "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50")}>
              Düzenle
            </button>
          ) : null}
          {props.canEdit && props.hasSelection ? (
            <button type="button" onClick={props.onDelete} disabled={props.deleting} className={cx(buttonBaseClass, "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100")}>
              {props.deleting ? "Siliniyor..." : "Sil"}
            </button>
          ) : null}
        </>
      ) : (
        <button type="button" onClick={props.onCancelMode} className={cx(buttonBaseClass, "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50")}>
          Kayda dön
        </button>
      )}
    </div>
  );
}

void ContextActionBar;

function readOptionLabel(id: string | null | undefined, options: Array<{ id: string; code: string; name: string }>, fallback = "—") {
  const value = String(id ?? "").trim();
  if (!value) return fallback;
  const option = options.find((item) => item.id === value);
  if (!option) return fallback;
  return `${option.code} — ${option.name}`;
}

function humanizeMasterHistoryError(value: string) {
  const fallback = "Kimlik bilgileri tarihçesi kaydedilemedi.";
  const known = humanizeEmployeeMasterProfileEditValidation(value);
  if (known !== "Bilgiler kaydedilemedi. Lütfen alanları kontrol edin.") return known;
  const map: Record<string, string> = {
    BAD_ID: "Çalışan kaydı bulunamadı.",
    INVALID_BODY: "Gönderilen bilgi seti okunamadı.",
    EMPLOYEE_NOT_FOUND: "Çalışan kaydı bulunamadı.",
    RECORD_ID_REQUIRED: "Seçili kayıt bilgisi eksik.",
    RECORD_NOT_FOUND: "Seçili kimlik kaydı bulunamadı.",
    RECORD_ALREADY_EXISTS_FOR_DATE: "Bu tarih için zaten bir kayıt var. Mevcut tarihçe kaydını değiştirmek için Yeni kayıt ekle yerine Düzenle kullanın.",
    SCOPE_START_DATE_AFTER_RANGE_END: "Geçerlilik başlangıcı mevcut kayıt aralığının dışına taşamaz.",
    UNAUTHORIZED: "Oturum doğrulanamadı.",
    FORBIDDEN: "Bu işlem için yetkiniz yok.",
  };
  return map[value] ?? fallback;
}

function humanizeAssignmentsHistoryError(value: string) {
  const fallback = "Organizasyon tarihçesi kaydedilemedi.";
  const known = humanizeEmployeeAssignmentEditValidation(value);
  if (known !== "Organizasyon bilgileri kaydedilemedi. Lütfen alanları kontrol edin.") return known;
  const map: Record<string, string> = {
    BAD_ID: "Çalışan kaydı bulunamadı.",
    INVALID_BODY: "Gönderilen bilgi seti okunamadı.",
    EMPLOYEE_NOT_FOUND: "Çalışan kaydı bulunamadı.",
    RECORD_ID_REQUIRED: "Seçili kayıt bilgisi eksik.",
    RECORD_NOT_FOUND: "Seçili organizasyon kaydı bulunamadı.",
    RECORD_ALREADY_EXISTS_FOR_DATE: "Bu tarih için zaten bir kayıt var. Mevcut tarihçe kaydını değiştirmek için Yeni kayıt ekle yerine Düzenle kullanın.",
    EMPLOYEE_NOT_EMPLOYED_ON_EFFECTIVE_DATE: "Seçilen tarihte çalışan istihdam kapsamında değil.",
    INVALID_BRANCH_ID: "Seçilen lokasyon bulunamadı ya da pasif durumda.",
    INVALID_EMPLOYEE_GROUP_ID: "Seçilen grup bulunamadı.",
    INVALID_EMPLOYEE_SUBGROUP_ID: "Seçilen alt grup bulunamadı.",
    SUBGROUP_GROUP_MISMATCH: "Seçilen alt grup, seçilen gruba ait değil.",
    SCOPE_START_DATE_AFTER_RANGE_END: "Geçerlilik başlangıcı mevcut kayıt aralığının dışına taşamaz.",
    UNAUTHORIZED: "Oturum doğrulanamadı.",
    FORBIDDEN: "Bu işlem için yetkiniz yok.",
  };
  return map[value] ?? fallback;
}

function humanizeProfileHistoryError(value: string) {
  const fallback = "Bu tarih için zaten bir kayıt var. Mevcut tarihçe kaydını değiştirmek için Yeni kayıt ekle yerine Düzenle kullanın.";
  const known = humanizeEmployeeWorkScheduleProfileEditValidation(value);
  if (known !== "Vardiya bilgileri kaydedilemedi. Lütfen alanları kontrol edin.") return known;
  const map: Record<string, string> = {
    BAD_ID: "Çalışan kaydı bulunamadı.",
    INVALID_BODY: "Gönderilen bilgi seti okunamadı.",
    EMPLOYEE_NOT_FOUND: "Çalışan kaydı bulunamadı.",
    RECORD_ID_REQUIRED: "Seçili kayıt bilgisi eksik.",
    RECORD_NOT_FOUND: "Seçili vardiya kaydı bulunamadı.",
    EMPLOYEE_NOT_EMPLOYED_ON_EFFECTIVE_DATE: "Seçilen tarihte çalışan istihdam kapsamında değil.",
    INVALID_WORK_SCHEDULE_PATTERN_ID: "Seçilen çalışma planı bulunamadı ya da pasif durumda.",
    SCOPE_START_DATE_AFTER_RANGE_END: "Geçerlilik başlangıcı mevcut kayıt aralığının dışına taşamaz.",
    UNAUTHORIZED: "Oturum doğrulanamadı.",
    FORBIDDEN: "Bu işlem için yetkiniz yok.",
  };
  return map[value] ?? fallback;
}

function MasterHistoryDialog(props: MasterProps) {
  const variant = props.variant ?? "default";
  const canEdit = props.canEdit === true;
  const searchParams = useSearchParams();
  const asOf = String(searchParams.get("asOf") ?? "").trim();
  const { mounted, open, setOpen } = useDialogPortal(`employee-history-dialog:master:${props.employeeId}`);
  const history = useContextHistoryList<MasterHistoryItem>({
    open,
    endpoint: `/api/employees/${props.employeeId}/master/history`,
    asOf,
  });

  const [mode, setMode] = useState<"view" | "create" | "edit">("view");
  const [draft, setDraft] = useState<EmployeeMasterProfileEditDraft | null>(null);
  const [notice, setNotice] = useState<{ kind: "error"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<MasterHistoryFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const duplicateDateNoticeText = humanizeMasterHistoryError("RECORD_ALREADY_EXISTS_FOR_DATE");
  const showDuplicateDateFloatingNotice =
    mode === "create" && notice?.text === duplicateDateNoticeText;
  const visibleHistoryFields =
    props.masterHistoryDisplayConfiguration?.fields ??
    defaultMasterHistoryDisplayFieldVisibility;
  const visibleHistoryFormFields =
    props.masterHistoryFormConfiguration?.fields ??
    defaultMasterHistoryFormFieldVisibility;
  const visibleHistoryListFields =
    props.masterHistoryListConfiguration?.fields ??
    defaultMasterHistoryListFieldVisibility;
  const selectedHistoryFullName = history.selectedItem
    ? buildPersonFullName(history.selectedItem.detail.firstName, history.selectedItem.detail.lastName)
    : "";
  const detailTitleName = selectedHistoryFullName || history.data?.employee?.fullName || "Çalışan";

  const selectedDayKey = history.selectedItem?.dayKey ?? null;
  const selectedIsDisplayWinner = history.selectedItem
    ? history.displayWinnerRecordIds.get(history.selectedItem.dayKey) === history.selectedItem.recordId
    : false;
  const firstHistoryRecordId = history.data?.items?.length
    ? history.data.items[history.data.items.length - 1]?.recordId ?? null
    : null;
  const selectedIsFirstRecord = history.selectedItem ? history.selectedItem.recordId === firstHistoryRecordId : false;
  const previousHistoryItemByRecordId = useMemo(() => {
    const map = new Map<string, MasterHistoryItem | null>();
    const items = history.data?.items ?? [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const previousItem = items[index + 1] ?? null;
      map.set(item.recordId, previousItem);
    }
    return map;
  }, [history.data?.items]);
  const groupedListItems = useMemo(
    () =>
      history.groupedItems.map((group) => ({
        ...group,
        items: group.items.map((item) => ({
          ...item,
          subtitle: buildMasterHistoryListSubtitle({
            item,
            fields: visibleHistoryListFields,
          }),
        })),
      })),
    [history.groupedItems, visibleHistoryListFields],
  );

  useEffect(() => {
    if (!open) {
      setMode("view");
      setDraft(null);
      setNotice(null);
      setFieldErrors({});
      setSaving(false);
      setDeleting(false);
    }
  }, [open]);

  function openCreateMode() {
    const base = history.selectedItem?.detail;
    setDraft(
      buildEmployeeMasterProfileEditDraft({
        source: {
          employeeCode: props.source.employeeCode,
          cardNo: props.source.cardNo,
          firstName: base?.firstName ?? props.source.firstName,
          lastName: base?.lastName ?? props.source.lastName,
          nationalId: base?.nationalId ?? props.source.nationalId,
          gender: base?.gender ?? props.source.gender,
          email: base?.email ?? props.source.email,
          phone: base?.phone ?? props.source.phone,
        },
        scopeStartDate: history.data?.todayDayKey ?? selectedDayKey ?? "",
      }),
    );
    setNotice(null);
    setFieldErrors({});
    setMode("create");
  }

  function openEditMode() {
    if (!history.selectedItem) return;
    setDraft(
      buildEmployeeMasterProfileEditDraft({
        source: {
          employeeCode: props.source.employeeCode,
          cardNo: props.source.cardNo,
          firstName: history.selectedItem.detail.firstName,
          lastName: history.selectedItem.detail.lastName,
          nationalId: history.selectedItem.detail.nationalId,
          gender: history.selectedItem.detail.gender,
          email: history.selectedItem.detail.email,
          phone: history.selectedItem.detail.phone,
        },
        scopeStartDate: history.selectedItem.detail.scopeStartDate,
      }),
    );
    setNotice(null);
    setFieldErrors({});
    setMode("edit");
  }

  async function submitDraft() {
    if (!draft) return;
    const normalized = normalizeEmployeeMasterProfileEditDraft(draft);
    const nextFieldErrors = buildMasterHistoryFieldErrors({
      draft: normalized,
      visibleFields: visibleHistoryFormFields,
    });
    if (Object.keys(nextFieldErrors).length > 0) {
      setDraft(normalized);
      setFieldErrors(nextFieldErrors);
      setNotice(null);
      return;
    }

    const validationCode = validateEmployeeMasterProfileEditDraft(normalized);
    if (validationCode) {
      setDraft(normalized);
      setFieldErrors({});
      setNotice({ kind: "error", text: humanizeMasterHistoryError(validationCode) });
      return;
    }

    if (
      mode === "edit" &&
      history.selectedItem &&
      selectedIsFirstRecord &&
      normalized.scopeStartDate !== history.selectedItem.detail.scopeStartDate
    ) {
      setDraft({ ...normalized, scopeStartDate: history.selectedItem.detail.scopeStartDate });
      setFieldErrors({});
      setNotice({ kind: "error", text: FIRST_HISTORY_RECORD_START_DATE_LOCKED_NOTICE });
      return;
    }

    if (
      mode === "create" &&
      (history.data?.items ?? []).some(
        (item) => item.detail.scopeStartDate === normalized.scopeStartDate,
      )
    ) {
      setDraft(normalized);
      setFieldErrors({});
      setNotice({
        kind: "error",
        text: humanizeMasterHistoryError("RECORD_ALREADY_EXISTS_FOR_DATE"),
      });
      return;
    }

    setSaving(true);
    setFieldErrors({});
    setNotice(null);
    try {
      const payload = toEmployeeMasterProfileEditPayload(normalized);
      const response = await fetch(`/api/employees/${props.employeeId}/master/history`, {
        method: mode === "edit" ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          ...(mode === "edit" && history.selectedItem ? { recordId: history.selectedItem.recordId } : {}),
        }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(parseApiErrorText(text) ?? response.statusText);
      const result = JSON.parse(text) as MutationResult;
      setMode("view");
      setDraft(null);
      setFieldErrors({});
      await history.reload({
        preferredRecordId: result.item?.recordId ?? history.selectedItem?.recordId ?? null,
        preferredDayKey: result.item?.effectiveDayKey ?? normalized.scopeStartDate,
      });
      await props.onChanged?.();
    } catch (error) {
      setFieldErrors({});
      setNotice({
        kind: "error",
        text: humanizeMasterHistoryError(error instanceof Error ? error.message : String(error)),
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedRecord() {
    if (!history.selectedItem) return;
    if (selectedIsFirstRecord) {
      setNotice({ kind: "error", text: FIRST_HISTORY_RECORD_DELETE_BLOCKED_NOTICE });
      return;
    }
    if (!window.confirm("Seçili kimlik kaydı silinsin mi? Bu işlem yalnızca seçtiğiniz kaydı kaldırır.")) return;

    setDeleting(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/employees/${props.employeeId}/master/history`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: history.selectedItem.recordId }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(parseApiErrorText(text) ?? response.statusText);
      await history.reload({ preferredDayKey: history.selectedItem.dayKey });
      await props.onChanged?.();
    } catch (error) {
      setNotice({
        kind: "error",
        text: humanizeMasterHistoryError(error instanceof Error ? error.message : String(error)),
      });
    } finally {
      setDeleting(false);
    }
  }

  const detailPanel =
    mode === "view" ? (
      history.loading ? (
        <div className="grid gap-4">
          <div className="h-32 animate-pulse rounded-3xl border border-zinc-200 bg-zinc-50" />
          <div className="h-64 animate-pulse rounded-3xl border border-zinc-200 bg-zinc-50" />
        </div>
      ) : history.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="font-semibold">Kayıt detayları yüklenemedi</div>
          <div className="mt-1 break-words">{history.error}</div>
        </div>
      ) : history.selectedItem ? (
        <div className="grid gap-4">

          <ContextMetaSummary updatedAtLabel={history.selectedItem.updatedAtLabel} scopeStartDate={history.selectedItem.detail.scopeStartDate} />

          {!selectedIsDisplayWinner ? (
            <NoticeBanner
              tone="warn"
              title="Ayni tarihte birden fazla kayit var"
              text="Bu tarihte ekranda son guncellenen kayit gosterilir. Sectiginiz kayit arsivde korunur; isterseniz bu kaydi duzenleyebilir veya silebilirsiniz."
            />
          ) : null}

          {notice ? <NoticeBanner tone="error" title="Islem tamamlanamadi" text={notice.text} /> : null}

          <SectionCard title="Kimlik ve iletişim" subtitle="Seçilen kaydın alanları">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailValue label="Sicil No" value={history.selectedItem.detail.employeeCode || "—"} />
              <DetailValue label="Kart ID" value={history.selectedItem.detail.cardNo || "—"} />
              <DetailValue label="Ad" value={history.selectedItem.detail.firstName || "—"} />
              <DetailValue label="Soyad" value={history.selectedItem.detail.lastName || "—"} />
              <DetailValue label="TC Kimlik" value={history.selectedItem.detail.nationalId || "—"} />
              {visibleHistoryFields.gender.isVisible ? (
                <DetailValue
                  label="Cinsiyet"
                  value={formatGender(history.selectedItem.detail.gender)}
                />
              ) : null}
              {visibleHistoryFields.email.isVisible ? (
                <DetailValue
                  label="E-posta"
                  value={history.selectedItem.detail.email || "—"}
                />
              ) : null}
              {visibleHistoryFields.phone.isVisible ? (
                <DetailValue
                  label="Telefon"
                  value={history.selectedItem.detail.phone || "—"}
                />
              ) : null}
            </div>
          </SectionCard>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
            Henüz gösterilecek kimlik tarihçesi kaydı bulunmuyor.
          </div>
        </div>
      )
    ) : (
      <div className="grid gap-4">
        {mode === "create" ? (
          <>
            <div className="grid gap-1">
              <div className="grid gap-1">
                <div className="text-lg font-semibold text-zinc-900">Yeni kimlik kaydı ekle</div>
                <div className="text-sm text-zinc-600">
                  Bu işlem yeni bir kayıt oluşturur. Aynı tarih için ikinci kayıt açılamaz; mevcut kaydı değiştirmek için Düzenle kullanın.
                </div>
              </div>
            </div>
          </>
        ) : null}

        {notice && !showDuplicateDateFloatingNotice ? <NoticeBanner tone="error" title="Islem tamamlanamadi" text={notice.text} /> : null}

        {draft ? (
          <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormTextField
                label="Geçerlilik başlangıcı"
                value={draft.scopeStartDate}
                onChange={(value) => setDraft((current) => (current ? { ...current, scopeStartDate: value } : current))}
                type="date"
                required
                error={fieldErrors.scopeStartDate}
                disabled={mode === "edit" && selectedIsFirstRecord}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormTextField
                label="Ad"
                value={draft.firstName}
                onChange={(value) => setDraft((current) => (current ? { ...current, firstName: value } : current))}
                required
                error={fieldErrors.firstName}
              />
              <FormTextField
                label="Soyad"
                value={draft.lastName}
                onChange={(value) => setDraft((current) => (current ? { ...current, lastName: value } : current))}
                required
                error={fieldErrors.lastName}
              />
              <FormTextField
                label="TC Kimlik"
                value={draft.nationalId}
                inputMode="numeric"
                maxLength={11}
                onChange={(value) =>
                  setDraft((current) => (current ? { ...current, nationalId: normalizeNationalIdInput(value) } : current))
                }
                error={fieldErrors.nationalId}
              />
              {visibleHistoryFormFields.gender.isVisible ? (
                <FormSelectField
                  label="Cinsiyet"
                  value={draft.gender}
                  onChange={(value) => setDraft((current) => (current ? { ...current, gender: value } : current))}
                  placeholder="Seçilmedi"
                  options={[
                    { value: "MALE", label: "Erkek" },
                    { value: "FEMALE", label: "Kadın" },
                    { value: "OTHER", label: "Diğer" },
                    { value: "UNSPECIFIED", label: "Belirtilmedi" },
                  ]}
                />
              ) : null}
              {visibleHistoryFormFields.email.isVisible ? (
                <FormTextField
                  label="E-posta"
                  value={draft.email}
                  type="email"
                  onChange={(value) => setDraft((current) => (current ? { ...current, email: value } : current))}
                  onBlur={() =>
                    setDraft((current) => (current ? { ...current, email: normalizeEmailInput(current.email) } : current))
                  }
                  error={fieldErrors.email}
                />
              ) : null}
              {visibleHistoryFormFields.phone.isVisible ? (
                <FormTextField
                  label="Telefon"
                  value={draft.phone}
                  type="tel"
                  inputMode="tel"
                  maxLength={16}
                  onChange={(value) =>
                    setDraft((current) => (current ? { ...current, phone: formatPhoneInput(value) } : current))
                  }
                  onBlur={() =>
                    setDraft((current) => (current ? { ...current, phone: formatPhoneInput(current.phone) } : current))
                  }
                  error={fieldErrors.phone}
                />
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  setMode("view");
                  setDraft(null);
                  setFieldErrors({});
                  setNotice(null);
                }}
                disabled={saving}
                className={cx(buttonBaseClass, "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50")}
              >
                İptal
              </button>
              <button type="button" onClick={submitDraft} disabled={saving || !draft} className={cx(buttonBaseClass, "bg-slate-950 text-white hover:bg-slate-800")}>
                {saving ? "Kaydediliyor..." : mode === "create" ? "Yeni kaydı kaydet" : "Seçili kaydı güncelle"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  
  const detailFooter =
    mode === "view" && !history.loading && !history.error ? (
      <ContextViewFooter
        canEdit={canEdit}
        hasSelection={Boolean(history.selectedItem)}
        onCreate={openCreateMode}
        onEdit={openEditMode}
        onDelete={deleteSelectedRecord}
        onClose={() => setOpen(false)}
        deleting={deleting}
        canDelete={!selectedIsFirstRecord}
      />
    ) : null;

  return (
    <HistoryDialogFrame
      mounted={mounted}
      open={open}
      setOpen={setOpen}
      variant={variant}
      activeLabel={asOf || null}
      title="Kimlik Bilgileri Tarihçesi"
      listCount={history.data?.items?.length ?? 0}
      listPanel={
        <HistoryList
          loading={history.loading}
          error={history.error}
          groupedItems={groupedListItems}
          selectedRecordId={history.selectedRecordId}
          selectedDayKey={selectedDayKey}
          tagLabel="Kimlik"
          renderItemBody={(item) => {
            const fields = buildMasterHistoryListPreviewFields({
              item,
              previousItem: previousHistoryItemByRecordId.get(item.recordId) ?? null,
              fields: visibleHistoryListFields,
              showGender: visibleHistoryFields.gender.isVisible,
            });

            return (
              <div className="grid gap-y-3">
                {fields.map((field) => (
                  <div key={field.key} className="min-w-0 grid gap-0.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">{field.label}</div>
                    {field.value ? (
                      <div className="break-words text-sm font-semibold leading-5 text-emerald-700">{field.value}</div>
                    ) : null}
                    {field.previousValue && field.previousValue !== field.value ? (
                      <div className="break-words text-xs leading-5 text-zinc-400 line-through">{field.previousValue}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            );
          }}
          showItemMetaRow={false}
          emptyText="Bu çalışan için kimlik bilgisi tarihçesi bulunamadı."
          onSelect={(item) => {
            history.setSelectedRecordId(item.recordId);
            setMode("view");
            setDraft(null);
            setFieldErrors({});
            setNotice(null);
          }}
        />
      }
      detailTitle={`Kişisel Bilgiler: ${detailTitleName}`}
      floatingNotice={
        showDuplicateDateFloatingNotice ? (
          <div className="border-b border-zinc-100 px-5 py-3">
            <div
              role="alert"
              aria-live="assertive"
              className="ml-auto w-full max-w-[430px] rounded-2xl border border-rose-200 bg-white/98 px-4 py-3 shadow-[0_18px_40px_rgba(225,29,72,0.16)] ring-1 ring-rose-100 backdrop-blur-sm"
            >
              <div className="flex items-start gap-3 text-sm leading-6 text-rose-900">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current">
                    <path d="M10 1.75a8.25 8.25 0 1 0 0 16.5a8.25 8.25 0 0 0 0-16.5Zm.75 11.5h-1.5v-1.5h1.5v1.5Zm0-3h-1.5V5.75h1.5v4.5Z" />
                  </svg>
                </span>
                <div>{duplicateDateNoticeText}</div>
              </div>
            </div>
          </div>
        ) : null
      }
      detailPanel={detailPanel}
      detailFooter={detailFooter}
    />
  );
}

function AssignmentsHistoryDialog(props: AssignmentsProps) {
  const variant = props.variant ?? "default";
  const canEdit = props.canEdit === true;
  const searchParams = useSearchParams();
  const asOf = String(searchParams.get("asOf") ?? "").trim();
  const { mounted, open, setOpen } = useDialogPortal(`employee-history-dialog:assignments:${props.employeeId}`);
  const history = useContextHistoryList<AssignmentsHistoryItem>({
    open,
    endpoint: `/api/employees/${props.employeeId}/assignments/history`,
    asOf,
  });

  const [mode, setMode] = useState<"view" | "create" | "edit">("view");
  const [draft, setDraft] = useState<EmployeeAssignmentEditDraft | null>(null);
  const [notice, setNotice] = useState<{ kind: "error"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AssignmentsHistoryFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const duplicateDateNoticeText = humanizeAssignmentsHistoryError("RECORD_ALREADY_EXISTS_FOR_DATE");
  const showDuplicateDateFloatingNotice =
    mode === "create" && notice?.text === duplicateDateNoticeText;

  const branchOptions = useMemo(() => {
    return props.branches.filter((branch) => branch.isActive).map((branch) => ({ value: branch.id, label: `${branch.code} — ${branch.name}` }));
  }, [props.branches]);

  const groupOptions = useMemo(() => {
    return props.employeeGroups.map((group) => ({ value: group.id, label: `${group.code} — ${group.name}` }));
  }, [props.employeeGroups]);

  const subgroupOptions = useMemo(() => {
    const groupId = draft?.employeeGroupId ?? "";
    return props.employeeSubgroups.filter((subgroup) => subgroup.groupId === groupId).map((subgroup) => ({
      value: subgroup.id,
      label: `${subgroup.code} — ${subgroup.name}`,
    }));
  }, [props.employeeSubgroups, draft?.employeeGroupId]);

  const selectedDayKey = history.selectedItem?.dayKey ?? null;
  const selectedIsDisplayWinner = history.selectedItem
    ? history.displayWinnerRecordIds.get(history.selectedItem.dayKey) === history.selectedItem.recordId
    : false;
  const firstHistoryRecordId = history.data?.items?.length
    ? history.data.items[history.data.items.length - 1]?.recordId ?? null
    : null;
  const selectedIsFirstRecord = history.selectedItem ? history.selectedItem.recordId === firstHistoryRecordId : false;
  const previousHistoryItemByRecordId = useMemo(() => {
    const map = new Map<string, AssignmentsHistoryItem | null>();
    const items = history.data?.items ?? [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const previousItem = items[index + 1] ?? null;
      map.set(item.recordId, previousItem);
    }
    return map;
  }, [history.data?.items]);

  useEffect(() => {
    if (!open) {
      setMode("view");
      setDraft(null);
      setNotice(null);
      setFieldErrors({});
      setSaving(false);
      setDeleting(false);
    }
  }, [open]);

  function openCreateMode() {
    const base = history.selectedItem?.detail;
    setDraft(
      buildEmployeeAssignmentEditDraft({
        source: {
          branchId: base?.branchId ?? props.source.branchId,
          employeeGroupId: base?.employeeGroupId ?? props.source.employeeGroupId,
          employeeSubgroupId: base?.employeeSubgroupId ?? props.source.employeeSubgroupId,
        },
        scopeStartDate: history.data?.todayDayKey ?? selectedDayKey ?? "",
      }),
    );
    setNotice(null);
    setFieldErrors({});
    setMode("create");
  }

  function openEditMode() {
    if (!history.selectedItem) return;
    setDraft(
      buildEmployeeAssignmentEditDraft({
        source: {
          branchId: history.selectedItem.detail.branchId,
          employeeGroupId: history.selectedItem.detail.employeeGroupId,
          employeeSubgroupId: history.selectedItem.detail.employeeSubgroupId,
        },
        scopeStartDate: history.selectedItem.detail.scopeStartDate,
      }),
    );
    setNotice(null);
    setFieldErrors({});
    setMode("edit");
  }

  async function submitDraft() {
    if (!draft) return;
    const normalized = normalizeEmployeeAssignmentEditDraft(draft);
    const nextFieldErrors = buildAssignmentsHistoryFieldErrors({
      draft: normalized,
    });
    if (Object.keys(nextFieldErrors).length > 0) {
      setDraft(normalized);
      setFieldErrors(nextFieldErrors);
      setNotice(null);
      return;
    }

    const validationCode = validateEmployeeAssignmentEditDraft(normalized);
    if (validationCode) {
      setDraft(normalized);
      setFieldErrors({});
      setNotice({ kind: "error", text: humanizeAssignmentsHistoryError(validationCode) });
      return;
    }

    if (
      mode === "create" &&
      (history.data?.items ?? []).some(
        (item) => item.detail.scopeStartDate === normalized.scopeStartDate,
      )
    ) {
      setDraft(normalized);
      setFieldErrors({});
      setNotice({
        kind: "error",
        text: humanizeAssignmentsHistoryError("RECORD_ALREADY_EXISTS_FOR_DATE"),
      });
      return;
    }

    if (
      mode === "edit" &&
      history.selectedItem &&
      selectedIsFirstRecord &&
      normalized.scopeStartDate !== history.selectedItem.detail.scopeStartDate
    ) {
      setDraft({ ...normalized, scopeStartDate: history.selectedItem.detail.scopeStartDate });
      setFieldErrors({});
      setNotice({ kind: "error", text: FIRST_HISTORY_RECORD_START_DATE_LOCKED_NOTICE });
      return;
    }

    setSaving(true);
    setFieldErrors({});
    setNotice(null);
    try {
      const response = await fetch(`/api/employees/${props.employeeId}/assignments/history`, {
        method: mode === "edit" ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...toEmployeeAssignmentEditPayload(normalized),
          ...(mode === "edit" && history.selectedItem ? { recordId: history.selectedItem.recordId } : {}),
        }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(parseApiErrorText(text) ?? response.statusText);
      const result = JSON.parse(text) as MutationResult;
      setMode("view");
      setDraft(null);
      setFieldErrors({});
      await history.reload({
        preferredRecordId: result.item?.recordId ?? history.selectedItem?.recordId ?? null,
        preferredDayKey: result.item?.effectiveDayKey ?? normalized.scopeStartDate,
      });
      await props.onChanged?.();
    } catch (error) {
      setFieldErrors({});
      setNotice({
        kind: "error",
        text: humanizeAssignmentsHistoryError(error instanceof Error ? error.message : String(error)),
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedRecord() {
    if (!history.selectedItem) return;
    if (selectedIsFirstRecord) {
      setNotice({ kind: "error", text: FIRST_HISTORY_RECORD_DELETE_BLOCKED_NOTICE });
      return;
    }

    if (!window.confirm("Seçili organizasyon kaydı silinsin mi? Bu işlem yalnızca seçtiğiniz kaydı kaldırır.")) return;

    setDeleting(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/employees/${props.employeeId}/assignments/history`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: history.selectedItem.recordId }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(parseApiErrorText(text) ?? response.statusText);
      await history.reload({ preferredDayKey: history.selectedItem.dayKey });
      await props.onChanged?.();
    } catch (error) {
      setNotice({
        kind: "error",
        text: humanizeAssignmentsHistoryError(error instanceof Error ? error.message : String(error)),
      });
    } finally {
      setDeleting(false);
    }
  }

  const detailPanel =
    mode === "view" ? (
      history.loading ? (
        <div className="grid gap-4">
          <div className="h-32 animate-pulse rounded-3xl border border-zinc-200 bg-zinc-50" />
          <div className="h-64 animate-pulse rounded-3xl border border-zinc-200 bg-zinc-50" />
        </div>
      ) : history.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="font-semibold">Kayıt detayları yüklenemedi</div>
          <div className="mt-1 break-words">{history.error}</div>
        </div>
      ) : history.selectedItem ? (
        <div className="grid gap-4">

          <ContextMetaSummary updatedAtLabel={history.selectedItem.updatedAtLabel} scopeStartDate={history.selectedItem.detail.scopeStartDate} />

          {!selectedIsDisplayWinner ? (
            <NoticeBanner tone="warn" title="Ayni tarihte birden fazla kayit var" text="Bu tarihte ekranda son guncellenen organizasyon kaydi gosterilir. Sectiginiz kayit arsivde korunur." />
          ) : null}

          {notice ? <NoticeBanner tone="error" title="Islem tamamlanamadi" text={notice.text} /> : null}

          <SectionCard title="Organizasyon verisi" subtitle="Seçilen kaydın organizasyon alanları">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailValue label="Lokasyon" value={readOptionLabel(history.selectedItem.detail.branchId, props.branches)} />
              <DetailValue label="Grup" value={readOptionLabel(history.selectedItem.detail.employeeGroupId, props.employeeGroups)} />
              <DetailValue label="Alt grup" value={readOptionLabel(history.selectedItem.detail.employeeSubgroupId, props.employeeSubgroups)} />
            </div>
          </SectionCard>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">Henüz gösterilecek organizasyon tarihçesi kaydı bulunmuyor.</div>
        </div>
      )
    ) : (
      <div className="grid gap-4">
        <div className="grid gap-1">
          <div className="grid gap-1">
            <div className="text-lg font-semibold text-zinc-900">{mode === "create" ? "Yeni organizasyon kaydı ekle" : "Seçili organizasyon kaydını düzenle"}</div>
            <div className="text-sm text-zinc-600">{mode === "create" ? "Bu işlem yeni bir kayıt oluşturur. Aynı tarih için ikinci kayıt açılamaz; mevcut kaydı değiştirmek için Düzenle kullanın." : "Bu işlem yalnızca seçili kaydı günceller. Yeni kopya oluşturulmaz."}</div>
          </div>
        </div>

        {notice && !showDuplicateDateFloatingNotice ? <NoticeBanner tone="error" title="Islem tamamlanamadi" text={notice.text} /> : null}

        {draft ? (
          <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormTextField
                label="Geçerlilik başlangıcı"
                value={draft.scopeStartDate}
                onChange={(value) => setDraft((current) => (current ? { ...current, scopeStartDate: value } : current))}
                type="date"
                required
                error={fieldErrors.scopeStartDate}
                disabled={mode === "edit" && selectedIsFirstRecord}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormSelectField
                label="Lokasyon"
                value={draft.branchId}
                onChange={(value) => setDraft((current) => (current ? { ...current, branchId: value } : current))}
                options={branchOptions}
                placeholder="Lokasyon seçin"
                required
                error={fieldErrors.branchId}
              />
              <FormSelectField
                label="Grup"
                value={draft.employeeGroupId}
                onChange={(value) =>
                  setDraft((current) => {
                    if (!current) return current;
                    const keepSubgroup = props.employeeSubgroups.some((subgroup) => subgroup.id === current.employeeSubgroupId && subgroup.groupId === value);
                    return { ...current, employeeGroupId: value, employeeSubgroupId: keepSubgroup ? current.employeeSubgroupId : "" };
                  })
                }
                options={groupOptions}
                placeholder="Grup seçin"
                required
                error={fieldErrors.employeeGroupId}
              />
              <FormSelectField
                label="Alt grup"
                value={draft.employeeSubgroupId}
                onChange={(value) => setDraft((current) => (current ? { ...current, employeeSubgroupId: value } : current))}
                options={subgroupOptions}
                placeholder={draft.employeeGroupId ? "Alt grup seçin" : "Önce grup seçin"}
                required
                error={fieldErrors.employeeSubgroupId}
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => { setMode("view"); setDraft(null); setFieldErrors({}); setNotice(null); }} disabled={saving} className={cx(buttonBaseClass, "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50")}>
                İptal
              </button>
              <button type="button" onClick={submitDraft} disabled={saving || !draft} className={cx(buttonBaseClass, "bg-slate-950 text-white hover:bg-slate-800")}>
                {saving ? "Kaydediliyor..." : mode === "create" ? "Yeni kaydı kaydet" : "Seçili kaydı güncelle"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  
  const detailFooter =
    mode === "view" && !history.loading && !history.error ? (
      <ContextViewFooter
        canEdit={canEdit}
        hasSelection={Boolean(history.selectedItem)}
        onCreate={openCreateMode}
        onEdit={openEditMode}
        onDelete={deleteSelectedRecord}
        onClose={() => setOpen(false)}
        deleting={deleting}
        canDelete={!selectedIsFirstRecord}
      />
    ) : null;

  return (
    <HistoryDialogFrame
      mounted={mounted}
      open={open}
      setOpen={setOpen}
      variant={variant}
      activeLabel={asOf || null}
      title="Organizasyon Verisi Tarihçesi"
      listCount={history.data?.items?.length ?? 0}
      listPanel={
        <HistoryList
          loading={history.loading}
          error={history.error}
          groupedItems={history.groupedItems}
          selectedRecordId={history.selectedRecordId}
          selectedDayKey={selectedDayKey}
          tagLabel="Organizasyon"
          showItemMetaRow={false}
          renderItemBody={(item) => {
            const fields = buildAssignmentsHistoryListPreviewFields({
              item,
              previousItem: previousHistoryItemByRecordId.get(item.recordId) ?? null,
              branches: props.branches,
              employeeGroups: props.employeeGroups,
              employeeSubgroups: props.employeeSubgroups,
            });

            return (
              <div className="grid gap-y-3">
                {fields.map((field) => (
                  <div key={field.key} className="min-w-0 grid gap-0.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">{field.label}</div>
                    {field.value ? (
                      <div className="break-words text-sm font-semibold leading-5 text-emerald-700">{field.value}</div>
                    ) : null}
                    {field.previousValue && field.previousValue !== field.value ? (
                      <div className="break-words text-xs leading-5 text-zinc-400 line-through">{field.previousValue}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            );
          }}
          emptyText="Bu çalışan için organizasyon tarihçesi bulunamadı."
          onSelect={(item) => { history.setSelectedRecordId(item.recordId); setMode("view"); setDraft(null); setFieldErrors({}); setNotice(null); }}
        />
      }
      detailTitle={`Organizasyon Verisi: ${history.data?.employee?.fullName || "Çalışan"}`}
      floatingNotice={
        showDuplicateDateFloatingNotice ? (
          <div className="border-b border-zinc-100 px-5 py-3">
            <div
              role="alert"
              aria-live="assertive"
              className="ml-auto w-full max-w-[430px] rounded-2xl border border-rose-200 bg-white/98 px-4 py-3 shadow-[0_18px_40px_rgba(225,29,72,0.16)] ring-1 ring-rose-100 backdrop-blur-sm"
            >
              <div className="flex items-start gap-3 text-sm leading-6 text-rose-900">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current">
                    <path d="M10 1.75a8.25 8.25 0 1 0 0 16.5a8.25 8.25 0 0 0 0-16.5Zm.75 11.5h-1.5v-1.5h1.5v1.5Zm0-3h-1.5V5.75h1.5v4.5Z" />
                  </svg>
                </span>
                <div>{duplicateDateNoticeText}</div>
              </div>
            </div>
          </div>
        ) : null
      }
      detailPanel={detailPanel}
      detailFooter={detailFooter}
    />
  );
}

function ProfileHistoryDialog(props: ProfileProps) {
  const variant = props.variant ?? "default";
  const canEdit = props.canEdit === true;
  const searchParams = useSearchParams();
  const asOf = String(searchParams.get("asOf") ?? "").trim();
  const { mounted, open, setOpen } = useDialogPortal(`employee-history-dialog:profile:${props.employeeId}`);
  const history = useContextHistoryList<ProfileHistoryItem>({
    open,
    endpoint: `/api/employees/${props.employeeId}/profile/history`,
    asOf,
  });

  const [mode, setMode] = useState<"view" | "create" | "edit">("view");
  const [draft, setDraft] = useState<EmployeeWorkScheduleProfileEditDraft | null>(null);
  const [notice, setNotice] = useState<{ kind: "error"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ProfileHistoryFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const duplicateDateNoticeText = humanizeProfileHistoryError("RECORD_ALREADY_EXISTS_FOR_DATE");
  const showDuplicateDateFloatingNotice =
    mode === "create" && notice?.text === duplicateDateNoticeText;

  const workScheduleOptions = useMemo(() => {
    return props.workSchedules.filter((workSchedule) => workSchedule.isActive).map((workSchedule) => ({
      value: workSchedule.id,
      label: `${workSchedule.code} — ${workSchedule.name}`,
    }));
  }, [props.workSchedules]);

  const selectedDayKey = history.selectedItem?.dayKey ?? null;
  const selectedIsDisplayWinner = history.selectedItem
    ? history.displayWinnerRecordIds.get(history.selectedItem.dayKey) === history.selectedItem.recordId
    : false;
  const firstHistoryRecordId = history.data?.items?.length
    ? history.data.items[history.data.items.length - 1]?.recordId ?? null
    : null;
  const selectedIsFirstRecord = history.selectedItem ? history.selectedItem.recordId === firstHistoryRecordId : false;
  const previousHistoryItemByRecordId = useMemo(() => {
    const map = new Map<string, ProfileHistoryItem | null>();
    const items = history.data?.items ?? [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const previousItem = items[index + 1] ?? null;
      map.set(item.recordId, previousItem);
    }
    return map;
  }, [history.data?.items]);

  useEffect(() => {
    if (!open) {
      setMode("view");
      setDraft(null);
      setNotice(null);
      setFieldErrors({});
      setSaving(false);
      setDeleting(false);
    }
  }, [open]);

  function openCreateMode() {
    const base = history.selectedItem?.detail;
    setDraft(
      buildEmployeeWorkScheduleProfileEditDraft({
        source: {
          workSchedulePatternId: base?.workSchedulePatternId ?? props.source.workSchedulePatternId,
        },
        scopeStartDate: history.data?.todayDayKey ?? selectedDayKey ?? "",
      }),
    );
    setNotice(null);
    setFieldErrors({});
    setMode("create");
  }

  function openEditMode() {
    if (!history.selectedItem) return;
    setDraft(
      buildEmployeeWorkScheduleProfileEditDraft({
        source: {
          workSchedulePatternId: history.selectedItem.detail.workSchedulePatternId,
        },
        scopeStartDate: history.selectedItem.detail.scopeStartDate,
      }),
    );
    setNotice(null);
    setFieldErrors({});
    setMode("edit");
  }

  async function submitDraft() {
    if (!draft) return;
    const normalized = normalizeEmployeeWorkScheduleProfileEditDraft(draft);
    const nextFieldErrors = buildProfileHistoryFieldErrors({
      draft: normalized,
    });
    if (Object.keys(nextFieldErrors).length > 0) {
      setDraft(normalized);
      setFieldErrors(nextFieldErrors);
      setNotice(null);
      return;
    }

    const validationCode = validateEmployeeWorkScheduleProfileEditDraft(normalized);
    if (validationCode) {
      setDraft(normalized);
      setFieldErrors({});
      setNotice({ kind: "error", text: humanizeProfileHistoryError(validationCode) });
      return;
    }

    if (
      mode === "edit" &&
      history.selectedItem &&
      selectedIsFirstRecord &&
      normalized.scopeStartDate !== history.selectedItem.detail.scopeStartDate
    ) {
      setDraft({ ...normalized, scopeStartDate: history.selectedItem.detail.scopeStartDate });
      setFieldErrors({});
      setNotice({ kind: "error", text: FIRST_HISTORY_RECORD_START_DATE_LOCKED_NOTICE });
      return;
    }

    if (
      mode === "create" &&
      (history.data?.items ?? []).some(
        (item) => item.detail.scopeStartDate === normalized.scopeStartDate,
      )
    ) {
      setDraft(normalized);
      setFieldErrors({});
      setNotice({
        kind: "error",
        text: humanizeProfileHistoryError("RECORD_ALREADY_EXISTS_FOR_DATE"),
      });
      return;
    }

    setSaving(true);
    setFieldErrors({});
    setNotice(null);
    try {
      const response = await fetch(`/api/employees/${props.employeeId}/profile/history`, {
        method: mode === "edit" ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...toEmployeeWorkScheduleProfileEditPayload(normalized),
          ...(mode === "edit" && history.selectedItem ? { recordId: history.selectedItem.recordId } : {}),
        }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(parseApiErrorText(text) ?? response.statusText);
      const result = JSON.parse(text) as MutationResult;
      setMode("view");
      setDraft(null);
      setFieldErrors({});
      await history.reload({
        preferredRecordId: result.item?.recordId ?? history.selectedItem?.recordId ?? null,
        preferredDayKey: result.item?.effectiveDayKey ?? normalized.scopeStartDate,
      });
      await props.onChanged?.();
    } catch (error) {
      setFieldErrors({});
      setNotice({
        kind: "error",
        text: humanizeProfileHistoryError(error instanceof Error ? error.message : String(error)),
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedRecord() {
    if (!history.selectedItem) return;
    if (selectedIsFirstRecord) {
      setNotice({ kind: "error", text: FIRST_HISTORY_RECORD_DELETE_BLOCKED_NOTICE });
      return;
    }

    if (!window.confirm("Seçili vardiya kaydı silinsin mi? Bu işlem yalnızca seçtiğiniz kaydı kaldırır.")) return;

    setDeleting(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/employees/${props.employeeId}/profile/history`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: history.selectedItem.recordId }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(parseApiErrorText(text) ?? response.statusText);
      await history.reload({ preferredDayKey: history.selectedItem.dayKey });
      await props.onChanged?.();
    } catch (error) {
      setNotice({
        kind: "error",
        text: humanizeProfileHistoryError(error instanceof Error ? error.message : String(error)),
      });
    } finally {
      setDeleting(false);
    }
  }

  const detailPanel =
    mode === "view" ? (
      history.loading ? (
        <div className="grid gap-4">
          <div className="h-32 animate-pulse rounded-3xl border border-zinc-200 bg-zinc-50" />
          <div className="h-64 animate-pulse rounded-3xl border border-zinc-200 bg-zinc-50" />
        </div>
      ) : history.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="font-semibold">Kayıt detayları yüklenemedi</div>
          <div className="mt-1 break-words">{history.error}</div>
        </div>
      ) : history.selectedItem ? (
        <div className="grid gap-4">

          <ContextMetaSummary updatedAtLabel={history.selectedItem.updatedAtLabel} scopeStartDate={history.selectedItem.detail.scopeStartDate} />

          {!selectedIsDisplayWinner ? (
            <NoticeBanner tone="warn" title="Ayni tarihte birden fazla kayit var" text="Bu tarihte ekranda son guncellenen vardiya kaydi gosterilir. Sectiginiz kayit arsivde korunur." />
          ) : null}

          {notice ? <NoticeBanner tone="error" title="Islem tamamlanamadi" text={notice.text} /> : null}

          <SectionCard title="Vardiya bilgisi" subtitle="Seçilen kaydın çalışma planı">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailValue label="Çalışma planı" value={history.selectedItem.detail.workScheduleLabel || "—"} />
              <DetailValue label="Zaman yönetimi durumu" value={String(history.selectedItem.detail.timeManagementStatus ?? "").trim() || "—"} />
              <DetailValue label="Günlük çalışma saati" value={history.selectedItem.detail.dailyWorkLabel || "—"} />
              <DetailValue label="Haftalık çalışma saati" value={history.selectedItem.detail.weeklyWorkLabel || "—"} />
              <DetailValue label="Haftalık iş günleri" value={history.selectedItem.detail.weeklyWorkDaysLabel || "—"} />
            </div>
          </SectionCard>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">Henüz gösterilecek vardiya tarihçesi kaydı bulunmuyor.</div>
        </div>
      )
    ) : (
      <div className="grid gap-4">
        <div className="grid gap-1">
          <div className="grid gap-1">
            <div className="text-lg font-semibold text-zinc-900">{mode === "create" ? "Yeni vardiya kaydı ekle" : "Seçili vardiya kaydını düzenle"}</div>
            <div className="text-sm text-zinc-600">{mode === "create" ? "Bu işlem yeni bir kayıt oluşturur. Aynı tarih için ikinci kayıt açılamaz; mevcut kaydı değiştirmek için Düzenle kullanın." : "Bu işlem yalnızca seçili kaydı günceller. Yeni kopya oluşturulmaz."}</div>
          </div>
        </div>

        {notice && !showDuplicateDateFloatingNotice ? <NoticeBanner tone="error" title="Islem tamamlanamadi" text={notice.text} /> : null}

        {draft ? (
          <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormTextField
                label="Geçerlilik başlangıcı"
                value={draft.scopeStartDate}
                onChange={(value) => setDraft((current) => (current ? { ...current, scopeStartDate: value } : current))}
                type="date"
                required
                error={fieldErrors.scopeStartDate}
                disabled={mode === "edit" && selectedIsFirstRecord}
              />
              <FormSelectField
                label="Çalışma planı"
                value={draft.workSchedulePatternId}
                onChange={(value) => setDraft((current) => (current ? { ...current, workSchedulePatternId: value } : current))}
                options={workScheduleOptions}
                placeholder="Çalışma planı seçin"
                required
                error={fieldErrors.workSchedulePatternId}
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => { setMode("view"); setDraft(null); setFieldErrors({}); setNotice(null); }} disabled={saving} className={cx(buttonBaseClass, "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50")}>
                İptal
              </button>
              <button type="button" onClick={submitDraft} disabled={saving || !draft} className={cx(buttonBaseClass, "bg-slate-950 text-white hover:bg-slate-800")}>
                {saving ? "Kaydediliyor..." : mode === "create" ? "Yeni kaydı kaydet" : "Seçili kaydı güncelle"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );

  const detailFooter =
    mode === "view" && !history.loading && !history.error ? (
      <ContextViewFooter
        canEdit={canEdit}
        hasSelection={Boolean(history.selectedItem)}
        onCreate={openCreateMode}
        onEdit={openEditMode}
        onDelete={deleteSelectedRecord}
        onClose={() => setOpen(false)}
        deleting={deleting}
        canDelete={!selectedIsFirstRecord}
      />
    ) : null;

  return (
    <HistoryDialogFrame
      mounted={mounted}
      open={open}
      setOpen={setOpen}
      variant={variant}
      activeLabel={asOf || null}
      title="Vardiya Bilgileri Tarihçesi"
      listCount={history.data?.items?.length ?? 0}
      listPanel={
        <HistoryList
          loading={history.loading}
          error={history.error}
          groupedItems={history.groupedItems}
          selectedRecordId={history.selectedRecordId}
          selectedDayKey={selectedDayKey}
          tagLabel="Vardiya"
          showItemMetaRow={false}
          renderItemBody={(item) => {
            const fields = buildProfileHistoryListPreviewFields({
              item,
              previousItem: previousHistoryItemByRecordId.get(item.recordId) ?? null,
            });

            return (
              <div className="grid gap-y-3">
                {fields.map((field) => (
                  <div key={field.key} className="min-w-0 grid gap-0.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">{field.label}</div>
                    {field.value ? (
                      <div className="break-words text-sm font-semibold leading-5 text-emerald-700">{field.value}</div>
                    ) : null}
                    {field.previousValue && field.previousValue !== field.value ? (
                      <div className="break-words text-xs leading-5 text-zinc-400 line-through">{field.previousValue}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            );
          }}
          emptyText="Bu çalışan için vardiya tarihçesi bulunamadı."
          onSelect={(item) => { history.setSelectedRecordId(item.recordId); setMode("view"); setDraft(null); setFieldErrors({}); setNotice(null); }}
        />
      }
      detailTitle={`Vardiya Bilgileri: ${history.data?.employee?.fullName || "Çalışan"}`}
      floatingNotice={
        showDuplicateDateFloatingNotice ? (
          <div className="border-b border-zinc-100 px-5 py-3">
            <div
              role="alert"
              aria-live="assertive"
              className="ml-auto w-full max-w-[430px] rounded-2xl border border-rose-200 bg-white/98 px-4 py-3 shadow-[0_18px_40px_rgba(225,29,72,0.16)] ring-1 ring-rose-100 backdrop-blur-sm"
            >
              <div className="flex items-start gap-3 text-sm leading-6 text-rose-900">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current">
                    <path d="M10 1.75a8.25 8.25 0 1 0 0 16.5a8.25 8.25 0 0 0 0-16.5Zm.75 11.5h-1.5v-1.5h1.5v1.5Zm0-3h-1.5V5.75h1.5v4.5Z" />
                  </svg>
                </span>
                <div>{duplicateDateNoticeText}</div>
              </div>
            </div>
          </div>
        ) : null
      }
      detailPanel={detailPanel}
      detailFooter={detailFooter}
    />
  );
}

export default function EmployeeHistoryDialog(props: EmployeeHistoryDialogProps) {
  if (!isSupportedCurrent(props.current)) return null;

  if (props.current === "master") {
    const source = props.source as EmployeeMasterProfileEditSource | undefined;
    if (!source) return null;
    return <MasterHistoryDialog {...props} current="master" source={source} />;
  }

  if (props.current === "assignments") {
    const source = props.source as EmployeeAssignmentEditSource | undefined;
    if (!source || !props.branches || !props.employeeGroups || !props.employeeSubgroups) return null;
    return (
      <AssignmentsHistoryDialog
        {...props}
        current="assignments"
        source={source}
        branches={props.branches}
        employeeGroups={props.employeeGroups}
        employeeSubgroups={props.employeeSubgroups}
      />
    );
  }

  const source = props.source as EmployeeWorkScheduleProfileEditSource | undefined;
  if (!source || !props.workSchedules) return null;
  return <ProfileHistoryDialog {...props} current="profile" source={source} workSchedules={props.workSchedules} />;
}
