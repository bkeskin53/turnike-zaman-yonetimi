import AppShell from "@/app/_components/AppShellNoSSR";
import EventsClient from "./ui";

export default function EventsPage() {
  return (
    <AppShell title="Events" subtitle="Manuel ham olay (RawEvent) girişi ve listeleme">
      {/* Tek kök katman: dışarı taşmayı engelle */}
      <div className="min-w-0 max-w-full overflow-x-hidden">
        <EventsClient />
      </div>
    </AppShell>
  );
}
