export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";
import { authErrorResponse } from "@/src/utils/api";

export async function GET(req: Request) {
  try {
    // OPS: device inbox is operational
    await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);

    const companyId = await getActiveCompanyId();
    const url = new URL(req.url);

    const status = (url.searchParams.get("status") ?? "PENDING").toUpperCase();
    const take = Math.max(1, Math.min(200, Number(url.searchParams.get("take") ?? "50") || 50));

    const rows = await prisma.deviceInboxEvent.findMany({
      where: {
        companyId,
        status: status as any, // PENDING | RESOLVED | IGNORED
      },
      orderBy: [{ occurredAt: "desc" }],
      take,
      select: {
        id: true,
        occurredAt: true,
        direction: true,
        status: true,
        externalRef: true,
        cardNo: true,
        deviceUserId: true,
        device: { select: { id: true, name: true } },
        door: { select: { id: true, code: true, name: true } },
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, rows });
  } catch (err) {
    return authErrorResponse(err);
  }
}