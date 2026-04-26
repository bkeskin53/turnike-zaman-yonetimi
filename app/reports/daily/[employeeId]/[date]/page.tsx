import AppShell from "@/app/_components/AppShellNoSSR";
import Link from "next/link";
import DailyDetailClient from "./ui";
import { getCapabilities } from "@/app/_auth/capabilities";
import { getSessionOrNull } from "@/src/auth/guard";

export default async function DailyDetailPage({ params }: { params: Promise<{ employeeId: string; date: string }> }) {
  const resolved = await params;
  const caps = await getCapabilities();
  const s = await getSessionOrNull();
  const role = (s?.role ?? "ANON") as string;

  return (
    <AppShell title="Daily Detail" subtitle="Günlük teknik çözümleme">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link
          href={`/reports/daily?date=${encodeURIComponent(resolved.date)}`}
          className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          Günlük Sonuçlar
        </Link>
        <Link
          href={`/reports/daily/review?date=${encodeURIComponent(resolved.date)}`}
          className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          Review Operasyonu
        </Link>
        <span className="inline-flex h-9 items-center rounded-lg bg-zinc-900 px-3 text-sm font-semibold text-white shadow-sm">
          Teknik Detay
        </span>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <DailyDetailClient employeeId={resolved.employeeId} date={resolved.date} canRecompute={caps.canRecompute} role={role} />
      </div>
    </AppShell>
  );
}
