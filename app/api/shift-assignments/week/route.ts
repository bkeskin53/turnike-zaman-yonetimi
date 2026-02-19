import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import { computeWeekStartUTC } from "@/src/services/shiftPlan.service";

function isISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(req: Request) {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);
    const companyId = await getActiveCompanyId();
    const { policy } = await getCompanyBundle();
    const tz = policy.timezone || "Europe/Istanbul";

    const url = new URL(req.url);
    const weekStartDate = String(url.searchParams.get("weekStartDate") ?? "").trim();

    if (!weekStartDate) return NextResponse.json({ error: "WEEK_START_REQUIRED" }, { status: 400 });
    if (!isISODate(weekStartDate)) return NextResponse.json({ error: "WEEK_START_INVALID" }, { status: 400 });

    const dt = DateTime.fromISO(weekStartDate, { zone: tz });
    if (!dt.isValid) return NextResponse.json({ error: "WEEK_START_INVALID" }, { status: 400 });
    if (dt.weekday !== 1) return NextResponse.json({ error: "WEEK_START_MUST_BE_MONDAY" }, { status: 400 });

    const weekStartUTC = computeWeekStartUTC(weekStartDate, tz);

    const plans = await prisma.weeklyShiftPlan.findMany({
      where: { companyId, weekStartDate: weekStartUTC },
      select: {
        employeeId: true,
        shiftTemplateId: true,
        shiftTemplate: {
          select: {
            signature: true,
            startTime: true,
            endTime: true,
            spansMidnight: true,
            isActive: true,
          },
        },
      },
    });

    const byEmployeeId: Record<string, string | null> = {};
    const byEmployeeIdLabel: Record<string, string | null> = {};
    const byEmployeeIdIsActive: Record<string, boolean | null> = {};

    for (const p of plans) {
      byEmployeeId[p.employeeId] = p.shiftTemplateId;

      if (!p.shiftTemplate) {
        byEmployeeIdLabel[p.employeeId] = p.shiftTemplateId ?? null;
        byEmployeeIdIsActive[p.employeeId] = null;
        continue;
      }
      const t = p.shiftTemplate;
      // Signature is canonical in system (0900-1800 or 2200-0600+1)
      const label = `${t.signature} (${t.startTime}-${t.endTime}${t.spansMidnight ? "+1" : ""})`;
      byEmployeeIdLabel[p.employeeId] = label;
      byEmployeeIdIsActive[p.employeeId] = t.isActive;
    }

    return NextResponse.json({ ok: true, byEmployeeId, byEmployeeIdLabel, byEmployeeIdIsActive });
  } catch (e) {
    return authErrorResponse(e);
  }
}