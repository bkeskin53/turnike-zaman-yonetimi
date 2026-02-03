import AppShell from "@/app/_components/AppShellNoSSR";
import { requireRole } from "@/src/auth/guard";
import { getIntegrationRequestDetail } from "@/src/services/integrationRequestDetail.service";
import RequestDetailClient from "./ui";

export default async function IntegrationRequestPage(props: {
  params: Promise<{ requestId: string }>;
}) {
  await requireRole(["ADMIN", "HR"]);

  const { requestId } = await props.params;
  const item = await getIntegrationRequestDetail(requestId);

  if (!item) {
    return (
      <AppShell title="Integration Request">
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="text-sm text-zinc-600">Request not found.</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Integration Request"
      subtitle={`${item.endpoint} · ${item.sourceSystem}`}
    >
      <RequestDetailClient item={item} />
    </AppShell>
  );
}
