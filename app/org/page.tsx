import AppShell from "@/app/_components/AppShellNoSSR";
import OrgClient from "./ui";
import { OrgSubNav } from "./_components/OrgSubNav";

export default function OrgPage() {
  return (
    <AppShell title="Organizasyon" subtitle="Şube • Kapı • Cihaz tanımları">
      <div className="grid gap-4 min-w-0 overflow-x-hidden">
        <OrgSubNav />
        <OrgClient />
      </div>
    </AppShell>
  );
}