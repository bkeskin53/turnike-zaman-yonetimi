import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import { dbDateFromDayKey, dayKeyToday, isISODate } from "@/src/utils/dayKey";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "BAD_ID" }, { status: 400 });

    const companyId = await getActiveCompanyId();
    const bundle = await getCompanyBundle();
    const tz = bundle.policy?.timezone || "Europe/Istanbul";
    const todayKey = dayKeyToday(tz);

    const body = await req.json();
    const startKeyRaw = String(body?.startDate ?? "").trim();
    const startKey = startKeyRaw || todayKey;
    const reason = body?.reason ? String(body.reason).trim() : null;

    if (!isISODate(startKey)) return NextResponse.json({ error: "INVALID_START_DATE" }, { status: 400 });

    const startDb = dbDateFromDayKey(startKey);

    const result = await prisma.$transaction(async (tx) => {
      const overlap = await tx.employeeEmploymentPeriod.findFirst({
        where: {
          companyId,
          employeeId: id,
          startDate: { lte: startDb },
          OR: [{ endDate: null }, { endDate: { gte: startDb } }],
        },
        select: { id: true },
      });
      if (overlap) return { ok: false as const, status: 400, body: { error: "EMPLOYMENT_OVERLAP" } };

      const created = await tx.employeeEmploymentPeriod.create({
        data: { companyId, employeeId: id, startDate: startDb, endDate: null, reason: reason || null },
        select: { id: true },
      });

      await tx.employeeAction.create({
        data: {
          companyId,
          employeeId: id,
          type: "REHIRE",
          effectiveDate: startDb,
          note: reason || null,
          actorUserId: session.userId,
          details: { periodId: created.id, startDate: startKey },
        },
      });

      const derivedIsActive = startKey <= todayKey;
      await tx.employee.update({ where: { id, companyId }, data: { isActive: derivedIsActive } });

      return { ok: true as const, status: 200, body: { ok: true, startDate: startKey, derivedIsActive } };
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    console.error("[api/employees/[id]/rehire][POST] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}