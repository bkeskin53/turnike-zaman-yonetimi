import AppShell from "@/app/_components/AppShellNoSSR";
import TestConsoleClient from "./ui";

export default function TestConsolePage() {
  return (
    <AppShell title="Test Console" subtitle="Sadece geliştirme ortamı: otomatik event seed / cleanup">
      <TestConsoleClient />
    </AppShell>
  );
}
