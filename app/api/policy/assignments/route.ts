import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { clearEmployeePolicyAssignments, setEmployeePolicyAssignment } from "@/src/services/policyAssignment.service";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import { getActiveCompanyId } from "@/src/services/company.service";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import { RecomputeReason } from "@prisma/client";

export async function POST(req: Request) {
  try {
   const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const body = await req.json().catch(() => null);

    const employeeId = String(body?.employeeId ?? "").trim();
    if (!employeeId) return NextResponse.json({ error: "EMPLOYEE_ID_REQUIRED" }, { status: 400 });
    // clear mode
    if (body?.clear === true) {
      const data = await clearEmployeePolicyAssignments({ employeeId });

      await writeAudit({
        req,
        actorUserId: session.userId,
        actorRole: session.role as unknown as UserRole,
        action: AuditAction.POLICY_ASSIGNMENT_UPDATED,
        targetType: AuditTargetType.POLICY_ASSIGNMENT,
        targetId: employeeId,
        details: { op: "CLEAR", scope: "EMPLOYEE", employeeId },
      });

      const companyId = await getActiveCompanyId();
      await markRecomputeRequired({
        companyId,
        reason: RecomputeReason.POLICY_ASSIGNMENT_UPDATED,
        createdByUserId: session.userId,
        rangeStartDayKey: null,
        rangeEndDayKey: null,
      });
      return NextResponse.json(data);
    }

   const ruleSetId = String(body?.ruleSetId ?? "").trim();
    if (!ruleSetId) return NextResponse.json({ error: "RULESET_ID_REQUIRED" }, { status: 400 });

    const validFromDayKey = body?.validFromDayKey ? String(body.validFromDayKey) : null;
    const validToDayKey = body?.validToDayKey ? String(body.validToDayKey) : null;
    const priority = typeof body?.priority === "number" ? body.priority : undefined;

    const data = await setEmployeePolicyAssignment({
      employeeId,
      ruleSetId,
      validFromDayKey,
      validToDayKey,
      priority,
    });

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.POLICY_ASSIGNMENT_UPDATED,
      targetType: AuditTargetType.POLICY_ASSIGNMENT,
      targetId: employeeId,
      details: { op: "ASSIGN", scope: "EMPLOYEE", employeeId, ruleSetId, validFromDayKey, validToDayKey, priority: priority ?? null },
    });

    const companyId = await getActiveCompanyId();
    await markRecomputeRequired({
      companyId,
      reason: RecomputeReason.POLICY_ASSIGNMENT_UPDATED,
      createdByUserId: session.userId,
      rangeStartDayKey: validFromDayKey,
      rangeEndDayKey: validToDayKey,
    });
    return NextResponse.json(data);
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
