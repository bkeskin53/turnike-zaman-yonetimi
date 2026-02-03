import { prisma } from "@/src/repositories/prisma";
import { EventDirection, EventSource } from "@prisma/client";

export async function createRawEvent(companyId: string, input: {
  employeeId: string;
  occurredAt: Date;
  direction: EventDirection;
  doorId?: string | null;
  deviceId?: string | null;
  source?: EventSource;
}) {
  return prisma.rawEvent.create({
    data: {
      companyId,
      employeeId: input.employeeId,
      occurredAt: input.occurredAt,
      direction: input.direction,
      // Optional door/device identifiers for manual events
      doorId: input.doorId ?? null,
      deviceId: input.deviceId ?? null,
      source: input.source ?? EventSource.MANUAL,
    },
  });
}

export async function listRawEvents(
  companyId: string,
  filter: {
    employeeId?: string;
    date?: string; // YYYY-MM-DD
    doorId?: string;
    deviceId?: string;
  }
) {
  const where: any = { companyId };

  if (filter.employeeId) where.employeeId = filter.employeeId;
  if (filter.doorId) where.doorId = filter.doorId;
  if (filter.deviceId) where.deviceId = filter.deviceId;

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
      door: {
        select: { id: true, code: true, name: true },
      },
      device: {
        select: { id: true, name: true, ip: true },
      },
    },
  });
}
