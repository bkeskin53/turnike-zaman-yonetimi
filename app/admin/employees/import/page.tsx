import AppShell from "@/app/_components/AppShell";
import EmployeesImportClient from "./ui";

export default function EmployeesImportPage() {
  return (
    <AppShell
      title="Employees • CSV İçe Aktar"
      subtitle="Excel/CSV listesini yapıştır, önce dry-run ile kontrol et, sonra uygula."
    >
      <EmployeesImportClient />
    </AppShell>
  );
}