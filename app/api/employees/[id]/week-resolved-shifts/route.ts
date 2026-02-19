import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import { getCompanyBundle } from "@/src/services/company.service";
import { resolveShiftForDay } from "@/src/services/shiftPlan.service";
import { UserRole } from "@prisma/client";

function hhmmFromMinute(min: number): string {
  const m = Math.max(0, Math.floor(min));
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function shiftBadgeFromMinutes(startMinute: number, endMinute: number): string {
  return `${hhmmFromMinute(startMinute)}–${hhmmFromMinute(endMinute)}`;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const reqId = Math.random().toString(36).slice(2, 9);

  // ✅ Next 16: params is Promise
  const { id } = await ctx.params;
  const employeeId = String(id ?? "").trim();

  try {
    console.log(`[week-resolved-shifts:${reqId}] start`, {
      url: req.url,
      employeeId,
    });

    const session = await getSessionOrNull();
    console.log(`[week-resolved-shifts:${reqId}] session`, {
      ok: !!session,
      role: (session as any)?.role,
      userId: (session as any)?.userId,
    });

    if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (session.role !== UserRole.SYSTEM_ADMIN && session.role !== UserRole.HR_OPERATOR) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const url = new URL(req.url);
    const weekStart = String(url.searchParams.get("weekStart") ?? "").slice(0, 10);
    console.log(`[week-resolved-shifts:${reqId}] params`, { weekStart });

    if (!weekStart) return NextResponse.json({ error: "INVALID_WEEK" }, { status: 400 });

    console.log(`[week-resolved-shifts:${reqId}] getCompanyBundle...`);
    const bundle = await getCompanyBundle();
    const tz = String(bundle?.policy?.timezone ?? "Europe/Istanbul");
    console.log(`[week-resolved-shifts:${reqId}] bundle ok`, { tz });

    const days: any[] = [];
    for (let i = 0; i < 7; i++) {
      const dayKey = addDaysISO(weekStart, i);
      console.log(`[week-resolved-shifts:${reqId}] resolveShiftForDay...`, { i, dayKey });

      const r = await resolveShiftForDay(employeeId, dayKey);

      console.log(`[week-resolved-shifts:${reqId}] resolved`, {
        i,
        dayKey,
        has: !!r,
        source: (r as any)?.source,
        signature: (r as any)?.signature,
        startMinute: (r as any)?.startMinute,
        endMinute: (r as any)?.endMinute,
      });

      if (!r) {
        days.push({
          dayKey,
          shiftTimezone: tz,
          shiftSource: null,
          shiftSignature: null,
          shiftBadge: "—",
          shiftStartMinute: null,
          shiftEndMinute: null,
          shiftSpansMidnight: false,
        });
        continue;
      }

      const sig = String(r.signature ?? "").trim();
      const hasMinutes = typeof r.startMinute === "number" && typeof r.endMinute === "number";
      const badge =
        sig && sig !== "OFF"
          ? hasMinutes
            ? shiftBadgeFromMinutes(r.startMinute!, r.endMinute!)
            : sig || "—"
          : sig || "—";

      days.push({
        dayKey,
        shiftTimezone: tz,
        shiftSource: r.source ?? null,
        shiftSignature: sig || null,
        shiftBadge: badge,
        shiftStartMinute: r.startMinute ?? null,
        shiftEndMinute: r.endMinute ?? null,
        shiftSpansMidnight: !!r.spansMidnight,
      });
    }

    console.log(`[week-resolved-shifts:${reqId}] done`, {
      weekStart,
      weekEnd: addDaysISO(weekStart, 6),
    });

    return NextResponse.json({
      item: {
        weekStart,
        weekEnd: addDaysISO(weekStart, 6),
        days,
      },
    });
  } catch (e: any) {
    console.error(`[week-resolved-shifts:${reqId}] 500`, {
      url: req.url,
      employeeId,
      message: e?.message,
      stack: e?.stack,
    });

    return NextResponse.json(
      { error: "SERVER_ERROR", message: String(e?.message ?? "unknown") },
      { status: 500 },
    );
  }
}
