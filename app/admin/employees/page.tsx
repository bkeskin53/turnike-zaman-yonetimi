import AppShell from "@/app/_components/AppShell";
import EmployeesClient from "./ui";

export default function EmployeesPage() {
  return (
    <AppShell title="Employees" subtitle="Çalışan listesi ve yönetimi">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <EmployeesClient />
      </div>
    </AppShell>
  );
}
