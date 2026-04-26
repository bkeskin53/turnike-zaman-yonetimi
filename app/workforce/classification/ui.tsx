"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Group = { id: string; code: string; name: string };
type Subgroup = { id: string; code: string; name: string; groupId: string; group: { code: string; name: string } };
type Branch = { id: string; code: string; name: string; isActive?: boolean };

type EmployeeItem = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  branch?: { id?: string; code: string; name: string } | null;
  employeeGroupId: string | null;
  employeeSubgroupId: string | null;
  employeeGroup?: { code: string; name: string } | null;
  employeeSubgroup?: { code: string; name: string; groupId: string } | null;
};

type EmployeeRowItem = EmployeeItem & {
  draftGroupId: string;
  draftSubgroupId: string;
};

type AssignmentStatus = "all" | "assigned" | "unassigned";

type EmployeesResponse = {
  items: EmployeeItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type DraftState = {
  employeeGroupId: string;
  employeeSubgroupId: string;
};

type SaveSummary = {
  tone: Tone;
  title: string;
  lines: string[];
};

type BulkTargetMode = "selected" | "filter";

type BulkFiltersPayload = {
  q: string;
  branchId: string | null;
  groupId: string | null;
  subgroupId: string | null;
  assignmentStatus: AssignmentStatus;
};

type BulkResponse = {
  summary?: {
    requested?: number;
    found?: number;
    updated?: number;
    unchanged?: number;
    missing?: number;
  };
  error?: string;
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type Tone = "neutral" | "info" | "good" | "warn" | "violet" | "danger";

function toneStyles(tone: Tone) {
  switch (tone) {
    case "info":
      return {
        chip: "bg-sky-50 text-sky-800 ring-sky-200/70",
        soft: "border-sky-200/70 bg-gradient-to-b from-white to-sky-50/40",
        solid: "bg-sky-600 text-white ring-sky-500/30",
      };
    case "good":
      return {
        chip: "bg-emerald-50 text-emerald-800 ring-emerald-200/70",
        soft: "border-emerald-200/70 bg-gradient-to-b from-white to-emerald-50/35",
        solid: "bg-emerald-600 text-white ring-emerald-500/30",
      };
    case "warn":
      return {
        chip: "bg-amber-50 text-amber-900 ring-amber-200/70",
        soft: "border-amber-200/70 bg-gradient-to-b from-white to-amber-50/45",
        solid: "bg-amber-600 text-white ring-amber-500/30",
      };
    case "violet":
      return {
        chip: "bg-violet-50 text-violet-800 ring-violet-200/70",
        soft: "border-violet-200/70 bg-gradient-to-b from-white to-violet-50/40",
        solid: "bg-violet-600 text-white ring-violet-500/30",
      };
    case "danger":
      return {
        chip: "bg-red-50 text-red-800 ring-red-200/70",
        soft: "border-red-200/70 bg-gradient-to-b from-white to-red-50/40",
        solid: "bg-red-600 text-white ring-red-500/30",
      };
    default:
      return {
        chip: "bg-zinc-100 text-zinc-700 ring-zinc-200/70",
        soft: "border-zinc-200/70 bg-white",
        solid: "bg-zinc-900 text-white ring-zinc-800/30",
      };
  }
}

function PillBadge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  const t = toneStyles(tone);
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-tight ring-1 ring-inset shadow-sm",
        t.chip
      )}
    >
      {children}
    </span>
  );
}

function Button({
  variant = "secondary",
  disabled,
  onClick,
  children,
  title,
}: {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
      : variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-700 shadow-sm"
      : variant === "ghost"
      ? "bg-transparent text-zinc-700 hover:bg-zinc-100"
      : "border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 shadow-sm";
  return (
    <button className={cx(base, styles)} onClick={onClick} disabled={disabled} title={title} type="button">
      {children}
    </button>
  );
}

function LinkButton({
  href,
  title,
  children,
}: {
  href: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
      href={href}
      title={title}
    >
      {children}
      <span aria-hidden className="text-zinc-400">
        →
      </span>
    </Link>
  );
}

function roleLabel(role: string) {
  switch (role) {
    case "SYSTEM_ADMIN":
    case "HR_CONFIG_ADMIN":
    case "HR_OPERATOR":
    case "SUPERVISOR":
      return role;
    default:
      return role || "UNKNOWN";
  }
}

function fullName(e: EmployeeItem) {
  return `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim();
}

export default function WorkforceClassificationClient(props: { canWrite: boolean; role: string }) {
  const { canWrite, role } = props;

  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subgroups, setSubgroups] = useState<Subgroup[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [savingRows, setSavingRows] = useState(false);
  const [savingBulk, setSavingBulk] = useState(false);

  const [q, setQ] = useState("");
  const [queryDraft, setQueryDraft] = useState("");
  const [branchId, setBranchId] = useState("");
  const [groupFilterId, setGroupFilterId] = useState("");
  const [subgroupFilterId, setSubgroupFilterId] = useState("");
  const [assignmentStatus, setAssignmentStatus] = useState<AssignmentStatus>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<SaveSummary | null>(null);

  const [bulkGroupId, setBulkGroupId] = useState("");
  const [bulkSubgroupId, setBulkSubgroupId] = useState("");
  const [bulkTargetMode, setBulkTargetMode] = useState<BulkTargetMode>("selected");

  const firstLoadDoneRef = useRef(false);

  const busy = loadingList || loadingMeta || savingRows || savingBulk;

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const subgroupsByGroupId = useMemo(() => {
    const m = new Map<string, Subgroup[]>();
    for (const sg of subgroups) {
      const arr = m.get(sg.groupId) ?? [];
      arr.push(sg);
      m.set(sg.groupId, arr);
    }
    for (const [k, arr] of m) {
      arr.sort((a, b) => a.code.localeCompare(b.code));
      m.set(k, arr);
    }
    return m;
  }, [subgroups]);

  const currentFilterSubgroups = useMemo(() => {
    if (!groupFilterId) return subgroups;
    return subgroupsByGroupId.get(groupFilterId) ?? [];
  }, [groupFilterId, subgroups, subgroupsByGroupId]);

  const bulkSubgroups = useMemo(() => {
    if (!bulkGroupId) return [];
    return subgroupsByGroupId.get(bulkGroupId) ?? [];
  }, [bulkGroupId, subgroupsByGroupId]);

  const rowsWithDraft = useMemo<EmployeeRowItem[]>(() => {
    return employees.map((e) => {
      const draft = drafts[e.id];
      return {
        ...e,
        draftGroupId: draft?.employeeGroupId ?? (e.employeeGroupId ?? ""),
        draftSubgroupId: draft?.employeeSubgroupId ?? (e.employeeSubgroupId ?? ""),
      };
    });
  }, [employees, drafts]);

  const dirtyCount = useMemo(() => {
    let count = 0;
    for (const e of employees) {
      const draft = drafts[e.id];
      if (!draft) continue;
      const baseGroupId = e.employeeGroupId ?? "";
      const baseSubgroupId = e.employeeSubgroupId ?? "";
      if (draft.employeeGroupId !== baseGroupId || draft.employeeSubgroupId !== baseSubgroupId) {
        count += 1;
      }
    }
    return count;
  }, [drafts, employees]);

  const assignedCount = useMemo(() => {
    let n = 0;
    for (const e of rowsWithDraft) {
      if (e.draftGroupId || e.draftSubgroupId) n += 1;
    }
    return n;
  }, [rowsWithDraft]);

  const pageSelectedCount = useMemo(() => {
    let n = 0;
    for (const e of employees) {
      if (selectedIdSet.has(e.id)) n += 1;
    }
    return n;
  }, [employees, selectedIdSet]);

  const allPageSelected = employees.length > 0 && pageSelectedCount === employees.length;
  const somePageSelected = pageSelectedCount > 0 && pageSelectedCount < employees.length;

  const effectiveTargetCount = bulkTargetMode === "filter" ? total : selectedIds.length;

  function buildBulkFiltersPayload(): BulkFiltersPayload {
    return {
      q: q.trim(),
      branchId: branchId || null,
      groupId: groupFilterId || null,
      subgroupId: subgroupFilterId || null,
      assignmentStatus,
    };
  }

  function enterFilterTargetMode() {
    setBulkTargetMode("filter");
    setSelectedIds([]);
  }
  function enterSelectedTargetMode() {
    setBulkTargetMode("selected");
  }

  async function loadMeta() {
    setLoadingMeta(true);
    try {
      const [gRes, sgRes, bRes] = await Promise.all([
        fetch("/api/workforce/groups", { credentials: "include" }),
        fetch("/api/workforce/subgroups", { credentials: "include" }),
        fetch("/api/org/branches", { credentials: "include" }),
      ]);

      const gJson = await gRes.json().catch(() => null);
      const sgJson = await sgRes.json().catch(() => null);
      const bJson = await bRes.json().catch(() => null);

      setGroups(Array.isArray(gJson?.items) ? gJson.items : []);
      setSubgroups(Array.isArray(sgJson?.items) ? sgJson.items : []);
      setBranches(Array.isArray(bJson) ? bJson : Array.isArray(bJson?.items) ? bJson.items : []);
    } finally {
      setLoadingMeta(false);
    }
  }

  async function loadEmployees(
    next?: Partial<{
      page: number;
      pageSize: number;
      q: string;
      branchId: string;
      groupFilterId: string;
      subgroupFilterId: string;
      assignmentStatus: AssignmentStatus;
    }>
  ) {
    setLoadingList(true);
    try {
      const nextPage = next?.page ?? page;
      const nextPageSize = next?.pageSize ?? pageSize;
      const nextQ = next?.q ?? q;
      const nextBranchId = next?.branchId ?? branchId;
      const nextGroupFilterId = next?.groupFilterId ?? groupFilterId;
      const nextSubgroupFilterId = next?.subgroupFilterId ?? subgroupFilterId;
      const nextAssignmentStatus = next?.assignmentStatus ?? assignmentStatus;

      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("pageSize", String(nextPageSize));
      if (nextQ.trim()) params.set("q", nextQ.trim());
      if (nextBranchId) params.set("branchId", nextBranchId);
      if (nextGroupFilterId) params.set("groupId", nextGroupFilterId);
      if (nextSubgroupFilterId) params.set("subgroupId", nextSubgroupFilterId);
      if (nextAssignmentStatus !== "all") params.set("assignmentStatus", nextAssignmentStatus);

      const res = await fetch(`/api/workforce/classification?${params.toString()}`, {
        credentials: "include",
      });

      const json = (await res.json().catch(() => null)) as EmployeesResponse | { error?: string } | null;

      if (!res.ok) {
        setEmployees([]);
        setTotal(0);
        setTotalPages(1);
        setSummary({
          tone: "danger",
          title: "Liste yüklenemedi",
          lines: [String((json as { error?: string } | null)?.error ?? "server_error")],
        });
        return;
      }

      const nextItems = Array.isArray((json as EmployeesResponse | null)?.items)
        ? (json as EmployeesResponse).items
        : [];

      setEmployees(nextItems);
      setTotal(Number((json as EmployeesResponse | null)?.total ?? 0));
      setTotalPages(Math.max(1, Number((json as EmployeesResponse | null)?.totalPages ?? 1)));
      setPage(Number((json as EmployeesResponse | null)?.page ?? nextPage));
      setPageSize(Number((json as EmployeesResponse | null)?.pageSize ?? nextPageSize));

      const nextPageIdSet = new Set(nextItems.map((e) => e.id));

      if (bulkTargetMode === "selected") {
        setSelectedIds((prev) => prev.filter((id) => nextPageIdSet.has(id)));
      }
      setDrafts((prev) => {
        const nextDrafts: Record<string, DraftState> = {};
        for (const e of nextItems) {
          if (prev[e.id]) nextDrafts[e.id] = prev[e.id];
        }
        return nextDrafts;
      });
      setRowErrors((prev) => {
        const nextErrors: Record<string, string> = {};
        for (const e of nextItems) {
          if (prev[e.id]) nextErrors[e.id] = prev[e.id];
        }
        return nextErrors;
      });
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    if (firstLoadDoneRef.current) return;
    firstLoadDoneRef.current = true;
    loadEmployees({
      page: 1,
      pageSize,
      q,
      branchId,
      groupFilterId,
      subgroupFilterId,
      assignmentStatus,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (queryDraft === q) return;
      setPage(1);
      setQ(queryDraft);
      loadEmployees({
        page: 1,
        q: queryDraft,
      });
    }, 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryDraft]);

  useEffect(() => {
    if (!groupFilterId && subgroupFilterId) {
      setSubgroupFilterId("");
      return;
    }
    if (subgroupFilterId && !currentFilterSubgroups.some((s) => s.id === subgroupFilterId)) {
      setSubgroupFilterId("");
    }
  }, [groupFilterId, subgroupFilterId, currentFilterSubgroups]);

  useEffect(() => {
    if (!bulkGroupId && bulkSubgroupId) {
      setBulkSubgroupId("");
      return;
    }
    if (bulkSubgroupId && !bulkSubgroups.some((s) => s.id === bulkSubgroupId)) {
      setBulkSubgroupId("");
    }
  }, [bulkGroupId, bulkSubgroupId, bulkSubgroups]);

  function clearSummary() {
    setSummary(null);
  }

  function isRowDirty(e: EmployeeItem) {
    const draft = drafts[e.id];
    if (!draft) return false;
    const baseGroupId = e.employeeGroupId ?? "";
    const baseSubgroupId = e.employeeSubgroupId ?? "";
    return draft.employeeGroupId !== baseGroupId || draft.employeeSubgroupId !== baseSubgroupId;
  }

  function getDraftFor(e: EmployeeItem): DraftState {
    return (
      drafts[e.id] ?? {
        employeeGroupId: e.employeeGroupId ?? "",
        employeeSubgroupId: e.employeeSubgroupId ?? "",
      }
    );
  }

  function setDraft(employee: EmployeeItem, next: DraftState) {
    setDrafts((prev) => ({
      ...prev,
      [employee.id]: next,
    }));
    setRowErrors((prev) => {
      if (!prev[employee.id]) return prev;
      const copy = { ...prev };
      delete copy[employee.id];
      return copy;
    });
  }

  function updateDraftGroup(employee: EmployeeItem, nextGroupId: string) {
    const current = getDraftFor(employee);
    const nextSubgroups = nextGroupId ? subgroupsByGroupId.get(nextGroupId) ?? [] : [];
    const nextSubgroupId =
      current.employeeSubgroupId && nextSubgroups.some((s) => s.id === current.employeeSubgroupId)
        ? current.employeeSubgroupId
        : "";

    setDraft(employee, {
      employeeGroupId: nextGroupId,
      employeeSubgroupId: nextGroupId ? nextSubgroupId : "",
    });
  }

  function updateDraftSubgroup(employee: EmployeeItem, nextSubgroupId: string) {
    const current = getDraftFor(employee);

    if (!nextSubgroupId) {
      setDraft(employee, {
        ...current,
        employeeSubgroupId: "",
      });
      return;
    }

    const subgroup = subgroups.find((s) => s.id === nextSubgroupId);
    if (!subgroup) return;

    setDraft(employee, {
      employeeGroupId: subgroup.groupId,
      employeeSubgroupId: subgroup.id,
    });
  }

  function toggleSelectAllPage() {
    if (allPageSelected) {
      const pageIdSet = new Set(employees.map((e) => e.id));
      setBulkTargetMode("selected");
      setSelectedIds((prev) => prev.filter((id) => !pageIdSet.has(id)));
      return;
    }

    setSelectedIds((prev) => {
      const set = new Set(prev);
      for (const e of employees) set.add(e.id);
      setBulkTargetMode("selected");
      return Array.from(set);
    });
  }

  function toggleSelectOne(employeeId: string) {
    setSelectedIds((prev) => {
      const set = new Set(prev);
      setBulkTargetMode("selected");
      if (set.has(employeeId)) set.delete(employeeId);
      else set.add(employeeId);
      return Array.from(set);
    });
  }

  function clearSelection() {
    setBulkTargetMode("selected");
    setSelectedIds([]);
  }

  function clearDrafts() {
    setDrafts({});
    setRowErrors({});
    setSummary({
      tone: "neutral",
      title: "Taslak değişiklikler temizlendi",
      lines: ["Kaydedilmemiş satır değişiklikleri kaldırıldı."],
    });
  }

  async function reloadCurrentPage() {
    await loadEmployees({
      page,
      pageSize,
      q,
      branchId,
      groupFilterId,
      subgroupFilterId,
      assignmentStatus,
    });
  }

  async function saveSingle(employee: EmployeeItem) {
    if (!canWrite) return;
    const draft = getDraftFor(employee);

    const res = await fetch("/api/workforce/classification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        employeeId: employee.id,
        employeeGroupId: draft.employeeGroupId || null,
        employeeSubgroupId: draft.employeeSubgroupId || null,
      }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const message = String(json?.error ?? "save_failed");
      setRowErrors((prev) => ({ ...prev, [employee.id]: message }));
      setSummary({
        tone: "danger",
        title: "Satır kaydedilemedi",
        lines: [`${employee.employeeCode} — ${fullName(employee)} → ${message}`],
      });
      return;
    }

    setRowErrors((prev) => {
      if (!prev[employee.id]) return prev;
      const copy = { ...prev };
      delete copy[employee.id];
      return copy;
    });

    setSummary({
      tone: "good",
      title: "Satır kaydedildi",
      lines: [`${employee.employeeCode} — ${fullName(employee)} başarıyla güncellendi.`],
    });

    await reloadCurrentPage();
  }

  async function saveDirtyRows() {
    if (!canWrite || dirtyCount === 0) return;
    setSavingRows(true);
    clearSummary();

    const dirtyEmployees = employees.filter((e) => isRowDirty(e));
    const nextErrors: Record<string, string> = {};
    let updated = 0;
    let failed = 0;
    const failedLines: string[] = [];

    try {
      for (const employee of dirtyEmployees) {
        const draft = getDraftFor(employee);
        const res = await fetch("/api/workforce/classification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            employeeId: employee.id,
            employeeGroupId: draft.employeeGroupId || null,
            employeeSubgroupId: draft.employeeSubgroupId || null,
          }),
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const message = String(json?.error ?? "save_failed");
          nextErrors[employee.id] = message;
          failed += 1;
          failedLines.push(`${employee.employeeCode} — ${fullName(employee)} → ${message}`);
          continue;
        }

        updated += 1;
      }

      setRowErrors(nextErrors);
      await reloadCurrentPage();

      setSummary({
        tone: failed > 0 ? "warn" : "good",
        title: failed > 0 ? "Toplu satır kaydı tamamlandı (kısmi)" : "Toplu satır kaydı tamamlandı",
        lines: [`${updated} kayıt güncellendi.`, `${failed} kayıt hata aldı.`, ...failedLines.slice(0, 6)],
      });
    } finally {
      setSavingRows(false);
    }
  }

  function applyBulkDraftToSelected() {
    if (!canWrite) return;

    if (bulkTargetMode !== "selected" || selectedIds.length === 0) {
      setSummary({
        tone: "warn",
        title: "Taslak kapsamı uygun değil",
        lines: ['Taslak uygulama yalnızca ekranda seçili kayıtlar için kullanılabilir. "Filtre sonucu" modu doğrudan toplu kaydet içindir.'],
      });
      return;
    }

    if (!bulkGroupId && bulkSubgroupId) {
      setSummary({
        tone: "warn",
        title: "Eksik toplu seçim",
        lines: ["Alt segment seçildiğinde uyumlu segment de belirlenmelidir."],
      });
      return;
    }

    const subgroup = bulkSubgroupId ? subgroups.find((s) => s.id === bulkSubgroupId) : null;
    const finalGroupId = subgroup?.groupId ?? bulkGroupId;

    const nextDrafts = { ...drafts };
    for (const employee of employees) {
      if (!selectedIdSet.has(employee.id)) continue;
      nextDrafts[employee.id] = {
        employeeGroupId: finalGroupId || "",
        employeeSubgroupId: bulkSubgroupId || "",
      };
    }

    setDrafts(nextDrafts);
    setSummary({
      tone: "info",
      title: "Toplu taslak uygulandı",
      lines: [
        `${selectedIds.length} seçili personel için taslak değerler hazırlandı. Kaydetmek için "Değişiklikleri Kaydet" kullanın.`,
      ],
    });
  }

  async function performBulkDirect(input: {
    employeeGroupId?: string | null;
    employeeSubgroupId?: string | null;
    summaryTitle: string;
  }) {
    if (!canWrite) return;

    const hasSelectedTarget = bulkTargetMode === "selected" && selectedIds.length > 0;
    const hasFilterTarget = bulkTargetMode === "filter" && total > 0;

    if (!hasSelectedTarget && !hasFilterTarget) {
      setSummary({
        tone: "warn",
        title: "Hedef yok",
        lines: ["Önce seçili kayıtları veya filtre sonucunun tamamını hedefleyin."],
      });
      return;
    }

    const targetLabel =
      bulkTargetMode === "filter"
        ? `${total} filtre sonucu kayıt`
        : `${selectedIds.length} seçili kayıt`;

    const confirmed = window.confirm(
      `${targetLabel} için toplu işlem uygulanacak.\n\nDevam etmek istiyor musun?`
    );
    if (!confirmed) return;

    setSavingBulk(true);
    clearSummary();

    try {
      const body =
        bulkTargetMode === "filter"
          ? {
              targetMode: "filter",
              filters: buildBulkFiltersPayload(),
              employeeGroupId: input.employeeGroupId,
              employeeSubgroupId: input.employeeSubgroupId,
            }
          : {
              targetMode: "selected",
              employeeIds: selectedIds,
              employeeGroupId: input.employeeGroupId,
              employeeSubgroupId: input.employeeSubgroupId,
            };

      const res = await fetch("/api/workforce/classification/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const json = (await res.json().catch(() => null)) as BulkResponse | null;

      if (!res.ok) {
        setSummary({
          tone: "danger",
          title: "Toplu kayıt başarısız",
          lines: [String(json?.error ?? "bulk_save_failed")],
        });
        return;
      }

      setSummary({
        tone: "good",
        title: input.summaryTitle,
        lines: [
          `${Number(json?.summary?.updated ?? 0)} kayıt güncellendi.`,
          `${Number(json?.summary?.unchanged ?? 0)} kayıt değişmeden geçti.`,
          `${Number(json?.summary?.missing ?? 0)} kayıt bulunamadı.`,
        ],
      });

      setSelectedIds([]);
      setBulkTargetMode("selected");
      setBulkGroupId("");
      setBulkSubgroupId("");
      await reloadCurrentPage();
    } finally {
      setSavingBulk(false);
    }
  }

  async function saveBulkSelectedDirect() {
    if (!canWrite) return;

    const hasSelectedTarget = bulkTargetMode === "selected" && selectedIds.length > 0;
    const hasFilterTarget = bulkTargetMode === "filter" && total > 0;

    if (!hasSelectedTarget && !hasFilterTarget) {
      setSummary({
        tone: "warn",
        title: "Hedef yok",
        lines: ["Önce seçili kayıtları veya filtre sonucunun tamamını hedefleyin."],
      });
      return;
    }

    if (!bulkGroupId && bulkSubgroupId) {
      setSummary({
        tone: "warn",
        title: "Eksik toplu seçim",
        lines: ["Alt segment seçildiğinde uyumlu segment de belirlenmelidir."],
      });
      return;
    }

    return performBulkDirect({
      employeeGroupId: bulkGroupId || null,
      employeeSubgroupId: bulkSubgroupId || null,
      summaryTitle: bulkTargetMode === "filter" ? "Filtre sonucu toplu kayıt tamamlandı" : "Toplu kayıt tamamlandı",
    });
  }

  async function clearClassificationForBulkTarget() {
    if (!canWrite) return;
    return performBulkDirect({
      employeeGroupId: null,
      employeeSubgroupId: null,
      summaryTitle:
        bulkTargetMode === "filter"
          ? "Filtre sonucu sınıflandırmadan çıkarıldı"
          : "Seçili kayıtlar sınıflandırmadan çıkarıldı",
    });
  }

  function changeFilterGroup(nextGroupId: string) {
    setGroupFilterId(nextGroupId);
    setSubgroupFilterId("");
    setPage(1);
    loadEmployees({
      page: 1,
      groupFilterId: nextGroupId,
      subgroupFilterId: "",
    });
  }

  function changeFilterSubgroup(nextSubgroupId: string) {
    setSubgroupFilterId(nextSubgroupId);
    setPage(1);
    loadEmployees({
      page: 1,
      subgroupFilterId: nextSubgroupId,
    });
  }

  function changeFilterBranch(nextBranchId: string) {
    setBranchId(nextBranchId);
    setPage(1);
    loadEmployees({
      page: 1,
      branchId: nextBranchId,
    });
  }

  function changeAssignmentStatus(next: AssignmentStatus) {
    setAssignmentStatus(next);
    setPage(1);
    loadEmployees({
      page: 1,
      assignmentStatus: next,
    });
  }

  function goToPage(nextPage: number) {
    const safePage = Math.min(Math.max(1, nextPage), totalPages);
    setPage(safePage);
    loadEmployees({ page: safePage });
  }

  function resetFilters() {
    setQueryDraft("");
    setQ("");
    setBranchId("");
    setGroupFilterId("");
    setSubgroupFilterId("");
    setAssignmentStatus("all");
    setPage(1);
    loadEmployees({
      page: 1,
      q: "",
      branchId: "",
      groupFilterId: "",
      subgroupFilterId: "",
      assignmentStatus: "all",
    });
  }

  return (
    <div className="grid gap-5">
      <div className={cx("rounded-2xl border p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]", toneStyles("violet").soft)}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-lg font-extrabold tracking-tight text-zinc-900">Personel Sınıflandırma</div>
              <PillBadge tone="violet">Employee → Group / Subgroup</PillBadge>
              {busy ? <PillBadge tone="warn">İşlem sürüyor</PillBadge> : null}
              <PillBadge tone={canWrite ? "good" : "warn"}>ROL: {roleLabel(role)}</PillBadge>
              {!canWrite ? <PillBadge tone="warn">Read-only</PillBadge> : null}
            </div>
            <div className="mt-1 text-sm font-medium leading-relaxed text-zinc-600">
              Personelleri <b>Segment</b> ve <b>Alt Segment</b> ile eşleştirerek kuralların hedefini netleştirin.
              Bu ekran sadece atama yönetir; hesap/motor değişmez.
            </div>
            <div className="mt-2 text-[11px] text-zinc-500">
              İpucu: Önce Segment/Alt Segment tanımlarını yapın, sonra burada personellere bağlayın.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <LinkButton href="/workforce" title="Workforce ana sayfa">
              Workforce
            </LinkButton>
            <LinkButton href="/workforce/groups" title="Segmentleri yönet">
              Segmentler
            </LinkButton>
            <LinkButton href="/workforce/subgroups" title="Alt segmentleri yönet">
              Alt Segmentler
            </LinkButton>
          </div>
        </div>

        {summary ? (
          <div className={cx("mt-4 rounded-2xl border px-4 py-3", toneStyles(summary.tone).soft)}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-extrabold uppercase tracking-wider text-zinc-900">{summary.title}</div>
                <div className="mt-1 space-y-1 text-sm text-zinc-700">
                  {summary.lines.map((line, idx) => (
                    <div key={`${line}-${idx}`}>{line}</div>
                  ))}
                </div>
              </div>
              <Button variant="ghost" onClick={clearSummary}>
                Kapat
              </Button>
            </div>
          </div>
        ) : null}

        {!canWrite ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="text-xs font-extrabold uppercase tracking-wider text-amber-900">Yetki uyarısı</div>
            <div className="mt-1 text-sm font-semibold text-amber-900/90">
              Bu sayfa konfigürasyon ekranıdır. Personel segment/alt segment ataması yapmak için yetkin yok.
            </div>
            <div className="mt-1 text-[11px] text-amber-900/70">
              Gerekli rol: <b>CONFIG_WRITE</b> (SYSTEM_ADMIN veya HR_CONFIG_ADMIN)
            </div>
          </div>
        ) : null}

        <div className={cx("mt-4 rounded-2xl border px-4 py-3", toneStyles("warn").soft)}>
          <div className="text-xs font-extrabold uppercase tracking-wider text-amber-900">Kural / Guard</div>
          <div className="mt-1 text-sm font-semibold text-amber-900/90">
            Alt segment seçilirse kendi segmenti otomatik uygulanır.
          </div>
          <div className="mt-1 text-[11px] text-amber-900/70">
            Segment/Alt segment çakışırsa API <span className="font-mono">SUBGROUP_GROUP_MISMATCH</span> döner.
          </div>
        </div>
      </div>

      <div className={cx("rounded-2xl border p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]", toneStyles("info").soft)}>
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-extrabold tracking-tight text-zinc-900">Operasyon Filtresi</div>
              <PillBadge tone="neutral">{total} toplam kayıt</PillBadge>
              <PillBadge tone="good">{assignedCount} bu sayfada atanmış</PillBadge>
              <PillBadge tone="violet">{pageSelectedCount} bu sayfada seçili</PillBadge>
              {dirtyCount > 0 ? <PillBadge tone="warn">{dirtyCount} kaydedilmemiş değişiklik</PillBadge> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => reloadCurrentPage()} disabled={busy} title="Mevcut filtrelerle listeyi yenile">
                Yenile
              </Button>
              <Button variant="ghost" onClick={resetFilters} disabled={busy}>
                Filtreleri Temizle
              </Button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-5">
            <input
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Ara: sicil, ad soyad, şube…"
              value={queryDraft}
              onChange={(e) => setQueryDraft(e.target.value)}
            />

            <select
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={branchId}
              onChange={(e) => changeFilterBranch(e.target.value)}
              disabled={busy}
            >
              <option value="">Tüm şubeler</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>

            <select
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={groupFilterId}
              onChange={(e) => changeFilterGroup(e.target.value)}
              disabled={busy}
            >
              <option value="">Tüm segmentler</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.code} — {g.name}
                </option>
              ))}
            </select>

            <select
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
              value={subgroupFilterId}
              onChange={(e) => changeFilterSubgroup(e.target.value)}
              disabled={busy || (!groupFilterId && currentFilterSubgroups.length === 0)}
            >
              <option value="">Tüm alt segmentler</option>
              {currentFilterSubgroups.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>

            <select
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={assignmentStatus}
              onChange={(e) => changeAssignmentStatus(e.target.value as AssignmentStatus)}
              disabled={busy}
            >
              <option value="all">Tüm atama durumları</option>
              <option value="assigned">Sadece atanmışlar</option>
              <option value="unassigned">Sadece atanmamışlar</option>
            </select>
          </div>

          <div className="text-xs font-medium text-zinc-600">
            Server-side filtreleme ve sayfalama aktiftir. Büyük listelerde sadece gerekli kayıtlar yüklenir.
          </div>
        </div>
      </div>

      {canWrite ? (
        <div className={cx("rounded-2xl border p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]", toneStyles("good").soft)}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold tracking-tight text-zinc-900">Toplu İşlem Çubuğu</div>
                <div className="mt-1 text-xs text-zinc-600">
                  Seçili personele veya filtre sonucunun tamamına aynı segment / alt segmenti tek hamlede uygulayın.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PillBadge tone={bulkTargetMode === "filter" ? "danger" : "violet"}>
                  {bulkTargetMode === "filter" ? "Hedef: Filtre Sonucu" : "Hedef: Seçililer"}
                </PillBadge>
                <PillBadge tone="violet">{effectiveTargetCount} hedef kayıt</PillBadge>
                {bulkTargetMode === "filter" ? (
                  <Button variant="ghost" onClick={enterSelectedTargetMode} disabled={busy}>
                    Seçili Moduna Dön
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={enterFilterTargetMode} disabled={busy || total === 0}>
                    Filtre Sonucunun Tamamını Hedefle
                  </Button>
                )}
                <PillBadge tone="violet">{selectedIds.length} toplam seçili</PillBadge>
                <PillBadge tone="warn">{dirtyCount} taslak değişiklik</PillBadge>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[1fr_1fr_auto_auto_auto_auto]">
              <select
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={bulkGroupId}
                onChange={(e) => {
                  const nextGroupId = e.target.value;
                  setBulkGroupId(nextGroupId);
                  if (!nextGroupId) {
                    setBulkSubgroupId("");
                    return;
                  }
                  if (bulkSubgroupId && !(subgroupsByGroupId.get(nextGroupId) ?? []).some((s) => s.id === bulkSubgroupId)) {
                    setBulkSubgroupId("");
                  }
                }}
                disabled={busy}
              >
                <option value="">Toplu segment seç</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code} — {g.name}
                  </option>
                ))}
              </select>

              <select
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
                value={bulkSubgroupId}
                onChange={(e) => {
                  const nextSubgroupId = e.target.value;
                  setBulkSubgroupId(nextSubgroupId);
                  if (nextSubgroupId) {
                    const sg = subgroups.find((x) => x.id === nextSubgroupId);
                    if (sg) setBulkGroupId(sg.groupId);
                  }
                }}
                disabled={busy || !bulkGroupId}
              >
                <option value="">Toplu alt segment seç</option>
                {bulkSubgroups.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>

              <Button
                variant="secondary"
                onClick={applyBulkDraftToSelected}
                disabled={busy || bulkTargetMode !== "selected" || selectedIds.length === 0}
              >
                Seçililere Taslak Uygula
              </Button>
              <Button variant="primary" onClick={saveBulkSelectedDirect} disabled={busy || selectedIds.length === 0}>
                Seçilileri Hızlı Kaydet
              </Button>
              <Button variant="danger" onClick={clearClassificationForBulkTarget} disabled={busy || (bulkTargetMode === "selected" ? selectedIds.length === 0 : total === 0)}>Sınıflandırmadan Çıkar</Button>
              <Button variant="secondary" onClick={saveDirtyRows} disabled={busy || dirtyCount === 0}>
                Değişiklikleri Kaydet
              </Button>
              <Button variant="ghost" onClick={clearDrafts} disabled={busy || dirtyCount === 0}>
                Taslakları Temizle
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
              <span>“Seçililere Taslak Uygula” sadece ekran üstünde draft oluşturur.</span>
              <span className="hidden sm:inline">•</span>
              <span>“Seçilileri Hızlı Kaydet” seçili kayıtlar veya filtre sonucu için bulk endpoint ile anında yazar.</span>
              <span className="hidden sm:inline">•</span>
              <span>“Sınıflandırmadan Çıkar” segment ve alt segmenti birlikte temizler.</span>
              <span className="hidden sm:inline">•</span>
              <span>Satır bazlı farklı düzenlemeler için “Değişiklikleri Kaydet” kullanılır.</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/70 bg-zinc-50/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="text-sm font-extrabold tracking-tight text-zinc-900">Personel Listesi</div>
            <PillBadge tone="violet">Atama</PillBadge>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>
              Sayfa {page} / {totalPages}
            </span>
            <span className="hidden sm:inline">•</span>
            <span>{employees.length} kayıt gösteriliyor</span>
            <span className="hidden sm:inline">•</span>
            <span>Her satır ayrı düzenlenebilir.</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white text-zinc-600">
              <tr className="border-b border-zinc-200/70">
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    checked={allPageSelected}
                    ref={(node) => {
                      if (node) node.indeterminate = somePageSelected;
                    }}
                    onChange={toggleSelectAllPage}
                    disabled={busy || employees.length === 0}
                    aria-label="Bu sayfadaki tüm kayıtları seç"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider">Sicil</th>
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider">Ad Soyad</th>
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider">Şube</th>
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider">Segment</th>
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider">Alt Segment</th>
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider">Durum</th>
                <th className="px-4 py-3 text-right text-xs font-extrabold uppercase tracking-wider">Kaydet</th>
              </tr>
            </thead>
            <tbody>
              {rowsWithDraft.map((e) => {
                const draftGroupId = e.draftGroupId ?? "";
                const sgList = draftGroupId ? subgroupsByGroupId.get(draftGroupId) ?? [] : [];
                return (
                  <Row
                    key={e.id}
                    e={e}
                    groups={groups}
                    subgroups={sgList}
                    disabled={busy}
                    canWrite={canWrite}
                    selected={selectedIdSet.has(e.id)}
                    dirty={isRowDirty(e)}
                    error={rowErrors[e.id] ?? ""}
                    onToggleSelect={() => toggleSelectOne(e.id)}
                    onChangeGroup={(gid) => updateDraftGroup(e, gid)}
                    onChangeSubgroup={(sgid) => updateDraftSubgroup(e, sgid)}
                    onSave={() => saveSingle(e)}
                  />
                );
              })}

              {rowsWithDraft.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center" colSpan={8}>
                    <div className="mx-auto max-w-md">
                      <div className="text-sm font-extrabold text-zinc-900">Kayıt bulunamadı</div>
                      <div className="mt-1 text-sm text-zinc-600">Filtreleri değiştirin veya listeyi yeniden yükleyin.</div>
                      <div className="mt-3 text-xs text-zinc-500">{busy ? "Yükleniyor…" : "Hazır olduğunuzda devam edin."}</div>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-zinc-200/70 bg-zinc-50/50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={toggleSelectAllPage} disabled={busy || employees.length === 0}>
              {allPageSelected ? "Bu Sayfanın Seçimini Temizle" : "Bu Sayfayı Seç"}
            </Button>
            <Button variant="ghost" onClick={clearSelection} disabled={busy || selectedIds.length === 0}>
              Tüm Seçimi Temizle
            </Button>
            <Button variant="ghost" onClick={enterFilterTargetMode} disabled={busy || total === 0}>
              Filtre Sonucunun Tamamını Hedefle
            </Button>
            <div className="text-xs text-zinc-500">
              {bulkTargetMode === "filter" ? `${total} filtre sonucu hedefte` : `${selectedIds.length} toplam seçili`} • {dirtyCount} kaydedilmemiş değişiklik
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={String(pageSize)}
              onChange={(e) => {
                const nextPageSize = Number(e.target.value);
                setPageSize(nextPageSize);
                setPage(1);
                loadEmployees({ page: 1, pageSize: nextPageSize });
              }}
              disabled={busy}
            >
              <option value="25">25 / sayfa</option>
              <option value="50">50 / sayfa</option>
              <option value="100">100 / sayfa</option>
              <option value="200">200 / sayfa</option>
            </select>
            <Button variant="secondary" onClick={() => goToPage(page - 1)} disabled={busy || page <= 1}>
              Önceki
            </Button>
            <Button variant="secondary" onClick={() => goToPage(page + 1)} disabled={busy || page >= totalPages}>
              Sonraki
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  e,
  groups,
  subgroups,
  disabled,
  canWrite,
  selected,
  dirty,
  error,
  onToggleSelect,
  onChangeGroup,
  onChangeSubgroup,
  onSave,
}: {
  e: EmployeeRowItem;
  groups: Group[];
  subgroups: Subgroup[];
  disabled: boolean;
  canWrite: boolean;
  selected: boolean;
  dirty: boolean;
  error: string;
  onToggleSelect: () => void;
  onChangeGroup: (employeeGroupId: string) => void;
  onChangeSubgroup: (employeeSubgroupId: string) => void;
  onSave: () => void;
}) {
  return (
    <tr className={cx("border-t border-zinc-200/60 hover:bg-zinc-50/40", selected && "bg-indigo-50/30")}>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
          checked={selected}
          onChange={onToggleSelect}
          disabled={disabled}
          aria-label={`${e.employeeCode} seç`}
        />
      </td>

      <td className="px-4 py-3">
        <span className="inline-flex items-center rounded-xl bg-zinc-100 px-2 py-1 font-mono text-xs font-bold text-zinc-800 ring-1 ring-inset ring-zinc-200/70">
          {e.employeeCode}
        </span>
      </td>

      <td className="px-4 py-3">
        <div className="font-semibold text-zinc-900">{fullName(e)}</div>
        <div className="mt-1 text-[11px] text-zinc-500">{dirty ? "Taslak değişiklik var" : "Kayıt senkron"}</div>
      </td>

      <td className="px-4 py-3 text-xs text-zinc-600">
        {e.branch ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-xl bg-zinc-100 px-2 py-1 font-mono text-[11px] font-bold text-zinc-800 ring-1 ring-inset ring-zinc-200/70">
              {e.branch.code}
            </span>
            <span className="font-medium text-zinc-700">{e.branch.name}</span>
          </span>
        ) : (
          <span className="italic">—</span>
        )}
      </td>

      <td className="px-4 py-3">
        <select
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          value={e.draftGroupId}
          onChange={(ev) => onChangeGroup(ev.target.value)}
          disabled={disabled || !canWrite}
        >
          <option value="">(seçilmedi)</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.code} — {g.name}
            </option>
          ))}
        </select>
      </td>

      <td className="px-4 py-3">
        <select
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
          value={e.draftSubgroupId}
          onChange={(ev) => onChangeSubgroup(ev.target.value)}
          disabled={disabled || !canWrite || !e.draftGroupId}
        >
          <option value="">(seçilmedi)</option>
          {subgroups.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-col items-start gap-1">
          {error ? (
            <PillBadge tone="danger">Hata</PillBadge>
          ) : dirty ? (
            <PillBadge tone="warn">Taslak</PillBadge>
          ) : (
            <PillBadge tone="good">Hazır</PillBadge>
          )}

          {e.employeeGroup ? (
            <div className="text-[11px] text-zinc-500">
              Mevcut: {e.employeeGroup.code}
              {e.employeeSubgroup ? ` / ${e.employeeSubgroup.code}` : ""}
            </div>
          ) : (
            <div className="text-[11px] text-zinc-500">Mevcut: atanmamış</div>
          )}

          {error ? <div className="max-w-[220px] text-[11px] font-medium text-red-700">{error}</div> : null}
        </div>
      </td>

      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onToggleSelect} disabled={disabled} title="Satırı seç / kaldır">
            {selected ? "Seçili" : "Seç"}
          </Button>
          <Button
            variant="primary"
            onClick={onSave}
            disabled={disabled || !canWrite || !dirty}
            title={!canWrite ? "Read-only" : dirty ? "Satırı kaydet" : "Değişiklik yok"}
          >
            Kaydet
          </Button>
        </div>
      </td>
    </tr>
  );
}