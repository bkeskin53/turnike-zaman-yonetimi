import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { deleteAssignment } from "@/src/services/workScheduleAssignment.service";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import { getActiveCompanyId } from "@/src/services/company.service";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import { RecomputeReason } from "@prisma/client";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const { id } = await params;
    const data = await deleteAssignment({ id });

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.WORK_SCHEDULE_UPDATED,
      targetType: AuditTargetType.WORK_SCHEDULE,
      targetId: id,
      details: { op: "UNASSIGN", assignmentId: id },
    });

    // Range unknown for delete (we don't know prior validity window here) => null/null
    const companyId = await getActiveCompanyId();
    await markRecomputeRequired({
      companyId,
      reason: RecomputeReason.WORK_SCHEDULE_UPDATED,
      createdByUserId: session.userId,
      rangeStartDayKey: null,
      rangeEndDayKey: null,
    });
    return NextResponse.json(data);
  } catch (e: any) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    const msg = typeof e?.message === "string" ? e.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}