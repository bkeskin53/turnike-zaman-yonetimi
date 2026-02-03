export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";

export async function GET(req: Request) {
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
}
