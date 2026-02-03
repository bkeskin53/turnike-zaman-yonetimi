"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CallbackMode = "ON_DONE" | "ON_SUCCESS";
type Json = any;

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function mondayOfThisWeekLocalISO() {
  // Tarayıcı local time (genelde Europe/Istanbul). Pazartesi (ISO) başlangıcı.
  const now = new Date();
  const day = now.getDay(); // Sunday=0
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, "0");
  const dd = String(monday.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function pretty(obj: any) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj ?? "");
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function pickErrorMessage(e: any) {
  if (!e) return "unknown error";
  if (typeof e === "string") return e;
  if (e?.message) return String(e.message);
  return "request failed";
}

async function safeReadJson(res: Response) {
  const ct = String(res.headers.get("content-type") ?? "");
  if (!ct.includes("application/json")) {
    const text = await res.text();
    return { nonJson: true, text };
  }
  return res.json();
}

export default function SapSimulatorClient() {
  const [baseUrl, setBaseUrl] = useState("http://localhost:3000");
  const [apiKey, setApiKey] = useState("");
  const [sourceSystem, setSourceSystem] = useState("SAP");
  const [dryRun, setDryRun] = useState(false);

  const [callbackEnabled, setCallbackEnabled] = useState(true);
  const [callbackUrl, setCallbackUrl] = useState("http://localhost:8088/callback");
  const [callbackSecret, setCallbackSecret] = useState("demo_webhook_secret_change_me");
  const [callbackMode, setCallbackMode] = useState<CallbackMode>("ON_DONE");

  // Demo data inputs (single)
  const [employeeCode, setEmployeeCode] = useState("E001");
  const [fullName, setFullName] = useState("Ali Veli");
  const [employeeExternalRef, setEmployeeExternalRef] = useState("EMP-EXT-001");

  const [weekStartDate, setWeekStartDate] = useState(mondayOfThisWeekLocalISO());
  const [planExternalRef, setPlanExternalRef] = useState("PLAN-EXT-001");

  const [leaveExternalRef, setLeaveExternalRef] = useState("LEAVE-EXT-001");
  const [leaveFrom, setLeaveFrom] = useState(mondayOfThisWeekLocalISO());
  const [leaveTo, setLeaveTo] = useState(() => {
    const m = mondayOfThisWeekLocalISO();
    const d = new Date(m + "T00:00:00");
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [busy, setBusy] = useState(false);
  const [lastRequest, setLastRequest] = useState<Json | null>(null);
  const [lastResponse, setLastResponse] = useState<Json | null>(null);
  const [lastHttp, setLastHttp] = useState<{ url: string; method: string; status: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Scenario Builder (Bulk)
  const [bulkEnabled, setBulkEnabled] = useState(true);
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkCodePrefix, setBulkCodePrefix] = useState("E");
  const [bulkStartIndex, setBulkStartIndex] = useState(1);
  const [bulkNamePrefix, setBulkNamePrefix] = useState("Test Personel");
  const [bulkLeaveCount, setBulkLeaveCount] = useState(3); // ilk N kişiye izin
  const [bulkPreview, setBulkPreview] = useState<any | null>(null);

  const storageKey = "sapSimulator.v1";

  // load persisted config
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj.baseUrl) setBaseUrl(String(obj.baseUrl));
      if (obj.apiKey) setApiKey(String(obj.apiKey));
      if (obj.sourceSystem) setSourceSystem(String(obj.sourceSystem));
      if (typeof obj.dryRun === "boolean") setDryRun(Boolean(obj.dryRun));
      if (typeof obj.callbackEnabled === "boolean") setCallbackEnabled(Boolean(obj.callbackEnabled));
      if (obj.callbackUrl) setCallbackUrl(String(obj.callbackUrl));
      if (obj.callbackSecret) setCallbackSecret(String(obj.callbackSecret));
      if (obj.callbackMode === "ON_DONE" || obj.callbackMode === "ON_SUCCESS") setCallbackMode(obj.callbackMode);

      if (typeof obj.bulkEnabled === "boolean") setBulkEnabled(Boolean(obj.bulkEnabled));
      if (typeof obj.bulkCount === "number") setBulkCount(Number(obj.bulkCount));
      if (typeof obj.bulkStartIndex === "number") setBulkStartIndex(Number(obj.bulkStartIndex));
      if (obj.bulkCodePrefix) setBulkCodePrefix(String(obj.bulkCodePrefix));
      if (obj.bulkNamePrefix) setBulkNamePrefix(String(obj.bulkNamePrefix));
      if (typeof obj.bulkLeaveCount === "number") setBulkLeaveCount(Number(obj.bulkLeaveCount));
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist config
  useEffect(() => {
    if (typeof window === "undefined") return;
    const obj = {
      baseUrl,
      apiKey,
      sourceSystem,
      dryRun,
      callbackEnabled,
      callbackUrl,
      callbackSecret,
      callbackMode,
      bulkEnabled,
      bulkCount,
      bulkCodePrefix,
      bulkStartIndex,
      bulkNamePrefix,
      bulkLeaveCount,
    };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(obj));
    } catch {
      // ignore
    }
  }, [
    baseUrl,
    apiKey,
    sourceSystem,
    dryRun,
    callbackEnabled,
    callbackUrl,
    callbackSecret,
    callbackMode,
    bulkEnabled,
    bulkCount,
    bulkCodePrefix,
    bulkStartIndex,
    bulkNamePrefix,
    bulkLeaveCount,
  ]);

  const callbackObj = useMemo(() => {
    if (!callbackEnabled) return null;
    return {
      url: callbackUrl,
      secret: callbackSecret,
      mode: callbackMode,
    };
  }, [callbackEnabled, callbackUrl, callbackSecret, callbackMode]);

  function pad3(n: number) {
    return String(n).padStart(3, "0");
  }

  function buildEmployeeCode(i: number) {
    // E001..E010 formatı (bulkStartIndex bazlı)
    const idx = bulkStartIndex + i;
    return `${bulkCodePrefix}${pad3(idx)}`;
  }

  function buildExternalRef(kind: "EMP" | "PLAN" | "LEAVE", code: string) {
    // SAP referansı gibi; DB id ile hiçbir ilgisi yok.
    if (kind === "EMP") return `EMP-${sourceSystem}-${code}`;
    if (kind === "PLAN") return `PLAN-${sourceSystem}-${weekStartDate}-${code}`;
    return `LEAVE-${sourceSystem}-${leaveFrom}-${code}`;
  }

  function mkBatchRef(prefix: string) {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${prefix}-${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
  }

  function reqDetailUrlFromResponse(resp: any) {
    const rid = String(resp?.requestId ?? "").trim();
    if (!rid) return null;
    return `/integration/requests/${rid}`;
  }

  async function sendJson(method: "POST" | "GET", path: string, body?: any) {
    setError(null);
    setLastResponse(null);
    setLastRequest(body ?? null);

    let url = `${baseUrl.replace(/\/$/, "")}${path}`;
    // Integration API dryRun kontratı: query param dryRun=1
    // Route'lar body.dryRun okumuyor; bu yüzden UI'da URL'e ekliyoruz.
    if (method === "POST" && dryRun) {
      url = url.includes("?") ? `${url}&dryRun=1` : `${url}?dryRun=1`;
    }

    setLastHttp({ url, method, status: 0 });

    const headers: Record<string, string> = {
      "x-integration-api-key": apiKey.trim(),
    };
    if (method === "POST") headers["content-type"] = "application/json";

    const res = await fetch(url, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
    });

    setLastHttp({ url, method, status: res.status });
    const json = await safeReadJson(res);
    setLastResponse(json);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return json;
  }

  async function run(action: () => Promise<any>) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(pickErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // Payload builders (single)
  function payloadEmployees() {
    const [firstName, ...rest] = fullName.trim().split(/\s+/).filter(Boolean);
    const lastName = rest.join(" ") || "";
    const batchRef = mkBatchRef("EMP");
    const body: any = {
      sourceSystem,
      batchRef,
      employees: [
        {
          externalRef: employeeExternalRef,
          employeeCode,
          firstName: firstName || fullName,
          lastName,
          isActive: true,
        },
      ],
    };
    if (callbackObj && !dryRun) body.callback = callbackObj;
    return body;
  }

  function payloadShiftTemplates() {
    const batchRef = mkBatchRef("SHIFT-TPL");
    const body: any = {
      sourceSystem,
      batchRef,
      templates: [
        { signature: "0900-1800", startTime: "09:00", endTime: "18:00" },
        { signature: "1800-0300+1", startTime: "18:00", endTime: "03:00" },
      ],
    };
    if (callbackObj && !dryRun) body.callback = callbackObj;
    return body;
  }

  function payloadShiftTemplatesFailSignature() {
    const batchRef = mkBatchRef("SHIFT-TPL-FAIL");
    const body: any = {
      sourceSystem,
      batchRef,
      templates: [
        // KASITLI HATALI: overnight vardiya ama signature +1 yok => SIGNATURE_MISMATCH => FAILED
        { signature: "1800-0300", startTime: "18:00", endTime: "03:00" },
      ],
    };
    if (callbackObj && !dryRun) body.callback = callbackObj;
    return body;
  }

  function payloadShiftAssignments() {
    const batchRef = mkBatchRef("SHIFT-ASG");
    const body: any = {
      sourceSystem,
      batchRef,
      plans: [
        {
          externalRef: planExternalRef,
          employeeCode,
          weekStartDate,
          defaultShiftTemplateSignature: "0900-1800",
          days: {
            mon: { shiftTemplateSignature: "0900-1800" },
            tue: { startMinute: 540, endMinute: 1080 },
          },
        },
      ],
    };
    if (callbackObj && !dryRun) body.callback = callbackObj;
    return body;
  }

  function payloadLeaves() {
    const batchRef = mkBatchRef("LEAVE");
    const body: any = {
      sourceSystem,
      batchRef,
      leaves: [
        {
          externalRef: leaveExternalRef,
          employeeCode,
          dateFrom: leaveFrom,
          dateTo: leaveTo,
          type: "ANNUAL",
          note: "UI simulator test leave",
        },
      ],
    };
    if (callbackObj && !dryRun) body.callback = callbackObj;
    return body;
  }

  // Payload builders (bulk)
  function payloadEmployeesBulk() {
    const batchRef = mkBatchRef("EMP-BULK");
    const employees = Array.from({ length: Math.max(1, bulkCount) }, (_, i) => {
      const code = buildEmployeeCode(i);
      return {
        externalRef: buildExternalRef("EMP", code),
        employeeCode: code,
        firstName: bulkNamePrefix,
        lastName: pad3(bulkStartIndex + i),
        isActive: true,
      };
    });
    const body: any = { sourceSystem, batchRef, employees };
    if (callbackObj && !dryRun) body.callback = callbackObj;
    return body;
  }

  function payloadShiftAssignmentsBulk() {
    const batchRef = mkBatchRef("SHIFT-ASG-BULK");
    const plans = Array.from({ length: Math.max(1, bulkCount) }, (_, i) => {
      const code = buildEmployeeCode(i);
      return {
        externalRef: buildExternalRef("PLAN", code),
        employeeCode: code,
        weekStartDate,
        defaultShiftTemplateSignature: "0900-1800",
        days: {
          mon: { shiftTemplateSignature: "0900-1800" },
          tue: { startMinute: 540, endMinute: 1080 },
        },
      };
    });
    const body: any = { sourceSystem, batchRef, plans };
    if (callbackObj && !dryRun) body.callback = callbackObj;
    return body;
  }

  function payloadLeavesBulk() {
    const n = Math.max(0, Math.min(bulkLeaveCount, Math.max(1, bulkCount)));
    const batchRef = mkBatchRef("LEAVE-BULK");
    const leaves = Array.from({ length: n }, (_, i) => {
      const code = buildEmployeeCode(i);
      return {
        externalRef: buildExternalRef("LEAVE", code),
        employeeCode: code,
        dateFrom: leaveFrom,
        dateTo: leaveTo,
        type: "ANNUAL",
        note: "UI bulk scenario leave",
      };
    });
    const body: any = { sourceSystem, batchRef, leaves };
    if (callbackObj && !dryRun) body.callback = callbackObj;
    return body;
  }

  function buildBulkPreview() {
    return {
      employeesUpsert: payloadEmployeesBulk(),
      shiftTemplatesUpsert: payloadShiftTemplates(),
      shiftAssignmentsUpsert: payloadShiftAssignmentsBulk(),
      leavesUpsert: payloadLeavesBulk(),
      notes: {
        doesNotUseDbIds: true,
        keys: ["employeeCode", "externalRef", "signature", "weekStartDate", "dateFrom/dateTo"],
      },
    };
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Senaryo</div>
            <div className="text-sm text-zinc-600">
              Sen (SAP/Logo) bu sayfadan veri gönderirsin. Ben (Turnike sahibi) Integration ekranından sonucu izlerim.
              <span className="ml-2">
                <Link href="/integration" className="text-blue-600 hover:underline">
                  Integration Dashboard’a git
                </Link>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="h-4 w-4"
              />
              DryRun
            </label>
            <span className={cx("text-xs", dryRun ? "text-amber-700" : "text-zinc-500")}>
              DryRun açıkken webhook atılmaz.
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-semibold text-zinc-900">Bağlantı</div>
          <div className="mt-3 grid grid-cols-1 gap-3">
            <label className="text-sm">
              <div className="mb-1 text-zinc-600">Base URL (Turnike)</div>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2"
                placeholder="http://localhost:3000"
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 text-zinc-600">Integration API Key</div>
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2"
                placeholder="demo_integration_key_change_me"
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 text-zinc-600">Source System</div>
              <input
                value={sourceSystem}
                onChange={(e) => setSourceSystem(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2"
                placeholder="SAP"
              />
            </label>

            <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={callbackEnabled}
                  onChange={(e) => setCallbackEnabled(e.target.checked)}
                  className="h-4 w-4"
                />
                Callback / Webhook
              </label>

              <div className={cx("mt-3 grid grid-cols-1 gap-3", !callbackEnabled && "opacity-50")} aria-disabled={!callbackEnabled}>
                <label className="text-sm">
                  <div className="mb-1 text-zinc-600">Callback URL</div>
                  <input
                    value={callbackUrl}
                    onChange={(e) => setCallbackUrl(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2"
                    placeholder="http://localhost:8088/callback"
                    disabled={!callbackEnabled}
                  />
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-zinc-600">Callback Secret</div>
                  <input
                    value={callbackSecret}
                    onChange={(e) => setCallbackSecret(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2"
                    disabled={!callbackEnabled}
                  />
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-zinc-600">Mode</div>
                  <select
                    value={callbackMode}
                    onChange={(e) => setCallbackMode(e.target.value as CallbackMode)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2"
                    disabled={!callbackEnabled}
                  >
                    <option value="ON_DONE">ON_DONE (SUCCESS/PARTIAL/FAILED)</option>
                    <option value="ON_SUCCESS">ON_SUCCESS (sadece SUCCESS)</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-semibold text-zinc-900">Test Verileri</div>
          <div className="mt-3 grid grid-cols-1 gap-3">
            <label className="text-sm">
              <div className="mb-1 text-zinc-600">Employee Code</div>
              <input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
            <label className="text-sm">
              <div className="mb-1 text-zinc-600">Full Name</div>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
            <label className="text-sm">
              <div className="mb-1 text-zinc-600">Employee externalRef</div>
              <input value={employeeExternalRef} onChange={(e) => setEmployeeExternalRef(e.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>

            <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 md:grid-cols-2">
              <label className="text-sm">
                <div className="mb-1 text-zinc-600">Week Start Date</div>
                <input value={weekStartDate} onChange={(e) => setWeekStartDate(e.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2" placeholder="YYYY-MM-DD" />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-zinc-600">Plan externalRef</div>
                <input value={planExternalRef} onChange={(e) => setPlanExternalRef(e.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2" />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 md:grid-cols-3">
              <label className="text-sm md:col-span-1">
                <div className="mb-1 text-zinc-600">Leave externalRef</div>
                <input value={leaveExternalRef} onChange={(e) => setLeaveExternalRef(e.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2" />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-zinc-600">Leave From</div>
                <input value={leaveFrom} onChange={(e) => setLeaveFrom(e.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2" placeholder="YYYY-MM-DD" />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-zinc-600">Leave To</div>
                <input value={leaveTo} onChange={(e) => setLeaveTo(e.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2" placeholder="YYYY-MM-DD" />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Scenario Builder (Bulk) */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Scenario Builder (Toplu)</div>
            <div className="text-sm text-zinc-600">
              SAP/Logo gibi davran: DB id bilmeden, sadece <span className="font-medium">employeeCode + externalRef</span> ile toplu veri gönder.
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={bulkEnabled} onChange={(e) => setBulkEnabled(e.target.checked)} className="h-4 w-4" />
            Toplu modu kullan
          </label>
        </div>

        <div className={cx("mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4", !bulkEnabled && "opacity-50")}>
          <label className="text-sm">
            <div className="mb-1 text-zinc-600">Kişi sayısı</div>
            <input
              type="number"
              min={1}
              max={500}
              value={bulkCount}
              onChange={(e) => setBulkCount(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2"
              disabled={!bulkEnabled}
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-zinc-600">Kod prefix</div>
            <input
              value={bulkCodePrefix}
              onChange={(e) => setBulkCodePrefix(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2"
              disabled={!bulkEnabled}
              placeholder="E"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-zinc-600">Başlangıç index</div>
            <input
              type="number"
              min={1}
              value={bulkStartIndex}
              onChange={(e) => setBulkStartIndex(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2"
              disabled={!bulkEnabled}
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-zinc-600">İzin verilecek kişi</div>
            <input
              type="number"
              min={0}
              max={bulkCount}
              value={bulkLeaveCount}
              onChange={(e) => setBulkLeaveCount(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2"
              disabled={!bulkEnabled}
              title="İlk N kişiye leaveFrom-leaveTo arası ANNUAL izin yazılır."
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className={cx("rounded-lg border px-3 py-2 text-sm", (!bulkEnabled || busy) ? "cursor-not-allowed opacity-60" : "hover:bg-zinc-50")}
            disabled={!bulkEnabled || busy}
            onClick={() => {
              const p = buildBulkPreview();
              setBulkPreview(p);
              setLastRequest(p);
              setLastResponse({ ok: true, note: "preview only (not sent)" });
              setToast("Preview üretildi ✅");
              setTimeout(() => setToast(null), 1500);
            }}
          >
            Generate Preview
          </button>

          <button
            className={cx("rounded-lg border px-3 py-2 text-sm", (!bulkEnabled || busy) ? "cursor-not-allowed opacity-60" : "hover:bg-zinc-50")}
            disabled={!bulkEnabled || busy}
            title="Employees → Shift Templates → Shift Assignments → Leaves (toplu)"
            onClick={() =>
              run(async () => {
                const p = buildBulkPreview();
                setBulkPreview(p);
                await sendJson("POST", "/api/integration/v1/employees/upsert", p.employeesUpsert);
                await sendJson("POST", "/api/integration/v1/shift-templates/upsert", p.shiftTemplatesUpsert);
                await sendJson("POST", "/api/integration/v1/shift-assignments/upsert", p.shiftAssignmentsUpsert);
                await sendJson("POST", "/api/integration/v1/leaves/upsert", p.leavesUpsert);
              })
            }
          >
            Send Bulk Suite
          </button>
        </div>

        <div className="mt-3 text-xs text-zinc-600">
          Örnek employeeCode: <span className="font-medium">{bulkCodePrefix}{pad3(bulkStartIndex)}</span>{" "}
          · externalRef: <span className="font-medium">EMP-{sourceSystem}-E001</span>,{" "}
          <span className="font-medium">PLAN-{sourceSystem}-{weekStartDate}-E001</span>,{" "}
          <span className="font-medium">LEAVE-{sourceSystem}-{leaveFrom}-E001</span>
        </div>

        {bulkPreview ? (
          <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-xs text-zinc-700">
            <div className="mb-2 font-semibold">Bulk Preview hazır</div>
            <div>İstersen alttaki Request kutusunda kopyalayıp inceleyebilirsin.</div>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Gönderimler</div>
            <div className="text-sm text-zinc-600">Her buton, ilgili entegrasyon kapısına (endpoint) bir batch gönderir.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={cx("rounded-lg border px-3 py-2 text-sm", busy ? "cursor-not-allowed opacity-60" : "hover:bg-zinc-50")}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await sendJson("POST", "/api/integration/v1/employees/upsert", payloadEmployees());
                  await sendJson("POST", "/api/integration/v1/shift-templates/upsert", payloadShiftTemplates());
                  await sendJson("POST", "/api/integration/v1/shift-assignments/upsert", payloadShiftAssignments());
                  await sendJson("POST", "/api/integration/v1/leaves/upsert", payloadLeaves());
                })
              }
              title="Employees → Shift Templates → Shift Assignments → Leaves"
            >
              Full Suite
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button className={cx("rounded-lg border px-3 py-2 text-sm", busy ? "cursor-not-allowed opacity-60" : "hover:bg-zinc-50")} disabled={busy} onClick={() => run(() => sendJson("POST", "/api/integration/v1/employees/upsert", payloadEmployees()))}>
            Employees Upsert
          </button>
          <button className={cx("rounded-lg border px-3 py-2 text-sm", busy ? "cursor-not-allowed opacity-60" : "hover:bg-zinc-50")} disabled={busy} onClick={() => run(() => sendJson("POST", "/api/integration/v1/shift-templates/upsert", payloadShiftTemplates()))}>
            Shift Templates Upsert
          </button>
          <button
            className={cx("rounded-lg border px-3 py-2 text-sm", busy ? "cursor-not-allowed opacity-60" : "hover:bg-zinc-50")}
            disabled={busy}
            onClick={() => run(() => sendJson("POST", "/api/integration/v1/shift-templates/upsert", payloadShiftTemplatesFailSignature()))}
            title="Kasıtlı hatalı signature gönderir (FAILED üretir). ON_DONE/ON_SUCCESS farkını kanıtlamak için."
          >
            Fail Template (Signature)
          </button>
          <button className={cx("rounded-lg border px-3 py-2 text-sm", busy ? "cursor-not-allowed opacity-60" : "hover:bg-zinc-50")} disabled={busy} onClick={() => run(() => sendJson("POST", "/api/integration/v1/shift-assignments/upsert", payloadShiftAssignments()))}>
            Shift Assignments Upsert
          </button>
          <button className={cx("rounded-lg border px-3 py-2 text-sm", busy ? "cursor-not-allowed opacity-60" : "hover:bg-zinc-50")} disabled={busy} onClick={() => run(() => sendJson("POST", "/api/integration/v1/leaves/upsert", payloadLeaves()))}>
            Leaves Upsert
          </button>
          <button className={cx("rounded-lg border px-3 py-2 text-sm", busy ? "cursor-not-allowed opacity-60" : "hover:bg-zinc-50")} disabled={busy} onClick={() => run(() => sendJson("GET", "/api/integration/v1/health"))} title="Integration health (API key gerekir)">
            Health
          </button>
        </div>

        {toast ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{toast}</div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold text-zinc-700">Last Request</div>
              {lastHttp ? <div className="text-xs text-zinc-500">{lastHttp.method} {lastHttp.url}</div> : null}
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button
                className={cx("rounded-md border px-2 py-1 text-xs", lastRequest ? "hover:bg-white" : "opacity-50 cursor-not-allowed")}
                disabled={!lastRequest}
                onClick={async () => {
                  const ok = await copyText(lastRequest ? pretty(lastRequest) : "");
                  setToast(ok ? "Request kopyalandı ✅" : "Kopyalanamadı (clipboard izinleri) ❌");
                  setTimeout(() => setToast(null), 2000);
                }}
                title="Request JSON kopyala"
              >
                Copy
              </button>
            </div>
            <pre className="max-h-[420px] overflow-auto rounded bg-white p-3 text-xs text-zinc-800">{lastRequest ? pretty(lastRequest) : "—"}</pre>
          </div>

          <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold text-zinc-700">Last Response</div>
              {lastHttp ? <div className="text-xs text-zinc-500">HTTP {lastHttp.status || "—"}</div> : null}
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button
                className={cx("rounded-md border px-2 py-1 text-xs", lastResponse ? "hover:bg-white" : "opacity-50 cursor-not-allowed")}
                disabled={!lastResponse}
                onClick={async () => {
                  const ok = await copyText(lastResponse ? pretty(lastResponse) : "");
                  setToast(ok ? "Response kopyalandı ✅" : "Kopyalanamadı (clipboard izinleri) ❌");
                  setTimeout(() => setToast(null), 2000);
                }}
                title="Response JSON kopyala"
              >
                Copy
              </button>

              {lastResponse && reqDetailUrlFromResponse(lastResponse) ? (
                <Link href={reqDetailUrlFromResponse(lastResponse)!} className="rounded-md border px-2 py-1 text-xs hover:bg-white" title="Integration request detayına git">
                  Open request detail
                </Link>
              ) : null}
            </div>
            <pre className="max-h-[420px] overflow-auto rounded bg-white p-3 text-xs text-zinc-800">{lastResponse ? pretty(lastResponse) : "—"}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
