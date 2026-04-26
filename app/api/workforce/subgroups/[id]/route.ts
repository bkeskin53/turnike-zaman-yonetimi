import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { deleteEmployeeSubgroup, updateEmployeeSubgroup } from "@/src/services/employeeSubgroup.service";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const { id } = await params;
    const body = await req.json().catch(() => null);

    const changedKeys = [
      ...(body?.code !== undefined ? ["code"] : []),
      ...(body?.name !== undefined ? ["name"] : []),
      ...(body?.groupId !== undefined ? ["groupId"] : []),
    ];

    const data = await updateEmployeeSubgroup({
      id,
      code: body?.code !== undefined ? String(body.code) : undefined,
      name: body?.name !== undefined ? String(body.name) : undefined,
      groupId: body?.groupId !== undefined ? String(body.groupId) : undefined,
    });

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.WORKFORCE_UPDATED,
      targetType: AuditTargetType.WORKFORCE,
      targetId: id,
      details: {
        op: "UPDATE_SUBGROUP",
        employeeSubgroupId: id,
        employeeGroupId: body?.groupId !== undefined ? String(body.groupId) : null,
        changedKeys,
      },
    });
    return NextResponse.json(data);
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const { id } = await params;
    const data = await deleteEmployeeSubgroup({ id });

    await writeAudit({
      req: undefined,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.WORKFORCE_UPDATED,
      targetType: AuditTargetType.WORKFORCE,
      targetId: id,
      details: {
        op: "DELETE_SUBGROUP",
        employeeSubgroupId: id,
      },
    });
    return NextResponse.json(data);
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}