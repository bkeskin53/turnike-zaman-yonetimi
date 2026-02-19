import AppShell from "@/app/_components/AppShellNoSSR";
import BranchPolicyClient from "./ui";

export default function BranchPolicyPage() {
  return (
    <AppShell
      title="Branch Policy Assignment"
      subtitle="Şube bazlı RuleSet ataması (precedence: Employee > Branch > Company Default)"
    >
      <BranchPolicyClient />
    </AppShell>
  );
}
