"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type GroupItem = {
  id: string;
  code: string;
  name: string;
  policy: null | { assignmentId: string; ruleSet: { id: string; code: string; name: string } };
};

type RuleSet = { id: string; code: string; name: string };

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
        link: "text-sky-700",
      };
    case "good":
      return {
        chip: "bg-emerald-50 text-emerald-800 ring-emerald-200/70",
        soft: "border-emerald-200/70 bg-gradient-to-b from-white to-emerald-50/35",
        solid: "bg-emerald-600 text-white ring-emerald-500/30",
        link: "text-emerald-700",
      };
    case "warn":
      return {
        chip: "bg-amber-50 text-amber-900 ring-amber-200/70",
        soft: "border-amber-200/70 bg-gradient-to-b from-white to-amber-50/45",
        solid: "bg-amber-600 text-white ring-amber-500/30",
        link: "text-amber-800",
      };
    case "violet":
      return {
        chip: "bg-violet-50 text-violet-800 ring-violet-200/70",
        soft: "border-violet-200/70 bg-gradient-to-b from-white to-violet-50/40",
        solid: "bg-violet-600 text-white ring-violet-500/30",
        link: "text-violet-700",
      };
    case "danger":
      return {
        chip: "bg-red-50 text-red-800 ring-red-200/70",
       soft: "border-red-200/70 bg-gradient-to-b from-white to-red-50/40",
        solid: "bg-red-600 text-white ring-red-500/30",
        link: "text-red-700",
      };
    default:
      return {
        chip: "bg-zinc-100 text-zinc-700 ring-zinc-200/70",
        soft: "border-zinc-200/70 bg-white",
       solid: "bg-zinc-900 text-white ring-zinc-800/30",
        link: "text-indigo-700",
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

export default function WorkforceGroupsClient() {
  const [items, setItems] = useState<GroupItem[]>([]);
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [loading, setLoading] = useState(false);

  const [createCode, setCreateCode] = useState("");
  const [createName, setCreateName] = useState("");

  const [editingId, setEditingId] = useState<string>("");
  const editing = useMemo(() => items.find((x) => x.id === editingId) ?? null, [items, editingId]);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");

  const [assignRuleSetIdByGroup, setAssignRuleSetIdByGroup] = useState<Record<string, string>>({});

  async function loadAll() {
    setLoading(true);
    try {
      const [gRes, rsRes] = await Promise.all([
        fetch("/api/workforce/groups", { credentials: "include" }),
        fetch("/api/policy/rule-sets", { credentials: "include" }),
      ]);
      const gJson = await gRes.json().catch(() => null);
      const rsJson = await rsRes.json().catch(() => null);
      setItems(Array.isArray(gJson?.items) ? gJson.items : []);
      setRuleSets(Array.isArray(rsJson?.items) ? rsJson.items : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!editing) return;
    setEditCode(editing.code ?? "");
    setEditName(editing.name ?? "");
  }, [editing]);

  async function createGroup() {
    if (!createCode.trim() || !createName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/workforce/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: createCode.trim(), name: createName.trim() }),
      });
      if (!res.ok) return;
      setCreateCode("");
      setCreateName("");
      await loadAll();
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit() {
    if (!editingId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/workforce/groups/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: editCode.trim(), name: editName.trim() }),
      });
      if (!res.ok) return;
      setEditingId("");
      await loadAll();
    } finally {
      setLoading(false);
    }
  }

  async function deleteGroup(id: string) {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/workforce/groups/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) return;
      await loadAll();
    } finally {
      setLoading(false);
    }
  }

  async function assignPolicy(groupId: string) {
    const ruleSetId = String(assignRuleSetIdByGroup[groupId] ?? "").trim();
    if (!ruleSetId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/policy/assignments-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ employeeGroupId: groupId, ruleSetId }),
      });
      if (!res.ok) return;
      await loadAll();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      {/* Hero / context */}
      <div className={cx("rounded-2xl border p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]", toneStyles("violet").soft)}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-lg font-extrabold tracking-tight text-zinc-900">Segmentler</div>
              <PillBadge tone="violet">Employee Groups</PillBadge>
              {loading ? <PillBadge tone="warn">Yükleniyor</PillBadge> : null}
            </div>
            <div className="mt-1 text-sm text-zinc-600 font-medium leading-relaxed">
              Segment; personelleri üst seviyede sınıflandırır (örn. <b>Ofis</b> / <b>Saha</b> / <b>Vardiya</b>).
              İsterseniz her segmente bir <b>Kural Seti</b> bağlayarak (policy assignment) hedefli kural yönetimi yapabilirsiniz.
            </div>
            <div className="mt-2 text-[11px] text-zinc-500">
              İpucu: Alt kırılım gerekiyorsa <b>Alt Segmentler</b> sayfasını kullanın.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
              href="/workforce"
              title="Workforce ana sayfa"
            >
              İş Gücü Yönetimi
              <span aria-hidden className="text-zinc-400">→</span>
            </Link>
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
              href="/workforce/subgroups"
              title="Alt segmentleri yönet"
            >
              Alt Segmentler
              <span aria-hidden className="text-zinc-400">→</span>
            </Link>
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
              href="/workforce/classification"
              title="Personelleri segmentlere bağla"
            >
              Personel Sınıflandırma
              <span aria-hidden className="text-zinc-400">→</span>
            </Link>
          </div>
        </div>

        <div className={cx("mt-4 rounded-2xl border px-4 py-3", toneStyles("warn").soft)}>
          <div className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">Kısa hatırlatma</div>
          <div className="mt-1 text-sm text-amber-900/90 font-semibold">
            Segment seviyesinde kural seti bağlamak, “üst seviye varsayılan” gibi çalışır.
          </div>
          <div className="mt-1 text-[11px] text-amber-900/70">
            Bu sayfa sadece yönetim arayüzüdür; hesap/motor davranışını burada değiştirmiyoruz.
          </div>
        </div>
      </div>

      {/* Create */}
      <div className={cx("rounded-2xl border p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]", toneStyles("info").soft)}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-extrabold text-zinc-900 tracking-tight">Yeni Segment</div>
              <PillBadge tone="info">Oluştur</PillBadge>
            </div>
            <div className="mt-1 text-xs text-zinc-600 font-medium leading-relaxed">
              Kod kısa ve sabit olsun (örn. <span className="font-mono">WHITE</span>, <span className="font-mono">BLUE</span>).
              İsim ise kullanıcıya görünen açıklamadır.
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <input
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            placeholder="Kod (örn: WHITE)"
            value={createCode}
            onChange={(e) => setCreateCode(e.target.value)}
          />
          <input
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            placeholder="Segment adı (örn: Beyaz Yaka)"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
          />
          <Button
            variant="primary"
            onClick={createGroup}
            disabled={loading || !createCode.trim() || !createName.trim()}
            title={!createCode.trim() || !createName.trim() ? "Kod ve isim zorunlu" : "Segment oluştur"}
          >
            Oluştur
            <span aria-hidden className="text-white/70">
              →
            </span>
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/70 bg-zinc-50/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="text-sm font-extrabold text-zinc-900 tracking-tight">Kayıtlı Segmentler</div>
            <PillBadge tone="neutral">{items.length} adet</PillBadge>
          </div>
          <div className="text-xs text-zinc-500">
            Kural seti bağlamak için: seç → <b>Ata</b>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white text-zinc-600">
              <tr className="border-b border-zinc-200/70">
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider">Kod</th>
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider">Ad</th>
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider">Bağlı Kural Seti</th>
                <th className="px-4 py-3 text-right text-xs font-extrabold uppercase tracking-wider">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {items.map((g) => {
                const selectedRuleSetId = assignRuleSetIdByGroup[g.id] ?? "";
                return (
                  <tr key={g.id} className="border-t border-zinc-200/60 hover:bg-zinc-50/40">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-xl bg-zinc-100 px-2 py-1 font-mono text-xs font-bold text-zinc-800 ring-1 ring-inset ring-zinc-200/70">
                        {g.code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-zinc-900">{g.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <div className="text-xs text-zinc-600">
                          {g.policy ? (
                            <span className="inline-flex flex-wrap items-center gap-2">
                              <PillBadge tone="good">
                                {g.policy.ruleSet.code}
                              </PillBadge>
                              <span className="text-zinc-700 font-semibold">{g.policy.ruleSet.name}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              <PillBadge tone="neutral">Yok</PillBadge>
                              <span className="text-zinc-500">Henüz bağlanmadı</span>
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            value={selectedRuleSetId}
                            onChange={(e) =>
                              setAssignRuleSetIdByGroup((s) => ({ ...s, [g.id]: e.target.value }))
                            }
                          >
                            <option value="">Kural seti seç…</option>
                            {ruleSets.map((rs) => (
                              <option key={rs.id} value={rs.id}>
                                {rs.code} — {rs.name}
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="secondary"
                            disabled={loading || !String(selectedRuleSetId).trim()}
                            onClick={() => assignPolicy(g.id)}
                            title={!String(selectedRuleSetId).trim() ? "Önce kural seti seçin" : "Seçili kural setini ata"}
                          >
                            Ata
                          </Button>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setEditingId(g.id)} disabled={loading}>
                          Düzenle
                        </Button>
                        <Button variant="ghost" onClick={() => deleteGroup(g.id)} disabled={loading} title="Segmenti sil">
                          <span className="text-red-700 font-semibold">Sil</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center" colSpan={4}>
                    <div className="mx-auto max-w-md">
                      <div className="text-sm font-extrabold text-zinc-900">Henüz segment yok</div>
                      <div className="mt-1 text-sm text-zinc-600">
                        Üstteki <b>Yeni Segment</b> alanından ilk segmentinizi oluşturabilirsiniz.
                      </div>
                      <div className="mt-3 text-xs text-zinc-500">{loading ? "Yükleniyor…" : "Hazır olduğunuzda başlayın."}</div>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit */}
      {editing ? (
        <div className={cx("rounded-2xl border p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]", toneStyles("violet").soft)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="text-sm font-extrabold text-zinc-900 tracking-tight">Segment Düzenle</div>
              <PillBadge tone="violet">{editing.code}</PillBadge>
            </div>
            <Button variant="secondary" onClick={() => setEditingId("")}>
              Kapat
            </Button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
            <input
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={editCode}
              onChange={(e) => setEditCode(e.target.value)}
            />
            <input
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <Button variant="primary" onClick={saveEdit} disabled={loading || !editingId}>
              Kaydet
            </Button>
          </div>

          <div className="mt-2 text-xs text-zinc-600">
            Not: Segment silme işleminde ilişkili kayıtlar (alt segment / personel / kural ataması) varsa veritabanı hata dönebilir — bu bilinçli bir korumadır.
          </div>
        </div>
      ) : null}
    </div>
  );
}