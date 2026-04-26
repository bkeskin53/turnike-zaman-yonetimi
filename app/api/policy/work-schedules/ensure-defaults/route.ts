import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { ensureDefaultWorkSchedulesForActiveCompany } from "@/src/services/defaultWorkScheduleBootstrap.service";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR"]);
    const data = await ensureDefaultWorkSchedulesForActiveCompany();

    const createdPatternCodes = Array.isArray(data?.item?.createdPatternCodes)
      ? data.item.createdPatternCodes
      : [];

    if (createdPatternCodes.length > 0) {
      await writeAudit({
        req,
        actorUserId: session.userId,
        actorRole: session.role as unknown as UserRole,
        action: AuditAction.WORK_SCHEDULE_UPDATED,
        targetType: AuditTargetType.WORK_SCHEDULE,
        targetId: null,
        details: {
          op: "ENSURE_DEFAULTS",
          createdPatternCodes,
          policyFallbackWindow: data?.item?.policyFallbackWindow ?? null,
        },
      });
    }

    return NextResponse.json(data);
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = e instanceof Error ? e.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}