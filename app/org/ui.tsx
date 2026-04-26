"use client";

import { useEffect, useMemo, useState } from "react";

type Branch = { id: string; code: string; name: string; isActive: boolean };
type ActiveCompany = { id: string; name: string } | null;
type Door = {
  id: string;
  branchId: string;
  code: string;
  name: string;
  role: string;
  isActive: boolean;
  defaultDirection: "IN" | "OUT" | null;
};
type Device = {
  id: string;
  branchId: string;
  name: string;
  ip: string | null;
  port: number | null;
  driver: string;
  doorId: string | null;
  isActive: boolean;
  lastSeenAt?: string | null;
  lastSyncAt?: string | null;
  lastErrorAt?: string | null;
  lastErrorMessage?: string | null;
};

type Notice = {
  kind: "success" | "error" | "info";
  text: string;
};

type DevicePingResponse = {
  ok?: boolean;
  latencyMs?: number;
  error?: string;
};

type DeviceSyncResponse = {
  ok?: boolean;
  inserted?: number;
  skippedReason?: string;
  skippedSameMinuteIn?: number;
  skippedSameMinuteOut?: number;
  fixedDirection?: string;
  error?: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    SYSTEM_ADMIN: "border-indigo-200 bg-indigo-50 text-indigo-800",
    HR_CONFIG_ADMIN: "border-violet-200 bg-violet-50 text-violet-800",
    HR_OPERATOR: "border-emerald-200 bg-emerald-50 text-emerald-800",
    SUPERVISOR: "border-zinc-200 bg-zinc-50 text-zinc-700",
    UNKNOWN: "border-zinc-200 bg-zinc-50 text-zinc-700",
  };
  const cls = map[role] ?? map.UNKNOWN;
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold", cls)}>
      {role}
    </span>
  );
}

function formatDateTime(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function OrgClient(props: {
  role: string;
  canManageOrg: boolean;       // Branch/Door/Device config
  canOperateDevices: boolean;  // Ping/Sync
}) {
  const { role, canManageOrg, canOperateDevices } = props;
  const [company, setCompany] = useState<ActiveCompany>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [doors, setDoors] = useState<Door[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null);
  const [deviceFilter, setDeviceFilter] = useState<"ALL" | "ISSUES">("ALL");

  const summary = useMemo(() => {
    const devicesUnassigned = devices.filter((d) => !d.doorId).length;
    const doorsMissingDefaultDir = doors.filter((d) => d.defaultDirection == null).length;

    const doorIdSet = new Set(doors.map((d) => d.id));
    const devicesDoorMissing = devices.filter((dv) => dv.doorId && !doorIdSet.has(dv.doorId)).length;

    const activeBranches = branches.filter((b) => b.isActive).length;
    const activeDoors = doors.filter((d) => d.isActive).length;
    const activeDevices = devices.filter((d) => d.isActive).length;

    return {
      counts: {
       branches: branches.length,
        doors: doors.length,
        devices: devices.length,
        activeBranches,
        activeDoors,
        activeDevices,
      },
      alerts: {
        devicesUnassigned,
        doorsMissingDefaultDir,
        devicesDoorMissing,
      },
    };
  }, [branches, doors, devices]);

  const modeText = useMemo(() => {
    if (canManageOrg) return "Yazma açık (Konfigürasyon)";
    if (role === "HR_OPERATOR") return "Operasyon modu (Ping/Sync açık, konfig kapalı)";
    return "Read-only";
  }, [canManageOrg, role]);

  function denyConfig() {
    flash("info", "Bu işlem için yetkin yok. (Konfigürasyon sadece: SYSTEM_ADMIN / HR_CONFIG_ADMIN)");
  }

  const branchNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of branches) m.set(b.id, `${b.code} • ${b.name}`);
    return m;
  }, [branches]);

  const doorById = useMemo(() => {
    const m = new Map<string, Door>();
    for (const d of doors) m.set(d.id, d);
    return m;
  }, [doors]);

  function flash(kind: Notice["kind"], text: string, ms = 3500) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), ms);
  }

  async function loadAll() {
    setLoading(true);
    const [companyRes, b, d, dv] = await Promise.all([
      fetch("/api/company", { cache: "no-store", credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("/api/org/branches", { cache: "no-store", credentials: "include" }).then((r) => r.json()),
      fetch("/api/org/doors", { cache: "no-store", credentials: "include" }).then((r) => r.json()),
      fetch("/api/org/devices", { cache: "no-store", credentials: "include" }).then((r) => r.json()),
    ]);
    setCompany(companyRes?.company ? { id: companyRes.company.id, name: companyRes.company.name } : null);
    setBranches(b);
    setDoors(d);
    setDevices(dv);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "").trim();
    if (!hash) return;
    const target = document.getElementById(hash);
    if (!target) return;
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ block: "center" });
    });
  }, [branches, devices]);

  const defaultBranchId = branches[0]?.id ?? null;

  const devicesWithComputed = useMemo(() => {
    return devices.map((dv) => {
      const hasDoorId = !!dv.doorId;
      const doorExists = dv.doorId ? doorById.has(dv.doorId) : false;
      const hasError = !!dv.lastErrorAt || !!dv.lastErrorMessage;

      let status: "OK" | "NO_DOOR" | "DOOR_MISSING" | "ERROR" = "OK";
      if (!hasDoorId) status = "NO_DOOR";
      else if (!doorExists) status = "DOOR_MISSING";
      else if (hasError) status = "ERROR";

      const hasIssue = status !== "OK";
      return { dv, status, hasIssue };
    });
  }, [devices, doorById]);

  const latestError = useMemo(() => {
    // Filter bar için kısa ipucu: en güncel ERROR mesajı
    const errs = devicesWithComputed
      .filter((x) => x.status === "ERROR")
      .map((x) => ({
        id: x.dv.id,
        atMs: x.dv.lastErrorAt ? Date.parse(x.dv.lastErrorAt) : 0,
        msg: x.dv.lastErrorMessage ? String(x.dv.lastErrorMessage) : "",
      }))
      .sort((a, b) => (b.atMs || 0) - (a.atMs || 0));
    return errs[0] ?? null;
  }, [devicesWithComputed]);

  const visibleDevices = useMemo(() => {
    if (deviceFilter === "ISSUES") return devicesWithComputed.filter((x) => x.hasIssue);
    return devicesWithComputed;
  }, [devicesWithComputed, deviceFilter]);

  const showOkStatusBadge = deviceFilter === "ALL";

  const issueCounts = useMemo(() => {
    let noDoor = 0, doorMissing = 0, error = 0;
    for (const x of devicesWithComputed) {
      if (x.status === "NO_DOOR") noDoor++;
      else if (x.status === "DOOR_MISSING") doorMissing++;
      else if (x.status === "ERROR") error++;
    }
    return { noDoor, doorMissing, error, totalIssues: noDoor + doorMissing + error };
  }, [devicesWithComputed]);

  return (
    <div className="grid gap-4 min-w-0 w-full max-w-full overflow-x-hidden">
      {/* MODE STRIP */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Lokasyon Yapısı</div>
            <div className="mt-1 text-xs text-zinc-500">{modeText}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-1 font-semibold text-sky-900">
                Şirket: {company?.name?.trim() || "—"}
              </span>
              <span className="text-zinc-500">
                Şubeler ve lokasyonlar bu aktif şirkete bağlı alt organizasyon kayıtlarıdır.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RoleBadge role={role} />
            {!canManageOrg ? (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900">
                Konfigürasyon kapalı
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {/* SUMMARY */}
      <div className="grid gap-3 md:grid-cols-4 min-w-0">
        <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 min-w-0">
          <div className="text-xs text-sky-700">Şirket</div>
          <div className="mt-1 truncate text-xl font-semibold text-sky-950" title={company?.name ?? ""}>
            {company?.name?.trim() || "—"}
          </div>
          <div className="mt-1 text-xs text-sky-700">Aktif organizasyon üst kaydı</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 min-w-0">
          <div className="text-xs text-zinc-500">Şubeler</div>
          <div className="mt-1 flex items-end justify-between gap-3">
            <div className="text-2xl font-semibold">{summary.counts.branches}</div>
            <div className="text-xs text-zinc-500">Aktif: {summary.counts.activeBranches}</div>
          </div>
       </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 min-w-0">
          <div className="text-xs text-zinc-500">Kapılar</div>
          <div className="mt-1 flex items-end justify-between gap-3">
            <div className="text-2xl font-semibold">{summary.counts.doors}</div>
            <div className="text-xs text-zinc-500">Aktif: {summary.counts.activeDoors}</div>
          </div>
          {summary.alerts.doorsMissingDefaultDir > 0 && (
            <div className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
              Default Dir eksik: {summary.alerts.doorsMissingDefaultDir}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 min-w-0">
          <div className="text-xs text-zinc-500">Cihazlar</div>
          <div className="mt-1 flex items-end justify-between gap-3">
            <div className="text-2xl font-semibold">{summary.counts.devices}</div>
           <div className="text-xs text-zinc-500">Aktif: {summary.counts.activeDevices}</div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {summary.alerts.devicesUnassigned > 0 && (
              <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                Kapı atanmadı: {summary.alerts.devicesUnassigned}
              </div>
            )}
            {summary.alerts.devicesDoorMissing > 0 && (
              <div className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
               DoorId bulunamadı: {summary.alerts.devicesDoorMissing}
              </div>
            )}
            {summary.alerts.devicesUnassigned === 0 && summary.alerts.devicesDoorMissing === 0 && (
              <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                Konfigürasyon temiz
              </div>
            )}
          </div>
        </div>
      </div>
      {/* BRANCHES */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 min-w-0">
        <div className="text-sm font-semibold">Şubeler</div>
        <div className="mt-1 text-xs text-zinc-500">
          Lokasyon / şube tanımları. Her kayıt aktif şirkete bağlı alt organizasyon birimi olarak açılır.
        </div>

        <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-2 text-xs text-sky-900">
          <span className="font-semibold">Bağlı Şirket:</span> {company?.name?.trim() || "—"}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={async () => {
              if (!canManageOrg) return denyConfig();
              const code = prompt("Şube Kodu (örn: MERKEZ)")?.trim();
              if (!code) return;
              const name = prompt("Şube Adı (örn: Merkez Ofis)")?.trim();
              if (!name) return;

              await fetch("/api/org/branches", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, name }),
              });

              await loadAll();
            }}
            disabled={!canManageOrg || loading}
            title={!canManageOrg ? "Konfigürasyon yetkisi yok" : "Yeni şube ekle"}
            className={cx(
              "rounded-xl px-3 py-2 text-sm text-white",
              !canManageOrg || loading ? "bg-zinc-400 cursor-not-allowed" : "bg-zinc-900 hover:bg-zinc-800"
            )}
          >
            + Şube Ekle
          </button>

          <button
            onClick={loadAll}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
            disabled={loading}
          >
            Yenile
          </button>
        </div>

        <div className="mt-3 overflow-x-auto max-w-full min-w-0">
          <table className="w-full text-sm min-w-0">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="border-b border-zinc-200 pb-2">Kod</th>
                <th className="border-b border-zinc-200 pb-2">Ad</th>
                <th className="border-b border-zinc-200 pb-2">Aktif</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="py-3 text-zinc-500" colSpan={3}>
                    Yükleniyor…
                  </td>
                </tr>
              ) : branches.length === 0 ? (
                <tr>
                  <td className="py-3 text-zinc-500" colSpan={3}>
                    Şube yok.
                  </td>
                </tr>
              ) : (
                branches.map((x) => (
                  <tr id={`branch-${x.id}`} key={x.id} className="border-b border-zinc-100 scroll-mt-28">
                    <td className="py-3 font-medium">{x.code}</td>
                    <td className="py-3">{x.name}</td>
                    <td className="py-3">{x.isActive ? "Evet" : "Hayır"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DOORS */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 min-w-0">
        <div className="text-sm font-semibold">Kapılar</div>
        <div className="mt-1 text-xs text-zinc-500">
          Door tanımları (role: TIMEKEEPING / ACCESS_ONLY / BOTH)
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={async () => {
              if (!canManageOrg) return denyConfig();
              if (!defaultBranchId) return alert("Önce şube ekleyin.");

              const code = prompt("Kapı Kodu (örn: BINA_GIRIS)")?.trim();
              if (!code) return;
              const name = prompt("Kapı Adı (örn: Bina Giriş Turnike)")?.trim();
              if (!name) return;
              const role =
                prompt("Role (TIMEKEEPING / ACCESS_ONLY / BOTH)", "TIMEKEEPING")?.trim() ||
                "TIMEKEEPING";

              const ddRaw = (prompt('Varsayılan Yön? (IN / OUT / boş=karışık)', "") ?? "")
                .trim()
                .toUpperCase();
              const defaultDirection = ddRaw === "IN" ? "IN" : ddRaw === "OUT" ? "OUT" : null;

              await fetch("/api/org/doors", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ branchId: defaultBranchId, code, name, role, defaultDirection }),
              });

              await loadAll();
            }}
            disabled={!canManageOrg || loading}
            title={!canManageOrg ? "Konfigürasyon yetkisi yok" : "Yeni kapı ekle"}
            className={cx(
              "rounded-xl px-3 py-2 text-sm text-white",
              !canManageOrg || loading ? "bg-zinc-400 cursor-not-allowed" : "bg-zinc-900 hover:bg-zinc-800"
            )}
          >
            + Kapı Ekle
          </button>

          <button
            onClick={loadAll}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
          >
            Yenile
          </button>
        </div>

        <div className="mt-3 overflow-x-auto max-w-full min-w-0">
          <table className="w-full text-sm min-w-0">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="border-b border-zinc-200 pb-2">Şube</th>
                <th className="border-b border-zinc-200 pb-2">Kod</th>
                <th className="border-b border-zinc-200 pb-2">Ad</th>
                <th className="border-b border-zinc-200 pb-2">Role</th>
                <th className="border-b border-zinc-200 pb-2">Default Dir</th>
                <th className="border-b border-zinc-200 pb-2">Aktif</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="py-3 text-zinc-500" colSpan={6}>
                    Yükleniyor…
                  </td>
                </tr>
              ) : doors.length === 0 ? (
                <tr>
                  <td className="py-3 text-zinc-500" colSpan={6}>
                    Kapı yok.
                  </td>
                </tr>
              ) : (
                doors.map((x) => (
                  <tr
                    key={x.id}
                    className={
                      "border-b border-zinc-100 " +
                      (x.defaultDirection == null ? "bg-amber-50/70" : "")
                    }
                  >
                    <td className="py-3 text-xs text-zinc-700">
                      {branchNameById.get(x.branchId) ?? "—"}
                    </td>
                    <td className={"py-3 font-medium " + (x.defaultDirection == null ? "border-l-4 border-amber-400 pl-3" : "")}>
                      {x.code}
                      {x.defaultDirection == null && (
                        <span className="ml-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                          Default Dir eksik
                        </span>
                      )}
                    </td>
                    <td className="py-3">{x.name}</td>
                    <td className="py-3">{x.role}</td>
                    <td className="py-3">
                      <select
                        className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs"
                        value={x.defaultDirection ?? ""}
                        disabled={!canManageOrg || loading}
                        title={!canManageOrg ? "Konfigürasyon yetkisi yok" : "Varsayılan yön seç"}
                        onChange={async (e) => {
                          if (!canManageOrg) return denyConfig();
                          const defaultDirection = e.target.value || null;

                          const r = await fetch(`/api/org/doors/${encodeURIComponent(x.id)}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ defaultDirection }),
                          });

                          if (!r.ok) {
                            const t = await r.text();
                            alert(`PATCH HATA: ${r.status}\n${t}`);
                            return;
                          }

                          await loadAll();
                        }}
                      >
                        <option value="">—</option>
                        <option value="IN">IN</option>
                        <option value="OUT">OUT</option>
                      </select>
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        className={
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium " +
                          (x.isActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                            : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100")
                        }
                        title={x.isActive ? "Kapıyı pasif yap" : "Kapıyı aktif yap"}
                        onClick={async () => {
                          if (!canManageOrg) return denyConfig();

                          const next = !x.isActive;
                          const ok = confirm(
                            next
                              ? `Kapı aktif edilsin mi? (${x.code})`
                              : `Kapı pasif edilsin mi? (${x.code})\n\nNot: Pasif kapı kiosk/PDKS işlemlerini reddeder.`
                          );
                          if (!ok) return;

                          const r = await fetch(`/api/org/doors/${encodeURIComponent(x.id)}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ isActive: next }),
                          });
                          if (!r.ok) {
                            const t = await r.text();
                            alert(`PATCH HATA: ${r.status}\n${t}`);
                            return;
                          }
                          await loadAll();
                        }}
                      >
                        {x.isActive ? "Evet" : "Hayır"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DEVICES */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 min-w-0">
        <div className="text-sm font-semibold">Cihazlar</div>
        <div className="mt-1 text-xs text-zinc-500">Device tanımları (IP/Port/Driver)</div>

        {/* Device filters */}
        <div className="mt-3 flex flex-wrap items-center gap-2 min-w-0">
          <button
            className={
              "rounded-xl border px-3 py-2 text-sm " +
              (deviceFilter === "ALL"
                ? "border-zinc-300 bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-100")
            }
            onClick={() => setDeviceFilter("ALL")}
            disabled={loading}
          >
            Tümü ({devices.length})
          </button>
          <button
            className={
              "rounded-xl border px-3 py-2 text-sm " +
              (deviceFilter === "ISSUES"
                ? "border-amber-600 bg-amber-600 text-white"
                : "border-zinc-300 bg-zinc-50 text-zinc-900 hover:bg-zinc-100")
            }
            onClick={() => setDeviceFilter("ISSUES")}
            disabled={loading}
          >
            Sorunlular ({issueCounts.totalIssues})
          </button>

          {issueCounts.totalIssues > 0 && (
            <div className="ml-1 flex flex-wrap gap-2 text-xs text-zinc-600">
              {issueCounts.noDoor > 0 && <span>Kapı yok: {issueCounts.noDoor}</span>}
              {issueCounts.doorMissing > 0 && <span>DoorId bozuk: {issueCounts.doorMissing}</span>}
              {issueCounts.error > 0 && <span>Hata: {issueCounts.error}</span>}
            </div>
          )}
          {deviceFilter === "ISSUES" && latestError?.msg && (
            <div className="w-full pt-1 text-xs text-zinc-500 min-w-0">
              Son hata:{" "}
              <span
                className="text-zinc-700 block max-w-full truncate min-w-0"
                title={latestError.msg}
              >
                {latestError.msg}
              </span>
            </div>
          )}
        </div>

        {notice && (
          <div
            className={
              "mt-3 rounded-xl border px-3 py-2 text-sm " +
              (notice.kind === "error"
                ? "border-red-200 bg-red-50 text-red-900"
                : notice.kind === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-zinc-200 bg-zinc-50 text-zinc-900")
            }
            role="status"
          >
            {notice.text}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={async () => {
              if (!canManageOrg) return denyConfig();
              if (!defaultBranchId) return alert("Önce şube ekleyin.");

              const name = prompt("Cihaz Adı (örn: ZK-01)")?.trim();
              if (!name) return;

              const ip = (prompt("IP (örn: 192.168.1.20)")?.trim() || "") || null;
              const portStr = prompt("Port (örn: 4370)", "4370")?.trim();
              const port = portStr ? Number(portStr) : 4370;
              const driver =
                prompt("Driver (ZKTECO_PULL / ZKTECO_PUSH / GENERIC)", "ZKTECO_PULL")?.trim() ||
                "ZKTECO_PULL";

              await fetch("/api/org/devices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ branchId: defaultBranchId, name, ip, port, driver }),
              });

              await loadAll();
            }}
            disabled={!canManageOrg || loading}
            title={!canManageOrg ? "Konfigürasyon yetkisi yok" : "Yeni cihaz ekle"}
            className={cx(
              "rounded-xl px-3 py-2 text-sm text-white",
              !canManageOrg || loading ? "bg-zinc-400 cursor-not-allowed" : "bg-zinc-900 hover:bg-zinc-800"
            )}
          >
            + Cihaz Ekle
          </button>
        </div>

        <div className="mt-3 overflow-x-auto max-w-full min-w-0">
          <table className="min-w-[980px] w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="border-b border-zinc-200 px-3 pb-2 whitespace-nowrap">Durum</th>
                <th className="border-b border-zinc-200 px-3 pb-2 whitespace-nowrap">Ad</th>
                <th className="border-b border-zinc-200 px-3 pb-2 whitespace-nowrap hidden md:table-cell">IP</th>
                <th className="border-b border-zinc-200 px-3 pb-2 whitespace-nowrap hidden md:table-cell">Port</th>
                <th className="border-b border-zinc-200 px-3 pb-2 whitespace-nowrap hidden lg:table-cell">Driver</th>
                <th className="border-b border-zinc-200 px-3 pb-2 whitespace-nowrap">Kapı</th>
                <th className="border-b border-zinc-200 px-3 pb-2 whitespace-nowrap">Yön</th>
                <th className="border-b border-zinc-200 px-3 pb-2 whitespace-nowrap hidden lg:table-cell">Son Sync</th>
                <th className="border-b border-zinc-200 px-3 pb-2 whitespace-nowrap">Son Hata</th>
                <th className="border-b border-zinc-200 px-3 pb-2 whitespace-nowrap">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="py-3 text-zinc-500" colSpan={10}>
                    Yükleniyor…
                  </td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td className="py-3 text-zinc-500" colSpan={10}>
                    Cihaz yok.
                  </td>
                </tr>
              ) : (
                visibleDevices.map(({ dv: x, status }) => {
                  const isBusy = busyDeviceId === x.id;
                  const isError = status === "ERROR";
                  const isNoDoor = status === "NO_DOOR";
                  const isDoorMissing = status === "DOOR_MISSING";
                  const rowTone =
                    isError || isDoorMissing
                      ? "bg-red-50/60"
                      : isNoDoor
                        ? "bg-amber-50/60"
                        : "";
                  const leftBar =
                    isError || isDoorMissing
                      ? "border-l-4 border-red-400 pl-3"
                      : isNoDoor
                        ? "border-l-4 border-amber-400 pl-3"
                        : "";

                  return (
                    <tr id={`device-${x.id}`} key={x.id} className={"border-b border-zinc-100 scroll-mt-28 " + rowTone}>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {status === "OK" ? (
                        showOkStatusBadge ? (
                          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            OK
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )
                      ) : status === "NO_DOOR" ? (
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Kapı yok
                        </span>
                      ) : status === "DOOR_MISSING" ? (
                        <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
                          DoorId bozuk
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
                          Hata
                        </span>
                      )}
                    </td>

                    <td className={"py-3 px-3 font-medium " + leftBar}>{x.name}</td>
                      <td className="py-3 px-3 whitespace-nowrap hidden md:table-cell">{x.ip ?? "—"}</td>
                      <td className="py-3 px-3 whitespace-nowrap hidden md:table-cell">{x.port ?? "—"}</td>
                      <td className="py-3 px-3 whitespace-nowrap hidden lg:table-cell">{x.driver}</td>

                    <td className="py-3 px-3">
                      <select
                          className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs"
                        value={x.doorId ?? ""}
                        disabled={!canManageOrg || isBusy || loading}
                        title={!canManageOrg ? "Konfigürasyon yetkisi yok" : "Cihaza kapı ata"}
                        onChange={async (e) => {
                          if (!canManageOrg) return denyConfig();
                          const doorId = e.target.value || null;

                          const r = await fetch(`/api/org/devices/${encodeURIComponent(x.id)}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ doorId }),
                          });

                          if (!r.ok) {
                            const t = await r.text();
                            alert(`PATCH HATA: ${r.status}\n${t}`);
                            return;
                          }

                          await loadAll();
                        }}
                      >
                        <option value="">(Kapı seç)</option>
                        {doors.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.code} • {d.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-3 px-3 text-xs text-zinc-700 whitespace-nowrap">
                      {doors.find((d) => d.id === x.doorId)?.defaultDirection ?? "—"}
                    </td>

                    <td className="py-3 px-3 text-xs text-zinc-700 whitespace-nowrap hidden lg:table-cell" title={x.lastSyncAt ?? ""}>
                      {formatDateTime(x.lastSyncAt)}
                    </td>

                    <td className="py-3 px-3 text-xs text-zinc-700 min-w-0">
                      {x.lastErrorAt || x.lastErrorMessage ? (
                        <span
                          className="text-red-700 block max-w-[260px] lg:max-w-[420px] truncate"
                          title={`${formatDateTime(x.lastErrorAt)}${x.lastErrorMessage ? ` • ${x.lastErrorMessage}` : ""}`}
                        >
                          {formatDateTime(x.lastErrorAt)}
                          {x.lastErrorMessage ? ` • ${x.lastErrorMessage}` : ""}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <button
                          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs hover:bg-zinc-50"
                          disabled={isBusy || loading || !canOperateDevices}
                          title={!canOperateDevices ? "Operasyon yetkisi yok" : "Cihaz ping"}
                          onClick={async () => {
                            if (!canOperateDevices) return flash("info", "Ping yetkin yok.");
                            setBusyDeviceId(x.id);
                            try {
                              const r = await fetch("/api/devices/ping", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ deviceId: x.id }),
                              });
                              const j: DevicePingResponse = await r.json().catch(() => ({}));

                              if (!r.ok || !j?.ok) {
                                flash("error", `Ping başarısız${j?.error ? ` • ${j.error}` : ""}`);
                              } else {
                                flash("success", `Ping başarılı • ${j.latencyMs}ms`);
                              }
                            } catch {
                              flash("error", "Ping başarısız (bağlantı hatası)");
                            } finally {
                              await loadAll();
                              setBusyDeviceId(null);
                            }
                          }}
                        >
                          {isBusy ? "Ping…" : "Ping"}
                        </button>

                        <button
                          className="rounded-lg bg-zinc-900 px-2 py-1 text-xs text-white hover:bg-zinc-800"
                          disabled={isBusy || loading || !canOperateDevices}
                          title={!canOperateDevices ? "Operasyon yetkisi yok" : "Cihaz sync"}
                          onClick={async () => {
                            if (!canOperateDevices) return flash("info", "Sync yetkin yok.");
                            setBusyDeviceId(x.id);
                            try {
                              const r = await fetch("/api/devices/sync", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ deviceId: x.id, count: 5 }),
                              });

                              const j: DeviceSyncResponse = await r.json().catch(() => ({}));

                              if (!r.ok || !j?.ok) {
                                flash("error", `Sync başarısız${j?.error ? ` • ${j.error}` : ""}`);
                              } else {
                                let msg = `Sync tamamlandı: ${j.inserted ?? 0} yeni kayıt`;

                                if (j.skippedReason === "DOOR_ACCESS_ONLY") {
                                  msg = "Bu cihaz ACCESS_ONLY kapıya bağlı: kayıt yazılmadı.";
                                }

                                const sIn = Number(j.skippedSameMinuteIn ?? 0);
                                const sOut = Number(j.skippedSameMinuteOut ?? 0);
                                if (sIn + sOut > 0) {
                                  msg += ` • Aynı dakika engeli (IN:${sIn}, OUT:${sOut})`;
                                }

                                if (j.fixedDirection) {
                                  msg += ` • Yön: ${j.fixedDirection}`;
                                }

                                flash("success", msg);
                              }
                            } catch {
                              flash("error", "Sync başarısız (bağlantı hatası)");
                            } finally {
                              await loadAll();
                              setBusyDeviceId(null);
                            }
                          }}
                        >
                          {isBusy ? "Sync…" : "Sync"}
                        </button>
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
    </div>
  );
}
