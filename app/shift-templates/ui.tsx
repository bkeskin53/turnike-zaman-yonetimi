"use client";

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
    return "Signature otomatik üretilir (0900-1800). End, Start’tan küçükse gece vardiyası sayılır ve +1 eklenir (2200-0600+1).";
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
    <div className="grid gap-6">
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
            <div className="text-lg font-semibold">Template silinsin mi?</div>
            <div className="mt-1 text-sm text-zinc-600">
              Bu işlem template’i pasif yapar. İstersen daha sonra tekrar Aktifleştir. Seçili template:{" "}
              <span className="font-mono font-medium text-zinc-900">{deleteConfirm.signature}</span>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
                onClick={() => setDeleteConfirm(null)}
                disabled={loading}
              >
                Vazgeç
              </button>
              <button
                className="rounded-xl border border-red-200 bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-500 disabled:opacity-50"
                onClick={async () => {
                  const id = deleteConfirm.id;
                  setDeleteConfirm(null);
                  await onDelete(id);
                }}
                disabled={loading}
              >
                Pasifleştir
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="rounded-2xl bg-white shadow-sm border border-zinc-200 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="grid gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-lg font-semibold">Template Yönetimi</div>
              {form.mode === "edit" && editingSignature && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Düzenleniyor: <span className="font-mono">{editingSignature}</span>
                </span>
              )}
            </div>
            <div className="text-sm text-zinc-600">
              Signature otomatik türetilir: <code>HHmm-HHmm(+1)</code>
            </div>
            <div className="text-xs text-zinc-500">
              {helpText}
            </div>
          </div>
          <button
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
            onClick={() => {
              resetForm();
              setError(null);
            }}
          >
            Yeni
          </button>
        </div>

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

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-sm text-zinc-700">Start</span>
            <input
              className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              value={form.startTime}
              onChange={(e) =>
                setForm((s) => ({ ...s, startTime: normalizeTimeHHmm(e.target.value) }))
              }
              placeholder="09:00"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-zinc-700">End</span>
            <input
              type="time"
              className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              value={form.endTime}
              onChange={(e) =>
                setForm((s) => ({ ...s, endTime: normalizeTimeHHmm(e.target.value) }))
              }
              placeholder="18:00"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              className="w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-50"
              onClick={onSubmit}
              disabled={loading || !canSubmit || !!preview?.invalidReason || (form.mode === "edit" && !isDirty)}
            >
              {form.mode === "create" ? "Oluştur" : "Güncelle"}
            </button>
            {form.mode === "edit" && (
              <button
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
                onClick={resetForm}
              >
                İptal
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-sm border border-zinc-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
          <div className="grid gap-2">
            <div className="text-sm font-medium">
              Templates ({visibleItems.length}
              {q.trim() ? ` / ${items.length}` : ""})
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="w-full sm:w-64 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                placeholder="Ara: signature / start / end"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <select
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
              >
                <option value="signature">Sırala: Signature</option>
                <option value="startTime">Sırala: Start</option>
                <option value="createdAt">Sırala: En Yeni</option>
              </select>
              {q.trim() && (
                <button
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
                  onClick={() => setQ("")}
                 disabled={loading}
                >
                  Temizle
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
              onClick={load}
              disabled={loading}
            >
              Yenile
            </button>
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-sm font-semibold text-zinc-900">
                          {it.signature}
                        </div>
                        {!it.isActive ? (
                          <span className="ml-2 inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                            Pasif
                          </span>
                        ) : null}
                        {it.spansMidnight ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            +1
                          </span>
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
                    <div className="shrink-0 flex items-center gap-2">
                      {
                        !it.isActive ? (
                          <button
                            className="rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50"
                            onClick={() => onActivate(it.id)}
                            disabled={loading}
                          >
                            Aktifleştir
                          </button>
                        ) : null
                      }
                      <button
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
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
                      </button>
                      <button
                        className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                        onClick={() =>
                          setDeleteConfirm({
                            id: it.id,
                            signature: it.signature,
                          })
                        }
                        disabled={loading}
                      >
                        Pasifleştir
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {visibleItems.length === 0 && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
                {items.length === 0 ? "Henüz template yok." : "Aramanla eşleşen template bulunamadı."}
              </div>
            )}
          </div>
        </div>

        {/* Table view (lg+). Keep any overflow inside this card to prevent page-level horizontal scroll. */}
        <div className="hidden lg:block overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-700">
              <tr>
                <th className="text-left px-4 py-3">Signature</th>
                <th className="text-left px-4 py-3">Start</th>
                <th className="text-left px-4 py-3">End</th>
                <th className="text-left px-4 py-3">Süre</th>
                <th className="text-left px-4 py-3">
                  <div className="leading-tight">+1</div>
                  <div className="text-[11px] font-normal text-zinc-500">Gece</div>
                </th>
                <th className="text-right px-4 py-3">Actions</th>
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
                        <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                          Pasif
                        </span>
                      ) : null}
                      {it.spansMidnight ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                          +1
                        </span>
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
                        <button
                          className="rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50"
                          onClick={() => onActivate(it.id)}
                          disabled={loading}
                        >
                          Aktifleştir
                        </button>
                      ) : (
                        <>
                          <button
                            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
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
                          </button>
                          <button
                            className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                            onClick={() =>
                              setDeleteConfirm({
                                id: it.id,
                                signature: it.signature,
                              })
                            }
                            disabled={loading}
                          >
                            Pasifleştir
                          </button>
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
                    {items.length === 0 ? "Henüz template yok." : "Aramanla eşleşen template bulunamadı."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}