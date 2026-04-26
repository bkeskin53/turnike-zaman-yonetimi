import { NextResponse } from "next/server";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { getActiveCompanyId } from "@/src/services/company.service";
import { backfillEmployeeHistoryForCompany } from "@/src/services/employeeHistory.service";
import { writeAudit } from "@/src/audit/writeAudit";

export async function POST(req: Request) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const companyId = await getActiveCompanyId();
    const result = await backfillEmployeeHistoryForCompany({ companyId });

    if (result.createdProfileVersionCount > 0 || result.createdOrgAssignmentCount > 0) {
      await writeAudit({
        req,
        actorUserId: session.userId,
        actorRole: session.role as UserRole,
        action: AuditAction.WORKFORCE_UPDATED,
        targetType: AuditTargetType.WORKFORCE,
        targetId: null,
        details: {
          op: "EMPLOYEE_HISTORY_BACKFILL",
          employeeCount: result.employeeCount,
          createdProfileVersionCount: result.createdProfileVersionCount,
          createdOrgAssignmentCount: result.createdOrgAssignmentCount,
        },
      });
    }

    return NextResponse.json({ item: result });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = e instanceof Error ? e.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}