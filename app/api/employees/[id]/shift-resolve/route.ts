import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import { getCompanyBundle } from "@/src/services/company.service";
import { isISODate } from "@/src/utils/dayKey";
import { resolveShiftForDay } from "@/src/services/shiftPlan.service";

function hhmmFromMinute(min: number): string {
  const m = Math.max(0, Math.floor(min));
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function badgeFromMinutes(startMinute: number | null | undefined, endMinute: number | null | undefined): string {
  if (typeof startMinute === "number" && typeof endMinute === "number") {
    return `${hhmmFromMinute(startMinute)}–${hhmmFromMinute(endMinute)}`;
  }
  return "—";
}

// UI-only: resolve shift minutes for a given employee+date WITHOUT persisting daily rows.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await ctx.params; // ✅ Next.js 16: params is Promise
  const employeeId = String(id ?? "").trim();

  const { searchParams } = new URL(req.url);
  const date = String(searchParams.get("date") ?? "").trim();

  if (!employeeId) return NextResponse.json({ error: "INVALID_EMPLOYEE" }, { status: 400 });
  if (!date || !isISODate(date)) return NextResponse.json({ error: "INVALID_DATE" }, { status: 400 });

  // Ensure tenant/policy context is loaded
  await getCompanyBundle();

  const r = await resolveShiftForDay(employeeId, date);
  if (!r) {
    return NextResponse.json({
      item: {
        date,
        isOffDay: false,
        source: null,
        startMinute: null,
        endMinute: null,
        signature: null,
        spansMidnight: false,
        shiftBadge: "—",
      },
    });
  }

  return NextResponse.json({
    item: {
      date,
      isOffDay: !!r.isOffDay,
      source: r.source ?? null,
      startMinute: r.startMinute ?? null,
      endMinute: r.endMinute ?? null,
      signature: r.signature ?? null,
      spansMidnight: !!r.spansMidnight,
      shiftBadge: r.isOffDay ? "OFF" : badgeFromMinutes(r.startMinute, r.endMinute),
    },
  });
}
