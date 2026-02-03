import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { addManualEvent, getEvents } from "@/src/services/rawEvent.service";

export async function GET(req: Request) {
  try {
    await requireRole(["ADMIN", "HR"]);

    const url = new URL(req.url);
    const employeeId = url.searchParams.get("employeeId") ?? undefined;
    const date = url.searchParams.get("date") ?? undefined;

    const doorId = url.searchParams.get("doorId") ?? undefined;
    const deviceId = url.searchParams.get("deviceId") ?? undefined;

    const data = await getEvents({ employeeId, date, doorId, deviceId });
    return NextResponse.json(data);
  } catch (err) {
    return authErrorResponse(err) ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireRole(["ADMIN", "HR"]);
    const body = await req.json().catch(() => null);

    const created = await addManualEvent({
      employeeId: body?.employeeId,
      occurredAt: body?.occurredAt,
      direction: body?.direction,
      doorId: body?.doorId ?? null,
      deviceId: body?.deviceId ?? null,
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
