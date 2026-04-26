import AppShell from "@/app/_components/AppShellNoSSR";
import EmployeeEditClient from "./ui";

export default async function EmployeeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AppShell
      title="Personel Düzenle"
      subtitle="Kimlik, kart eşlemesi ve temel çalışan bilgilerini güncelleyin"
    >
      <EmployeeEditClient id={id} />
    </AppShell>
  );
}