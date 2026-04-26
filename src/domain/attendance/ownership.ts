import { EventDirection } from "@prisma/client";
import {
  ShiftInstance,
  diffFromPlannedEndMinutes,
  diffFromPlannedStartMinutes,
  isEventInsideInstanceToleranceWindow,
} from "@/src/domain/attendance/shiftInstance";

export type OwnershipScoreBreakdown = {
  baseWindowMatch: number;
  proximityToStart: number;
  proximityToEnd: number;
  directionFit: number;
  crossDayPenalty: number;
  offDayPenalty: number;
  postEndInPenalty: number;
  restPenalty: number;
  total: number;
};

export type EventOwnershipDecision = {
  rawEventId?: string;
  occurredAt: Date;
  direction: EventDirection;
  ownerLogicalDayKey: string | null;
  ownerSource: ShiftInstance["source"] | null;
  score: number;
  breakdown: OwnershipScoreBreakdown;
};

function clampScore(n: number) {
  return Math.max(-9999, Math.min(9999, Math.round(n)));
}

export function scoreEventForShiftInstance(args: {
  event: {
    occurredAt: Date;
    direction: EventDirection;
    lastAcceptedOutAt?: Date | null;
  };
  instance: ShiftInstance;
  minimumRestMinutes?: number;
}): OwnershipScoreBreakdown {
  const { event, instance } = args;

  let baseWindowMatch = 0;
  let proximityToStart = 0;
  let proximityToEnd = 0;
  let directionFit = 0;
  let crossDayPenalty = 0;
  let offDayPenalty = 0;
  let postEndInPenalty = 0;
  let restPenalty = 0;

  if (isEventInsideInstanceToleranceWindow(instance, event.occurredAt)) {
    baseWindowMatch += 120;
  } else {
    baseWindowMatch -= 240;
  }

  const startDiff = diffFromPlannedStartMinutes(instance, event.occurredAt);
  const endDiff = diffFromPlannedEndMinutes(instance, event.occurredAt);

  if (startDiff !== null) {
    const absStart = Math.abs(startDiff);
    proximityToStart += Math.max(0, 80 - absStart);
  }

  if (endDiff !== null) {
    const absEnd = Math.abs(endDiff);
    proximityToEnd += Math.max(0, 80 - absEnd);
  }

  if (event.direction === "IN") {
    if (startDiff !== null) {
      if (startDiff <= 0) directionFit += 30;
      if (startDiff > 0) directionFit += Math.max(0, 25 - Math.floor(startDiff / 15));
    }
    if (endDiff !== null && endDiff > 0) {
      postEndInPenalty -= Math.min(180, Math.floor(endDiff));
    }
  } else {
    if (endDiff !== null) {
      if (endDiff >= 0) directionFit += 30;
      if (endDiff < 0) directionFit += Math.max(0, 25 - Math.floor(Math.abs(endDiff) / 15));
    }
  }

  if (
    event.direction === "IN" &&
    event.lastAcceptedOutAt &&
    typeof args.minimumRestMinutes === "number" &&
    args.minimumRestMinutes > 0
  ) {
    const restGap = Math.floor(
      (event.occurredAt.getTime() - event.lastAcceptedOutAt.getTime()) / 60000
    );
    if (restGap >= 0 && restGap < args.minimumRestMinutes) {
      const deficit = args.minimumRestMinutes - restGap;
      // Strong but bounded penalty. We want ownership to resist unrealistic
      // immediate restart attempts without making the score unusable.
      restPenalty -= Math.min(240, Math.max(40, deficit));
    }
  }

  if (instance.source !== "CURRENT_DAY") {
    crossDayPenalty -= 20;
  }

  if (instance.isOffDay) {
    offDayPenalty -= 80;
  }

  const total =
    baseWindowMatch +
    proximityToStart +
    proximityToEnd +
    directionFit +
    crossDayPenalty +
    offDayPenalty +
    postEndInPenalty +
    restPenalty;

  return {
    baseWindowMatch: clampScore(baseWindowMatch),
    proximityToStart: clampScore(proximityToStart),
    proximityToEnd: clampScore(proximityToEnd),
    directionFit: clampScore(directionFit),
    crossDayPenalty: clampScore(crossDayPenalty),
    offDayPenalty: clampScore(offDayPenalty),
    postEndInPenalty: clampScore(postEndInPenalty),
    restPenalty: clampScore(restPenalty),
    total: clampScore(total),
  };
}

export function chooseBestOwnership(args: {
  event: { id?: string; occurredAt: Date; direction: EventDirection; lastAcceptedOutAt?: Date | null };
  candidates: ShiftInstance[];
  minimumRestMinutes?: number;
}): EventOwnershipDecision {
  const ranked = args.candidates
    .map((instance) => {
      const breakdown = scoreEventForShiftInstance({
        event: {
          occurredAt: args.event.occurredAt,
          direction: args.event.direction,
          lastAcceptedOutAt: args.event.lastAcceptedOutAt ?? null,
        },
        instance,
        minimumRestMinutes: args.minimumRestMinutes,
      });

      return {
        instance,
        breakdown,
      };
    })
    .sort((a, b) => {
      if (b.breakdown.total !== a.breakdown.total) {
        return b.breakdown.total - a.breakdown.total;
      }

      if (a.instance.source !== b.instance.source) {
        if (a.instance.source === "CURRENT_DAY") return -1;
        if (b.instance.source === "CURRENT_DAY") return 1;
        if (a.instance.source === "PREVIOUS_DAY") return -1;
        if (b.instance.source === "PREVIOUS_DAY") return 1;
      }

      return a.instance.logicalDayKey.localeCompare(b.instance.logicalDayKey);
    });

  const best = ranked[0];
  if (!best || best.breakdown.total < 0) {
    return {
      rawEventId: args.event.id,
      occurredAt: args.event.occurredAt,
      direction: args.event.direction,
      ownerLogicalDayKey: null,
      ownerSource: null,
      score: best?.breakdown?.total ?? -1,
      breakdown: best?.breakdown ?? {
        baseWindowMatch: 0, proximityToStart: 0, proximityToEnd: 0, directionFit: 0, crossDayPenalty: 0, offDayPenalty: 0, postEndInPenalty: 0, restPenalty: 0, total: -1,
      },
    };
  }

  return {
    rawEventId: args.event.id,
    occurredAt: args.event.occurredAt,
    direction: args.event.direction,
    ownerLogicalDayKey: best.instance.logicalDayKey,
    ownerSource: best.instance.source,
    score: best.breakdown.total,
    breakdown: best.breakdown,
  };
}