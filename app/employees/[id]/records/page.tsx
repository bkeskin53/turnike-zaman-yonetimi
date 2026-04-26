import AppShell from "@/app/_components/AppShellNoSSR";
import EmployeeRecordsClient from "./ui";

export default async function EmployeeRecordsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell title="Zaman Kayıtları" subtitle="Günlük sonuçlar, olay kayıtları ve operasyon işlemleri">
      <EmployeeRecordsClient id={id} />
    </AppShell>
  );
}