import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/auth/http";
import { previewEmployeeHardDelete } from "@/src/services/employeeHardDelete.service";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["SYSTEM_ADMIN"]);
  } catch (err) {
    const r = authErrorResponse(err);
    if (r) return r;
    throw err;
  }

  try {
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "BAD_ID" }, { status: 400 });
    }

    const item = await previewEmployeeHardDelete(id);
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg === "EMPLOYEE_NOT_FOUND") {
      return NextResponse.json({ ok: false, error: "EMPLOYEE_NOT_FOUND" }, { status: 404 });
    }

    console.error("[api/employees/[id]/hard-delete/preview][POST] unexpected error", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}