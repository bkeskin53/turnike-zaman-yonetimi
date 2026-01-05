import AppShell from "@/app/_components/AppShell";
import OrgClient from "./ui";

export default function OrgPage() {
  return (
    <AppShell title="Organizasyon" subtitle="Şube • Kapı • Cihaz tanımları">
      <div className="grid gap-4">
        <OrgClient />
      </div>
    </AppShell>
  );
}