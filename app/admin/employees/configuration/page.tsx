import AppShell from "@/app/_components/AppShellNoSSR";
import EmployeeConfigurationLegacyRedirect from "./legacy-redirect";

export default async function EmployeeConfigurationCenterPage() {
  return (
    <AppShell title="Konfigurasyon Merkezi" subtitle="Merkezi ekran ayarlari">
      <EmployeeConfigurationLegacyRedirect />
    </AppShell>
  );
}
