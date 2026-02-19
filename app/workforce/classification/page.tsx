import AppShell from "@/app/_components/AppShellNoSSR";
import WorkforceClassificationClient from "./ui";

export default function WorkforceClassificationPage() {
  return (
    <AppShell title="Personel Sınıflandırma" subtitle="Employee → Group/Subgroup atama (SAP Employee Group/Subgroup)">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <WorkforceClassificationClient />
      </div>
    </AppShell>
  );
}