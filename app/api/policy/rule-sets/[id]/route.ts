import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { getPolicyRuleSetById, updatePolicyRuleSet } from "@/src/services/policyGroup.service";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import { getActiveCompanyId } from "@/src/services/company.service";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import { RecomputeReason } from "@prisma/client";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR", "SUPERVISOR"]);
    const { id } = await ctx.params;
    const data = await getPolicyRuleSetById(id);
    return NextResponse.json(data);
  } catch (err) {
    return authErrorResponse(err) ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const data = await updatePolicyRuleSet(id, body ?? {}, { allowDefault: true });

    const changedKeys = body && typeof body === "object" ? Object.keys(body) : [];
    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.RULESET_UPDATED,
      targetType: AuditTargetType.RULESET,
      targetId: id,
      details: { op: "UPDATE", ruleSetId: id, changedKeys },
    });

    // Recompute orchestration v1 (no guessing): ruleset changes can affect any day => range unknown (null)
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
    // 🔎 Teşhis için server console'a bas
    console.error("[policy/rule-sets PATCH] error:", err);
    const auth = authErrorResponse(err);
    if (auth) return auth;
    const msg = err instanceof Error ? err.message : "server_error";
    if (msg === "DEFAULT_READONLY") {
      return NextResponse.json({ error: "DEFAULT_READONLY" }, { status: 400 });
    }
    if (msg === "RULESET_NOT_FOUND" || msg === "RULESET_ID_REQUIRED") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    // Prisma / validation gibi durumlar için (message bazlı kaba ayrım)
    // Not: PrismaClientKnownRequestError vs import etmeden de en azından 400'e düşürelim.
    if (
      msg.includes("Prisma") ||
      msg.includes("Invalid") ||
      msg.includes("Validation") ||
      msg.includes("Unknown argument") ||
      msg.includes("Expected")
    ) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
