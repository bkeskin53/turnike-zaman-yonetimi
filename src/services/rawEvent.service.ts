import { EventDirection } from "@prisma/client";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { createRawEvent, listRawEvents } from "@/src/repositories/rawEvent.repo";
import { prisma } from "@/src/repositories/prisma";
import { dayKeyFromInstant, dbDateFromDayKey } from "@/src/utils/dayKey";

export async function addManualEvent(input: {
  employeeId: string;
  occurredAt: string; // ISO
  direction?: "IN" | "OUT" | "AUTO";
  doorId?: string | null;
  deviceId?: string | null;
}) {
  const companyId = await getActiveCompanyId();
  const bundle = await getCompanyBundle();
  const tz = bundle.policy?.timezone || "Europe/Istanbul";

  const employeeId = String(input.employeeId ?? "").trim();
  const rawDirection = input.direction ?? "IN";
  const occurredAt = new Date(String(input.occurredAt ?? ""));

  const doorId = input.doorId ? String(input.doorId).trim() : null;
  const deviceId = input.deviceId ? String(input.deviceId).trim() : null;

  // Validate basic fields (employee and occurredAt must be provided)
  if (!employeeId || Number.isNaN(occurredAt.getTime())) {
    throw new Error("VALIDATION_ERROR");
  }

  // ✅ employee var mı ve bu company'ye mi ait?
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: { id: true },
  });

  if (!emp) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }

  // ✅ Seçenek-A: Manual event, employment validity dışında ise BLOKLA.
  // occurredAt instant -> canonical dayKey (policy timezone) -> @db.Date compare
  const eventDayKey = dayKeyFromInstant(occurredAt, tz);
  const eventDayDb = dbDateFromDayKey(eventDayKey);

  const employed = await prisma.employeeEmploymentPeriod.findFirst({
    where: {
      companyId,
      employeeId,
      startDate: { lte: eventDayDb },
      OR: [{ endDate: null }, { endDate: { gte: eventDayDb } }],
    },
    select: { id: true },
  });

  if (!employed) {
    const err = new Error("EMPLOYEE_NOT_EMPLOYED_ON_DATE");
    (err as any).meta = { dayKey: eventDayKey };
    throw err;
  }

  // If doorId provided, verify it belongs to the same company and is active
  let doorDefault: string | null = null;
  if (doorId) {
    const door = await prisma.door.findFirst({
      where: { id: doorId, companyId, isActive: true },
      select: { id: true, defaultDirection: true },
    });
    if (!door) {
      throw new Error("DOOR_NOT_FOUND");
    }
    doorDefault = door.defaultDirection as string | null;
  }

  // If deviceId provided, verify it belongs to the same company and is active
  if (deviceId) {
    const dev = await prisma.device.findFirst({
      where: { id: deviceId, companyId, isActive: true },
      select: { id: true },
    });
    if (!dev) {
      throw new Error("DEVICE_NOT_FOUND");
    }
  }

  // Determine final direction: if direction is AUTO (or undefined) and doorId provided, use door.defaultDirection.
  let finalDir: EventDirection | null = null;
  if (!rawDirection || rawDirection === "AUTO") {
    // Must have doorId to determine default
    if (!doorId) {
      throw new Error("AUTO_DIRECTION_NEEDS_DOOR");
    }
    if (!doorDefault) {
      throw new Error("NO_DEFAULT_DIRECTION");
    }
    if (doorDefault === "IN") finalDir = EventDirection.IN;
    else if (doorDefault === "OUT") finalDir = EventDirection.OUT;
    else {
      throw new Error("NO_DEFAULT_DIRECTION");
    }
  } else {
    finalDir =
      rawDirection === "IN"
        ? EventDirection.IN
        : rawDirection === "OUT"
        ? EventDirection.OUT
        : null;
  }

  if (!finalDir) {
    throw new Error("VALIDATION_ERROR");
  }

  return createRawEvent(companyId, {
    employeeId,
    direction: finalDir,
    occurredAt,
    doorId,
    deviceId,
  });
}

export async function getEvents(filter: {
  employeeId?: string;
  date?: string;
  doorId?: string;
  deviceId?: string;
}) {
  const companyId = await getActiveCompanyId();
  const items = await listRawEvents(companyId, filter);
  return { items };
}
