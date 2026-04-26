"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type Tone = "neutral" | "info" | "good" | "warn" | "danger" | "violet";
type UserRole = "SYSTEM_ADMIN" | "HR_CONFIG_ADMIN" | "HR_OPERATOR" | "SUPERVISOR";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  const map: Record<Tone, string> = {
    neutral: "bg-zinc-100 text-zinc-700 ring-zinc-200/60",
    info: "bg-sky-50 text-sky-700 ring-sky-200/60",
    good: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
    warn: "bg-amber-50 text-amber-900 ring-amber-200/60",
    danger: "bg-rose-50 text-rose-800 ring-rose-200/60",
    violet: "bg-violet-50 text-violet-800 ring-violet-200/60",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset shadow-sm uppercase tracking-tight",
        map[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

function Card({
  tone = "neutral",
  title,
  subtitle,
  right,
  children,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const toneBg: Record<Tone, string> = {
    neutral: "from-white to-zinc-50/50",
    info: "from-white to-sky-50/30",
    good: "from-white to-emerald-50/30",
    warn: "from-white to-amber-50/30",
    danger: "from-white to-rose-50/30",
    violet: "from-white to-violet-50/30",
  };
  return (
    <div
      className={cx(
        "rounded-2xl border border-zinc-200/70 bg-gradient-to-b p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] min-w-0 transition-all duration-300 hover:shadow-md",
        toneBg[tone],
        className
      )}
    >
      {title || subtitle || right ? (
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-zinc-100 pb-4">
          <div className="min-w-0">
            {title ? <div className="text-lg font-bold text-zinc-900 leading-tight tracking-tight">{title}</div> : null}
            {subtitle ? (
              <div className="mt-1 text-sm text-zinc-500 font-medium leading-relaxed italic">{subtitle}</div>
            ) : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function Button({
  variant = "secondary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all active:scale-95 " +
    "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm";
  const map = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-600/20",
    secondary: "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900",
    ghost: "bg-transparent text-zinc-600 hover:bg-zinc-100 border border-transparent",
    danger: "bg-rose-600 text-white hover:bg-rose-700 border border-rose-600/20",
  } as const;
  return <button className={cx(base, map[variant], className)} {...props} />;
}

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white/80 px-3 py-2.5 text-sm shadow-sm font-medium transition-all " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white";

type UserRow = {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;

  // Scope v1 fields (admin/users GET ile geliyor)
  scopeBranchIds?: string[];
  scopeEmployeeGroupIds?: string[];
  scopeEmployeeSubgroupIds?: string[];
};

type UsersResponse = {
  ok: true;
  meUserId: string;
  items: UserRow[];
};

type Notice = { kind: "success" | "error" | "info"; text: string };

function parseApiErrorText(t: string): string | null {
  const s = (t ?? "").trim();
  if (!s) return null;
  if (s.startsWith("{") && s.endsWith("}")) {
    try {
      const j = JSON.parse(s);
      if (typeof j?.error === "string" && j.error.trim()) return j.error.trim();
    } catch {
      // ignore
    }
  }
  return s;
}

function humanizeError(codeOrText: string): string {
  const v = (codeOrText ?? "").trim();
  const map: Record<string, string> = {
    EMAIL_REQUIRED: "E-posta zorunludur.",
    INVALID_EMAIL: "E-posta formatı geçersiz.",
    PASSWORD_REQUIRED: "Şifre zorunludur.",
    PASSWORD_TOO_SHORT: "Şifre çok kısa (en az 8 karakter).",
    ROLE_REQUIRED: "Rol seçimi zorunludur.",
    EMAIL_TAKEN: "Bu e-posta zaten kayıtlı.",
    USER_NOT_FOUND: "Kullanıcı bulunamadı.",
    CANNOT_DISABLE_SELF: "Kendi hesabınızı pasifleştiremezsiniz.",
    MUST_KEEP_ONE_ADMIN: "En az 1 adet aktif SYSTEM_ADMIN kalmalıdır.",
    INVALID_DATA_SCOPE: "Geçersiz kapsam tipi.",
    INVALID_SCOPE_BRANCH_IDS: "Branch kapsam listesi geçersiz.",
    INVALID_SCOPE_GROUP_IDS: "Group kapsam listesi geçersiz.",
    INVALID_SCOPE_SUBGROUP_IDS: "Subgroup kapsam listesi geçersiz.",
    NO_CHANGES: "Kaydedilecek değişiklik yok.",
    UNAUTHORIZED: "Oturum bulunamadı. Lütfen tekrar giriş yapın.",
    FORBIDDEN: "Bu işlem için yetkiniz yok.",
  };
  if (map[v]) return map[v];
  const upper = v.toUpperCase();
  if (upper.includes("P2002") || upper.includes("UNIQUE")) return "Bu e-posta zaten kayıtlı.";
  return v;
}

function NoticeBar({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  if (!notice) return null;
  const tone: Tone =
    notice.kind === "success" ? "good" : notice.kind === "error" ? "danger" : notice.kind === "info" ? "info" : "neutral";
  const icon = notice.kind === "success" ? "✅" : notice.kind === "error" ? "⛔" : notice.kind === "info" ? "ℹ️" : "";
  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="text-lg leading-none">{icon}</div>
        <div>
          <div className="text-sm font-bold text-zinc-900">
            {notice.kind === "success" ? "Başarılı" : notice.kind === "error" ? "Hata" : "Bilgi"}
          </div>
          <div className="mt-1 text-sm text-zinc-600">{notice.text}</div>
        </div>
      </div>
      <button
        onClick={onClose}
        className={cx(
          "rounded-xl px-3 py-2 text-sm font-bold border transition",
          tone === "danger" ? "border-rose-200 text-rose-700 hover:bg-rose-50" : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
        )}
      >
        Kapat
      </button>
    </div>
  );
}

const ROLE_OPTIONS: Array<{ value: UserRole; label: string; tone: Tone }> = [
  { value: "SYSTEM_ADMIN", label: "SYSTEM_ADMIN", tone: "danger" },
  { value: "HR_CONFIG_ADMIN", label: "HR_CONFIG_ADMIN", tone: "violet" },
  { value: "HR_OPERATOR", label: "HR_OPERATOR", tone: "info" },
  { value: "SUPERVISOR", label: "SUPERVISOR", tone: "neutral" },
];

function roleTone(role: UserRole): Tone {
  return ROLE_OPTIONS.find((x) => x.value === role)?.tone ?? "neutral";
}

function formatDateTimeIso(s: string): string {
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleString("tr-TR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

async function readTextSafe(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function isValidEmail(email: string): boolean {
  const v = (email ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function roleLabel(role: UserRole) {
  const x = ROLE_OPTIONS.find((r) => r.value === role);
  return x?.label ?? role;
}

function roleShort(role: UserRole) {
  switch (role) {
    case "SYSTEM_ADMIN":
      return "ADMIN";
    case "HR_CONFIG_ADMIN":
      return "HR-CONFIG";
    case "HR_OPERATOR":
      return "HR";
    case "SUPERVISOR":
      return "SUP";
    default:
      return role;
  }
}

function MiniHelp({ children }: { children: ReactNode }) {
  return <div className="text-xs text-zinc-500 leading-relaxed">{children}</div>;
}

function Modal({
  open,
  title,
  subtitle,
  children,
  onClose,
  tone = "neutral",
}: {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  tone?: Tone;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Center container */}
      <div className="relative flex h-full w-full items-center justify-center p-3 sm:p-4">
        {/* Modal panel (scrolls inside) */}
        <div className="w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-hidden">
          <div className="rounded-2xl border border-zinc-200/70 bg-gradient-to-b shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            {/* Header (sticky) */}
            <div className="sticky top-0 z-10 rounded-t-2xl border-b border-zinc-100 bg-white/90 backdrop-blur px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-lg font-bold text-zinc-900 leading-tight tracking-tight">{title}</div>
                  {subtitle ? <div className="mt-1 text-sm text-zinc-500 font-medium leading-relaxed italic">{subtitle}</div> : null}
                </div>
                <button
                  onClick={onClose}
                  className="shrink-0 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-50"
                >
                  Kapat
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="max-h-[calc(100vh-8.5rem)] overflow-y-auto px-5 py-4">
              <div
                className={cx(
                  "rounded-2xl bg-gradient-to-b p-0",
                  tone === "info"
                    ? "from-white to-sky-50/30"
                    : tone === "good"
                      ? "from-white to-emerald-50/30"
                      : tone === "warn"
                        ? "from-white to-amber-50/30"
                        : tone === "danger"
                          ? "from-white to-rose-50/30"
                          : tone === "violet"
                            ? "from-white to-violet-50/30"
                            : "from-white to-zinc-50/50"
                )}
              >
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Scope master data types */
type Branch = { id: string; code: string; name: string; isActive: boolean };
type Group = { id: string; code: string; name: string; isActive?: boolean };
type Subgroup = {
  id: string;
  code: string;
  name: string;
  isActive?: boolean;
  employeeGroup?: { id: string; code: string; name: string } | null;
};

function pickItemsArray<T>(json: any): T[] {
  if (Array.isArray(json)) return json as T[];
  if (json && Array.isArray(json.items)) return json.items as T[];
  return [];
}

export default function UsersAdminClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [meUserId, setMeUserId] = useState<string>("");
  const [items, setItems] = useState<UserRow[]>([]);

  // Create form
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("HR_OPERATOR");

  // Reset password modal
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  // Filters
  const [q, setQ] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [roleFilter, setRoleFilter] = useState<UserRole | "ALL">("ALL");

  // Scope modal state
  const [scopeTargetId, setScopeTargetId] = useState<string | null>(null);
  const [scopeBranchIds, setScopeBranchIds] = useState<string[]>([]);
  const [scopeGroupIds, setScopeGroupIds] = useState<string[]>([]);
  const [scopeSubgroupIds, setScopeSubgroupIds] = useState<string[]>([]);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subgroups, setSubgroups] = useState<Subgroup[]>([]);

  const activeAdminCount = useMemo(
    () => items.filter((u) => u.role === "SYSTEM_ADMIN" && u.isActive).length,
    [items]
  );

  const sorted = useMemo(() => {
    const a = [...items];
    a.sort((x, y) => {
      if (x.role !== y.role) {
        if (x.role === "SYSTEM_ADMIN") return -1;
        if (y.role === "SYSTEM_ADMIN") return 1;
      }
      if (x.isActive !== y.isActive) return x.isActive ? -1 : 1;
      return x.email.localeCompare(y.email, "tr");
    });
    return a;
  }, [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sorted.filter((u) => {
      if (activeOnly && !u.isActive) return false;
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (!needle) return true;
      return u.email.toLowerCase().includes(needle) || u.role.toLowerCase().includes(needle);
    });
  }, [sorted, q, activeOnly, roleFilter]);

  const resetTarget = useMemo(() => items.find((u) => u.id === resetTargetId) ?? null, [items, resetTargetId]);
  const scopeTarget = useMemo(() => items.find((u) => u.id === scopeTargetId) ?? null, [items, scopeTargetId]);

  // Subgroup parent resolver:
  // Depending on API shape, parent group id can be at:
  // - sg.employeeGroup.id
  // - sg.groupId
  // - sg.employeeGroupId
  function getSubgroupParentId(sg: any): string | null {
    const a = sg?.employeeGroup?.id;
    if (typeof a === "string" && a.trim().length > 0) return a.trim();
    const b = sg?.groupId;
    if (typeof b === "string" && b.trim().length > 0) return b.trim();
    const c = sg?.employeeGroupId;
    if (typeof c === "string" && c.trim().length > 0) return c.trim();
    return null;
  }
  // --- Scope V3 UX helpers (Group/Subgroup consistency) ---
  const subgroupParentById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const sg of subgroups) {
      m.set(sg.id, getSubgroupParentId(sg));
    }
    return m;
  }, [subgroups]);

  const mismatchedSubgroupIds = useMemo(() => {
    if (scopeSubgroupIds.length === 0) return [];
    if (scopeGroupIds.length === 0) return [];
    const groupSet = new Set(scopeGroupIds);
    const bad: string[] = [];
    for (const sgId of scopeSubgroupIds) {
      const parentId = subgroupParentById.get(sgId) ?? null;
      if (!parentId) continue; // unknown subgroup -> backend will deny; UI will surface as "uyumsuz"
      if (!groupSet.has(parentId)) bad.push(sgId);
    }
    return bad;
  }, [scopeSubgroupIds, scopeGroupIds, subgroupParentById]);

  const hasGroupFilter = scopeGroupIds.length > 0;
  const groupSet = useMemo(() => new Set(scopeGroupIds), [scopeGroupIds]);

  async function load() {
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (!res.ok) {
        const t = await readTextSafe(res);
        const msg = humanizeError(parseApiErrorText(t) ?? `HTTP_${res.status}`);
        setNotice({ kind: "error", text: msg });
        setItems([]);
        return;
      }
      const j = (await res.json()) as UsersResponse;
      setMeUserId(j.meUserId);
      setItems(j.items);
    } catch (e: any) {
      setNotice({ kind: "error", text: e?.message ?? "Yükleme başarısız" });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadScopeMasterData() {
    try {
      const [bRes, gRes, sgRes] = await Promise.all([
        fetch("/api/org/branches", { cache: "no-store" }),
        fetch("/api/workforce/groups", { cache: "no-store" }),
        fetch("/api/workforce/subgroups", { cache: "no-store" }),
      ]);

      if (bRes.ok) setBranches(pickItemsArray<Branch>(await bRes.json()));
      if (gRes.ok) setGroups(pickItemsArray<Group>(await gRes.json()));
      if (sgRes.ok) setSubgroups(pickItemsArray<Subgroup>(await sgRes.json()));
    } catch {
      // silent
    }
  }

  useEffect(() => {
    load();
    loadScopeMasterData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createUser() {
    const email = newEmail.trim().toLowerCase();
    const pw = newPassword;

    if (!email) return setNotice({ kind: "error", text: humanizeError("EMAIL_REQUIRED") });
    if (!isValidEmail(email)) return setNotice({ kind: "error", text: humanizeError("INVALID_EMAIL") });
    if (!pw) return setNotice({ kind: "error", text: humanizeError("PASSWORD_REQUIRED") });
    if (pw.length < 8) return setNotice({ kind: "error", text: humanizeError("PASSWORD_TOO_SHORT") });

    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pw, role: newRole }),
      });
      if (!res.ok) {
        const t = await readTextSafe(res);
        const msg = humanizeError(parseApiErrorText(t) ?? `HTTP_${res.status}`);
        setNotice({ kind: "error", text: msg });
        return;
      }
      setNotice({ kind: "success", text: "Kullanıcı oluşturuldu." });
      setNewEmail("");
      setNewPassword("");
      setNewRole("HR_OPERATOR");
      await load();
    } catch (e: any) {
      setNotice({ kind: "error", text: e?.message ?? "Kullanıcı oluşturma başarısız" });
    } finally {
      setSaving(false);
    }
  }

  async function patchUser(id: string, patch: { role?: UserRole; isActive?: boolean }) {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const t = await readTextSafe(res);
        const msg = humanizeError(parseApiErrorText(t) ?? `HTTP_${res.status}`);
        setNotice({ kind: "error", text: msg });
        return;
      }
      setNotice({ kind: "success", text: "Güncellendi." });
      await load();
    } catch (e: any) {
      setNotice({ kind: "error", text: e?.message ?? "Güncelleme başarısız" });
    } finally {
      setSaving(false);
    }
  }

  async function patchUserScope(id: string) {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeBranchIds,
          scopeEmployeeGroupIds: scopeGroupIds,
          scopeEmployeeSubgroupIds: scopeSubgroupIds,
        }),
      });
      if (!res.ok) {
        const t = await readTextSafe(res);
        const msg = humanizeError(parseApiErrorText(t) ?? `HTTP_${res.status}`);
        setNotice({ kind: "error", text: msg });
        return;
      }
      setNotice({ kind: "success", text: "Kapsam güncellendi." });
      setScopeTargetId(null);
      await load();
    } catch (e: any) {
      setNotice({ kind: "error", text: e?.message ?? "Kapsam güncelleme başarısız" });
    } finally {
      setSaving(false);
    }
  }

  async function doResetPassword(id: string) {
    const pw = resetPassword;
    if (!pw) return setNotice({ kind: "error", text: humanizeError("PASSWORD_REQUIRED") });
    if (pw.length < 8) return setNotice({ kind: "error", text: humanizeError("PASSWORD_TOO_SHORT") });

    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/users/${id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) {
        const t = await readTextSafe(res);
        const msg = humanizeError(parseApiErrorText(t) ?? `HTTP_${res.status}`);
        setNotice({ kind: "error", text: msg });
        return;
      }
      setNotice({ kind: "success", text: "Şifre güncellendi." });
      setResetPassword("");
      setResetTargetId(null);
    } catch (e: any) {
      setNotice({ kind: "error", text: e?.message ?? "Şifre reset başarısız" });
    } finally {
      setSaving(false);
    }
  }

  function canDeactivate(u: UserRow): { ok: boolean; reason?: string } {
    if (!u.isActive) return { ok: true };
    if (u.id === meUserId) return { ok: false, reason: "Kendi hesabınızı pasifleştiremezsiniz." };
    if (u.role === "SYSTEM_ADMIN" && activeAdminCount <= 1) return { ok: false, reason: "En az 1 aktif SYSTEM_ADMIN kalmalıdır." };
    return { ok: true };
  }

  function canChangeRole(u: UserRow, nextRole: UserRole): { ok: boolean; reason?: string } {
    if (u.role === nextRole) return { ok: true };
    if (u.role === "SYSTEM_ADMIN" && u.isActive && activeAdminCount <= 1 && nextRole !== "SYSTEM_ADMIN") {
      return { ok: false, reason: "Son aktif SYSTEM_ADMIN rolü değiştirilemez." };
    }
    return { ok: true };
  }

  return (
    <div className="grid gap-4">
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />

      {/* Header / Summary */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          tone="info"
          title="Kullanıcı Yönetimi (v1)"
          subtitle="User CRUD + Supervisor Scope v1 (kapsam atama). Silme yoktur."
          className="lg:col-span-2"
          right={
            <div className="flex items-center gap-2">
              <Badge tone="info">SYSTEM_ADMIN</Badge>
              <Badge tone="good">{items.filter((x) => x.isActive).length} aktif</Badge>
              <Badge tone="neutral">{items.length} toplam</Badge>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Aktif Admin</div>
              <div className="mt-1 text-2xl font-extrabold text-zinc-900">{activeAdminCount}</div>
              <MiniHelp>En az 1 aktif SYSTEM_ADMIN kalmalıdır.</MiniHelp>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Aktif Kullanıcı</div>
              <div className="mt-1 text-2xl font-extrabold text-zinc-900">{items.filter((x) => x.isActive).length}</div>
              <MiniHelp>Pasif kullanıcı sisteme giriş yapamaz.</MiniHelp>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Rol Dağılımı</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((r) => (
                  <Badge key={r.value} tone={r.tone}>
                    {roleShort(r.value)}: {items.filter((x) => x.role === r.value).length}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Create */}
        <Card tone="good" title="Yeni Kullanıcı" subtitle="E-posta + şifre + rol ile kullanıcı oluşturun. Oluşturulan kullanıcı otomatik aktif gelir.">
          <div className="grid gap-3">
            <div>
              <div className="mb-1 text-xs font-bold text-zinc-600 uppercase tracking-wider">E-posta</div>
              <input
                className={inputClass}
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="ornek@firma.com"
                autoComplete="off"
              />
            </div>

            <div>
              <div className="mb-1 text-xs font-bold text-zinc-600 uppercase tracking-wider">Şifre</div>
              <input
                className={inputClass}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="En az 8 karakter"
                type="password"
              />
              <div className="mt-1">
                <MiniHelp>Not: Bu fazda “force change password” yok. Şifre reset ile değiştirilebilir.</MiniHelp>
              </div>
            </div>

            <div>
              <div className="mb-1 text-xs font-bold text-zinc-600 uppercase tracking-wider">Rol</div>
              <select className={inputClass} value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                variant="secondary"
                onClick={() => {
                  setNewEmail("");
                  setNewPassword("");
                  setNewRole("HR_OPERATOR");
                  setNotice(null);
                }}
                disabled={saving}
              >
                Temizle
              </Button>
              <Button variant="primary" onClick={createUser} disabled={saving}>
                {saving ? "Kaydediliyor..." : "Kullanıcı Oluştur"}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters + Table */}
      <Card
        tone="neutral"
        title="Kullanıcı Listesi"
        subtitle="Rol değişikliği, aktif/pasif ve kapsam işlemleri anında kaydedilir. Silme yoktur."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={load} disabled={saving}>
              Yenile
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="mb-1 text-xs font-bold text-zinc-600 uppercase tracking-wider">Ara</div>
            <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder="email veya rol ara..." />
          </div>

          <div className="lg:col-span-3">
            <div className="mb-1 text-xs font-bold text-zinc-600 uppercase tracking-wider">Rol</div>
            <select className={inputClass} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}>
              <option value="ALL">Tümü</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <div className="mb-1 text-xs font-bold text-zinc-600 uppercase tracking-wider">Durum</div>
            <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-bold text-zinc-700 shadow-sm">
              <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
              Sadece aktif
            </label>
          </div>

          <div className="lg:col-span-2 flex items-end justify-end">
            <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-bold text-zinc-700 shadow-sm">
              {loading ? "Yükleniyor..." : `${filtered.length} kayıt`}
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50">
                <tr className="text-left">
                  <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-zinc-600">Kullanıcı</th>
                  <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-zinc-600">Rol</th>
                  <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-zinc-600">Durum</th>
                  <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-zinc-600">Oluşturma</th>
                  <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-zinc-600 text-right">Aksiyon</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                      Liste yükleniyor…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                      Kayıt bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => {
                    const isMe = u.id === meUserId;
                    const deact = canDeactivate(u);
                    const isLastActiveAdmin = u.role === "SYSTEM_ADMIN" && u.isActive && activeAdminCount <= 1;

                    return (
                      <tr key={u.id} className={cx("hover:bg-zinc-50/70", !u.isActive && "bg-zinc-50/40")}>
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <div className="font-extrabold text-zinc-900 truncate">{u.email}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {isMe ? <Badge tone="warn">SEN</Badge> : null}
                              <Badge tone={roleTone(u.role)}>{roleShort(u.role)}</Badge>
                              {!u.isActive ? <Badge tone="neutral">PASİF</Badge> : <Badge tone="good">AKTİF</Badge>}
                              {isLastActiveAdmin ? <Badge tone="danger">SON ADMIN</Badge> : null}
                              {u.role === "SUPERVISOR" ? <Badge tone="info">SCOPE</Badge> : null}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <select
                              className={cx(inputClass, "py-2")}
                              value={u.role}
                              disabled={saving || (isLastActiveAdmin && u.role === "SYSTEM_ADMIN")}
                              onChange={(e) => {
                                const next = e.target.value as UserRole;
                                const ok = canChangeRole(u, next);
                                if (!ok.ok) {
                                  setNotice({ kind: "error", text: ok.reason ?? "Rol değiştirilemez." });
                                  return;
                                }
                                patchUser(u.id, { role: next });
                              }}
                            >
                              {ROLE_OPTIONS.map((r) => (
                                <option key={r.value} value={r.value}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                            {isLastActiveAdmin ? (
                              <div className="text-xs text-rose-700 font-bold">Son aktif admin rolü düşürülemez.</div>
                            ) : (
                              <div className="text-xs text-zinc-500">{roleLabel(u.role)}</div>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <Badge tone={u.isActive ? "good" : "neutral"}>{u.isActive ? "AKTİF" : "PASİF"}</Badge>
                            </div>

                            <div className="flex items-center gap-2">
                              {u.isActive ? (
                                <Button
                                  variant="secondary"
                                  className="px-3 py-2"
                                  disabled={saving || !deact.ok}
                                  title={deact.ok ? "Kullanıcıyı pasifleştir" : deact.reason}
                                  onClick={() => {
                                    if (!deact.ok) return;
                                    patchUser(u.id, { isActive: false });
                                  }}
                                >
                                  Pasifleştir
                                </Button>
                              ) : (
                                <Button variant="secondary" className="px-3 py-2" disabled={saving} onClick={() => patchUser(u.id, { isActive: true })}>
                                  Aktifleştir
                                </Button>
                              )}
                            </div>

                            {!deact.ok ? <div className="text-xs text-rose-700 font-bold">{deact.reason}</div> : null}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-bold text-zinc-900">{formatDateTimeIso(u.createdAt)}</div>
                          <div className="text-xs text-zinc-500">{u.id.slice(0, 10)}…</div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              className="px-3 py-2"
                              disabled={saving}
                              onClick={() => {
                                setScopeTargetId(u.id);
                                setScopeBranchIds(u.scopeBranchIds ?? []);
                                setScopeGroupIds(u.scopeEmployeeGroupIds ?? []);
                                setScopeSubgroupIds(u.scopeEmployeeSubgroupIds ?? []);
                                setNotice(null);
                              }}
                            >
                              Kapsam
                            </Button>

                            <Button
                              variant="ghost"
                              className="px-3 py-2"
                              disabled={saving}
                              onClick={() => {
                                setResetTargetId(u.id);
                                setResetPassword("");
                                setNotice(null);
                              }}
                            >
                              Şifre Reset
                            </Button>

                            <Button
                              variant="secondary"
                              className="px-3 py-2"
                              disabled={saving}
                              onClick={() => {
                                const txt = u.email;
                                if (!txt) return;
                                if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(txt).catch(() => {});
                              }}
                              title="E-postayı kopyala"
                            >
                              Kopyala
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-zinc-500">
            <span className="font-bold text-zinc-700">Not:</span> Bu sayfa sadece SYSTEM_ADMIN erişimlidir. Silme yoktur. Scope v1 aktif.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="danger">ADMIN</Badge>
            <Badge tone="violet">HR-CONFIG</Badge>
            <Badge tone="info">HR</Badge>
            <Badge tone="neutral">SUP</Badge>
          </div>
        </div>
      </Card>

      {/* Scope Modal */}
      <Modal
        open={!!scopeTargetId}
        tone="info"
        title="Kapsam (Supervisor Scope v3)"
        subtitle={
          scopeTarget ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={roleTone(scopeTarget.role)}>{scopeTarget.role}</Badge>
              <span className="text-sm font-bold text-zinc-800">{scopeTarget.email}</span>
              {scopeTarget.role !== "SUPERVISOR" ? <Badge tone="warn">Not: Scope genelde Supervisor içindir</Badge> : null}
            </div>
          ) : (
            "Kullanıcı seçili değil."
          )
        }
        onClose={() => setScopeTargetId(null)}
      >
        <div className="grid gap-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info">V3</Badge>
              <span className="text-sm font-bold text-zinc-900">Hiyerarşik Kapsam (AND)</span>
              {scopeBranchIds.length === 0 ? <Badge tone="danger">BRANCH ZORUNLU</Badge> : <Badge tone="good">OK</Badge>}
            </div>
            <div className="mt-2">
              <MiniHelp>
                Kurallar: <b>Branch zorunlu</b>. Group/Subgroup seçerseniz <b>AND</b> ile daralır. Subgroup seçimi Group zorunludur
                (UI otomatik ekler). Hiç seçim yoksa Supervisor <b>0 erişim</b> alır.
              </MiniHelp>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-sm font-bold text-zinc-900">Branch Seçimi (Zorunlu)</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {branches.filter((b) => b.isActive).map((b) => {
                const checked = scopeBranchIds.includes(b.id);
                return (
                  <label key={b.id} className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-bold text-zinc-700">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked ? [...scopeBranchIds, b.id] : scopeBranchIds.filter((x) => x !== b.id);
                        setScopeBranchIds(next);
                      }}
                    />
                    <span className="truncate">{b.code} — {b.name}</span>
                  </label>
                );
              })}
            </div>
            <div className="mt-2"><MiniHelp>Branch seçilmezse Supervisor 0 erişim alır.</MiniHelp></div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-sm font-bold text-zinc-900">Group Seçimi (Opsiyonel)</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {groups.map((g) => {
                const checked = scopeGroupIds.includes(g.id);
                return (
                  <label key={g.id} className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-bold text-zinc-700">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked ? [...scopeGroupIds, g.id] : scopeGroupIds.filter((x) => x !== g.id);
                        setScopeGroupIds(next);
                      }}
                    />
                    <span className="truncate">{g.code} — {g.name}</span>
                  </label>
                );
              })}
            </div>
            <div className="mt-2"><MiniHelp>Group seçilirse Branch ile AND uygulanır (daha dar).</MiniHelp></div>
          </div>
          
          {mismatchedSubgroupIds.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone="warn">UYARI</Badge>
                  <div className="text-sm font-extrabold text-amber-900">Seçili Group/Subgroup uyumsuz</div>
                </div>
                <Button
                  variant="secondary"
                  className="px-3 py-2"
                  disabled={saving}
                  onClick={() => {
                    // Remove subgroups that are not under selected groups
                    setScopeSubgroupIds((prev) => prev.filter((id) => !mismatchedSubgroupIds.includes(id)));
                  }}
                >
                  Uyumsuzları temizle
                </Button>
              </div>
              <div className="mt-2">
                <MiniHelp>
                  Group filtresi açıkken, sadece seçili group’ların altındaki subgroup’lar seçilebilir. Bu uyumsuz seçimler sonucu 0 kayıt görebilirsiniz.
                </MiniHelp>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-sm font-bold text-zinc-900">Subgroup Seçimi (Opsiyonel, Group zorunlu)</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {subgroups.map((sg) => {
                const checked = scopeSubgroupIds.includes(sg.id);
                const parentId = getSubgroupParentId(sg);
                const parent = sg.employeeGroup ? `${sg.employeeGroup.code}` : parentId ? "—" : "—";
                const disabledByGroup = hasGroupFilter && (!!parentId ? !groupSet.has(parentId) : true);
                const isMismatchChecked = checked && disabledByGroup;
                return (
                  <label
                    key={sg.id}
                    className={cx(
                      "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold",
                      disabledByGroup
                        ? "border-zinc-200 bg-zinc-50 text-zinc-400 cursor-not-allowed"
                        : "border-zinc-200 bg-white text-zinc-700"
                    )}
                    title={
                      disabledByGroup
                        ? "Bu subgroup, seçili group’ların altında değil. Önce ilgili group’u seçin."
                        : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabledByGroup && !checked}
                      onChange={(e) => {
                        if (disabledByGroup && !checked) return;
                        const next = e.target.checked ? [...scopeSubgroupIds, sg.id] : scopeSubgroupIds.filter((x) => x !== sg.id);
                        setScopeSubgroupIds(next);
                        // V3: subgroup implies its parent group (auto-add; we do not auto-remove)
                        if (e.target.checked) {
                          const pid = parentId ?? getSubgroupParentId(sg);
                          if (pid && !scopeGroupIds.includes(pid)) setScopeGroupIds((p) => [...p, pid]);
                        }
                      }}
                    />
                    <span className="truncate">
                      {sg.code} — {sg.name}{" "}
                      <span className={cx("text-xs", disabledByGroup ? "text-zinc-400" : "text-zinc-500")}>
                        ({parent})
                      </span>
                      {isMismatchChecked ? <span className="ml-2 text-[11px] font-extrabold text-amber-900">UYUMSUZ</span> : null}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="mt-2">
              <MiniHelp>
                Group seçiliyse sadece o group’ların altındaki subgroup’lar seçilebilir. Subgroup seçildiğinde bağlı olduğu Group otomatik eklenir.
              </MiniHelp>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button variant="secondary" onClick={() => setScopeTargetId(null)} disabled={saving}>
              Vazgeç
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!scopeTargetId) return;
                patchUserScope(scopeTargetId);
              }}
              disabled={saving || !scopeTargetId || scopeBranchIds.length === 0}
            >
              {saving ? "Kaydediliyor..." : "Kapsamı Kaydet"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        open={!!resetTargetId}
        tone="warn"
        title="Şifre Reset"
        subtitle={
          resetTarget ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={roleTone(resetTarget.role)}>{roleShort(resetTarget.role)}</Badge>
              <span className="text-sm font-bold text-zinc-800">{resetTarget.email}</span>
              {!resetTarget.isActive ? <Badge tone="neutral">PASİF</Badge> : <Badge tone="good">AKTİF</Badge>}
            </div>
          ) : (
            "Kullanıcı seçili değil."
          )
        }
        onClose={() => {
          setResetTargetId(null);
          setResetPassword("");
        }}
      >
        <div className="grid gap-3">
          <div>
            <div className="mb-1 text-xs font-bold text-zinc-600 uppercase tracking-wider">Yeni Şifre</div>
            <input
              className={inputClass}
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              type="password"
              placeholder="En az 8 karakter"
              autoFocus
            />
            <div className="mt-1">
              <MiniHelp>Bu işlem kullanıcı şifresini değiştirir. Audit bu fazda yok.</MiniHelp>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              variant="secondary"
              onClick={() => {
                setResetTargetId(null);
                setResetPassword("");
              }}
              disabled={saving}
            >
              Vazgeç
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!resetTargetId) return;
                doResetPassword(resetTargetId);
              }}
              disabled={saving || !resetTargetId}
            >
              {saving ? "Kaydediliyor..." : "Şifreyi Güncelle"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}