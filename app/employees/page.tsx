import AppShell from "@/app/_components/AppShellNoSSR";
import { getSessionOrNull } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import EmployeesListClient from "../admin/employees/list/ui";

export default async function EmployeesPage() {
  const s = await getSessionOrNull();
  const role = s?.role ?? null;
  const canOpsWrite = role ? ROLE_SETS.OPS_WRITE.includes(role) : false;

  return (
    <AppShell title="Çalışanlar" subtitle="Aktif çalışanları yönetin, pasif kayıt havuzuna aynı ekrandan erişin">
      <EmployeesListClient canWrite={canOpsWrite} />
    </AppShell>
  );
}
