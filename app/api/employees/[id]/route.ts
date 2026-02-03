import { NextResponse } from "next/server";
import { getSessionOrNull, requireRole } from "@/src/auth/guard";
import { getActiveCompanyId } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
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

// GET /api/employees/[id]
// Returns basic details for a single employee belonging to the active company.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    // Require ADMIN or HR role
    await requireRole(["ADMIN", "HR"]);
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "BAD_ID" }, { status: 400 });
    }
    const companyId = await getActiveCompanyId();
    const item = await prisma.employee.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        hiredAt: true,
        terminatedAt: true,
      },
    });
    if (!item) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    console.error("[api/employees/[id]][GET] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}