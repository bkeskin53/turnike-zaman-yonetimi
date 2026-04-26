import AppShell from "@/app/_components/AppShellNoSSR";
import DeviceInboxClient from "./ui";
import { getCapabilities } from "@/app/_auth/capabilities";
import { getSessionOrNull } from "@/src/auth/guard";

export default async function DeviceInboxPage() {
  const caps = await getCapabilities();
  const s = await getSessionOrNull();
  const role = (s as any)?.role ?? null;

  return (
    <AppShell title="Cihaz Inbox" subtitle="Eşleşmeyen (kimliği bulunamayan) cihaz kayıtları burada bekler (PENDING)">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <DeviceInboxClient
          canResolve={caps.canEditEvents}
          role={role}
        />
      </div>
    </AppShell>
  );
}
