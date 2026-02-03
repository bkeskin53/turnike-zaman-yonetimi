import AppShell from "@/app/_components/AppShellNoSSR";
import ShiftAssignmentsClient from "./ui";

export default function ShiftAssignmentsPage() {
  return (
    <AppShell
      title="Toplu Vardiya"
      subtitle="Stage 4 — Weekly (WEEK_TEMPLATE) atama. Gün override / custom / manual etkilenmez."
    >
      <ShiftAssignmentsClient />
    </AppShell>
  );
}