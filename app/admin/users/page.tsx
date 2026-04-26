import AppShell from "@/app/_components/AppShellNoSSR";
import UsersAdminClient from "./ui";

import { getSessionOrNull } from "@/src/auth/guard";
import { notFound, redirect } from "next/navigation";

export default async function AdminUsersPage() {
  const s = await getSessionOrNull();
  if (!s) redirect("/login");
  if (s.role !== "SYSTEM_ADMIN") notFound();

  return (
    <AppShell title="Kullanıcı Yönetimi" subtitle="Kullanıcı ekle, rol ata, aktif/pasif yap">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <UsersAdminClient />
      </div>
    </AppShell>
  );
}