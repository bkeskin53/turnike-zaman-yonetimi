import AppShell from "@/app/_components/AppShellNoSSR";
import DeviceInboxClient from "./ui";

export default function DeviceInboxPage() {
  return (
    <AppShell title="Cihaz Inbox" subtitle="Eşleşmeyen (kimliği bulunamayan) cihaz kayıtları burada bekler (PENDING)">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <DeviceInboxClient />
      </div>
    </AppShell>
  );
}
