"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type ShiftTemplate = {
  id: string;
  signature: string;
  startTime: string;
  endTime: string;
  spansMidnight: boolean;
  isActive: boolean;
  createdAt: string;
};

type Tone = "neutral" | "info" | "good" | "warn" | "danger" | "violet";

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
    neutral: "bg-zinc-100 text-zinc-800 ring-zinc-200",
    info: "bg-sky-50 text-sky-800 ring-sky-200",
    good: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    warn: "bg-amber-50 text-amber-900 ring-amber-200",
    danger: "bg-rose-50 text-rose-800 ring-rose-200",
    violet: "bg-violet-50 text-violet-800 ring-violet-200",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        map[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

function IconChip({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: Tone;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const map: Record<Tone, string> = {
    neutral: "bg-zinc-100 text-zinc-800 ring-zinc-200",
    info: "bg-sky-50 text-sky-800 ring-sky-200",
    good: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    warn: "bg-amber-50 text-amber-900 ring-amber-200",
    danger: "bg-rose-50 text-rose-800 ring-rose-200",
    violet: "bg-violet-50 text-violet-800 ring-violet-200",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset",
        map[tone],
        className
      )}
    >
      <span className="grid place-items-center rounded-full bg-white/60 ring-1 ring-inset ring-black/5 w-5 h-5">
        {icon}
      </span>
      <span>{children}</span>
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
    neutral: "from-zinc-50 to-white",
    info: "from-sky-50 to-white",
    good: "from-emerald-50 to-white",
    warn: "from-amber-50 to-white",
    danger: "from-rose-50 to-white",
    violet: "from-violet-50 to-white",
  };
  return (
    <div
      className={cx(
        "rounded-2xl border border-zinc-200/70 bg-gradient-to-b p-4 shadow-sm min-w-0",
        "hover:shadow-md transition-shadow",
        toneBg[tone],
        className
      )}
    >
      {(title || subtitle || right) ? (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <div className="text-sm font-semibold text-zinc-900 leading-5">{title}</div> : null}
            {subtitle ? <div className="mt-1 text-xs text-zinc-600 leading-5">{subtitle}</div> : null}
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
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition " +
    "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed";
  const map = {
    primary: "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 border border-indigo-600/20",
    secondary: "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50 shadow-sm",
    ghost: "bg-transparent text-zinc-700 hover:bg-zinc-100 border border-transparent",
    danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-700 border border-rose-600/20",
  } as const;
  return <button className={cx(base, map[variant], className)} {...props} />;
}

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white/80 px-3 py-2 text-sm shadow-sm " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500";

function isValidTimeHHmm(v: string) {
  return /^\d{2}:\d{2}$/.test(v);
}

function normalizeTimeHHmm(v: string) {
  // Accept "HH:mm" and "HH:mm:ss" from some browsers, normalize to "HH:mm"
  // Also trims whitespace.
  const s = (v || "").trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);
  return s;
}

function toHHmmCompact(v: string) {
  // "09:00" -> "0900"
  if (!isValidTimeHHmm(v)) return "";
  return v.replace(":", "");
}

function parseMinutes(v: string) {
  // "HH:mm" -> minutes since 00:00
  if (!isValidTimeHHmm(v)) return null;
  const [hh, mm] = v.split(":").map((x) => Number(x));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}s ${m}dk`;
}

function calcDurationMinutes(startTime: string, endTime: string, spansMidnight?: boolean) {
  const startM = parseMinutes(startTime);
  const endM = parseMinutes(endTime);
  if (startM == null || endM == null) return null;
  const overnight = typeof spansMidnight === "boolean" ? spansMidnight : (endM < startM);
  if (startM === endM) return 0;
  return overnight ? (24 * 60 - startM) + endM : (endM - startM);
}

export default function ShiftTemplatesClient() {
  const [items, setItems] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; signature: string } | null>(null);
  const [editBaseline, setEditBaseline] = useState<{ id: string; startTime: string; endTime: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"signature" | "startTime" | "createdAt">("signature");

  const [form, setForm] = useState({
    id: "",
    startTime: "09:00",
    endTime: "18:00",
    mode: "create" as "create" | "edit",
  });

  const helpText = useMemo(() => {
    // UI-only helper text. No behavior change.
    // Signature format:
    // - "0900-1800"
    // - If End < Start => spans midnight => "+1" (next day)
    return "İmza (signature) otomatik üretilir: 0900-1800. Bitiş saati başlangıçtan küçükse bu bir gece vardiyasıdır ve +1 eklenir: 2200-0600+1.";
  }, []);

  const canSubmit = useMemo(() => {
    return isValidTimeHHmm(form.startTime) && isValidTimeHHmm(form.endTime);
  }, [form.startTime, form.endTime]);

  const preview = useMemo(() => {
    const startM = parseMinutes(form.startTime);
    const endM = parseMinutes(form.endTime);
    if (startM == null || endM == null) return null;
    if (startM === endM) {
      return {
        signature: `${toHHmmCompact(form.startTime)}-${toHHmmCompact(form.endTime)}`,
        spansMidnight: false,
        durationMinutes: 0,
        invalidReason: "Start ve End aynı olamaz.",
      };
    }
    const spansMidnight = endM < startM;
    const durationMinutes = spansMidnight ? (24 * 60 - startM) + endM : (endM - startM);
    const signature = `${toHHmmCompact(form.startTime)}-${toHHmmCompact(form.endTime)}${spansMidnight ? "+1" : ""}`;
    return { signature, spansMidnight, durationMinutes, invalidReason: null as string | null };
  }, [form.startTime, form.endTime]);

  const isDirty = useMemo(() => {
    if (form.mode !== "edit") return false;
    if (!editBaseline) return false;
    if (editBaseline.id !== form.id) return false;
    return (
      editBaseline.startTime !== form.startTime ||
      editBaseline.endTime !== form.endTime
    );
  }, [form.mode, form.id, form.startTime, form.endTime, editBaseline]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2000);
    return () => clearTimeout(t);
  }, [notice]);

  const visibleItems = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = items;
    if (query) {
      list = items.filter((it) => {
        const hay = `${it.signature} ${it.startTime} ${it.endTime}`.toLowerCase();
        return hay.includes(query);
      });
    }
    const sorted = [...list].sort((a, b) => {
      if (sort === "signature") {
        return a.signature.localeCompare(b.signature);
      }
      if (sort === "startTime") {
        const am = parseMinutes(a.startTime) ?? Number.MAX_SAFE_INTEGER;
        const bm = parseMinutes(b.startTime) ?? Number.MAX_SAFE_INTEGER;
        if (am !== bm) return am - bm;
        return a.signature.localeCompare(b.signature);
      }
      // createdAt: newest first
      const at = Date.parse(a.createdAt);
      const bt = Date.parse(b.createdAt);
      const av = Number.isFinite(at) ? at : 0;
      const bv = Number.isFinite(bt) ? bt : 0;
      if (av !== bv) return bv - av;
      return a.signature.localeCompare(b.signature);
    });
    return sorted;
  }, [items, q, sort]);

  const editingItem = useMemo(() => {
    if (form.mode !== "edit") return null;
    const it = items.find((x) => x.id === form.id) || null;
    return it;
  }, [form.mode, form.id, items]);

  const editingSignature = useMemo(() => {
    if (editingItem?.signature) return editingItem.signature;
    return preview?.signature ?? null;
  }, [editingItem, preview]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shift-templates?includeInactive=1", { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "LOAD_FAILED");
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      setError(e?.message || "LOAD_FAILED");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setForm({ id: "", startTime: "09:00", endTime: "18:00", mode: "create" });
    setEditBaseline(null);
  }

  async function onSubmit() {
    if (!canSubmit) {
      setError("Saat formatı HH:mm olmalı (örn 09:00).");
      return;
    }
    if (preview?.invalidReason) { setError(preview.invalidReason); return; }
    if (form.mode === "edit" && !isDirty) {
      setError("Güncellenecek bir değişiklik yok.");
      return;
    }
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const body = { startTime: form.startTime, endTime: form.endTime };
      const res =
        form.mode === "create"
          ? await fetch("/api/shift-templates", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            })
          : await fetch(`/api/shift-templates/${form.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "SAVE_FAILED");
      await load();
      resetForm();
      setNotice(form.mode === "create" ? "Template oluşturuldu." : "Template güncellendi.");
    } catch (e: any) {
      const code = String(e?.message || "SAVE_FAILED");
      if (code === "SHIFT_TEMPLATE_ALREADY_EXISTS") {
        const sig = preview?.signature ?? "";
        if (sig) setQ(sig);
        setError("Bu vardiya template’i zaten mevcut. Listeden bulup kullanabilir veya (pasifse) Aktifleştir diyebilirsin.");
      } else {
        setError(code);
      }
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: string) {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/shift-templates/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "DELETE_FAILED");
      await load();
      if (form.id === id) resetForm();
      setNotice("Template pasifleştirildi.");
    } catch (e: any) {
      setError(e?.message || "DELETE_FAILED");
    } finally {
      setLoading(false);
    }
  }

  async function onActivate(id: string) {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/shift-templates/${id}/activate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "ACTIVATE_FAILED");
      await load();
      setNotice("Template aktifleştirildi.");
    } catch (e: any) {
      setError(e?.message || "ACTIVATE_FAILED");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 min-w-0 max-w-full overflow-x-clip">
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            // backdrop click closes
            if (e.target === e.currentTarget) setDeleteConfirm(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-lg border border-zinc-200 p-4">
            <div className="text-lg font-semibold">Şablon pasifleştirilsin mi?</div>
            <div className="mt-1 text-sm text-zinc-600">
              Bu işlem şablonu pasif yapar. İstersen daha sonra tekrar <b>Aktifleştir</b>.
              Seçili şablon:{" "}
              <span className="font-mono font-medium text-zinc-900">{deleteConfirm.signature}</span>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)} disabled={loading}>
                İptal
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  const id = deleteConfirm.id;
                  setDeleteConfirm(null);
                  await onDelete(id);
                }}
                disabled={loading}
              >
                Pasifleştir
              </Button>
            </div>
          </div>
        </div>
      )}
      <Card
        tone="info"
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold">Vardiya Şablonları</span>
            <Badge tone="info">Saat aralığı → otomatik imza</Badge>
            {form.mode === "edit" && editingSignature ? (
              <Badge tone="warn">
                Düzenleniyor: <span className="font-mono">{editingSignature}</span>
              </Badge>
            ) : null}
          </div>
        }
        subtitle={
          <div className="space-y-2">
            <div className="text-xs text-zinc-600">
              Bu ekran, vardiyanın <b>başlangıç</b> ve <b>bitiş</b> saatine göre şablon üretir. Sistem otomatik olarak imza (signature) oluşturur.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <IconChip tone="info" icon={<span className="text-[12px]">🧾</span>}>
                İmza: <span className="font-mono">HHmm-HHmm(+1)</span>
              </IconChip>
              <IconChip tone="good" icon={<span className="text-[12px]">🌙</span>}>
                Gece vardiyası: bitiş &lt; başlangıç → <b>+1</b>
              </IconChip>
              <IconChip tone="neutral" icon={<span className="text-[12px]">🔎</span>}>
                Altta arayabilir & sıralayabilirsin
              </IconChip>
            </div>
            <div className="text-[11px] text-zinc-600">{helpText}</div>
          </div>
        }
        right={
          <Button
            variant="secondary"
            onClick={() => {
              resetForm();
              setError(null);
            }}
          >
            Yeni
          </Button>
        }
      >

        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        
        {notice && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {notice}
          </div>
        )}

        {form.mode === "edit" && (
          <div className="mt-2 text-xs text-zinc-600">
            {isDirty ? (
              <span>Kaydedilmemiş değişiklik var.</span>
            ) : (
              <span>Değişiklik yok.</span>
            )}
          </div>
        )}

        {preview && (
          <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <div className="text-zinc-700">
                <span className="text-zinc-500">Önizleme:</span>{" "}
                <span className="font-mono font-medium">{preview.signature}</span>
              </div>
              <div className="text-zinc-700">
                <span className="text-zinc-500">Toplam Süre:</span>{" "}
                <span className="font-medium">{formatDuration(preview.durationMinutes)}</span>
              </div>
              <div className="text-zinc-700">
                <span className="text-zinc-500">Gece Vardiyası:</span>{" "}
                <span className="font-medium">{preview.spansMidnight ? "Evet (+1)" : "Hayır"}</span>
              </div>
            </div>
            {preview.invalidReason && (
              <div className="mt-1 text-red-700">{preview.invalidReason}</div>
            )}
          </div>
        )}

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-800">Başlangıç</span>
            <input
              type="time"
              className={inputClass}
              value={form.startTime}
              onChange={(e) =>
                setForm((s) => ({ ...s, startTime: normalizeTimeHHmm(e.target.value) }))
              }
              placeholder="09:00"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-800">Bitiş</span>
            <input
              type="time"
              className={inputClass}
              value={form.endTime}
              onChange={(e) =>
                setForm((s) => ({ ...s, endTime: normalizeTimeHHmm(e.target.value) }))
              }
              placeholder="18:00"
            />
          </label>
          <div className="flex items-end gap-2">
            <Button
              className="w-full"
              variant="primary"
              onClick={onSubmit}
              disabled={loading || !canSubmit || !!preview?.invalidReason || (form.mode === "edit" && !isDirty)}
            >
              {form.mode === "create" ? "Oluştur" : "Güncelle"}
            </Button>
            {form.mode === "edit" && (
              <Button variant="secondary" onClick={resetForm}>İptal</Button>
            )}
          </div>
        </div>
      </Card>

      <Card
        tone="neutral"
        className="p-0"
        title="Mevcut Şablonlar"
        subtitle="Arayabilir, sıralayabilir, düzenleyebilir veya pasifleştirebilirsin."
        right={
          <Badge tone="neutral">
            {visibleItems.length}{q.trim() ? ` / ${items.length}` : ""} kayıt
          </Badge>
        }
      >
        <div className="px-4 py-3 border-b border-zinc-200 min-w-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={cx("w-full sm:w-64", inputClass)}
                placeholder="Ara: imza / başlangıç / bitiş"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <select
                className={cx("w-full sm:w-auto min-w-0", inputClass)}
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
              >
                <option value="signature">Sırala: İmza</option>
                <option value="startTime">Sırala: Başlangıç</option>
                <option value="createdAt">Sırala: En Yeni</option>
              </select>
              {q.trim() && (
                <Button variant="secondary" onClick={() => setQ("")} disabled={loading}>
                  Temizle
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={load} disabled={loading}>
              Yenile
            </Button>
          </div>
        </div>

        {/* Mobile-first: no horizontal overflow. Use cards on small/medium screens, table on lg+ */}
        <div className="lg:hidden p-3">
          <div className="grid gap-3">
            {visibleItems.map((it) => {
              const isEditingRow = form.mode === "edit" && form.id === it.id;
              const mins = calcDurationMinutes(it.startTime, it.endTime, it.spansMidnight);
              return (
                <div
                  key={it.id}
                  className={
                    "rounded-2xl border bg-white p-3 shadow-sm " +
                   (isEditingRow ? "border-amber-300 bg-amber-50/60" : "border-zinc-200")
                  }
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-sm font-semibold text-zinc-900">
                          {it.signature}
                        </div>
                        {!it.isActive ? (
                          <Badge tone="neutral" className="ml-2">Pasif</Badge>
                        ) : null}
                        {it.spansMidnight ? (
                          <Badge tone="good">+1</Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-zinc-600">
                        <span className="font-medium">{it.startTime}</span> →{" "}
                        <span className="font-medium">{it.endTime}</span>
                        {" • "}
                        <span className="text-zinc-500">Süre:</span>{" "}
                        <span className="font-medium">{mins == null ? "—" : formatDuration(mins)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-wrap justify-end gap-2">
                      {
                        !it.isActive ? (
                          <Button variant="secondary" onClick={() => onActivate(it.id)} disabled={loading}>
                            Aktifleştir
                          </Button>
                        ) : null
                      }
                      <Button
                        variant="secondary"
                        className="px-3 py-1.5"
                        onClick={() => {
                          setError(null);
                          setForm({
                            id: it.id,
                            startTime: it.startTime,
                            endTime: it.endTime,
                            mode: "edit",
                          });
                          setEditBaseline({
                            id: it.id,
                            startTime: it.startTime,
                            endTime: it.endTime,
                          });
                        }}
                      >
                        Düzenle
                      </Button>
                      <Button
                        variant="secondary"
                        className="px-3 py-1.5 text-red-700 border-red-200 hover:bg-red-50"
                          onClick={() =>
                          setDeleteConfirm({
                            id: it.id,
                            signature: it.signature,
                          })
                        }
                        disabled={loading}
                      >
                        Pasifleştir
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {visibleItems.length === 0 && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
                {items.length === 0 ? "Henüz şablon yok." : "Aramanla eşleşen şablon bulunamadı."}
              </div>
            )}
          </div>
        </div>

        {/* Table view (lg+). Keep any overflow inside this card to prevent page-level horizontal scroll. */}
        <div className="hidden lg:block overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-700">
              <tr>
                <th className="text-left px-4 py-3">İmza</th>
                <th className="text-left px-4 py-3">Başlangıç</th>
                <th className="text-left px-4 py-3">Bitiş</th>
                <th className="text-left px-4 py-3">Süre</th>
                <th className="text-left px-4 py-3">
                  <div className="leading-tight">+1</div>
                  <div className="text-[11px] font-normal text-zinc-500">Gece</div>
                </th>
                <th className="text-right px-4 py-3">İşlemler</th>
              </tr>
            </thead>
           <tbody className="divide-y divide-zinc-100">
              {visibleItems.map((it) => (
                (() => {
                  const isEditingRow = form.mode === "edit" && form.id === it.id;
                  return (
                <tr
                  key={it.id}
                  className={
                    isEditingRow
                      ? "bg-amber-50/80 text-zinc-900"
                      : undefined
                  }
                >
                  <td
                    className={
                      "px-4 py-3 font-mono " +
                      (isEditingRow ? "border-l-4 border-amber-400 pl-3" : "")
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span>{it.signature}</span>
                      {!it.isActive ? (
                        <Badge tone="neutral">Pasif</Badge>
                      ) : null}
                      {it.spansMidnight ? (
                        <Badge tone="good">+1</Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">{it.startTime}</td>
                  <td className="px-4 py-3">{it.endTime}</td>
                  <td className="px-4 py-3">
                    {(() => {
                      const mins = calcDurationMinutes(it.startTime, it.endTime, it.spansMidnight);
                      return mins == null ? "—" : formatDuration(mins);
                    })()}
                  </td>
                  <td className="px-4 py-3">{it.spansMidnight ? "✅" : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {!it.isActive ? (
                        <Button variant="secondary" onClick={() => onActivate(it.id)} disabled={loading}>
                          Aktifleştir
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            className="px-3 py-1.5"
                            onClick={() => {
                              setError(null);
                              setForm({
                                id: it.id,
                                startTime: it.startTime,
                                endTime: it.endTime,
                                mode: "edit",
                              });
                              setEditBaseline({
                                id: it.id,
                                startTime: it.startTime,
                                endTime: it.endTime,
                              });
                            }}
                            disabled={loading}
                          >
                            Düzenle
                          </Button>
                          <Button
                            variant="secondary"
                            className="px-3 py-1.5 text-red-700 border-red-200 hover:bg-red-50"
                            onClick={() =>
                              setDeleteConfirm({
                                id: it.id,
                                signature: it.signature,
                              })
                            }
                            disabled={loading}
                          >
                            Pasifleştir
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                );
                })()
              ))}
             {visibleItems.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-zinc-600" colSpan={6}>
                    {items.length === 0 ? "Henüz şablon yok." : "Aramanla eşleşen şablon bulunamadı."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}