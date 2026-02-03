import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";
import { addManualEvent } from "@/src/services/rawEvent.service";

export async function POST(req: Request) {
  try {
    // For now, reuse existing authorization model.
    // Later we can introduce a dedicated KIOSK role without changing kiosk UX.
    await requireRole(["ADMIN", "HR"]);

    const companyId = await getActiveCompanyId();
    const body = await req.json().catch(() => null);

    const code = String(body?.code ?? "").trim();
    const requestedDirection = body?.direction === "OUT" ? "OUT" : "IN";
    const doorId = body?.doorId ? String(body.doorId) : null;

    if (!code) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    // Door guards (server-side). UI is not trusted.
    // - If door is provided, it must exist and be usable for timekeeping.
    // - If defaultDirection exists, it overrides the requested direction.
    let resolvedDirection: "IN" | "OUT" = requestedDirection;
    if (doorId) {
      const door = await prisma.door.findFirst({
        where: { companyId, id: doorId },
        select: { id: true, isActive: true, role: true, defaultDirection: true },
      });

      if (!door) {
        return NextResponse.json({ error: "door_not_found" }, { status: 404 });
      }
      if (!door.isActive) {
        return NextResponse.json({ error: "door_inactive" }, { status: 409 });
      }
      if (door.role === "ACCESS_ONLY") {
        return NextResponse.json({ error: "door_access_only" }, { status: 403 });
      }

      const dd = String(door.defaultDirection ?? "").toUpperCase();
      if (dd === "IN" || dd === "OUT") {
        resolvedDirection = dd as "IN" | "OUT";
      }
    }

    const emp = await prisma.employee.findFirst({
      where: {
        companyId,
        isActive: true,
        OR: [{ employeeCode: code }, { cardNo: code }],
      },
      select: { id: true, employeeCode: true, firstName: true, lastName: true },
    });

    if (!emp) {
      return NextResponse.json({ error: "employee_not_found" }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const created = await addManualEvent({
      employeeId: emp.id,
      occurredAt: nowIso,
      direction: resolvedDirection,
      doorId,
      deviceId: null,
    });

    const fullName = `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim();
    return NextResponse.json(
      {
        ok: true,
        item: {
          rawEventId: created.id,
          at: nowIso,
          direction: resolvedDirection,
          employeeCode: emp.employeeCode,
          fullName,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth) return auth;
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}