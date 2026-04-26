import AppShell from "@/app/_components/AppShellNoSSR";
import EventsClient from "./ui";
import { getCapabilities } from "@/app/_auth/capabilities";
import { getSessionOrNull } from "@/src/auth/guard";
import { getCompanyBundle } from "@/src/services/company.service";

export default async function EventsPage() {
  const caps = await getCapabilities();
  const s = await getSessionOrNull();
  const bundle = await getCompanyBundle();
  const role = s?.role ?? null;
  const policyTimezone = bundle.policy?.timezone || "Europe/Istanbul";
  return (
    <AppShell title="Events" subtitle="Manuel ham olay (RawEvent) girişi ve listeleme">
      {/* Tek kök katman: dışarı taşmayı engelle */}
      <div className="min-w-0 max-w-full overflow-x-hidden">
        <EventsClient
          canEditEvents={caps.canEditEvents}
          role={role ?? "UNKNOWN"}
          policyTimezone={policyTimezone}
        />
      </div>
    </AppShell>
  );
}
