import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { listEmployeesWithClassification, setEmployeeClassification } from "@/src/services/employeeClassification.service";

export async function GET() {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const data = await listEmployeesWithClassification();
    return NextResponse.json(data);
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const body = await req.json().catch(() => null);
    const employeeId = String(body?.employeeId ?? "").trim();
    if (!employeeId) return NextResponse.json({ error: "EMPLOYEE_ID_REQUIRED" }, { status: 400 });

    const employeeGroupId = body?.employeeGroupId === undefined ? undefined : body.employeeGroupId;
    const employeeSubgroupId = body?.employeeSubgroupId === undefined ? undefined : body.employeeSubgroupId;

    const data = await setEmployeeClassification({
      employeeId,
      employeeGroupId,
      employeeSubgroupId,
    });
    return NextResponse.json(data);
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}