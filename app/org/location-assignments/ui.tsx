"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Tone = "neutral" | "info" | "good" | "warn" | "danger" | "violet";

type Branch = { id: string; code: string; name: string; isActive?: boolean };
type Group = { id: string; code: string; name: string };
type Subgroup = { id: string; code: string; name: string; groupId: string; group?: { id?: string; code: string; name: string } | null };

type EmployeeItem = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  branchId: string | null;
  employeeGroupId: string | null;
  employeeSubgroupId: string | null;
  branch: { id: string; code: string; name: string } | null;
  employeeGroup: { id: string; code: string; name: string } | null;
  employeeSubgroup: { id: string; code: string; name: string; groupId: string } | null;
};

type EmployeesResponse = {
  items: EmployeeItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  effectiveDayKey: string;
  error?: string;
};

type TargetMode = "selected" | "filter";
type EmploymentStatus = "all" | "active" | "passive";

type FiltersPayload = {
  q: string;
  branchId: string | null;
  groupId: string | null;
  subgroupId: string | null;
  employmentStatus: EmploymentStatus;
};

type PreviewSummary = {
  requested: number;
  found: number;
  changed: number;
  unchanged: number;
  rejected: number;
};

type PreviewEmployee = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  effectiveBranchId: string | null;
};

type PreviewRejectedEmployee = {
  employeeId: string;
  employeeCode: string | null;
  fullName: string;
  code: string;
  message: string;
};

type PreviewResponse = {
  summary: PreviewSummary;
  changedEmployeeIds: string[];
  unchangedEmployeeIds: string[];
  rejectedEmployees: PreviewRejectedEmployee[];
  changedEmployeesPreview: PreviewEmployee[];
  unchangedEmployeesPreview: PreviewEmployee[];
  targetMode: TargetMode;
  effectiveDayKey: string;
  targetBranch: Branch;
  error?: string;
};

type ApplyRejectedEmployee = {
  employeeId: string;
  code: string;
  message: string;
};

type ApplyResponse = {
  summary: PreviewSummary;
  changedEmployeeIds: string[];
  unchangedEmployeeIds: string[];
  rejectedEmployees: ApplyRejectedEmployee[];
  targetMode: TargetMode;
  effectiveDayKey: string;
  targetBranch: Branch;
  error?: string;
};

type Flash = { kind: "success" | "error" | "info"; text: string } | null;

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-800 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function toneClasses(tone: Tone) {
  switch (tone) {
    case "info":
      return "border-sky-200/70 bg-sky-50/70 text-sky-900";
    case "good":
      return "border-emerald-200/70 bg-emerald-50/70 text-emerald-900";
    case "warn":
      return "border-amber-200/70 bg-amber-50/70 text-amber-900";
    case "danger":
      return "border-rose-200/70 bg-rose-50/70 text-rose-900";
    case "violet":
      return "border-violet-200/70 bg-violet-50/70 text-violet-900";
    default:
      return "border-zinc-200/70 bg-white text-zinc-900";
  }
}

function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-bold uppercase tracking-tight shadow-sm",
        toneClasses(tone)
      )}
    >
      {children}
    </span>
  );
}

function Button({
  variant = "secondary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60";
  const styles =
    variant === "primary"
      ? "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
      : variant === "danger"
      ? "bg-rose-600 text-white shadow-sm hover:bg-rose-700"
      : variant === "ghost"
      ? "border border-transparent bg-transparent text-zinc-700 hover:bg-zinc-100"
      : "border border-zinc-200 bg-white text-zinc-800 shadow-sm hover:bg-zinc-50";
  return <button {...props} className={cx(base, styles, className)} />;
}

function fullName(item: Pick<EmployeeItem, "firstName" | "lastName">) {
  return `${item.firstName ?? ""} ${item.lastName ?? ""}`.trim();
}

function roleTone(role: string): Tone {
  if (role === "SYSTEM_ADMIN") return "good";
  if (role === "HR_CONFIG_ADMIN") return "violet";
  if (role === "HR_OPERATOR") return "warn";
  return "neutral";
}

function selectedIdsFromMap(map: Record<string, boolean>): string[] {
  return Object.entries(map)
    .filter(([, value]) => Boolean(value))
    .map(([id]) => id);
}

function branchLabel(branch: Branch | { code: string; name: string } | null | undefined) {
  if (!branch) return "Lokasyon yok";
  return `${branch.code} • ${branch.name}`;
}

function employeeLabel(employee: { employeeCode: string | null; fullName: string }) {
  const code = (employee.employeeCode ?? "").trim();
  const name = (employee.fullName ?? "").trim();
  if (code && name) return `${code} • ${name}`;
  return code || name || "Personel";
}

export default function LocationAssignmentsClient(props: { canWrite: boolean; role: string }) {
  const { canWrite, role } = props;

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subgroups, setSubgroups] = useState<Subgroup[]>([]);

  const [items, setItems] = useState<EmployeeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [qDraft, setQDraft] = useState("");
  const [q, setQ] = useState("");
  const [branchId, setBranchId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [subgroupId, setSubgroupId] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus>("active");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [effectiveDayKey, setEffectiveDayKey] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [targetBranchId, setTargetBranchId] = useState("");
  const [targetMode, setTargetMode] = useState<TargetMode>("selected");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResponse | null>(null);

  const selectedIds = useMemo(() => selectedIdsFromMap(selected), [selected]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const subgroupsByGroupId = useMemo(() => {
    const map = new Map<string, Subgroup[]>();
    for (const item of subgroups) {
      const current = map.get(item.groupId) ?? [];
      current.push(item);
      map.set(item.groupId, current);
    }
    for (const [key, value] of map.entries()) {
      value.sort((a, b) => a.code.localeCompare(b.code, "tr-TR"));
      map.set(key, value);
    }
    return map;
  }, [subgroups]);

  const visibleSubgroups = useMemo(() => {
    if (!groupId) return subgroups;
    return subgroupsByGroupId.get(groupId) ?? [];
  }, [groupId, subgroups, subgroupsByGroupId]);

  const targetBranch = useMemo(
    () => branches.find((item) => item.id === targetBranchId) ?? null,
    [branches, targetBranchId]
  );

  const filtersPayload = useMemo<FiltersPayload>(
    () => ({
      q: q.trim(),
      branchId: branchId || null,
      groupId: groupId || null,
      subgroupId: subgroupId || null,
      employmentStatus,
    }),
    [q, branchId, groupId, subgroupId, employmentStatus]
  );

  const allPageSelected = useMemo(() => items.length > 0 && items.every((item) => selectedIdSet.has(item.id)), [items, selectedIdSet]);

  useEffect(() => {
    let cancelled = false;

    async function loadMeta() {
      setLoadingMeta(true);
      try {
        const [branchRes, groupRes, subgroupRes] = await Promise.all([
          fetch("/api/org/branches", { cache: "no-store", credentials: "include" }),
          fetch("/api/workforce/groups", { cache: "no-store", credentials: "include" }),
          fetch("/api/workforce/subgroups", { cache: "no-store", credentials: "include" }),
        ]);

        const [branchJson, groupJson, subgroupJson] = await Promise.all([
          branchRes.json().catch(() => []),
          groupRes.json().catch(() => []),
          subgroupRes.json().catch(() => []),
        ]);

        if (cancelled) return;

        const branchItems = Array.isArray(branchJson) ? branchJson : [];
        const groupItems = Array.isArray(groupJson?.items) ? groupJson.items : Array.isArray(groupJson) ? groupJson : [];
        const subgroupItems = Array.isArray(subgroupJson?.items) ? subgroupJson.items : Array.isArray(subgroupJson) ? subgroupJson : [];

        setBranches(branchItems);
        setGroups(groupItems);
        setSubgroups(subgroupItems);
        if (!targetBranchId && branchItems.length > 0) {
          const firstActive = branchItems.find((item: Branch) => item.isActive !== false) ?? branchItems[0];
          setTargetBranchId(firstActive?.id ?? "");
        }
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    }

    loadMeta();
    return () => {
      cancelled = true;
    };
  }, [targetBranchId]);

  useEffect(() => {
    let cancelled = false;

    async function loadList() {
      setLoadingList(true);
      try {
        const sp = new URLSearchParams();
        if (q.trim()) sp.set("q", q.trim());
        if (branchId) sp.set("branchId", branchId);
        if (groupId) sp.set("groupId", groupId);
        if (subgroupId) sp.set("subgroupId", subgroupId);
        sp.set("employmentStatus", employmentStatus);
        sp.set("effectiveDayKey", effectiveDayKey);
        sp.set("page", String(page));
        sp.set("pageSize", String(pageSize));

        const res = await fetch(`/api/org/location-assignments/employees?${sp.toString()}`, {
          cache: "no-store",
          credentials: "include",
        });
        const json: EmployeesResponse = await res.json().catch(() => ({
          items: [],
          page,
          pageSize,
          total: 0,
          totalPages: 1,
          effectiveDayKey,
          error: "LIST_LOAD_FAILED",
        } as EmployeesResponse));

        if (cancelled) return;

        if (!res.ok) {
          throw new Error(json?.error || "LIST_LOAD_FAILED");
        }

        setItems(Array.isArray(json.items) ? json.items : []);
        setTotal(Number(json.total ?? 0));
        setTotalPages(Math.max(1, Number(json.totalPages ?? 1)));
        if (json.effectiveDayKey && json.effectiveDayKey !== effectiveDayKey) {
          setEffectiveDayKey(json.effectiveDayKey);
        }
      } catch (err) {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
        setTotalPages(1);
        setFlash({ kind: "error", text: humanizeError(err instanceof Error ? err.message : "LIST_LOAD_FAILED") });
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    }

    loadList();
    return () => {
      cancelled = true;
    };
  }, [q, branchId, groupId, subgroupId, employmentStatus, effectiveDayKey, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [q, branchId, groupId, subgroupId, employmentStatus, pageSize]);

  useEffect(() => {
    setPreview(null);
    setApplyResult(null);
  }, [targetMode, targetBranchId, effectiveDayKey, q, branchId, groupId, subgroupId, employmentStatus, selectedIds.length]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 3500);
    return () => window.clearTimeout(t);
  }, [flash]);

  function setAllCurrentPage(checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (checked) next[item.id] = true;
        else delete next[item.id];
      }
      return next;
    });
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) next[id] = true;
      else delete next[id];
      return next;
    });
  }

  function resetSelection() {
    setSelected({});
  }

  async function runPreview() {
    if (!canWrite) {
      setFlash({ kind: "info", text: "Bu ekran read-only. Önizleme ve uygulama için konfigürasyon yazma yetkisi gerekir." });
      return;
    }
    if (!targetBranchId) {
      setFlash({ kind: "error", text: "Hedef lokasyon seçilmelidir." });
      return;
    }
    if (targetMode === "selected" && selectedIds.length === 0) {
      setFlash({ kind: "error", text: "Seçili modda en az bir personel seçilmelidir." });
      return;
    }

    setPreviewBusy(true);
    setApplyResult(null);
    try {
      const res = await fetch("/api/org/location-assignments/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          targetMode,
          targetBranchId,
          effectiveDayKey,
          employeeIds: targetMode === "selected" ? selectedIds : [],
          filters: targetMode === "filter" ? filtersPayload : null,
        }),
      });
      const json: PreviewResponse = await res.json().catch(() => ({ error: "PREVIEW_FAILED" } as PreviewResponse));
      if (!res.ok) {
        throw new Error(json?.error || "PREVIEW_FAILED");
      }
      setPreview(json);
      setFlash({ kind: "success", text: "Önizleme hesaplandı. History-safe etki özeti hazır." });
    } catch (err) {
      setPreview(null);
      setFlash({ kind: "error", text: humanizeError(err instanceof Error ? err.message : "PREVIEW_FAILED") });
    } finally {
      setPreviewBusy(false);
    }
  }

  async function applyChanges() {
    if (!canWrite) return;
    if (!preview) {
      setFlash({ kind: "error", text: "Önce önizleme alınmalıdır." });
      return;
    }
    const confirmText = `Lokasyon değişikliği uygulanacak.\nEtkili tarih: ${effectiveDayKey}\nHedef lokasyon: ${branchLabel(targetBranch)}\nDeğişecek kişi: ${preview.summary.changed}`;
    if (!window.confirm(confirmText)) return;

    setApplyBusy(true);
    try {
      const res = await fetch("/api/org/location-assignments/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          targetMode,
          targetBranchId,
          effectiveDayKey,
          employeeIds: targetMode === "selected" ? selectedIds : [],
          filters: targetMode === "filter" ? filtersPayload : null,
        }),
      });
      const json: ApplyResponse = await res.json().catch(() => ({ error: "APPLY_FAILED" } as ApplyResponse));
      if (!res.ok) {
        throw new Error(json?.error || "APPLY_FAILED");
      }
      setApplyResult(json);
      setPreview(null);
      setFlash({
        kind: "success",
        text: `Toplu lokasyon atama tamamlandı. Değişen: ${json.summary.changed}, değişmeyen: ${json.summary.unchanged}, reddedilen: ${json.summary.rejected}.`,
      });
      resetSelection();
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      if (branchId) sp.set("branchId", branchId);
      if (groupId) sp.set("groupId", groupId);
      if (subgroupId) sp.set("subgroupId", subgroupId);
      sp.set("employmentStatus", employmentStatus);
      sp.set("effectiveDayKey", effectiveDayKey);
      sp.set("page", String(page));
      sp.set("pageSize", String(pageSize));
      await fetch(`/api/org/location-assignments/employees?${sp.toString()}`, {
        cache: "no-store",
        credentials: "include",
      }).catch(() => null);
      setPage(1);
    } catch (err) {
      setFlash({ kind: "error", text: humanizeError(err instanceof Error ? err.message : "APPLY_FAILED") });
    } finally {
      setApplyBusy(false);
    }
  }

  const summaryCards = useMemo(
    () => [
      { label: "Toplam eşleşen", value: total, tone: "neutral" as Tone, hint: "Filtrelere göre listelenen personel" },
      { label: "Seçili personel", value: selectedIds.length, tone: "info" as Tone, hint: "Seçili modda uygulanacak adaylar" },
      { label: "Hedef lokasyon", value: targetBranch ? targetBranch.code : "—", tone: "violet" as Tone, hint: targetBranch ? targetBranch.name : "Henüz seçilmedi" },
      { label: "Etkili tarih", value: effectiveDayKey, tone: "warn" as Tone, hint: "History-safe org assignment başlangıcı" },
    ],
    [total, selectedIds.length, targetBranch, effectiveDayKey]
  );

  return (
    <div className="grid gap-4 min-w-0">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={roleTone(role)}>{role}</Badge>
              <Badge tone={canWrite ? "good" : "warn"}>{canWrite ? "Yazma açık" : "Read-only"}</Badge>
              <Badge tone="info">Org modülü</Badge>
            </div>
            <h1 className="mt-3 text-xl font-semibold tracking-tight text-zinc-950">Toplu lokasyon geçiş operasyonu</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-600">
              Bu ekran employee list üzerinde shortcut branch write yapmaz. İşlem, <span className="font-semibold text-zinc-900">EmployeeOrgAssignment</span> history kaydı açarak ve current-state mirror’ı güvenli biçimde senkronlayarak ilerler.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/org"
              className="inline-flex items-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
            >
              Organizasyon ana ekranı
            </Link>
            <Link
              href="/employees"
              className="inline-flex items-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
            >
              Çalışan listesine dön
            </Link>
          </div>
        </div>
      </div>

      {!canWrite ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm">
          <div className="text-sm font-semibold">Read-only mod</div>
          <div className="mt-1 text-sm leading-6 text-amber-800">
            Bu ekranda filtreleme ve inceleme yapabilirsin. Önizleme ve uygulama için <span className="font-semibold">SYSTEM_ADMIN</span> veya <span className="font-semibold">HR_CONFIG_ADMIN</span> yetkisi gerekir.
          </div>
        </div>
      ) : null}

      {flash ? (
        <div
          className={cx(
            "rounded-2xl border px-4 py-3 text-sm shadow-sm",
            flash.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : flash.kind === "error"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : "border-sky-200 bg-sky-50 text-sky-900"
          )}
        >
          {flash.text}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className={cx("rounded-2xl border p-4 shadow-sm", toneClasses(card.tone))}>
            <div className="text-xs font-semibold uppercase tracking-tight opacity-80">{card.label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{card.value}</div>
            <div className="mt-1 text-xs opacity-80">{card.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.95fr)]">
        <div className="grid gap-4 min-w-0">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-zinc-950">Aday personel filtresi</div>
                <div className="mt-1 text-sm text-zinc-600">Filtreler, seçili veya filtreli hedef kümenin sınırını belirler.</div>
              </div>
              <Badge tone="neutral">Liste sayfası: {page} / {totalPages}</Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-tight text-zinc-600">Arama</span>
                <input
                  className={inputClass}
                  value={qDraft}
                  onChange={(e) => setQDraft(e.target.value)}
                  placeholder="Kod, ad, soyad, TC, telefon…"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-tight text-zinc-600">Mevcut lokasyon filtresi</span>
                <select className={inputClass} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  <option value="">Tüm lokasyonlar</option>
                  {branches.map((item) => (
                    <option key={item.id} value={item.id}>
                      {branchLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-tight text-zinc-600">Segment</span>
                <select
                  className={inputClass}
                  value={groupId}
                  onChange={(e) => {
                    setGroupId(e.target.value);
                    setSubgroupId("");
                  }}
                >
                  <option value="">Tüm segmentler</option>
                  {groups.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} • {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-tight text-zinc-600">Alt segment</span>
                <select className={inputClass} value={subgroupId} onChange={(e) => setSubgroupId(e.target.value)}>
                  <option value="">Tüm alt segmentler</option>
                  {visibleSubgroups.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} • {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-tight text-zinc-600">İstihdam durumu</span>
                <select className={inputClass} value={employmentStatus} onChange={(e) => setEmploymentStatus(e.target.value as EmploymentStatus)}>
                  <option value="active">Aktif</option>
                  <option value="passive">Pasif</option>
                  <option value="all">Tümü</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-tight text-zinc-600">Sayfa boyutu</span>
                <select className={inputClass} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  setQ(qDraft.trim());
                  setPage(1);
                }}
              >
                Listeyi uygula
              </Button>
              <Button
                onClick={() => {
                  setQDraft("");
                  setQ("");
                  setBranchId("");
                  setGroupId("");
                  setSubgroupId("");
                  setEmploymentStatus("active");
                  setPage(1);
                }}
              >
                Filtreleri temizle
              </Button>
              <div className="text-sm text-zinc-500">Etkili tarihte aktif/pasif filtrelemesi liste kararına dâhil edilir.</div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-zinc-950">Personel listesi</div>
                <div className="mt-1 text-sm text-zinc-600">Çalışanlar modülündeki toplu write sorumluluğu buraya taşındı; burada seçim yapılır, employee list ekranında değil.</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">Toplam: {total}</Badge>
                <Badge tone="info">Seçili: {selectedIds.length}</Badge>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button onClick={() => setAllCurrentPage(!allPageSelected)} disabled={items.length === 0}>
                {allPageSelected ? "Bu sayfayı bırak" : "Bu sayfayı seç"}
              </Button>
              <Button onClick={resetSelection} disabled={selectedIds.length === 0}>
                Seçimi sıfırla
              </Button>
              <div className="text-sm text-zinc-500">Filtreli modda seçim zorunlu değildir; seçili modda seçili personeller uygulanır.</div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-zinc-200">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-3 py-3 text-left font-semibold text-zinc-600">Seç</th>
                    <th className="px-3 py-3 text-left font-semibold text-zinc-600">Personel</th>
                    <th className="px-3 py-3 text-left font-semibold text-zinc-600">Mevcut lokasyon</th>
                    <th className="px-3 py-3 text-left font-semibold text-zinc-600">Segment</th>
                    <th className="px-3 py-3 text-left font-semibold text-zinc-600">Alt segment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {loadingList ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                        Personel listesi yükleniyor…
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                        Bu filtrelerle eşleşen personel bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className={selectedIdSet.has(item.id) ? "bg-indigo-50/30" : undefined}>
                        <td className="px-3 py-3 align-top">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-zinc-300 text-indigo-600"
                            checked={selectedIdSet.has(item.id)}
                            onChange={(e) => toggleOne(item.id, e.target.checked)}
                          />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="font-semibold text-zinc-950">{item.employeeCode} • {fullName(item)}</div>
                          <div className="mt-1 text-xs text-zinc-500">ID: {item.id}</div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="font-medium text-zinc-900">{branchLabel(item.branch)}</div>
                        </td>
                        <td className="px-3 py-3 align-top text-zinc-700">{item.employeeGroup ? `${item.employeeGroup.code} • ${item.employeeGroup.name}` : "—"}</td>
                        <td className="px-3 py-3 align-top text-zinc-700">{item.employeeSubgroup ? `${item.employeeSubgroup.code} • ${item.employeeSubgroup.name}` : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-zinc-500">Sayfa bazlı seçim mevcut liste üzerinde tutulur. Filtreli mod ayrı olarak tüm filtre kümesini hedefleyebilir.</div>
              <div className="flex items-center gap-2">
                <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loadingList}>
                  Önceki
                </Button>
                <span className="text-sm text-zinc-600">{page} / {totalPages}</span>
                <Button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loadingList}>
                  Sonraki
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 min-w-0">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <div className="text-lg font-semibold text-zinc-950">Toplu uygulama ayarları</div>
              <div className="mt-1 text-sm text-zinc-600">Önizleme ve uygulama aynı payload üzerinden gider; böylece preview/apply farkı oluşmaz.</div>
            </div>

            <div className="grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-tight text-zinc-600">Uygulama modu</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={cx(
                      "rounded-xl border px-3 py-2 text-sm font-semibold transition",
                      targetMode === "selected"
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                    )}
                    onClick={() => setTargetMode("selected")}
                  >
                    Seçili personeller
                  </button>
                  <button
                    type="button"
                    className={cx(
                      "rounded-xl border px-3 py-2 text-sm font-semibold transition",
                      targetMode === "filter"
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                    )}
                    onClick={() => setTargetMode("filter")}
                  >
                    Filtre sonucu küme
                  </button>
                </div>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-tight text-zinc-600">Hedef lokasyon</span>
                <select className={inputClass} value={targetBranchId} onChange={(e) => setTargetBranchId(e.target.value)} disabled={loadingMeta}>
                  <option value="">Lokasyon seç</option>
                  {branches
                    .filter((item) => item.isActive !== false)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {branchLabel(item)}
                      </option>
                    ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-tight text-zinc-600">Etkili tarih</span>
                <input
                  type="date"
                  className={inputClass}
                  value={effectiveDayKey}
                  onChange={(e) => setEffectiveDayKey(e.target.value)}
                />
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 text-sm text-indigo-950">
              <div className="font-semibold">Uygulanacak küme özeti</div>
              <div className="mt-2 grid gap-2 text-sm text-indigo-900">
                <div>Mod: <span className="font-semibold">{targetMode === "selected" ? "Seçili personeller" : "Filtre sonucu"}</span></div>
                <div>Seçili kişi: <span className="font-semibold">{selectedIds.length}</span></div>
                <div>Filtre eşleşen kişi: <span className="font-semibold">{total}</span></div>
                <div>Hedef lokasyon: <span className="font-semibold">{branchLabel(targetBranch)}</span></div>
                <div>Etkili tarih: <span className="font-semibold">{effectiveDayKey}</span></div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" onClick={runPreview} disabled={previewBusy || applyBusy || !canWrite}>
                {previewBusy ? "Önizleme hesaplanıyor…" : "Önizleme al"}
              </Button>
              <Button variant="danger" onClick={applyChanges} disabled={!preview || previewBusy || applyBusy || !canWrite}>
                {applyBusy ? "Uygulanıyor…" : "Değişikliği uygula"}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-zinc-950">Önizleme sonucu</div>
                <div className="mt-1 text-sm text-zinc-600">Effective-date bağlamına göre değişecek / değişmeyecek / reddedilecek personeller.</div>
              </div>
              {preview ? <Badge tone="good">Hazır</Badge> : <Badge tone="neutral">Henüz yok</Badge>}
            </div>

            {!preview ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
                Önizleme alınca history-aware özet burada görünecek.
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-tight text-zinc-600">İstendi</div>
                    <div className="mt-1 text-2xl font-semibold text-zinc-950">{preview.summary.requested}</div>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-tight text-emerald-700">Değişecek</div>
                    <div className="mt-1 text-2xl font-semibold text-emerald-950">{preview.summary.changed}</div>
                  </div>
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-tight text-sky-700">Değişmeyecek</div>
                    <div className="mt-1 text-2xl font-semibold text-sky-950">{preview.summary.unchanged}</div>
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-tight text-amber-700">Bulunan</div>
                    <div className="mt-1 text-2xl font-semibold text-amber-950">{preview.summary.found}</div>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-tight text-rose-700">Reddedilen</div>
                    <div className="mt-1 text-2xl font-semibold text-rose-950">{preview.summary.rejected}</div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                    <div className="text-sm font-semibold text-emerald-950">Değişecek örnekler</div>
                    <div className="mt-3 space-y-2 text-sm text-emerald-900">
                      {preview.changedEmployeesPreview.length === 0 ? (
                        <div>Bu payload için değişecek kişi yok.</div>
                      ) : (
                        preview.changedEmployeesPreview.slice(0, 8).map((item) => (
                          <div key={item.employeeId} className="rounded-xl border border-emerald-200 bg-white/70 px-3 py-2">
                            {employeeLabel(item)}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4">
                    <div className="text-sm font-semibold text-sky-950">Değişmeyecek örnekler</div>
                    <div className="mt-3 space-y-2 text-sm text-sky-900">
                      {preview.unchangedEmployeesPreview.length === 0 ? (
                        <div>No-op personel yok.</div>
                      ) : (
                        preview.unchangedEmployeesPreview.slice(0, 8).map((item) => (
                          <div key={item.employeeId} className="rounded-xl border border-sky-200 bg-white/70 px-3 py-2">
                            {employeeLabel(item)}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
                    <div className="text-sm font-semibold text-rose-950">Reddedilen örnekler</div>
                    <div className="mt-3 space-y-2 text-sm text-rose-900">
                      {preview.rejectedEmployees.length === 0 ? (
                        <div>Reddedilen personel yok.</div>
                      ) : (
                        preview.rejectedEmployees.slice(0, 8).map((item) => (
                          <div key={`${item.employeeId}-${item.code}`} className="rounded-xl border border-rose-200 bg-white/70 px-3 py-2">
                            <div className="font-medium">{employeeLabel(item)}</div>
                            <div className="mt-1 text-xs">{item.message}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {applyResult ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
              <div className="text-lg font-semibold text-emerald-950">Uygulama sonucu</div>
              <div className="mt-2 text-sm text-emerald-900">
                Hedef lokasyon <span className="font-semibold">{branchLabel(applyResult.targetBranch)}</span> için {applyResult.effectiveDayKey} tarihli toplu geçiş tamamlandı.
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-emerald-200 bg-white/80 p-3">
                  <div className="text-xs font-semibold uppercase tracking-tight text-emerald-700">Değişen</div>
                  <div className="mt-1 text-2xl font-semibold text-emerald-950">{applyResult.summary.changed}</div>
                </div>
                <div className="rounded-2xl border border-sky-200 bg-white/80 p-3">
                  <div className="text-xs font-semibold uppercase tracking-tight text-sky-700">Değişmeyen</div>
                  <div className="mt-1 text-2xl font-semibold text-sky-950">{applyResult.summary.unchanged}</div>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-white/80 p-3">
                  <div className="text-xs font-semibold uppercase tracking-tight text-rose-700">Reddedilen</div>
                  <div className="mt-1 text-2xl font-semibold text-rose-950">{applyResult.summary.rejected}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function humanizeError(value: string): string {
  const code = String(value ?? "").trim().toUpperCase();
  const map: Record<string, string> = {
    EFFECTIVE_DAY_KEY_REQUIRED: "Etkili tarih zorunludur.",
    TARGET_BRANCH_REQUIRED: "Hedef lokasyon seçilmelidir.",
    BRANCH_NOT_FOUND: "Hedef lokasyon bulunamadı veya pasif durumda.",
    TOO_MANY_EMPLOYEES: "Filtre sonucu çok geniş. Önce küme daraltılmalıdır.",
    LIST_LOAD_FAILED: "Personel listesi yüklenemedi.",
    PREVIEW_FAILED: "Önizleme alınamadı.",
    APPLY_FAILED: "Toplu lokasyon atama uygulanamadı.",
    FORBIDDEN: "Bu işlem için yetkin yok.",
    UNAUTHORIZED: "Oturum doğrulaması gerekiyor.",
  };
  return map[code] ?? value;
}