import { NextRequest, NextResponse } from "next/server";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { writeAudit } from "@/src/audit/writeAudit";
import { getActiveCompanyId } from "@/src/services/company.service";
import {
  createBreakPlanForCompany,
  listAllBreakPlansForCompany,
  listBreakPlansForCompany,
} from "@/src/services/breakPlan.service";
import {
  breakPlanAuditDetails,
  isBreakPlanMutationValidationError,
  toBreakPlanDto,
  toBreakPlanDtos,
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

export async function GET(req: NextRequest) {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR", "SUPERVISOR"]);
    const companyId = await getActiveCompanyId();
    const includeInactive =
      String(req.nextUrl.searchParams.get("includeInactive") ?? "").trim() === "1";

    const items = includeInactive
      ? await listAllBreakPlansForCompany(companyId)
      : await listBreakPlansForCompany(companyId);

    return NextResponse.json({ items: toBreakPlanDtos(items as any[]) });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    console.error("[break-plans] GET unexpected error", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const companyId = await getActiveCompanyId();
    const body: any = await req.json().catch(() => ({}));
    const created = await createBreakPlanForCompany(companyId, toBreakPlanMutationInput(body));

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.BREAK_PLAN_UPDATED,
      targetType: AuditTargetType.BREAK_PLAN,
      targetId: (created as any)?.id ?? null,
      details: breakPlanAuditDetails("CREATE", created as any),
    });

    return NextResponse.json({ item: toBreakPlanDto(created as any) });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const mapped = mapBreakPlanError(e);
    if (mapped) return mapped;
    console.error("[break-plans] POST unexpected error", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}