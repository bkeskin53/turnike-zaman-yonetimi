"use client";

import { useMemo, useState } from "react";

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

function genKey(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  // base64url-ish (no + / =)
  const b64 = btoa(String.fromCharCode(...arr));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export default function IntegrationSettingsClient(props: {
  cfg: {
    apiKeyMasked: string;
    apiKeyConfigured: boolean;
    allowlistRaw: string;
    allowlistEnabled: boolean;
    trustProxy: boolean;
    maxBatchSize: number | null;
  };
  warnings: string[];
}) {
  const [newKey, setNewKey] = useState<string>("");
  const [localAllowlist, setLocalAllowlist] = useState<string>(props.cfg.allowlistRaw || "");
  const [localTrustProxy, setLocalTrustProxy] = useState<boolean>(props.cfg.trustProxy);
  const [localMaxBatch, setLocalMaxBatch] = useState<number>(props.cfg.maxBatchSize ?? 500);

  const envSnippet = useMemo(() => {
    const lines: string[] = [];
    lines.push(`# Integration settings (apply in your .env / Docker env, then restart app)`);
    if (newKey) lines.push(`INTEGRATION_API_KEY="${newKey}"`);
    else lines.push(`# INTEGRATION_API_KEY="(generate a new key below)"`);
    if (localAllowlist.trim()) lines.push(`INTEGRATION_IP_ALLOWLIST=${localAllowlist.trim()}`);
    else lines.push(`INTEGRATION_IP_ALLOWLIST=`);
    lines.push(`INTEGRATION_TRUST_PROXY=${localTrustProxy ? 1 : 0}`);
    lines.push(`INTEGRATION_MAX_BATCH_SIZE=${Number.isFinite(localMaxBatch) ? localMaxBatch : 500}`);
    return lines.join("\n");
  }, [newKey, localAllowlist, localTrustProxy, localMaxBatch]);

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold tracking-tight">Current Runtime Config</div>
          <TonePill tone={props.cfg.apiKeyConfigured ? "ok" : "danger"}>
            {props.cfg.apiKeyConfigured ? "API key configured" : "API key missing"}
          </TonePill>
        </div>

        <div className="mt-3 grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="text-zinc-600">INTEGRATION_API_KEY</div>
            <div className="font-mono">{props.cfg.apiKeyMasked}</div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="text-zinc-600">INTEGRATION_IP_ALLOWLIST</div>
            <div className="font-mono text-right">{props.cfg.allowlistEnabled ? props.cfg.allowlistRaw : "— (disabled)"}</div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="text-zinc-600">INTEGRATION_TRUST_PROXY</div>
            <div className="font-mono">{props.cfg.trustProxy ? "1" : "0"}</div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="text-zinc-600">INTEGRATION_MAX_BATCH_SIZE</div>
            <div className="font-mono">{props.cfg.maxBatchSize ?? "—"}</div>
          </div>
        </div>

        {props.warnings.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="text-sm font-semibold text-amber-900">Warnings</div>
            <ul className="mt-2 list-disc pl-5 text-sm text-amber-900">
              {props.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold tracking-tight">Key Rotation Helper</div>
          <TonePill tone="neutral">server restart required</TonePill>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className="text-sm font-semibold">Generate new API key</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-50"
                onClick={() => setNewKey(genKey(32))}
              >
                Generate
              </button>
              <button
                className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-50"
                onClick={() => {
                  if (!newKey) return;
                  navigator.clipboard?.writeText(newKey);
                }}
                disabled={!newKey}
                title={!newKey ? "Generate first" : "Copy"}
              >
                Copy
              </button>
              {newKey && <span className="font-mono text-xs text-zinc-700">{newKey.slice(0, 10)}…</span>}
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              Not: Bu anahtar yalnızca bu sayfada üretilir; sistem otomatik olarak ENV değiştirmez.
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className="text-sm font-semibold">Suggested security config</div>
            <div className="mt-2 grid gap-2 text-sm">
              <label className="text-xs font-semibold text-zinc-600">Allowlist</label>
              <input
                className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm"
                value={localAllowlist}
                onChange={(e) => setLocalAllowlist(e.target.value)}
                placeholder="127.0.0.1,::1,10.0.0.0/8"
              />

              <label className="text-xs font-semibold text-zinc-600">Trust proxy (X-Forwarded-For)</label>
              <div className="flex items-center gap-2">
                <button
                  className={cx(
                    "h-9 rounded-lg border px-3 text-sm font-medium",
                    localTrustProxy ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white hover:bg-zinc-50"
                  )}
                  onClick={() => setLocalTrustProxy(true)}
                >
                  ON
               </button>
                <button
                  className={cx(
                    "h-9 rounded-lg border px-3 text-sm font-medium",
                    !localTrustProxy ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white hover:bg-zinc-50"
                  )}
                  onClick={() => setLocalTrustProxy(false)}
                >
                  OFF
                </button>
              </div>

              <label className="text-xs font-semibold text-zinc-600">Max batch size</label>
              <input
                className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm"
                type="number"
                value={localMaxBatch}
                onChange={(e) => setLocalMaxBatch(Number(e.target.value))}
                min={1}
                max={5000}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">.env snippet</div>
            <button
              className="h-8 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium hover:bg-zinc-50"
              onClick={() => navigator.clipboard?.writeText(envSnippet)}
            >
              Copy snippet
            </button>
          </div>
          <pre className="mt-2 max-h-[320px] overflow-auto rounded bg-white p-3 text-xs">{envSnippet}</pre>
          <div className="mt-2 text-xs text-zinc-500">
            Apply steps: (1) update env (2) restart app/container (3) verify with integration health/metrics.
          </div>
        </div>
      </div>
    </div>
  );
}
