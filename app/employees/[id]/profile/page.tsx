import AppShell from "@/app/_components/AppShellNoSSR";
import EmployeeShiftSummaryClient from "../ui";
import { employeeCardScopeTerms } from "@/src/features/employees/cardScopeTerminology";

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AppShell
      title={employeeCardScopeTerms.profileTitle}
      subtitle={employeeCardScopeTerms.profileSubtitle}
    >
      <EmployeeShiftSummaryClient id={id} />
    </AppShell>
  );
}