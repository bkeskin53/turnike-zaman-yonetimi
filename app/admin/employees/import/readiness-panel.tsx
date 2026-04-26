"use client";

import type { EmployeeImportReadinessSummaryDto } from "@/src/services/employees/employeeImportReadiness.service";

type ImportReadinessPanelProps = {
  title: string;
  summary: EmployeeImportReadinessSummaryDto;
};

function cx(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}

function statusTone(status: EmployeeImportReadinessSummaryDto["status"]) {
  if (status === "READY") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "REVIEW") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function surfaceTone(status: EmployeeImportReadinessSummaryDto["status"]) {
  if (status === "READY") return "border-emerald-200/90 bg-emerald-50/70";
  if (status === "REVIEW") return "border-amber-200/90 bg-amber-50/70";
  return "border-rose-200/90 bg-rose-50/70";
}

function accentTone(status: EmployeeImportReadinessSummaryDto["status"]) {
  if (status === "READY") return "bg-emerald-400";
  if (status === "REVIEW") return "bg-amber-400";
  return "bg-rose-400";
}

function statusLabel(status: EmployeeImportReadinessSummaryDto["status"]) {
  if (status === "READY") return "Hazır";
  if (status === "REVIEW") return "Gözden geçir";
  return "Bloklayan";
}

function checkTone(status: "OK" | "REVIEW" | "BLOCKED") {
  if (status === "OK") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "REVIEW") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function checkLabel(status: "OK" | "REVIEW" | "BLOCKED") {
  if (status === "OK") return "Temiz";
  if (status === "REVIEW") return "İncele";
  return "Düzelt";
}

export function ImportReadinessPanel(props: ImportReadinessPanelProps) {
  return (
    <div className={cx("rounded-[2rem] border p-5 shadow-sm", surfaceTone(props.summary.status))}>
      <div className={cx("h-1.5 w-14 rounded-full", accentTone(props.summary.status))} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="pt-4">
          <div className="text-lg font-semibold text-slate-900">{props.title}</div>
          <p className="mt-1 text-sm leading-6 text-slate-600">{props.summary.headline}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">{props.summary.supportText}</p>
        </div>
        <div className={cx("rounded-full border bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-wide shadow-sm", statusTone(props.summary.status))}>
          {statusLabel(props.summary.status)}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {[
          ["Uygulanabilir satır", props.summary.actionableRowCount],
          ["Düzeltilecek satır", props.summary.invalidRowCount],
          ["Bloklayan sorun", props.summary.blockingIssueCount],
          ["Uyarı", props.summary.warningIssueCount],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-white/90 bg-white px-4 py-3 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{String(value)}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {props.summary.checks.map((check) => (
          <div key={check.key} className="rounded-2xl border border-white/90 bg-white/95 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">{check.title}</div>
              <span className={cx("rounded-full border bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide shadow-sm", checkTone(check.status))}>
                {checkLabel(check.status)}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{check.summary}</p>
          </div>
        ))}
      </div>

      {props.summary.topConcerns.length ? (
        <div className="mt-4 rounded-2xl border border-white/90 bg-white/80 p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">En çok tekrar eden konular</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {props.summary.topConcerns.map((item) => (
              <span
                key={`${item.title}-${item.severity}`}
                className={cx(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  item.severity === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700",
                )}
              >
                {item.title} · {item.issueCount}
                {item.previewLimited ? " (önizleme)" : ""}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
