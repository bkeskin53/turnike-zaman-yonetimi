import AppShell from "@/app/_components/AppShellNoSSR";
import WeeklyPlanClient from "./ui";

// Page component for weekly shift planning. Receives employee id from dynamic route params.
export default async function WeeklyPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell
      title="Haftalık Vardiya Planı"
      subtitle="Vardiya planını düzenle"
    >
      <WeeklyPlanClient id={id} />
    </AppShell>
  );
}