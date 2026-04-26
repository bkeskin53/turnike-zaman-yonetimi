import { prisma } from "@/src/repositories/prisma";
import { EventDirection, NormalizedStatus } from "@prisma/client";

export type NormalizedUpsertInput = {
  rawEventId: string;
  companyId: string;
  employeeId: string;
  occurredAt: Date;
  direction: EventDirection;
  status: NormalizedStatus;
  rejectReason?: string | null;
};

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
function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sameNullableString(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? null) === (b ?? null);
}

/**
 * Batch upsert for normalized events to kill N+1 upsert cost.
 *
 * Semantics:
 * - Equivalent end-state to calling upsertNormalizedForRawEvent for each row.
 * - Optimization: skips updates when row is already identical.
 *
 * Notes:
 * - Uses createMany(skipDuplicates) for inserts.
 * - For existing rows, updates only when fields differ.
 */
export async function upsertNormalizedForRawEventsBatch(inputs: NormalizedUpsertInput[]) {
  if (!inputs.length) {
    return { ok: true, total: 0, created: 0, updated: 0, skipped: 0 };
  }

  // Deduplicate by rawEventId (last write wins, deterministic).
  const byId = new Map<string, NormalizedUpsertInput>();
  for (const row of inputs) byId.set(row.rawEventId, row);
  const rows = Array.from(byId.values());

  let created = 0;
  let updated = 0;
  let skipped = 0;

  // Keep IN() lists at a safe size.
  for (const part of chunk(rows, 1000)) {
    const ids = part.map((r) => r.rawEventId);

    const existing = await prisma.normalizedEvent.findMany({
      where: { rawEventId: { in: ids } },
      select: {
        rawEventId: true,
        companyId: true,
        employeeId: true,
        occurredAt: true,
        direction: true,
        status: true,
        rejectReason: true,
      },
    });

    const existingById = new Map(existing.map((e) => [e.rawEventId, e]));

    const toCreate = part
      .filter((r) => !existingById.has(r.rawEventId))
      .map((r) => ({
        rawEventId: r.rawEventId,
        companyId: r.companyId,
        employeeId: r.employeeId,
        occurredAt: r.occurredAt,
        direction: r.direction,
        status: r.status,
        rejectReason: r.rejectReason ?? null,
      }));

    if (toCreate.length) {
      const res = await prisma.normalizedEvent.createMany({
        data: toCreate,
        skipDuplicates: true, // safe even if concurrency exists
      });
      created += res.count ?? 0;
    }

    const toUpdate = part
      .map((r) => {
        const ex = existingById.get(r.rawEventId);
        if (!ex) return null;
        const nextReject = r.rejectReason ?? null;
        const equal =
          ex.companyId === r.companyId &&
          ex.employeeId === r.employeeId &&
          ex.occurredAt.getTime() === r.occurredAt.getTime() &&
          ex.direction === r.direction &&
          ex.status === r.status &&
          sameNullableString(ex.rejectReason, nextReject);
        if (equal) return { kind: "skip" as const };
        return { kind: "update" as const, row: r, nextReject };
      })
      .filter(Boolean) as Array<{ kind: "skip" } | { kind: "update"; row: NormalizedUpsertInput; nextReject: string | null }>;

    for (const item of toUpdate) {
      if (item.kind === "skip") {
        skipped++;
        continue;
      }
      await prisma.normalizedEvent.update({
        where: { rawEventId: item.row.rawEventId },
        data: {
          companyId: item.row.companyId,
          employeeId: item.row.employeeId,
          occurredAt: item.row.occurredAt,
          direction: item.row.direction,
          status: item.row.status,
          rejectReason: item.nextReject,
        },
      });
      updated++;
    }
  }

  return { ok: true, total: rows.length, created, updated, skipped };
}