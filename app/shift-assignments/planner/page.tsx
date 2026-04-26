import AppShell from "@/app/_components/AppShellNoSSR";
import ShiftPlannerClient from "./ui";
import { getSessionOrNull } from "@/src/auth/guard";
import { UserRole } from "@prisma/client";

export default async function ShiftPlannerPage() {
  const s = await getSessionOrNull();
  // Planner = OPS_WRITE: SYSTEM_ADMIN + HR_OPERATOR yazabilir.
  // HR_CONFIG_ADMIN bu ekranda tanım/atama yapamaz -> read-only.
  const canWrite = Boolean(s && (s.role === UserRole.SYSTEM_ADMIN || s.role === UserRole.HR_OPERATOR));
  return (
    <AppShell title="Shift Planner" subtitle="Tarih aralığı bazlı vardiya planı (Default + Day Override)">
      <ShiftPlannerClient canWrite={canWrite} />
    </AppShell>
  );
}