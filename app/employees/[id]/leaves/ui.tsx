"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import EmployeeDetailSubnav from "../_components/EmployeeDetailSubnav";
import EmployeeHistoricalModeBanner from "../_components/EmployeeHistoricalModeBanner";

type LeaveItem = {
  id: string;
  dateFrom: string;
  dateTo: string;
  type: string;
  note: string | null;
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/* ---------- Weekly Plan ile aynı UI kit ---------- */

function Card({
  title,
  description,
  right,
  children,
  className,
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-2xl border border-zinc-200/70 bg-white shadow-sm min-w-0 max-w-full",
        "ring-1 ring-black/0",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-3 min-w-0 max-w-full">
        <div className="min-w-0 max-w-full">
          <h2 className="text-[15px] font-semibold text-zinc-900">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-zinc-500">{description}</p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="px-5 py-3 min-w-0 max-w-full">{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium text-zinc-500">{children}</span>;
}

function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  className,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium " +
    "transition focus:outline-none focus:ring-2 focus:ring-zinc-900/10 disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-zinc-900 text-white hover:bg-zinc-800"
      : variant === "secondary"
        ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
        : variant === "danger"
          ? "bg-red-600 text-white hover:bg-red-500"
          : "bg-transparent text-zinc-900 hover:bg-zinc-100";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(base, styles, "shadow-sm", className)}
    >
      {children}
    </button>
  );
}

function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900",
        "placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10",
        className,
      )}
    />
  );
}

function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(
        "h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900",
        "focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10",
        className,
      )}
    />
  );
}

function Badge({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "warn" | "ok";
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : tone === "warn"
        ? "bg-amber-50 text-amber-900 ring-amber-200"
        : "bg-sky-50 text-sky-900 ring-sky-200";
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1",
        cls,
      )}
    >
      {children}
    </span>
  );
}

/* ---------- helpers ---------- */

function typeLabel(t: string) {
  switch (t) {
    case "ANNUAL":
      return "Yıllık";
    case "SICK":
      return "Rapor";
    case "EXCUSED":
      return "Mazeret";
    case "UNPAID":
      return "Ücretsiz";
    default:
      return t;
  }
}

function typeTone(t: string): "info" | "warn" | "ok" {
  if (t === "SICK") return "warn";
  if (t === "ANNUAL") return "ok";
  return "info";
}

function overlapsDay(item: LeaveItem, dayKey: string): boolean {
  const from = String(item.dateFrom ?? "").slice(0, 10);
  const to = String(item.dateTo ?? "").slice(0, 10);
  const day = String(dayKey ?? "").slice(0, 10);
  if (!from || !to || !day) return false;
  return from <= day && day <= to;
}

export default function LeavesClient({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const asOf = String(searchParams.get("asOf") ?? "").trim();
  const isHistorical = Boolean(asOf);

  const [items, setItems] = useState<LeaveItem[]>([]);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [type, setType] = useState<string>("ANNUAL");
  const [note, setNote] = useState<string>("");

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const displayedItems = useMemo(() => {
    if (!isHistorical) return items;
    return items.filter((item) => overlapsDay(item, asOf));
  }, [items, isHistorical, asOf]);

  const filteredCount = useMemo(() => displayedItems.length, [displayedItems]);

  const historyMeta = useMemo(
    () =>
      isHistorical
        ? {
            dayKey: asOf,
            todayDayKey: "",
            isHistorical: true,
            canEdit: false,
            mode: "AS_OF" as const,
            profileSource: "AS_OF_CONTEXT",
            orgSource: "AS_OF_CONTEXT",
          }
        : null,
    [isHistorical, asOf],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (!isHistorical) {
        if (from) params.set("from", from);
        if (to) params.set("to", to);
      }

      const res = await fetch(`/api/employees/${id}/leaves?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(text || "Failed to load leaves");
      }
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setError(e?.message ?? "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isHistorical]);

  // Auto-dismiss notice
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  async function create() {
    if (isHistorical) {
      setError("Geçmiş modunda izin ekleme kapalıdır.");
      return;
    }
    if (!dateFrom || !dateTo || !type || creating) return;
    setError(null);
    setNotice(null);
    setCreating(true);
    try {
      const res = await fetch(`/api/employees/${id}/leaves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          dateFrom,
          dateTo,
          type,
          note: note || undefined,
        }),
      });

      if (res.status === 400) {
        const data = await res.json().catch(() => null);
        setError(
          data?.message ?? "İzin başlangıç tarihi bitiş tarihinden büyük olamaz.",
        );
        return;
      }

      if (res.status === 409) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? "Bu tarihlerde zaten izin kaydı var.");
        return;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(text || "Create failed");
      }

      // Reset form and reload list
      setDateFrom("");
      setDateTo("");
      setType("ANNUAL");
      setNote("");
      await load();
      setNotice("İzin kaydı eklendi.");
    } catch (e: any) {
      setError(e?.message ?? "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function remove(leaveId: string) {
    if (isHistorical) {
      setError("Geçmiş modunda izin silme kapalıdır.");
      return;
    }
    if (deletingId) return;
    setError(null);
    setNotice(null);
    setDeletingId(leaveId);
    try {
      const res = await fetch(`/api/employees/${id}/leaves/${leaveId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(text || "Delete failed");
      }
      await load();
      setNotice("İzin kaydı silindi.");
    } catch (e: any) {
      setError(e?.message ?? "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="grid gap-5 max-w-full min-w-0">
      <EmployeeDetailSubnav id={id} current="leaves" />
      <EmployeeHistoricalModeBanner history={historyMeta} />

      {isHistorical ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="font-semibold">Geçmiş izin görünümü</div>
          <div className="mt-1 text-amber-800/90">
            Bu ekran seçilen <span className="font-medium">as-of</span> tarihindeki izin durumunu read-only olarak gösterir.
            Geçmiş modunda filtre, ekleme ve silme kapalıdır.
          </div>
        </div>
      ) : null}
      
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold">İşlem sırasında hata</div>
              <div className="mt-1 break-words text-red-800/90">{error}</div>
            </div>
            <Button variant="ghost" className="h-8 px-2" onClick={() => setError(null)}>
              Kapat
            </Button>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold">Bilgi</div>
              <div className="mt-1 break-words text-sky-800/90">{notice}</div>
            </div>
            <Button variant="ghost" className="h-8 px-2" onClick={() => setNotice(null)}>
              Kapat
            </Button>
          </div>
        </div>
      ) : null}

      {/* Top layout: Filter + Create (Weekly Plan ruhu: iki kartlı düzen) */}
      <div className="grid gap-5 lg:grid-cols-12 max-w-full min-w-0">
        <div className="lg:col-span-5 min-w-0">
          <Card
            title="Filtre"
            description={
              isHistorical
                ? "Geçmiş modunda seçilen tarihte aktif olan izin kayıtları gösterilir"
                : "Tarih aralığına göre izin kayıtlarını listeleyin"
            }
            right={
              <Badge tone={isHistorical ? "warn" : loading ? "warn" : "info"}>
                {loading ? "Yükleniyor" : `${filteredCount} kayıt`}
              </Badge>
            }
          >
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <Label>Başlangıç</Label>
                  <Input
                    type="date"
                    value={isHistorical ? asOf : from}
                    disabled={isHistorical}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <label className="grid gap-1.5">
                  <Label>Bitiş</Label>
                  <Input
                    type="date"
                    value={isHistorical ? asOf : to}
                    disabled={isHistorical}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={load}
                  disabled={loading || isHistorical}
                >
                  {loading ? "Yükleniyor…" : "Filtrele"}
                </Button>
                {!isHistorical && (from || to) ? (
                  <Button
                    variant="ghost"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setFrom("");
                      setTo("");
                      // filtre temizleyince listeyi de yenileyelim
                      setTimeout(load, 0);
                    }}
                  >
                    Temizle
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-7 min-w-0">
          <Card
            title="İzin Ekle"
            description={
              isHistorical
                ? "Geçmiş modunda izin oluşturma kapalıdır"
                : "Yeni izin kaydı oluşturun"
            }
            right={isHistorical ? <Badge tone="warn">Read-only</Badge> : null}
          >
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <Label>Tarih (Başlangıç)</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    disabled={isHistorical}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </label>
                <label className="grid gap-1.5">
                  <Label>Tarih (Bitiş)</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    disabled={isHistorical}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <Label>Tür</Label>
                  <Select value={type} disabled={isHistorical} onChange={(e) => setType(e.target.value)}>
                    <option value="ANNUAL">ANNUAL</option>
                    <option value="SICK">SICK</option>
                    <option value="EXCUSED">EXCUSED</option>
                    <option value="UNPAID">UNPAID</option>
                  </Select>
                </label>
                <label className="grid gap-1.5">
                  <Label>Not</Label>
                  <Input
                    value={note}
                    disabled={isHistorical}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Opsiyonel"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  className="w-full sm:w-auto"
                  onClick={create}
                  disabled={isHistorical || creating || !dateFrom || !dateTo || !type}
                >
                  {isHistorical ? "Geçmiş Modu" : creating ? "Kaydediliyor…" : "İzin Ekle"}
                </Button>
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setType("ANNUAL");
                    setNote("");
                    setError(null);
                  }}
                  disabled={creating || isHistorical}
                >
                  Temizle
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* List */}
      <Card title="İzin Kayıtları" description="Personelin tarih bazlı izinleri">
        {displayedItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500">
            {isHistorical ? "Seçilen tarihte aktif izin kaydı yok." : "Kayıt yok."}
          </div>
        ) : (
          <div className="overflow-x-auto max-w-full min-w-0">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs font-medium text-zinc-500">
                  <th className="whitespace-nowrap border-b border-zinc-200/70 py-2 pr-4">Başlangıç</th>
                  <th className="whitespace-nowrap border-b border-zinc-200/70 py-2 pr-4">Bitiş</th>
                  <th className="whitespace-nowrap border-b border-zinc-200/70 py-2 pr-4">Tür</th>
                  <th className="border-b border-zinc-200/70 py-2 pr-4">Not</th>
                  <th className="whitespace-nowrap border-b border-zinc-200/70 py-2 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {displayedItems.map((it) => (
                  <tr key={it.id} className="text-sm text-zinc-900">
                    <td className="whitespace-nowrap border-b border-zinc-100 py-2 pr-4 text-zinc-800">
                      {it.dateFrom}
                    </td>
                    <td className="whitespace-nowrap border-b border-zinc-100 py-2 pr-4 text-zinc-800">
                      {it.dateTo}
                    </td>
                    <td className="whitespace-nowrap border-b border-zinc-100 py-2 pr-4">
                      <Badge tone={typeTone(it.type)}>{typeLabel(it.type)}</Badge>
                    </td>
                    <td className="border-b border-zinc-100 py-2 pr-4 text-zinc-700">
                      {it.note ?? "—"}
                    </td>
                    <td className="whitespace-nowrap border-b border-zinc-100 py-2 text-right">
                      <Button
                        variant="danger"
                        className="h-9 px-3"
                        onClick={() => remove(it.id)}
                        disabled={isHistorical || deletingId === it.id}
                      >
                        {isHistorical ? "Geçmiş Modu" : deletingId === it.id ? "Siliniyor…" : "Sil"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
