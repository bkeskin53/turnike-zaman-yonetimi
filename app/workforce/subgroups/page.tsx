import AppShell from "@/app/_components/AppShellNoSSR";
import WorkforceSubgroupsClient from "./ui";
import { getSessionOrNull } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";

export default async function WorkforceSubgroupsPage() {
  const s = await getSessionOrNull();
  const role = s?.role ?? null;

  // CONFIG screen: only CONFIG_WRITE may mutate (SYSTEM_ADMIN + HR_CONFIG_ADMIN)
  const canWrite = role ? ROLE_SETS.CONFIG_WRITE.includes(role) : false;
  return (
    <AppShell title="Alt Segments (Employee Subgroups)" subtitle="WHITE_MANAGER / BLUE_NIGHT gibi alt kırılımlar">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <WorkforceSubgroupsClient canWrite={canWrite} role={role ?? "UNKNOWN"} />
      </div>
    </AppShell>
  );
}