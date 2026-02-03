import AppShell from "@/app/_components/AppShellNoSSR";
import OrgClient from "./ui";

export default function OrgPage() {
  return (
    <AppShell title="Organizasyon" subtitle="Şube • Kapı • Cihaz tanımları">
      <div className="grid gap-4 min-w-0 overflow-x-hidden">
        <OrgClient />
      </div>
    </AppShell>
  );
}