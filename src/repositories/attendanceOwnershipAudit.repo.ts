import {
  AttendanceOwnershipAuditDisposition,
  AttendanceOwnershipAuditOwnerSource,
  EventDirection,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";

export type OwnershipAuditUpsertInput = {
  companyId: string;
  employeeId: string;
  rawEventId: string;
  logicalDayKey: string;
  occurredAt: Date;
  direction: EventDirection;
  ownerLogicalDayKey?: string | null;
  ownerSource?: AttendanceOwnershipAuditOwnerSource | null;
  ownershipScore?: number | null;
  ownershipBreakdown?: Prisma.JsonValue | null;
  disposition: AttendanceOwnershipAuditDisposition;
  note?: string | null;
  shiftSource?: string | null;
  shiftSignature?: string | null;
};

export async function upsertAttendanceOwnershipAuditsBatch(
  rows: OwnershipAuditUpsertInput[]
) {
  if (!rows.length) return { count: 0 };

  await prisma.$transaction(
    rows.map((row) =>
      prisma.attendanceOwnershipAudit.upsert({
        where: {
          rawEventId_logicalDayKey: {
            rawEventId: row.rawEventId,
            logicalDayKey: row.logicalDayKey,
          },
        },
        create: {
          companyId: row.companyId,
          employeeId: row.employeeId,
          rawEventId: row.rawEventId,
          logicalDayKey: row.logicalDayKey,
          occurredAt: row.occurredAt,
          direction: row.direction,
          ownerLogicalDayKey: row.ownerLogicalDayKey ?? null,
          ownerSource: row.ownerSource ?? null,
          ownershipScore:
            typeof row.ownershipScore === "number" ? Math.round(row.ownershipScore) : null,
          ownershipBreakdown: row.ownershipBreakdown ?? Prisma.JsonNull,
          disposition: row.disposition,
          note: row.note ?? null,
          shiftSource: row.shiftSource ?? null,
          shiftSignature: row.shiftSignature ?? null,
        },
        update: {
          employeeId: row.employeeId,
          occurredAt: row.occurredAt,
          direction: row.direction,
          ownerLogicalDayKey: row.ownerLogicalDayKey ?? null,
          ownerSource: row.ownerSource ?? null,
          ownershipScore:
            typeof row.ownershipScore === "number" ? Math.round(row.ownershipScore) : null,
          ownershipBreakdown: row.ownershipBreakdown ?? Prisma.JsonNull,
          disposition: row.disposition,
          note: row.note ?? null,
          shiftSource: row.shiftSource ?? null,
          shiftSignature: row.shiftSignature ?? null,
        },
      })
    )
  );

  return { count: rows.length };
}

export async function listAttendanceOwnershipAuditForEmployeeDay(args: {
  companyId: string;
  employeeId: string;
  logicalDayKey: string;
}) {
  return prisma.attendanceOwnershipAudit.findMany({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
      logicalDayKey: args.logicalDayKey,
    },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      rawEventId: true,
      logicalDayKey: true,
      occurredAt: true,
      direction: true,
      ownerLogicalDayKey: true,
      ownerSource: true,
      ownershipScore: true,
      ownershipBreakdown: true,
      disposition: true,
      note: true,
      shiftSource: true,
      shiftSignature: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}