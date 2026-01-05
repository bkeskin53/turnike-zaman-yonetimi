"use client";

import { useEffect, useState } from "react";

type Branch = { id: string; code: string; name: string; isActive: boolean };
type Door = { id: string; branchId: string; code: string; name: string; role: string; isActive: boolean };
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

export default function OrgClient() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [doors, setDoors] = useState<Door[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    const [b, d, dv] = await Promise.all([
      fetch("/api/org/branches").then((r) => r.json()),
      fetch("/api/org/doors").then((r) => r.json()),
      fetch("/api/org/devices").then((r) => r.json()),
    ]);
    setBranches(b);
    setDoors(d);
    setDevices(dv);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const defaultBranchId = branches[0]?.id ?? null;

  return (
    <div className="grid gap-4">
      {/* BRANCHES */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold">Şubeler</div>
        <div className="mt-1 text-xs text-zinc-500">Branch tanımları</div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={async () => {
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
            className="rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800"
          >
            + Şube Ekle
          </button>

          <button
            onClick={loadAll}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
          >
            Yenile
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
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
                  <tr key={x.id} className="border-b border-zinc-100">
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
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold">Kapılar</div>
        <div className="mt-1 text-xs text-zinc-500">Door tanımları (role: TIMEKEEPING / ACCESS_ONLY / BOTH)</div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={async () => {
              if (!defaultBranchId) return alert("Önce şube ekleyin.");

              const code = prompt("Kapı Kodu (örn: BINA_GIRIS)")?.trim();
              if (!code) return;
              const name = prompt("Kapı Adı (örn: Bina Giriş Turnike)")?.trim();
              if (!name) return;
              const role =
                prompt("Role (TIMEKEEPING / ACCESS_ONLY / BOTH)", "TIMEKEEPING")?.trim() || "TIMEKEEPING";

              await fetch("/api/org/doors", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ branchId: defaultBranchId, code, name, role }),
              });

              await loadAll();
            }}
            className="rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800"
          >
            + Kapı Ekle
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="border-b border-zinc-200 pb-2">Kod</th>
                <th className="border-b border-zinc-200 pb-2">Ad</th>
                <th className="border-b border-zinc-200 pb-2">Role</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="py-3 text-zinc-500" colSpan={3}>
                    Yükleniyor…
                  </td>
                </tr>
              ) : doors.length === 0 ? (
                <tr>
                  <td className="py-3 text-zinc-500" colSpan={3}>
                    Kapı yok.
                  </td>
                </tr>
              ) : (
                doors.map((x) => (
                  <tr key={x.id} className="border-b border-zinc-100">
                    <td className="py-3 font-medium">{x.code}</td>
                    <td className="py-3">{x.name}</td>
                    <td className="py-3">{x.role}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DEVICES */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold">Cihazlar</div>
        <div className="mt-1 text-xs text-zinc-500">Device tanımları (IP/Port/Driver)</div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={async () => {
              if (!defaultBranchId) return alert("Önce şube ekleyin.");

              const name = prompt("Cihaz Adı (örn: ZK-01)")?.trim();
              if (!name) return;

              const ip = (prompt("IP (örn: 192.168.1.20)")?.trim() || "") || null;
              const portStr = prompt("Port (örn: 4370)", "4370")?.trim();
              const port = portStr ? Number(portStr) : 4370;
              const driver =
                prompt("Driver (ZKTECO_PULL / ZKTECO_PUSH / GENERIC)", "ZKTECO_PULL")?.trim() || "ZKTECO_PULL";

              await fetch("/api/org/devices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ branchId: defaultBranchId, name, ip, port, driver }),
              });

              await loadAll();
            }}
            className="rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800"
          >
            + Cihaz Ekle
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="border-b border-zinc-200 pb-2">Ad</th>
                <th className="border-b border-zinc-200 pb-2">IP</th>
                <th className="border-b border-zinc-200 pb-2">Port</th>
                <th className="border-b border-zinc-200 pb-2">Driver</th>
                <th className="border-b border-zinc-200 pb-2">Kapı</th>
                <th className="border-b border-zinc-200 pb-2">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="py-3 text-zinc-500" colSpan={5}>
                    Yükleniyor…
                  </td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td className="py-3 text-zinc-500" colSpan={5}>
                    Cihaz yok.
                  </td>
                </tr>
              ) : (
                devices.map((x) => (
                  <tr key={x.id} className="border-b border-zinc-100">
                    <td className="py-3 font-medium">{x.name}</td>
                    <td className="py-3">{x.ip ?? "—"}</td>
                    <td className="py-3">{x.port ?? "—"}</td>
                    <td className="py-3">{x.driver}</td>

                    <td className="py-3">
                      <select
                        className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs"
                        value={x.doorId ?? ""}
                        onChange={async (e) => {
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

                    {/* ✅ YENİ: Aksiyon butonları */}
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs hover:bg-zinc-50"
                          onClick={async () => {
                            const r = await fetch("/api/devices/ping", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ deviceId: x.id }),
                            });
                            const j = await r.json();
                            alert(j.ok ? `Ping OK • ${j.latencyMs}ms` : `Ping FAIL • ${j.error ?? ""}`);
                            await loadAll();
                          }}
                        >
                          Ping
                        </button>

                        <button
                          className="rounded-lg bg-zinc-900 px-2 py-1 text-xs text-white hover:bg-zinc-800"
                          onClick={async () => {
                            const r = await fetch("/api/devices/sync", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ deviceId: x.id, count: 5 }),
                            });
                            const j = await r.json();
                            alert(j.ok ? `Sync OK • inserted=${j.inserted}` : `Sync FAIL • ${j.error ?? ""}`);
                            await loadAll();
                          }}
                        >
                          Sync
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
