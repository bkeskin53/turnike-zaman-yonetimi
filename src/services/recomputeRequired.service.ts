import { prisma } from "@/src/repositories/prisma";
import { RecomputeReason, RecomputeStatus } from "@prisma/client";

function isDayKey(x: unknown): x is string {
  return typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
}

function minDayKey(a: string, b: string) {
  return a <= b ? a : b;
}
function maxDayKey(a: string, b: string) {
  return a >= b ? a : b;
}

export async function markRecomputeRequired(input: {
  companyId: string;
  reason: RecomputeReason;
  createdByUserId?: string | null;
  rangeStartDayKey?: string | null;
  rangeEndDayKey?: string | null;
}) {
  const companyId = input.companyId;
  const reason = input.reason;

  const start = isDayKey(input.rangeStartDayKey) ? input.rangeStartDayKey : null;
  const end = isDayKey(input.rangeEndDayKey) ? input.rangeEndDayKey : null;

  const existing = await prisma.recomputeRequirement.findFirst({
    where: { companyId, reason, status: RecomputeStatus.PENDING },
    orderBy: { createdAt: "desc" },
    select: { id: true, rangeStartDayKey: true, rangeEndDayKey: true },
  });

  // Merge rule: fail-safe
  // - If any side is unknown => unknown (null)
  // - If both known => expand min/max
  let mergedStart: string | null = start;
  let mergedEnd: string | null = end;

  if (existing) {
    const es = isDayKey(existing.rangeStartDayKey) ? existing.rangeStartDayKey : null;
    const ee = isDayKey(existing.rangeEndDayKey) ? existing.rangeEndDayKey : null;

    if (!mergedStart || !mergedEnd || !es || !ee) {
      mergedStart = null;
      mergedEnd = null;
    } else {
      mergedStart = minDayKey(mergedStart, es);
      mergedEnd = maxDayKey(mergedEnd, ee);
    }

    await prisma.recomputeRequirement.update({
      where: { id: existing.id },
      data: {
        rangeStartDayKey: mergedStart,
        rangeEndDayKey: mergedEnd,
      },
    });

    return { id: existing.id, mergedStart, mergedEnd };
  }

  const created = await prisma.recomputeRequirement.create({
    data: {
      companyId,
      reason,
      rangeStartDayKey: mergedStart,
      rangeEndDayKey: mergedEnd,
      createdByUserId: input.createdByUserId ?? null,
      status: RecomputeStatus.PENDING,
    },
    select: { id: true, rangeStartDayKey: true, rangeEndDayKey: true },
  });

  return { id: created.id, mergedStart: created.rangeStartDayKey, mergedEnd: created.rangeEndDayKey };
}