"use client";

import { useMemo, useState } from "react";

type Scenario =
  | "NORMAL"
  | "LATE"
  | "EARLY"
  | "OVERTIME"
  | "MISSING_PUNCH_IN"
  | "MISSING_PUNCH_OUT"
  | "DOUBLE_IN"
  | "DOUBLE_OUT"
  | "OFF_DAY_EVENTS"
  | "NIGHT_SHIFT";

type EmployeeScope = "ACTIVE" | "ALL" | "EMPLOYEE_CODES";

type ToastKind = "success" | "info" | "warn" | "error";
type ToastState = { kind: ToastKind; message: string } | null;

export default function TestConsoleClient() {
  const [fromDay, setFromDay] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [toDay, setToDay] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [scenario, setScenario] = useState<Scenario>("NORMAL");
  const [employeeScope, setEmployeeScope] = useState<EmployeeScope>("ACTIVE");
  const [employeeCodesText, setEmployeeCodesText] = useState<string>("");
  const [jitterMinutes, setJitterMinutes] = useState<number>(0);
  const [maxEvents, setMaxEvents] = useState<number>(250000);
  const [recompute, setRecompute] = useState<boolean>(true);
  const [commit, setCommit] = useState<boolean>(true);

  const [loading, setLoading] = useState<boolean>(false);
  const [lastBatchId, setLastBatchId] = useState<string>("");
  const [toast, setToast] = useState<ToastState>(null);

  const employeeCodes = useMemo(() => {
    return employeeCodesText
      .split(/[\n,;\t ]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [employeeCodesText]);

  async function seed() {
    setLoading(true);
    setToast(null);

    try {
      const res = await fetch("/api/test/seed-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fromDay,
          toDay,
          scenario,
          employeeScope,
          employeeCodes: employeeScope === "EMPLOYEE_CODES" ? employeeCodes : undefined,
          jitterMinutes,
          maxEvents,
          recompute,
          commit,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const msg = json?.error ? `${json.error}${json?.message ? `: ${json.message}` : ""}` : `HTTP ${res.status}`;
        setToast({ kind: "error", message: msg });
        return;
      }

      if (json.batchId) setLastBatchId(String(json.batchId));
      const created = typeof json.insertedCount === "number" ? json.insertedCount : json.plannedEvents ?? json.requestedEvents ?? 0;

      setToast({
        kind: "success",
        message: `Seed OK. batchId=${json.batchId} | employees=${json.employeeCount} | events=${created} | range=${json.minDayKey}..${json.maxDayKey}`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown_error";
      setToast({ kind: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }

  async function cleanup() {
    if (!lastBatchId) {
      setToast({ kind: "warn", message: "Önce seed çalıştırıp batchId oluşmalı (veya batchId gir)." });
      return;
    }

    setLoading(true);
    setToast(null);

    try {
      const res = await fetch(`/api/test/cleanup-events?batchId=${encodeURIComponent(lastBatchId)}`, {
        method: "DELETE",
        credentials: "include",
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const msg = json?.error ? `${json.error}${json?.message ? `: ${json.message}` : ""}` : `HTTP ${res.status}`;
        setToast({ kind: "error", message: msg });
        return;
      }

      setToast({ kind: "success", message: `Cleanup OK. deleted=${json.deletedCount} | batchId=${json.batchId ?? lastBatchId}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown_error";
      setToast({ kind: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      {toast ? (
        <div
          className={[
            "rounded-2xl border p-3 text-sm",
            toast.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "",
            toast.kind === "warn" ? "border-amber-200 bg-amber-50 text-amber-900" : "",
            toast.kind === "info" ? "border-sky-200 bg-sky-50 text-sky-900" : "",
            toast.kind === "error" ? "border-rose-200 bg-rose-50 text-rose-900" : "",
          ].join(" ")}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold text-zinc-900">Seed Events</div>
        <div className="mt-1 text-sm text-zinc-600">
          Bu ekran sadece iç test içindir. <span className="font-medium">TEST_MODE=1</span> ve production dışında çalışır.
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs text-zinc-600">Başlangıç (fromDay)</span>
            <input className="h-10 rounded-xl border border-zinc-200 px-3 text-sm" value={fromDay} onChange={(e) => setFromDay(e.target.value)} />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-zinc-600">Bitiş (toDay)</span>
            <input className="h-10 rounded-xl border border-zinc-200 px-3 text-sm" value={toDay} onChange={(e) => setToDay(e.target.value)} />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-zinc-600">Senaryo</span>
            <select className="h-10 rounded-xl border border-zinc-200 px-3 text-sm" value={scenario} onChange={(e) => setScenario(e.target.value as Scenario)}>
              <option value="NORMAL">NORMAL</option>
              <option value="LATE">LATE</option>
              <option value="EARLY">EARLY</option>
              <option value="OVERTIME">OVERTIME</option>
              <option value="MISSING_PUNCH_IN">MISSING_PUNCH_IN</option>
              <option value="MISSING_PUNCH_OUT">MISSING_PUNCH_OUT</option>
              <option value="DOUBLE_IN">DOUBLE_IN</option>
              <option value="DOUBLE_OUT">DOUBLE_OUT</option>
              <option value="OFF_DAY_EVENTS">OFF_DAY_EVENTS</option>
              <option value="NIGHT_SHIFT">NIGHT_SHIFT</option>
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-zinc-600">Personel kapsamı</span>
            <select
              className="h-10 rounded-xl border border-zinc-200 px-3 text-sm"
              value={employeeScope}
              onChange={(e) => setEmployeeScope(e.target.value as EmployeeScope)}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="ALL">ALL</option>
              <option value="EMPLOYEE_CODES">EMPLOYEE_CODES</option>
            </select>
          </label>

          <label className="grid gap-1 md:col-span-2">
            <span className="text-xs text-zinc-600">Employee Codes (EMPLOYEE_CODES seçiliyse)</span>
            <textarea
              className="min-h-[84px] rounded-xl border border-zinc-200 p-3 text-sm"
              placeholder="E001 E002 E003 veya satır satır"
              value={employeeCodesText}
              onChange={(e) => setEmployeeCodesText(e.target.value)}
              disabled={employeeScope !== "EMPLOYEE_CODES"}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-zinc-600">Jitter (dk)</span>
            <input
              className="h-10 rounded-xl border border-zinc-200 px-3 text-sm"
              type="number"
              value={jitterMinutes}
              onChange={(e) => setJitterMinutes(Number(e.target.value))}
              min={0}
              max={120}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-zinc-600">Max events</span>
            <input
              className="h-10 rounded-xl border border-zinc-200 px-3 text-sm"
              type="number"
              value={maxEvents}
              onChange={(e) => setMaxEvents(Number(e.target.value))}
              min={1000}
              max={2000000}
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={recompute} onChange={(e) => setRecompute(e.target.checked)} />
            Recompute tetikle
          </label>

          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={commit} onChange={(e) => setCommit(e.target.checked)} />
            DB’ye yaz (commit)
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
            onClick={seed}
            disabled={loading}
            type="button"
          >
            Seed
          </button>

          <div className="flex items-center gap-2">
            <button
              className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 disabled:opacity-50"
              onClick={cleanup}
              disabled={loading}
              type="button"
            >
              Cleanup (batch)
            </button>

            <input
              className="h-10 w-[280px] rounded-xl border border-zinc-200 px-3 text-sm"
              placeholder="lastBatchId"
              value={lastBatchId}
              onChange={(e) => setLastBatchId(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
