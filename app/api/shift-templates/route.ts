import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { getActiveCompanyId } from "@/src/services/company.service";
import { listShiftTemplates, listAllShiftTemplates, createShiftTemplateForCompany } from "@/src/services/shiftTemplate.service";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import { RecomputeReason } from "@prisma/client";
import {
  isShiftTemplateMutationValidationError,
  shiftTemplateAuditDetails,
  toShiftTemplateDtos,
  toShiftTemplateDto,
  toShiftTemplateMutationInput,
} from "@/src/services/shiftTemplateApiContract.service";

export async function GET(req: NextRequest) {
   try {
     // Read-only master data: allow Supervisor to view shift templates
     await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR", "SUPERVISOR"]);
     const companyId = await getActiveCompanyId();
     const includeInactive =
       String(req.nextUrl.searchParams.get("includeInactive") ?? "").trim() === "1";

     const items = includeInactive
       ? await listAllShiftTemplates(companyId)
       : await listShiftTemplates(companyId);

     return NextResponse.json({ items: toShiftTemplateDtos(items as any[]) });
   } catch (e) {
     const auth = authErrorResponse(e);
     if (auth) return auth;
     console.error("[shift-templates] GET unexpected error", e);
     return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
   }
 }

export async function POST(req: Request) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const companyId = await getActiveCompanyId();
    const body: any = await req.json().catch(() => ({}));

    const created = await createShiftTemplateForCompany(companyId, toShiftTemplateMutationInput(body));

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.SHIFT_TEMPLATE_UPDATED,
      targetType: AuditTargetType.SHIFT_TEMPLATE,
      targetId: (created as any)?.id ?? null,
      details: shiftTemplateAuditDetails("CREATE", created as any),
    });

    // Recompute orchestration v1 (no guessing): template changes may affect evaluations => range unknown
    await markRecomputeRequired({
      companyId,
      reason: RecomputeReason.SHIFT_TEMPLATE_UPDATED,
      createdByUserId: session.userId,
      rangeStartDayKey: null,
      rangeEndDayKey: null,
    });
    return NextResponse.json({ item: toShiftTemplateDto(created as any) });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "";
    if (msg.includes("Unique constraint") || msg.includes("P2002")) {
      return NextResponse.json({ error: "SHIFT_TEMPLATE_ALREADY_EXISTS" }, { status: 409 });
    }
    if (isShiftTemplateMutationValidationError(e)) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const auth = authErrorResponse(e);
    if (auth) return auth;
    console.error("[shift-templates] POST unexpected error", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}