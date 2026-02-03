import AppShell from "@/app/_components/AppShellNoSSR";
import LeavesClient from "./ui";

/**
 * Dynamic route for displaying and managing leave records of a specific employee.
 * Next.js passes params as a promise for dynamic segments.
 */
export default async function LeavesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell title="İzinler" subtitle="Çalışan izin kayıtları">
      <LeavesClient id={id} />
    </AppShell>
  );
}