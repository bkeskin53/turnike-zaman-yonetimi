import AppShell from "@/app/_components/AppShellNoSSR";
import AuditAdminClient from "./ui";

import { getSessionOrNull } from "@/src/auth/guard";
import { notFound, redirect } from "next/navigation";

export default async function AdminAuditPage() {
  const s = await getSessionOrNull();
  if (!s) redirect("/login");
  if (s.role !== "SYSTEM_ADMIN") notFound();

  return (
    <AppShell title="Denetim Kayıtları" subtitle="Admin aksiyonları için audit trail">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <AuditAdminClient />
      </div>
    </AppShell>
  );
}