"use client";

import type {
  DataManagementModuleDefinition,
  DataManagementModuleKey,
} from "./dataManagementRegistry";

export type DataManagementWorkspaceRecordOption = {
  value: string;
  label: string;
};

export default function DataManagementModuleSelect(props: {
  value: DataManagementModuleKey | null;
  modules: readonly DataManagementModuleDefinition[];
  onValueChange: (nextValue: DataManagementModuleKey | null) => void;
  recordSelectLabel?: string | null;
  recordSelectValue?: string;
  recordSelectPlaceholder?: string | null;
  recordSelectDisabled?: boolean;
  recordOptions?: readonly DataManagementWorkspaceRecordOption[];
  onRecordValueChange?: (nextValue: string) => void;
}) {
  const compactSelectClass =
    "h-10 w-full sm:w-[170px] md:w-[190px] rounded-xl border border-slate-200 bg-slate-50/90 px-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition hover:border-slate-300 hover:bg-white focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/15";

  const compactDisabledSelectClass =
    `${compactSelectClass} disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none`;
  
    return (
    <div className="grid gap-2.5 md:grid-cols-2 md:items-end">
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Veri Başlığı
        </span>

      <select
          value={props.value ?? ""}
          onChange={(event) => {
            props.onValueChange((event.target.value || null) as DataManagementModuleKey | null);
          }}
          className={compactDisabledSelectClass}
        >
          <option value="">Seç...</option>
          {props.modules.map((module) => (
            <option key={module.key} value={module.key}>
              {module.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          {props.recordSelectLabel ?? "Kayıtlı Kayıt"}
        </span>

        <select
          value={props.recordSelectValue ?? ""}
          onChange={(event) => props.onRecordValueChange?.(String(event.target.value ?? ""))}
          disabled={props.recordSelectDisabled}
          className={compactSelectClass}
        >
          <option value="">{props.recordSelectPlaceholder ?? "Seçim yok"}</option>
          {(props.recordOptions ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}