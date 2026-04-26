import { Prisma } from "@prisma/client";
import { dbDateFromDayKey } from "@/src/utils/dayKey";
import {
  EmployeeProfileVersionPayload,
} from "@/src/services/employeeHistory.service";
import {
  buildFiniteRangeMutationPlan,
  nextDayKey,
  previousDayKey,
  toDayKey,
} from "@/src/services/employees/finiteRangeHistoryMutation.util";

function sameProfilePayload(a: EmployeeProfileVersionPayload, b: EmployeeProfileVersionPayload): boolean {
  return (
    a.employeeCode === b.employeeCode &&
    a.cardNo === b.cardNo &&
    a.firstName === b.firstName &&
    a.lastName === b.lastName &&
    a.email === b.email &&
    a.nationalId === b.nationalId &&
    a.phone === b.phone &&
    a.gender === b.gender
  );
}

type VersionRow = {
  id: string;
  validFrom: Date;
  validTo: Date | null;
  employeeCode: string;
  cardNo: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  nationalId: string | null;
  phone: string | null;
  gender: string | null;
};

function payloadFromRow(row: VersionRow): EmployeeProfileVersionPayload {
  return {
    employeeCode: row.employeeCode,
    cardNo: row.cardNo ?? null,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email ?? null,
    nationalId: row.nationalId ?? null,
    phone: row.phone ?? null,
    gender: row.gender ?? null,
  };
}

export type EmployeeProfileVersionCurrentSyncErrorCode =
  | "EMPLOYEE_NOT_FOUND"
  | "MULTIPLE_ACTIVE_PROFILE_VERSIONS_FOR_DAY"
  | "NO_ACTIVE_PROFILE_VERSION_FOR_DAY";

export class EmployeeProfileVersionCurrentSyncError extends Error {
  code: EmployeeProfileVersionCurrentSyncErrorCode;
  dayKey: string;

  constructor(code: EmployeeProfileVersionCurrentSyncErrorCode, message: string, dayKey: string) {
    super(message);
    this.name = "EmployeeProfileVersionCurrentSyncError";
    this.code = code;
    this.dayKey = dayKey;
  }
}

export function isEmployeeProfileVersionCurrentSyncError(
  error: unknown,
): error is EmployeeProfileVersionCurrentSyncError {
  return error instanceof EmployeeProfileVersionCurrentSyncError;
}

async function loadVersions(args: {
  tx: Prisma.TransactionClient;
  companyId: string;
  employeeId: string;
}): Promise<VersionRow[]> {
  return args.tx.employeeProfileVersion.findMany({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
    },
    orderBy: [{ validFrom: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      validFrom: true,
      validTo: true,
      employeeCode: true,
      cardNo: true,
      firstName: true,
      lastName: true,
      email: true,
      nationalId: true,
      phone: true,
      gender: true,
    },
  });
}

export async function mergeAdjacentEmployeeProfileVersions(args: {
  tx: Prisma.TransactionClient;
  companyId: string;
  employeeId: string;
}) {
  const rows = await loadVersions(args);
  let mergeCount = 0;

  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1];
    const current = rows[index];
    if (!sameProfilePayload(payloadFromRow(previous), payloadFromRow(current))) continue;

    const previousValidTo = toDayKey(previous.validTo);
    const currentValidFrom = toDayKey(current.validFrom);
    if (!currentValidFrom) continue;

    const contiguous = previousValidTo === null || nextDayKey(previousValidTo) === currentValidFrom;
    if (!contiguous) continue;

    await args.tx.employeeProfileVersion.update({
      where: { id: previous.id },
      data: { validTo: current.validTo },
      select: { id: true },
    });
    await args.tx.employeeProfileVersion.delete({
      where: { id: current.id },
      select: { id: true },
    });
    mergeCount += 1;
  }

  return { mergeCount };
}

function intersectsFiniteRange(args: {
  row: VersionRow;
  startDayKey: string;
  endDayKey: string;
}): boolean {
  const validFromDayKey = toDayKey(args.row.validFrom);
  const validToDayKey = toDayKey(args.row.validTo);
  if (!validFromDayKey) return false;
  if (validFromDayKey > args.endDayKey) return false;
  if (validToDayKey && validToDayKey < args.startDayKey) return false;
  return true;
}

export async function applyEmployeeProfileVersionChange(args: {
  tx: Prisma.TransactionClient;
  companyId: string;
  employeeId: string;
  effectiveDayKey: string;
  payload: EmployeeProfileVersionPayload;
}) {
  const effectiveDb = dbDateFromDayKey(args.effectiveDayKey);
  const versions = await loadVersions(args);

  const covering = versions.find((row) => {
    const from = toDayKey(row.validFrom);
    const to = toDayKey(row.validTo);
    return Boolean(from) && from! <= args.effectiveDayKey && (!to || to >= args.effectiveDayKey);
  }) ?? null;

  const nextVersion = versions.find((row) => {
    const from = toDayKey(row.validFrom);
    return Boolean(from) && from! > args.effectiveDayKey;
  }) ?? null;

  if (covering) {
    const currentPayload = payloadFromRow(covering);
    if (sameProfilePayload(currentPayload, args.payload)) {
      await mergeAdjacentEmployeeProfileVersions({
        tx: args.tx,
        companyId: args.companyId,
        employeeId: args.employeeId,
      });
      return { changed: false, mode: "NO_OP" as const, versionId: covering.id };
    }

    const coveringValidFrom = toDayKey(covering.validFrom);
    const coveringValidTo = toDayKey(covering.validTo);

    if (coveringValidFrom === args.effectiveDayKey) {
      const updated = await args.tx.employeeProfileVersion.update({
        where: { id: covering.id },
        data: { ...args.payload },
        select: { id: true },
      });
      await mergeAdjacentEmployeeProfileVersions({
        tx: args.tx,
        companyId: args.companyId,
        employeeId: args.employeeId,
      });
      return { changed: true, mode: "UPDATE_SAME_DAY" as const, versionId: updated.id };
    }

    await args.tx.employeeProfileVersion.update({
      where: { id: covering.id },
      data: { validTo: dbDateFromDayKey(previousDayKey(args.effectiveDayKey)) },
      select: { id: true },
    });

    const created = await args.tx.employeeProfileVersion.create({
      data: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        validFrom: effectiveDb,
        validTo: coveringValidTo ? dbDateFromDayKey(coveringValidTo) : null,
        ...args.payload,
      },
      select: { id: true },
    });

    await mergeAdjacentEmployeeProfileVersions({
      tx: args.tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });
    return { changed: true, mode: "SPLIT" as const, versionId: created.id };
  }

  const created = await args.tx.employeeProfileVersion.create({
    data: {
      companyId: args.companyId,
      employeeId: args.employeeId,
      validFrom: effectiveDb,
      validTo: nextVersion?.validFrom ? dbDateFromDayKey(previousDayKey(toDayKey(nextVersion.validFrom)!)) : null,
      ...args.payload,
    },
    select: { id: true },
  });

  await mergeAdjacentEmployeeProfileVersions({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
  });

  return { changed: true, mode: "INSERT_GAP" as const, versionId: created.id };
}

export async function applyEmployeeProfileVersionFiniteRangeChange(args: {
  tx: Prisma.TransactionClient;
  companyId: string;
  employeeId: string;
  startDayKey: string;
  endDayKey: string;
  payload: EmployeeProfileVersionPayload;
}) {
  const versions = await loadVersions(args);
  const plan = buildFiniteRangeMutationPlan({
    rows: versions.map((row) => ({
      validFrom: row.validFrom,
      validTo: row.validTo,
      payload: payloadFromRow(row),
    })),
    startDayKey: args.startDayKey,
    endDayKey: args.endDayKey,
    payload: args.payload,
    samePayload: sameProfilePayload,
  });

  if (!plan.changed) {
    const mergeResult = await mergeAdjacentEmployeeProfileVersions({
      tx: args.tx,
      companyId: args.companyId,
      employeeId: args.employeeId,
    });

    return {
      changed: false,
      mode: "NO_OP" as const,
      versionId: null,
      mergedPairCount: mergeResult.mergeCount,
    };
  }

  const startDb = dbDateFromDayKey(args.startDayKey);
  const endDb = dbDateFromDayKey(args.endDayKey);
  const restoreDayKey = nextDayKey(args.endDayKey);

  for (const version of versions.filter((row) =>
    intersectsFiniteRange({
      row,
      startDayKey: args.startDayKey,
      endDayKey: args.endDayKey,
    }),
  )) {
    const validFromDayKey = toDayKey(version.validFrom)!;
    const validToDayKey = toDayKey(version.validTo);
    const overlapsLeft = validFromDayKey < args.startDayKey;
    const overlapsRight = !validToDayKey || validToDayKey > args.endDayKey;

    if (overlapsLeft && overlapsRight) {
      await args.tx.employeeProfileVersion.update({
        where: { id: version.id },
        data: { validTo: dbDateFromDayKey(previousDayKey(args.startDayKey)) },
        select: { id: true },
      });

      await args.tx.employeeProfileVersion.create({
        data: {
          companyId: args.companyId,
          employeeId: args.employeeId,
          validFrom: dbDateFromDayKey(restoreDayKey),
          validTo: validToDayKey ? dbDateFromDayKey(validToDayKey) : null,
          ...payloadFromRow(version),
        },
        select: { id: true },
      });
      continue;
    }

    if (overlapsLeft) {
      await args.tx.employeeProfileVersion.update({
        where: { id: version.id },
        data: { validTo: dbDateFromDayKey(previousDayKey(args.startDayKey)) },
        select: { id: true },
      });
      continue;
    }

    if (overlapsRight) {
      await args.tx.employeeProfileVersion.update({
        where: { id: version.id },
        data: { validFrom: dbDateFromDayKey(restoreDayKey) },
        select: { id: true },
      });
      continue;
    }

    await args.tx.employeeProfileVersion.delete({
      where: { id: version.id },
      select: { id: true },
    });
  }

  const created = await args.tx.employeeProfileVersion.create({
    data: {
      companyId: args.companyId,
      employeeId: args.employeeId,
      validFrom: startDb,
      validTo: endDb,
      ...args.payload,
    },
    select: { id: true },
  });

  const mergeResult = await mergeAdjacentEmployeeProfileVersions({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
  });

  return {
    changed: true,
    mode: "FINITE_RANGE" as const,
    versionId: created.id,
    mergedPairCount: mergeResult.mergeCount,
  };
}

export async function syncEmployeeCurrentProfileFromHistory(args: {
  tx: Prisma.TransactionClient;
  companyId: string;
  employeeId: string;
  dayKey: string;
  strict?: boolean;
}) {
  const targetDb = dbDateFromDayKey(args.dayKey);

  const [employee, activeProfileVersions] = await Promise.all([
    args.tx.employee.findFirst({
      where: { companyId: args.companyId, id: args.employeeId },
      select: {
        id: true,
        employeeCode: true,
        cardNo: true,
        firstName: true,
        lastName: true,
        email: true,
        nationalId: true,
        phone: true,
        gender: true,
      },
    }),
    args.tx.employeeProfileVersion.findMany({
      where: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        AND: [
          { validFrom: { lte: targetDb } },
          { OR: [{ validTo: null }, { validTo: { gte: targetDb } }] },
        ],
      },
      orderBy: [{ validFrom: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: 2,
      select: {
        id: true,
        employeeCode: true,
        cardNo: true,
        firstName: true,
        lastName: true,
        email: true,
        nationalId: true,
        phone: true,
        gender: true,
      },
    }),
  ]);

  if (!employee) {
    throw new EmployeeProfileVersionCurrentSyncError(
      "EMPLOYEE_NOT_FOUND",
      "Çalışan kaydı bulunamadı.",
      args.dayKey,
    );
  }

  if (args.strict && activeProfileVersions.length > 1) {
    throw new EmployeeProfileVersionCurrentSyncError(
      "MULTIPLE_ACTIVE_PROFILE_VERSIONS_FOR_DAY",
      "İstenen gün için birden fazla aktif kimlik sürümü bulundu.",
      args.dayKey,
    );
  }

  const profileVersion = activeProfileVersions[0] ?? null;

  if (!profileVersion && args.strict) {
    throw new EmployeeProfileVersionCurrentSyncError(
      "NO_ACTIVE_PROFILE_VERSION_FOR_DAY",
      "İstenen gün için aktif kimlik sürümü bulunamadı.",
      args.dayKey,
    );
  }

  const payload: EmployeeProfileVersionPayload = profileVersion
    ? {
        employeeCode: profileVersion.employeeCode,
        cardNo: profileVersion.cardNo ?? null,
        firstName: profileVersion.firstName,
        lastName: profileVersion.lastName,
        email: profileVersion.email ?? null,
        nationalId: profileVersion.nationalId ?? null,
        phone: profileVersion.phone ?? null,
        gender: profileVersion.gender ?? null,
      }
    : { 
        employeeCode: employee.employeeCode,
        cardNo: employee.cardNo ?? null,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email ?? null,
        nationalId: employee.nationalId ?? null,
        phone: employee.phone ?? null,
        gender: employee.gender ?? null,
      };

  await args.tx.employee.update({
    where: { id: args.employeeId },
    data: {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      nationalId: payload.nationalId,
      phone: payload.phone,
      gender: payload.gender,
    },
    select: { id: true },
  });

  return payload;
}
