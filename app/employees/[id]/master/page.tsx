import AppShell from "@/app/_components/AppShellNoSSR";
import EmployeeMasterClient from "./ui";

export default async function EmployeeMasterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell title="Personel Kimlik" subtitle="Özlük & zaman yönetimi bağlantıları (tek bakışta)">
      <EmployeeMasterClient id={id} />
    </AppShell>
  );
}