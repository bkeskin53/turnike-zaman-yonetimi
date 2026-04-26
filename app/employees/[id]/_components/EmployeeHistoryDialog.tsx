export { default } from "./EmployeeContextHistoryDialog";
/*
"use client";

import { DateTime } from "luxon";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type NavKey =
  | "profile"
  | "assignments"
  | "weekly-plan"
  | "leaves"
  | "master"
  | "records";

type TimelineItem = {
  id: string;
  dayKey: string;
  kind: "EMPLOYMENT_START" | "EMPLOYMENT_END" | "PROFILE_VERSION" | "ORG_ASSIGNMENT" | "WORK_SCHEDULE";
  title: string;
  subtitle: string;
  rangeLabel: string | null;
  createdAt: string;
};

type HistoryResponse = {
  item: {
    employee: {
      id: string;
      employeeCode: string;
      fullName: string;
    };
    todayDayKey: string;
    items: TimelineItem[];
  };
};

type MasterPreviewResponse = {
  item: {
    employee: {
      id: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
      email: string | null;
      nationalId: string | null;
      phone: string | null;
      gender: string | null;
      isActive: boolean;
      hiredAt: string | null;
      terminatedAt: string | null;
      branch: { id: string; code: string; name: string } | null;
      employeeGroup: { id: string; code: string; name: string } | null;
      employeeSubgroup: { id: string; code: string; name: string; groupId: string } | null;
    };
    history: {
      dayKey: string;
      todayDayKey: string;
      isHistorical: boolean;
      canEdit: boolean;
      mode: "AS_OF" | "CURRENT";
      profileSource: string;
      orgSource: string;
    };
    today: {
      dayKey: string;
      shiftProfile: {
        workSchedule: { patternId: string; code: string; name: string; label: string } | null;
        timeManagementStatus: string | null;
        dailyWork: { kind: string; minutes: number | null; label: string };
        weeklyWork: { kind: string; minutes: number | null; label: string };
        weeklyWorkDays: { kind: string; days: number | null; label: string };
      };
      policyRuleSet:
        | {
            source: string;
            assignmentId: string | null;
            ruleSet: { id: string; code: string; name: string } | null;
          }
        | null;
    };
  };
};

function formatDayLabel(dayKey: string): string {
  const dt = DateTime.fromISO(dayKey, { zone: "Europe/Istanbul" }).setLocale("tr");
  if (!dt.isValid) return dayKey;
  return dt.toFormat("dd LLL yyyy");
}

function formatOrg(unit: { code: string; name: string } | null | undefined): string {
  if (!unit) return "—";
  return `${unit.code} — ${unit.name}`;
}

function formatGender(value: string | null | undefined) {
  if (!value) return "—";
  if (value === "MALE") return "Erkek";
  if (value === "FEMALE") return "Kadın";
  if (value === "OTHER") return "Diğer";
  if (value === "UNSPECIFIED") return "Belirtilmedi";
  return value;
}

function formatPolicySource(source: string | null | undefined) {
  const value = String(source ?? "").trim().toUpperCase();
  if (!value) return "Şirket varsayılanı";
  if (value === "DEFAULT") return "Şirket varsayılanı";
  if (value === "EMPLOYEE") return "Çalışan ataması";
  if (value === "EMPLOYEE_GROUP") return "Grup ataması";
  if (value === "EMPLOYEE_SUBGROUP") return "Alt grup ataması";
  if (value === "BRANCH") return "Lokasyon ataması";
  if (value === "COMPANY") return "Şirket düzeyi";
  if (value === "POLICY") return "Şirket policy varsayılanı";
  return source ?? "Şirket varsayılanı";
}

function KV(props: { k: string; v?: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{props.k}</div>
      <div className="text-sm text-zinc-900">{props.v ?? <span className="text-zinc-400">—</span>}</div>
    </div>
  );
}

function SectionCard(props: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-4 py-3">
        <div className="text-sm font-semibold text-zinc-900">{props.title}</div>
        {props.subtitle ? <div className="mt-0.5 text-xs text-zinc-500">{props.subtitle}</div> : null}
      </div>
      <div className="p-4">{props.children}</div>
    </div>
  );
}

export default function EmployeeHistoryDialog({
  employeeId,
  current,
  variant = "default",
}: {
  employeeId: string;
  current: NavKey;
  variant?: "default" | "icon";
}) {
  const hideRuleInfoForDemo = true;
  const router = useRouter();
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const asOf = String(searchParams.get("asOf") ?? "").trim();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<HistoryResponse["item"] | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<MasterPreviewResponse["item"] | null>(null);

  const safeCurrentTarget = current === "master" || current === "assignments";
  const applyBasePath = safeCurrentTarget ? pathname : `/employees/${employeeId}/master`;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadHistory() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/employees/${employeeId}/history`, { credentials: "include" });
        if (!res.ok) {
          const txt = await res.text().catch(() => res.statusText);
          throw new Error(txt || "Failed to load history");
        }
        const json = (await res.json()) as HistoryResponse;
        if (cancelled) return;

        const items = Array.isArray(json.item?.items) ? json.item.items : [];
        setHistoryData(json.item);

        const initial =
          (asOf ? items.find((x) => x.dayKey === asOf) : null) ??
          items[0] ??
          null;

        setSelectedItemId(initial?.id ?? null);
        setSelectedDayKey(asOf || initial?.dayKey || json.item?.todayDayKey || null);
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : String(e));
        setHistoryData(null);
        setSelectedItemId(null);
        setSelectedDayKey(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [open, employeeId, asOf]);

  useEffect(() => {
    if (!open || !selectedDayKey) return;

    let cancelled = false;
    const dayKey = selectedDayKey;

    async function loadPreview() {
      setPreviewLoading(true);
      setPreviewErr(null);
      try {
        const res = await fetch(`/api/employees/${employeeId}/master?asOf=${encodeURIComponent(dayKey)}`, {
          credentials: "include",
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => res.statusText);
          throw new Error(txt || "Failed to load preview");
        }
        const json = (await res.json()) as MasterPreviewResponse;
        if (cancelled) return;
        setPreviewData(json.item);
      } catch (e) {
        if (cancelled) return;
        setPreviewErr(e instanceof Error ? e.message : String(e));
        setPreviewData(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }

    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [open, employeeId, selectedDayKey]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, TimelineItem[]>();
    for (const item of historyData?.items ?? []) {
      if (!groups.has(item.dayKey)) groups.set(item.dayKey, []);
      groups.get(item.dayKey)!.push(item);
    }
    return Array.from(groups.entries()).map(([dayKey, items]) => ({ dayKey, items }));
  }, [historyData]);

  function applySelectedDay() {
    if (!selectedDayKey) return;
    const params = new URLSearchParams();
    params.set("asOf", selectedDayKey);
    setOpen(false);
   router.push(`${applyBasePath}?${params.toString()}`);
  }

  function resetToToday() {
    setOpen(false);
    router.push(applyBasePath);
  }

  const modalContent =
    open && mounted ? (
      <div className="fixed inset-0 z-[10000] overflow-y-auto bg-slate-950/72 p-4 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl items-center justify-center">
          <div className="w-full overflow-hidden rounded-[30px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
              <div className="grid gap-1">
                <div className="text-lg font-semibold text-zinc-900">Değişiklik Geçmişi</div>
                <div className="text-sm text-zinc-600">
                  Soldan bir dönem seç. Sağda o güne ait snapshot görünür. Onaylarsan sayfa as-of moduna geçer.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:border-zinc-300 hover:bg-zinc-50"
              >
                Kapat
              </button>
            </div>

            <div className="grid min-h-[72vh] grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
              <div className="border-b border-zinc-200 bg-zinc-50/70 lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                  <div className="text-sm font-semibold text-zinc-900">Dönem / Değişiklik Listesi</div>
                  <div className="text-xs text-zinc-500">{(historyData?.items?.length ?? 0)} kayıt</div>
                </div>

                <div className="max-h-[72vh] overflow-y-auto px-3 py-3">
                  {loading ? (
                    <div className="grid gap-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-4">
                          <div className="h-4 w-24 animate-pulse rounded bg-zinc-100" />
                          <div className="mt-3 h-4 w-48 animate-pulse rounded bg-zinc-100" />
                          <div className="mt-2 h-3 w-full animate-pulse rounded bg-zinc-100" />
                        </div>
                      ))}
                    </div>
                  ) : err ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                      <div className="font-semibold">Geçmiş yüklenemedi</div>
                      <div className="mt-1 break-words">{err}</div>
                    </div>
                  ) : groupedItems.length === 0 ? (
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
                      Bu çalışan için gösterilecek tarihçe kaydı bulunamadı.
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {groupedItems.map((group) => {
                        const groupActive = group.dayKey === selectedDayKey;
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
                          <div
                            className={cx(
                              "px-1 text-sm font-semibold",
                              groupActive ? "text-indigo-900" : "text-zinc-800",
                            )}
                          >
                            {formatDayLabel(group.dayKey)}
                          </div>
                          <div className="grid gap-2">
                            {group.items.map((item) => {
                              const active = item.id === selectedItemId;
                              const inSelectedGroup = item.dayKey === selectedDayKey;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedItemId(item.id);
                                    setSelectedDayKey(item.dayKey);
                                  }}
                                  className={cx(
                                    "grid gap-2 rounded-2xl border p-4 text-left transition",
                                    active
                                      ? "border-indigo-300 bg-[linear-gradient(135deg,rgba(238,242,255,0.95),rgba(224,231,255,0.92))] shadow-[0_14px_28px_rgba(79,70,229,0.14)]"
                                      : inSelectedGroup
                                        ? "border-indigo-200 bg-[linear-gradient(135deg,rgba(238,242,255,0.92),rgba(255,255,255,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] ring-1 ring-indigo-100/80"
                                        : "border-zinc-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/70",
                                  )}
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700 ring-1 ring-zinc-200">
                                      {item.kind === "EMPLOYMENT_START"
                                        ? "İstihdam"
                                        : item.kind === "EMPLOYMENT_END"
                                          ? "Sonlandırma"
                                          : item.kind === "WORK_SCHEDULE"
                                            ? "Çalışma Planı"
                                            : item.kind === "ORG_ASSIGNMENT"
                                              ? "Organizasyon"
                                              : "Profil"}
                                    </span>
                                    {item.rangeLabel ? (
                                      <span className="text-[11px] text-zinc-500">{item.rangeLabel}</span>
                                    ) : null}
                                  </div>
                                  <div className="text-sm font-semibold text-zinc-900">{item.title}</div>
                                  <div className="text-sm text-zinc-600">{item.subtitle}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )})}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white">
                <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
                  <div className="grid gap-0.5">
                    <div className="text-sm font-semibold text-zinc-900">Seçilen Dönem Önizlemesi</div>
                    <div className="text-xs text-zinc-500">Sağ panel gerçek as-of read model ile beslenir.</div>
                  </div>
                  {selectedDayKey ? (
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
                      {selectedDayKey}
                    </span>
                  ) : null}
                </div>

                <div className="max-h-[72vh] overflow-y-auto p-5">
                  {previewLoading ? (
                    <div className="grid gap-4">
                      <div className="h-28 animate-pulse rounded-3xl border border-zinc-200 bg-zinc-50" />
                      <div className="grid gap-4 xl:grid-cols-2">
                        <div className="h-64 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50" />
                        <div className="h-64 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50" />
                      </div>
                      <div className="grid gap-4 xl:grid-cols-2">
                        <div className="h-52 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50" />
                        <div className="h-52 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50" />
                      </div>
                    </div>
                  ) : previewErr ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                      <div className="font-semibold">Önizleme yüklenemedi</div>
                      <div className="mt-1 break-words">{previewErr}</div>
                    </div>
                  ) : previewData ? (
                    <div className="grid gap-4">
                      <div className="rounded-[28px] border border-zinc-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,244,245,0.98),rgba(238,242,255,0.95))] p-5 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="grid gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-xl font-semibold text-zinc-900">
                                {`${previewData.employee.firstName} ${previewData.employee.lastName}`.trim() || "—"}
                              </div>
                              <span
                                className={cx(
                                  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                                  previewData.employee.isActive
                                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                    : "bg-amber-50 text-amber-700 ring-amber-200",
                                )}
                              >
                                {previewData.employee.isActive ? "Aktif" : "Pasif"}
                              </span>
                              <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
                                Sicil: {previewData.employee.employeeCode || "—"}
                              </span>
                            </div>
                            <div className="text-sm text-zinc-600">Seçilen tarih: {formatDayLabel(previewData.history.dayKey)}</div>
                            <div className="text-xs text-zinc-500">
                              Profil kaynağı: {previewData.history.profileSource} · Organizasyon kaynağı: {previewData.history.orgSource}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-2">
                        <SectionCard title="Kimlik ve İletişim" subtitle="Seçilen güne ait profile snapshot">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <KV k="Ad" v={previewData.employee.firstName || "—"} />
                            <KV k="Soyad" v={previewData.employee.lastName || "—"} />
                            <KV k="TC Kimlik" v={previewData.employee.nationalId || "—"} />
                            <KV k="Cinsiyet" v={formatGender(previewData.employee.gender)} />
                            <KV k="E-posta" v={previewData.employee.email || "—"} />
                            <KV k="Telefon" v={previewData.employee.phone || "—"} />
                            <KV k="İşe Giriş" v={previewData.employee.hiredAt || "—"} />
                            <KV k="Sonlandırma" v={previewData.employee.terminatedAt || "—"} />
                          </div>
                        </SectionCard>

                        <SectionCard title="Organizasyon" subtitle="Seçilen güne ait organizasyon snapshot">
                          <div className="grid gap-3">
                            <KV k="Lokasyon" v={formatOrg(previewData.employee.branch)} />
                            <KV k="Grup" v={formatOrg(previewData.employee.employeeGroup)} />
                            <KV k="Alt Grup" v={formatOrg(previewData.employee.employeeSubgroup)} />
                          </div>
                        </SectionCard>
                      </div>

                      <div className={cx("grid gap-4", hideRuleInfoForDemo ? null : "xl:grid-cols-2")}>
                        <SectionCard title="Vardiya Bilgileri" subtitle="Çalışma planı ve vardiya özeti">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <KV k="Çalışma Planı" v={previewData.today.shiftProfile?.workSchedule?.label || "—"} />
                            <KV
                              k="Zaman Yönetimi Durumu"
                              v={String(previewData.today.shiftProfile?.timeManagementStatus ?? "").trim() || "—"}
                            />
                            <KV k="Günlük Çalışma" v={previewData.today.shiftProfile?.dailyWork?.label || "—"} />
                            <KV k="Haftalık Çalışma" v={previewData.today.shiftProfile?.weeklyWork?.label || "—"} />
                            <KV k="Haftalık İş Günleri" v={previewData.today.shiftProfile?.weeklyWorkDays?.label || "—"} />
                          </div>
                        </SectionCard>

                        {!hideRuleInfoForDemo ? (
                          <SectionCard title="Kural Bilgileri" subtitle="Seçilen güne göre çözümlenen kural seti">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <KV k="Kural Seti Kodu" v={previewData.today.policyRuleSet?.ruleSet?.code || "—"} />
                              <KV k="Kural Seti Adı" v={previewData.today.policyRuleSet?.ruleSet?.name || "—"} />
                              <KV k="Kaynak" v={formatPolicySource(previewData.today.policyRuleSet?.source)} />
                            </div>
                          </SectionCard>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                      Soldan bir kayıt seçildiğinde sağ panelde snapshot önizlemesi görünür.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-5 py-4">
              <div className="text-sm text-zinc-600">
                {safeCurrentTarget
                  ? "Seçilen dönem mevcut sekmede as-of olarak açılacak."
                  : "Seçilen dönem güvenli historical görünüm için Kimlik Bilgileri ekranında açılacak."}
              </div>

              <div className="flex flex-wrap items-center gap-2">
               <button
                  type="button"
                  onClick={resetToToday}
                  className="inline-flex items-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  Bugünkü Görünüme Dön
                </button>
                <button
                  type="button"
                  onClick={applySelectedDay}
                  disabled={!selectedDayKey}
                  className={cx(
                    "inline-flex items-center rounded-xl px-3 py-2 text-sm font-semibold shadow-sm transition",
                    selectedDayKey
                      ? "bg-[linear-gradient(135deg,#2563eb,#4f46e5)] text-white hover:brightness-105"
                      : "cursor-not-allowed bg-zinc-200 text-zinc-500",
                  )}
                >
                  Bu Dönemi Görüntüle
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={asOf ? `Tarihçe · ${asOf}` : "Tarihçe"}
          aria-label={asOf ? `Tarihçe · ${asOf}` : "Tarihçe"}
          className={cx(
            "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/25",
            asOf
              ? "border-sky-200 bg-sky-50 text-sky-700 shadow-[0_8px_18px_rgba(14,116,144,0.10)] hover:border-sky-300 hover:bg-sky-100"
              : "border-slate-200 bg-slate-50 text-slate-600 shadow-[0_4px_12px_rgba(15,23,42,0.06)] hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700",
          )}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none">
            <path
              d="M4 6v4h4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5.2 14.8A7 7 0 1 0 7.1 6.7L4 10"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 8.3v4.1l2.7 1.8"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cx(
            "inline-flex min-h-[46px] items-center justify-center rounded-2xl border px-4 py-2.5 text-sm font-semibold transition",
            asOf
              ? "border-amber-200 bg-amber-50 text-amber-800 shadow-[0_8px_18px_rgba(180,83,9,0.10)] hover:border-amber-300 hover:bg-amber-100"
              : "border-white/80 bg-white/78 text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.05)] hover:-translate-y-[1px] hover:border-indigo-200 hover:bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(238,242,255,0.95))] hover:text-indigo-700 hover:shadow-[0_12px_24px_rgba(79,70,229,0.10)]",
          )}
        >
          <span className="truncate">{asOf ? `Tarihçe · ${asOf}` : "Tarihçe"}</span>
        </button>
      )}
      {mounted ? createPortal(modalContent, document.body) : null}
    </>
  );
}
*/
