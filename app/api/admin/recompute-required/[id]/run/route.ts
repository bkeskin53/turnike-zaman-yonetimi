import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/auth/http";
import { prisma } from "@/src/repositories/prisma";
import { RecomputeStatus } from "@prisma/client";
import { recomputeAttendanceForDate } from "@/src/services/attendance.service";

function isDayKey(x: unknown): x is string {
  return typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
}

function addDaysDayKey(dayKey: string, days: number) {
  // dayKey is YYYY-MM-DD
  const [y, m, d] = dayKey.split("-").map((n) => Number(n));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let session: { userId: string; role: any } | null = null;

  try {
    session = await requireRole(["SYSTEM_ADMIN"]);
  } catch (err) {
    const r = authErrorResponse(err);
    if (r) return r;
    throw err;
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);

  const rr = await prisma.recomputeRequirement.findUnique({
    where: { id },
    select: {
      id: true,
      companyId: true,
      reason: true,
      rangeStartDayKey: true,
      rangeEndDayKey: true,
      status: true,
    },
  });
  if (!rr) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (rr.status !== RecomputeStatus.PENDING) {
    return NextResponse.json({ ok: false, error: "NOT_PENDING" }, { status: 400 });
  }

  const start = isDayKey(rr.rangeStartDayKey) ? rr.rangeStartDayKey : (isDayKey(body?.rangeStartDayKey) ? body.rangeStartDayKey : null);
  const end = isDayKey(rr.rangeEndDayKey) ? rr.rangeEndDayKey : (isDayKey(body?.rangeEndDayKey) ? body.rangeEndDayKey : null);

  if (!start || !end) return NextResponse.json({ ok: false, error: "RANGE_REQUIRED" }, { status: 400 });
  if (start > end) return NextResponse.json({ ok: false, error: "RANGE_INVALID" }, { status: 400 });

  await prisma.recomputeRequirement.update({
    where: { id },
    data: {
      status: RecomputeStatus.RUNNING,
      lastRunAt: new Date(),
    },
  });

  // Run recompute day-by-day (minimal v1)
  let day = start;
  const results: Array<{ dayKey: string; ok: boolean }> = [];
  while (day <= end) {
    try {
      await recomputeAttendanceForDate(day);
      results.push({ dayKey: day, ok: true });
    } catch {
      results.push({ dayKey: day, ok: false });
    }
    day = addDaysDayKey(day, 1);
  }

  await prisma.recomputeRequirement.update({
    where: { id },
    data: {
      status: RecomputeStatus.DONE,
      resolvedByUserId: session.userId,
      resolvedAt: new Date(),
      lastRunAt: new Date(),
      // persist range if it was unknown
      rangeStartDayKey: start,
      rangeEndDayKey: end,
    },
  });

  return NextResponse.json({ ok: true, id, start, end, results });
}