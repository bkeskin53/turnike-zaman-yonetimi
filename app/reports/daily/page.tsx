import AppShell from "@/app/_components/AppShellNoSSR";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import DailyReportClient from "./ui";
import { getCapabilities } from "@/app/_auth/capabilities";
import { getSessionOrNull } from "@/src/auth/guard";

export default async function DailyReportPage() {
  const caps = await getCapabilities();
  const s = await getSessionOrNull();
  const role = (s?.role ?? "ANON") as string;

  return (
    <AppShell title="Daily" subtitle="Günlük sonuçlar (önce recompute)">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/reports/daily"
            className="inline-flex h-9 items-center rounded-lg bg-zinc-900 px-3 text-sm font-semibold text-white shadow-sm"
          >
            Günlük Sonuçlar
          </Link>
          <Link
            href="/reports/daily/review"
            className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            Review Operasyonu
          </Link>
        </div>

        <Link
          href="/reports/monthly"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-100"
        >
          <BarChart3 className="h-4 w-4" />
          Monthly
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <DailyReportClient canRecompute={caps.canRecompute} role={role} />
      </div>
    </AppShell>
  );
}
