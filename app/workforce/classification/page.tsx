import AppShell from "@/app/_components/AppShellNoSSR";
import WorkforceClassificationClient from "./ui";
import { getSessionOrNull } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";

export default async function WorkforceClassificationPage() {
  const s = await getSessionOrNull();
  const role = s?.role ?? null;

  // CONFIG screen: only CONFIG_WRITE may mutate (SYSTEM_ADMIN + HR_CONFIG_ADMIN)
  const canWrite = role ? ROLE_SETS.CONFIG_WRITE.includes(role) : false;
  return (
    <AppShell title="Personel Sınıflandırma" subtitle="Employee → Group/Subgroup atama (SAP Employee Group/Subgroup)">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <WorkforceClassificationClient canWrite={canWrite} role={role ?? "UNKNOWN"} />
      </div>
    </AppShell>
  );
}