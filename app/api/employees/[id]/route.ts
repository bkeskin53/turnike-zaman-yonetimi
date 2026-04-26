import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { getActiveCompanyId } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";

function toDayKey(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["SYSTEM_ADMIN"]);

    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "BAD_ID" }, { status: 400 });

    const companyId = await getActiveCompanyId();
    const employee = await prisma.employee.findFirst({
      where: { id, companyId },
      select: { id: true, employeeCode: true, firstName: true, lastName: true },
    });

    if (!employee) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json(
      {
        ok: false,
        error: "DELETE_ROUTE_DISABLED",
        message:
          "Employee delete semantics are split into explicit workflows. Use /terminate for scope close. Hard delete will run only through dedicated preview/apply routes.",
        employee,
        allowedActions: {
          terminate: `/api/employees/${id}/terminate`,
          rehire: `/api/employees/${id}/rehire`,
        },
      },
      { status: 405 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    console.error("[api/employees/[id]][DELETE] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "BAD_ID" }, { status: 400 });
    const companyId = await getActiveCompanyId();

    const item = await prisma.employee.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        nationalId: true,
        phone: true,
        gender: true,
        cardNo: true,
        deviceUserId: true,
        branchId: true,
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        employeeGroupId: true,
        employeeGroup: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        employeeSubgroupId: true,
        employeeSubgroup: {
          select: {
            id: true,
            code: true,
            name: true,
            groupId: true,
          },
        },
        isActive: true,
        hiredAt: true,
        terminatedAt: true,
        employmentPeriods: {
          orderBy: [{ startDate: "desc" }],
          take: 20,
          select: { id: true, startDate: true, endDate: true, reason: true, createdAt: true },
        },
      },
    });
    if (!item) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    // EmployeeAction relation'ı Employee modelinde olmayabilir => ayrı query ile çekiyoruz (kurumsal/audit güvenli yol)
    const actions = await prisma.employeeAction.findMany({
      where: { companyId, employeeId: id },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
      select: {
        id: true,
        type: true,
        effectiveDate: true,
        note: true,
        actorUserId: true,
        createdAt: true,
        details: true,
      },
    });

    return NextResponse.json({
      item: {
        ...item,
        employmentPeriods: item.employmentPeriods.map((p) => ({
          id: p.id,
          startDate: toDayKey(p.startDate),
          endDate: toDayKey(p.endDate),
          reason: p.reason,
          createdAt: p.createdAt,
        })),
        actions: actions.map((a) => ({
          id: a.id,
          type: a.type,
          effectiveDate: toDayKey(a.effectiveDate),
          note: a.note ?? null,
          actorUserId: a.actorUserId ?? null,
          createdAt: a.createdAt,
          details: a.details ?? null,
        })),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    console.error("[api/employees/[id]][GET] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
