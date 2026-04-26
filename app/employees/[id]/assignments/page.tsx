import AppShell from "@/app/_components/AppShellNoSSR";
import EmployeeAssignmentsClient from "./ui";

export default async function EmployeeAssignmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell title="Personel Atamalar" subtitle="Zaman profili, vardiya ve ruleset çözümlemesi">
      <EmployeeAssignmentsClient id={id} />
    </AppShell>
  );
}