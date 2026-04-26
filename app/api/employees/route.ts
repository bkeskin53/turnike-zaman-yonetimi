import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireSession } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import { authErrorResponse } from "@/src/auth/http";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import { Prisma } from "@prisma/client";
import { dbDateFromDayKey, dayKeyToday, isISODate } from "@/src/utils/dayKey";
import { UserDataScope } from "@prisma/client";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import { RecomputeReason } from "@prisma/client";
import {
  backfillEmployeeHistoryForEmployee,
  upsertEmployeeOrgAssignment,
  upsertEmployeeProfileVersion,
} from "@/src/services/employeeHistory.service";
import {
  applyEmployeeOnboardingMutation,
  isEmployeeOnboardingMutationError,
} from "@/src/services/employees/employeeOnboardingMutation.service";
import { applyEmployeeWorkScheduleAssignmentChange } from "@/src/services/employees/employeeWorkScheduleAssignmentMutation.service";
import {
  EmployeeCodeSequenceError,
  resolveNextEmployeeCode,
} from "@/src/services/employees/employeeCodeSequence.service";

type CreateEmployeeCodeMode = "AUTO" | "MANUAL";

const AUTO_EMPLOYEE_CODE_CREATE_MAX_ATTEMPTS = 8;

async function requireEmployeesRead() {
  return await requireRole(ROLE_SETS.READ_ALL);
}

function normalizeOptionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeCreateEmployeeCode(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (!/^\d+$/.test(text)) {
    throw new Error("EMPLOYEE_CODE_NUMERIC_ONLY");
  }
  if (text.length > 8) {
    throw new Error("EMPLOYEE_CODE_TOO_LONG");
  }
  return text.padStart(8, "0");
}

function assertValidCreateEmployeeCodeMode(value: unknown): void {
  if (value === undefined || value === null) return;
  const text = String(value).trim().toUpperCase();
  if (!text) return;
  if (text !== "AUTO" && text !== "MANUAL") {
    throw new Error("INVALID_EMPLOYEE_CODE_MODE");
  }
}

function resolveCreateEmployeeCodeMode(value: unknown): CreateEmployeeCodeMode {
  const text = String(value ?? "").trim().toUpperCase();
  return text === "AUTO" ? "AUTO" : "MANUAL";
}

function isEmployeeCodeUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;

  const target = Array.isArray(error.meta?.target)
    ? error.meta.target.map(String)
    : [];

  return target.includes("employeeCode");
}

function normalizeNationalId(value: unknown): string | null {
  const text = normalizeOptionalText(value);
  if (!text) return null;
  return text.replace(/\s+/g, "");
}

function isValidNationalId(value: string): boolean {
  return /^\d{11}$/.test(value);
}

function normalizePhone(value: unknown): string | null {
  const text = normalizeOptionalText(value);
  if (!text) return null;
  return text.replace(/\s+/g, " ");
}

function formatTurkishPhone(localDigits: string): string {
  return `(0${localDigits.slice(0, 3)}) ${localDigits.slice(3, 6)} ${localDigits.slice(6, 8)} ${localDigits.slice(8, 10)}`;
}

function normalizeCreateEmployeePhone(value: unknown): string | null {
  const text = normalizeOptionalText(value);
  if (!text) return null;

  const digits = text.replace(/\D+/g, "");
  let local = digits;

  if (local.startsWith("90") && local.length >= 12) {
    local = local.slice(2);
  }
  if (local.startsWith("0") && local.length >= 11) {
    local = local.slice(1);
  }
  if (local.length !== 10) {
    throw new Error("INVALID_PHONE");
  }

  return formatTurkishPhone(local);
}

function normalizeGender(value: unknown): string | null {
  const text = normalizeOptionalText(value);
  if (!text) return null;

  const upper = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (["ERKEK", "E", "MALE", "M"].includes(upper)) return "MALE";
  if (["KADIN", "K", "FEMALE", "F"].includes(upper)) return "FEMALE";
  if (["DIGER", "DİGER", "OTHER", "O"].includes(upper)) return "OTHER";
  if (["BELIRTILMEDI", "BELIRTILMEDİ", "UNSPECIFIED", "U"].includes(upper)) return "UNSPECIFIED";

  return upper;
}

function isAllowedGender(value: string): boolean {
  return ["MALE", "FEMALE", "OTHER", "UNSPECIFIED"].includes(value);
}

async function resolveValidBranchId(args: { companyId: string; branchId: string | null }): Promise<string | null> {
  const { companyId, branchId } = args;
  if (!branchId) return null;

  const branch = await prisma.branch.findFirst({
    where: {
      id: branchId,
      companyId,
      isActive: true,
    },
    select: { id: true },
  });

  if (!branch) {
    throw new Error("INVALID_BRANCH_ID");
  }

  return branch.id;
}

async function resolveValidWorkSchedulePatternId(args: {
  companyId: string;
  patternId: string | null;
}): Promise<string> {
  const patternId = normalizeOptionalText(args.patternId);
  if (!patternId) {
    throw new Error("WORK_SCHEDULE_REQUIRED");
  }

  const pattern = await prisma.workSchedulePattern.findFirst({
    where: {
      id: patternId,
      companyId: args.companyId,
      isActive: true,
    },
    select: { id: true },
  });

  if (!pattern) {
    throw new Error("INVALID_WORK_SCHEDULE_PATTERN_ID");
  }

  return pattern.id;
}

async function resolveValidEmployeeGroupId(args: {
  companyId: string;
  employeeGroupId: string | null;
}): Promise<string> {
  const employeeGroupId = normalizeOptionalText(args.employeeGroupId);
  if (!employeeGroupId) {
    throw new Error("EMPLOYEE_GROUP_REQUIRED");
  }

  const group = await prisma.employeeGroup.findFirst({
    where: {
      id: employeeGroupId,
      companyId: args.companyId,
    },
    select: { id: true },
  });

  if (!group) {
    throw new Error("INVALID_EMPLOYEE_GROUP_ID");
  }

  return group.id;
}

async function resolveValidEmployeeSubgroup(args: {
  companyId: string;
  employeeSubgroupId: string | null;
}): Promise<{ id: string; groupId: string }> {
  const employeeSubgroupId = normalizeOptionalText(args.employeeSubgroupId);
  if (!employeeSubgroupId) {
    throw new Error("EMPLOYEE_SUBGROUP_REQUIRED");
  }

  const subgroup = await prisma.employeeSubgroup.findFirst({
    where: {
      id: employeeSubgroupId,
      companyId: args.companyId,
    },
    select: {
      id: true,
      groupId: true,
    },
  });

  if (!subgroup) {
    throw new Error("INVALID_EMPLOYEE_SUBGROUP_ID");
  }

  return subgroup;
}

async function upsertEmployeeWorkScheduleAssignment(args: {
  tx: Prisma.TransactionClient;
  companyId: string;
  employeeId: string;
  patternId: string;
  effectiveDayKey: string;
}) {
  return applyEmployeeWorkScheduleAssignmentChange({
    tx: args.tx,
    companyId: args.companyId,
    employeeId: args.employeeId,
    patternId: args.patternId,
    effectiveDayKey: args.effectiveDayKey,
    enforceEmploymentOnEffectiveDate: false,
  });
}

function toDayKey(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function isEmployedOnDate(args: { day: Date; start: Date; end?: Date | null }): boolean {
  const dayMs = args.day.getTime();
  const startMs = args.start.getTime();
  if (dayMs < startMs) return false;
  if (!args.end) return true;
  return dayMs <= args.end.getTime();
}

export async function GET(req: NextRequest) {
  let session: { userId: string; role: any } | null = null;
  try {
    session = await requireEmployeesRead();
  } catch (err) {
    const r = authErrorResponse(err);
    if (r) return r;
    throw err;
  }

  const companyId = await getActiveCompanyId();
  const bundle = await getCompanyBundle();
  const tz = bundle.policy?.timezone || "Europe/Istanbul";
  const todayKey = dayKeyToday(tz);
  const todayDb = dbDateFromDayKey(todayKey);

  // --- Query params (server-side filter + pagination) ---
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = String(url.searchParams.get("status") ?? "ALL").toUpperCase(); // ALL|ACTIVE|PASSIVE
  const branchIdParam = (url.searchParams.get("branchId") ?? "").trim(); // "" => all, "__NULL__" => unassigned

  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(200, Math.max(10, Number(url.searchParams.get("pageSize") ?? "50") || 50));
  const skip = (page - 1) * pageSize;

  const where: any = { companyId };

  if (q) {
    where.OR = [
      { employeeCode: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { nationalId: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { cardNo: { contains: q, mode: "insensitive" } },
      { deviceUserId: { contains: q, mode: "insensitive" } },
    ];
  }

  if (branchIdParam === "__NULL__") {
    where.branchId = null;
  } else if (branchIdParam) {
    where.branchId = branchIdParam;
  }

  // ACTIVE/PASSIVE: employmentPeriods üzerinden (canonical todayDb)
  if (status === "ACTIVE") {
    where.employmentPeriods = {
      some: {
        startDate: { lte: todayDb },
        OR: [{ endDate: null }, { endDate: { gte: todayDb } }],
      },
    };
  } else if (status === "PASSIVE") {
    where.employmentPeriods = {
      none: {
        startDate: { lte: todayDb },
        OR: [{ endDate: null }, { endDate: { gte: todayDb } }],
      },
    };
  }

  // Scope v1 enforcement (Supervisor only)
  if (session?.role === "SUPERVISOR") {
    const u = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        dataScope: true,
        scopeBranchIds: true,
        scopeEmployeeGroupIds: true,
        scopeEmployeeSubgroupIds: true,
        isActive: true,
      },
    });
    if (!u || !u.isActive) {
      return NextResponse.json({ items: [], meta: { todayDayKey: todayKey, total: 0, page, pageSize, totalPages: 1 } });
    }
    const ds = u.dataScope ?? UserDataScope.ALL;
    if (ds === UserDataScope.BRANCH) {
      const ids = u.scopeBranchIds ?? [];
      where.branchId = { in: ids.length ? ids : ["__NONE__"] };
    } else if (ds === UserDataScope.EMPLOYEE_GROUP) {
      const ids = u.scopeEmployeeGroupIds ?? [];
      where.employeeGroupId = { in: ids.length ? ids : ["__NONE__"] };
    } else if (ds === UserDataScope.EMPLOYEE_SUBGROUP) {
      const ids = u.scopeEmployeeSubgroupIds ?? [];
      where.employeeSubgroupId = { in: ids.length ? ids : ["__NONE__"] };
    } // ALL => no-op
  }

  const total = await prisma.employee.count({ where });

  const items = await prisma.employee.findMany({
    where,
    orderBy: [{ employeeCode: "asc" }],
    skip,
    take: pageSize,
    include: {
      employmentPeriods: { orderBy: [{ startDate: "desc" }], take: 1 },
      branch: { select: { id: true, code: true, name: true } },
    },
  });

  const mapped = items.map((e) => {
    const latest = e.employmentPeriods?.[0] ?? null;
    const startKey = toDayKey(latest?.startDate);
    const endKey = toDayKey(latest?.endDate);
    const employedToday = latest ? isEmployedOnDate({ day: todayDb, start: latest.startDate, end: latest.endDate }) : false;
    return {
      id: e.id,
      employeeCode: e.employeeCode,
      firstName: e.firstName,
      lastName: e.lastName,
      nationalId: e.nationalId,
      phone: e.phone,
      gender: e.gender,
      cardNo: e.cardNo,
      deviceUserId: e.deviceUserId,
      email: e.email,
      isActive: e.isActive,
      derivedIsActive: employedToday,
      employment: { startDate: startKey, endDate: endKey },
      branchId: (e as any).branchId ?? null,
      branch: (e as any).branch ?? null,
    };
  });

  return NextResponse.json({
    items: mapped,
    meta: {
      todayDayKey: todayKey,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(ROLE_SETS.OPS_WRITE);
  } catch (err) {
    const r = authErrorResponse(err);
    if (r) return r;
    throw err;
  }
  const session = await requireSession();

  const companyId = await getActiveCompanyId();
  const bundle = await getCompanyBundle();
  const tz = bundle.policy?.timezone || "Europe/Istanbul";
  const todayKey = dayKeyToday(tz);
  const body = await req.json();

  try {
    assertValidCreateEmployeeCodeMode(body.employeeCodeMode);
  } catch (e: any) {
    if (e instanceof Error && e.message === "INVALID_EMPLOYEE_CODE_MODE") {
      return NextResponse.json({ error: "INVALID_EMPLOYEE_CODE_MODE" }, { status: 400 });
    }
    throw e;
  }
  const employeeCodeMode = resolveCreateEmployeeCodeMode(body.employeeCodeMode);

  let employeeCode = "";
  if (employeeCodeMode === "MANUAL") {
    try {
      employeeCode = normalizeCreateEmployeeCode(body.employeeCode);
    } catch (e: any) {
      if (e instanceof Error && e.message === "EMPLOYEE_CODE_NUMERIC_ONLY") {
        return NextResponse.json({ error: "EMPLOYEE_CODE_NUMERIC_ONLY" }, { status: 400 });
      }
      if (e instanceof Error && e.message === "EMPLOYEE_CODE_TOO_LONG") {
        return NextResponse.json({ error: "EMPLOYEE_CODE_TOO_LONG" }, { status: 400 });
      }
      throw e;
    }
  }
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = normalizeOptionalText(body.email);
  const nationalId = normalizeNationalId(body.nationalId);
  let phone: string | null = null;
  try {
    phone = normalizeCreateEmployeePhone(body.phone);
  } catch (e: any) {
    if (e instanceof Error && e.message === "INVALID_PHONE") {
      return NextResponse.json({ error: "INVALID_PHONE" }, { status: 400 });
    }
    throw e;
  }
  const gender = normalizeGender(body.gender);
  const cardNo = normalizeOptionalText(body.cardNo);
  const deviceUserId = normalizeOptionalText(body.deviceUserId);
  const branchIdRaw = normalizeOptionalText(body.branchId);
  const workSchedulePatternIdRaw = normalizeOptionalText(body.workSchedulePatternId);
  const employeeGroupIdRaw = normalizeOptionalText(body.employeeGroupId);
  const employeeSubgroupIdRaw = normalizeOptionalText(body.employeeSubgroupId);
  const startKeyRaw = body.employmentStartDate ? String(body.employmentStartDate).trim() : "";
  const startKey = startKeyRaw ? startKeyRaw : todayKey;
  const reason = normalizeOptionalText(body.employmentReason);

  if (employeeCodeMode === "MANUAL" && !employeeCode) {
    return NextResponse.json({ error: "EMPLOYEE_CODE_REQUIRED" }, { status: 400 });
  }
  if (!firstName) return NextResponse.json({ error: "FIRST_NAME_REQUIRED" }, { status: 400 });
  if (!lastName) return NextResponse.json({ error: "LAST_NAME_REQUIRED" }, { status: 400 });
  if (!nationalId) return NextResponse.json({ error: "NATIONAL_ID_REQUIRED" }, { status: 400 });
  if (nationalId && !isValidNationalId(nationalId)) return NextResponse.json({ error: "INVALID_NATIONAL_ID" }, { status: 400 });
  if (phone && phone.length > 30) return NextResponse.json({ error: "PHONE_TOO_LONG" }, { status: 400 });
  if (gender && !isAllowedGender(gender)) return NextResponse.json({ error: "INVALID_GENDER" }, { status: 400 });
  if (!branchIdRaw) return NextResponse.json({ error: "BRANCH_REQUIRED" }, { status: 400 });
  if (!workSchedulePatternIdRaw) return NextResponse.json({ error: "WORK_SCHEDULE_REQUIRED" }, { status: 400 });
  if (!employeeGroupIdRaw) return NextResponse.json({ error: "EMPLOYEE_GROUP_REQUIRED" }, { status: 400 });
  if (!employeeSubgroupIdRaw) return NextResponse.json({ error: "EMPLOYEE_SUBGROUP_REQUIRED" }, { status: 400 });
  if (cardNo && cardNo.length > 100) return NextResponse.json({ error: "CARD_NO_TOO_LONG" }, { status: 400 });
  if (deviceUserId && deviceUserId.length > 100) return NextResponse.json({ error: "DEVICE_USER_ID_TOO_LONG" }, { status: 400 });
  if (!isISODate(startKey)) return NextResponse.json({ error: "INVALID_START_DATE" }, { status: 400 });

  try {
    const branchId = await resolveValidBranchId({ companyId, branchId: branchIdRaw });
    const workSchedulePatternId = await resolveValidWorkSchedulePatternId({
      companyId,
      patternId: workSchedulePatternIdRaw,
    });
    const employeeGroupId = await resolveValidEmployeeGroupId({
      companyId,
      employeeGroupId: employeeGroupIdRaw,
    });
    const employeeSubgroup = await resolveValidEmployeeSubgroup({
      companyId,
      employeeSubgroupId: employeeSubgroupIdRaw,
    });
    if (employeeSubgroup.groupId !== employeeGroupId) {
      return NextResponse.json({ error: "EMPLOYEE_SUBGROUP_GROUP_MISMATCH" }, { status: 400 });
    }

    async function createWithEmployeeCode(candidateEmployeeCode: string) {
      return prisma.$transaction((tx) =>
        applyEmployeeOnboardingMutation({
          tx,
          companyId,
          todayKey,
          actorUserId: session.userId,
          employeeCode: candidateEmployeeCode,
          firstName,
          lastName,
          email,
          nationalId,
          phone,
          gender,
          cardNo,
          deviceUserId,
          branchId,
          employeeGroupId,
          employeeSubgroupId: employeeSubgroup.id,
          workSchedulePatternId,
          employmentStartDayKey: startKey,
          effectiveDayKey: startKey,
          employmentReason: reason,
        }),
      );
    }

    let created:
      | Awaited<ReturnType<typeof applyEmployeeOnboardingMutation>>
      | null = null;

    if (employeeCodeMode === "AUTO") {
      let nextAutoEmployeeCode = await resolveNextEmployeeCode({ companyId });

      for (let attempt = 0; attempt < AUTO_EMPLOYEE_CODE_CREATE_MAX_ATTEMPTS; attempt += 1) {
        try {
          created = await createWithEmployeeCode(nextAutoEmployeeCode);
          break;
        } catch (error) {
          const canRetry =
            isEmployeeCodeUniqueConstraintError(error) &&
            attempt < AUTO_EMPLOYEE_CODE_CREATE_MAX_ATTEMPTS - 1;

          if (!canRetry) {
            throw error;
          }

          nextAutoEmployeeCode = await resolveNextEmployeeCode({ companyId });
        }
      }
    } else {
      created = await createWithEmployeeCode(employeeCode);
    }

    if (!created) {
      return NextResponse.json({ error: "EMPLOYEE_CODE_TAKEN" }, { status: 409 });
    }

    if (created.workScheduleChanged) {
      await markRecomputeRequired({
        companyId,
        reason: RecomputeReason.WORK_SCHEDULE_UPDATED,
        createdByUserId: session.userId,
        rangeStartDayKey: startKey,
        rangeEndDayKey: null,
      });
    }

    return NextResponse.json(
      {
        item: {
          id: created.employee.id,
          employeeCode: created.employee.employeeCode,
          firstName: created.employee.firstName,
          lastName: created.employee.lastName,
          email: created.employee.email,
          nationalId: created.employee.nationalId,
          phone: created.employee.phone,
          gender: created.employee.gender,
          cardNo: created.employee.cardNo,
          deviceUserId: created.employee.deviceUserId,
          isActive: created.employee.isActive,
          derivedIsActive: created.derivedIsActive,
          employment: { startDate: startKey, endDate: null },
        },
      },
      { status: 201 },
    );
  } catch (e: any) {
    if (isEmployeeOnboardingMutationError(e)) {
      return NextResponse.json({ error: e.code }, { status: 400 });
    }
    if (e instanceof EmployeeCodeSequenceError) {
      if (e.code === "EMPLOYEE_CODE_SEQUENCE_EXHAUSTED") {
        return NextResponse.json({ error: "EMPLOYEE_CODE_SEQUENCE_EXHAUSTED" }, { status: 409 });
      }
    }
    if (e instanceof Error && e.message === "INVALID_BRANCH_ID") {
      return NextResponse.json({ error: "INVALID_BRANCH_ID" }, { status: 400 });
    }
    if (e instanceof Error && e.message === "WORK_SCHEDULE_REQUIRED") {
      return NextResponse.json({ error: "WORK_SCHEDULE_REQUIRED" }, { status: 400 });
    }
    if (e instanceof Error && e.message === "INVALID_WORK_SCHEDULE_PATTERN_ID") {
      return NextResponse.json({ error: "INVALID_WORK_SCHEDULE_PATTERN_ID" }, { status: 400 });
    }
    if (e instanceof Error && e.message === "EMPLOYEE_GROUP_REQUIRED") {
      return NextResponse.json({ error: "EMPLOYEE_GROUP_REQUIRED" }, { status: 400 });
    }
    if (e instanceof Error && e.message === "EMPLOYEE_SUBGROUP_REQUIRED") {
      return NextResponse.json({ error: "EMPLOYEE_SUBGROUP_REQUIRED" }, { status: 400 });
    }
    if (e instanceof Error && e.message === "INVALID_EMPLOYEE_GROUP_ID") {
      return NextResponse.json({ error: "INVALID_EMPLOYEE_GROUP_ID" }, { status: 400 });
    }
    if (e instanceof Error && e.message === "INVALID_EMPLOYEE_SUBGROUP_ID") {
      return NextResponse.json({ error: "INVALID_EMPLOYEE_SUBGROUP_ID" }, { status: 400 });
    }
    // Prisma unique constraint: (companyId, employeeCode)
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = Array.isArray(e.meta?.target) ? e.meta?.target.map(String) : [];
      if (target.includes("employeeCode")) {
        return NextResponse.json({ error: "EMPLOYEE_CODE_TAKEN" }, { status: 409 });
      }
      if (target.includes("cardNo")) {
        return NextResponse.json({ error: "CARD_NO_TAKEN" }, { status: 409 });
      }
      if (target.includes("deviceUserId")) {
        return NextResponse.json({ error: "DEVICE_USER_ID_TAKEN" }, { status: 409 });
      }
      return NextResponse.json(
        { error: "UNIQUE_CONSTRAINT" },
        { status: 409 },
      );
    }
    console.error("employees.POST create failed", e);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireRole(ROLE_SETS.OPS_WRITE);
  } catch (err) {
    const r = authErrorResponse(err);
    if (r) return r;
    throw err;
  }

  const session = await requireSession();
  const companyId = await getActiveCompanyId();
  const bundle = await getCompanyBundle();
  const tz = bundle.policy?.timezone || "Europe/Istanbul";
  const todayKey = dayKeyToday(tz);
  const body = await req.json();

  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "ID_REQUIRED" }, { status: 400 });

  const current = await prisma.employee.findFirst({
    where: { id, companyId },
    select: {
      id: true,
      employeeGroupId: true,
      employeeSubgroupId: true,
    },
  });
  if (!current) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const data: any = {};
  let workSchedulePatternIdResolved: string | null = null;
  let employeeGroupIdResolved: string | null = null;
  let employeeSubgroupIdResolved: string | null = null;
  if (body.employeeCode !== undefined) {
    const employeeCode = String(body.employeeCode).trim();
    if (!employeeCode) return NextResponse.json({ error: "EMPLOYEE_CODE_REQUIRED" }, { status: 400 });
    data.employeeCode = employeeCode;
  }
  if (body.firstName !== undefined) {
    const firstName = String(body.firstName).trim();
    if (!firstName) return NextResponse.json({ error: "FIRST_NAME_REQUIRED" }, { status: 400 });
    data.firstName = firstName;
  }
  if (body.lastName !== undefined) {
    const lastName = String(body.lastName).trim();
    if (!lastName) return NextResponse.json({ error: "LAST_NAME_REQUIRED" }, { status: 400 });
    data.lastName = lastName;
  }
  if (body.email !== undefined) data.email = normalizeOptionalText(body.email);
  if (body.nationalId !== undefined) {
    const nationalId = normalizeNationalId(body.nationalId);
    if (nationalId && !isValidNationalId(nationalId)) {
      return NextResponse.json({ error: "INVALID_NATIONAL_ID" }, { status: 400 });
    }
    data.nationalId = nationalId;
  }
  if (body.phone !== undefined) {
    const phone = normalizePhone(body.phone);
    if (phone && phone.length > 30) {
      return NextResponse.json({ error: "PHONE_TOO_LONG" }, { status: 400 });
    }
    data.phone = phone;
  }
  if (body.gender !== undefined) {
    const gender = normalizeGender(body.gender);
    if (gender && !isAllowedGender(gender)) {
      return NextResponse.json({ error: "INVALID_GENDER" }, { status: 400 });
    }
    data.gender = gender;
  }
  if (body.cardNo !== undefined) {
    const cardNo = normalizeOptionalText(body.cardNo);
    if (cardNo && cardNo.length > 100) {
      return NextResponse.json({ error: "CARD_NO_TOO_LONG" }, { status: 400 });
    }
    data.cardNo = cardNo;
  }
  if (body.deviceUserId !== undefined) {
    const deviceUserId = normalizeOptionalText(body.deviceUserId);
    if (deviceUserId && deviceUserId.length > 100) {
      return NextResponse.json({ error: "DEVICE_USER_ID_TOO_LONG" }, { status: 400 });
    }
    data.deviceUserId = deviceUserId;
  }
  if (body.branchId !== undefined) {
    const branchId = normalizeOptionalText(body.branchId);
    try {
      data.branchId = await resolveValidBranchId({ companyId, branchId });
    } catch (e: any) {
      if (e instanceof Error && e.message === "INVALID_BRANCH_ID") {
        return NextResponse.json({ error: "INVALID_BRANCH_ID" }, { status: 400 });
      }
      throw e;
    }
  }
  if (body.workSchedulePatternId !== undefined) {
    try {
      workSchedulePatternIdResolved = await resolveValidWorkSchedulePatternId({
        companyId,
        patternId: normalizeOptionalText(body.workSchedulePatternId),
      });
    } catch (e: any) {
      if (e instanceof Error && e.message === "WORK_SCHEDULE_REQUIRED") {
        return NextResponse.json({ error: "WORK_SCHEDULE_REQUIRED" }, { status: 400 });
      }
      if (e instanceof Error && e.message === "INVALID_WORK_SCHEDULE_PATTERN_ID") {
        return NextResponse.json({ error: "INVALID_WORK_SCHEDULE_PATTERN_ID" }, { status: 400 });
      }
      throw e;
    }
  }
  const nextEmployeeGroupIdRaw =
    body.employeeGroupId !== undefined
      ? normalizeOptionalText(body.employeeGroupId)
      : current.employeeGroupId;
  const nextEmployeeSubgroupIdRaw =
    body.employeeSubgroupId !== undefined
      ? normalizeOptionalText(body.employeeSubgroupId)
      : current.employeeSubgroupId;
  try {
    employeeGroupIdResolved = await resolveValidEmployeeGroupId({
      companyId,
      employeeGroupId: nextEmployeeGroupIdRaw,
    });
    const subgroup = await resolveValidEmployeeSubgroup({
      companyId,
      employeeSubgroupId: nextEmployeeSubgroupIdRaw,
    });
    if (subgroup.groupId !== employeeGroupIdResolved) {
      return NextResponse.json({ error: "EMPLOYEE_SUBGROUP_GROUP_MISMATCH" }, { status: 400 });
    }
    employeeSubgroupIdResolved = subgroup.id;
    data.employeeGroupId = employeeGroupIdResolved;
    data.employeeSubgroupId = employeeSubgroupIdResolved;
  } catch (e: any) {
    if (e instanceof Error && e.message === "EMPLOYEE_GROUP_REQUIRED") {
      return NextResponse.json({ error: "EMPLOYEE_GROUP_REQUIRED" }, { status: 400 });
    }
    if (e instanceof Error && e.message === "EMPLOYEE_SUBGROUP_REQUIRED") {
      return NextResponse.json({ error: "EMPLOYEE_SUBGROUP_REQUIRED" }, { status: 400 });
    }
    if (e instanceof Error && e.message === "INVALID_EMPLOYEE_GROUP_ID") {
      return NextResponse.json({ error: "INVALID_EMPLOYEE_GROUP_ID" }, { status: 400 });
    }
    if (e instanceof Error && e.message === "INVALID_EMPLOYEE_SUBGROUP_ID") {
      return NextResponse.json({ error: "INVALID_EMPLOYEE_SUBGROUP_ID" }, { status: 400 });
    }
    throw e;
  }
  if (body.isActive !== undefined) return NextResponse.json({ error: "USE_TERMINATE_REHIRE" }, { status: 400 });

  let item;
  try {
    const effectiveDayKey = todayKey;
    const txResult = await prisma.$transaction(async (tx) => {
      const item =
        Object.keys(data).length > 0
          ? await tx.employee.update({
              where: { id, companyId },
              data,
            })
          : await tx.employee.findFirstOrThrow({
              where: { id, companyId },
            });
      
      await backfillEmployeeHistoryForEmployee({
        tx,
        companyId,
        employeeId: id,
      });

      const profileHistoryResult = await upsertEmployeeProfileVersion({
        tx,
        companyId,
        employeeId: id,
        effectiveDayKey,
        payload: {
          employeeCode: item.employeeCode,
          cardNo: item.cardNo ?? null,
          firstName: item.firstName,
          lastName: item.lastName,
          email: item.email ?? null,
          nationalId: item.nationalId ?? null,
          phone: item.phone ?? null,
          gender: item.gender ?? null,
        },
      });

      const orgHistoryResult = await upsertEmployeeOrgAssignment({
        tx,
        companyId,
        employeeId: id,
        effectiveDayKey,
        payload: {
          branchId: item.branchId ?? null,
          employeeGroupId: item.employeeGroupId ?? null,
          employeeSubgroupId: item.employeeSubgroupId ?? null,
        },
      });

      let workScheduleChanged = false;
      if (workSchedulePatternIdResolved) {
        const wsResult = await upsertEmployeeWorkScheduleAssignment({
          tx,
          companyId,
          employeeId: id,
          patternId: workSchedulePatternIdResolved,
          effectiveDayKey,
        });
        workScheduleChanged = wsResult.changed;
      }

      return {
        item,
        workScheduleChanged,
        workforceChanged: orgHistoryResult.changed,
        profileHistoryChanged: profileHistoryResult.changed,
        effectiveDayKey,
      };
    });

    item = txResult.item;

    if (txResult.workScheduleChanged) {
      await markRecomputeRequired({
        companyId,
        reason: RecomputeReason.WORK_SCHEDULE_UPDATED,
        createdByUserId: session.userId,
        rangeStartDayKey: txResult.effectiveDayKey,
        rangeEndDayKey: null,
      });
    }

    if (txResult.workforceChanged) {
      await markRecomputeRequired({
        companyId,
        reason: RecomputeReason.WORKFORCE_UPDATED,
        createdByUserId: session.userId,
        rangeStartDayKey: txResult.effectiveDayKey,
        rangeEndDayKey: null,
      });
    }
  } catch (e: any) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = Array.isArray(e.meta?.target) ? e.meta?.target.map(String) : [];
      if (target.includes("employeeCode")) {
        return NextResponse.json({ error: "EMPLOYEE_CODE_TAKEN" }, { status: 409 });
      }
      if (target.includes("cardNo")) {
        return NextResponse.json({ error: "CARD_NO_TAKEN" }, { status: 409 });
      }
      if (target.includes("deviceUserId")) {
        return NextResponse.json({ error: "DEVICE_USER_ID_TAKEN" }, { status: 409 });
      }
      return NextResponse.json({ error: "UNIQUE_CONSTRAINT" }, { status: 409 });
    }
    throw e;
  }

  return NextResponse.json({ item });
}

// DELETE YOK: Hard delete projeden kaldırıldı.
export async function DELETE() {
  return NextResponse.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });
}
