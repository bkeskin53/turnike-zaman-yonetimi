import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import { authErrorResponse } from "@/src/utils/api";
import { DateTime } from "luxon";

// GET /api/employees/[id]/normalized-events?date=YYYY-MM-DD
// Returns normalized events for a specific employee and date.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    // Ensure ADMIN or HR role
    await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "BAD_ID" }, { status: 400 });
    }
    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "INVALID_DATE" }, { status: 400 });
    }
    const companyId = await getActiveCompanyId();
    const bundle = await getCompanyBundle();
    const tz = bundle.policy?.timezone ?? "Europe/Istanbul";
    // Interpret "date" as a local work-day in policy.timezone, then convert to UTC timestamps.
    // This prevents losing events around local midnight (e.g. Istanbul 00:30 = previous day 21:30Z).
    const start = DateTime.fromISO(date, { zone: tz }).startOf("day").toUTC().toJSDate();
    const end = DateTime.fromISO(date, { zone: tz }).endOf("day").toUTC().toJSDate();
    const items = await prisma.normalizedEvent.findMany({
      where: {
        companyId,
        employeeId: id,
        occurredAt: { gte: start, lte: end },
      },
      orderBy: { occurredAt: "asc" },
      select: {
        id: true,
        rawEventId: true,
        occurredAt: true,
        direction: true,
        status: true,
        rejectReason: true,
      },
    });
    return NextResponse.json({ items });
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;
    console.error("[api/employees/[id]/normalized-events][GET] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}