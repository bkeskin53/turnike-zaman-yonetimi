import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { getActiveCompanyId } from "@/src/services/company.service";
import { updateShiftTemplateForCompany, deactivateShiftTemplateForCompany } from "@/src/services/shiftTemplate.service";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType, UserRole, RecomputeReason } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import {
  isShiftTemplateMutationValidationError,
  shiftTemplateAuditDetails,
  toShiftTemplateDto,
  toShiftTemplateMutationInput,
} from "@/src/services/shiftTemplateApiContract.service";

function isOffTemplateEntity(t: { shiftCode?: string | null; signature?: string | null } | null | undefined) {
  if (!t) return false;
  const code = String(t.shiftCode ?? "").trim().toUpperCase();
  const sig = String(t.signature ?? "").trim().toUpperCase();
  return code === "OFF" || sig === "OFF";
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
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
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "SHIFT_TEMPLATE_NOT_FOUND" }, { status: 404 });
    }
    if (isOffTemplateEntity(existing)) {
      return NextResponse.json({ error: "OFF_TEMPLATE_IMMUTABLE" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const mutationInput = toShiftTemplateMutationInput(body);
    const item = await updateShiftTemplateForCompany(companyId, id, mutationInput);

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.SHIFT_TEMPLATE_UPDATED,
      targetType: AuditTargetType.SHIFT_TEMPLATE,
      targetId: id,
      details: shiftTemplateAuditDetails("UPDATE", item as any, {
        previous: shiftTemplateAuditDetails("PREVIOUS", existing as any),
        changedKeys: [
          "plannedWorkMinutes",
          "startTime",
          "endTime",
          "signature",
          "spansMidnight",
          ...(mutationInput.shiftCode !== undefined ? ["shiftCode"] : []),
        ],
      }),
    });

    await markRecomputeRequired({
      companyId,
      reason: RecomputeReason.SHIFT_TEMPLATE_UPDATED,
      createdByUserId: session.userId,
      rangeStartDayKey: null,
      rangeEndDayKey: null,
    });

    return NextResponse.json({ item: toShiftTemplateDto(item as any) });
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
    console.error("[shift-templates/[id]] PUT unexpected error", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
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
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "SHIFT_TEMPLATE_NOT_FOUND" }, { status: 404 });
    }
    if (isOffTemplateEntity(existing)) {
      return NextResponse.json({ error: "OFF_TEMPLATE_IMMUTABLE" }, { status: 400 });
    }

    await deactivateShiftTemplateForCompany(companyId, id);

    await writeAudit({
      req: undefined,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.SHIFT_TEMPLATE_UPDATED,
      targetType: AuditTargetType.SHIFT_TEMPLATE,
      targetId: id,
      details: shiftTemplateAuditDetails("DEACTIVATE", existing as any),
    });

    await markRecomputeRequired({
      companyId,
      reason: RecomputeReason.SHIFT_TEMPLATE_UPDATED,
      createdByUserId: session.userId,
      rangeStartDayKey: null,
      rangeEndDayKey: null,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    console.error("[shift-templates/[id]] DELETE unexpected error", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}