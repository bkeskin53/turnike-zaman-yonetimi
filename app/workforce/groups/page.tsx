import AppShell from "@/app/_components/AppShellNoSSR";
import WorkforceGroupsClient from "./ui";

export default function WorkforceGroupsPage() {
  return (
    <AppShell title="Segments (Employee Groups)" subtitle="WHITE / BLUE / INTERN gibi ana segmentler">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <WorkforceGroupsClient />
      </div>
    </AppShell>
  );
}