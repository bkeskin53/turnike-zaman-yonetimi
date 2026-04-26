"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import EmployeeDetailSubnav from "./_components/EmployeeDetailSubnav";
import EmployeeAsOfDateControl from "./_components/EmployeeAsOfDateControl";
import EmployeeHistoryDialog from "./_components/EmployeeHistoryDialog";
import VersionedEditModalShell from "./_components/VersionedEditModalShell";
import {
  EmployeeWorkScheduleProfileEditDraft,
  buildEmployeeWorkScheduleProfileEditDraft,
  humanizeEmployeeWorkScheduleProfileEditValidation,
  normalizeEmployeeWorkScheduleProfileEditDraft,
  toEmployeeWorkScheduleProfileEditPayload,
  validateEmployeeWorkScheduleProfileEditDraft,
} from "@/src/features/employees/workScheduleProfileEditForm";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type ShiftProfileMetricLite = {
  kind: "NONE" | "FIXED" | "VARIABLE";
  minutes?: number | null;
  days?: number | null;
  label: string;
};

type ShiftProfileLite = {
  workSchedule:
    | {
        patternId: string;
        code: string;
        name: string;
        label: string;
      }
    | null;
  timeManagementStatus: string | null;
  dailyWork: ShiftProfileMetricLite;
  weeklyWork: ShiftProfileMetricLite;
  weeklyWorkDays: ShiftProfileMetricLite;
};

type EmployeeHistoryMeta = {
  dayKey: string;
  todayDayKey: string;
  isHistorical: boolean;
  canEdit: boolean;
  mode: "AS_OF" | "CURRENT";
  profileSource: string;
  orgSource: string;
};

type MasterResponse = {
  item: {
    employee: {
      id: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
      isActive: boolean;
    };
    history: EmployeeHistoryMeta;
    today: {
      dayKey: string;
      shiftProfile: ShiftProfileLite | null;
    };
  };
};

type WorkScheduleOption = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

function readMetricLabel(metric: ShiftProfileMetricLite | null | undefined): string {
  const label = String(metric?.label ?? "").trim();
  return label || "—";
}

function readWorkScheduleLabel(profile: ShiftProfileLite | null | undefined): string {
  const label = String(profile?.workSchedule?.label ?? "").trim();
  return label || "—";
}

function readTimeManagementStatus(profile: ShiftProfileLite | null | undefined): string {
  const label = String(profile?.timeManagementStatus ?? "").trim();
  return label || "—";
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  const contentType = String(res.headers.get("content-type") ?? "").toLowerCase();

  if (contentType.includes("application/json")) {
    try {
      const json = (await res.json()) as { error?: string };
      const msg = String(json?.error ?? "").trim();
      if (msg) return msg;
    } catch {
      // ignore
    }
  }

  try {
    const txt = String(await res.text()).trim();
    if (!txt) return fallback;
    if (txt.startsWith("<!DOCTYPE html") || txt.startsWith("<html")) return fallback;
    return txt;
  } catch {
    return fallback;
  }
}

function readItems<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (typeof payload === "object" && payload !== null && Array.isArray((payload as { items?: unknown }).items)) {
    return (payload as { items: T[] }).items;
  }
  return [];
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

function humanizeProfileEditError(value: string) {
  const fallback = "Vardiya bilgileri kaydedilemedi. Lütfen alanları kontrol edin.";
  const known = humanizeEmployeeWorkScheduleProfileEditValidation(value);
  if (known !== fallback) return known;
  const map: Record<string, string> = {
    BAD_ID: "Çalışan kaydı bulunamadı.",
    INVALID_BODY: "Gönderilen bilgi seti okunamadı.",
    EMPLOYEE_NOT_FOUND: "Çalışan kaydı bulunamadı.",
    EMPLOYEE_NOT_EMPLOYED_ON_EFFECTIVE_DATE: "Seçilen tarihte çalışan istihdam kapsamında değil.",
    INVALID_WORK_SCHEDULE_PATTERN_ID: "Seçilen çalışma planı bulunamadı ya da pasif durumda.",
    UNAUTHORIZED: "Oturum doğrulanamadı.",
    FORBIDDEN: "Bu işlem için yetkiniz yok.",
  };
  return map[value] ?? fallback;
}

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm transition " +
  "placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/25";

function Badge({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "warn" | "ok" | "neutral";
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-100 text-emerald-800 ring-emerald-200/80"
      : tone === "warn"
        ? "bg-amber-100 text-amber-900 ring-amber-200/80"
        : tone === "neutral"
          ? "bg-slate-100 text-slate-700 ring-slate-200"
          : "bg-sky-100 text-sky-800 ring-sky-200/80";

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1",
        cls,
      )}
    >
      {children}
    </span>
  );
}

function EditIconButton(props: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 shadow-[0_4px_12px_rgba(15,23,42,0.06)] transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/25"
      title={props.label}
      aria-label={props.label}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none">
        <path
          d="M5 18.8h3.3L18.6 8.5a1.9 1.9 0 1 0-2.7-2.7L5.6 16.1 5 18.8Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="m14.3 7.4 2.3 2.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-xl bg-slate-200/80",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent",
        className,
      )}
    />
  );
}

function SkeletonPill({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-full bg-slate-200/80",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent",
        className,
      )}
    />
  );
}

function SkeletonMetricCard() {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-indigo-50/50 px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
      <SkeletonLine className="h-3 w-28" />
      <SkeletonLine className="mt-3 h-7 w-24" />
    </div>
  );
}

function Card({
  title,
  description,
  right,
  children,
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cx(
        "rounded-3xl border min-w-0 max-w-full overflow-hidden",
        "border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-indigo-50/40",
        "shadow-[0_10px_30px_rgba(15,23,42,0.06)]",
      )}
    >
      <div
        className={cx(
          "flex items-start justify-between gap-4 border-b border-slate-200/70 px-5 py-3 min-w-0 max-w-full backdrop-blur-sm",
          "bg-gradient-to-r from-indigo-100/90 via-white to-sky-100/80",
        )}
      >
        <div className="min-w-0 max-w-full">
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="px-5 py-3.5 min-w-0 max-w-full">{children}</div>
    </section>
  );
}

function InfoValueCard({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-indigo-50/50 px-4 py-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
        {label}
      </div>
      <div className="mt-2.5 text-lg font-semibold text-slate-950">{value}</div>
    </div>
  );
}

export default function EmployeeShiftSummaryClient({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const asOf = String(searchParams.get("asOf") ?? "").trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MasterResponse["item"] | null>(null);
  const [editSourceItem, setEditSourceItem] = useState<MasterResponse["item"] | null>(null);
  const [workSchedules, setWorkSchedules] = useState<WorkScheduleOption[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<EmployeeWorkScheduleProfileEditDraft | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editNotice, setEditNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function fetchMasterItem(targetAsOf = "") {
    const qs = targetAsOf ? `?asOf=${encodeURIComponent(targetAsOf)}` : "";
    const res = await fetch(`/api/employees/${id}/master${qs}`, {
      credentials: "include",
    });
    if (!res.ok) {
      const msg = await readApiError(res, "Vardiya bilgileri yüklenemedi");
      throw new Error(msg);
    }
    const json = (await res.json()) as MasterResponse;
    return json.item ?? null;
  }

  async function load(cancelledRef?: { value: boolean }, targetAsOf: string = asOf) {
      setLoading(true);
      setError(null);

      try {
        const latestPromise = targetAsOf
          ? fetchMasterItem("").catch(() => null)
          : Promise.resolve<MasterResponse["item"] | null>(null);
        const [viewItem, workSchedulesRes, latestItem] = await Promise.all([
          fetchMasterItem(targetAsOf),
          fetch(`/api/policy/work-schedules`, {
            credentials: "include",
          }),
          latestPromise,
        ]);

        const workSchedulesJson = await workSchedulesRes.json().catch(() => null);
        if (cancelledRef?.value) return;
        setData(viewItem);
        setEditSourceItem(latestItem ?? viewItem);
        setWorkSchedules(readItems<WorkScheduleOption>(workSchedulesJson));
      } catch (e) {
        if (cancelledRef?.value) return;
        setError(e instanceof Error ? e.message : "Vardiya bilgileri yüklenemedi");
        setData(null);
        setEditSourceItem(null);
        setWorkSchedules([]);
      } finally {
        if (!cancelledRef?.value) setLoading(false);
      }
  }

  useEffect(() => {
    const cancelledRef = { value: false };

    load(cancelledRef);

    return () => {
      cancelledRef.value = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, asOf]);

  const employee = data?.employee ?? null;
  const history = data?.history ?? null;
  const shiftProfile = data?.today?.shiftProfile ?? null;
  const fullName = useMemo(() => {
    if (!employee) return "";
    return `${employee.firstName} ${employee.lastName}`.trim();
  }, [employee]);
  const workScheduleOptions = useMemo(() => {
    return [...workSchedules]
      .filter((pattern) => pattern.isActive)
      .sort((a, b) => {
        const byCode = a.code.localeCompare(b.code, "tr-TR", { sensitivity: "base", numeric: true });
        if (byCode !== 0) return byCode;
        return a.name.localeCompare(b.name, "tr-TR", { sensitivity: "base", numeric: true });
      });
  }, [workSchedules]);

  function openProfileEditModal() {
    const sourceItem = asOf ? editSourceItem : data;
    if (!sourceItem?.history) return;
    setEditDraft(
      buildEmployeeWorkScheduleProfileEditDraft({
        source: {
          workSchedulePatternId: sourceItem.today.shiftProfile?.workSchedule?.patternId ?? null,
        },
        scopeStartDate: sourceItem.history.todayDayKey,
      }),
    );
    setEditNotice(null);
    setEditOpen(true);
  }

  async function saveProfileEditModal() {
    if (!editDraft) return;
    const normalized = normalizeEmployeeWorkScheduleProfileEditDraft(editDraft);
    const validationCode = validateEmployeeWorkScheduleProfileEditDraft(normalized);
    if (validationCode) {
      setEditDraft(normalized);
      setEditNotice({ kind: "error", text: humanizeEmployeeWorkScheduleProfileEditValidation(validationCode) });
      return;
    }

    setEditSaving(true);
    setEditNotice(null);
    try {
      const res = await fetch(`/api/employees/${id}/profile`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(toEmployeeWorkScheduleProfileEditPayload(normalized)),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(parseApiErrorText(text) ?? res.statusText);
      setEditOpen(false);
      setEditDraft(null);
      await load(undefined, "");
      if (asOf) {
        router.replace(pathname, { scroll: false });
      }
    } catch (err) {
      setEditNotice({
        kind: "error",
        text: humanizeProfileEditError(err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="-mt-3 md:-mt-4 grid gap-2.5 max-w-full min-w-0">
      <EmployeeDetailSubnav id={id} current="profile" hideHistoryTrigger />

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 px-4 py-3 text-sm text-red-900 shadow-[0_10px_24px_rgba(239,68,68,0.08)]">
          <div className="font-semibold">İşlem sırasında hata</div>
          <div className="mt-1 break-words text-red-800/90">{error}</div>
        </div>
      ) : null}

      <div className="grid gap-3 max-w-full min-w-0">
        {loading ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="h-6 w-56 animate-pulse rounded bg-zinc-100" />
            <div className="mt-3 h-4 w-80 animate-pulse rounded bg-zinc-100" />
          </div>
        ) : employee ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="grid gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-lg font-semibold text-zinc-900">{fullName || "—"}</div>
                  <Badge tone={employee.isActive ? "ok" : "warn"}>
                    {employee.isActive ? "Aktif" : "Pasif"}
                  </Badge>
                  <div className="ml-1 flex items-center gap-2">
                    <EmployeeHistoryDialog
                      employeeId={id}
                      current="profile"
                      variant="icon"
                      canEdit={history?.canEdit}
                      source={{
                        workSchedulePatternId: shiftProfile?.workSchedule?.patternId ?? null,
                      }}
                      workSchedules={workScheduleOptions}
                    onChanged={() => {
                      void load();
                    }}
                  />
                    <EditIconButton onClick={openProfileEditModal} label="Vardiya bilgilerini düzenle" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                  <span>Vardiya bilgileri ve çalışma programı özeti</span>
                </div>
              </div>

              <div className="shrink-0 flex flex-wrap items-center gap-2">
                <EmployeeAsOfDateControl history={history} />
              </div>
            </div>
          </div>
        ) : null}
        <div id="profile-section" className="min-w-0 scroll-mt-32">
          <Card
            title="Vardiya Bilgileri"
            description="Çalışma programı özeti ve temel vardiya göstergeleri"
            right={
              loading ? (
                <div className="flex items-center gap-2">
                  <SkeletonPill className="h-8 w-20" />
                  <SkeletonPill className="h-9 w-24" />
                </div>
              ) : null
            }
          >
            {loading ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <SkeletonMetricCard />
                <SkeletonMetricCard />
                <SkeletonMetricCard />
                <SkeletonMetricCard />
                <SkeletonMetricCard />
              </div>
            ) : employee ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <InfoValueCard
                  label="Çalışma Programı"
                  value={readWorkScheduleLabel(shiftProfile)}
                />
                <InfoValueCard
                  label="Zaman Yönetimi Durumu"
                  value={readTimeManagementStatus(shiftProfile)}
                />
                <InfoValueCard
                  label="Günlük Çalışma Saati"
                  value={readMetricLabel(shiftProfile?.dailyWork)}
                />
                <InfoValueCard
                  label="Haftalık Çalışma Saati"
                  value={readMetricLabel(shiftProfile?.weeklyWork)}
                />
                <InfoValueCard
                  label="Haftalık İş Günleri"
                  value={readMetricLabel(shiftProfile?.weeklyWorkDays)}
                />
              </div>
            ) : (
              <div className="text-sm text-zinc-500">Personel bulunamadı.</div>
            )}
          </Card>
        </div>
      </div>

      <VersionedEditModalShell
        open={editOpen && Boolean(editDraft)}
        title="Vardiya bilgilerini düzenle"
        subtitle="Bu işlem mevcut atamayı ezmez; seçtiğiniz tarihten başlayan yeni bir çalışma planı sürümü oluşturur."
        saving={editSaving}
        onClose={() => {
          if (editSaving) return;
          setEditOpen(false);
          setEditDraft(null);
          setEditNotice(null);
        }}
        footer={
          <>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                setEditOpen(false);
                setEditDraft(null);
                setEditNotice(null);
              }}
              disabled={editSaving}
            >
              Vazgeç
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={saveProfileEditModal}
              disabled={editSaving || !editDraft}
            >
              {editSaving ? "Kaydediliyor..." : "Yeni sürüm olarak kaydet"}
            </button>
          </>
        }
      >
        {editDraft ? (
          <div className="grid gap-5">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm leading-6 text-indigo-950">
              Bu modal yalnızca vardiya/çalışma planı atamasının yeni sürümünü oluşturur. Eski atama kaydı silinmez veya ezilmez.
            </div>

            {editNotice ? (
              <div
                className={cx(
                  "rounded-2xl border px-4 py-3 text-sm",
                  editNotice.kind === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800",
                )}
              >
                {editNotice.text}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-sm font-semibold text-slate-800">
                  Geçerlilik başlangıcı <span className="text-rose-600">*</span>
                </span>
                <input
                  className={inputClass}
                  type="date"
                  value={editDraft.scopeStartDate}
                  onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, scopeStartDate: event.target.value } : prev))}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-semibold text-slate-800">
                  Çalışma planı <span className="text-rose-600">*</span>
                </span>
                <select
                  className={inputClass}
                  value={editDraft.workSchedulePatternId}
                  onChange={(event) =>
                    setEditDraft((prev) => (prev ? { ...prev, workSchedulePatternId: event.target.value } : prev))
                  }
                >
                  <option value="">Çalışma planı seçin</option>
                  {workScheduleOptions.map((pattern) => (
                    <option key={pattern.id} value={pattern.id}>
                      {pattern.code} — {pattern.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : null}
      </VersionedEditModalShell>
    </div>
  );
}
