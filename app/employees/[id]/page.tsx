import { redirect } from "next/navigation";

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ asOf?: string }>;
}) {
  const { id } = await params;
  const qp = searchParams ? await searchParams : undefined;
  const asOf = String(qp?.asOf ?? "").trim();

  redirect(
    asOf
      ? `/employees/${id}/master?asOf=${encodeURIComponent(asOf)}`
      : `/employees/${id}/master`,
  );
}