import AppShell from "@/app/_components/AppShellNoSSR";
import CompanySettingsClient from "./ui";

export default function CompanyPage() {
  return (
    <AppShell title="Şirket & Politika" subtitle="Firma ve policy ayarları">
      <CompanySettingsClient />
    </AppShell>
  );
}
