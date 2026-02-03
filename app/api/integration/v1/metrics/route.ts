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

type Rollup = {
  key: string;
  requests: number;
  success: number;
  partial: number;
  failed: number;
};

function addStatus(r: Rollup, status: IntegrationLogStatus, count: number) {
  r.requests += count;
  if (status === IntegrationLogStatus.SUCCESS) r.success += count;
  else if (status === IntegrationLogStatus.PARTIAL) r.partial += count;
  else r.failed += count;
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

  const hours = clampInt(searchParams.get("hours"), 24, 1, 168);
  const limit = clampInt(searchParams.get("limit"), 20, 1, 100);

  const until = new Date();
  const since = new Date(until.getTime() - hours * 60 * 60 * 1000);

  // Totals by status (fast group)
  const statusGroups = await prisma.integrationLog.groupBy({
    by: ["status"],
    where: { companyId, receivedAt: { gte: since, lte: until } },
    _count: { _all: true },
  });

  const totals = { requests: 0, success: 0, partial: 0, failed: 0 };
 for (const g of statusGroups) {
    const c = g._count._all;
    totals.requests += c;
    if (g.status === IntegrationLogStatus.SUCCESS) totals.success += c;
    else if (g.status === IntegrationLogStatus.PARTIAL) totals.partial += c;
    else totals.failed += c;
  }

  // By endpoint (endpoint + status)
  const endpointGroups = await prisma.integrationLog.groupBy({
    by: ["endpoint", "status"],
    where: { companyId, receivedAt: { gte: since, lte: until } },
    _count: { _all: true },
  });

  const byEndpointMap = new Map<string, Rollup>();
  for (const g of endpointGroups) {
    const key = g.endpoint;
    const c = g._count._all;
    if (!byEndpointMap.has(key)) {
      byEndpointMap.set(key, { key, requests: 0, success: 0, partial: 0, failed: 0 });
    }
    addStatus(byEndpointMap.get(key)!, g.status, c);
  }
  const byEndpoint = Array.from(byEndpointMap.values())
    .sort((a, b) => b.requests - a.requests)
    .map((r) => ({
      endpoint: r.key,
      requests: r.requests,
      success: r.success,
      partial: r.partial,
      failed: r.failed,
    }));

  // By sourceSystem (sourceSystem + status)
  const sourceGroups = await prisma.integrationLog.groupBy({
    by: ["sourceSystem", "status"],
    where: { companyId, receivedAt: { gte: since, lte: until } },
    _count: { _all: true },
  });

  const bySourceMap = new Map<string, Rollup>();
  for (const g of sourceGroups) {
    const key = g.sourceSystem;
    const c = g._count._all;
    if (!bySourceMap.has(key)) {
      bySourceMap.set(key, { key, requests: 0, success: 0, partial: 0, failed: 0 });
    }
    addStatus(bySourceMap.get(key)!, g.status, c);
  }
  const bySourceSystem = Array.from(bySourceMap.values())
    .sort((a, b) => b.requests - a.requests)
    .map((r) => ({
      sourceSystem: r.key,
      requests: r.requests,
      success: r.success,
      partial: r.partial,
      failed: r.failed,
    }));

  // Recent problems (FAILED or PARTIAL, newest first)
  const recentProblems = await prisma.integrationLog.findMany({
    where: {
      companyId,
      receivedAt: { gte: since, lte: until },
      status: { in: [IntegrationLogStatus.FAILED, IntegrationLogStatus.PARTIAL] },
    },
    orderBy: { receivedAt: "desc" },
    take: limit,
    select: {
      requestId: true,
      endpoint: true,
      sourceSystem: true,
      batchRef: true,
      status: true,
      failedCount: true,
      receivedAt: true,
      processedAt: true,
      totalCount: true,
    },
  });

  return NextResponse.json({
    window: {
      hours,
      since: since.toISOString(),
      until: until.toISOString(),
    },
    totals,
    byEndpoint,
    bySourceSystem,
    recentProblems,
  });
}
