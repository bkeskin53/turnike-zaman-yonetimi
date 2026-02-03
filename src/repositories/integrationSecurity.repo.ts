import { prisma } from "@/src/repositories/prisma";

export async function createIntegrationSecurityLog(input: {
  companyId?: string | null;
  reason: string;
  endpoint: string;
  sourceIp?: string | null;
  userAgent?: string | null;
  details?: any;
}) {
  return prisma.integrationSecurityLog.create({
    data: {
      companyId: input.companyId ?? null,
      reason: input.reason,
      endpoint: input.endpoint,
      sourceIp: input.sourceIp ?? null,
      userAgent: input.userAgent ?? null,
      details: input.details ?? undefined,
    },
  });
}
