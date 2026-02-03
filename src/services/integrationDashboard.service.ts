import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";
import { IntegrationLogStatus } from "@prisma/client";

function clampInt(v: unknown, def: number, min: number, max: number) {
  const n = typeof v === "string" ? Number(v) : Number(v);
  if (!Number.isFinite(n)) return def;
  const i = Math.trunc(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

type Rollup = { key: string; requests: number; success: number; partial: number; failed: number };

function addStatus(r: Rollup, status: IntegrationLogStatus, count: number) {
  r.requests += count;
  if (status === IntegrationLogStatus.SUCCESS) r.success += count;
  else if (status === IntegrationLogStatus.PARTIAL) r.partial += count;
  else r.failed += count;
}

export type IntegrationDashboardData = {
  window: { hours: number; since: string; until: string };
  totals: { requests: number; success: number; partial: number; failed: number };
  byEndpoint: Array<{ endpoint: string; requests: number; success: number; partial: number; failed: number }>;
  bySourceSystem: Array<{ sourceSystem: string; requests: number; success: number; partial: number; failed: number }>;
  recentProblems: Array<{
    requestId: string;
    endpoint: string;
    sourceSystem: string;
    status: IntegrationLogStatus;
    batchRef: string | null;
    totalCount: number;
    failedCount: number;
    receivedAt: string;
    processedAt: string | null;
  }>;
  security: {
    recent: Array<{
      id: string;
      reason: string;
      endpoint: string;
      sourceIp: string | null;
      userAgent: string | null;
      receivedAt: string;
    }>;
    byReason: Array<{ reason: string; count: number }>;
  };
};

export async function getIntegrationDashboardData(input: { hours?: unknown; limit?: unknown }): Promise<IntegrationDashboardData> {
  const companyId = await getActiveCompanyId();
  const hours = clampInt(input.hours, 24, 1, 168);
  const limit = clampInt(input.limit, 20, 5, 100);

  const until = new Date();
  const since = new Date(until.getTime() - hours * 60 * 60 * 1000);

  // Totals by status
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

  // By endpoint
  const endpointGroups = await prisma.integrationLog.groupBy({
    by: ["endpoint", "status"],
    where: { companyId, receivedAt: { gte: since, lte: until } },
    _count: { _all: true },
  });

  const byEndpointMap = new Map<string, Rollup>();
  for (const g of endpointGroups) {
    const key = g.endpoint;
    const c = g._count._all;
    if (!byEndpointMap.has(key)) byEndpointMap.set(key, { key, requests: 0, success: 0, partial: 0, failed: 0 });
    addStatus(byEndpointMap.get(key)!, g.status, c);
  }

  const byEndpoint = Array.from(byEndpointMap.values())
    .sort((a, b) => b.requests - a.requests)
    .map((r) => ({ endpoint: r.key, requests: r.requests, success: r.success, partial: r.partial, failed: r.failed }));

  // By source system
  const sourceGroups = await prisma.integrationLog.groupBy({
    by: ["sourceSystem", "status"],
    where: { companyId, receivedAt: { gte: since, lte: until } },
    _count: { _all: true },
  });

  const bySourceMap = new Map<string, Rollup>();
  for (const g of sourceGroups) {
    const key = g.sourceSystem;
    const c = g._count._all;
    if (!bySourceMap.has(key)) bySourceMap.set(key, { key, requests: 0, success: 0, partial: 0, failed: 0 });
    addStatus(bySourceMap.get(key)!, g.status, c);
  }

  const bySourceSystem = Array.from(bySourceMap.values())
    .sort((a, b) => b.requests - a.requests)
    .map((r) => ({ sourceSystem: r.key, requests: r.requests, success: r.success, partial: r.partial, failed: r.failed }));

  // Recent problems
  const recentProblemsRaw = await prisma.integrationLog.findMany({
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
      status: true,
      batchRef: true,
      totalCount: true,
      failedCount: true,
      receivedAt: true,
      processedAt: true,
    },
  });

  const recentProblems = recentProblemsRaw.map((x) => ({
    requestId: x.requestId,
    endpoint: x.endpoint,
    sourceSystem: x.sourceSystem,
    status: x.status,
    batchRef: x.batchRef ?? null,
    totalCount: Number(x.totalCount ?? 0),
    failedCount: Number(x.failedCount ?? 0),
    receivedAt: x.receivedAt.toISOString(),
    processedAt: x.processedAt ? x.processedAt.toISOString() : null,
  }));

  // Security logs (blocked attempts)
  const secRecentRaw = await prisma.integrationSecurityLog.findMany({
    where: { companyId, receivedAt: { gte: since, lte: until } },
    orderBy: { receivedAt: "desc" },
    take: limit,
    select: {
      id: true,
      reason: true,
      endpoint: true,
      sourceIp: true,
      userAgent: true,
      receivedAt: true,
    },
  });

  const secByReason = await prisma.integrationSecurityLog.groupBy({
    by: ["reason"],
    where: { companyId, receivedAt: { gte: since, lte: until } },
    _count: { _all: true },
  });

  return {
    window: { hours, since: since.toISOString(), until: until.toISOString() },
    totals,
    byEndpoint,
    bySourceSystem,
    recentProblems,
    security: {
      recent: secRecentRaw.map((x) => ({
        id: x.id,
        reason: x.reason,
        endpoint: x.endpoint,
        sourceIp: x.sourceIp ?? null,
        userAgent: x.userAgent ?? null,
        receivedAt: x.receivedAt.toISOString(),
      })),
      byReason: secByReason
        .map((x) => ({ reason: x.reason, count: x._count._all }))
        .sort((a, b) => b.count - a.count),
    },
  };
}
