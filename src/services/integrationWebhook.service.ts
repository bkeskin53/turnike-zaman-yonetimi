import crypto from "crypto";

export type IntegrationCallbackConfig = {
  url: string;
  secret?: string | null;
  mode?: "ON_SUCCESS" | "ON_DONE";
};

type CallbackResult = {
  ok: boolean;
  attempts: number;
  lastStatus: number | null;
  lastError: string | null;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

function signBody(secret: string, raw: string) {
  const h = crypto.createHmac("sha256", secret);
  h.update(raw, "utf8");
  return `sha256=${h.digest("hex")}`;
}

export async function sendIntegrationCallback(input: {
  callback: IntegrationCallbackConfig;
  payload: any;
}): Promise<CallbackResult> {
  const url = String(input.callback.url ?? "").trim();
  if (!url) return { ok: false, attempts: 0, lastStatus: null, lastError: "missing url" };

  const raw = JSON.stringify(input.payload ?? {});
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "turnike-integration-webhook/1.0",
  };

  const secret = String(input.callback.secret ?? "").trim();
  if (secret) headers["x-integration-webhook-signature"] = signBody(secret, raw);

  const backoff = [0, 2000, 10000];
  let lastStatus: number | null = null;
  let lastError: string | null = null;

  for (let i = 0; i < backoff.length; i++) {
    const wait = backoff[i]!;
    if (wait) await sleep(wait);

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: raw,
        signal: ctrl.signal,
      });
      lastStatus = res.status;
      if (res.ok) {
        clearTimeout(t);
        return { ok: true, attempts: i + 1, lastStatus, lastError: null };
      }
      lastError = `http_${res.status}`;
    } catch (e: any) {
      lastError = e?.name === "AbortError" ? "timeout" : String(e?.message ?? "fetch_error");
    } finally {
      clearTimeout(t);
    }
  }

  return { ok: false, attempts: backoff.length, lastStatus, lastError };
}

export function summarizeCallbackForMeta(cb: IntegrationCallbackConfig, result: CallbackResult) {
  return {
    urlHost: safeHost(cb.url),
    mode: cb.mode ?? "ON_DONE",
    attempts: result.attempts,
    ok: result.ok,
    lastStatus: result.lastStatus,
    lastError: result.lastError,
  };
}
