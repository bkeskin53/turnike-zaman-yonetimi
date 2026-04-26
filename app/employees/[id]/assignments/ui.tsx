"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import EmployeeDetailSubnav from "../_components/EmployeeDetailSubnav";
import EmployeeAsOfDateControl from "../_components/EmployeeAsOfDateControl";
import EmployeeHistoryDialog from "../_components/EmployeeHistoryDialog";
import VersionedEditModalShell from "../_components/VersionedEditModalShell";
import {
  EmployeeAssignmentEditDraft,
  buildEmployeeAssignmentEditDraft,
  humanizeEmployeeAssignmentEditValidation,
  normalizeEmployeeAssignmentEditDraft,
  toEmployeeAssignmentEditPayload,
  validateEmployeeAssignmentEditDraft,
} from "@/src/features/employees/assignmentEditForm";

type BranchOption = { id: string; code: string; name: string; isActive: boolean };
type EmployeeGroupOption = { id: string; code: string; name: string };
type EmployeeSubgroupOption = {
  id: string;
  code: string;
  name: string;
  groupId: string;
  group?: { code: string; name: string } | null;
};

type PolicyRuleSetView = {
  source?: string | null;
  ruleSet?: {
    code?: string | null;
    name?: string | null;
  } | null;
} | null;

type CompanyResponse = {
  company?: {
    id: string;
    name: string;
  } | null;
};

type MasterResponse = {
  item: {
    employee: {
      id: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
      email: string | null;
      isActive: boolean;
      hiredAt: string | null;
      terminatedAt: string | null;

      cardNo: string | null;
      deviceUserId: string | null;

      branch: { id: string; code: string; name: string } | null;
      employeeGroup: { id: string; code: string; name: string } | null;
      employeeSubgroup: { id: string; code: string; name: string; groupId: string } | null;

      integrationEmployeeLinks: Array<{
        id: string;
        sourceSystem: string;
        externalRef: string;
        createdAt: string;
      }>;
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
      shift: unknown;
      policyRuleSet: PolicyRuleSetView;
      lastEvent: unknown | null;
    };
    last7Days: {
      from: string;
      to: string;
      presentDays: number;
      offDays: number;
      leaveDays: number;
      absentDays: number;
      anomalyDays: number;
      anomalyCounts: Record<string, number>;
      totals: {
        lateMinutes: number;
        earlyLeaveMinutes: number;
        workedMinutes: number;
        overtimeMinutes: number;
      };
      days: Array<unknown>;
    };
  };
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Card(props: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-2.5">
        <div className="grid gap-0.5">
          <div className="text-sm font-semibold text-zinc-900">{props.title}</div>
          {props.subtitle ? <div className="text-xs text-zinc-500">{props.subtitle}</div> : null}
        </div>
        {props.right ? <div className="shrink-0">{props.right}</div> : null}
      </div>
      <div className="p-3.5">{props.children}</div>
    </div>
  );
}

function Badge(props: { tone?: "ok" | "warn" | "info" | "muted"; children: React.ReactNode }) {
  const tone = props.tone ?? "muted";
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "warn"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : tone === "info"
          ? "bg-sky-50 text-sky-700 ring-sky-200"
          : "bg-zinc-50 text-zinc-700 ring-zinc-200";

  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1", cls)}>
      {props.children}
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

function KV(props: { k: string; v?: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{props.k}</div>
      <div className="text-sm text-zinc-900">{props.v ?? <span className="text-zinc-400">—</span>}</div>
    </div>
  );
}

function formatOrgUnit(unit: { code: string; name: string } | null | undefined) {
  if (!unit) return "—";
  return `${unit.code} — ${unit.name}`;
}

function formatRuleSource(source: string | null | undefined) {
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

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm transition " +
  "placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/25";

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

function humanizeAssignmentsEditError(value: string) {
  const fallback = "Organizasyon bilgileri kaydedilemedi. Lütfen alanları kontrol edin.";
  const known = humanizeEmployeeAssignmentEditValidation(value);
  if (known !== fallback) return known;
  const map: Record<string, string> = {
    BAD_ID: "Çalışan kaydı bulunamadı.",
    INVALID_BODY: "Gönderilen bilgi seti okunamadı.",
    EMPLOYEE_NOT_FOUND: "Çalışan kaydı bulunamadı.",
    EMPLOYEE_NOT_EMPLOYED_ON_EFFECTIVE_DATE: "Seçilen tarihte çalışan istihdam kapsamında değil.",
    INVALID_BRANCH_ID: "Seçilen lokasyon bulunamadı ya da pasif durumda.",
    INVALID_EMPLOYEE_GROUP_ID: "Seçilen grup bulunamadı.",
    INVALID_EMPLOYEE_SUBGROUP_ID: "Seçilen alt grup bulunamadı.",
    SUBGROUP_GROUP_MISMATCH: "Seçilen alt grup, seçilen gruba ait değil.",
    UNAUTHORIZED: "Oturum doğrulanamadı.",
    FORBIDDEN: "Bu işlem için yetkiniz yok.",
  };
  return map[value] ?? fallback;
}

function readItems<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (typeof payload === "object" && payload !== null && Array.isArray((payload as { items?: unknown }).items)) {
    return (payload as { items: T[] }).items;
  }
  return [];
}

export default function EmployeeAssignmentsClient({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const asOf = String(searchParams.get("asOf") ?? "").trim();
  const hideRuleInfoForDemo = true;
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<MasterResponse["item"] | null>(null);
  const [editSourceItem, setEditSourceItem] = useState<MasterResponse["item"] | null>(null);
  const [companyName, setCompanyName] = useState<string>("—");
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [employeeGroups, setEmployeeGroups] = useState<EmployeeGroupOption[]>([]);
  const [employeeSubgroups, setEmployeeSubgroups] = useState<EmployeeSubgroupOption[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<EmployeeAssignmentEditDraft | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editNotice, setEditNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function fetchMasterItem(targetAsOf = "") {
    const qs = targetAsOf ? `?asOf=${encodeURIComponent(targetAsOf)}` : "";
    const res = await fetch(`/api/employees/${id}/master${qs}`, { credentials: "include" });
    if (!res.ok) {
      const txt = await res.text().catch(() => res.statusText);
      throw new Error(txt || "Failed to load");
    }
    const json = (await res.json()) as MasterResponse;
    return json.item;
  }

  async function load(targetAsOf: string = asOf) {
    setLoading(true);
    setErr(null);
    try {
      const latestPromise = targetAsOf
        ? fetchMasterItem("").catch(() => null)
        : Promise.resolve<MasterResponse["item"] | null>(null);
      const [viewItem, companyRes, branchesRes, groupsRes, subgroupsRes, latestItem] = await Promise.all([
        fetchMasterItem(targetAsOf),
        fetch(`/api/company`, { credentials: "include" }),
        fetch(`/api/org/branches`, { credentials: "include" }),
        fetch(`/api/workforce/groups`, { credentials: "include" }),
        fetch(`/api/workforce/subgroups`, { credentials: "include" }),
        latestPromise,
      ]);
      const companyJson = (await companyRes.json().catch(() => null)) as CompanyResponse | null;
      const branchesJson = await branchesRes.json().catch(() => null);
      const groupsJson = await groupsRes.json().catch(() => null);
      const subgroupsJson = await subgroupsRes.json().catch(() => null);
      setData(viewItem);
      setEditSourceItem(latestItem ?? viewItem);
      setCompanyName(companyJson?.company?.name?.trim() || "—");
      setBranches(readItems<BranchOption>(branchesJson));
      setEmployeeGroups(readItems<EmployeeGroupOption>(groupsJson));
      setEmployeeSubgroups(readItems<EmployeeSubgroupOption>(subgroupsJson));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setData(null);
      setEditSourceItem(null);
      setCompanyName("—");
      setBranches([]);
      setEmployeeGroups([]);
      setEmployeeSubgroups([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, asOf]);

  const fullName = useMemo(() => {
    if (!data?.employee) return "";
    return `${data.employee.firstName} ${data.employee.lastName}`.trim();
  }, [data]);

  const locationOptions = useMemo(() => {
    return [...branches]
      .filter((branch) => branch.isActive)
      .sort((a, b) => {
        const byCode = a.code.localeCompare(b.code, "tr-TR", { sensitivity: "base", numeric: true });
        if (byCode !== 0) return byCode;
        return a.name.localeCompare(b.name, "tr-TR", { sensitivity: "base", numeric: true });
      });
  }, [branches]);

  const employeeGroupOptions = useMemo(() => {
    return [...employeeGroups].sort((a, b) => {
      const byCode = a.code.localeCompare(b.code, "tr-TR", { sensitivity: "base", numeric: true });
      if (byCode !== 0) return byCode;
      return a.name.localeCompare(b.name, "tr-TR", { sensitivity: "base", numeric: true });
    });
  }, [employeeGroups]);

  const employeeSubgroupOptions = useMemo(() => {
    const groupId = editDraft?.employeeGroupId ?? "";
    if (!groupId) return [];
    return [...employeeSubgroups]
      .filter((subgroup) => subgroup.groupId === groupId)
      .sort((a, b) => {
        const byCode = a.code.localeCompare(b.code, "tr-TR", { sensitivity: "base", numeric: true });
        if (byCode !== 0) return byCode;
        return a.name.localeCompare(b.name, "tr-TR", { sensitivity: "base", numeric: true });
      });
  }, [employeeSubgroups, editDraft?.employeeGroupId]);

  function openAssignmentsEditModal() {
    const sourceItem = asOf ? editSourceItem : data;
    if (!sourceItem?.employee) return;
    setEditDraft(
      buildEmployeeAssignmentEditDraft({
        source: {
          branchId: sourceItem.employee.branch?.id ?? null,
          employeeGroupId: sourceItem.employee.employeeGroup?.id ?? null,
          employeeSubgroupId: sourceItem.employee.employeeSubgroup?.id ?? null,
        },
        scopeStartDate: sourceItem.history.todayDayKey,
      }),
    );
    setEditNotice(null);
    setEditOpen(true);
  }

  async function saveAssignmentsEditModal() {
    if (!editDraft) return;
    const normalized = normalizeEmployeeAssignmentEditDraft(editDraft);
    const validationCode = validateEmployeeAssignmentEditDraft(normalized);
    if (validationCode) {
      setEditDraft(normalized);
      setEditNotice({ kind: "error", text: humanizeEmployeeAssignmentEditValidation(validationCode) });
      return;
    }

    setEditSaving(true);
    setEditNotice(null);
    try {
      const res = await fetch(`/api/employees/${id}/assignments`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(toEmployeeAssignmentEditPayload(normalized)),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(parseApiErrorText(text) ?? res.statusText);
      setEditOpen(false);
      setEditDraft(null);
      await load("");
      if (asOf) {
        router.replace(pathname, { scroll: false });
      }
    } catch (error) {
      setEditNotice({
        kind: "error",
        text: humanizeAssignmentsEditError(error instanceof Error ? error.message : String(error)),
      });
    } finally {
      setEditSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="h-6 w-56 animate-pulse rounded bg-zinc-100" />
          <div className="mt-3 h-4 w-80 animate-pulse rounded bg-zinc-100" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
          <div className="h-72 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <div className="font-semibold">Yüklenemedi</div>
        <div className="mt-1 break-words">{err}</div>
        <button
          className="mt-3 inline-flex items-center rounded-lg bg-white px-3 py-2 text-sm font-medium text-red-800 ring-1 ring-red-200 hover:bg-red-50"
          onClick={() => {
            void load();
          }}
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  if (!data) return <div className="text-sm text-zinc-500">Veri yok.</div>;

  const e = data.employee;
  const today = data.today;

  return (
    <div className="-mt-3 md:-mt-4 grid gap-2.5">
      <EmployeeDetailSubnav id={id} current="assignments" hideHistoryTrigger />

      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="grid gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-lg font-semibold text-zinc-900">{fullName || "—"}</div>
              <Badge tone={e.isActive ? "ok" : "warn"}>{e.isActive ? "Aktif" : "Pasif"}</Badge>
              <div className="ml-0.5 flex items-center gap-1.5 [&_button]:h-8 [&_button]:w-8 [&_button]:rounded-lg [&_svg]:h-4 [&_svg]:w-4">
                <EmployeeHistoryDialog
                  employeeId={id}
                  current="assignments"
                  variant="icon"
                  canEdit={data.history.canEdit}
                  source={{
                    branchId: data.employee.branch?.id ?? null,
                    employeeGroupId: data.employee.employeeGroup?.id ?? null,
                    employeeSubgroupId: data.employee.employeeSubgroup?.id ?? null,
                  }}
                  branches={locationOptions}
                  employeeGroups={employeeGroupOptions}
                  employeeSubgroups={employeeSubgroups}
                  onChanged={() => {
                    void load();
                  }}
                />
                <EditIconButton onClick={openAssignmentsEditModal} label="Organizasyon bilgilerini düzenle" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
              <span>Organizasyon ve kural atama bilgilerinin sade görünümü</span>
            </div>
          </div>

          <div className="shrink-0 flex flex-wrap items-center gap-2">
            <EmployeeAsOfDateControl history={data.history} />
          </div>
        </div>
      </div>

      <div className={cx("grid gap-3", hideRuleInfoForDemo ? null : "lg:grid-cols-2")}>
        <Card title="Organizasyon Bilgileri" subtitle="Çalışanın bağlı olduğu organizasyon verileri">
          <div className="grid gap-3">
            <KV k="Şirket" v={companyName} />
            <KV k="Lokasyon" v={formatOrgUnit(e.branch)} />
            <KV k="Grup" v={formatOrgUnit(e.employeeGroup)} />
            <KV k="Alt Grup" v={formatOrgUnit(e.employeeSubgroup)} />
          </div>
        </Card>

        {!hideRuleInfoForDemo ? (
          <Card title="Kural Bilgileri" subtitle="Çalışan için geçerli olan kural çözümlemesi">
            <div className="grid gap-3">
              <KV
                k="Kural Seti Kodu"
                v={today.policyRuleSet?.ruleSet?.code || "—"}
              />

              <KV
                k="Kural Seti Adı"
                v={today.policyRuleSet?.ruleSet?.name || "—"}
              />

              <KV
                k="Kaynak"
                v={<span className="text-zinc-700">{formatRuleSource(today.policyRuleSet?.source)}</span>}
              />

              <KV
                k="Kural Durumu"
                v={
                  today.policyRuleSet?.ruleSet ? (
                    <span className="inline-flex items-center gap-2">
                      <Badge tone="ok">Tanımlı</Badge>
                      <span className="text-zinc-600">Çalışan için kural seti çözümlendi</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Badge tone="info">Varsayılan</Badge>
                      <span className="text-zinc-600">Şirket varsayılan kuralı kullanılıyor olabilir</span>
                    </span>
                  )
                }
              />
              <KV
                k="Açıklama"
                v={
                  today.policyRuleSet?.ruleSet ? (
                    <span className="text-zinc-700">Çalışan için açık veya türetilmiş bir kural seti bulundu.</span>
                  ) : (
                    <span className="text-zinc-500">Ayrı bir rule set ataması bulunmadığında şirket varsayılanı kullanılabilir.</span>
                  )
                }
              />
            </div>
          </Card>
        ) : null}
      </div>

      <VersionedEditModalShell
        open={editOpen && Boolean(editDraft)}
        title="Organizasyon bilgilerini düzenle"
        subtitle="Bu işlem mevcut atamayı ezmez; seçtiğiniz tarihten başlayan yeni bir sürüm oluşturur."
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
              onClick={saveAssignmentsEditModal}
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
              Bu modal yalnızca organizasyon bilgisinin yeni sürümünü oluşturur. Eski atama kaydı silinmez veya ezilmez.
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
                  Lokasyon <span className="text-rose-600">*</span>
                </span>
                <select
                  className={inputClass}
                  value={editDraft.branchId}
                  onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, branchId: event.target.value } : prev))}
                >
                  <option value="">Lokasyon seçin</option>
                  {locationOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.code} — {branch.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-semibold text-slate-800">
                  Grup <span className="text-rose-600">*</span>
                </span>
                <select
                  className={inputClass}
                  value={editDraft.employeeGroupId}
                  onChange={(event) => {
                    const nextGroupId = event.target.value;
                    const subgroupStillValid = employeeSubgroups.some(
                      (subgroup) => subgroup.id === editDraft.employeeSubgroupId && subgroup.groupId === nextGroupId,
                    );
                    setEditDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            employeeGroupId: nextGroupId,
                            employeeSubgroupId: subgroupStillValid ? prev.employeeSubgroupId : "",
                          }
                        : prev,
                    );
                  }}
                >
                  <option value="">Grup seçin</option>
                  {employeeGroupOptions.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.code} — {group.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-semibold text-slate-800">
                  Alt grup <span className="text-rose-600">*</span>
                </span>
                <select
                  className={inputClass}
                  value={editDraft.employeeSubgroupId}
                  disabled={!editDraft.employeeGroupId}
                  onChange={(event) =>
                    setEditDraft((prev) => (prev ? { ...prev, employeeSubgroupId: event.target.value } : prev))
                  }
                >
                  <option value="">{editDraft.employeeGroupId ? "Alt grup seçin" : "Önce grup seçin"}</option>
                  {employeeSubgroupOptions.map((subgroup) => (
                    <option key={subgroup.id} value={subgroup.id}>
                      {subgroup.code} — {subgroup.name}
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
