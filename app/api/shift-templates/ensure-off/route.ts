import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { getActiveCompanyId } from "@/src/services/company.service";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType, UserRole, RecomputeReason } from "@prisma/client";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import { ensureOffShiftTemplateForCompany } from "@/src/services/shiftTemplate.service";
import {
  shiftTemplateAuditDetails,
  toShiftTemplateDto,
} from "@/src/services/shiftTemplateApiContract.service";

export async function POST(req: Request) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR"]);
    const companyId = await getActiveCompanyId();

    const result = await ensureOffShiftTemplateForCompany(companyId);

    if (result.action !== "unchanged" && result.item) {
      await writeAudit({
        req,
        actorUserId: session.userId,
        actorRole: session.role as unknown as UserRole,
        action: AuditAction.SHIFT_TEMPLATE_UPDATED,
        targetType: AuditTargetType.SHIFT_TEMPLATE,
        targetId: result.item.id,
        details: shiftTemplateAuditDetails(
          `ENSURE_OFF_${result.action.toUpperCase()}`,
          result.item as any
        ),
      });

      // Recompute orchestration v1: safest to flag unknown range
      await markRecomputeRequired({
        companyId,
        reason: RecomputeReason.SHIFT_TEMPLATE_UPDATED,
        createdByUserId: session.userId,
        rangeStartDayKey: null,
        rangeEndDayKey: null,
      });
    }

    return NextResponse.json({
      item: result.item ? toShiftTemplateDto(result.item as any) : null,
      ensured: result.action,
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    console.error("[shift-templates][ensure-off] POST unexpected error", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}