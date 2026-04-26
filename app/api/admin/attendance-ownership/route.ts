import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { getAttendanceOwnershipAuditForEmployeeDay } from "@/src/services/attendanceOwnershipAudit.service";

export async function GET(req: Request) {
  const auth = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR", "SUPERVISOR"]);
  if ("error" in auth) return authErrorResponse(auth);

  try {
    const url = new URL(req.url);
    const employeeId = url.searchParams.get("employeeId") ?? "";
    const dayKey = url.searchParams.get("dayKey") ?? "";

    const data = await getAttendanceOwnershipAuditForEmployeeDay({
      employeeId,
      dayKey,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "OWNERSHIP_AUDIT_FETCH_FAILED",
        message: error?.message ?? "UNKNOWN_ERROR",
      },
      { status: 400 }
    );
  }
}