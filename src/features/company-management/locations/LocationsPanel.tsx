"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CompanyManagementAccess } from "../companyManagementAccess";
import CompanyManagementConfirmDialog from "../CompanyManagementConfirmDialog";
import { useCompanyManagementHeaderSlot } from "../companyManagementHeaderSlot";
import { buildCompanyManagementHref } from "../companyManagementUrls";

type Notice = { kind: "success" | "error" | "info"; text: string };

type LocationGroup = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

type Location = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  locationGroupId: string | null;
  locationGroup: LocationGroup | null;
  createdAt?: string;
  updatedAt?: string;
};

type Draft = {
  locationGroupId: string;
  code: string;
  name: string;
};

const emptyDraft: Draft = {
  locationGroupId: "",
  code: "",
  name: "",
};

function sortLocations(items: Location[]) {
  return [...items].sort((a, b) =>
    a.code.localeCompare(b.code, "tr", {
      sensitivity: "base",
    }),
  );
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function humanizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const map: Record<string, string> = {
    LOCATION_CODE_REQUIRED: "Konum kodu zorunludur.",
    LOCATION_CODE_TOO_LONG: "Konum kodu en fazla 50 karakter olabilir.",
    LOCATION_CODE_INVALID:
      "Konum kodu yalnızca büyük harf, rakam, nokta, tire ve alt çizgi içerebilir.",
    LOCATION_CODE_ALREADY_EXISTS: "Bu konum kodu zaten kullanılıyor.",
    LOCATION_NAME_REQUIRED: "Konum adı zorunludur.",
    LOCATION_NAME_TOO_LONG: "Konum adı en fazla 200 karakter olabilir.",
    LOCATION_GROUP_REQUIRED: "Konum grubu seçimi zorunludur.",
    LOCATION_GROUP_NOT_FOUND: "Seçilen konum grubu bulunamadı.",
    LOCATION_GROUP_INACTIVE: "Pasif konum grubuna yeni konum bağlanamaz.",
    LOCATION_IS_ACTIVE_INVALID: "Durum değeri geçersiz.",
    FORBIDDEN: "Bu işlem için yetkin yok.",
    UNAUTHORIZED: "Oturum bulunamadı. Lütfen tekrar giriş yap.",
  };

  return map[message] ?? "İşlem tamamlanamadı.";
}

async function readJson(res: Response) {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(String(json?.error ?? "REQUEST_FAILED"));
  }
  return json;
}

function normalizeCodeInput(value: string) {
  return value.trimStart().toUpperCase();
}

function groupLabel(group: LocationGroup | null | undefined) {
  if (!group) return "Konum Grubu atanmadı";
  return `${group.code} · ${group.name}`;
}

function DetailRow(props: { label: string; value: string }) {
  return (
    <div className="grid gap-1 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-slate-500">
        {props.label}
      </div>
      <div className="text-[15px] font-bold text-slate-900">
        {props.value || "-"}
      </div>
    </div>
  );
}

function LocationReadonlyView(props: { item: Location }) {
  return (
    <section className="mx-auto w-full max-w-[760px] rounded-[28px] border border-slate-200 bg-white/95 px-8 py-10 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
      <div className="mx-auto flex w-full max-w-[320px] flex-col items-center justify-center gap-7">
        <DetailRow label="Konum Grubu" value={groupLabel(props.item.locationGroup)} />
        <DetailRow label="Kod" value={props.item.code} />
        <DetailRow label="Ad" value={props.item.name} />
      </div>
    </section>
  );
}

function LocationHeaderControls(props: {
  items: Location[];
  selectedId: string;
  loading: boolean;
  onSelect: (id: string) => void;
}) {
  const disabled = props.loading || props.items.length === 0;

  return (
    <label className="grid min-w-0 gap-1.5 sm:w-[260px] md:w-[320px]">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        Kayıtlı Konumlar
      </span>
      <select
        value={props.selectedId}
        onChange={(event) => props.onSelect(event.target.value)}
        disabled={disabled}
        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/90 px-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition hover:border-slate-300 hover:bg-white focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
      >
        <option value="">
          {props.items.length === 0 ? "Kayıt yok" : "Konum seç..."}
        </option>
        {props.items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.code} · {item.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function LocationActionsMenu(props: {
  canWrite: boolean;
  saving: boolean;
  open: boolean;
  selectedItem: Location | null;
  onToggleActions: () => void;
  onCloseActions: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (!props.canWrite) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={props.onToggleActions}
        disabled={!props.selectedItem || props.saving}
        className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span>İşlemler</span>
        <span className="ml-2 text-[10px] leading-none text-slate-500" aria-hidden="true">
          {props.open ? "▲" : "▼"}
        </span>
      </button>

      {props.open ? (
        <div className="absolute right-0 z-30 mt-2 w-40 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-xl">
          <button
            type="button"
            onClick={props.onEdit}
            disabled={!props.selectedItem || props.saving}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Düzenle
          </button>
          <button
            type="button"
            onClick={props.onDelete}
            disabled={!props.selectedItem || props.saving}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sil
          </button>
          <button
            type="button"
            onClick={props.onCloseActions}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-500 hover:bg-slate-50"
          >
            Kapat
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function LocationsPanel(props: {
  access: CompanyManagementAccess;
  createRequested?: boolean;
}) {
  const router = useRouter();
  const setHeaderSlot = useCompanyManagementHeaderSlot();
  const canWrite = props.access.canManageOrg;
  const [groups, setGroups] = useState<LocationGroup[]>([]);
  const [items, setItems] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [createDraft, setCreateDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);
  const [createFormError, setCreateFormError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);

  const activeGroups = useMemo(
    () => groups.filter((group) => group.isActive),
    [groups],
  );

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  const flash = useCallback((kind: Notice["kind"], text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 3500);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [groupJson, locationJson] = await Promise.all([
        fetch("/api/company-management/location-groups", {
          cache: "no-store",
          credentials: "include",
        }).then(readJson),
        fetch("/api/company-management/locations", {
          cache: "no-store",
          credentials: "include",
        }).then(readJson),
      ]);

      const nextGroups = Array.isArray(groupJson?.items) ? groupJson.items : [];
      const nextItems = sortLocations(
        Array.isArray(locationJson?.items) ? locationJson.items : [],
      );

      setGroups(nextGroups);
      setItems(nextItems);
      setCreateDraft((prev) => ({
        ...prev,
        locationGroupId:
          prev.locationGroupId &&
          nextGroups.some((group: LocationGroup) => group.id === prev.locationGroupId)
            ? prev.locationGroupId
            : "",
      }));
    } catch (error) {
      flash("error", humanizeError(error));
    } finally {
      setLoading(false);
    }
  }, [flash]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (items.length === 0) {
      if (selectedId) setSelectedId("");
      return;
    }

    if (selectedId && !items.some((item) => item.id === selectedId)) {
      setSelectedId("");
    }
  }, [items, selectedId]);

  const selectFromHeader = useCallback((id: string) => {
    setSelectedId(id);
    setOpenActionsId(null);
    setIsCreateFormOpen(false);
    setEditingId(null);
    setCreateFormError("");
    setEditDraft(emptyDraft);
  }, []);

  const headerSlot = useMemo(
    () => (
      <LocationHeaderControls
        items={items}
        selectedId={selectedId}
        loading={loading}
        onSelect={selectFromHeader}
      />
    ),
    [items, loading, selectFromHeader, selectedId],
  );

  useEffect(() => {
    setHeaderSlot(headerSlot);
    return () => setHeaderSlot(null);
  }, [headerSlot, setHeaderSlot]);

  useEffect(() => {
    if (loading) return;
    const hash = window.location.hash.replace(/^#/, "").trim();
    if (!hash.startsWith("location-")) return;

    const id = hash.replace(/^location-/, "");
    if (id && items.some((item) => item.id === id)) {
      setSelectedId(id);
    }
  }, [loading, items]);

  function validateCreateDraft() {
    if (!String(createDraft.locationGroupId ?? "").trim()) {
      return "Konum grubu seçimi zorunludur.";
    }

    if (!String(createDraft.code ?? "").trim()) {
      return "Konum kodu zorunludur.";
    }

    if (!String(createDraft.name ?? "").trim()) {
      return "Konum adı zorunludur.";
    }

    return "";
  }

  async function createItem() {
    if (!canWrite || saving) return;
    const validationError = validateCreateDraft();
    if (validationError) {
      setCreateFormError(validationError);
      return;
    }
    setSaving(true);
    try {
      const json = await fetch("/api/company-management/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createDraft),
      }).then(readJson);

      setItems((prev) => sortLocations([...prev, json.item]));
      setSelectedId(json.item.id);
      setCreateDraft((prev) => ({
        locationGroupId: "",
        code: "",
        name: "",
      }));
      setEditingId(null);
      setEditDraft(emptyDraft);
      setIsCreateFormOpen(false);
      setCreateFormError("");
      router.replace(buildCompanyManagementHref("locations"), { scroll: false });
      flash("success", "Konum oluşturuldu.");
    } catch (error) {
      flash("error", humanizeError(error));
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(itemId: string) {
    if (!canWrite || saving) return;
    setSaving(true);
    try {
      const json = await fetch(`/api/company-management/locations/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editDraft),
      }).then(readJson);

      setItems((prev) =>
        sortLocations(prev.map((item) => (item.id === itemId ? json.item : item))),
      );
      setSelectedId(json.item.id);
      setEditingId(null);
      setEditDraft(emptyDraft);
      router.replace(buildCompanyManagementHref("locations"), { scroll: false });
      flash("success", "Konum güncellendi.");
    } catch (error) {
      flash("error", humanizeError(error));
    } finally {
      setSaving(false);
    }
  }

  const startEditSelected = useCallback(() => {
    if (!selectedItem) return;
    setOpenActionsId(null);
    setCreateFormError("");
    setIsCreateFormOpen(false);
    setEditingId(selectedItem.id);
    setEditDraft({
      locationGroupId: selectedItem.locationGroupId ?? "",
      code: selectedItem.code,
      name: selectedItem.name,
    });
  }, [selectedItem]);

  const closeActions = useCallback(() => {
    setOpenActionsId(null);
  setSelectedId("");
    setIsCreateFormOpen(false);
    setEditingId(null);
    setEditDraft(emptyDraft);
    setCreateFormError("");
    router.replace(buildCompanyManagementHref("locations"), { scroll: false });
  }, [router]);

  const toggleActions = useCallback(() => {
    if (!selectedItem) return;
    setOpenActionsId((prev) => (prev === selectedItem.id ? null : selectedItem.id));
  }, [selectedItem]);

  const openCreateForm = useCallback(() => {
    setOpenActionsId(null);
    setEditingId(null);
    setCreateFormError("");
    setEditDraft(emptyDraft);
    setCreateDraft({
      locationGroupId: "",
      code: "",
      name: "",
    });
    setIsCreateFormOpen(true);
  }, [activeGroups]);

  useEffect(() => {
    if (props.createRequested) {
      openCreateForm();
      return;
    }
  
    if (!isCreateFormOpen) return;

    setSelectedId("");
    setOpenActionsId(null);
    setIsCreateFormOpen(false);
    setEditingId(null);
    setEditDraft(emptyDraft);
    setCreateDraft(emptyDraft);
    setCreateFormError("");
  }, [props.createRequested, openCreateForm, isCreateFormOpen]);

  async function deleteItem(item: Location) {
    if (!canWrite || saving) return;

    setSaving(true);
    try {
      await fetch(`/api/company-management/locations/${item.id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(readJson);

      setItems((prev) => {
        const next = prev.filter((x) => x.id !== item.id);
        if (selectedId === item.id) {
          setSelectedId("");
        }
        return next;
      });
      setOpenActionsId(null);
      if (editingId === item.id) setEditingId(null);
      setDeleteTarget(null);
      setEditDraft(emptyDraft);
      flash("success", "Konum silindi.");
    } catch (error) {
      flash("error", humanizeError(error));
    } finally {
      setSaving(false);
    }
  }

  const requestDeleteSelected = useCallback(() => {
    if (!selectedItem || saving) return;
    setOpenActionsId(null);
    setDeleteTarget(selectedItem);
  }, [selectedItem, saving]);

  const closeDeleteDialog = useCallback(() => {
    if (saving) return;
    setDeleteTarget(null);
  }, [saving]);

  const confirmDeleteSelected = useCallback(() => {
    if (!deleteTarget) return;
    void deleteItem(deleteTarget);
  }, [deleteTarget]);

  const deleteSelected = useCallback(() => {
    if (!selectedItem) return;
    requestDeleteSelected();
  }, [selectedItem, requestDeleteSelected]);

  const isEditing = Boolean(editingId);
  const isCreating = isCreateFormOpen && !editingId;
  const isViewing = !isCreating && !isEditing && Boolean(selectedItem);
  const formDraft = isEditing
    ? editDraft
    : isViewing && selectedItem
      ? {
          locationGroupId: selectedItem.locationGroupId ?? "",
          code: selectedItem.code,
          name: selectedItem.name,
        }
      : createDraft;

  return (
    <div className="grid min-h-[430px] gap-3">
      {notice ? (
        <div
          className={cx(
            "rounded-2xl border px-4 py-3 text-sm font-semibold",
            notice.kind === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
            notice.kind === "error" && "border-rose-200 bg-rose-50 text-rose-800",
            notice.kind === "info" && "border-slate-200 bg-slate-50 text-slate-700",
          )}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="relative min-h-[430px]">
        <div className="absolute right-0 top-0 z-20">
          <LocationActionsMenu
            canWrite={canWrite}
            saving={saving}
            open={!!selectedItem && openActionsId === selectedItem.id}
            selectedItem={selectedItem}
            onToggleActions={toggleActions}
            onCloseActions={closeActions}
            onEdit={startEditSelected}
            onDelete={deleteSelected}
          />
        </div>

        {isViewing && selectedItem ? (
          <LocationReadonlyView item={selectedItem} />
        ) : null}

        {canWrite && (isCreating || isEditing) ? (
          <section className="mx-auto w-full max-w-[420px] rounded-[24px] border border-slate-200 bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <div className="grid gap-4">
              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-slate-500">
                  Konum Grubu
                  <span className="ml-1 text-rose-500">*</span>
                </span>
                <select
                  value={formDraft.locationGroupId}
                  onChange={(event) => {
                    const locationGroupId = event.target.value;
                    if (isEditing) {
                      setEditDraft((prev) => ({
                        ...prev,
                        locationGroupId,
                      }));
                      return;
                    }

                    setCreateFormError("");
                    setCreateDraft((prev) => ({
                      ...prev,
                      locationGroupId,
                    }));
                  }}
                  disabled={isCreating ? activeGroups.length === 0 : groups.length === 0}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">Seç…</option>
                  {(isEditing ? groups : activeGroups).map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.code} · {group.name}
                      {group.isActive ? "" : " (Pasif)"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-slate-500">
                  Konum Kodu
                  <span className="ml-1 text-rose-500">*</span>
                </span>
                <input
                  value={formDraft.code}
                  onChange={(event) => {
                    const code = normalizeCodeInput(event.target.value);
                    if (isEditing) {
                      setEditDraft((prev) => ({
                        ...prev,
                        code,
                      }));
                      return;
                    }

                    setCreateFormError("");
                    setCreateDraft((prev) => ({
                      ...prev,
                      code,
                    }));
                  }}
                  placeholder="SUBE_001"
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-slate-500">
                  Konum Adı
                  <span className="ml-1 text-rose-500">*</span>
                </span>
                <input
                  value={formDraft.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    if (isEditing) {
                      setEditDraft((prev) => ({
                        ...prev,
                        name,
                      }));
                      return;
                    }

                    setCreateFormError("");
                    setCreateDraft((prev) => ({
                      ...prev,
                      name,
                    }));
                  }}
                  placeholder="Merkez Şube"
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15"
                />
              </label>
              
              {isCreating && createFormError ? (
                <div className="text-xs font-semibold text-rose-600">
                  {createFormError}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (isEditing && editingId) {
                      saveEdit(editingId);
                    } else {
                      createItem();
                    }
                  }}
                  disabled={saving || (isCreating && activeGroups.length === 0)}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-indigo-500 px-5 text-sm font-bold text-white shadow-[0_14px_30px_rgba(99,102,241,0.24)] transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isEditing ? "Kaydet" : "Oluştur"}
                </button>

                {isEditing ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setEditDraft(emptyDraft);
                    }}
                    disabled={saving}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Vazgeç
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <CompanyManagementConfirmDialog
        open={Boolean(deleteTarget)}
        title="Bu Konum Grubu kalıcı olarak silinsin mi?"
        description="Seçili Konum Grubu kaydı kalıcı olarak silinecek. Bu işlem geri alınamaz."
        details={
          deleteTarget
            ? [
                `Kod: ${deleteTarget.code}`,
                `Ad: ${deleteTarget.name}`,
                "Bu gruba bağlı Konum kayıtları silinmez; yalnızca Konum Grubu bağlantıları kaldırılır.",
                "Bağlantısı kaldırılan Konum kayıtları sistemde “Konum Grubu atanmadı” olarak kalır.",
                "Silme işleminin tüm sonuçları işlemi yapan kullanıcının sorumluluğundadır.",
              ]
            : []
        }
        cancelLabel="Vazgeç"
        confirmLabel="Kaydı Sil"
        onCancel={closeDeleteDialog}
        onConfirm={confirmDeleteSelected}
      />
    </div>
  );
}