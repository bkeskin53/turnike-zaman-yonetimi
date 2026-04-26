import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { createPolicyRuleSetFromCompanyPolicy, listPolicyRuleSets } from "@/src/services/policyGroup.service";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import { getActiveCompanyId } from "@/src/services/company.service";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import { RecomputeReason } from "@prisma/client";

export async function GET() {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR", "SUPERVISOR"]);
    const data = await listPolicyRuleSets();
    return NextResponse.json(data);
  } catch (err) {
    return authErrorResponse(err) ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const body = await req.json().catch(() => null);

    const code = String(body?.code ?? "").trim();
    const name = String(body?.name ?? "").trim();
    if (!code) return NextResponse.json({ error: "CODE_REQUIRED" }, { status: 400 });
    if (!name) return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });

    const data = await createPolicyRuleSetFromCompanyPolicy({ code, name });

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.RULESET_UPDATED,
      targetType: AuditTargetType.RULESET,
      targetId: (data as any)?.item?.id ?? null,
      details: { op: "CREATE", ruleSetId: (data as any)?.item?.id ?? null },
    });

    // Recompute orchestration v1 (no guessing): new ruleset may affect evaluations => range unknown (null)
    const companyId = await getActiveCompanyId();
    await markRecomputeRequired({
      companyId,
      reason: RecomputeReason.RULESET_UPDATED,
      createdByUserId: session.userId,
      rangeStartDayKey: null,
      rangeEndDayKey: null,
    });

    return NextResponse.json(data);
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
