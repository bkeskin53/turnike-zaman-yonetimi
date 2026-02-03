"use client";

function Pill({ tone, children }: { tone: "ok" | "warn" | "danger"; children: React.ReactNode }) {
  const cls =
    tone === "danger"
      ? "bg-red-50 text-red-700 border-red-200"
      : tone === "warn"
        ? "bg-amber-50 text-amber-900 border-amber-200"
        : "bg-emerald-50 text-emerald-800 border-emerald-200";
  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${cls}`}>{children}</span>;
}

export default function RequestDetailClient({ item }: { item: any }) {
  const tone = item.status === "FAILED" ? "danger" : item.status === "PARTIAL" ? "warn" : "ok";

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="font-mono text-sm">{item.requestId}</div>
          <div className="flex items-center gap-2">
            <button
              className="h-8 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium hover:bg-zinc-50"
              onClick={() => {
                // Export as CSV via dashboard export route using recentProblems format filter
                // (kept minimal; we can add a dedicated request export endpoint if needed)
                const q = new URLSearchParams();
                q.set("kind", "recentProblems");
                q.set("hours", "168");
                q.set("limit", "200");
                window.open(`/integration/export.csv?${q.toString()}`, "_blank");
              }}
              title="Export (recent problems window) CSV"
            >
              Export CSV
            </button>
            <Pill tone={tone}>{item.status}</Pill>
          </div>
        </div>

        <div className="mt-3 grid gap-2 text-sm">
          <div><b>Endpoint:</b> <span className="font-mono">{item.endpoint}</span></div>
          <div><b>Source:</b> {item.sourceSystem}</div>
          <div><b>Batch:</b> {item.batchRef ?? "—"}</div>
          <div><b>Received:</b> {item.receivedAt}</div>
          <div><b>Processed:</b> {item.processedAt ?? "—"}</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Total" value={item.totalCount} />
        <Stat label="Created" value={item.createdCount} />
        <Stat label="Updated" value={item.updatedCount} />
        <Stat label="Failed" value={item.failedCount} danger />
      </div>

      {item.errors?.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="mb-2 font-semibold text-red-800">Errors</div>
          <pre className="max-h-[360px] overflow-auto rounded bg-white p-3 text-xs">
            {JSON.stringify(item.errors, null, 2)}
          </pre>
        </div>
      )}

      {item.payloadMeta && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="mb-2 font-semibold">Payload Meta</div>
          <pre className="max-h-[360px] overflow-auto rounded bg-zinc-50 p-3 text-xs">
            {JSON.stringify(item.payloadMeta, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="text-xs text-zinc-600">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${danger && value > 0 ? "text-red-700" : ""}`}>
        {value}
      </div>
    </div>
  );
}
