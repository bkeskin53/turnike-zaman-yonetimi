import Link from "next/link";
import AppShell from "@/app/_components/AppShellNoSSR";
import { getSessionOrNull, requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import {
  CONFIGURATION_CENTER_PAGES,
  getConfigurationCenterPageDefinition,
  parseConfigurationCenterPageKey,
} from "@/src/features/admin/configuration/configurationRegistry";
import { buildConfigurationCenterHref } from "@/src/features/admin/configuration/configurationUrls";
import EmployeesConfigurationSection from "./_sections/employees-configuration-section";
import HomeConfigurationSection from "./_sections/home-configuration-section";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default async function ConfigurationCenterPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionOrNull();
  const role = String(session?.role ?? "UNKNOWN");

  try {
    await requireRole(ROLE_SETS.CONFIG_WRITE);
  } catch {
    return (
      <AppShell
        title="Konfigurasyon Merkezi"
        subtitle="Merkezi ekran ayarlari"
      >
        <div className="min-w-0 max-w-full overflow-x-hidden p-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold tracking-tight text-amber-900">
                Yetki yok
              </div>
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ring-1 ring-inset ring-amber-200">
                ROL: {role}
              </span>
            </div>
            <div className="mt-1 text-sm text-amber-900/90">
              Bu ekran yalnizca yapilandirma yetkisine sahip admin kullanicilar icindir.
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const sp = (await props.searchParams) ?? {};
  const rawPage = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const activePageKey = parseConfigurationCenterPageKey(rawPage);
  const activePage = getConfigurationCenterPageDefinition(activePageKey);

  return (
    <AppShell
      title="Konfigurasyon Merkezi"
      subtitle="Ekran bazli ayarlari tek merkezden yonetin"
    >
      <div className="min-w-0 max-w-full overflow-x-hidden px-4 py-4 md:px-6">
        <div className="grid gap-4">
          <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="text-lg font-semibold tracking-tight text-slate-950">
              Konfigurasyon
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Her ekran kendi davranisini korur. Yonetim tek merkezde toplanir.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {CONFIGURATION_CENTER_PAGES.map((page) => {
                const isActive = page.key === activePage.key;
                return (
                  <Link
                    key={page.key}
                    href={buildConfigurationCenterHref(page.key)}
                    className={cx(
                      "inline-flex items-center rounded-xl px-3 py-2 text-sm font-semibold transition",
                      isActive
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                    )}
                  >
                    {page.label}
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="text-base font-semibold tracking-tight text-slate-950">
                  {activePage.label}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {activePage.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {activePage.sections.map((section) => (
                  <Link
                    key={section.id}
                    href={buildConfigurationCenterHref(activePage.key, section.id)}
                    className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 transition hover:bg-slate-100"
                  >
                    {section.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-4">
              {activePage.key === "employees" ? <EmployeesConfigurationSection /> : null}
              {activePage.key === "home" ? <HomeConfigurationSection /> : null}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}