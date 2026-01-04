import { prisma } from "@/src/repositories/prisma";
import { EventDirection, NormalizedStatus } from "@prisma/client";

export async function upsertNormalizedForRawEvent(input: {
  rawEventId: string;
  companyId: string;
  employeeId: string;
  occurredAt: Date;
  direction: EventDirection;
  status: NormalizedStatus;
  rejectReason?: string | null;
}) {
  return prisma.normalizedEvent.upsert({
    where: { rawEventId: input.rawEventId },
    update: {
      companyId: input.companyId,
      employeeId: input.employeeId,
      occurredAt: input.occurredAt,
      direction: input.direction,
      status: input.status,
      rejectReason: input.rejectReason ?? null,
    },
    create: {
      rawEventId: input.rawEventId,
      companyId: input.companyId,
      employeeId: input.employeeId,
      occurredAt: input.occurredAt,
      direction: input.direction,
      status: input.status,
      rejectReason: input.rejectReason ?? null,
    },
  });
}
