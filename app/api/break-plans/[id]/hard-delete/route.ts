import { NextResponse } from "next/server";
import { AuditAction, AuditTargetType, RecomputeReason, UserRole } from "@prisma/client";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { writeAudit } from "@/src/audit/writeAudit";
import { getActiveCompanyId } from "@/src/services/company.service";
import { hardDeleteBreakPlanForCompany } from "@/src/services/breakPlan.service";
import {
  breakPlanAuditDetails,
  isBreakPlanMutationValidationError,
  toBreakPlanDto,
} from "@/src/services/breakPlanApiContract.service";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";

function mapBreakPlanError(error: unknown) {
  const msg = error instanceof Error ? error.message : "";

  if (isBreakPlanMutationValidationError(error)) {
    return NextResponse.json({ error: msg }, { status: msg === "BREAK_PLAN_NOT_FOUND" ? 404 : 400 });
  }

  return null;
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const { id } = await ctx.params;
    const companyId = await getActiveCompanyId();

    const result = await hardDeleteBreakPlanForCompany(companyId, id);

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.BREAK_PLAN_UPDATED,
      targetType: AuditTargetType.BREAK_PLAN,
      targetId: id,
      details: breakPlanAuditDetails("HARD_DELETE", result.item as any, {
        linkedShiftTemplateCount: result.linkedShiftTemplateCount,
        consequence: "SHIFT_TEMPLATE_BREAK_PLAN_SET_NULL",
      }),
    });

    if (result.linkedShiftTemplateCount > 0) {
      await markRecomputeRequired({
        companyId,
        reason: RecomputeReason.SHIFT_TEMPLATE_UPDATED,
        createdByUserId: session.userId,
        rangeStartDayKey: null,
        rangeEndDayKey: null,
      });
    }

    return NextResponse.json({
      ok: true,
      item: toBreakPlanDto(result.item as any),
      linkedShiftTemplateCount: result.linkedShiftTemplateCount,
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const mapped = mapBreakPlanError(e);
    if (mapped) return mapped;
    console.error("[break-plans/[id]/hard-delete] DELETE unexpected error", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}