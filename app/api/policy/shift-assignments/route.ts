import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import {
  createShiftPolicyAssignment,
  deleteShiftPolicyAssignment,
  listShiftPolicyAssignments,
} from "@/src/services/shiftPolicyAssignment.service";

export async function GET(req: NextRequest) {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const shiftCode = req.nextUrl.searchParams.get("shiftCode");
    const scope = req.nextUrl.searchParams.get("scope");
    const items = await listShiftPolicyAssignments({
      shiftCode: shiftCode ? String(shiftCode) : null,
      scope: scope ? (String(scope) as any) : null,
    });
    return NextResponse.json({ items });
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

    const scope = String(body?.scope ?? "").trim();
    const shiftCode = String(body?.shiftCode ?? "").trim();
    const ruleSetId = String(body?.ruleSetId ?? "").trim();

    const employeeId = body?.employeeId ? String(body.employeeId) : null;
    const employeeSubgroupId = body?.employeeSubgroupId ? String(body.employeeSubgroupId) : null;
    const employeeGroupId = body?.employeeGroupId ? String(body.employeeGroupId) : null;
    const branchId = body?.branchId ? String(body.branchId) : null;

    const validFromDayKey = body?.validFromDayKey ? String(body.validFromDayKey) : null;
    const validToDayKey = body?.validToDayKey ? String(body.validToDayKey) : null;
    const priority = typeof body?.priority === "number" ? body.priority : undefined;

    const data = await createShiftPolicyAssignment({
      scope: scope as any,
      shiftCode,
      ruleSetId,
      employeeId,
      employeeSubgroupId,
      employeeGroupId,
      branchId,
      validFromDayKey,
      validToDayKey,
      priority,
    });

    return NextResponse.json(data);
  } catch (e: any) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = typeof e?.message === "string" ? e.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const body: any = await req.json().catch(() => ({}));
    const id = String(body?.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "ID_REQUIRED" }, { status: 400 });
    const data = await deleteShiftPolicyAssignment({ id });
    return NextResponse.json(data);
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = e instanceof Error ? e.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}