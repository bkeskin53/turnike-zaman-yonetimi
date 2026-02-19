import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { createAssignment, listAssignments } from "@/src/services/workScheduleAssignment.service";

export async function GET() {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const data = await listAssignments();
    return NextResponse.json(data);
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = e instanceof Error ? e.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const body: any = await req.json().catch(() => ({}));
    const data = await createAssignment({
      scope: String(body?.scope ?? "") as any,
      patternId: String(body?.patternId ?? ""),
      employeeId: body?.employeeId ? String(body.employeeId) : null,
      employeeSubgroupId: body?.employeeSubgroupId ? String(body.employeeSubgroupId) : null,
      employeeGroupId: body?.employeeGroupId ? String(body.employeeGroupId) : null,
      branchId: body?.branchId ? String(body.branchId) : null,
      validFromDayKey: body?.validFromDayKey ? String(body.validFromDayKey) : null,
      validToDayKey: body?.validToDayKey ? String(body.validToDayKey) : null,
      priority: typeof body?.priority === "number" ? body.priority : undefined,
    });
    return NextResponse.json(data);
  } catch (e: any) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = typeof e?.message === "string" ? e.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}