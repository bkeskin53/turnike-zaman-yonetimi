import AppShell from "@/app/_components/AppShellNoSSR";
import OrgClient from "./ui";
import { OrgSubNav } from "./_components/OrgSubNav";
import { getSessionOrNull } from "@/src/auth/guard";
import { resolveCompanyManagementAccess } from "@/src/features/company-management/companyManagementAccess";

export default async function OrgPage() {
  const session = await getSessionOrNull();
  const access = resolveCompanyManagementAccess(session?.role ?? null);

  return (
    <AppShell title="Organizasyon" subtitle="Şube • Kapı • Cihaz tanımları">
      <div className="grid gap-4 min-w-0 overflow-x-hidden">
        <OrgSubNav />
        <OrgClient
          role={access.role}
          canManageOrg={access.canManageOrg}
          canOperateDevices={access.canOperateDevices}
        />
      </div>
    </AppShell>
  );
}