import AppShell from "@/app/_components/AppShellNoSSR";
import ShiftOverridesClient from "./ui";

export default function ShiftOverridesPage() {
  return (
    <AppShell title="Shift Overrides" subtitle="B Model: Shift + Workforce policy override">
      <ShiftOverridesClient />
    </AppShell>
  );
}