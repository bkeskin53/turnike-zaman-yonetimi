import { prisma } from "@/src/repositories/prisma";
import { EventDirection, EventSource } from "@prisma/client";

export async function createRawEvent(companyId: string, input: {
  employeeId: string;
  occurredAt: Date;
  direction: EventDirection;
  source?: EventSource;
}) {
  return prisma.rawEvent.create({
    data: {
      companyId,
      employeeId: input.employeeId,
      occurredAt: input.occurredAt,
      direction: input.direction,
      source: input.source ?? EventSource.MANUAL,
    },
  });
}

export async function listRawEvents(companyId: string, filter: {
  employeeId?: string;
  date?: string; // YYYY-MM-DD
}) {
  const where: any = { companyId };

  if (filter.employeeId) where.employeeId = filter.employeeId;

  if (filter.date) {
    // basit v1: server local gün sınırı
    const start = new Date(`${filter.date}T00:00:00`);
    const end = new Date(`${filter.date}T23:59:59.999`);
    where.occurredAt = { gte: start, lte: end };
  }

  return prisma.rawEvent.findMany({
    where,
    orderBy: [{ occurredAt: "desc" }],
    take: 200,
    include: {
      employee: {
        select: { id: true, employeeCode: true, firstName: true, lastName: true },
      },
    },
  });
}
