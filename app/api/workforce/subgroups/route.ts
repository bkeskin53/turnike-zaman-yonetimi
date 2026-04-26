import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { createEmployeeSubgroup, listEmployeeSubgroups } from "@/src/services/employeeSubgroup.service";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";

export async function GET() {
  try {
    // Read-only master data: allow Supervisor to list subgroups
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR", "SUPERVISOR"]);
    const data = await listEmployeeSubgroups();
    return NextResponse.json(data);
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const body = await req.json().catch(() => null);
    const code = String(body?.code ?? "").trim();
    const name = String(body?.name ?? "").trim();
    const groupId = String(body?.groupId ?? "").trim();
    const data = await createEmployeeSubgroup({ code, name, groupId });

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.WORKFORCE_UPDATED,
      targetType: AuditTargetType.WORKFORCE,
      targetId: (data as any)?.item?.id ?? null,
      details: {
        op: "CREATE_SUBGROUP",
        employeeSubgroupId: (data as any)?.item?.id ?? null,
        employeeGroupId: groupId || null,
        changedKeys: ["code", "name", "groupId"],
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