import { EventDirection } from "@prisma/client";

export type PunchEvent = {
  id?: string;
  occurredAt: Date;
  direction: EventDirection;
};

export type NormalizedDecision = {
  status: "ACCEPTED" | "REJECTED";
  reason?: "ORPHAN_OUT" | "CONSECUTIVE_IN" | "CONSECUTIVE_OUT" | "DUPLICATE_EVENT";
};

export type NormalizationSegment = {
  inAt: Date;
  outAt: Date;
};

export type NormalizationResult = {
  // Only for events that have an id (RawEvent case)
  decisions: Record<string, NormalizedDecision>;
  acceptedEvents: Array<{ occurredAt: Date; direction: EventDirection }>;
  segments: NormalizationSegment[];
  firstIn: Date | null;
  lastOut: Date | null;
  anomalies: string[];
  hasOpenIn: boolean;
};

export function normalizePunches(events: PunchEvent[]): NormalizationResult {
  const sorted = [...events].sort((a, b) => {
    const diff = a.occurredAt.getTime() - b.occurredAt.getTime();
    if (diff !== 0) return diff;

    // Deterministic tie-break for same timestamp:
    // IN must be processed before OUT so a same-moment pair can still form a segment.
    if (a.direction === b.direction) return 0;
    return a.direction === EventDirection.IN ? -1 : 1;
  });

  const decisions: Record<string, NormalizedDecision> = {};
  const acceptedEvents: Array<{ occurredAt: Date; direction: EventDirection }> = [];
  const segments: NormalizationSegment[] = [];

  const anomalySet = new Set<string>();
  const addAnomaly = (a: string) => anomalySet.add(a);

  const seenSignature = new Set<string>(); // direction|timestamp
  let openIn: { occurredAt: Date } | null = null;
  // Track only last ACCEPTED direction.
  // Rejected events must not poison subsequent classification.
  let lastAcceptedDirection: EventDirection | null = null;

  let firstIn: Date | null = null;
  let lastOut: Date | null = null;

  sorted.forEach((ev, idx) => {
    const id = ev.id ?? `__idx_${idx}`;
    const sig = `${ev.direction}|${ev.occurredAt.getTime()}`;

    // Duplicate (same direction + same timestamp)
    if (seenSignature.has(sig)) {
      if (ev.id) decisions[ev.id] = { status: "REJECTED", reason: "DUPLICATE_EVENT" };
      addAnomaly("DUPLICATE_EVENT");
      return;
    }
    seenSignature.add(sig);
    // IMPORTANT:
    // Consecutive classification should only look at the previous ACCEPTED direction.
    // A rejected event must not affect the next event's meaning.
    const prevAcceptedDirection = lastAcceptedDirection;

    if (ev.direction === "IN") {
      if (openIn) {
        // already inside, another IN is invalid
        if (ev.id) decisions[ev.id] = { status: "REJECTED", reason: "CONSECUTIVE_IN" };
        addAnomaly("CONSECUTIVE_IN");
        return;
      }
      // accept IN
      if (ev.id) decisions[ev.id] = { status: "ACCEPTED" };
      acceptedEvents.push({ occurredAt: ev.occurredAt, direction: ev.direction });
      openIn = { occurredAt: ev.occurredAt };
      if (!firstIn) firstIn = ev.occurredAt;
      lastAcceptedDirection = ev.direction;
      return;
    }

    // OUT
    if (!openIn) {
      // Distinguish between:
      // - ORPHAN_OUT: OUT with no prior accepted IN
      // - CONSECUTIVE_OUT: OUT immediately after an accepted OUT (two OUTs in a row)
      if (prevAcceptedDirection === "OUT") {
        if (ev.id) decisions[ev.id] = { status: "REJECTED", reason: "CONSECUTIVE_OUT" };
        addAnomaly("CONSECUTIVE_OUT");
      } else {
        if (ev.id) decisions[ev.id] = { status: "REJECTED", reason: "ORPHAN_OUT" };
        addAnomaly("ORPHAN_OUT");
      }
      return;
    }

    // accept OUT and close segment
    if (ev.id) decisions[ev.id] = { status: "ACCEPTED" };
    acceptedEvents.push({ occurredAt: ev.occurredAt, direction: ev.direction });

    if (ev.occurredAt > openIn.occurredAt) {
      segments.push({ inAt: openIn.occurredAt, outAt: ev.occurredAt });
      lastOut = ev.occurredAt;
    } else {
      // Same-timestamp or reversed edge case should not create a zero/negative segment.
      if (ev.id) decisions[ev.id] = { status: "REJECTED", reason: "DUPLICATE_EVENT" };
      addAnomaly("DUPLICATE_EVENT");
    }
    openIn = null;

    lastAcceptedDirection = ev.direction;
  });

  const hasOpenIn = !!openIn;
  if (hasOpenIn) addAnomaly("MISSING_PUNCH");

  return {
    decisions,
    acceptedEvents,
    segments,
    firstIn,
    lastOut,
    anomalies: Array.from(anomalySet.values()),
    hasOpenIn,
  };
}
