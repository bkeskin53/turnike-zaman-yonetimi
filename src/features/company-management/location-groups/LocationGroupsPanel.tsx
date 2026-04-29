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
  createdAt?: string;
  updatedAt?: string;
};

type Draft = {
  code: string;
  name: string;
};

const emptyDraft: Draft = {
  code: "",
  name: "",
};

function sortLocationGroups(items: LocationGroup[]) {
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
    LOCATION_GROUP_CODE_REQUIRED: "Konum grubu kodu zorunludur.",
    LOCATION_GROUP_CODE_TOO_LONG: "Konum grubu kodu en fazla 50 karakter olabilir.",
    LOCATION_GROUP_CODE_INVALID:
      "Konum grubu kodu yalnızca büyük harf, rakam, nokta, tire ve alt çizgi içerebilir.",
    LOCATION_GROUP_CODE_ALREADY_EXISTS: "Bu konum grubu kodu zaten kullanılıyor.",
    LOCATION_GROUP_NAME_REQUIRED: "Konum grubu adı zorunludur.",
    LOCATION_GROUP_NAME_TOO_LONG: "Konum grubu adı en fazla 200 karakter olabilir.",
    LOCATION_GROUP_IS_ACTIVE_INVALID: "Durum değeri geçersiz.",
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

function DetailRow(props: {
  label: string;
  value: string;
}) {
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

function LocationGroupReadonlyView(props: {
  item: LocationGroup;
}) {
  return (
    <section className="mx-auto w-full max-w-[760px] rounded-[28px] border border-slate-200 bg-white/95 px-8 py-10 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
      <div className="mx-auto flex w-full max-w-[260px] flex-col items-center justify-center gap-7">
        <DetailRow label="Kod" value={props.item.code} />
        <DetailRow label="Ad" value={props.item.name} />
      </div>
    </section>
  );
}

function LocationGroupHeaderControls(props: {
  items: LocationGroup[];
  selectedId: string;
  loading: boolean;
  onSelect: (id: string) => void;
}) {
  const disabled = props.loading || props.items.length === 0;

  return (
    <div className="flex w-full flex-col gap-2">
      <label className="grid min-w-0 gap-1.5 sm:w-[260px] md:w-[320px]">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Kayıtlı Konum Grupları
        </span>
        <select
          value={props.selectedId}
          onChange={(event) => props.onSelect(event.target.value)}
          disabled={disabled}
          className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/90 px-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition hover:border-slate-300 hover:bg-white focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
        >
          <option value="">
            {props.items.length === 0 ? "Kayıt yok" : "Konum Grubu seç..."}
          </option>
          {props.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} · {item.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function LocationGroupActionsMenu(props: {
  canWrite: boolean;
  saving: boolean;
  open: boolean;
  selectedItem: LocationGroup | null;
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

export default function LocationGroupsPanel(props: {
  access: CompanyManagementAccess;
  createRequested?: boolean;
}) {
  const router = useRouter();
  const canWrite = props.access.canManageOrg;
  const setHeaderSlot = useCompanyManagementHeaderSlot();
  const [items, setItems] = useState<LocationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [createDraft, setCreateDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LocationGroup | null>(null);
  const [createFormError, setCreateFormError] = useState("");
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  const flash = useCallback((kind: Notice["kind"], text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 3500);
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const json = await fetch("/api/company-management/location-groups", {
        cache: "no-store",
        credentials: "include",
      }).then(readJson);
      
      setItems(sortLocationGroups(Array.isArray(json?.items) ? json.items : []));
    } catch (error) {
      flash("error", humanizeError(error));
    } finally {
      setLoading(false);
    }
  }, [flash]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (items.length === 0) {
      if (selectedId) setSelectedId("");
      return;
    }

    if (selectedId && !items.some((item) => item.id === selectedId)) {
      setSelectedId("");
    }
  }, [items, selectedId]);

  function validateCreateDraft() {
    if (!String(createDraft.code ?? "").trim()) {
      return "Konum grubu kodu zorunludur.";
    }

    if (!String(createDraft.name ?? "").trim()) {
      return "Konum grubu adı zorunludur.";
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
      const json = await fetch("/api/company-management/location-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createDraft),
      }).then(readJson);

      setItems((prev) => sortLocationGroups([...prev, json.item]));
      setSelectedId(json.item.id);
      setCreateDraft(emptyDraft);
      setEditingId(null);
      setIsCreateFormOpen(false);
      setCreateFormError("");
      router.replace(buildCompanyManagementHref("location-groups"), { scroll: false });
      setEditDraft(emptyDraft);
      flash("success", "Konum grubu oluşturuldu.");
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
      const json = await fetch(`/api/company-management/location-groups/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editDraft),
      }).then(readJson);

      setItems((prev) =>
        sortLocationGroups(
          prev.map((item) => (item.id === itemId ? json.item : item)),
        ),
      );
      setSelectedId(json.item.id);
      setEditingId(null);
      setEditDraft(emptyDraft);
      flash("success", "Konum grubu güncellendi.");
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
      code: selectedItem.code,
      name: selectedItem.name,
    });
  }, [selectedItem]);

  const selectFromHeader = useCallback((id: string) => {
    setSelectedId(id);
    setOpenActionsId(null);
    setCreateFormError("");
    setIsCreateFormOpen(false);
    setEditingId(null);
    setEditDraft(emptyDraft);
  }, []);

  const closeActions = useCallback(() => {
    setOpenActionsId(null);
    setSelectedId("");
    setIsCreateFormOpen(false);
    setEditingId(null);
    setEditDraft(emptyDraft);
    setCreateDraft(emptyDraft);
    setCreateFormError("");
    router.replace(buildCompanyManagementHref("location-groups"), { scroll: false });
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
    setCreateDraft(emptyDraft);
    setIsCreateFormOpen(true);
  }, []);

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

  async function deleteItem(item: LocationGroup) {
    if (!canWrite || saving) return;

    setSaving(true);
    try {
      await fetch(`/api/company-management/location-groups/${item.id}`, {
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
      setEditDraft(emptyDraft);
      setDeleteTarget(null);
      flash("success", "Konum grubu silindi.");
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

  const headerSlot = useMemo(
    () => (
      <LocationGroupHeaderControls
        items={items}
        selectedId={selectedId}
        loading={loading}
        onSelect={selectFromHeader}
      />
    ),
    [
      items,
      loading,
      selectFromHeader,
      selectedId,
    ],
  );

  useEffect(() => {
    setHeaderSlot(headerSlot);
    return () => setHeaderSlot(null);
  }, [headerSlot, setHeaderSlot]);

  const isEditing = Boolean(editingId);
  const isCreating = isCreateFormOpen && !editingId;
  const isViewing = !isCreating && !isEditing && Boolean(selectedItem);
  const formDraft =
    isEditing ? editDraft : isViewing && selectedItem ? selectedItem : createDraft;

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
          <LocationGroupActionsMenu
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
          <LocationGroupReadonlyView item={selectedItem} />
        ) : null}

        {canWrite && (isCreating || isEditing) ? (
          <section className="mx-auto w-full max-w-[360px] rounded-[24px] border border-slate-200 bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <div className="grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-slate-500">
                Kod
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
                placeholder="MERKEZ"
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15 read-only:bg-slate-50 read-only:text-slate-700"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-slate-500">
                Ad
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
                placeholder="Merkez Konum Grubu"
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15 read-only:bg-slate-50 read-only:text-slate-700"
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
                disabled={saving}
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
        title="Bu Konum Grubu silinsin mi?"
        description="Seçili Konum Grubu kaydı kalıcı olarak silinecek. Bu işlem geri alınamaz."
        details={
          deleteTarget
            ? [
                `Kod: ${deleteTarget.code}`,
                `Ad: ${deleteTarget.name}`,
                "Bu gruba bağlı Konum kayıtları varsa grup bağlantıları kaldırılabilir.",
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