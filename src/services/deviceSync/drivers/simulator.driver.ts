import { EventDirection } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import type { DeviceSyncDriver, DeviceSyncPullArgs, DeviceSyncPullResult } from "@/src/services/deviceSync/driver";

/**
 * SIMULATOR: Fiziki cihaz yokken "kart okutuldu" gibi RawEvent üretir.
 *
 * - Door.defaultDirection varsa => hep o yön
 * - defaultDirection yoksa => employee bazlı flip (IN/OUT)
 * - "kaldığı yerden devam": Device.lastSyncAt dakikaya yuvarlanıp cursor olur
 *
 * TEST (4.2-1):
 * - SIMULATOR_EMIT_UNKNOWN=1 ise her sync'te 1 adet "eşleşmeyen kimlik" üretir.
 *   Bu kayıt RawEvent'e yazılmaz, DeviceInboxEvent'e düşer.
 * - SIMULATOR_UNKNOWN_KIND=CARD | USER (default CARD)
 */
export const simulatorDriver: DeviceSyncDriver = {
  name: "SIMULATOR",

  async pull(args: DeviceSyncPullArgs): Promise<DeviceSyncPullResult> {
    const now = args.now ?? new Date();
    const limit = Math.max(1, Math.min(50, args.limit));

    const emitUnknown = ["1", "true", "yes"].includes(
      String(process.env.SIMULATOR_EMIT_UNKNOWN ?? "").toLowerCase()
    );
    const unknownKind = String(process.env.SIMULATOR_UNKNOWN_KIND ?? "CARD").toUpperCase(); // CARD | USER

    // Optional rotation: when SIMULATOR_UNKNOWN_ROTATE is truthy, the unknown
    // index is chosen randomly each sync instead of deterministically.  This
    // helps during testing by ensuring that unknown identities continue to
    // appear even after a previous unknown has been resolved and associated.
    const rotateUnknown = ["1", "true", "yes"].includes(
      String(process.env.SIMULATOR_UNKNOWN_ROTATE ?? "").toLowerCase()
    );

    // Dakika hizalama
    const baseMinuteMs = Math.floor(now.getTime() / 60000) * 60000;
    const cursorMinuteMs = args.device.lastSyncAt
      ? Math.floor(new Date(args.device.lastSyncAt).getTime() / 60000) * 60000
      : null;

    const startMinuteMs = cursorMinuteMs
      ? cursorMinuteMs + 60_000
      : baseMinuteMs - (limit - 1) * 60_000;

    const minuteMsList: number[] = [];
    for (let t = startMinuteMs; t <= baseMinuteMs && minuteMsList.length < limit; t += 60_000) {
      minuteMsList.push(t);
    }

    if (minuteMsList.length === 0) {
      return { events: [], nextCursorAt: null, meta: { reason: "NO_NEW_MINUTE" } };
    }

    // Simülasyon için aktif personelleri al
    const takeEmp = Math.max(2, Math.min(10, limit));
    const employees = await prisma.employee.findMany({
      where: { companyId: args.companyId, isActive: true },
      take: takeEmp,
      select: { id: true },
      orderBy: [{ employeeCode: "asc" }],
    });

    if (employees.length === 0) {
      return { events: [], nextCursorAt: null, meta: { reason: "NO_EMPLOYEE" } };
    }

    const fixedDirection = (args.door?.defaultDirection as EventDirection | null) ?? null;

    // defaultDirection yoksa employee bazlı flip için seed çek
    const lastDirByEmployee = new Map<string, "IN" | "OUT">();
    if (!fixedDirection) {
      const windowStartMs = minuteMsList[0];
      const seedCutoff = new Date(windowStartMs - 1);
      const employeeIds = employees.map((e) => e.id);

      const lastRows = await prisma.rawEvent.findMany({
        where: {
          companyId: args.companyId,
          employeeId: { in: employeeIds },
          source: "DEVICE",
          occurredAt: { lt: seedCutoff },
        },
        orderBy: [{ occurredAt: "desc" }],
        distinct: ["employeeId"],
        select: { employeeId: true, direction: true },
      });

      for (const r of lastRows) lastDirByEmployee.set(r.employeeId, r.direction as any);
    }

    const events = minuteMsList.map((ms, i) => {
      const emp = employees[i % employees.length];
      const occurredAt = new Date(ms);

      let direction: EventDirection;
      if (fixedDirection) {
        direction = fixedDirection;
      } else {
        const prev = lastDirByEmployee.get(emp.id) ?? "OUT";
        const next = prev === "IN" ? "OUT" : "IN";
        lastDirByEmployee.set(emp.id, next);
        direction = next as EventDirection;
      }

      const externalRef = `SIM:${args.device.id}:${emp.id}:${occurredAt.getTime()}:${direction}`;

      return { employeeId: emp.id, occurredAt, direction, externalRef };
    });

    if (emitUnknown && events.length > 0) {
      // Rotasyon: her sync'te farklı bir index seçelim.
      // lastSyncAt yoksa 0, varsa dakika sayısına göre döner.
      const seedMs = args.device.lastSyncAt ? new Date(args.device.lastSyncAt).getTime() : now.getTime();
      const seedMinute = Math.floor(seedMs / 60000);
      // Determine which event index to convert into an unknown.  When
      // rotateUnknown is enabled we choose a random index on every sync;
      // otherwise we fall back to the deterministic seedMinute-based index.
      let idx: number;
      if (rotateUnknown) {
        idx = Math.floor(Math.random() * events.length);
      } else {
        idx = Math.abs(seedMinute) % events.length;
      }

      const target = events[idx];
      const occurredAtMs = target.occurredAt.getTime();

      if (unknownKind === "USER") {
        const deviceUserId = `SIM-USER-UNKNOWN-${args.device.id}-${idx}`;
        (events[idx] as any) = {
          occurredAt: target.occurredAt,
          direction: target.direction,
          deviceUserId,
          externalRef: `SIM:${args.device.id}:USER:${deviceUserId}:${occurredAtMs}:${target.direction}`,
          rawPayload: { kind: "UNKNOWN_USER", deviceUserId },
        };
      } else {
        const cardNo = `SIM-CARD-UNKNOWN-${args.device.id}-${idx}`;
        (events[idx] as any) = {
          occurredAt: target.occurredAt,
          direction: target.direction,
          cardNo,
          externalRef: `SIM:${args.device.id}:CARD:${cardNo}:${occurredAtMs}:${target.direction}`,
          rawPayload: { kind: "UNKNOWN_CARD", cardNo },
        };
      }
    }

    return {
      events,
      nextCursorAt: new Date(minuteMsList[minuteMsList.length - 1]),
      meta: {
        fixedDirection: fixedDirection ?? null,
        minutes: minuteMsList.length,
        emitUnknown,
        unknownKind,
      },
    };
  },
};
