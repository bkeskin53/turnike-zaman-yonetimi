import { NextResponse } from "next/server";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";

export async function GET() {
  const companyId = await getActiveCompanyId();
  const rows = await prisma.device.findMany({
    where: { companyId },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      branchId: true,
      name: true,
      ip: true,
      port: true,
      driver: true,
      doorId: true,
      isActive: true,
      lastSeenAt: true,
      lastSyncAt: true,
      lastErrorAt: true,
      lastErrorMessage: true,
    },
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const companyId = await getActiveCompanyId();
  const body = await req.json();

  const branchId = String(body.branchId ?? "").trim();
  const name = String(body.name ?? "").trim();
  const ip = body.ip ? String(body.ip).trim() : null;
  const port = body.port ? Number(body.port) : 4370;
  const driver = String(body.driver ?? "ZKTECO_PULL").trim();

  if (!branchId || !name) {
    return NextResponse.json({ error: "branchId ve name zorunlu" }, { status: 400 });
  }

  const allowed = new Set(["ZKTECO_PULL", "ZKTECO_PUSH", "GENERIC"]);
  const safeDriver = allowed.has(driver) ? driver : "ZKTECO_PULL";

  const created = await prisma.device.create({
    data: {
      companyId,
      branchId,
      name,
      ip,
      port,
      driver: safeDriver as any,
      isActive: true,
    },
    select: {
      id: true,
      branchId: true,
      name: true,
      ip: true,
      port: true,
      driver: true,
      doorId: true,
      isActive: true,
    },
  });

  return NextResponse.json(created);
}
