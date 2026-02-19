import AppShell from "@/app/_components/AppShellNoSSR";
import { requireRole } from "@/src/auth/guard";
import { getIntegrationDashboardData } from "@/src/services/integrationDashboard.service";
import IntegrationDashboardClient from "./ui";

export default async function IntegrationPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);

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
      />
    </AppShell>
  );
}
