"use client";

import { useEffect, useMemo, useState } from "react";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type Tone = "neutral" | "info" | "good" | "warn" | "violet" | "danger";
function toneStyles(tone: Tone) {
  switch (tone) {
    case "info":
      return { chip: "bg-sky-50 text-sky-800 ring-sky-200/70", soft: "border-sky-200/70 bg-gradient-to-b from-white to-sky-50/40" };
    case "good":
      return { chip: "bg-emerald-50 text-emerald-800 ring-emerald-200/70", soft: "border-emerald-200/70 bg-gradient-to-b from-white to-emerald-50/35" };
    case "warn":
      return { chip: "bg-amber-50 text-amber-900 ring-amber-200/70", soft: "border-amber-200/70 bg-gradient-to-b from-white to-amber-50/45" };
    case "violet":
      return { chip: "bg-violet-50 text-violet-800 ring-violet-200/70", soft: "border-violet-200/70 bg-gradient-to-b from-white to-violet-50/40" };
    case "danger":
      return { chip: "bg-rose-50 text-rose-800 ring-rose-200/70", soft: "border-rose-200/70 bg-gradient-to-b from-white to-rose-50/40" };
    default:
      return { chip: "bg-zinc-100 text-zinc-700 ring-zinc-200/70", soft: "border-zinc-200/70 bg-white" };
  }
}

function PillBadge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  const t = toneStyles(tone);
  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-tight ring-1 ring-inset shadow-sm", t.chip)}>
      {children}
    </span>
  );
}

type InboxRow = {
  id: string;
  occurredAt: string;
  direction: "IN" | "OUT";
  status: "PENDING" | "RESOLVED" | "IGNORED";
  cardNo: string | null;
  deviceUserId: string | null;
  device?: { id: string; name: string } | null;
  door?: { id: string; code: string; name: string } | null;
};

type EmployeeItem = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
};

function fmt(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

async function readJsonSafe(r: Response) {
  const text = await r.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function DeviceInboxClient(props: { canResolve: boolean; role: string | null }) {
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [employeesDenied, setEmployeesDenied] = useState(false);

  // satır bazlı seçilen personel
  const [pick, setPick] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // kart değişimi / userId değişimi onayı gereken satır
  const [needConfirm, setNeedConfirm] = useState<{
    inboxId: string;
    reasonCode: string;
    message: string;
  } | null>(null);

  async function loadInbox(opts?: { keepInfo?: boolean }) {
    setLoading(true);
    setErr(null);
    setAccessDenied(false);
    if (!opts?.keepInfo) setInfo(null);

    try {
      // credentials: "include" eklendi. API çağrılarında oturum çerezinin gönderilmesi için gereklidir.
      const r = await fetch("/api/device-inbox?status=PENDING&take=200", { credentials: "include" });
      const j = await readJsonSafe(r);
      if (r.status === 403) {
        setAccessDenied(true);
        setRows([]);
        return;
      }
      if (!r.ok || !j?.ok) {
        setErr(j?.error ?? `Inbox API hata: ${r.status}`);
        setRows([]);
      } else {
        setRows(j.rows ?? []);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Inbox yüklenemedi");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadEmployees() {
    try {
      // credentials: "include" eklendi. Oturum çerezi olmadan 401 dönebiliyor.
      const r = await fetch("/api/employees", { credentials: "include" });
      if (r.status === 403) {
        setEmployeesDenied(true);
        setEmployees([]);
        return;
      }
      const j = await readJsonSafe(r);
      const items = (j?.items ?? []) as EmployeeItem[];
      setEmployees(items.filter((x) => x.isActive));
    } catch {
      setEmployees([]);
    }
  }

  useEffect(() => {
    loadEmployees();
    loadInbox();
  }, []);

  const employeeOptions = useMemo(() => {
    return employees.map((e) => ({
      id: e.id,
      label: `${e.employeeCode} - ${e.firstName} ${e.lastName}`,
    }));
  }, [employees]);

  async function resolveOne(inboxId: string, opts?: { allowReplaceIdentity?: boolean }) {
    setErr(null);
    setInfo(null);
    setNeedConfirm(null);
    if (!props.canResolve) {
      setErr("Bu işlem için yetkiniz yok. (Read-only)");
      return;
    }

    const employeeId = pick[inboxId];
    if (!employeeId) {
      setErr("Önce personel seçmelisin.");
      return;
    }

    setResolvingId(inboxId);
    try {
      const r = await fetch("/api/device-inbox/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          inboxId,
          employeeId,
          allowReplaceIdentity: Boolean(opts?.allowReplaceIdentity),
        }),
      });

      const j = await readJsonSafe(r);

      if (!r.ok || !j?.ok) {
        const code = j?.code as string | undefined;

        // Kart/User ID başka çalışanda kayıtlı veya seçilen personelde farklı bir kimlik varsa -> onay iste.
        if (
          r.status === 409 &&
          (code === "EMPLOYEE_HAS_DIFFERENT_CARD" ||
            code === "EMPLOYEE_HAS_DIFFERENT_USER_ID" ||
            code === "CARD_ALREADY_ASSIGNED" ||
            code === "USER_ALREADY_ASSIGNED")
        ) {
          setErr(j?.error ?? "Seçilen kimlik kullanımda. Onay gerek.");
          setNeedConfirm({
            inboxId,
            reasonCode: code,
            message: j?.error ?? "Kimlik uyuşmazlığı",
          });
          return;
        }

        setErr(j?.error ?? `Resolve hata: ${r.status}`);
        return;
      }

      // ✅ Başarılı
      const parts: string[] = [];
      parts.push(j.rawInserted > 0 ? "✅ Olay Events’e eklendi" : "⚠️ Olay Events’e eklenmedi");
      if (j.skippedSameMinute) parts.push("⚠️ Aynı dakika tekrar olduğu için bazıları atlandı");

      // Yeni alanlar: cardAction / userAction
      if (j.cardAction === "ASSIGNED") parts.push("✅ Kart numarası personele TANIMLANDI (bundan sonra otomatik eşleşir)");
      if (j.cardAction === "REPLACED") parts.push("🔁 Personelin kartı GÜNCELLENDİ (kart değişimi onaylandı)");
      if (j.userAction === "ASSIGNED") parts.push("✅ User ID personele TANIMLANDI (bundan sonra otomatik eşleşir)");
      if (j.userAction === "REPLACED") parts.push("🔁 Personelin User ID’si GÜNCELLENDİ (değişim onaylandı)");

      if (j.cardAction === "NONE" && j.userAction === "NONE") {
        parts.push("ℹ️ Personelde kimlik zaten vardı (sadece resolve yapıldı)");
      }

      const msg = parts.join(" • ");
      setInfo(msg);

      window.scrollTo({ top: 0, behavior: "smooth" });

      // Inbox’ı yenile ama mesajı ezme
      await loadInbox({ keepInfo: true });

      // 5 sn sonra mesajı kapat (istersen kaldırabilirsin)
      setTimeout(() => setInfo(null), 5000);
    } catch (e: any) {
      setErr(e?.message ?? "Resolve başarısız");
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <div className="grid gap-4">
      {/* Hero / Role badge / Permission note */}
      <div className={cx("rounded-2xl border p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]", toneStyles("violet").soft)}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-lg font-extrabold tracking-tight text-zinc-900">Cihaz Inbox</div>
              <PillBadge tone="violet">DeviceInbox</PillBadge>
              {props.role ? <PillBadge tone="neutral">{props.role}</PillBadge> : null}
              {!props.canResolve ? <PillBadge tone="neutral">Read-only</PillBadge> : null}
              {loading ? <PillBadge tone="warn">Yükleniyor</PillBadge> : null}
            </div>
            <div className="mt-1 text-sm text-zinc-600 font-medium leading-relaxed">
              Eşleşmeyen cihaz kayıtları burada bekler. Resolve ile personel eşleştirip ham olayı Events’e aktarabilirsiniz.
            </div>
            <div className="mt-2 text-[11px] text-zinc-500">
              Not: Resolve sonrası kart/user id personele bağlanırsa aynı kimlik bir daha otomatik eşleşir.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => loadInbox()}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
            >
              Yenile <span aria-hidden className="text-zinc-400">→</span>
            </button>
          </div>
        </div>

        <div className={cx("mt-4 rounded-2xl border px-4 py-3", toneStyles(props.canResolve ? "warn" : "danger").soft)}>
          <div className="text-xs font-extrabold uppercase tracking-wider text-zinc-700">Yetki Notu</div>
          <div className={cx("mt-1 text-sm font-semibold", props.canResolve ? "text-amber-900/90" : "text-rose-900")}>
            {props.canResolve
              ? "Bu ekranda Resolve işlemi, Events’e ham olay ekleyebilir ve kimlik (kart/user id) eşlemesi yapabilir."
              : "Read-only mod: kayıtları görebilirsiniz, ancak Resolve (eşleştirme) işlemi kapalıdır."}
          </div>
          <div className="mt-1 text-[11px] text-zinc-600">
            Resolve, operasyonel bir aksiyondur; yetkisiz rolde backend 403 döndürür (UI bunu teknik hata gibi göstermeyiz).
          </div>
        </div>
      </div>

      {err ? (
        <div className={cx("rounded-2xl border px-4 py-3 text-sm", toneStyles("danger").soft)}>
          {err}
          {needConfirm ? (
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => resolveOne(needConfirm.inboxId, { allowReplaceIdentity: true })}
                className="rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white"
              >
                Kart/User değişimi olarak ONAYLA
              </button>
              <button
                onClick={() => setNeedConfirm(null)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
              >
                Vazgeç
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {accessDenied ? (
        <div className={cx("rounded-2xl border px-4 py-4", toneStyles("danger").soft)}>
          <div className="flex flex-wrap items-center gap-2">
            <PillBadge tone="danger">403</PillBadge>
            <div className="text-sm font-extrabold text-rose-900">Bu sayfaya erişim yetkiniz yok.</div>
          </div>
          <div className="mt-1 text-sm text-rose-900/90">
            Cihaz Inbox, sadece yetkili roller tarafından görüntülenebilir.
          </div>
        </div>
      ) : null}

      {info ? (
        <div className={cx("rounded-2xl border px-4 py-3 text-sm", toneStyles("good").soft)}>
          <div className="font-medium">İşlem sonucu</div>
          <div className="mt-1">{info}</div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        {employeesDenied ? (
          <div className={cx("mb-3 rounded-xl border px-3 py-2 text-sm", toneStyles("warn").soft)}>
            <div className="font-semibold text-amber-900">Personel listesi yetki nedeniyle yüklenemedi.</div>
            <div className="mt-1 text-xs text-amber-900/70">
              Bu rolde /api/employees erişimi kapalı olabilir. Resolve için personel listesi gerekir.
            </div>
          </div>
        ) : null}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500">
              <th className="border-b border-zinc-200 pb-2">Zaman</th>
              <th className="border-b border-zinc-200 pb-2">Yön</th>
              <th className="border-b border-zinc-200 pb-2">Cihaz</th>
              <th className="border-b border-zinc-200 pb-2">Kapı</th>
              <th className="border-b border-zinc-200 pb-2">Kart No</th>
              <th className="border-b border-zinc-200 pb-2">User ID</th>
              <th className="border-b border-zinc-200 pb-2">Personel Seç</th>
              <th className="border-b border-zinc-200 pb-2">Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="py-3 text-zinc-500" colSpan={8}>
                  Yükleniyor…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="py-3 text-zinc-500" colSpan={8}>
                  Bekleyen kayıt yok.
                </td>
              </tr>
            ) : (
              rows.map((x) => (
                <tr key={x.id} className="border-b border-zinc-100">
                  <td className="py-3">{fmt(x.occurredAt)}</td>
                  <td className="py-3">{x.direction}</td>
                  <td className="py-3">{x.device?.name ?? "—"}</td>
                  <td className="py-3">{x.door ? `${x.door.code} • ${x.door.name}` : "—"}</td>
                  <td className="py-3">{x.cardNo ?? "—"}</td>
                  <td className="py-3">{x.deviceUserId ?? "—"}</td>
                  <td className="py-3">
                    <select
                      className="w-[260px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                      value={pick[x.id] ?? ""}
                      onChange={(e) => setPick((p) => ({ ...p, [x.id]: e.target.value }))}
                      disabled={!props.canResolve || employeesDenied}
                      title={!props.canResolve ? "Read-only: personel seçimi kapalı" : employeesDenied ? "Personel listesi yok" : "Personel seç"}
                    >
                      <option value="">— seç —</option>
                      {employeeOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3">
                    <button
                      onClick={() => resolveOne(x.id)}
                      disabled={!props.canResolve || employeesDenied || !pick[x.id] || resolvingId === x.id || employeeOptions.length === 0}
                      className="rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-40"
                      title={!props.canResolve ? "Read-only: resolve kapalı" : employeesDenied ? "Personel listesi yok" : "Resolve"}
                    >
                      {resolvingId === x.id ? "Resolving…" : "Resolve"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {employeeOptions.length === 0 && !employeesDenied ? (
          <div className="mt-3 text-xs text-zinc-500">
            Not: Personel listesi çekilemedi. (/api/employees yetkisi veya hata olabilir)
          </div>
        ) : null}
      </div>
    </div>
  );
}
