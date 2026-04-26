import AppShell from "@/app/_components/AppShellNoSSR";
import WorkSchedulesClient from "./ui";
import { getSessionOrNull } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";

export default async function WorkSchedulesPage() {
  const s = await getSessionOrNull();
  const canWrite = Boolean(s && ROLE_SETS.CONFIG_WRITE.includes(s.role));
  return (
    <AppShell
      title="Çalışma Planları"
      subtitle="Rota & periyodik plan tanımları (vardiya penceresi ayrı, kural seti ayrı)"
    >
      <WorkSchedulesClient canWrite={canWrite} />
    </AppShell>
  );
}