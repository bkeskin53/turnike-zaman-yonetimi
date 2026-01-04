import AppShell from "@/app/_components/AppShell";
import EventsClient from "./ui";

export default function EventsPage() {
  return (
    <AppShell title="Events" subtitle="Manuel ham olay (RawEvent) girişi ve listeleme">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <EventsClient />
      </div>
    </AppShell>
  );
}
