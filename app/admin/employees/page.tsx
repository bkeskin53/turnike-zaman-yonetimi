import AppShell from "@/app/_components/AppShellNoSSR";
import EmployeesClient from "./ui";
import { getCapabilities } from "@/app/_auth/capabilities";
import { getSessionOrNull } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import { getActiveCompanyId } from "@/src/services/company.service";
import { resolveEmployeeCreateFormConfiguration } from "@/src/services/employees/employeeCreateFormConfiguration.service";
import { resolveNextEmployeeCode } from "@/src/services/employees/employeeCodeSequence.service";

export default async function EmployeesPage() {
  const s = await getSessionOrNull();
  const caps = await getCapabilities();
  const role = s?.role ?? null;
  const companyId = await getActiveCompanyId();
  const createFormConfiguration = await resolveEmployeeCreateFormConfiguration({
    companyId,
  });
  let initialEmployeeCode = "";
  try {
    initialEmployeeCode = await resolveNextEmployeeCode({ companyId });
  } catch {
    // Sequence okunamazsa ekranı düşürmeyelim; kullanıcı manuel girişle devam edebilir.
    initialEmployeeCode = "";
  }

  // OPS screen: only OPS_WRITE may mutate (SYSTEM_ADMIN + HR_OPERATOR)
  const canOpsWrite = role ? ROLE_SETS.OPS_WRITE.includes(role) : false;
  return (
    <AppShell title="Çalışan Kaydı" subtitle="Zaman kapsamına dahil edilecek çalışan profili oluşturun">
      <EmployeesClient
        canWrite={canOpsWrite}
        canAccessImportWorkspace={caps.employeeImport.canAccessWorkspace}
        createFormConfiguration={createFormConfiguration}
        initialEmployeeCode={initialEmployeeCode}
      />
    </AppShell>
  );
}
