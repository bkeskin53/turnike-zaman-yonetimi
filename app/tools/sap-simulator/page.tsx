import AppShell from "@/app/_components/AppShellNoSSR";
import { requireRole } from "@/src/auth/guard";
import SapSimulatorClient from "./ui";

export default async function SapSimulatorPage() {
  // Bu sayfa entegrasyon endpoint'lerine UI üzerinden istek atar.
  // Yüksek yetki gerektirdiği için ADMIN/HR ile sınırlıyoruz.
  await requireRole(["ADMIN", "HR"]);

  return (
    <AppShell title="SAP/Logo Simulator" subtitle="UI üzerinden entegrasyon istekleri gönder (dev/test)">
      <SapSimulatorClient />
    </AppShell>
  );
}
