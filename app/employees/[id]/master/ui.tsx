"use client";

import { useEffect, useMemo, useState } from "react";

type MasterResponse = {
  item: {
    employee: {
      id: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
      email: string | null;
      isActive: boolean;
      hiredAt: string | null;
      terminatedAt: string | null;

      cardNo: string | null;
      deviceUserId: string | null;

      branch: { id: string; code: string; name: string } | null;
      employeeGroup: { id: string; code: string; name: string } | null;
      employeeSubgroup: { id: string; code: string; name: string; groupId: string } | null;

      integrationEmployeeLinks: Array<{
        id: string;
        sourceSystem: string;
        externalRef: string;
        createdAt: string;
      }>;
    };
    today: {
      dayKey: string;
      shift: any;
      policyRuleSet: any | null;
      lastEvent: any | null;
    };
    last7Days: {
      from: string;
      to: string;
      presentDays: number;
      offDays: number;
      leaveDays: number;
      absentDays: number;
      anomalyDays: number;
      anomalyCounts: Record<string, number>;
      totals: {
        lateMinutes: number;
        earlyLeaveMinutes: number;
        workedMinutes: number;
        overtimeMinutes: number;
      };
      days: Array<any>;
    };
  };
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Card(props: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3">
        <div className="grid gap-0.5">
          <div className="text-sm font-semibold text-zinc-900">{props.title}</div>
          {props.subtitle ? <div className="text-xs text-zinc-500">{props.subtitle}</div> : null}
        </div>
        {props.right ? <div className="shrink-0">{props.right}</div> : null}
      </div>
      <div className="p-4">{props.children}</div>
    </div>
  );
}

function Badge(props: { tone?: "ok" | "warn" | "info" | "muted"; children: React.ReactNode }) {
  const tone = props.tone ?? "muted";
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "warn"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : tone === "info"
          ? "bg-sky-50 text-sky-700 ring-sky-200"
          : "bg-zinc-50 text-zinc-700 ring-zinc-200";

  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1", cls)}>{props.children}</span>;
}

function KV(props: { k: string; v?: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{props.k}</div>
      <div className="text-sm text-zinc-900">{props.v ?? <span className="text-zinc-400">—</span>}</div>
    </div>
  );
}

function minutesToHM(min: number) {
  const m = Number.isFinite(min) ? Math.max(0, Math.floor(min)) : 0;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h}sa ${String(r).padStart(2, "0")}dk`;
}

export default function EmployeeMasterClient({ id }: { id: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<MasterResponse["item"] | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/employees/${id}/master`, { credentials: "include" });
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || "Failed to load");
      }
      const json = (await res.json()) as MasterResponse;
      setData(json.item);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fullName = useMemo(() => {
    if (!data?.employee) return "";
    return `${data.employee.firstName} ${data.employee.lastName}`.trim();
  }, [data]);

  if (loading) {
    return (
      <div className="grid gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="h-6 w-48 animate-pulse rounded bg-zinc-100" />
          <div className="mt-3 h-4 w-80 animate-pulse rounded bg-zinc-100" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
          <div className="h-72 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <div className="font-semibold">Yüklenemedi</div>
        <div className="mt-1 break-words">{err}</div>
        <button
          className="mt-3 inline-flex items-center rounded-lg bg-white px-3 py-2 text-sm font-medium text-red-800 ring-1 ring-red-200 hover:bg-red-50"
          onClick={load}
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  if (!data) return <div className="text-sm text-zinc-500">Veri yok.</div>;

  const e = data.employee;
  const today = data.today;
  const last7 = data.last7Days;

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xl font-semibold text-zinc-900">{fullName || "—"}</div>
              <Badge tone={e.isActive ? "ok" : "warn"}>{e.isActive ? "Aktif" : "Kapalı"}</Badge>
              <Badge tone="muted">Sicil: {e.employeeCode}</Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
              {e.branch ? <span>Şube: <span className="font-medium text-zinc-900">{e.branch.code} — {e.branch.name}</span></span> : <span>Şube: <span className="text-zinc-400">—</span></span>}
              {e.employeeGroup ? <span>• Grup: <span className="font-medium text-zinc-900">{e.employeeGroup.code}</span></span> : null}
              {e.employeeSubgroup ? <span>• Subgroup: <span className="font-medium text-zinc-900">{e.employeeSubgroup.code}</span></span> : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a href={`/employees/${id}`} className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100">
              Employee 360
            </a>
            <a href={`/employees/${id}/weekly-plan`} className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100">
              Haftalık Plan
            </a>
            <a href={`/employees/${id}/leaves`} className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100">
              İzinler
            </a>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KV k="Email" v={e.email || "—"} />
          <KV k="İşe giriş" v={e.hiredAt || "—"} />
          <KV k="İşten çıkış" v={e.terminatedAt || "—"} />
          <KV k="Bugün (DayKey)" v={today.dayKey} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Kimlik & Cihaz" subtitle="Personelin sistemde nasıl tanındığı">
          <div className="grid gap-3 sm:grid-cols-2">
            <KV k="Kart No" v={e.cardNo || "—"} />
            <KV k="Cihaz UserId" v={e.deviceUserId || "—"} />
          </div>

          <div className="mt-4 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200/60">
            <div className="text-xs font-semibold text-zinc-700">Entegrasyon Linkleri</div>
            {e.integrationEmployeeLinks?.length ? (
              <div className="mt-2 grid gap-2">
                {e.integrationEmployeeLinks.map((l) => (
                  <div key={l.id} className="flex flex-wrap items-center gap-2 text-xs text-zinc-700">
                    <Badge tone="info">{l.sourceSystem}</Badge>
                    <span className="font-medium">{l.externalRef}</span>
                    <span className="text-zinc-500">{String(l.createdAt).slice(0, 19).replace("T", " ")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-xs text-zinc-500">Entegrasyon linki yok.</div>
            )}
          </div>
        </Card>

        <Card title="Bugün Özeti" subtitle="Atama/plan çözümlemesi + son hareket">
          <div className="grid gap-3 sm:grid-cols-2">
            <KV
              k="Shift (source)"
              v={
                today.shift ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="info">{today.shift.source}</Badge>
                    {today.shift.isOffDay ? <Badge tone="warn">OFF</Badge> : null}
                    <span className="font-medium text-zinc-900">{today.shift.signature?.signature ?? "—"}</span>
                    {today.shift.shiftCode ? <span className="text-zinc-600">({today.shift.shiftCode})</span> : null}
                  </div>
                ) : (
                  "—"
                )
              }
            />

            <KV
              k="RuleSet"
              v={
                today.policyRuleSet?.ruleSet ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="info">{today.policyRuleSet.source}</Badge>
                    <span className="font-medium">{today.policyRuleSet.ruleSet.code}</span>
                    <span className="text-zinc-600">— {today.policyRuleSet.ruleSet.name}</span>
                  </div>
                ) : (
                  <span className="text-zinc-500">Atama yok (fallback: Company Policy)</span>
                )
              }
            />
          </div>

          <div className="mt-4 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200/60">
            <div className="text-xs font-semibold text-zinc-700">Son Ham Event</div>
            {today.lastEvent ? (
              <div className="mt-2 grid gap-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="muted">{today.lastEvent.direction}</Badge>
                  <Badge tone="muted">{today.lastEvent.source}</Badge>
                  <span className="font-medium text-zinc-900">
                    {String(today.lastEvent.occurredAt).slice(0, 19).replace("T", " ")}
                  </span>
                </div>
                <div className="text-xs text-zinc-600">
                  {today.lastEvent.door?.name ? <>Kapı: <span className="font-medium text-zinc-900">{today.lastEvent.door.name}</span> </> : null}
                  {today.lastEvent.device?.name ? <> • Cihaz: <span className="font-medium text-zinc-900">{today.lastEvent.device.name}</span></> : null}
                </div>
              </div>
            ) : (
              <div className="mt-2 text-xs text-zinc-500">Henüz event yok.</div>
            )}
          </div>
        </Card>
      </div>

      <Card
        title="Son 7 Gün Operasyon Özeti"
        subtitle={`${last7.from} → ${last7.to}`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="ok">PRESENT: {last7.presentDays}</Badge>
            <Badge tone="warn">OFF: {last7.offDays}</Badge>
            <Badge tone="info">LEAVE: {last7.leaveDays}</Badge>
            <Badge tone="muted">ABSENT: {last7.absentDays}</Badge>
          </div>
        }
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200/60">
            <div className="text-xs font-semibold text-zinc-700">Toplamlar</div>
            <div className="mt-2 grid gap-2 text-sm">
              <div className="flex items-center justify-between"><span className="text-zinc-600">Geç kalma</span><span className="font-medium">{minutesToHM(last7.totals.lateMinutes)}</span></div>
              <div className="flex items-center justify-between"><span className="text-zinc-600">Erken çıkış</span><span className="font-medium">{minutesToHM(last7.totals.earlyLeaveMinutes)}</span></div>
              <div className="flex items-center justify-between"><span className="text-zinc-600">Çalışma</span><span className="font-medium">{minutesToHM(last7.totals.workedMinutes)}</span></div>
              <div className="flex items-center justify-between"><span className="text-zinc-600">Fazla mesai</span><span className="font-medium">{minutesToHM(last7.totals.overtimeMinutes)}</span></div>
            </div>
          </div>

          <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200/60 lg:col-span-2">
            <div className="text-xs font-semibold text-zinc-700">Anomali Sayımları</div>
            {Object.keys(last7.anomalyCounts || {}).length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(last7.anomalyCounts).map(([k, v]) => (
                  <Badge key={k} tone="warn">
                    {k}: {v}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-xs text-zinc-500">Anomali yok.</div>
            )}

            <div className="mt-3 overflow-auto rounded-xl ring-1 ring-zinc-200/60">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-white">
                    <th className="sticky top-0 z-10 border-b border-zinc-200 px-3 py-2 text-left text-xs font-semibold text-zinc-700">Gün</th>
                    <th className="sticky top-0 z-10 border-b border-zinc-200 px-3 py-2 text-left text-xs font-semibold text-zinc-700">Durum</th>
                    <th className="sticky top-0 z-10 border-b border-zinc-200 px-3 py-2 text-left text-xs font-semibold text-zinc-700">Shift</th>
                    <th className="sticky top-0 z-10 border-b border-zinc-200 px-3 py-2 text-left text-xs font-semibold text-zinc-700">Anomali</th>
                  </tr>
                </thead>
                <tbody>
                  {last7.days.map((d: any) => (
                    <tr key={String(d.dayKey)} className="bg-white">
                      <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-900">{d.dayKey}</td>
                      <td className="border-b border-zinc-100 px-3 py-2 text-sm">
                        <Badge tone={d.status === "PRESENT" ? "ok" : d.status === "OFF" ? "warn" : d.status === "LEAVE" ? "info" : "muted"}>{d.status}</Badge>
                      </td>
                      <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-700">
                        {d.shiftSource ? (
                          <span className="inline-flex items-center gap-2">
                            <Badge tone="info">{d.shiftSource}</Badge>
                            <span className="font-medium">{d.shiftSignature || "—"}</span>
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="border-b border-zinc-100 px-3 py-2 text-xs text-zinc-700">
                        {Array.isArray(d.anomalies) && d.anomalies.length ? d.anomalies.join(", ") : <span className="text-zinc-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}