import { DateTime } from "luxon";

export type FiniteRangeSegment<TPayload> = {
  validFromDayKey: string;
  validToDayKey: string | null;
  payload: TPayload;
};

export type FiniteRangeInputRow<TPayload> = {
  validFrom: Date | null;
  validTo: Date | null;
  payload: TPayload;
};

export function toDayKey(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export function previousDayKey(dayKey: string): string {
  return DateTime.fromISO(dayKey, { zone: "UTC" }).minus({ days: 1 }).toISODate()!;
}

export function nextDayKey(dayKey: string): string {
  return DateTime.fromISO(dayKey, { zone: "UTC" }).plus({ days: 1 }).toISODate()!;
}

function maxNullableDayKey(a: string | null, b: string | null): string | null {
  if (!a || !b) return null;
  return a >= b ? a : b;
}

function isAdjacentOrOverlapping<TPayload>(
  previous: FiniteRangeSegment<TPayload>,
  current: FiniteRangeSegment<TPayload>,
): boolean {
  if (previous.validToDayKey === null) return true;
  return nextDayKey(previous.validToDayKey) >= current.validFromDayKey;
}

function subtractIntervalFromSegment<TPayload>(args: {
  segment: FiniteRangeSegment<TPayload>;
  startDayKey: string;
  endDayKey: string;
}): FiniteRangeSegment<TPayload>[] {
  const { segment, startDayKey, endDayKey } = args;
  const segmentEndDayKey = segment.validToDayKey;

  if (segment.validFromDayKey > endDayKey) return [segment];
  if (segmentEndDayKey && segmentEndDayKey < startDayKey) return [segment];

  const pieces: FiniteRangeSegment<TPayload>[] = [];

  if (segment.validFromDayKey < startDayKey) {
    pieces.push({
      validFromDayKey: segment.validFromDayKey,
      validToDayKey: previousDayKey(startDayKey),
      payload: segment.payload,
    });
  }

  if (segmentEndDayKey === null || segmentEndDayKey > endDayKey) {
    pieces.push({
      validFromDayKey: nextDayKey(endDayKey),
      validToDayKey: segmentEndDayKey,
      payload: segment.payload,
    });
  }

  return pieces;
}

export function normalizeFiniteRangeSegments<TPayload>(args: {
  segments: FiniteRangeSegment<TPayload>[];
  samePayload: (left: TPayload, right: TPayload) => boolean;
}): FiniteRangeSegment<TPayload>[] {
  const sorted = [...args.segments].sort((left, right) => {
    if (left.validFromDayKey === right.validFromDayKey) {
      const leftEnd = left.validToDayKey ?? "9999-12-31";
      const rightEnd = right.validToDayKey ?? "9999-12-31";
      return leftEnd.localeCompare(rightEnd);
    }

    return left.validFromDayKey.localeCompare(right.validFromDayKey);
  });

  const normalized: FiniteRangeSegment<TPayload>[] = [];

  for (const segment of sorted) {
    const last = normalized[normalized.length - 1];
    if (
      last &&
      args.samePayload(last.payload, segment.payload) &&
      isAdjacentOrOverlapping(last, segment)
    ) {
      last.validToDayKey = maxNullableDayKey(last.validToDayKey, segment.validToDayKey);
      continue;
    }

    normalized.push({ ...segment });
  }

  return normalized;
}

function sameSegmentLists<TPayload>(args: {
  left: FiniteRangeSegment<TPayload>[];
  right: FiniteRangeSegment<TPayload>[];
  samePayload: (left: TPayload, right: TPayload) => boolean;
}): boolean {
  if (args.left.length !== args.right.length) return false;

  return args.left.every((segment, index) => {
    const other = args.right[index];
    return (
      segment.validFromDayKey === other.validFromDayKey &&
      segment.validToDayKey === other.validToDayKey &&
      args.samePayload(segment.payload, other.payload)
    );
  });
}

export function buildFiniteRangeMutationPlan<TPayload>(args: {
  rows: FiniteRangeInputRow<TPayload>[];
  startDayKey: string;
  endDayKey: string;
  payload: TPayload;
  samePayload: (left: TPayload, right: TPayload) => boolean;
}): {
  changed: boolean;
  existingSegments: FiniteRangeSegment<TPayload>[];
  desiredSegments: FiniteRangeSegment<TPayload>[];
} {
  const existingSegments = normalizeFiniteRangeSegments({
    segments: args.rows
      .map((row) => {
        const validFromDayKey = toDayKey(row.validFrom);
        if (!validFromDayKey) return null;

        return {
          validFromDayKey,
          validToDayKey: toDayKey(row.validTo),
          payload: row.payload,
        };
      })
      .filter((row): row is FiniteRangeSegment<TPayload> => row !== null),
    samePayload: args.samePayload,
  });

  const desiredSegments = normalizeFiniteRangeSegments({
    segments: [
      ...existingSegments.flatMap((segment) =>
        subtractIntervalFromSegment({
          segment,
          startDayKey: args.startDayKey,
          endDayKey: args.endDayKey,
        }),
      ),
      {
        validFromDayKey: args.startDayKey,
        validToDayKey: args.endDayKey,
        payload: args.payload,
      },
    ],
    samePayload: args.samePayload,
  });

  return {
    changed: !sameSegmentLists({
      left: existingSegments,
      right: desiredSegments,
      samePayload: args.samePayload,
    }),
    existingSegments,
    desiredSegments,
  };
}
