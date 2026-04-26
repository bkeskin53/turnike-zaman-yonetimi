import AppShell from "@/app/_components/AppShellNoSSR";
import BranchPolicyClient from "./ui";
import { getSessionOrNull } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";

export default async function BranchPolicyPage() {
  const s = await getSessionOrNull();
  const role = s?.role ?? null;

  // CONFIG screen: only CONFIG_WRITE may edit (HR_OPERATOR is OPS_WRITE only -> must be read-only here)
  const canWrite = role ? ROLE_SETS.CONFIG_WRITE.includes(role) : false;
  return (
    <AppShell
      title="Branch Policy Assignment"
      subtitle="Şube bazlı RuleSet ataması (precedence: Employee > Branch > Company Default)"
    >
      <BranchPolicyClient canWrite={canWrite} />
    </AppShell>
  );
}
