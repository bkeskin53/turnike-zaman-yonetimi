import AppShell from "@/app/_components/AppShellNoSSR";
import ShiftPlannerClient from "./ui";

export default async function ShiftPlannerPage() {
  return (
    <AppShell title="Shift Planner" subtitle="Haftalık vardiya planı (Week Template + Day Override)">
      <ShiftPlannerClient />
    </AppShell>
  );
}