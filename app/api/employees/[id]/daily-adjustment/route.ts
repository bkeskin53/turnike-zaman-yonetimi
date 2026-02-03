import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import {
  getDailyAdjustmentForEmployeeOnDate,
  upsertDailyAdjustmentForEmployeeOnDate,
  deleteDailyAdjustmentForEmployeeOnDate,
} from "@/src/services/dailyAdjustment.service";

function requireAdminOrHr(role: string) {
  return role === "ADMIN" || role === "HR";
}

function parseDateParam(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }
  return date;
}

// GET /api/employees/[id]/daily-adjustment?date=YYYY-MM-DD
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!requireAdminOrHr(session.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const date = parseDateParam(req);
  if (!id) return NextResponse.json({ error: "BAD_ID" }, { status: 400 });
  if (!date) return NextResponse.json({ error: "INVALID_DATE" }, { status: 400 });

  const item = await getDailyAdjustmentForEmployeeOnDate(id, date);
  return NextResponse.json({ item: item ?? null });
}

// PUT /api/employees/[id]/daily-adjustment?date=YYYY-MM-DD
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!requireAdminOrHr(session.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const date = parseDateParam(req);
  if (!id) return NextResponse.json({ error: "BAD_ID" }, { status: 400 });
  if (!date) return NextResponse.json({ error: "INVALID_DATE" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const hasOverride =
    (body?.statusOverride != null && String(body.statusOverride).trim() !== "") ||
    (typeof body?.workedMinutesOverride === "number" &&
      !Number.isNaN(body.workedMinutesOverride)) ||
    (typeof body?.overtimeMinutesOverride === "number" &&
      !Number.isNaN(body.overtimeMinutesOverride)) ||
    (typeof body?.overtimeEarlyMinutesOverride === "number" &&
      !Number.isNaN(body.overtimeEarlyMinutesOverride)) ||
    (typeof body?.overtimeLateMinutesOverride === "number" &&
      !Number.isNaN(body.overtimeLateMinutesOverride)) ||
    (typeof body?.lateMinutesOverride === "number" &&
      !Number.isNaN(body.lateMinutesOverride)) ||
    (typeof body?.earlyLeaveMinutesOverride === "number" &&
      !Number.isNaN(body.earlyLeaveMinutesOverride));

  const noteEmpty = typeof body?.note !== "string" || body.note.trim() === "";

  const hasOtSplitOverride =
    (typeof body?.overtimeEarlyMinutesOverride === "number" &&
      !Number.isNaN(body.overtimeEarlyMinutesOverride)) ||
    (typeof body?.overtimeLateMinutesOverride === "number" &&
      !Number.isNaN(body.overtimeLateMinutesOverride));
  const hasOtTotalOverride =
    typeof body?.overtimeMinutesOverride === "number" &&
    !Number.isNaN(body.overtimeMinutesOverride);
  if (hasOtSplitOverride && hasOtTotalOverride) {
    return NextResponse.json({ error: "OT_OVERRIDE_CONFLICT" }, { status: 400 });
  }
  if (hasOverride && noteEmpty) {
    return NextResponse.json({ error: "NOTE_REQUIRED" }, { status: 400 });
  }
  const item = await upsertDailyAdjustmentForEmployeeOnDate(id, date, body);
  return NextResponse.json({ ok: true, item });
}

// DELETE /api/employees/[id]/daily-adjustment?date=YYYY-MM-DD
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!requireAdminOrHr(session.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const date = parseDateParam(req);
  if (!id) return NextResponse.json({ error: "BAD_ID" }, { status: 400 });
  if (!date) return NextResponse.json({ error: "INVALID_DATE" }, { status: 400 });

  await deleteDailyAdjustmentForEmployeeOnDate(id, date);
  return NextResponse.json({ ok: true });
}