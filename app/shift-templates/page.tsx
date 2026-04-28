import AppShell from "@/app/_components/AppShellNoSSR";
import ShiftTemplatesClient from "./ui";
import { getSessionOrNull } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";

export default async function ShiftTemplatesPage() {
  const s = await getSessionOrNull();
  const canWrite = Boolean(s && ROLE_SETS.CONFIG_WRITE.includes(s.role));
  return (
    <AppShell
      title="Günlük Çalışma Programı"
      subtitle="Vardiya şablonları — kurumsal kod + start/end + signature (+1) ve özel OFF sistem şablonu"
    >
      <ShiftTemplatesClient canWrite={canWrite} />
    </AppShell>
  );
}