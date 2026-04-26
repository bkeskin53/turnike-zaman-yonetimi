import AppShell from "@/app/_components/AppShellNoSSR";
import { getCapabilities } from "@/app/_auth/capabilities";
import PolicyRuleSetsClient from "./ui";

export default async function PolicyRuleSetsPage() {
  const caps = await getCapabilities();
  const canWrite = Boolean(caps?.canWrite);

  return (
    <AppShell title="Policy" subtitle="Kural setleri ve vardiya istisna kuralları">
      <PolicyRuleSetsClient canWrite={canWrite} />
    </AppShell>
  );
}