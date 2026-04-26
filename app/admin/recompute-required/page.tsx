import AppShell from "@/app/_components/AppShellNoSSR";
import RecomputeRequiredClient from "./ui";

import { getSessionOrNull } from "@/src/auth/guard";
import { notFound, redirect } from "next/navigation";

export default async function AdminRecomputeRequiredPage() {
  const s = await getSessionOrNull();
  if (!s) redirect("/login");
  if (s.role !== "SYSTEM_ADMIN") notFound();

  return (
    <AppShell title="Recompute Kuyruğu" subtitle="Motoru etkileyen değişiklikler sonrası bekleyen recompute ihtiyaçları">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <RecomputeRequiredClient />
      </div>
    </AppShell>
  );
}