import AppShell from "@/app/_components/AppShellNoSSR";
import { getSessionOrNull, requireRole } from "@/src/auth/guard";
import { getIntegrationDashboardData } from "@/src/services/integrationDashboard.service";
import IntegrationDashboardClient from "./ui";

export default async function IntegrationPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await getSessionOrNull();
  const role = String((s as any)?.role ?? "UNKNOWN");

  try {
    await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);
  } catch (e) {
    return (
      <AppShell title="Integration" subtitle="SAP/Logo entegrasyon sağlığı (read-only)">
        <div className="min-w-0 max-w-full overflow-x-hidden p-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-extrabold text-amber-900 tracking-tight">Yetki yok</div>
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] font-bold uppercase tracking-tight ring-1 ring-inset ring-amber-200">
                ROL: {role}
              </span>
            </div>

            <div className="mt-2 text-sm font-semibold text-amber-900/90">
              Bu sayfaya erişim yetkiniz bulunmuyor.
            </div>

            <div className="mt-1 text-[11px] text-amber-900/70">
              Gerekli rol: <b>SYSTEM_ADMIN</b> veya <b>HR_OPERATOR</b>
            </div>

            <div className="mt-3 rounded-xl border border-amber-200/70 bg-white px-3 py-2 text-[11px] text-amber-900/80">
              Not: Bu dashboard tarayıcıdan <span className="font-mono">/api</span> çağırmaz; veriyi server-side DB’den okur.
              Entegrasyon endpoint’leri rol ile değil <b>API Key</b> ile korunur.
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const sp = (await props.searchParams) ?? {};
  const hours = Array.isArray(sp.hours) ? sp.hours[0] : sp.hours;
  const limit = Array.isArray(sp.limit) ? sp.limit[0] : sp.limit;

  const data = await getIntegrationDashboardData({ hours, limit });

  return (
    <AppShell title="Integration" subtitle="SAP/Logo entegrasyon sağlığı (read-only)">
      <IntegrationDashboardClient
        initialHours={data.window.hours}
        initialLimit={Number(limit ?? 20)}
        data={data}
        role={role}
      />
    </AppShell>
  );
}
