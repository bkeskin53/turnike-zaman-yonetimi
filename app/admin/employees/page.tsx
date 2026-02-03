import AppShell from "@/app/_components/AppShellNoSSR";
import EmployeesClient from "./ui";

export default function EmployeesPage() {
  return (
    <AppShell title="Employees" subtitle="Çalışan listesi ve yönetimi">
      <EmployeesClient />
    </AppShell>
  );
}
