import { NextResponse } from "next/server";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { writeAudit } from "@/src/audit/writeAudit";
import { getActiveCompanyId } from "@/src/services/company.service";
import {
  deactivateBreakPlanForCompany,
  getBreakPlanById,
  updateBreakPlanForCompany,
} from "@/src/services/breakPlan.service";
import {
  breakPlanAuditDetails,
  isBreakPlanMutationValidationError,
  toBreakPlanDto,
  toBreakPlanMutationInput,
} from "@/src/services/breakPlanApiContract.service";

function mapBreakPlanError(error: unknown) {
  const msg = error instanceof Error ? error.message : "";

  if (msg.includes("Unique constraint") || msg.includes("P2002")) {
    return NextResponse.json({ error: "BREAK_PLAN_CODE_ALREADY_EXISTS" }, { status: 409 });
  }

  if (isBreakPlanMutationValidationError(error)) {
    return NextResponse.json({ error: msg }, { status: msg === "BREAK_PLAN_NOT_FOUND" ? 404 : 400 });
  }

  return null;
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const { id } = await ctx.params;
    const companyId = await getActiveCompanyId();
    const existing = await getBreakPlanById(companyId, id);

    if (!existing) {
      return NextResponse.json({ error: "BREAK_PLAN_NOT_FOUND" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const mutationInput = toBreakPlanMutationInput(body);
    const item = await updateBreakPlanForCompany(companyId, id, mutationInput);

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.BREAK_PLAN_UPDATED,
      targetType: AuditTargetType.BREAK_PLAN,
      targetId: id,
      details: breakPlanAuditDetails("UPDATE", item as any, {
        previous: breakPlanAuditDetails("PREVIOUS", existing as any),
        changedKeys: body && typeof body === "object" ? Object.keys(body) : [],
      }),
    });

    return NextResponse.json({ item: toBreakPlanDto(item as any) });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const mapped = mapBreakPlanError(e);
    if (mapped) return mapped;
    console.error("[break-plans/[id]] PUT unexpected error", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const { id } = await ctx.params;
    const companyId = await getActiveCompanyId();
    const existing = await getBreakPlanById(companyId, id);

    if (!existing) {
      return NextResponse.json({ error: "BREAK_PLAN_NOT_FOUND" }, { status: 404 });
    }

    const item = await deactivateBreakPlanForCompany(companyId, id);

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.BREAK_PLAN_UPDATED,
      targetType: AuditTargetType.BREAK_PLAN,
      targetId: id,
      details: breakPlanAuditDetails("DEACTIVATE", item as any),
    });

    return NextResponse.json({ ok: true, item: toBreakPlanDto(item as any) });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const mapped = mapBreakPlanError(e);
    if (mapped) return mapped;
    console.error("[break-plans/[id]] DELETE unexpected error", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}