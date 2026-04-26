import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { clearEmployeeGroupPolicyAssignments, setEmployeeGroupPolicyAssignment } from "@/src/services/policyAssignment.service";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import { getActiveCompanyId } from "@/src/services/company.service";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import { RecomputeReason } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN","HR_CONFIG_ADMIN"]);
    const body = await req.json().catch(() => null);

    const employeeGroupId = String(body?.employeeGroupId ?? "").trim();
    if (!employeeGroupId) return NextResponse.json({ error: "GROUP_ID_REQUIRED" }, { status: 400 });

    if (body?.clear === true) {
      const data = await clearEmployeeGroupPolicyAssignments({ employeeGroupId });
      await writeAudit({
        req,
        actorUserId: session.userId,
        actorRole: session.role as unknown as UserRole,
        action: AuditAction.POLICY_ASSIGNMENT_UPDATED,
        targetType: AuditTargetType.POLICY_ASSIGNMENT,
        targetId: employeeGroupId,
        details: { op: "CLEAR", scope: "GROUP", employeeGroupId },
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

    const data = await setEmployeeGroupPolicyAssignment({
      employeeGroupId,
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
      targetId: employeeGroupId,
      details: {
        op: "ASSIGN",
        scope: "GROUP",
        employeeGroupId,
        ruleSetId,
        validFromDayKey,
        validToDayKey,
        priority: typeof priority === "number" ? priority : null,
      },
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