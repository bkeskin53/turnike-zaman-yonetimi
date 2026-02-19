import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { DateTime } from "luxon";
import { prisma } from "@/src/repositories/prisma";
import { Prisma } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { dbDateFromDayKey, dayKeyToday, isISODate } from "@/src/utils/dayKey";

async function requireAdminOrHr() {
  const session = await getSessionOrNull();
  if (!session) return null;
  if (session.role !== UserRole.SYSTEM_ADMIN && session.role !== UserRole.HR_OPERATOR) return null;
  return session;
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
  const session = await requireAdminOrHr();
  if (!session) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[api/employees][GET] unauthorized");
    }
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
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
  const session = await requireAdminOrHr();
  if (!session) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[api/employees][POST] unauthorized");
    }
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const companyId = await getActiveCompanyId();
  const bundle = await getCompanyBundle();
  const tz = bundle.policy?.timezone || "Europe/Istanbul";
  const todayKey = dayKeyToday(tz);
  const body = await req.json();

  const employeeCode = String(body.employeeCode ?? "").trim();
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = body.email ? String(body.email).trim() : null;
  const startKeyRaw = body.employmentStartDate ? String(body.employmentStartDate).trim() : "";
  const startKey = startKeyRaw ? startKeyRaw : todayKey;
  const reason = body.employmentReason ? String(body.employmentReason).trim() : null;
  const isActive = body.isActive === false ? false : true;

  if (!employeeCode) return NextResponse.json({ error: "EMPLOYEE_CODE_REQUIRED" }, { status: 400 });
  if (!firstName) return NextResponse.json({ error: "FIRST_NAME_REQUIRED" }, { status: 400 });
  if (!lastName) return NextResponse.json({ error: "LAST_NAME_REQUIRED" }, { status: 400 });
  if (!isISODate(startKey)) return NextResponse.json({ error: "INVALID_START_DATE" }, { status: 400 });

  const startDb = dbDateFromDayKey(startKey);
  const todayDb = dbDateFromDayKey(todayKey);
  const derivedIsActive = isEmployedOnDate({ day: todayDb, start: startDb, end: null });

  let item;
  try {
    const created = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: { companyId, employeeCode, firstName, lastName, email, isActive: derivedIsActive },
      });

      await tx.employeeEmploymentPeriod.create({
        data: { companyId, employeeId: employee.id, startDate: startDb, endDate: null, reason: reason || null },
      });

      await tx.employeeAction.create({
        data: { companyId, employeeId: employee.id, type: "HIRE", effectiveDate: startDb, note: reason || null, actorUserId: session.userId },
      });

      return employee;
    });

    return NextResponse.json(
      { item: { id: created.id, employeeCode: created.employeeCode, firstName: created.firstName, lastName: created.lastName, email: created.email, isActive: created.isActive, derivedIsActive, employment: { startDate: startKey, endDate: null } } },
      { status: 201 },
    );
  } catch (e: any) {
    // Prisma unique constraint: (companyId, employeeCode)
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "EMPLOYEE_CODE_TAKEN" },
        { status: 409 }
      );
    }
    console.error("employees.POST create failed", e);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdminOrHr();
  if (!session) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[api/employees][PUT] unauthorized");
    }
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const companyId = await getActiveCompanyId();
  const body = await req.json();

  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "ID_REQUIRED" }, { status: 400 });

  // Soft delete / update: isActive dahil her şeyi güncelleyebiliriz
  const data: any = {};
  if (body.employeeCode !== undefined) data.employeeCode = String(body.employeeCode).trim();
  if (body.firstName !== undefined) data.firstName = String(body.firstName).trim();
  if (body.lastName !== undefined) data.lastName = String(body.lastName).trim();
  if (body.email !== undefined) data.email = body.email ? String(body.email).trim() : null;
  if (body.isActive !== undefined) return NextResponse.json({ error: "USE_TERMINATE_REHIRE" }, { status: 400 });

  const item = await prisma.employee.update({
    where: { id, companyId },
    data,
  });

  return NextResponse.json({ item });
}

// DELETE YOK: Hard delete projeden kaldırıldı.
export async function DELETE() {
  return NextResponse.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });
}
