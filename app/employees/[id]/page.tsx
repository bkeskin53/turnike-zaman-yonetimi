import AppShell from "@/app/_components/AppShellNoSSR";
// Import the client component directly. It's marked with 'use client' so it will be rendered on the client automatically.
import Employee360Client from "./ui";

// The params argument is asynchronous in Next.js 15+ dynamic routes.
// Mark the component as async and await the params before using its properties.
export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Await params to extract the id
  const { id } = await params;
  return (
    <AppShell
      title="Employee 360"
      subtitle="Çalışan detayları ve gün sonu özetleri"
    >
      {/* Pass the employee id to client component */}
      <Employee360Client id={id} />
    </AppShell>
  );
}