import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";
import { authErrorResponse } from "@/src/utils/api";

export const runtime = "nodejs";
/**
 * API endpoint to provide a live feed of recent raw events.  It returns
 * the latest 10 events for the active company with associated employee,
 * door and device information.  Intended to be polled by a client-side
 * component for near real-time updates.
 */
export async function GET(req: Request) {
  try {
    // Read-only dashboard feed (must be authenticated)
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR", "SUPERVISOR"]);

    const companyId = await getActiveCompanyId();
    const events = await prisma.rawEvent.findMany({
      where: { companyId },
      orderBy: { occurredAt: "desc" },
      take: 10,
      select: {
        id: true,
        occurredAt: true,
        direction: true,
        source: true,
        employee: { select: { employeeCode: true, firstName: true, lastName: true } },
        door: { select: { code: true, name: true } },
        device: { select: { name: true } },
      },
    });
    return NextResponse.json({ ok: true, events });
  } catch (err) {
    return authErrorResponse(err);
  }
}