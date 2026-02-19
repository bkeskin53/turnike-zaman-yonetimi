import { Prisma } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";
import { dbDateFromDayKey } from "@/src/utils/dayKey";

export class EmploymentNotEmployedError extends Error {
  code = "EMPLOYEE_NOT_EMPLOYED_ON_DATE_RANGE" as const;
  meta?: any;

  constructor(message = "Personel belirtilen tarihte iş ilişkisi aralığı dışında.", meta?: any) {
    super(message);
    this.name = "EmploymentNotEmployedError";
    this.meta = meta;
  }
}

type Tx = Prisma.TransactionClient;
type DbClient = typeof prisma | Tx;

function pickDb(db?: DbClient): DbClient {
  return db ?? prisma;
}

/**
 * Asserts employee is employed for the FULL date range [fromDayKey..toDayKey].
 * (Strict mode for HR operations: Leave / Adjustment)
 */
export async function assertEmployeeEmployedForRange(args: {
  employeeId: string;
  fromDayKey: string; // YYYY-MM-DD
  toDayKey: string;   // YYYY-MM-DD
  companyId?: string;
  db?: DbClient;
}) {
  const companyId = args.companyId ?? (await getActiveCompanyId());
  const db = pickDb(args.db);

  const fromDb = dbDateFromDayKey(args.fromDayKey);
  const toDb = dbDateFromDayKey(args.toDayKey);

  const period = await (db as any).employeeEmploymentPeriod.findFirst({
    where: {
      companyId,
      employeeId: args.employeeId,
      startDate: { lte: fromDb },
      OR: [{ endDate: null }, { endDate: { gte: toDb } }],
    },
    select: { id: true },
  });

  if (!period) {
    throw new EmploymentNotEmployedError(
      "Personel belirtilen tarih aralığında iş ilişkisi aralığı dışında.",
      { fromDayKey: args.fromDayKey, toDayKey: args.toDayKey }
    );
  }
}

/**
 * Returns which employees have NO employment overlap with the given range.
 * (Used for weekly shift plan: overlap is enough.)
 */
export async function findEmployeesNotOverlappingEmploymentRange(args: {
  employeeIds: string[];
  fromDayKey: string; // weekStart
  toDayKey: string;   // weekEnd
  companyId?: string;
  db?: DbClient;
}): Promise<string[]> {
  const companyId = args.companyId ?? (await getActiveCompanyId());
  const db = pickDb(args.db);
  const uniq = Array.from(new Set(args.employeeIds)).filter(Boolean);
  if (uniq.length === 0) return [];

  const fromDb = dbDateFromDayKey(args.fromDayKey);
  const toDb = dbDateFromDayKey(args.toDayKey);

  const rows = await (db as any).employeeEmploymentPeriod.findMany({
    where: {
      companyId,
      employeeId: { in: uniq },
      // overlap condition: start <= rangeEnd && (end is null || end >= rangeStart)
      startDate: { lte: toDb },
      OR: [{ endDate: null }, { endDate: { gte: fromDb } }],
    },
    select: { employeeId: true },
  });

  const ok = new Set(rows.map((r: any) => r.employeeId));
  return uniq.filter((id) => !ok.has(id));
}
/**
 * Returns dayKeys from the given list for which the employee is NOT employed.
 * Used for week plans that contain per-day overrides/custom minutes.
 */
export async function findNotEmployedDayKeysForEmployee(args: {
  employeeId: string;
  dayKeys: string[]; // ["YYYY-MM-DD", ...]
  companyId?: string;
  db?: DbClient;
}): Promise<string[]> {
  const companyId = args.companyId ?? (await getActiveCompanyId());
  const db = pickDb(args.db);

  const uniq = Array.from(new Set(args.dayKeys)).filter(Boolean);
  if (uniq.length === 0) return [];

  // We check "employed on that day" by querying employment periods overlap per day.
  // This is small (max 7 days) so it’s safe and explicit.
  const notOk: string[] = [];
  for (const dayKey of uniq) {
    const d = dbDateFromDayKey(dayKey);
    const ok = await (db as any).employeeEmploymentPeriod.findFirst({
      where: {
        companyId,
        employeeId: args.employeeId,
        startDate: { lte: d },
        OR: [{ endDate: null }, { endDate: { gte: d } }],
      },
      select: { id: true },
    });
    if (!ok) notOk.push(dayKey);
  }
  return notOk;
}