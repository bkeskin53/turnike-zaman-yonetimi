import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import { deactivateEmployee, hardDeleteEmployee } from "@/src/services/employee.service";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  // Güvenlik: hard delete sadece ADMIN
  if (session.role !== "ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "BAD_ID" }, { status: 400 });

  const url = new URL(req.url);
  const hard = url.searchParams.get("hard") === "1";

  if (hard) {
    await hardDeleteEmployee(id);
    return NextResponse.json({ ok: true, mode: "HARD_DELETE" });
  }

  // default: soft delete
  await deactivateEmployee(id);
  return NextResponse.json({ ok: true, mode: "SOFT_DELETE" });
}
