import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import { authErrorResponse } from "@/src/auth/http";
import { getEmployeeScopeWhereForSession } from "@/src/auth/scope";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { dayKeyToday, isISODate } from "@/src/utils/dayKey";
import { listEmployeesForLocationAssignment, type LocationAssignmentEmploymentStatus } from "@/src/services/employeeLocationAssignmentQuery.service";

export async function GET(req: NextRequest) {
  let session: { userId: string; role: any } | null = null;
  try {
    session = await requireRole(ROLE_SETS.READ_ALL);
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;
    throw err;
  }

  try {
    const url = new URL(req.url);
    const bundle = await getCompanyBundle();
    const companyId = await getActiveCompanyId();
    const scopeWhere = session ? await getEmployeeScopeWhereForSession(session) : null;

    const effectiveDayKeyRaw = String(url.searchParams.get("effectiveDayKey") ?? "").trim();
    const effectiveDayKey = isISODate(effectiveDayKeyRaw)
      ? effectiveDayKeyRaw
      : dayKeyToday(bundle.policy?.timezone || "Europe/Istanbul");

    const employmentStatusRaw = String(url.searchParams.get("employmentStatus") ?? "all").trim().toLowerCase();
    const employmentStatus: LocationAssignmentEmploymentStatus =
      employmentStatusRaw === "active" || employmentStatusRaw === "passive" ? employmentStatusRaw : "all";

    const data = await listEmployeesForLocationAssignment({
      companyId,
      effectiveDayKey,
      page: Number(url.searchParams.get("page") ?? "1"),
      pageSize: Number(url.searchParams.get("pageSize") ?? "50"),
      scopeWhere,
      filters: {
        q: url.searchParams.get("q") ?? "",
        branchId: url.searchParams.get("branchId"),
        groupId: url.searchParams.get("groupId"),
        subgroupId: url.searchParams.get("subgroupId"),
        employmentStatus,
      },
    });

    return NextResponse.json({
      ...data,
      effectiveDayKey,
    });
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;
    const message = err instanceof Error ? err.message : "server_error";
    const status = message === "TOO_MANY_EMPLOYEES" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}