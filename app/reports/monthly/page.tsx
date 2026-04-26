import AppShell from "@/app/_components/AppShellNoSSR";
import MonthlyReportClient from "./ui";
import { getCapabilities } from "@/app/_auth/capabilities";
import { getSessionOrNull } from "@/src/auth/guard";

export default async function MonthlyReportPage() {
  const caps = await getCapabilities();
  const s = await getSessionOrNull();
  const role = (s?.role ?? "ANON") as string;
  return (
    <AppShell title="Monthly" subtitle="Aylık sonuçlar">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <MonthlyReportClient canRecompute={caps.canRecompute} role={role} />
      </div>
    </AppShell>
  );
}
