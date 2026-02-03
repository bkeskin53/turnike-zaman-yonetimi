import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";

export async function getIntegrationRequestDetail(requestId: string) {
  const companyId = await getActiveCompanyId();

  const log = await prisma.integrationLog.findFirst({
    where: { companyId, requestId },
    select: {
      requestId: true,
      endpoint: true,
      sourceSystem: true,
      batchRef: true,
      status: true,
      totalCount: true,
      createdCount: true,
      updatedCount: true,
      unchangedCount: true,
      failedCount: true,
      receivedAt: true,
      processedAt: true,
      errors: true,
      payloadMeta: true,
    },
  });

  if (!log) return null;

  return {
    ...log,
    receivedAt: log.receivedAt.toISOString(),
    processedAt: log.processedAt ? log.processedAt.toISOString() : null,
  };
}
