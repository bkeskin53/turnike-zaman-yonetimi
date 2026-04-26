import AppShell from "@/app/_components/AppShellNoSSR";
import ShiftImportClient from "./import-ui";
import { getSessionOrNull } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";

export default async function ShiftAssignmentsPage() {
  const s = await getSessionOrNull();
  const canWrite = Boolean(s && ROLE_SETS.OPS_WRITE.includes(s.role));
  return (
    <AppShell
      title="Vardiya İçe Aktar"
      subtitle="Excel / CSV planını içeri al, önce dry-run ile doğrula, sonra planner override olarak uygula."
    >
      <ShiftImportClient canWrite={canWrite} />
    </AppShell>
  );
}