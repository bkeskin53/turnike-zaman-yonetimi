export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";

/**
 * API endpoint to provide a live feed of recent raw events.  It returns
 * the latest 10 events for the active company with associated employee,
 * door and device information.  Intended to be polled by a client-side
 * component for near real-time updates.
 */
export async function GET(req: Request) {
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
}
