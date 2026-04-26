import { DateTime } from "luxon";
import { Prisma } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { dbDateFromDayKey } from "@/src/utils/dayKey";

export type EmployeeProfileVersionPayload = {
  employeeCode: string;
  cardNo: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  nationalId: string | null;
  phone: string | null;
  gender: string | null;
};

export type EmployeeOrgContext = {
  branchId: string | null;
  employeeGroupId: string | null;
  employeeSubgroupId: string | null;
};

export type EmployeeHistoricalRef = {
  id: string;
  code: string | null;
  name: string | null;
};

export type EmployeeHistoricalSnapshot = {
  employeeId: string;
  dayKey: string;
  profile: EmployeeProfileVersionPayload;
  org: {
    context: EmployeeOrgContext;
    branch: EmployeeHistoricalRef | null;
    employeeGroup: EmployeeHistoricalRef | null;
    employeeSubgroup: EmployeeHistoricalRef | null;
  };
  employment: {
    periodId: string | null;
    isEmployed: boolean;
    startDate: string | null;
    endDate: string | null;
  };
  meta: {
    profileSource: "VERSION" | "CURRENT_FALLBACK";
    orgSource: "ASSIGNMENT" | "CURRENT_FALLBACK";
  };
};

function toDayKey(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function previousDayKey(dayKey: string): string {
  return DateTime.fromISO(dayKey, { zone: "UTC" }).minus({ days: 1 }).toISODate()!;
}

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

function sameOrgPayload(a: EmployeeOrgContext, b: EmployeeOrgContext): boolean {
  return (
    a.branchId === b.branchId &&
    a.employeeGroupId === b.employeeGroupId &&
    a.employeeSubgroupId === b.employeeSubgroupId
  );
}

function buildProfilePayloadFromEmployee(employee: {
  employeeCode: string;
  cardNo: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  nationalId: string | null;
  phone: string | null;
  gender: string | null;
}): EmployeeProfileVersionPayload {
  return {
    employeeCode: employee.employeeCode,
    cardNo: employee.cardNo ?? null,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email ?? null,
    nationalId: employee.nationalId ?? null,
    phone: employee.phone ?? null,
    gender: employee.gender ?? null,
  };
}

function buildOrgPayloadFromEmployee(employee: {
  branchId: string | null;
  employeeGroupId: string | null;
  employeeSubgroupId: string | null;
}): EmployeeOrgContext {
  return {
    branchId: employee.branchId ?? null,
    employeeGroupId: employee.employeeGroupId ?? null,
    employeeSubgroupId: employee.employeeSubgroupId ?? null,
  };
}

async function resolveHistoryAnchorDayKey(args: {
  tx: Prisma.TransactionClient;
  companyId: string;
  employeeId: string;
  employeeCreatedAt: Date;
}): Promise<string> {
  const earliestEmployment = await args.tx.employeeEmploymentPeriod.findFirst({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
    },
    orderBy: [{ startDate: "asc" }],
    select: { startDate: true },
  });
  return toDayKey(earliestEmployment?.startDate) ?? toDayKey(args.employeeCreatedAt) ?? DateTime.now().toISODate()!;
}

export async function backfillEmployeeHistoryForEmployee(args: {
  tx: Prisma.TransactionClient;
  companyId: string;
  employeeId: string;
}): Promise<{ createdProfileVersion: boolean; createdOrgAssignment: boolean; anchorDayKey: string }> {
  const employee = await args.tx.employee.findFirst({
    where: { companyId: args.companyId, id: args.employeeId },
    select: {
      id: true,
      createdAt: true,
      employeeCode: true,
      cardNo: true,
      firstName: true,
      lastName: true,
      email: true,
      nationalId: true,
      phone: true,
      gender: true,
      branchId: true,
      employeeGroupId: true,
      employeeSubgroupId: true,
    },
  });

  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }

  const anchorDayKey = await resolveHistoryAnchorDayKey({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
    employeeCreatedAt: employee.createdAt,
  });
  const anchorDb = dbDateFromDayKey(anchorDayKey);

  let createdProfileVersion = false;
  let createdOrgAssignment = false;

  const existingProfile = await args.tx.employeeProfileVersion.findFirst({
    where: { companyId: args.companyId, employeeId: args.employeeId },
    select: { id: true },
  });

  if (!existingProfile) {
    await args.tx.employeeProfileVersion.create({
      data: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        validFrom: anchorDb,
        validTo: null,
        ...buildProfilePayloadFromEmployee(employee),
      },
      select: { id: true },
    });
    createdProfileVersion = true;
  }

  const existingOrg = await args.tx.employeeOrgAssignment.findFirst({
    where: { companyId: args.companyId, employeeId: args.employeeId },
    select: { id: true },
  });

  if (!existingOrg) {
    await args.tx.employeeOrgAssignment.create({
      data: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        validFrom: anchorDb,
        validTo: null,
        ...buildOrgPayloadFromEmployee(employee),
      },
      select: { id: true },
    });
    createdOrgAssignment = true;
  }

  return { createdProfileVersion, createdOrgAssignment, anchorDayKey };
}

export async function backfillEmployeeHistoryForCompany(args: { companyId: string }) {
  const employees = await prisma.employee.findMany({
    where: { companyId: args.companyId },
    select: { id: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  let createdProfileVersionCount = 0;
  let createdOrgAssignmentCount = 0;

  for (const employee of employees) {
    const result = await prisma.$transaction((tx) =>
      backfillEmployeeHistoryForEmployee({
        tx,
        companyId: args.companyId,
        employeeId: employee.id,
      }),
    );

    if (result.createdProfileVersion) createdProfileVersionCount += 1;
    if (result.createdOrgAssignment) createdOrgAssignmentCount += 1;
  }

  return {
    employeeCount: employees.length,
    createdProfileVersionCount,
    createdOrgAssignmentCount,
  };
}

export async function upsertEmployeeProfileVersion(args: {
  tx: Prisma.TransactionClient;
  companyId: string;
  employeeId: string;
  effectiveDayKey: string;
  payload: EmployeeProfileVersionPayload;
}) {
  const effectiveDb = dbDateFromDayKey(args.effectiveDayKey);

  const current = await args.tx.employeeProfileVersion.findFirst({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
      AND: [
        { validFrom: { lte: effectiveDb } },
        { OR: [{ validTo: null }, { validTo: { gte: effectiveDb } }] },
      ],
    },
    orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      validFrom: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      cardNo: true,
      email: true,
      nationalId: true,
      phone: true,
      gender: true,
    },
  });

  if (!current) {
    const created = await args.tx.employeeProfileVersion.create({
      data: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        validFrom: effectiveDb,
        validTo: null,
        ...args.payload,
      },
      select: { id: true },
    });
    return { changed: true, versionId: created.id };
  }

  const currentPayload: EmployeeProfileVersionPayload = {
    employeeCode: current.employeeCode,
    cardNo: current.cardNo ?? null,
    firstName: current.firstName,
    lastName: current.lastName,
    email: current.email ?? null,
    nationalId: current.nationalId ?? null,
    phone: current.phone ?? null,
    gender: current.gender ?? null,
  };

  if (sameProfilePayload(currentPayload, args.payload)) {
    return { changed: false, versionId: current.id };
  }

  if (toDayKey(current.validFrom) === args.effectiveDayKey) {
    const updated = await args.tx.employeeProfileVersion.update({
      where: { id: current.id },
      data: { ...args.payload },
      select: { id: true },
    });
    return { changed: true, versionId: updated.id };
  }

  await args.tx.employeeProfileVersion.update({
    where: { id: current.id },
    data: { validTo: dbDateFromDayKey(previousDayKey(args.effectiveDayKey)) },
    select: { id: true },
  });

  const created = await args.tx.employeeProfileVersion.create({
    data: {
      companyId: args.companyId,
      employeeId: args.employeeId,
      validFrom: effectiveDb,
      validTo: null,
      ...args.payload,
    },
    select: { id: true },
  });

  return { changed: true, versionId: created.id };
}

export async function upsertEmployeeOrgAssignment(args: {
  tx: Prisma.TransactionClient;
  companyId: string;
  employeeId: string;
  effectiveDayKey: string;
  payload: EmployeeOrgContext;
}) {
  const effectiveDb = dbDateFromDayKey(args.effectiveDayKey);

  const current = await args.tx.employeeOrgAssignment.findFirst({
    where: {
      companyId: args.companyId,
      employeeId: args.employeeId,
      AND: [
        { validFrom: { lte: effectiveDb } },
        { OR: [{ validTo: null }, { validTo: { gte: effectiveDb } }] },
      ],
    },
    orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      validFrom: true,
      branchId: true,
      employeeGroupId: true,
      employeeSubgroupId: true,
    },
  });

  if (!current) {
    const created = await args.tx.employeeOrgAssignment.create({
      data: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        validFrom: effectiveDb,
        validTo: null,
        ...args.payload,
      },
      select: { id: true },
    });
    return { changed: true, assignmentId: created.id };
  }

  const currentPayload: EmployeeOrgContext = {
    branchId: current.branchId ?? null,
    employeeGroupId: current.employeeGroupId ?? null,
    employeeSubgroupId: current.employeeSubgroupId ?? null,
  };

  if (sameOrgPayload(currentPayload, args.payload)) {
    return { changed: false, assignmentId: current.id };
  }

  if (toDayKey(current.validFrom) === args.effectiveDayKey) {
    const updated = await args.tx.employeeOrgAssignment.update({
      where: { id: current.id },
      data: { ...args.payload },
      select: { id: true },
    });
    return { changed: true, assignmentId: updated.id };
  }

  await args.tx.employeeOrgAssignment.update({
    where: { id: current.id },
    data: { validTo: dbDateFromDayKey(previousDayKey(args.effectiveDayKey)) },
    select: { id: true },
  });

  const created = await args.tx.employeeOrgAssignment.create({
    data: {
      companyId: args.companyId,
      employeeId: args.employeeId,
      validFrom: effectiveDb,
      validTo: null,
      ...args.payload,
    },
    select: { id: true },
  });

  return { changed: true, assignmentId: created.id };
}

export async function resolveEmployeeHistoricalSnapshot(args: {
  companyId: string;
  employeeId: string;
  dayKey: string;
}): Promise<EmployeeHistoricalSnapshot | null> {
  const targetDb = dbDateFromDayKey(args.dayKey);

  const employee = await prisma.employee.findFirst({
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
      branchId: true,
      employeeGroupId: true,
      employeeSubgroupId: true,
    },
  });

  if (!employee) return null;

  const [profileVersion, orgAssignment, employmentPeriod] = await Promise.all([
    prisma.employeeProfileVersion.findFirst({
      where: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        AND: [
          { validFrom: { lte: targetDb } },
          { OR: [{ validTo: null }, { validTo: { gte: targetDb } }] },
        ],
      },
      orderBy: [{ validFrom: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: {
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
    prisma.employeeOrgAssignment.findFirst({
      where: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        AND: [
          { validFrom: { lte: targetDb } },
          { OR: [{ validTo: null }, { validTo: { gte: targetDb } }] },
        ],
      },
      orderBy: [{ validFrom: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: {
        branchId: true,
        employeeGroupId: true,
        employeeSubgroupId: true,
      },
    }),
    prisma.employeeEmploymentPeriod.findFirst({
      where: {
        companyId: args.companyId,
        employeeId: args.employeeId,
        AND: [{ startDate: { lte: targetDb } }, { OR: [{ endDate: null }, { endDate: { gte: targetDb } }] }],
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        startDate: true,
        endDate: true,
      },
    }),
  ]);

  const profile: EmployeeProfileVersionPayload = profileVersion
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
    : buildProfilePayloadFromEmployee(employee);

  const orgContext: EmployeeOrgContext = orgAssignment
    ? {
        branchId: orgAssignment.branchId ?? null,
        employeeGroupId: orgAssignment.employeeGroupId ?? null,
        employeeSubgroupId: orgAssignment.employeeSubgroupId ?? null,
      }
    : buildOrgPayloadFromEmployee(employee);

  const [branch, employeeGroup, employeeSubgroup] = await Promise.all([
    orgContext.branchId
      ? prisma.branch.findFirst({
          where: { companyId: args.companyId, id: orgContext.branchId },
          select: { id: true, code: true, name: true },
        })
      : Promise.resolve(null),
    orgContext.employeeGroupId
      ? prisma.employeeGroup.findFirst({
          where: { companyId: args.companyId, id: orgContext.employeeGroupId },
          select: { id: true, code: true, name: true },
        })
      : Promise.resolve(null),
    orgContext.employeeSubgroupId
      ? prisma.employeeSubgroup.findFirst({
          where: { companyId: args.companyId, id: orgContext.employeeSubgroupId },
          select: { id: true, code: true, name: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    employeeId: employee.id,
    dayKey: args.dayKey,
    profile,
    org: {
      context: orgContext,
      branch: branch ? { id: branch.id, code: branch.code, name: branch.name } : null,
      employeeGroup: employeeGroup ? { id: employeeGroup.id, code: employeeGroup.code, name: employeeGroup.name } : null,
      employeeSubgroup: employeeSubgroup ? { id: employeeSubgroup.id, code: employeeSubgroup.code, name: employeeSubgroup.name } : null,
    },
    employment: {
      periodId: employmentPeriod?.id ?? null,
      isEmployed: Boolean(employmentPeriod),
      startDate: toDayKey(employmentPeriod?.startDate),
      endDate: toDayKey(employmentPeriod?.endDate),
    },
    meta: {
      profileSource: profileVersion ? "VERSION" : "CURRENT_FALLBACK",
      orgSource: orgAssignment ? "ASSIGNMENT" : "CURRENT_FALLBACK",
    },
  };
}
