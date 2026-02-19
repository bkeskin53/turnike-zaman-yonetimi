import { NextResponse } from "next/server";
import { getSessionOrNull, requireRole } from "@/src/auth/guard";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import { hardDeleteEmployee } from "@/src/services/employee.service";
import { dbDateFromDayKey, dayKeyToday } from "@/src/utils/dayKey";

function toDayKey(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  // Güvenlik: hard delete sadece ADMIN
  if (session.role !== "SYSTEM_ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "BAD_ID" }, { status: 400 });

  const url = new URL(req.url);
  const hard = url.searchParams.get("hard") === "1";

  if (hard) {
    await hardDeleteEmployee(id);
    return NextResponse.json({ ok: true, mode: "HARD_DELETE" });
  }

  // default: enterprise soft delete => TERMINATE effective today (canonical dayKey)
  const companyId = await getActiveCompanyId();
  const bundle = await getCompanyBundle();
  const tz = bundle.policy?.timezone || "Europe/Istanbul";
  const todayKey = dayKeyToday(tz);
  const todayDb = dbDateFromDayKey(todayKey);

  await prisma.$transaction(async (tx) => {
    const open = await tx.employeeEmploymentPeriod.findFirst({
      where: { companyId, employeeId: id, endDate: null },
      orderBy: [{ startDate: "desc" }],
    });

    if (open) {
      await tx.employeeEmploymentPeriod.update({
        where: { id: open.id },
        data: { endDate: todayDb, reason: open.reason || "SOFT_DELETE" },
      });

      await tx.employeeAction.create({
        data: {
          companyId,
          employeeId: id,
          type: "TERMINATE",
          effectiveDate: todayDb,
          note: "SOFT_DELETE",
          actorUserId: session.userId,
          details: { periodId: open.id, startDate: toDayKey(open.startDate), endDate: todayKey },
        },
      });
    }

    await tx.employee.update({ where: { id, companyId }, data: { isActive: false } });
  });

  return NextResponse.json({ ok: true, mode: "TERMINATED_TODAY", date: todayKey });
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
