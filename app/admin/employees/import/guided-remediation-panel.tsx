"use client";

import type {
  EmployeeImportGuidedRemediationActionKey,
  EmployeeImportGuidedRemediationPlanDto,
} from "@/src/services/employees/employeeImportGuidedRemediation.service";

type GuidedRemediationPanelProps = {
  plan: EmployeeImportGuidedRemediationPlanDto;
  actionLabels: Partial<Record<EmployeeImportGuidedRemediationActionKey, string>>;
  disabledActions?: Partial<Record<EmployeeImportGuidedRemediationActionKey, boolean>>;
  onAction: (actionKey: EmployeeImportGuidedRemediationActionKey) => void;
};

function cx(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}

export function GuidedRemediationPanel(props: GuidedRemediationPanelProps) {
  return (
    <div className="rounded-3xl border border-slate-900 bg-slate-900 p-5 text-white shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-lg font-semibold">{props.plan.headline}</div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">{props.plan.supportText}</p>
        </div>
        <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100">
          Rehberli akış
        </div>
      </div>

      {props.plan.topConcernTitles.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {props.plan.topConcernTitles.map((title) => (
            <span key={title} className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-slate-100">
              {title}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {props.plan.actions.map((action, index) => {
          const disabled = props.disabledActions?.[action.key] === true;
          return (
            <div key={action.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">Adım {index + 1}</div>
                  <div className="mt-2 text-sm font-semibold text-white">{action.title}</div>
                </div>
                <span
                  className={cx(
                    "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide",
                    action.emphasis === "primary"
                      ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-100"
                      : "border-white/15 bg-white/10 text-slate-100",
                  )}
                >
                  {action.emphasis === "primary" ? "Öncelikli" : "Destekleyici"}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-200">{action.description}</p>
              <button
                type="button"
                onClick={() => props.onAction(action.key)}
                disabled={disabled}
                className={cx(
                  "mt-4 inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition",
                  action.emphasis === "primary"
                    ? "bg-white text-slate-900 hover:bg-slate-100"
                    : "border border-white/20 bg-transparent text-white hover:bg-white/10",
                  disabled && "cursor-not-allowed opacity-50",
                )}
              >
                {props.actionLabels[action.key] || "Aç"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
