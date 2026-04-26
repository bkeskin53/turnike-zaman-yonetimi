"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type DashboardData = any;

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function TonePill(props: { tone: "ok" | "warn" | "danger" | "neutral"; children: React.ReactNode }) {
  const cls =
    props.tone === "danger"
      ? "border-red-200 bg-red-50 text-red-700"
      : props.tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : props.tone === "ok"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-zinc-200 bg-zinc-50 text-zinc-700";
  return <span className={cx("inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold", cls)}>{props.children}</span>;
}

function RolePill({ role }: { role: string }) {
  return <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-extrabold uppercase tracking-tight text-zinc-700">ROL: {role}</span>;
}

function fmtIso(iso: string | null | undefined) {
  if (!iso) return "—";
  // keep simple (no extra deps in client)
  return iso.replace("T", " ").replace(".000Z", "Z");
}

export default function IntegrationDashboardClient(props: {
  initialHours: number;
  initialLimit: number;
  data: DashboardData;
  role: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const [hours, setHours] = useState<number>(props.initialHours || 24);
  const [limit, setLimit] = useState<number>(props.initialLimit || 20);

  const totals = props.data?.totals ?? { requests: 0, success: 0, partial: 0, failed: 0 };
  const byEndpoint = props.data?.byEndpoint ?? [];
  const bySourceSystem = props.data?.bySourceSystem ?? [];
  const recentProblems = props.data?.recentProblems ?? [];
  const secRecent = props.data?.security?.recent ?? [];
  const secByReason = props.data?.security?.byReason ?? [];

  const successRate = useMemo(() => {
    const req = Number(totals.requests ?? 0);
    const ok = Number(totals.success ?? 0);
    if (req <= 0) return 0;
    return Math.round((ok / req) * 100);
  }, [totals]);

  function applyQuery(nextHours: number, nextLimit: number) {
    const q = new URLSearchParams(sp?.toString() ?? "");
    q.set("hours", String(nextHours));
    q.set("limit", String(nextLimit));
    router.push(`/integration?${q.toString()}`);
  }

  function exportCsv(kind: string) {
    const q = new URLSearchParams(sp?.toString() ?? "");
    q.set("hours", String(hours));
    q.set("limit", String(limit));
    q.set("kind", kind);
    // open in new tab to download without disrupting current UI state
    window.open(`/integration/export.csv?${q.toString()}`, "_blank");
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold tracking-tight">Integration Dashboard</div>
            <TonePill tone={totals.failed > 0 ? "danger" : totals.partial > 0 ? "warn" : "ok"}>
              {totals.failed > 0 ? "ALERT" : totals.partial > 0 ? "WATCH" : "OK"} · {successRate}%
            </TonePill>
            <RolePill role={props.role} />
            <TonePill tone="neutral">READ-ONLY</TonePill>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-zinc-600">Window</label>
            <select
              className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm"
              value={hours}
              onChange={(e) => {
                const v = Number(e.target.value);
                setHours(v);
                applyQuery(v, limit);
              }}
            >
              <option value={1}>Last 1h</option>
              <option value={6}>Last 6h</option>
              <option value={24}>Last 24h</option>
              <option value={72}>Last 72h</option>
              <option value={168}>Last 7d</option>
            </select>

            <label className="text-sm text-zinc-600">List</label>
            <select
              className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm"
              value={limit}
              onChange={(e) => {
                const v = Number(e.target.value);
                setLimit(v);
                applyQuery(hours, v);
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>

            <button
              className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-50"
              onClick={() => router.refresh()}
            >
              Refresh
            </button>

            <div className="h-9 w-px bg-zinc-200" />

            <button
              className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-50"
              onClick={() => router.push("/integration/settings")}
              title="Integration settings"
            >
              Settings
            </button>

            <button
              className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-50"
              onClick={() => exportCsv("recentProblems")}
              title="Recent Problems CSV"
            >
              Export Problems
            </button>
            <button
              className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-50"
              onClick={() => exportCsv("byEndpoint")}
              title="By Endpoint CSV"
            >
              Export Endpoints
            </button>
            <button
              className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-50"
              onClick={() => exportCsv("securityRecent")}
              title="Security (blocked attempts) CSV"
            >
              Export Security
            </button>
          </div>
        </div>
        
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900/90">
          <span className="font-extrabold">Yetki notu:</span>{" "}
          Bu ekran sadece izleme amaçlıdır. Entegrasyon endpoint erişimi rol ile değil <b>API Key</b> ile kontrol edilir.
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className="text-xs font-semibold text-zinc-600">Requests</div>
            <div className="mt-1 text-2xl font-semibold">{totals.requests}</div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className="text-xs font-semibold text-zinc-600">SUCCESS</div>
            <div className="mt-1 text-2xl font-semibold">{totals.success}</div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className="text-xs font-semibold text-zinc-600">PARTIAL</div>
            <div className="mt-1 text-2xl font-semibold">{totals.partial}</div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className="text-xs font-semibold text-zinc-600">FAILED</div>
            <div className="mt-1 text-2xl font-semibold">{totals.failed}</div>
          </div>
        </div>

        <div className="mt-3 text-xs text-zinc-500">
          Window: {fmtIso(props.data?.window?.since)} → {fmtIso(props.data?.window?.until)}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">By Endpoint</div>
            <TonePill tone="neutral">{byEndpoint.length} endpoints</TonePill>
          </div>
          <div className="mt-3 overflow-auto rounded-xl border border-zinc-100">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Endpoint</th>
                  <th className="px-3 py-2 text-right font-semibold">Req</th>
                  <th className="px-3 py-2 text-right font-semibold">OK</th>
                  <th className="px-3 py-2 text-right font-semibold">Partial</th>
                  <th className="px-3 py-2 text-right font-semibold">Fail</th>
                </tr>
              </thead>
              <tbody>
                {byEndpoint.map((r: any) => (
                  <tr key={r.endpoint} className="border-t border-zinc-100">
                    <td className="px-3 py-2 font-mono text-xs">{r.endpoint}</td>
                    <td className="px-3 py-2 text-right">{r.requests}</td>
                    <td className="px-3 py-2 text-right">{r.success}</td>
                    <td className="px-3 py-2 text-right">{r.partial}</td>
                    <td className="px-3 py-2 text-right">{r.failed}</td>
                  </tr>
                ))}
                {byEndpoint.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-sm text-zinc-500" colSpan={5}>
                      No data in this window.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">By Source System</div>
            <TonePill tone="neutral">{bySourceSystem.length} sources</TonePill>
          </div>
          <div className="mt-3 overflow-auto rounded-xl border border-zinc-100">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Source</th>
                  <th className="px-3 py-2 text-right font-semibold">Req</th>
                  <th className="px-3 py-2 text-right font-semibold">OK</th>
                  <th className="px-3 py-2 text-right font-semibold">Partial</th>
                  <th className="px-3 py-2 text-right font-semibold">Fail</th>
                </tr>
              </thead>
              <tbody>
                {bySourceSystem.map((r: any) => (
                  <tr key={r.sourceSystem} className="border-t border-zinc-100">
                    <td className="px-3 py-2 font-semibold">{r.sourceSystem}</td>
                    <td className="px-3 py-2 text-right">{r.requests}</td>
                    <td className="px-3 py-2 text-right">{r.success}</td>
                    <td className="px-3 py-2 text-right">{r.partial}</td>
                    <td className="px-3 py-2 text-right">{r.failed}</td>
                  </tr>
                ))}
                {bySourceSystem.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-sm text-zinc-500" colSpan={5}>
                      No data in this window.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Recent Problems</div>
            <TonePill tone={recentProblems.length ? "warn" : "ok"}>{recentProblems.length ? "needs attention" : "clean"}</TonePill>
          </div>
          <div className="mt-3 overflow-auto rounded-xl border border-zinc-100">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Request</th>
                  <th className="px-3 py-2 text-left font-semibold">Endpoint</th>
                  <th className="px-3 py-2 text-right font-semibold">Failed</th>
                  <th className="px-3 py-2 text-left font-semibold">At</th>
                </tr>
              </thead>
              <tbody>
                {recentProblems.map((r: any) => (
                  <tr key={r.requestId} className="border-t border-zinc-100">
                    <td className="px-3 py-2">
                      <button
                        className="font-mono text-xs text-indigo-700 hover:underline"
                        onClick={() => router.push(`/integration/requests/${r.requestId}`)}
                        title="Copy requestId"
                      >
                        {String(r.requestId).slice(0, 10)}…
                      </button>
                      <div className="mt-1 flex items-center gap-2">
                        <TonePill tone={r.status === "FAILED" ? "danger" : "warn"}>{r.status}</TonePill>
                        <span className="text-xs text-zinc-500">{r.sourceSystem}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.endpoint}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={cx("font-semibold", r.failedCount > 0 && "text-red-700")}>{r.failedCount}</span>
                      <span className="text-xs text-zinc-500"> / {r.totalCount}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-600">{fmtIso(r.receivedAt)}</td>
                  </tr>
                ))}
                {recentProblems.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-sm text-zinc-500" colSpan={4}>
                      No failures/partials in this window.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Security (Blocked Attempts)</div>
            <div className="flex items-center gap-2">
              {secByReason.slice(0, 3).map((r: any) => (
                <TonePill key={r.reason} tone={r.reason === "FORBIDDEN_IP" || r.reason === "INVALID_API_KEY" ? "warn" : "neutral"}>
                  {r.reason} · {r.count}
                </TonePill>
              ))}
            </div>
          </div>

          <div className="mt-3 overflow-auto rounded-xl border border-zinc-100">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Reason</th>
                  <th className="px-3 py-2 text-left font-semibold">Endpoint</th>
                  <th className="px-3 py-2 text-left font-semibold">IP</th>
                  <th className="px-3 py-2 text-left font-semibold">At</th>
                </tr>
              </thead>
              <tbody>
                {secRecent.map((r: any) => (
                  <tr key={r.id} className="border-t border-zinc-100">
                    <td className="px-3 py-2">
                      <TonePill tone={r.reason === "FORBIDDEN_IP" ? "danger" : r.reason === "INVALID_API_KEY" ? "warn" : "neutral"}>
                        {r.reason}
                      </TonePill>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.endpoint}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.sourceIp ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-zinc-600">{fmtIso(r.receivedAt)}</td>
                  </tr>
                ))}
                {secRecent.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-sm text-zinc-500" colSpan={4}>
                      No blocked attempts in this window.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            Not: Bu ekran sadece metadata gösterir (PII yok). requestId / externalRef gibi operasyonel referanslar ayrı loglarda.
          </div>
        </div>
      </div>
    </div>
  );
}
