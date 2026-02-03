import AppShell from "@/app/_components/AppShellNoSSR";
import ShiftTemplatesClient from "./ui";

export default function ShiftTemplatesPage() {
  return (
    <AppShell
      title="Shift Templates"
      subtitle="Vardiya şablonları (Stage 2) — start/end + signature (+1)"
    >
      <ShiftTemplatesClient />
    </AppShell>
  );
}