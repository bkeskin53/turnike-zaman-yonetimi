import AppShell from "@/app/_components/AppShell";
import CompanySettingsClient from "./ui";

export default function CompanyPage() {
  return (
    <AppShell title="Company & Policy" subtitle="Firma ve policy ayarları">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <CompanySettingsClient />
      </div>
    </AppShell>
  );
}
