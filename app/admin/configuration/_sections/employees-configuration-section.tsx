import EmployeeCreateFormConfigurationClient from "@/app/admin/employees/create-form-configuration/ui";
import EmployeeMasterDisplayConfigurationClient from "@/app/admin/employees/configuration/master-display-ui";
import EmployeeMasterFormConfigurationClient from "@/app/admin/employees/configuration/master-ui";
import EmployeeMasterHistoryDisplayConfigurationClient from "@/app/admin/employees/configuration/master-history-ui";
import EmployeeMasterHistoryFormConfigurationClient from "@/app/admin/employees/configuration/master-history-form-ui";
import EmployeeMasterHistoryListConfigurationClient from "@/app/admin/employees/configuration/master-history-list-ui";
import {
  EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY,
} from "@/src/features/employees/employeeCreateFormConfiguration";
import {
  EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_SCREEN_KEY,
} from "@/src/features/employees/employeeMasterDisplayConfiguration";
import {
  EMPLOYEE_MASTER_FORM_CONFIGURATION_SCREEN_KEY,
} from "@/src/features/employees/employeeMasterFormConfiguration";
import {
  EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY,
} from "@/src/features/employees/employeeMasterHistoryDisplayConfiguration";
import {
  EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_SCREEN_KEY,
} from "@/src/features/employees/employeeMasterHistoryFormConfiguration";
import {
  EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY,
} from "@/src/features/employees/employeeMasterHistoryListConfiguration";
import { getActiveCompanyId } from "@/src/services/company.service";
import { resolveEmployeeCreateFormConfiguration } from "@/src/services/employees/employeeCreateFormConfiguration.service";
import { resolveEmployeeMasterDisplayConfiguration } from "@/src/services/employees/employeeMasterDisplayConfiguration.service";
import { resolveEmployeeMasterFormConfiguration } from "@/src/services/employees/employeeMasterFormConfiguration.service";
import { resolveEmployeeMasterHistoryDisplayConfiguration } from "@/src/services/employees/employeeMasterHistoryDisplayConfiguration.service";
import { resolveEmployeeMasterHistoryFormConfiguration } from "@/src/services/employees/employeeMasterHistoryFormConfiguration.service";
import { resolveEmployeeMasterHistoryListConfiguration } from "@/src/services/employees/employeeMasterHistoryListConfiguration.service";

export default async function EmployeesConfigurationSection() {
  const companyId = await getActiveCompanyId();

  const [
    createConfiguration,
    masterDisplayConfiguration,
    masterConfiguration,
    masterHistoryConfiguration,
    masterHistoryFormConfiguration,
    masterHistoryListConfiguration,
  ] = await Promise.all([
    resolveEmployeeCreateFormConfiguration({
      companyId,
      screenKey: EMPLOYEE_CREATE_FORM_CONFIGURATION_SCREEN_KEY,
    }),
    resolveEmployeeMasterDisplayConfiguration({
      companyId,
      screenKey: EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_SCREEN_KEY,
    }),
    resolveEmployeeMasterFormConfiguration({
      companyId,
      screenKey: EMPLOYEE_MASTER_FORM_CONFIGURATION_SCREEN_KEY,
    }),
    resolveEmployeeMasterHistoryDisplayConfiguration({
      companyId,
      screenKey: EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY,
    }),
    resolveEmployeeMasterHistoryFormConfiguration({
      companyId,
      screenKey: EMPLOYEE_MASTER_HISTORY_FORM_CONFIGURATION_SCREEN_KEY,
    }),
    resolveEmployeeMasterHistoryListConfiguration({
      companyId,
      screenKey: EMPLOYEE_MASTER_HISTORY_LIST_CONFIGURATION_SCREEN_KEY,
    }),
  ]);

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Create Form
        </div>
        <section id="create-form-visibility" className="scroll-mt-24">
          <EmployeeCreateFormConfigurationClient
            initialConfiguration={createConfiguration}
          />
        </section>
      </div>

      <div className="grid gap-2">
        <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Master
        </div>
        <div className="grid gap-2 2xl:grid-cols-2">
          <section id="master-display-visibility" className="scroll-mt-24">
            <EmployeeMasterDisplayConfigurationClient
              initialConfiguration={masterDisplayConfiguration}
            />
          </section>

          <section id="master-modal-visibility" className="scroll-mt-24">
            <EmployeeMasterFormConfigurationClient
              initialConfiguration={masterConfiguration}
            />
          </section>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Master Tarihce
        </div>
        <div className="grid gap-2 2xl:grid-cols-3">
          <section id="master-history-visibility" className="scroll-mt-24">
            <EmployeeMasterHistoryDisplayConfigurationClient
              initialConfiguration={masterHistoryConfiguration}
            />
          </section>

          <section id="master-history-form-visibility" className="scroll-mt-24">
            <EmployeeMasterHistoryFormConfigurationClient
              initialConfiguration={masterHistoryFormConfiguration}
            />
          </section>

          <section id="master-history-list-visibility" className="scroll-mt-24">
            <EmployeeMasterHistoryListConfigurationClient
              initialConfiguration={masterHistoryListConfiguration}
            />
          </section>
        </div>
      </div>
    </div>
  );
}