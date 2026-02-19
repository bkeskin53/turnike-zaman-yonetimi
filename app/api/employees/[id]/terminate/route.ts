import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import { dbDateFromDayKey, dayKeyToday, isISODate } from "@/src/utils/dayKey";
import { DateTime } from "luxon";

function toDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

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
    const endKeyRaw = String(body?.endDate ?? "").trim();
    const endKey = endKeyRaw || todayKey;
    const reason = body?.reason ? String(body.reason).trim() : null;

    if (!isISODate(endKey)) return NextResponse.json({ error: "INVALID_END_DATE" }, { status: 400 });

    const endDb = dbDateFromDayKey(endKey);
    const endDayStartUtc = DateTime.fromISO(endKey, { zone: tz }).startOf("day").toUTC().toJSDate();
    const endDayEndUtc = DateTime.fromISO(endKey, { zone: tz }).endOf("day").toUTC().toJSDate();
 
    const result = await prisma.$transaction(async (tx) => {
      const open = await tx.employeeEmploymentPeriod.findFirst({
        where: { companyId, employeeId: id, endDate: null },
        orderBy: [{ startDate: "desc" }],
      });
      if (!open) return { ok: false as const, status: 400, body: { error: "NO_OPEN_EMPLOYMENT" } };

      const startKey = toDayKey(open.startDate);
      if (endKey < startKey) return { ok: false as const, status: 400, body: { error: "END_BEFORE_START" } };

      await tx.employeeEmploymentPeriod.update({
        where: { id: open.id },
        data: { endDate: endDb, reason: reason || open.reason || null },
      });

      // -------------------------------------------------------------
      // Eksik-3.5: Termination sonrası future kurumsal kayıtları delimit/cleanup
      // 1) Leaves:
      //   - tamamen endDate sonrasına başlayan leave -> sil
      //   - endDate'i aşan leave -> endDate (günün sonu) ile kırp
      const delLeaves = await tx.employeeLeave.deleteMany({
        where: {
          companyId,
          employeeId: id,
          dateFrom: { gt: endDayEndUtc },
        },
      });

      const trimLeaves = await tx.employeeLeave.updateMany({
        where: {
          companyId,
          employeeId: id,
          dateFrom: { lte: endDayEndUtc },
          dateTo: { gt: endDayEndUtc },
        },
        data: { dateTo: endDayEndUtc },
      });

      // 2) Weekly shift plans: endDate sonrası haftaları sil (weekStartDate @ UTC)
      // weekStartDate > endDb (UTC midnight) olanlar endKey sonrası hafta başlangıcıdır.
      const delPlans = await tx.weeklyShiftPlan.deleteMany({
        where: {
          companyId,
          employeeId: id,
          weekStartDate: { gt: endDb },
        },
      });

      // 3) Daily adjustments: endDate sonrası günleri sil
      const delAdjustments = await tx.dailyAdjustment.deleteMany({
        where: {
          companyId,
          employeeId: id,
          date: { gt: endDb },
        },
      });

      await tx.employeeAction.create({
        data: {
          companyId,
          employeeId: id,
          type: "TERMINATE",
          effectiveDate: endDb,
          note: reason || null,
          actorUserId: session.userId,
          details: {
            periodId: open.id,
            startDate: startKey,
            endDate: endKey,
            cleanup: {
              leavesDeleted: delLeaves.count,
              leavesTrimmed: trimLeaves.count,
              weeklyPlansDeleted: delPlans.count,
              adjustmentsDeleted: delAdjustments.count,
            },
          },
        },
      });

      const derivedIsActive = endKey >= todayKey;
      await tx.employee.update({ where: { id, companyId }, data: { isActive: derivedIsActive } });

      return { ok: true as const, status: 200, body: { ok: true, endDate: endKey, derivedIsActive } };
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    console.error("[api/employees/[id]/terminate][POST] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}