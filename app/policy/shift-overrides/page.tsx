import AppShell from "@/app/_components/AppShellNoSSR";
import ShiftOverridesClient from "./ui";
import { getCapabilities } from "@/app/_auth/capabilities";

export default async function ShiftOverridesPage() {
  const caps = await getCapabilities();
  const canWrite = Boolean(caps?.canWrite);
  return (
    <AppShell title="Shift Overrides" subtitle="B Model: Shift + Workforce policy override">
      <ShiftOverridesClient canWrite={canWrite} />
    </AppShell>
  );
}