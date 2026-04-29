"use client";

import { useRouter } from "next/navigation";
import type { CompanyManagementAccess } from "./companyManagementAccess";
import type {
  CompanyManagementModuleDefinition,
  CompanyManagementModuleKey,
} from "./companyManagementRegistry";
import { buildCompanyManagementCreateHref, buildCompanyManagementHref } from "./companyManagementUrls";
import CompanyManagementWorkspace from "./CompanyManagementWorkspace";
import {
  CompanyManagementHeaderSlotOutlet,
  CompanyManagementHeaderSlotProvider,
} from "./companyManagementHeaderSlot";

export default function CompanyManagementShell(props: {
  activeModule: CompanyManagementModuleDefinition | null;
  createModuleKey?: CompanyManagementModuleKey | null;
  modules: readonly CompanyManagementModuleDefinition[];
  access: CompanyManagementAccess;
}) {
  const router = useRouter();
  const activeModule = props.activeModule;
  const compactSelectClass =
    "h-10 w-full rounded-xl border border-slate-200 bg-slate-50/90 px-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition hover:border-slate-300 hover:bg-white focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none";

  function RegisteredRecordFallback() {
    return (
      <label className="grid min-w-0 gap-1.5 sm:w-[260px] md:w-[320px]">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Kayıtlı Kayıt
        </span>
        <select disabled className={compactSelectClass}>
          <option>Önce başlık seçin</option>
        </select>
      </label>
    );
  }

  return (
    <CompanyManagementHeaderSlotProvider>
    <div className="grid gap-1">
      <section className="rounded-[20px] border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Ara
              </span>
              <select
                value={activeModule?.key ?? ""}
                onChange={(event) => {
                  const nextValue = String(event.target.value ?? "");
                  router.push(buildCompanyManagementHref(nextValue || null));
                }}
                disabled={props.modules.length <= 1}
                className={`${compactSelectClass} sm:w-[220px] md:w-[260px]`}
              >
                <option value="">Seç...</option>
                {props.modules.map((module) => (
                  <option key={module.key} value={module.key}>
                    {module.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="min-w-0">
              {activeModule ? (
                <CompanyManagementHeaderSlotOutlet />
              ) : (
                <RegisteredRecordFallback />
              )}
            </div>
          </div>

          <label className="grid min-w-0 gap-1.5 sm:w-[190px] md:w-[220px]">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Yeni Oluştur
            </span>
            <select
              value={props.createModuleKey ?? ""}
              onChange={(event) => {
                const nextValue = String(event.target.value ?? "");
                if (!nextValue) {
                  router.push(
                    activeModule ? buildCompanyManagementHref(activeModule.key) : buildCompanyManagementHref(null),
                  );
                  return;
                }
                router.push(buildCompanyManagementCreateHref(nextValue));
              }}
              disabled={props.modules.length === 0}
              className={compactSelectClass}
            >
              <option value="">Seç...</option>
              {props.modules.map((module) => (
                <option key={module.key} value={module.key}>
                  {module.createLabel}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {activeModule ? (
        <section className="rounded-[20px] border border-slate-200 bg-slate-50/40 px-2.5 py-2 shadow-sm md:px-3 md:py-2.5">
          <CompanyManagementWorkspace
            moduleKey={activeModule.key}
            createModuleKey={props.createModuleKey}
            access={props.access}
          />
        </section>
      ) : null}
    </div>
    </CompanyManagementHeaderSlotProvider>
  );
}