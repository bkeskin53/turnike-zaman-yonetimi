import AppShell from "@/app/_components/AppShellNoSSR";
import { requireRole } from "@/src/auth/guard";
import SapSimulatorClient from "./ui";

export default async function SapSimulatorPage() {
  // Bu sayfa entegrasyon endpoint'lerine UI üzerinden istek atar.
  // Yüksek yetki gerektirdiği için ADMIN/HR ile sınırlıyoruz.
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);
  } catch (e) {
    return (
      <AppShell title="SAP/Logo Simulator" subtitle="UI üzerinden entegrasyon istekleri gönder (dev/test)">
        <div className="p-4 text-sm">Bu sayfaya erişim yetkiniz yok.</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="SAP/Logo Simulator" subtitle="UI üzerinden entegrasyon istekleri gönder (dev/test)">
      <SapSimulatorClient />
    </AppShell>
  );
}
