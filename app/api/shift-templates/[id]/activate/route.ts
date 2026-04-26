import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { getActiveCompanyId } from "@/src/services/company.service";
import { activateShiftTemplateForCompany } from "@/src/services/shiftTemplate.service";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType, UserRole, RecomputeReason } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import {
  shiftTemplateAuditDetails,
  toShiftTemplateDto,
} from "@/src/services/shiftTemplateApiContract.service";

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const { id } = await ctx.params;
    const companyId = await getActiveCompanyId();
    const existing = await prisma.shiftTemplate.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        shiftCode: true,
        signature: true,
        startTime: true,
        endTime: true,
        spansMidnight: true,
        plannedWorkMinutes: true,
        breakPlanId: true,
        breakPlan: true,
        isActive: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "SHIFT_TEMPLATE_NOT_FOUND" }, { status: 404 });
    }

    if (existing.isActive) {
      return NextResponse.json({ ok: true, item: toShiftTemplateDto(existing as any), skipped: true });
    }

    await activateShiftTemplateForCompany(companyId, id);
    const item = await prisma.shiftTemplate.findFirst({ where: { id, companyId } });

    await writeAudit({
      req: undefined,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.SHIFT_TEMPLATE_UPDATED,
      targetType: AuditTargetType.SHIFT_TEMPLATE,
      targetId: id,
      details: shiftTemplateAuditDetails("ACTIVATE", item as any),
    });

    await markRecomputeRequired({
      companyId,
      reason: RecomputeReason.SHIFT_TEMPLATE_UPDATED,
      createdByUserId: session.userId,
      rangeStartDayKey: null,
      rangeEndDayKey: null,
    });

    return NextResponse.json({ ok: true, item: item ? toShiftTemplateDto(item as any) : null });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    console.error("[shift-templates/[id]/activate] POST unexpected error", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
