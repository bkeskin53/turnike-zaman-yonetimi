import AppShell from "@/app/_components/AppShellNoSSR";
import {
  EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY,
} from "@/src/features/employees/employeeCreateFormConfiguration";
import { getSessionOrNull, requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import { getActiveCompanyId } from "@/src/services/company.service";
import { resolveEmployeeCreateFormConfiguration } from "@/src/services/employees/employeeCreateFormConfiguration.service";
import EmployeeCreateFormConfigurationClient from "./ui";

export default async function EmployeeCreateFormConfigurationPage() {
  const session = await getSessionOrNull();
  const role = String(session?.role ?? "UNKNOWN");

  try {
    await requireRole(ROLE_SETS.CONFIG_WRITE);
  } catch {
    return (
      <AppShell
        title="Çalışan Kayıt Formu Görünürlüğü"
        subtitle="Create form visibility ayarları"
      >
        <div className="min-w-0 max-w-full overflow-x-hidden p-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-extrabold text-amber-900 tracking-tight">
                Yetki yok
              </div>
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] font-bold uppercase tracking-tight ring-1 ring-inset ring-amber-200">
                ROL: {role}
              </span>
            </div>
            <div className="mt-2 text-sm font-semibold text-amber-900/90">
              Bu ekran yalnızca yapılandırma yetkisine sahip admin kullanıcılar içindir.
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const companyId = await getActiveCompanyId();
  const initialConfiguration = await resolveEmployeeCreateFormConfiguration({
    companyId,
    screenKey: EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY,
  });

  return (
    <AppShell
      title="Çalışan Kayıt Formu Görünürlüğü"
      subtitle="Create formundaki opsiyonel alanların company bazlı görünürlüğünü yönetin"
    >
      <EmployeeCreateFormConfigurationClient
        initialConfiguration={initialConfiguration}
      />
    </AppShell>
  );
}
