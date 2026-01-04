import AppShell from "@/app/_components/AppShell";
import MonthlyReportClient from "./ui";

export default function MonthlyReportPage() {
  return (
    <AppShell title="Monthly" subtitle="Aylık sonuçlar">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <MonthlyReportClient />
      </div>
    </AppShell>
  );
}
