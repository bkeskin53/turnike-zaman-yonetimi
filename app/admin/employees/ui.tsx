"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  isActive: boolean;
};

type Notice = { kind: "success" | "error" | "info"; text: string };

function parseApiErrorText(t: string): string | null {
  // API bazen {"error":"CODE"} döndürüyor; bazen düz text.
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
  // Bilinen kodları Türkçeleştir
  const map: Record<string, string> = {
    EMPLOYEE_CODE_REQUIRED: "Çalışan kodu zorunludur.",
    FIRST_NAME_REQUIRED: "Ad zorunludur.",
    LAST_NAME_REQUIRED: "Soyad zorunludur.",
    EMPLOYEE_CODE_TAKEN: "Bu çalışan kodu zaten kullanılıyor.",
    EMPLOYEE_CODE_ALREADY_EXISTS: "Bu çalışan kodu zaten kayıtlı.",
    EMPLOYEE_CODE_DUPLICATE: "Bu çalışan kodu zaten kayıtlı.",
    EMPLOYEE_CODE_UNIQUE: "Bu çalışan kodu zaten kayıtlı.",
    INVALID_EMAIL: "E-posta formatı geçersiz.",
  };
  if (map[v]) return map[v];
  // Prisma/DB unique benzeri durumları yakala (backend özel kod dönmüyorsa)
  const upper = v.toUpperCase();
  if (
    upper.includes("P2002") ||
    upper.includes("UNIQUE CONSTRAINT") ||
    upper.includes("UNIQUE") ||
    upper.includes("DUPLICATE") ||
    upper.includes("ALREADY EXISTS")
  ) {
    return "Bu çalışan kodu zaten kayıtlı. Farklı bir kod deneyin.";
  }
  // Düz text gelirse olduğu gibi ama aşırı teknikse yumuşat
  if (v.startsWith("Prisma") || v.includes("ECONN")) return "Sunucu hatası oluştu. Lütfen tekrar deneyin.";
  return v;
}

function isLikelyEmail(v: string) {
  const s = v.trim();
  if (!s) return true; // optional
  // Basit ve yeterli bir kontrol
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export default function EmployeesClient() {
  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [q, setQ] = useState("");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "PASSIVE">("ALL");
  const [flashRowId, setFlashRowId] = useState<string | null>(null);
  const [flashKind, setFlashKind] = useState<"success" | "danger" | null>(null);
  const [sortBy, setSortBy] = useState<"CODE" | "NAME" | "STATUS">("CODE");
  const [touched, setTouched] = useState<{ [k: string]: boolean }>({});
  const [form, setForm] = useState({
    employeeCode: "",
    firstName: "",
    lastName: "",
    email: "",
    isActive: true,
  });

  const fullName = useMemo(() => `${form.firstName} ${form.lastName}`.trim(), [form.firstName, form.lastName]);

  function flash(kind: Notice["kind"], text: string, ms = 2500) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), ms);
  }

  const normalized = useMemo(() => {
    return {
      employeeCode: form.employeeCode.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      isActive: form.isActive,
    };
  }, [form.employeeCode, form.firstName, form.lastName, form.email, form.isActive]);

  const fieldErrors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!normalized.employeeCode) e.employeeCode = "Çalışan kodu zorunludur.";
    if (!normalized.firstName) e.firstName = "Ad zorunludur.";
    if (!normalized.lastName) e.lastName = "Soyad zorunludur.";
    if (!isLikelyEmail(normalized.email)) e.email = "E-posta formatı geçersiz.";
    return e;
  }, [normalized]);

  const canCreate = useMemo(() => {
    return Object.keys(fieldErrors).length === 0 && !loading;
  }, [fieldErrors, loading]);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/employees", { credentials: "include" });
      const json = await res.json();
      setItems(json.items ?? []);
      setNotice(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createEmployee() {
    // Client-side validation
    setTouched({ employeeCode: true, firstName: true, lastName: true, email: true });
    if (Object.keys(fieldErrors).length > 0) {
      flash("error", "Lütfen zorunlu alanları doldurun.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          employeeCode: normalized.employeeCode,
          firstName: normalized.firstName,
          lastName: normalized.lastName,
          email: normalized.email || null,
          isActive: normalized.isActive,
        }),
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        const codeOrText = parseApiErrorText(raw) ?? "Çalışan oluşturulamadı.";
        flash("error", humanizeError(codeOrText));
        return;
      }

      setForm({ employeeCode: "", firstName: "", lastName: "", email: "", isActive: true });
      setTouched({});
      // Başarılı oluşturma sonrası UI'ı tamamen temizle
      setNotice(null);
      setFlashKind("success");
      await refresh();
      // yeni eklenen satırı vurgula
      setFlashRowId(normalized.employeeCode);
      setTimeout(() => setFlashRowId(null), 1500);
      setTimeout(() => setFlashKind(null), 1500);
      flash("success", "Çalışan oluşturuldu.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(e: Employee) {
    setLoading(true);
    try {
      const res = await fetch("/api/employees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: e.id, isActive: !e.isActive }),
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        const codeOrText = parseApiErrorText(raw) ?? "Durum güncellenemedi.";
        flash("error", humanizeError(codeOrText));
        return;
      }

      await refresh();
      setFlashRowId(e.id);
      setFlashKind(e.isActive ? "danger" : "success");
      setTimeout(() => setFlashRowId(null), 1200);
      setTimeout(() => setFlashKind(null), 1200);
      flash("success", e.isActive ? "Çalışan pasifleştirildi." : "Çalışan aktifleştirildi.");
    } finally {
      setLoading(false);
    }
  }

  const visibleItems = useMemo(() => {
  const query = q.trim().toLowerCase();

  const filtered = items.filter((e) => {
    // Arama filtresi
    if (query) {
      const hay = [
        e.employeeCode,
        e.firstName,
        e.lastName,
        e.email ?? "",
      ]
        .join(" ")
        .toLowerCase();

      if (!hay.includes(query)) return false;
    }

    // Durum filtresi
    if (statusFilter === "ACTIVE" && !e.isActive) return false;
    if (statusFilter === "PASSIVE" && e.isActive) return false;

    return true;
  });

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "CODE") {
        return a.employeeCode.localeCompare(b.employeeCode);
      }
      if (sortBy === "NAME") {
        const an = `${a.firstName} ${a.lastName}`.trim();
        const bn = `${b.firstName} ${b.lastName}`.trim();
        return an.localeCompare(bn);
      }
      // STATUS → Aktifler üstte
      if (a.isActive === b.isActive) return 0;
      return a.isActive ? -1 : 1;
    });

    return sorted;
  }, [items, q, statusFilter, sortBy]);

  return (
    <div className="grid gap-6 min-w-0 w-full max-w-full overflow-x-hidden">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <div className="text-lg font-semibold">Çalışan Oluştur</div>
            <div className="text-sm text-zinc-600">Çalışan kayıt ve yönetimi</div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/employees/import"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
            >
              CSV İçe Aktar
            </Link>
            <button
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
              disabled={loading}
              onClick={refresh}
            >
              Yenile
            </button>
          </div>
        </div>

        {notice && (
          <div
            className={
              "mt-3 rounded-xl border px-3 py-2 text-sm " +
              (notice.kind === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : notice.kind === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-zinc-200 bg-zinc-50 text-zinc-900")
            }
            role="status"
          >
            {notice.text}
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2 min-w-0">
          <label className="grid gap-1">
            <span className="text-sm text-zinc-700">Çalışan Kodu</span>
            <input
              className={
                "rounded-xl border px-3 py-2 text-sm " +
                (touched.employeeCode && fieldErrors.employeeCode
                  ? "border-red-300 bg-red-50"
                  : "border-zinc-200")
              }
              value={form.employeeCode}
              onBlur={() => setTouched((s) => ({ ...s, employeeCode: true }))}
              onChange={(ev) => setForm({ ...form, employeeCode: ev.target.value })}
              placeholder="E001"
            />
            {touched.employeeCode && fieldErrors.employeeCode && (
              <span className="text-xs text-red-700">{fieldErrors.employeeCode}</span>
            )}
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-zinc-700">E-posta (opsiyonel)</span>
            <input
              className={
                "rounded-xl border px-3 py-2 text-sm " +
                (touched.email && fieldErrors.email ? "border-red-300 bg-red-50" : "border-zinc-200")
              }
              value={form.email}
              onBlur={() => setTouched((s) => ({ ...s, email: true }))}
              onChange={(ev) => setForm({ ...form, email: ev.target.value })}
              placeholder="ornek@firma.com"
            />
            {touched.email && fieldErrors.email && (
              <span className="text-xs text-red-700">{fieldErrors.email}</span>
            )}
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-zinc-700">Ad</span>
            <input
              className={
                "rounded-xl border px-3 py-2 text-sm " +
                (touched.firstName && fieldErrors.firstName ? "border-red-300 bg-red-50" : "border-zinc-200")
              }
              value={form.firstName}
              onBlur={() => setTouched((s) => ({ ...s, firstName: true }))}
              onChange={(ev) => setForm({ ...form, firstName: ev.target.value })}
              placeholder="Personel İsim"
            />
            {touched.firstName && fieldErrors.firstName && (
              <span className="text-xs text-red-700">{fieldErrors.firstName}</span>
            )}
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-zinc-700">Soyad</span>
            <input
              className={
                "rounded-xl border px-3 py-2 text-sm " +
                (touched.lastName && fieldErrors.lastName ? "border-red-300 bg-red-50" : "border-zinc-200")
              }
              value={form.lastName}
              onBlur={() => setTouched((s) => ({ ...s, lastName: true }))}
              onChange={(ev) => setForm({ ...form, lastName: ev.target.value })}
              placeholder="Personel Soyisim"
            />
            {touched.lastName && fieldErrors.lastName && (
              <span className="text-xs text-red-700">{fieldErrors.lastName}</span>
            )}
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 min-w-0">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={form.isActive}
              onChange={(ev) => setForm({ ...form, isActive: ev.target.checked })}
            />
            Aktif olarak oluştur
          </label>

          <button
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-50"
            disabled={!canCreate}
            onClick={createEmployee}
          >
            Oluştur
          </button>

          <div className="ml-auto text-sm text-zinc-500">
            {fullName ? (
              <>
                Önizleme: <span className="font-medium text-zinc-800">{fullName}</span>
              </>
            ) : (
              ""
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 min-w-0">
        <div className="grid gap-3 md:grid-cols-2 md:items-start min-w-0">
          <div className="grid gap-2 min-w-0">
            <div className="text-lg font-semibold">Çalışan Listesi</div>

            <select
              className="w-fit rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="CODE">Sırala: Koda göre</option>
              <option value="NAME">Sırala: Ada göre</option>
              <option value="STATUS">Sırala: Duruma göre</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end min-w-0">
            <input
              className="w-full md:w-64 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              placeholder="Ara: kod / ad / e-posta"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <div className="flex items-center gap-1">
              <button
                className={
                  "rounded-xl border px-3 py-2 text-sm " +
                  (statusFilter === "ALL"
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white hover:bg-zinc-50")
                }
                onClick={() => setStatusFilter("ALL")}
              >
                Tümü
              </button>

              <button
                className={
                  "rounded-xl border px-3 py-2 text-sm " +
                  (statusFilter === "ACTIVE"
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-zinc-200 bg-white hover:bg-zinc-50")
                }
                onClick={() => setStatusFilter("ACTIVE")}
              >
                Aktif
              </button>

              <button
                className={
                  "rounded-xl border px-3 py-2 text-sm " +
                  (statusFilter === "PASSIVE"
                    ? "border-zinc-600 bg-zinc-600 text-white"
                    : "border-zinc-200 bg-white hover:bg-zinc-50")
                }
                onClick={() => setStatusFilter("PASSIVE")}
              >
                Pasif
              </button>
            </div>

            <div className="text-sm text-zinc-500 whitespace-nowrap">
              {loading ? "Yükleniyor…" : `${visibleItems.length} kayıt`}
            </div>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto max-w-full min-w-0">
          <table className="min-w-[860px] w-full table-fixed text-sm">
            <thead className="bg-zinc-50 text-zinc-700">
              <tr>
                <th className="w-[140px] text-left px-3 py-2">Kod</th>
                <th className="text-left px-3 py-2">Ad Soyad</th>
                <th className="w-[240px] text-left px-3 py-2">E-posta</th>
                <th className="w-[110px] text-left px-3 py-2">Durum</th>
                <th className="w-[140px] text-right px-3 py-2">Aksiyon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {visibleItems.map((e) => (
                <tr
                  key={e.id}
                  className={
                    "group transition-colors hover:bg-zinc-50 " +
                    (focusedId === e.id ? "bg-zinc-50" : "") +
                    (flashRowId === e.id || flashRowId === e.employeeCode
                      ? flashKind === "success"
                        ? " bg-emerald-50"
                        : " bg-red-50"
                      : "")
                   }
                  onMouseEnter={() => setFocusedId(e.id)}
                  onMouseLeave={() => setFocusedId(null)}
                >
                  <td className="px-3 py-2 align-middle">
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          "h-6 w-1 rounded-full " +
                          (flashRowId === e.id || flashRowId === e.employeeCode
                            ? flashKind === "success"
                              ? "bg-emerald-400"
                              : "bg-red-400"
                            : focusedId === e.id
                              ? "bg-zinc-300"
                              : "bg-transparent")
                        }
                        aria-hidden="true"
                      />
                      <a
                        href={`/employees/${e.id}`}
                        className="font-mono text-blue-700 hover:underline"
                        title="Employee 360"
                      >
                        <span className="block truncate">{e.employeeCode}</span>
                      </a>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="min-w-0">
                      <div
                        className="truncate"
                        title={`${e.firstName} ${e.lastName}`.trim()}
                      >
                        {e.firstName} {e.lastName}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-zinc-700">
                    <span className="block truncate" title={e.email ?? ""}>
                      {e.email ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {e.isActive ? (
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        Aktif
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">
                        Pasif
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      className={
                        "rounded-xl border px-3 py-1.5 text-sm disabled:opacity-50 " +
                        (e.isActive
                          ? "border-red-200 bg-white text-red-700 hover:bg-red-50"
                          : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50")
                      }
                      disabled={loading}
                      onClick={() => toggleActive(e)}
                    >
                      {e.isActive ? "Pasifleştir" : "Aktifleştir"}
                    </button>
                  </td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-zinc-600">
                    Henüz çalışan yok.
                  </td>
                </tr>
              )}
              {items.length > 0 && visibleItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-zinc-600">
                    Arama kriterine uyan çalışan bulunamadı.
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
