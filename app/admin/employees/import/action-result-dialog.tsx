"use client";

import { createPortal } from "react-dom";
import type { EmployeeImportGuidedRemediationActionKey } from "@/src/services/employees/employeeImportGuidedRemediation.service";

type ActionResultDialogTone = "success" | "warning" | "error";

export type ActionResultDialogState = {
  sourceLabel: string;
  tone: ActionResultDialogTone;
  statusLabel: string;
  title: string;
  description: string;
  detail?: string | null;
  metrics: Array<{
    label: string;
    value: string | number;
  }>;
  primaryAction?: {
    key: EmployeeImportGuidedRemediationActionKey;
    label: string;
  };
};

type ActionResultDialogProps = {
  item: ActionResultDialogState;
  onClose: () => void;
  onPrimaryAction: (actionKey: EmployeeImportGuidedRemediationActionKey) => void;
};

function cx(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}

function toneClasses(tone: ActionResultDialogTone) {
  if (tone === "success") {
    return {
      shell: "border-emerald-200 bg-white",
      bar: "from-emerald-400 via-emerald-300 to-teal-300",
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
      title: "text-emerald-950",
      primaryButton: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:border-emerald-700",
    };
  }

  if (tone === "warning") {
    return {
      shell: "border-amber-200 bg-white",
      bar: "from-amber-400 via-orange-300 to-amber-200",
      badge: "border-amber-200 bg-amber-50 text-amber-700",
      title: "text-amber-950",
      primaryButton: "border-amber-500 bg-amber-500 text-white hover:bg-amber-600 hover:border-amber-600",
    };
  }

  return {
    shell: "border-rose-200 bg-white",
    bar: "from-rose-500 via-rose-400 to-orange-300",
    badge: "border-rose-200 bg-rose-50 text-rose-700",
    title: "text-rose-950",
    primaryButton: "border-rose-600 bg-rose-600 text-white hover:bg-rose-700 hover:border-rose-700",
  };
}

export function ActionResultDialog({ item, onClose, onPrimaryAction }: ActionResultDialogProps) {
  const tone = toneClasses(item.tone);

  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Sonuç penceresini kapat"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-action-result-title"
        className={cx(
          "relative w-full max-w-lg overflow-hidden rounded-[2rem] border shadow-2xl",
          tone.shell,
        )}
      >
        <div className={cx("h-1.5 w-full bg-gradient-to-r", tone.bar)} />

        <div className="space-y-5 p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                {item.sourceLabel}
              </div>
              <h2 id="import-action-result-title" className={cx("mt-2 text-2xl font-semibold", tone.title)}>
                {item.title}
              </h2>
            </div>
            <span className={cx("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", tone.badge)}>
              {item.statusLabel}
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-sm leading-7 text-slate-700">{item.description}</p>
            {item.detail ? <p className="text-sm text-slate-500">{item.detail}</p> : null}
          </div>

          {item.metrics.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {item.metrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{metric.label}</div>
                  <div className="mt-2 text-xl font-semibold text-slate-900">{metric.value}</div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Kapat
            </button>
            {item.primaryAction ? (
              <button
                type="button"
                onClick={() => onPrimaryAction(item.primaryAction!.key)}
                className={cx(
                  "inline-flex items-center justify-center rounded-2xl border px-4 py-2.5 text-sm font-medium transition",
                  tone.primaryButton,
                )}
              >
                {item.primaryAction.label}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
