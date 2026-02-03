import { EventDirection, EventSource, Prisma, type DeviceDriver } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { resolveDeviceSyncDriver } from "@/src/services/deviceSync/registry";

export type SyncDeviceResult = {
  ok: true;
  driverUsed: string;
  doorRole: string | null;
  fixedDirection: "IN" | "OUT" | null;

  attempted: number; // driver'dan gelen ham aday sayısı
  inserted: number; // RawEvent'e yazılan adet

  skippedSameMinuteIn: number;
  skippedSameMinuteOut: number;

  skippedReason?: "DOOR_ACCESS_ONLY";
  nextCursorAt?: string;
  meta?: Record<string, unknown>;
};

/**
 * Cihaz senkronizasyonunun domain katmanı.
 * - Driver'dan "ham" olayları çeker
 * - Door.role / duplicate minute / idempotency kurallarını uygular
 * - RawEvent'e yazar ve device lastSyncAt'ı günceller
 * - Employee eşleşmezse DeviceInboxEvent'e atar (kaybolmasın)
 */
export async function syncDevice(
  companyId: string,
  input: { deviceId: string; count?: number }
): Promise<SyncDeviceResult> {
  const deviceId = String(input.deviceId ?? "").trim();
  const limit = Math.max(1, Math.min(50, Number(input.count ?? 5) || 5));
  if (!deviceId) throw new Error("VALIDATION_ERROR");

  const device = await prisma.device.findFirst({
    where: { id: deviceId, companyId, isActive: true },
    select: {
      id: true,
      driver: true,
      doorId: true,
      ip: true,
      port: true,
      serialNo: true,
      lastSyncAt: true,
      door: {
        select: {
          id: true,
          role: true,
          defaultDirection: true,
          isActive: true,
        },
      },
    },
  });

  if (!device) throw new Error("DEVICE_NOT_FOUND");

  const door = device.door && device.door.isActive ? device.door : null;
  const doorRole = door?.role ?? null;
  const fixedDirection = (door?.defaultDirection as ("IN" | "OUT") | null) ?? null;

  // ACCESS_ONLY => mesai RawEvent yazma
  if (doorRole === "ACCESS_ONLY") {
    await prisma.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    });

    return {
      ok: true,
      driverUsed: "(skipped)",
      doorRole,
      fixedDirection,
      attempted: 0,
      inserted: 0,
      skippedSameMinuteIn: 0,
      skippedSameMinuteOut: 0,
      skippedReason: "DOOR_ACCESS_ONLY",
    };
  }

  const driver = resolveDeviceSyncDriver(device.driver as DeviceDriver);

  let pullResult: {
    events: Array<{
      employeeId?: string;
      cardNo?: string;
      deviceUserId?: string;
      occurredAt: Date;
      direction: EventDirection;
      externalRef: string;
      rawPayload?: unknown;
    }>;
    nextCursorAt: Date | null;
    meta?: Record<string, unknown>;
  };

  try {
    pullResult = await driver.pull({
      companyId,
      device: {
        id: device.id,
        driver: device.driver,
        doorId: device.doorId,
        ip: device.ip,
        port: device.port,
        serialNo: device.serialNo,
        lastSyncAt: device.lastSyncAt,
      },
      door,
      limit,
      now: new Date(),
    });
  } catch (e: any) {
    await prisma.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        lastErrorAt: new Date(),
        lastErrorMessage: `SYNC_FAIL(${driver.name}): ${e?.message ?? "unknown"}`,
      },
    });
    throw e;
  }

  const pulled = pullResult.events;

  // Yeni log yoksa: sadece device güncelle ve dön
  if (pulled.length === 0) {
    await prisma.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        lastErrorAt: null,
        lastErrorMessage: null,
        ...(pullResult.nextCursorAt ? { lastSyncAt: pullResult.nextCursorAt } : {}),
      },
    });

    return {
      ok: true,
      driverUsed: driver.name,
      doorRole,
      fixedDirection,
      attempted: 0,
      inserted: 0,
      skippedSameMinuteIn: 0,
      skippedSameMinuteOut: 0,
      nextCursorAt: pullResult.nextCursorAt ? pullResult.nextCursorAt.toISOString() : undefined,
      meta: pullResult.meta ?? undefined,
    };
  }

  /**
   * 1) Identity resolve:
   * - employeeId varsa direkt
   * - yoksa cardNo -> Employee
   * - yoksa deviceUserId -> Employee
   * - hiçbiri yoksa Inbox'a at
   */
  const cardNos = Array.from(new Set(pulled.map((x) => x.cardNo).filter(Boolean))) as string[];
  const deviceUserIds = Array.from(
    new Set(pulled.map((x) => x.deviceUserId).filter(Boolean))
  ) as string[];

  const [empsByCard, empsByUser] = await Promise.all([
    cardNos.length
      ? prisma.employee.findMany({
          where: { companyId, cardNo: { in: cardNos }, isActive: true },
          select: { id: true, cardNo: true },
        })
      : Promise.resolve([]),
    deviceUserIds.length
      ? prisma.employee.findMany({
          where: { companyId, deviceUserId: { in: deviceUserIds }, isActive: true },
          select: { id: true, deviceUserId: true },
        })
      : Promise.resolve([]),
  ]);

  const cardToEmp = new Map(empsByCard.map((e) => [e.cardNo!, e.id]));
  const userToEmp = new Map(empsByUser.map((e) => [e.deviceUserId!, e.id]));

  type ResolvedEvent = {
    employeeId: string;
    cardNo?: string;
    deviceUserId?: string;
    occurredAt: Date;
    direction: EventDirection;
    externalRef: string;
    rawPayload?: unknown;
  };

  const resolved: ResolvedEvent[] = [];
  const inboxData: Prisma.DeviceInboxEventCreateManyInput[] = [];

  for (const ev of pulled) {
    const employeeId =
      ev.employeeId ??
      (ev.cardNo ? cardToEmp.get(ev.cardNo) : undefined) ??
      (ev.deviceUserId ? userToEmp.get(ev.deviceUserId) : undefined);

    if (!employeeId) {
      // Eşleşmeyen log: kaybolmasın -> Inbox
      inboxData.push({
        companyId,
        deviceId: device.id,
        doorId: device.doorId ?? null,
        externalRef: ev.externalRef,
        occurredAt: ev.occurredAt,
        direction: ev.direction,
        cardNo: ev.cardNo ?? null,
        deviceUserId: ev.deviceUserId ?? null,
        status: "PENDING",
        rawPayload: (ev as any).rawPayload ?? null,
      });
      continue;
    }

    resolved.push({
      ...ev,
      employeeId,
    });
  }

  // Eğer resolved boşsa: RawEvent'e hiçbir şey yazmayacağız.
  // Sadece inboxData (varsa) yaz + device lastSyncAt güncelle.
  if (resolved.length === 0) {
    const inboxInserted = await prisma.$transaction(async (tx) => {
      let count = 0;

      if (inboxData.length) {
        const createdInbox = await tx.deviceInboxEvent.createMany({
          data: inboxData,
          skipDuplicates: true,
        });
        count = createdInbox.count;
      }

      await tx.device.update({
        where: { id: device.id },
        data: {
          lastSeenAt: new Date(),
          lastErrorAt: null,
          lastErrorMessage: null,
          ...(pullResult.nextCursorAt ? { lastSyncAt: pullResult.nextCursorAt } : {}),
        },
      });

      return count;
    });

    return {
      ok: true,
      driverUsed: driver.name,
      doorRole,
      fixedDirection,
      attempted: pulled.length,
      inserted: 0,
      skippedSameMinuteIn: 0,
      skippedSameMinuteOut: 0,
      nextCursorAt: pullResult.nextCursorAt ? pullResult.nextCursorAt.toISOString() : undefined,
      meta: { ...(pullResult.meta ?? {}), inboxInserted },
    };
  }

  // 2) Duplicate minute kontrol penceresi (sadece resolved üzerinden)
  const occurredTimes = resolved.map((x) => x.occurredAt.getTime());
  const minMs = Math.min(...occurredTimes);
  const maxMs = Math.max(...occurredTimes);
  const minOccurredAt = new Date(minMs - 2_000);
  const maxOccurredAt = new Date(maxMs + 2_000);

  const employeeIds = Array.from(new Set(resolved.map((x) => x.employeeId)));

  // Aynı dakika duplicate engeli (IN/OUT ayrı)
  const [existingIn, existingOut] = await Promise.all([
    prisma.rawEvent.findMany({
      where: {
        companyId,
        employeeId: { in: employeeIds },
        direction: EventDirection.IN,
        source: EventSource.DEVICE,
        occurredAt: { gte: minOccurredAt, lte: maxOccurredAt },
      },
      select: { employeeId: true, occurredAt: true },
    }),
    prisma.rawEvent.findMany({
      where: {
        companyId,
        employeeId: { in: employeeIds },
        direction: EventDirection.OUT,
        source: EventSource.DEVICE,
        occurredAt: { gte: minOccurredAt, lte: maxOccurredAt },
      },
      select: { employeeId: true, occurredAt: true },
    }),
  ]);

  const existingInMinuteKeys = new Set(
    existingIn.map((x) => `${x.employeeId}|${Math.floor(new Date(x.occurredAt).getTime() / 60000)}`)
  );
  const existingOutMinuteKeys = new Set(
    existingOut.map((x) => `${x.employeeId}|${Math.floor(new Date(x.occurredAt).getTime() / 60000)}`)
  );

  const batchInMinuteKeys = new Set<string>();
  const batchOutMinuteKeys = new Set<string>();

  let skippedSameMinuteIn = 0;
  let skippedSameMinuteOut = 0;

  const data: Prisma.RawEventCreateManyInput[] = [];

  // ✅ RawEvent üretimi sadece "resolved" üzerinden yapılır (employeeId kesin)
  for (const ev of resolved) {
    const minuteKey = `${ev.employeeId}|${Math.floor(ev.occurredAt.getTime() / 60000)}`;

    if (ev.direction === EventDirection.IN) {
      if (existingInMinuteKeys.has(minuteKey) || batchInMinuteKeys.has(minuteKey)) {
        skippedSameMinuteIn++;
        continue;
      }
      batchInMinuteKeys.add(minuteKey);
    }

    if (ev.direction === EventDirection.OUT) {
      if (existingOutMinuteKeys.has(minuteKey) || batchOutMinuteKeys.has(minuteKey)) {
        skippedSameMinuteOut++;
        continue;
      }
      batchOutMinuteKeys.add(minuteKey);
    }

    data.push({
      companyId,
      employeeId: ev.employeeId,
      occurredAt: ev.occurredAt,
      direction: ev.direction,
      source: EventSource.DEVICE,
      deviceId: device.id,
      doorId: device.doorId ?? null,
      externalRef: ev.externalRef,
    });
  }

  // 3) DB yazımları: Inbox (varsa) + RawEvent + Device update
  const { rawInserted, inboxInserted } = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    let inboxCount = 0;
    if (inboxData.length) {
      const createdInbox = await tx.deviceInboxEvent.createMany({
        data: inboxData,
        skipDuplicates: true,
      });
      inboxCount = createdInbox.count;
    }

    const createdRaw = await tx.rawEvent.createMany({
      data,
      skipDuplicates: true,
    });

    await tx.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        lastErrorAt: null,
        lastErrorMessage: null,
        ...(pullResult.nextCursorAt ? { lastSyncAt: pullResult.nextCursorAt } : {}),
      },
    });

    return { rawInserted: createdRaw.count, inboxInserted: inboxCount };
  });

  return {
    ok: true,
    driverUsed: driver.name,
    doorRole,
    fixedDirection,
    attempted: pulled.length,
    inserted: rawInserted,
    skippedSameMinuteIn,
    skippedSameMinuteOut,
    nextCursorAt: pullResult.nextCursorAt ? pullResult.nextCursorAt.toISOString() : undefined,
    meta: { ...(pullResult.meta ?? {}), inboxInserted },
  };
}
