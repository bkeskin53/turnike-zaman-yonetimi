import { NextRequest, NextResponse } from "next/server";
import { IntegrationLogStatus } from "@prisma/client";
import { requireIntegrationApiKey } from "@/src/services/integrationAuth.service";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";

function clampInt(v: string | null, def: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  const i = Math.trunc(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

function parseStatus(v: string | null): IntegrationLogStatus | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s) return null;
  if (s === "SUCCESS") return IntegrationLogStatus.SUCCESS;
  if (s === "PARTIAL") return IntegrationLogStatus.PARTIAL;
  if (s === "FAILED") return IntegrationLogStatus.FAILED;
  return null;
}

export async function GET(req: NextRequest) {
  const auth = requireIntegrationApiKey(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.code, message: auth.message } },
      { status: auth.status }
    );
  }

  const companyId = await getActiveCompanyId();
  const { searchParams } = new URL(req.url);
  const limit = clampInt(searchParams.get("limit"), 50, 1, 200);
  const sourceSystem = String(searchParams.get("sourceSystem") ?? "").trim();
  const status = parseStatus(searchParams.get("status"));

  const items = await prisma.integrationLog.findMany({
    where: {
      companyId,
      ...(sourceSystem ? { sourceSystem } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { receivedAt: "desc" },
    take: limit,
    select: {
      requestId: true,
      endpoint: true,
      sourceSystem: true,
      batchRef: true,
      ip: true,
      receivedAt: true,
      processedAt: true,
      totalCount: true,
      createdCount: true,
      updatedCount: true,
      unchangedCount: true,
      failedCount: true,
      status: true,
    },
  });

  return NextResponse.json({ items });
}
