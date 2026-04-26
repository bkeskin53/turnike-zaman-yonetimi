import AppShell from "@/app/_components/AppShellNoSSR";
import WorkforceGroupsClient from "./ui";
import { getSessionOrNull } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";

export default async function WorkforceGroupsPage() {
  const s = await getSessionOrNull();
  const role = s?.role ?? null;

  // CONFIG screen: only CONFIG_WRITE may mutate (SYSTEM_ADMIN + HR_CONFIG_ADMIN)
  const canWrite = role ? ROLE_SETS.CONFIG_WRITE.includes(role) : false;
  return (
    <AppShell title="Segments (Employee Groups)" subtitle="WHITE / BLUE / INTERN gibi ana segmentler">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <WorkforceGroupsClient canWrite={canWrite} role={role ?? "UNKNOWN"} />
      </div>
    </AppShell>
  );
}