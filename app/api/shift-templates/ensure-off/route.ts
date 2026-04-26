import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { getActiveCompanyId } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType, UserRole, RecomputeReason } from "@prisma/client";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import {
  shiftTemplateAuditDetails,
  toShiftTemplateDto,
} from "@/src/services/shiftTemplateApiContract.service";

export async function POST(req: Request) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR"]);
    const companyId = await getActiveCompanyId();

    // Already exists? Accept both shiftCode=OFF and signature=OFF for compatibility.
    const existing = await prisma.shiftTemplate.findFirst({
      where: {
        companyId,
        OR: [
          { shiftCode: "OFF" },
          { signature: "OFF" },
        ],
      },
    });
    if (existing) return NextResponse.json({ item: toShiftTemplateDto(existing as any) });

    // Create OFF template
    const created = await prisma.shiftTemplate.create({
      data: {
        companyId,
        shiftCode: "OFF",
        signature: "OFF",
        startTime: "00:00",
        endTime: "00:00",
        spansMidnight: false,
        plannedWorkMinutes: 0,
        isActive: true,
      },
    });

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.SHIFT_TEMPLATE_UPDATED,
      targetType: AuditTargetType.SHIFT_TEMPLATE,
      targetId: created.id,
      details: shiftTemplateAuditDetails("ENSURE_OFF", created as any),
    });

    // Recompute orchestration v1: safest to flag unknown range
    await markRecomputeRequired({
      companyId,
      reason: RecomputeReason.SHIFT_TEMPLATE_UPDATED,
      createdByUserId: session.userId,
      rangeStartDayKey: null,
      rangeEndDayKey: null,
    });

    return NextResponse.json({ item: toShiftTemplateDto(created as any) });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    console.error("[shift-templates][ensure-off] POST unexpected error", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}