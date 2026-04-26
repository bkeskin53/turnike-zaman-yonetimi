import AppShell from "@/app/_components/AppShellNoSSR";
import OrgClient from "./ui";
import { OrgSubNav } from "./_components/OrgSubNav";
import { getSessionOrNull } from "@/src/auth/guard";

export default async function OrgPage() {
  const session = await getSessionOrNull();
  const role = (session as any)?.role as string | undefined;

  // Org (Branch/Door/Device) = config domain
  const canManageOrg = role === "SYSTEM_ADMIN" || role === "HR_CONFIG_ADMIN";
  // Device operasyon (ping/sync) = operator da yapabilir
  const canOperateDevices = canManageOrg || role === "HR_OPERATOR";
  return (
    <AppShell title="Organizasyon" subtitle="Şube • Kapı • Cihaz tanımları">
      <div className="grid gap-4 min-w-0 overflow-x-hidden">
        <OrgSubNav />
        <OrgClient
          role={role ?? "UNKNOWN"}
          canManageOrg={canManageOrg}
          canOperateDevices={canOperateDevices}
        />
      </div>
    </AppShell>
  );
}