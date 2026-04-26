import { NextResponse } from "next/server";
import type { PayrollAuditEntityType, PayrollAuditEventType } from "@prisma/client";
import { getSessionOrNull } from "@/src/auth/guard";
import { getEmployeeScopeWhereForSession } from "@/src/auth/scope";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";
import { listPayrollAuditEventsPage } from "@/src/services/puantaj/audit.service";

const ALLOWED_EVENT_TYPES: PayrollAuditEventType[] = [
  "REVIEW_STATUS_CHANGED",
  "REVIEW_NOTE_CHANGED",
  "PERIOD_PRE_CLOSED",
  "PERIOD_CLOSED",
  "PERIOD_REOPENED",
  "SNAPSHOT_CREATED",
  "MONTHLY_EXPORT_CREATED",
  "DAILY_EXPORT_CREATED",
];

const ALLOWED_ENTITY_TYPES: PayrollAuditEntityType[] = [
  "PAYROLL_PERIOD",
  "PAYROLL_PERIOD_SNAPSHOT",
  "DAILY_ATTENDANCE",
  "EMPLOYEE",
  "EXPORT",
];

function isValidMonth(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}$/.test(value);
}

function parseCsvParam(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseTake(value: string | null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.min(Math.max(Math.trunc(n), 1), 200);
}

function parseSkip(value: string | null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(Math.trunc(n), 0);
}

async function resolveScopedEmployeeIds(args: {
  companyId: string;
  session: any;
}) {
  const employeeScopeWhere = await getEmployeeScopeWhereForSession(args.session);
  const isScoped = args.session?.role === "SUPERVISOR";

  if (!isScoped) {
    return {
      isScoped: false,
      employeeIds: null as string[] | null,
    };
  }

  const employees = await prisma.employee.findMany({
    where: {
      companyId: args.companyId,
      ...(employeeScopeWhere ? { AND: [employeeScopeWhere] } : {}),
    },
    select: { id: true },
  });

  return {
    isScoped: true,
    employeeIds: employees.map((x) => x.id),
  };
}

export async function GET(req: Request) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const url = new URL(req.url);
  const month = url.searchParams.get("month");
  const employeeId = url.searchParams.get("employeeId");
  const entityId = url.searchParams.get("entityId");
  const entityType = url.searchParams.get("entityType");
  const take = parseTake(url.searchParams.get("take"));
  const skip = parseSkip(url.searchParams.get("skip"));
  const eventTypesRaw = parseCsvParam(url.searchParams.get("eventTypes"));

  if (month && !isValidMonth(month)) {
    return NextResponse.json({ error: "BAD_MONTH" }, { status: 400 });
  }

  if (entityType && !ALLOWED_ENTITY_TYPES.includes(entityType as PayrollAuditEntityType)) {
    return NextResponse.json({ error: "BAD_ENTITY_TYPE" }, { status: 400 });
  }

  const invalidEventType = eventTypesRaw.find(
    (x) => !ALLOWED_EVENT_TYPES.includes(x as PayrollAuditEventType)
  );
  if (invalidEventType) {
    return NextResponse.json(
      { error: "BAD_EVENT_TYPE", value: invalidEventType },
      { status: 400 }
    );
  }

  const companyId = await getActiveCompanyId();
  const { isScoped, employeeIds } = await resolveScopedEmployeeIds({
    companyId,
    session,
  });

  if (isScoped && employeeId && employeeIds && !employeeIds.includes(employeeId)) {
    return NextResponse.json({ error: "FORBIDDEN_EMPLOYEE" }, { status: 403 });
  }

  const page = await listPayrollAuditEventsPage({
    companyId,
    month,
    employeeId,
    employeeIds,
    includeGlobalEvents: true,
    eventTypes: eventTypesRaw as PayrollAuditEventType[],
    entityType: (entityType as PayrollAuditEntityType | null) ?? null,
    entityId,
    take,
    skip,
  });

  return NextResponse.json({
    ok: true,
    filters: {
      month: month ?? null,
      employeeId: employeeId ?? null,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      eventTypes: eventTypesRaw,
      take,
      skip,
    },
    scope: {
      isScoped,
      employeeScopeCount: employeeIds?.length ?? null,
    },
    page,
  });
}