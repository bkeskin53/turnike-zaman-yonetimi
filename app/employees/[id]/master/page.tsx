import AppShell from "@/app/_components/AppShellNoSSR";
import EmployeeMasterClient from "./ui";
import { employeeCardScopeTerms } from "@/src/features/employees/cardScopeTerminology";
import { getActiveCompanyId } from "@/src/services/company.service";
import { resolveEmployeeMasterDisplayConfiguration } from "@/src/services/employees/employeeMasterDisplayConfiguration.service";
import { resolveEmployeeMasterFormConfiguration } from "@/src/services/employees/employeeMasterFormConfiguration.service";
import { resolveEmployeeMasterHistoryDisplayConfiguration } from "@/src/services/employees/employeeMasterHistoryDisplayConfiguration.service";
import { resolveEmployeeMasterHistoryFormConfiguration } from "@/src/services/employees/employeeMasterHistoryFormConfiguration.service";
import { resolveEmployeeMasterHistoryListConfiguration } from "@/src/services/employees/employeeMasterHistoryListConfiguration.service";

export default async function EmployeeMasterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyId = await getActiveCompanyId();
  const [
    masterDisplayConfiguration,
    masterFormConfiguration,
    masterHistoryDisplayConfiguration,
    masterHistoryFormConfiguration,
    masterHistoryListConfiguration,
  ] =
    await Promise.all([
      resolveEmployeeMasterDisplayConfiguration({
        companyId,
      }),
      resolveEmployeeMasterFormConfiguration({
        companyId,
      }),
      resolveEmployeeMasterHistoryDisplayConfiguration({
        companyId,
      }),
      resolveEmployeeMasterHistoryFormConfiguration({
        companyId,
      }),
      resolveEmployeeMasterHistoryListConfiguration({
        companyId,
      }),
    ]);

  return (
    <AppShell
      title={employeeCardScopeTerms.masterPageTitle}
      subtitle={employeeCardScopeTerms.masterPageSubtitle}
    >
      <EmployeeMasterClient
        id={id}
        masterDisplayConfiguration={masterDisplayConfiguration}
        masterFormConfiguration={masterFormConfiguration}
        masterHistoryDisplayConfiguration={masterHistoryDisplayConfiguration}
        masterHistoryFormConfiguration={masterHistoryFormConfiguration}
        masterHistoryListConfiguration={masterHistoryListConfiguration}
      />
    </AppShell>
  );
}
