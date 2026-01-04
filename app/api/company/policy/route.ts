import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { updateCompanyPolicy } from "@/src/services/company.service";

function toBool(v: unknown) {
  if (v === true || v === false) return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

export async function PUT(req: Request) {
  try {
    await requireRole(["ADMIN", "HR"]);
    const body = await req.json().catch(() => null);

    const off = body?.offDayEntryBehavior;
    const offDayEntryBehavior =
      off === "IGNORE" || off === "FLAG" || off === "COUNT_AS_OT" ? off : undefined;

    const payload = {
      timezone: body?.timezone !== undefined ? String(body.timezone) : undefined,
      shiftStartMinute: body?.shiftStartMinute !== undefined ? Number(body.shiftStartMinute) : undefined,
      shiftEndMinute: body?.shiftEndMinute !== undefined ? Number(body.shiftEndMinute) : undefined,
      breakMinutes: body?.breakMinutes !== undefined ? Number(body.breakMinutes) : undefined,
      lateGraceMinutes: body?.lateGraceMinutes !== undefined ? Number(body.lateGraceMinutes) : undefined,
      earlyLeaveGraceMinutes:
        body?.earlyLeaveGraceMinutes !== undefined ? Number(body.earlyLeaveGraceMinutes) : undefined,

      breakAutoDeductEnabled: toBool(body?.breakAutoDeductEnabled),
      offDayEntryBehavior,
      overtimeEnabled: toBool(body?.overtimeEnabled),
    };

    const data = await updateCompanyPolicy(payload);
    return NextResponse.json(data);
  } catch (err) {
    return authErrorResponse(err) ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
