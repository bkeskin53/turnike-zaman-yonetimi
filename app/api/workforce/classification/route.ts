import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { listEmployeesWithClassification, setEmployeeClassification } from "@/src/services/employeeClassification.service";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import { getEmployeeScopeWhereForSession } from "@/src/auth/scope";
import { getActiveCompanyId } from "@/src/services/company.service";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import { RecomputeReason } from "@prisma/client";

export async function GET(req: Request) {
   try {
    const s = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR", "SUPERVISOR"]);
    const url = new URL(req.url);

    const scopeWhere = await getEmployeeScopeWhereForSession(s);
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "50");
    const assignmentStatusParam = String(url.searchParams.get("assignmentStatus") ?? "all");
    const assignmentStatus =
      assignmentStatusParam === "assigned" || assignmentStatusParam === "unassigned" ? assignmentStatusParam : "all";

    const data = await listEmployeesWithClassification({
      q: url.searchParams.get("q") ?? "",
      branchId: url.searchParams.get("branchId"),
      groupId: url.searchParams.get("groupId"),
      subgroupId: url.searchParams.get("subgroupId"),
      assignmentStatus,
      page,
      pageSize,
      scopeWhere,
     });
 
    return NextResponse.json(data);
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
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

    if (data.changed) {
      const companyId = await getActiveCompanyId();
      await markRecomputeRequired({
        companyId,
        reason: RecomputeReason.WORKFORCE_UPDATED,
        createdByUserId: session.userId,
        rangeStartDayKey: null,
        rangeEndDayKey: null,
      });
    }

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.WORKFORCE_UPDATED,
      targetType: AuditTargetType.WORKFORCE,
      targetId: data.item.id,
      details: {
        op: "CLASSIFICATION_SET",
        employeeId: data.item.id,
        employeeCode: data.item.employeeCode,
        changed: data.changed,
        before: {
          employeeGroupId: data.before.employeeGroupId ?? null,
          employeeSubgroupId: data.before.employeeSubgroupId ?? null,
        },
        after: {
          employeeGroupId: data.item.employeeGroupId ?? null,
          employeeSubgroupId: data.item.employeeSubgroupId ?? null,
        },
      },
    });
    return NextResponse.json(data);
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}