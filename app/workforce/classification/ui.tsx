"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Group = { id: string; code: string; name: string };
type Subgroup = { id: string; code: string; name: string; groupId: string; group: { code: string; name: string } };

type EmployeeItem = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  branch?: { code: string; name: string } | null;
  employeeGroupId: string | null;
  employeeSubgroupId: string | null;
  employeeGroup?: { code: string; name: string } | null;
  employeeSubgroup?: { code: string; name: string; groupId: string } | null;
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
    <button className={cx(base, styles)} onClick={onClick} disabled={disabled} title={title}>
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
      <span aria-hidden className="text-zinc-400">→</span>
    </Link>
  );
}

function fullName(e: EmployeeItem) {
  return `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim();
}

export default function WorkforceClassificationClient() {
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subgroups, setSubgroups] = useState<Subgroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  async function loadAll() {
    setLoading(true);
    try {
      const [eRes, gRes, sgRes] = await Promise.all([
        fetch("/api/workforce/classification", { credentials: "include" }),
        fetch("/api/workforce/groups", { credentials: "include" }),
        fetch("/api/workforce/subgroups", { credentials: "include" }),
      ]);
      const eJson = await eRes.json().catch(() => null);
      const gJson = await gRes.json().catch(() => null);
      const sgJson = await sgRes.json().catch(() => null);

      setEmployees(Array.isArray(eJson?.items) ? eJson.items : []);
      setGroups(Array.isArray(gJson?.items) ? gJson.items : []);
      setSubgroups(Array.isArray(sgJson?.items) ? sgJson.items : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((e) => {
      const blob = `${e.employeeCode} ${fullName(e)} ${(e.branch?.code ?? "")} ${(e.branch?.name ?? "")}`.toLowerCase();
      return blob.includes(term);
    });
  }, [employees, q]);

  const selectedCount = useMemo(() => {
    // purely visual metric (no business logic) — just to show how many have group/subgroup set
    let n = 0;
    for (const e of filtered) {
      if (e.employeeGroupId || e.employeeSubgroupId) n++;
    }
    return n;
  }, [filtered]);

  const subgroupsByGroupId = useMemo(() => {
    const m = new Map<string, Subgroup[]>();
    for (const sg of subgroups) {
      const arr = m.get(sg.groupId) ?? [];
      arr.push(sg);
      m.set(sg.groupId, arr);
    }
    // keep stable sort
    for (const [k, arr] of m) {
      arr.sort((a, b) => a.code.localeCompare(b.code));
      m.set(k, arr);
    }
    return m;
  }, [subgroups]);

  async function setClassification(employeeId: string, employeeGroupId: string | null, employeeSubgroupId: string | null) {
    setLoading(true);
    try {
      const res = await fetch("/api/workforce/classification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ employeeId, employeeGroupId, employeeSubgroupId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        alert(json?.error ?? "save_failed");
        return;
      }
      await loadAll();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      {/* Hero */}
      <div className={cx("rounded-2xl border p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]", toneStyles("violet").soft)}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-lg font-extrabold tracking-tight text-zinc-900">Personel Sınıflandırma</div>
              <PillBadge tone="violet">Employee → Group / Subgroup</PillBadge>
              {loading ? <PillBadge tone="warn">Yükleniyor</PillBadge> : null}
            </div>
            <div className="mt-1 text-sm text-zinc-600 font-medium leading-relaxed">
              Personelleri <b>Segment</b> ve <b>Alt Segment</b> ile eşleştirerek kuralların hedefini netleştirin.
              Bu ekran sadece atama yönetir; hesap/motor değişmez.
            </div>
           <div className="mt-2 text-[11px] text-zinc-500">
              İpucu: Önce Segment/Alt Segment tanımlarını yapın, sonra burada personellere bağlayın.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <LinkButton href="/workforce" title="Workforce ana sayfa">Workforce</LinkButton>
            <LinkButton href="/workforce/groups" title="Segmentleri yönet">Segmentler</LinkButton>
            <LinkButton href="/workforce/subgroups" title="Alt segmentleri yönet">Alt Segmentler</LinkButton>
          </div>
        </div>

        <div className={cx("mt-4 rounded-2xl border px-4 py-3", toneStyles("warn").soft)}>
          <div className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">Kural / Guard</div>
          <div className="mt-1 text-sm text-amber-900/90 font-semibold">
            Alt segment seçilirse kendi segmenti otomatik uygulanır.
          </div>
          <div className="mt-1 text-[11px] text-amber-900/70">
            Segment/Alt segment çakışırsa API <span className="font-mono">SUBGROUP_GROUP_MISMATCH</span> döner.
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className={cx("rounded-2xl border p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]", toneStyles("info").soft)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-extrabold text-zinc-900 tracking-tight">Arama</div>
              <PillBadge tone="neutral">{filtered.length} sonuç</PillBadge>
              <PillBadge tone="good">{selectedCount} atanmış</PillBadge>
            </div>
            <div className="mt-1 text-xs text-zinc-600 font-medium">
              employeeCode, isim veya şube kodu/adı ile filtreleyin.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="w-full max-w-md rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Ara: sicil, ad soyad, şube…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Button variant="primary" onClick={loadAll} disabled={loading} title="Listeyi yenile">
              Yenile
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/70 bg-zinc-50/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="text-sm font-extrabold text-zinc-900 tracking-tight">Personel Listesi</div>
            <PillBadge tone="violet">Atama</PillBadge>
          </div>
          <div className="text-xs text-zinc-500">
            Her satır ayrı kaydedilir. Değişiklikten sonra <b>Kaydet</b>.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white text-zinc-600">
              <tr className="border-b border-zinc-200/70">
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider">Sicil</th>
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider">Ad Soyad</th>
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider">Şube</th>
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider">Segment</th>
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider">Alt Segment</th>
                <th className="px-4 py-3 text-right text-xs font-extrabold uppercase tracking-wider">Kaydet</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const groupId = e.employeeGroupId ?? "";
                const sgList = groupId ? subgroupsByGroupId.get(groupId) ?? [] : [];
                return (
                  <Row
                    key={e.id}
                    e={e}
                    groups={groups}
                    subgroups={sgList}
                    disabled={loading}
                    onSave={(gid, sgid) => setClassification(e.id, gid, sgid)}
                  />
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center" colSpan={6}>
                    <div className="mx-auto max-w-md">
                      <div className="text-sm font-extrabold text-zinc-900">Kayıt bulunamadı</div>
                      <div className="mt-1 text-sm text-zinc-600">
                        Arama kriterini değiştirin veya <b>Yenile</b> ile listeyi güncelleyin.
                      </div>
                      <div className="mt-3 text-xs text-zinc-500">{loading ? "Yükleniyor…" : "Hazır olduğunuzda devam edin."}</div>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
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
  onSave,
}: {
  e: EmployeeItem;
  groups: Group[];
  subgroups: Subgroup[];
  disabled: boolean;
  onSave: (employeeGroupId: string | null, employeeSubgroupId: string | null) => void;
}) {
  const [gid, setGid] = useState<string>(e.employeeGroupId ?? "");
  const [sgid, setSgid] = useState<string>(e.employeeSubgroupId ?? "");

  useEffect(() => {
   setGid(e.employeeGroupId ?? "");
    setSgid(e.employeeSubgroupId ?? "");
  }, [e.employeeGroupId, e.employeeSubgroupId]);

  useEffect(() => {
    // If group changes, clear subgroup if it doesn't belong
    if (!gid) {
      if (sgid) setSgid("");
      return;
    }
    if (sgid && !subgroups.find((s) => s.id === sgid)) {
      setSgid("");
    }
  }, [gid, subgroups, sgid]);

  return (
    <tr className="border-t border-zinc-200/60 hover:bg-zinc-50/40">
      <td className="px-4 py-3">
        <span className="inline-flex items-center rounded-xl bg-zinc-100 px-2 py-1 font-mono text-xs font-bold text-zinc-800 ring-1 ring-inset ring-zinc-200/70">
          {e.employeeCode}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="font-semibold text-zinc-900">{fullName(e)}</div>
      </td>
      <td className="px-4 py-3 text-xs text-zinc-600">
        {e.branch ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-xl bg-zinc-100 px-2 py-1 font-mono text-[11px] font-bold text-zinc-800 ring-1 ring-inset ring-zinc-200/70">
              {e.branch.code}
            </span>
            <span className="text-zinc-700 font-medium">{e.branch.name}</span>
          </span>
        ) : (
          <span className="italic">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <select
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          value={gid}
          onChange={(ev) => setGid(ev.target.value)}
          disabled={disabled}
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
          value={sgid}
          onChange={(ev) => setSgid(ev.target.value)}
          disabled={disabled || !gid}
        >
          <option value="">(seçilmedi)</option>
          {subgroups.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 text-right">
        <Button
          variant="primary"
          onClick={() => onSave(gid ? gid : null, sgid ? sgid : null)}
          disabled={disabled}
        >
          Kaydet
        </Button>
      </td>
    </tr>
  );
}