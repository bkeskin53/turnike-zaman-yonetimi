import AppShell from "@/app/_components/AppShellNoSSR";
import CompanySettingsClient from "./ui";
import { getCapabilities } from "@/app/_auth/capabilities";

export default async function CompanyPage() {
  const caps = await getCapabilities();
  const canWrite = Boolean(caps?.canWrite);
  return (
    <AppShell title="Şirket & Politika" subtitle="Firma ve policy ayarları">
      <CompanySettingsClient canWrite={canWrite} />
    </AppShell>
  );
}
