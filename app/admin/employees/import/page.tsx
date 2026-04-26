import AppShell from "@/app/_components/AppShell";
import EmployeesImportClient from "./ui";
import { getCapabilities } from "@/app/_auth/capabilities";

export default async function EmployeesImportPage() {
  const caps = await getCapabilities();
  return (
    <AppShell
      title="Personel Toplu İçe Aktarım"
      subtitle="Sabit Excel şablonunu indir, ilgili tabı doldur ve başlık sözleşmesine göre doğrula."
    >
      <EmployeesImportClient permissions={caps.employeeImport} visibility={caps.employeeImportVisibility} />
    </AppShell>
  );
}
