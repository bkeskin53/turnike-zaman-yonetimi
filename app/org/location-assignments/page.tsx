import AppShell from "@/app/_components/AppShellNoSSR";
import { OrgSubNav } from "@/app/org/_components/OrgSubNav";
import LocationAssignmentsClient from "./ui";
import { getSessionOrNull } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";

export default async function LocationAssignmentsPage() {
  const session = await getSessionOrNull();
  const role = session?.role ?? null;
  const canWrite = role ? ROLE_SETS.CONFIG_WRITE.includes(role) : false;

  return (
    <AppShell
      title="Toplu Lokasyon Atama"
      subtitle="EmployeeOrgAssignment history-safe write path üzerinden etkili tarihli toplu lokasyon geçişi"
    >
      <div className="grid gap-4 min-w-0 overflow-x-hidden">
        <OrgSubNav />
        <LocationAssignmentsClient canWrite={canWrite} role={role ?? "UNKNOWN"} />
      </div>
    </AppShell>
  );
}