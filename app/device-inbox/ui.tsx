"use client";

import { useEffect, useMemo, useState } from "react";

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

export default function DeviceInboxClient() {
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
    if (!opts?.keepInfo) setInfo(null);

    try {
      // credentials: "include" eklendi. API çağrılarında oturum çerezinin gönderilmesi için gereklidir.
      const r = await fetch("/api/device-inbox?status=PENDING&take=200", { credentials: "include" });
      const j = await readJsonSafe(r);
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
    <div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => loadInbox()}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
        >
          Yenile
        </button>
        <div className="text-xs text-zinc-500">
          İpucu: Resolve ettikten sonra aynı kart artık otomatik eşleşir (Sync’te tekrar 5 görmeye başlarsın).
        </div>
      </div>

      {err ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
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

      {info ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <div className="font-medium">İşlem sonucu</div>
          <div className="mt-1">{info}</div>
        </div>
      ) : null}

      <div className="mt-3 overflow-x-auto">
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
                      disabled={!pick[x.id] || resolvingId === x.id || employeeOptions.length === 0}
                      className="rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-40"
                    >
                      {resolvingId === x.id ? "Resolving…" : "Resolve"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {employeeOptions.length === 0 ? (
          <div className="mt-3 text-xs text-zinc-500">
            Not: Personel listesi çekilemedi. (/api/employees yetkisi veya hata olabilir)
          </div>
        ) : null}
      </div>
    </div>
  );
}
