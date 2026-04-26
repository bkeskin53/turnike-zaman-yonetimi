"use client";

import { useEffect, useMemo, useState } from "react";

type MappingUnit = "MINUTES" | "DAYS" | "COUNT";
type MappingSource = "DB" | "FILE";
type MappingQuantityStrategy = "WORKED_MINUTES" | "OVERTIME_MINUTES" | "FIXED_QUANTITY";
type PuantajCode =
  | "NORMAL_WORK"
  | "OVERTIME"
  | "OFF_DAY"
  | "ABSENCE"
  | "LEAVE_ANNUAL"
  | "LEAVE_SICK"
  | "LEAVE_EXCUSED"
  | "LEAVE_UNPAID"
  | "LEAVE_UNKNOWN";

type ProfileListItem = {
  code: string;
  name: string;
  source: MappingSource;
  isDefault: boolean;
  isActive: boolean;
  itemCount: number;
  units: MappingUnit[];
};

type ProfilesApiResponse = {
  ok: boolean;
  meta: {
    company: {
      id: string;
      name: string;
    };
    summary: {
      totalProfiles: number;
      activeProfiles: number;
      defaultProfileCode: string | null;
      sourceSummary: {
        dbCount: number;
        fileCount: number;
      };
    };
  };
  items: ProfileListItem[];
};

type ProfileDetailItem = {
  puantajCode: PuantajCode;
  payrollCode: string;
  payrollLabel: string;
  unit: MappingUnit;
  quantityStrategy: MappingQuantityStrategy;
  fixedQuantity: number | null;
  sortOrder: number;
  source: MappingSource;
};

type ProfileDetailApiResponse = {
  ok: boolean;
  meta: {
    company: {
      id: string;
      name: string;
    };
  };
  profile: {
    code: string;
    name: string;
    source: MappingSource;
    isDefault: boolean;
    isActive: boolean;
    itemCount: number;
  };
  items: ProfileDetailItem[];
};

const PUANTAJ_CODE_OPTIONS: Array<{ value: PuantajCode; label: string }> = [
  { value: "NORMAL_WORK", label: "Normal Work" },
  { value: "OVERTIME", label: "Overtime" },
  { value: "OFF_DAY", label: "Off Day" },
  { value: "ABSENCE", label: "Absence" },
  { value: "LEAVE_ANNUAL", label: "Annual Leave" },
  { value: "LEAVE_SICK", label: "Sick Leave" },
  { value: "LEAVE_EXCUSED", label: "Excused Leave" },
  { value: "LEAVE_UNPAID", label: "Unpaid Leave" },
  { value: "LEAVE_UNKNOWN", label: "Unknown Leave" },
];

const QUANTITY_STRATEGY_OPTIONS: Array<{
  value: MappingQuantityStrategy;
  label: string;
  description: string;
}> = [
  {
    value: "WORKED_MINUTES",
    label: "WORKED_MINUTES",
    description: "Quantity = workedMinutes",
  },
  {
    value: "OVERTIME_MINUTES",
    label: "OVERTIME_MINUTES",
    description: "Quantity = overtimeMinutes",
  },
  {
    value: "FIXED_QUANTITY",
    label: "FIXED_QUANTITY",
    description: "Quantity = sabit değer",
  },
];

function defaultUnitForCode(code: PuantajCode): MappingUnit {
  switch (code) {
    case "NORMAL_WORK":
    case "OVERTIME":
      return "MINUTES";
    default:
      return "DAYS";
  }
}

function defaultStrategyForCode(code: PuantajCode): MappingQuantityStrategy {
  switch (code) {
    case "NORMAL_WORK":
      return "WORKED_MINUTES";
    case "OVERTIME":
      return "OVERTIME_MINUTES";
    default:
      return "FIXED_QUANTITY";
  }
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function InfoBadge(props: { label: string; value: string; tone?: "default" | "info" | "good" | "warn" | "danger" }) {
  const tone =
    props.tone === "info"
      ? "border-sky-200 bg-sky-50 text-sky-800"
      : props.tone === "good"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : props.tone === "warn"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : props.tone === "danger"
            ? "border-rose-200 bg-rose-50 text-rose-800"
            : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={cx("rounded-2xl border px-3 py-2", tone)}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">{props.label}</div>
      <div className="mt-1 text-sm font-medium">{props.value}</div>
    </div>
  );
}

function SummaryCard(props: { title: string; value: string | number; tone?: "default" | "good" | "warn" | "danger" | "info" }) {
  const tone =
    props.tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : props.tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : props.tone === "danger"
          ? "border-rose-200 bg-rose-50 text-rose-900"
          : props.tone === "info"
            ? "border-sky-200 bg-sky-50 text-sky-900"
            : "border-slate-200 bg-white text-slate-900";

  return (
    <div className={cx("rounded-2xl border p-4 shadow-sm", tone)}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-70">{props.title}</div>
      <div className="mt-2 text-2xl font-semibold">{props.value}</div>
    </div>
  );
}

function sourceTone(source: MappingSource) {
  return source === "DB" ? "good" : "warn";
}

export default function PayrollMappingClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profilesData, setProfilesData] = useState<ProfilesApiResponse | null>(null);

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<ProfileDetailApiResponse | null>(null);

  const [profileQuery, setProfileQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createCode, setCreateCode] = useState("");
  const [createName, setCreateName] = useState("");
  const [createIsDefault, setCreateIsDefault] = useState(false);
  const [createIsActive, setCreateIsActive] = useState(true);

  const [profileActionLoading, setProfileActionLoading] = useState<null | "SAVE_PROFILE" | "SET_DEFAULT" | "SET_ACTIVE">(null);
  const [profileActionError, setProfileActionError] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const [itemActionLoading, setItemActionLoading] = useState(false);
  const [itemActionError, setItemActionError] = useState<string | null>(null);
  const [editingPuantajCode, setEditingPuantajCode] = useState<PuantajCode>("NORMAL_WORK");
  const [editingPayrollCode, setEditingPayrollCode] = useState("");
  const [editingPayrollLabel, setEditingPayrollLabel] = useState("");
  const [editingUnit, setEditingUnit] = useState<MappingUnit>("MINUTES");
  const [editingQuantityStrategy, setEditingQuantityStrategy] = useState<MappingQuantityStrategy>("WORKED_MINUTES");
  const [editingFixedQuantity, setEditingFixedQuantity] = useState("1");
  const [editingSortOrder, setEditingSortOrder] = useState("0");
  const [editingIsActive, setEditingIsActive] = useState(true);

  async function loadProfiles(preferredCode?: string | null) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/puantaj/payroll-mapping/profiles", {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Mapping profile listesi alınamadı.");
      }

      setProfilesData(json);

      const nextCode =
        preferredCode ??
        selectedCode ??
        json?.meta?.summary?.defaultProfileCode ??
        json?.items?.[0]?.code ??
        null;

      setSelectedCode(nextCode);
    } catch (err: any) {
      setError(err?.message || "Mapping profile listesi alınamadı.");
      setProfilesData(null);
      setSelectedCode(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadProfileDetail(code: string) {
    setDetailLoading(true);
    setDetailError(null);

    try {
      const res = await fetch(`/api/puantaj/payroll-mapping/profiles/${encodeURIComponent(code)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Mapping profile detayı alınamadı.");
      }

      setDetailData(json);
      setEditName(json.profile.name ?? "");
      setEditIsActive(!!json.profile.isActive);
    } catch (err: any) {
      setDetailError(err?.message || "Mapping profile detayı alınamadı.");
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadProfiles();
  }, []);

  useEffect(() => {
    if (!selectedCode) {
      setDetailData(null);
      return;
    }
    void loadProfileDetail(selectedCode);
  }, [selectedCode]);

  const filteredProfiles = useMemo(() => {
    const q = profileQuery.trim().toLocaleLowerCase("tr");
    const items = profilesData?.items ?? [];
    if (!q) return items;

    return items.filter((item) =>
      [item.code, item.name, item.source].join(" ").toLocaleLowerCase("tr").includes(q)
    );
  }, [profilesData?.items, profileQuery]);

  const selectedProfileSummary = useMemo(() => {
    return (profilesData?.items ?? []).find((x) => x.code === selectedCode) ?? null;
  }, [profilesData?.items, selectedCode]);

  const mappedItemCodes = useMemo(() => {
    const set = new Set((detailData?.items ?? []).map((x) => x.puantajCode));
    return set;
  }, [detailData?.items]);

  function resetCreateForm() {
    setCreateCode("");
    setCreateName("");
    setCreateIsDefault(false);
    setCreateIsActive(true);
    setCreateError(null);
  }

  async function handleCreateProfile() {
    setCreateLoading(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/puantaj/payroll-mapping/profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: createCode.trim(),
          name: createName.trim(),
          isDefault: createIsDefault,
          isActive: createIsActive,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Profile oluşturulamadı.");
      }

      setShowCreateForm(false);
      resetCreateForm();
      await loadProfiles(json?.profile?.code ?? createCode.trim().toUpperCase());
    } catch (err: any) {
      setCreateError(err?.message || "Profile oluşturulamadı.");
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleSaveProfile() {
    if (!selectedCode) return;

    setProfileActionLoading("SAVE_PROFILE");
    setProfileActionError(null);
    try {
      const res = await fetch(`/api/puantaj/payroll-mapping/profiles/${encodeURIComponent(selectedCode)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editName.trim(),
          isActive: editIsActive,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Profile güncellenemedi.");
      }

      await loadProfiles(selectedCode);
      await loadProfileDetail(selectedCode);
    } catch (err: any) {
      setProfileActionError(err?.message || "Profile güncellenemedi.");
    } finally {
      setProfileActionLoading(null);
    }
  }

  async function handleSetDefault() {
    if (!selectedCode) return;

    setProfileActionLoading("SET_DEFAULT");
    setProfileActionError(null);
    try {
      const res = await fetch(
        `/api/puantaj/payroll-mapping/profiles/${encodeURIComponent(selectedCode)}/set-default`,
        { method: "POST" }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Default profile ayarlanamadı.");
      }

      await loadProfiles(selectedCode);
      await loadProfileDetail(selectedCode);
    } catch (err: any) {
      setProfileActionError(err?.message || "Default profile ayarlanamadı.");
    } finally {
      setProfileActionLoading(null);
    }
  }

  async function handleSetActive(nextActive: boolean) {
    if (!selectedCode) return;

    setProfileActionLoading("SET_ACTIVE");
    setProfileActionError(null);
    try {
      const res = await fetch(
        `/api/puantaj/payroll-mapping/profiles/${encodeURIComponent(selectedCode)}/set-active`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isActive: nextActive,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Profile aktifliği güncellenemedi.");
      }

      await loadProfiles(selectedCode);
      await loadProfileDetail(selectedCode);
    } catch (err: any) {
      setProfileActionError(err?.message || "Profile aktifliği güncellenemedi.");
    } finally {
      setProfileActionLoading(null);
    }
  }

  async function handleUpsertItem() {
    if (!selectedCode) return;

    setItemActionLoading(true);
    setItemActionError(null);
    try {
      const res = await fetch(
        `/api/puantaj/payroll-mapping/profiles/${encodeURIComponent(selectedCode)}/items/${encodeURIComponent(editingPuantajCode)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            payrollCode: editingPayrollCode.trim(),
            payrollLabel: editingPayrollLabel.trim(),
            unit: editingUnit,
            quantityStrategy: editingQuantityStrategy,
            fixedQuantity: editingQuantityStrategy === "FIXED_QUANTITY" ? Number(editingFixedQuantity) : null,
            sortOrder: Number(editingSortOrder),
            isActive: editingIsActive,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Mapping item kaydedilemedi.");
      }

      await loadProfiles(selectedCode);
      await loadProfileDetail(selectedCode);
    } catch (err: any) {
      setItemActionError(err?.message || "Mapping item kaydedilemedi.");
    } finally {
      setItemActionLoading(false);
    }
  }

  async function handleDeactivateItem(puantajCode: PuantajCode) {
    if (!selectedCode) return;

    setItemActionLoading(true);
    setItemActionError(null);
    try {
      const res = await fetch(
        `/api/puantaj/payroll-mapping/profiles/${encodeURIComponent(selectedCode)}/items/${encodeURIComponent(puantajCode)}`,
        {
          method: "DELETE",
        }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Mapping item pasife çekilemedi.");
      }

      await loadProfiles(selectedCode);
      await loadProfileDetail(selectedCode);
    } catch (err: any) {
      setItemActionError(err?.message || "Mapping item pasife çekilemedi.");
    } finally {
      setItemActionLoading(false);
    }
  }

  function fillItemFormFromExisting(item: ProfileDetailItem) {
    setEditingPuantajCode(item.puantajCode);
    setEditingPayrollCode(item.payrollCode);
    setEditingPayrollLabel(item.payrollLabel);
    setEditingUnit(item.unit);
    setEditingQuantityStrategy(item.quantityStrategy);
    setEditingFixedQuantity(item.fixedQuantity == null ? "1" : String(item.fixedQuantity));
    setEditingSortOrder(String(item.sortOrder));
    setEditingIsActive(true);
  }

  useEffect(() => {
    if (!detailData?.items?.length) return;
    const existing = detailData.items.find((x) => x.puantajCode === editingPuantajCode);
    if (existing) return;

    setEditingUnit(defaultUnitForCode(editingPuantajCode));
    setEditingQuantityStrategy(defaultStrategyForCode(editingPuantajCode));
    setEditingFixedQuantity("1");
  }, [editingPuantajCode, detailData?.items]);

  const fixedQuantityDisabled = editingQuantityStrategy !== "FIXED_QUANTITY";
  const quantityPreviewText =
    editingQuantityStrategy === "WORKED_MINUTES"
      ? "Quantity = workedMinutes"
      : editingQuantityStrategy === "OVERTIME_MINUTES"
        ? "Quantity = overtimeMinutes"
        : `Quantity = fixedQuantity (${editingFixedQuantity || "0"})`;

        useEffect(() => {
          if (editingQuantityStrategy === "WORKED_MINUTES" || editingQuantityStrategy === "OVERTIME_MINUTES") {
            if (editingUnit !== "MINUTES") {
              setEditingUnit("MINUTES");
            }
            return;
          }
        }, [editingQuantityStrategy, editingUnit]);

        const quantityStrategyHelp =
          editingQuantityStrategy === "WORKED_MINUTES"
            ? "Dakika bazlı fiili çalışma quantity üretir."
            : editingQuantityStrategy === "OVERTIME_MINUTES"
              ? "Dakika bazlı fazla mesai quantity üretir."
              : "Sabit quantity üretir. Yarım gün için 0.5 gibi değer girebilirsin.";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Puantaj Config</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Payroll Mapping Yönetimi</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            İç puantaj kodlarını dış payroll kodlarına bağlayan profile ve item yönetim ekranı.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setShowCreateForm((x) => !x);
              setCreateError(null);
            }}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {showCreateForm ? "Yeni Profili Gizle" : "Yeni Profil"}
          </button>

          <button
            type="button"
            onClick={() => void loadProfiles(selectedCode)}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Yenile
          </button>
        </div>
      </div>

      {profilesData ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Toplam Profil" value={profilesData.meta.summary.totalProfiles} />
          <SummaryCard title="Aktif Profil" value={profilesData.meta.summary.activeProfiles} tone="good" />
          <SummaryCard title="DB Profil" value={profilesData.meta.summary.sourceSummary.dbCount} tone="info" />
          <SummaryCard title="File Fallback" value={profilesData.meta.summary.sourceSummary.fileCount} tone="warn" />
        </div>
      ) : null}

      {showCreateForm ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Yeni Mapping Profile</div>
          <div className="mt-1 text-xs text-slate-500">Code sabittir, oluşturulduktan sonra değiştirilmez.</div>

          {createError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {createError}
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Profile Code</label>
              <input
                type="text"
                value={createCode}
                onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                placeholder="ACME_TEST"
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Profile Name</label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Acme Test Profile"
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
              />
            </div>
            <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={createIsDefault}
                onChange={(e) => setCreateIsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Default Profile
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={createIsActive}
                onChange={(e) => setCreateIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Aktif
            </label>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleCreateProfile}
              disabled={createLoading}
              className={cx(
                "inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium transition",
                createLoading
                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                  : "border-slate-300 bg-slate-900 text-white hover:bg-slate-800"
              )}
            >
              {createLoading ? "Oluşturuluyor..." : "Profile Oluştur"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false);
                resetCreateForm();
              }}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Vazgeç
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-4">
            <div className="text-sm font-semibold text-slate-900">Profile Listesi</div>
            <div className="mt-1 text-xs text-slate-500">DB truth ve fallback profile görünümü</div>
            <input
              type="text"
              value={profileQuery}
              onChange={(e) => setProfileQuery(e.target.value)}
              placeholder="Code veya ad ara..."
              className="mt-3 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
            />
          </div>

          <div className="p-4">
            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : loading && !profilesData ? (
              <div className="text-sm text-slate-500">Profile listesi yükleniyor...</div>
            ) : filteredProfiles.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Gösterilecek profile bulunamadı.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProfiles.map((profile) => (
                  <button
                    key={profile.code}
                    type="button"
                    onClick={() => setSelectedCode(profile.code)}
                    className={cx(
                      "w-full rounded-2xl border px-4 py-3 text-left transition",
                      selectedCode === profile.code
                        ? "border-sky-300 bg-sky-50"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-900">{profile.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{profile.code}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {profile.isDefault ? <InfoBadge label="Default" value="Yes" tone="good" /> : null}
                        <InfoBadge label="Source" value={profile.source} tone={sourceTone(profile.source)} />
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      <div className="text-xs text-slate-600">
                        Aktif: <span className="font-semibold text-slate-900">{profile.isActive ? "Evet" : "Hayır"}</span>
                      </div>
                      <div className="text-xs text-slate-600">
                        Item Count: <span className="font-semibold text-slate-900">{profile.itemCount}</span>
                      </div>
                      <div className="text-xs text-slate-600">
                        Unit: <span className="font-semibold text-slate-900">{profile.units.join(", ") || "—"}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Profile Detayı</div>
                <div className="mt-1 text-xs text-slate-500">Ad, aktiflik, default ve kaynak bilgisi</div>
              </div>
              {selectedProfileSummary ? (
                <div className="flex flex-wrap gap-2">
                  <InfoBadge label="Code" value={selectedProfileSummary.code} />
                  <InfoBadge label="Source" value={selectedProfileSummary.source} tone={sourceTone(selectedProfileSummary.source)} />
                  <InfoBadge label="Status" value={selectedProfileSummary.isActive ? "Active" : "Passive"} tone={selectedProfileSummary.isActive ? "good" : "warn"} />
                </div>
              ) : null}
            </div>

            {profileActionError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {profileActionError}
              </div>
            ) : null}

            {detailError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {detailError}
              </div>
            ) : detailLoading && !detailData ? (
              <div className="mt-4 text-sm text-slate-500">Profile detayı yükleniyor...</div>
            ) : !detailData ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Sol taraftan bir profile seç.
              </div>
            ) : (
              <>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Profile Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Profile Code</label>
                    <input
                      type="text"
                      value={detailData.profile.code}
                      disabled
                      className="h-10 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500 outline-none"
                    />
                  </div>

                  <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Aktif
                  </label>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={profileActionLoading !== null}
                      className={cx(
                        "inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium transition",
                        profileActionLoading !== null
                          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      {profileActionLoading === "SAVE_PROFILE" ? "Kaydediliyor..." : "Profile Kaydet"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleSetDefault}
                    disabled={profileActionLoading !== null || detailData.profile.isDefault}
                    className={cx(
                      "inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium transition",
                      profileActionLoading !== null || detailData.profile.isDefault
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                        : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                    )}
                  >
                    {profileActionLoading === "SET_DEFAULT" ? "Ayarlanıyor..." : detailData.profile.isDefault ? "Default Profile" : "Default Yap"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetActive(!detailData.profile.isActive)}
                    disabled={profileActionLoading !== null}
                    className={cx(
                      "inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium transition",
                      profileActionLoading !== null
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                        : detailData.profile.isActive
                          ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                          : "border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100"
                    )}
                  >
                    {profileActionLoading === "SET_ACTIVE"
                      ? "Güncelleniyor..."
                      : detailData.profile.isActive
                        ? "Pasife Çek"
                        : "Aktif Yap"}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Mapping Item Düzenleyici</div>
            <div className="mt-1 text-xs text-slate-500">
              Seçili profile için puantaj kodu bazlı mapping item oluştur veya güncelle.
            </div>

            {itemActionError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {itemActionError}
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-7">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Puantaj Code</label>
                <select
                  value={editingPuantajCode}
                  onChange={(e) => setEditingPuantajCode(e.target.value as PuantajCode)}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
                >
                  {PUANTAJ_CODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.value}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Payroll Code</label>
                <input
                  type="text"
                  value={editingPayrollCode}
                  onChange={(e) => setEditingPayrollCode(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Payroll Label</label>
                <input
                  type="text"
                  value={editingPayrollLabel}
                  onChange={(e) => setEditingPayrollLabel(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Unit</label>
                <select
                  value={editingUnit}
                  onChange={(e) => setEditingUnit(e.target.value as MappingUnit)}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
               >
                  <option value="MINUTES">MINUTES</option>
                  <option value="DAYS">DAYS</option>
                  <option value="COUNT">COUNT</option>
                </select>
              </div>
              
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Quantity Strategy</label>
                <select
                  value={editingQuantityStrategy}
                  onChange={(e) => setEditingQuantityStrategy(e.target.value as MappingQuantityStrategy)}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
                >
                  {QUANTITY_STRATEGY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Fixed Quantity</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingFixedQuantity}
                  onChange={(e) => setEditingFixedQuantity(e.target.value)}
                  disabled={fixedQuantityDisabled}
                  className={cx(
                    "h-10 w-full rounded-xl border px-3 text-sm outline-none transition",
                    fixedQuantityDisabled
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                      : "border-slate-300 bg-white focus:border-slate-400"
                  )}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Sort Order</label>
                <input
                  type="number"
                  value={editingSortOrder}
                  onChange={(e) => setEditingSortOrder(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
                />
              </div>
            </div>
            
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Projection Preview
              </div>
              <div className="mt-1 text-sm font-medium text-slate-900">{quantityPreviewText}</div>
              <div className="mt-1 text-xs text-slate-500">
                Unit = <span className="font-semibold text-slate-700">{editingUnit}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {quantityStrategyHelp}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editingIsActive}
                  onChange={(e) => setEditingIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Aktif kaydet
              </label>

              <button
                type="button"
                onClick={handleUpsertItem}
                disabled={!selectedCode || itemActionLoading}
                className={cx(
                  "inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium transition",
                  !selectedCode || itemActionLoading
                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                    : "border-slate-300 bg-slate-900 text-white hover:bg-slate-800"
                )}
              >
                {itemActionLoading ? "Kaydediliyor..." : "Item Kaydet / Güncelle"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">Profile Item Listesi</div>
              <div className="mt-1 text-xs text-slate-500">Seçili profile ait aktif mapping item’lar</div>
            </div>

            <div className="p-4">
              {!detailData ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Seçili profile yok.
                </div>
              ) : detailData.items.length === 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Bu profile için henüz aktif mapping item yok.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-slate-600">
                        <th className="px-4 py-3 font-semibold">Puantaj Code</th>
                        <th className="px-4 py-3 font-semibold">Payroll Code</th>
                        <th className="px-4 py-3 font-semibold">Label</th>
                        <th className="px-4 py-3 font-semibold">Unit</th>
                        <th className="px-4 py-3 font-semibold">Strategy</th>
                        <th className="px-4 py-3 font-semibold">Fixed Qty</th>
                        <th className="px-4 py-3 font-semibold">Sort</th>
                        <th className="px-4 py-3 font-semibold">Source</th>
                        <th className="px-4 py-3 font-semibold">Aksiyon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailData.items.map((item) => (
                        <tr key={item.puantajCode} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-slate-700">
                            <div className="font-medium text-slate-900">{item.puantajCode}</div>
                            {!mappedItemCodes.has(item.puantajCode) ? (
                              <div className="mt-1 text-[11px] text-slate-500">Not mapped</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{item.payrollCode}</td>
                          <td className="px-4 py-3 text-slate-700">{item.payrollLabel}</td>
                          <td className="px-4 py-3 text-slate-700">{item.unit}</td>
                          <td className="px-4 py-3 text-slate-700">{item.quantityStrategy}</td>
                          <td className="px-4 py-3 text-slate-700">{item.fixedQuantity == null ? "—" : item.fixedQuantity}</td>
                          <td className="px-4 py-3 text-slate-700">{item.sortOrder}</td>
                          <td className="px-4 py-3">
                            <span
                              className={cx(
                                "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                                item.source === "DB"
                                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                  : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                              )}
                            >
                              {item.source}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => fillItemFormFromExisting(item)}
                                className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                Düzenle
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeactivateItem(item.puantajCode)}
                                disabled={itemActionLoading || detailData.profile.source === "FILE"}
                                className={cx(
                                  "inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium transition",
                                  itemActionLoading || detailData.profile.source === "FILE"
                                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                    : "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                )}
                              >
                                Pasife Çek
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}