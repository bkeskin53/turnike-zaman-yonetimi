import { NextResponse } from "next/server";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { writeAudit } from "@/src/audit/writeAudit";
import { getActiveCompanyId } from "@/src/services/company.service";
import {
  activateBreakPlanForCompany,
  getBreakPlanById,
} from "@/src/services/breakPlan.service";
import {
  breakPlanAuditDetails,
  toBreakPlanDto,
} from "@/src/services/breakPlanApiContract.service";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const { id } = await ctx.params;
    const companyId = await getActiveCompanyId();
    const existing = await getBreakPlanById(companyId, id);

    if (!existing) {
      return NextResponse.json({ error: "BREAK_PLAN_NOT_FOUND" }, { status: 404 });
    }

    if (existing.isActive) {
      return NextResponse.json({ ok: true, item: toBreakPlanDto(existing as any), skipped: true });
    }

    const item = await activateBreakPlanForCompany(companyId, id);

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.BREAK_PLAN_UPDATED,
      targetType: AuditTargetType.BREAK_PLAN,
      targetId: id,
      details: breakPlanAuditDetails("ACTIVATE", item as any),
    });

    return NextResponse.json({ ok: true, item: toBreakPlanDto(item as any) });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    console.error("[break-plans/[id]/activate] POST unexpected error", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}