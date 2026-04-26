import { prisma } from "@/src/repositories/prisma";
import type { Prisma } from "@prisma/client";
import { EventDirection, EventSource } from "@prisma/client";
import { DateTime } from "luxon";

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
    timezone?: string;
    doorId?: string;
    deviceId?: string;
    employeeWhere?: Prisma.EmployeeWhereInput | null;
  }
) {
  const where: any = { companyId };

  if (filter.employeeId) where.employeeId = filter.employeeId;
  if (filter.doorId) where.doorId = filter.doorId;
  if (filter.deviceId) where.deviceId = filter.deviceId;
  if (filter.employeeWhere) where.employee = filter.employeeWhere;
  
  if (filter.date) {
    const tz = filter.timezone || "Europe/Istanbul";
    const start = DateTime.fromISO(filter.date, { zone: tz }).startOf("day");
    const nextDayStart = start.plus({ days: 1 });

    if (!start.isValid || !nextDayStart.isValid) {
      throw new Error("INVALID_FILTER_DATE");
    }

    where.occurredAt = {
      gte: start.toUTC().toJSDate(),
      lt: nextDayStart.toUTC().toJSDate(),
    };
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
