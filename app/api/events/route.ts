import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { addManualEvent, getEvents } from "@/src/services/rawEvent.service";
import { getEmployeeScopeWhereForSession } from "@/src/auth/scope";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";

export async function GET(req: Request) {
  try {
    // Read-only events: Supervisor can view IN/OUT movements
    const session = await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR", "SUPERVISOR"]);
    const employeeWhere = await getEmployeeScopeWhereForSession(session);

    const url = new URL(req.url);
    const employeeId = url.searchParams.get("employeeId") ?? undefined;
    const date = url.searchParams.get("date") ?? undefined;

    const doorId = url.searchParams.get("doorId") ?? undefined;
    const deviceId = url.searchParams.get("deviceId") ?? undefined;

    const data = await getEvents({ employeeId, date, doorId, deviceId, employeeWhere });
    return NextResponse.json(data);
  } catch (err) {
    return authErrorResponse(err) ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);
    const body = await req.json().catch(() => null);

    const created = await addManualEvent({
      employeeId: body?.employeeId,
      occurredAt: body?.occurredAt,
      direction: body?.direction,
      doorId: body?.doorId ?? null,
      deviceId: body?.deviceId ?? null,
    });

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.MANUAL_EVENT,
      targetType: AuditTargetType.EVENT,
      targetId: created?.id ?? null,
      details: {
        employeeId: body?.employeeId ?? null,
        occurredAt: body?.occurredAt ?? null,
        direction: body?.direction ?? null,
        doorId: body?.doorId ?? null,
        deviceId: body?.deviceId ?? null,
      },
    });

    return NextResponse.json({ item: created }, { status: 201 });
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;

    if (err instanceof Error && err.message === "VALIDATION_ERROR") {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }
    if (err instanceof Error) {
      if (err.message === "EMPLOYEE_NOT_FOUND") {
        return NextResponse.json({ error: "employee_not_found" }, { status: 404 });
      }
      if (err.message === "EMPLOYEE_NOT_EMPLOYED_ON_DATE") {
        const dayKey = (err as any)?.meta?.dayKey ?? null;
        return NextResponse.json({ error: "EMPLOYEE_NOT_EMPLOYED_ON_DATE", dayKey }, { status: 400 });
      }
      if (err.message === "DOOR_NOT_FOUND") {
        return NextResponse.json({ error: "door_not_found" }, { status: 404 });
      }
      if (err.message === "DEVICE_NOT_FOUND") {
        return NextResponse.json({ error: "device_not_found" }, { status: 404 });
      }
      if (err.message === "AUTO_DIRECTION_NEEDS_DOOR") {
        return NextResponse.json({ error: "auto_direction_needs_door" }, { status: 400 });
      }
      if (err.message === "NO_DEFAULT_DIRECTION") {
        return NextResponse.json({ error: "no_default_direction" }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
