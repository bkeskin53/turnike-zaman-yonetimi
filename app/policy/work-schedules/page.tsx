import AppShell from "@/app/_components/AppShellNoSSR";
import WorkSchedulesClient from "./ui";

export default function WorkSchedulesPage() {
  return (
    <AppShell
      title="Çalışma Planları"
      subtitle="Rota & periyodik plan tanımları (vardiya penceresi ayrı, kural seti ayrı)"
    >
      <WorkSchedulesClient />
    </AppShell>
  );
}