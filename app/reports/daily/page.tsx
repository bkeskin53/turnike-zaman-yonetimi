import AppShell from "@/app/_components/AppShellNoSSR";
import DailyReportClient from "./ui";

export default function DailyReportPage() {
  return (
    <AppShell title="Daily" subtitle="Günlük sonuçlar (önce recompute)">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <DailyReportClient />
      </div>
    </AppShell>
  );
}
