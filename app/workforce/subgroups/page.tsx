import AppShell from "@/app/_components/AppShellNoSSR";
import WorkforceSubgroupsClient from "./ui";

export default function WorkforceSubgroupsPage() {
  return (
    <AppShell title="Alt Segments (Employee Subgroups)" subtitle="WHITE_MANAGER / BLUE_NIGHT gibi alt kırılımlar">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <WorkforceSubgroupsClient />
      </div>
    </AppShell>
  );
}