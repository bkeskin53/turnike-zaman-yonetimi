import AppShell from "@/app/_components/AppShellNoSSR";
import BreakPlansClient from "./ui";
import { getSessionOrNull } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";

export default async function BreakPlansPage() {
  const session = await getSessionOrNull();
  const canWrite = Boolean(session && ROLE_SETS.CONFIG_WRITE.includes(session.role));

  return (
    <AppShell
      title="Mola Planları"
      subtitle="Vardiyalarda kullanılacak ücretli veya ücretsiz toplam mola süresi tanımları"
    >
      <BreakPlansClient canWrite={canWrite} />
    </AppShell>
  );
}