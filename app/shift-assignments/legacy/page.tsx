import AppShell from "@/app/_components/AppShellNoSSR";
import ShiftAssignmentsClient from "../ui";
import { getSessionOrNull } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";

export default async function LegacyShiftAssignmentsPage() {
  const s = await getSessionOrNull();
  const canWrite = Boolean(s && ROLE_SETS.OPS_WRITE.includes(s.role));

  return (
    <AppShell
      title="Legacy • Toplu Vardiya Atama"
      subtitle="Geçici yardımcı ekran. Ana kurumsal planlama için Rota / Planner / Import akışını kullan."
    >
      <ShiftAssignmentsClient canWrite={canWrite} />
    </AppShell>
  );
}