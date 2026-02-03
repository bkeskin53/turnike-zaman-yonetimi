import { prisma } from "@/src/repositories/prisma";
import { IntegrationLogStatus } from "@prisma/client";

export async function createIntegrationLogRepo(input: {
  companyId: string;
  requestId: string;
  endpoint: string;
  sourceSystem: string;
  batchRef?: string | null;
  ip?: string | null;
  apiKeyHash?: string | null;
  payloadMeta?: any;
}) {
  return prisma.integrationLog.create({
    data: {
      companyId: input.companyId,
      requestId: input.requestId,
      endpoint: input.endpoint,
      sourceSystem: input.sourceSystem,
      batchRef: input.batchRef ?? null,
      ip: input.ip ?? null,
      apiKeyHash: input.apiKeyHash ?? null,
      payloadMeta: input.payloadMeta ?? undefined,
      status: IntegrationLogStatus.SUCCESS,
    },
  });
}

export async function finalizeIntegrationLogRepo(input: {
  requestId: string;
  processedAt: Date;
  totalCount: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  failedCount: number;
  status: IntegrationLogStatus;
  errors?: any;
  payloadMetaPatch?: any;
}) {
  let payloadMetaMerged: any | undefined = undefined;
  if (input.payloadMetaPatch && typeof input.payloadMetaPatch === "object") {
    const cur = await prisma.integrationLog.findUnique({
      where: { requestId: input.requestId },
      select: { payloadMeta: true },
    });
    payloadMetaMerged = { ...(cur?.payloadMeta as any), ...(input.payloadMetaPatch as any) };
  }

  return prisma.integrationLog.update({
    where: { requestId: input.requestId },
    data: {
      processedAt: input.processedAt,
      totalCount: input.totalCount,
      createdCount: input.createdCount,
      updatedCount: input.updatedCount,
      unchangedCount: input.unchangedCount,
      failedCount: input.failedCount,
      status: input.status,
      errors: input.errors ?? undefined,
      ...(payloadMetaMerged ? { payloadMeta: payloadMetaMerged } : {}),
    },
  });
}

export async function findEmployeeLinkRepo(companyId: string, sourceSystem: string, externalRef: string) {
  return prisma.integrationEmployeeLink.findFirst({
    where: { companyId, sourceSystem, externalRef },
  });
}

export async function upsertEmployeeLinkRepo(input: {
  companyId: string;
  sourceSystem: string;
  externalRef: string;
  employeeId: string;
  lastSeenAt: Date;
  lastPayloadHash?: string | null;
}) {
  return prisma.integrationEmployeeLink.upsert({
    where: {
      companyId_sourceSystem_externalRef: {
        companyId: input.companyId,
        sourceSystem: input.sourceSystem,
        externalRef: input.externalRef,
      },
    },
    create: {
      companyId: input.companyId,
      sourceSystem: input.sourceSystem,
      externalRef: input.externalRef,
      employeeId: input.employeeId,
      lastSeenAt: input.lastSeenAt,
      lastPayloadHash: input.lastPayloadHash ?? null,
    },
    update: {
      employeeId: input.employeeId,
      lastSeenAt: input.lastSeenAt,
      lastPayloadHash: input.lastPayloadHash ?? null,
    },
  });
}