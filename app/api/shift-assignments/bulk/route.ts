import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { getActiveCompanyId } from "@/src/services/company.service";
import { getCompanyBundle } from "@/src/services/company.service";
import { getShiftTemplateById } from "@/src/services/shiftTemplate.service";
import { prisma } from "@/src/repositories/prisma";
import { upsertWeeklyShiftPlan } from "@/src/repositories/shiftPlan.repo";
import { auditLog } from "@/src/services/audit.service";
import { computeWeekStartUTC } from "@/src/services/shiftPlan.service";
import { findEmployeesNotOverlappingEmploymentRange } from "@/src/services/employmentGuard.service";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import { RecomputeReason } from "@prisma/client";

function isISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function POST(req: Request) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);

    const companyId = await getActiveCompanyId();
    const body: any = await req.json().catch(() => ({}));

    const weekStartDate = String(body?.weekStartDate ?? "").trim();
    const shiftTemplateId = String(body?.shiftTemplateId ?? "").trim();
    const onlyChanged = body?.onlyChanged !== false; // default true
    const employeeIds: string[] = Array.isArray(body?.employeeIds)
      ? (body.employeeIds as any[])
          .map((x) => String(x).trim())
          .filter((x) => x.length > 0)
      : [];

    if (!weekStartDate) return NextResponse.json({ error: "WEEK_START_REQUIRED" }, { status: 400 });
    if (!isISODate(weekStartDate)) return NextResponse.json({ error: "WEEK_START_INVALID" }, { status: 400 });
    if (!shiftTemplateId) return NextResponse.json({ error: "SHIFT_TEMPLATE_REQUIRED" }, { status: 400 });
    if (employeeIds.length === 0) return NextResponse.json({ error: "EMPLOYEES_REQUIRED" }, { status: 400 });

    const { policy } = await getCompanyBundle();
    const tz = policy.timezone || "Europe/Istanbul";
    const dt = DateTime.fromISO(weekStartDate, { zone: tz });
    if (!dt.isValid) return NextResponse.json({ error: "WEEK_START_INVALID" }, { status: 400 });
    if (dt.weekday !== 1) {
      // Enforce Monday; we don't auto-correct in API to avoid “silent” mis-keys.
      return NextResponse.json({ error: "WEEK_START_MUST_BE_MONDAY" }, { status: 400 });
    }

    // Validate template exists in this company
    const tpl = await getShiftTemplateById(companyId, shiftTemplateId);
    if (!tpl) return NextResponse.json({ error: "SHIFT_TEMPLATE_NOT_FOUND" }, { status: 404 });

    // Ensure all employeeIds belong to this company (cross-company guard)
    const uniq: string[] = Array.from(new Set(employeeIds));
    const existing = await prisma.employee.findMany({
      where: { companyId, id: { in: uniq } },
      select: { id: true },
    });
    if (existing.length !== uniq.length) {
      return NextResponse.json({ error: "EMPLOYEE_NOT_FOUND" }, { status: 404 });
    }

    const weekStartUTC = computeWeekStartUTC(weekStartDate, tz);

    // ✅ Eksik-3: employment validity ile hiç çakışmayan haftaya shift plan yazma (blok)
    const weekEndDate = DateTime.fromISO(weekStartDate, { zone: tz }).plus({ days: 6 }).toISODate()!;
    const notOkIds = await findEmployeesNotOverlappingEmploymentRange({
      companyId,
      employeeIds: uniq,
      fromDayKey: weekStartDate,
      toDayKey: weekEndDate,
    });
    if (notOkIds.length > 0) {
      const bad = await prisma.employee.findMany({
        where: { companyId, id: { in: notOkIds } },
        select: { id: true, employeeCode: true, firstName: true, lastName: true },
        orderBy: [{ employeeCode: "asc" }],
      });
      return NextResponse.json(
        {
          error: "EMPLOYEE_NOT_EMPLOYED_ON_WEEK",
          message: "Bazı personeller seçilen hafta aralığında employment validity dışında olduğu için plan yazılamadı.",
          meta: {
            weekStartDate,
            weekEndDate,
            count: bad.length,
            employees: bad.map((e) => ({
              employeeId: e.id,
              employeeCode: e.employeeCode,
              fullName: `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim(),
            })),
          },
        },
        { status: 400 }
      );
    }

    // Diff guard: skip employees that already have the same week template for this week
    const existingPlans = await prisma.weeklyShiftPlan.findMany({
      where: { companyId, weekStartDate: weekStartUTC, employeeId: { in: uniq } },
      select: { employeeId: true, shiftTemplateId: true },
    });
    const currentByEmployeeId: Record<string, string | null> = {};
    for (const p of existingPlans) currentByEmployeeId[p.employeeId] = p.shiftTemplateId;

    const diffIds: string[] = uniq.filter((employeeId) => (currentByEmployeeId[employeeId] ?? null) !== tpl.id);
    const toUpdate: string[] = onlyChanged ? diffIds : diffIds; // keep idempotent: still only update diffs
    const skipped = uniq.length - toUpdate.length;

    if (toUpdate.length === 0) {
      auditLog({
        action: "SHIFT_ASSIGNMENTS_BULK_WEEK_TEMPLATE",
        companyId,
        actorUserId: session.userId,
        actorRole: session.role,
        ip: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"),
        userAgent: req.headers.get("user-agent"),
        meta: {
          weekStartDate,
          weekStartUTC: weekStartUTC.toISOString(),
          shiftTemplateId: tpl.id,
          requested: uniq.length,
          updated: 0,
          skipped,
          onlyChanged,
        },
      });
      await writeAudit({
        req,
        actorUserId: session.userId,
        actorRole: session.role as unknown as UserRole,
        action: AuditAction.SHIFT_ASSIGNMENT_UPDATED,
        targetType: AuditTargetType.SHIFT_ASSIGNMENT,
        targetId: weekStartDate,
        details: {
          op: "BULK_ASSIGN",
          weekStartDate,
          shiftTemplateId,
          requested: uniq.length,
          updated: 0,
          skipped,
          onlyChanged,
        },
      });
      await markRecomputeRequired({
        companyId,
        reason: RecomputeReason.SHIFT_ASSIGNMENT_UPDATED,
        createdByUserId: session.userId,
        rangeStartDayKey: weekStartDate,
        rangeEndDayKey: weekEndDate,
      });
      return NextResponse.json({ ok: true, updated: 0, skipped, requested: uniq.length });
    }

    await prisma.$transaction(
      toUpdate.map((employeeId) =>
        upsertWeeklyShiftPlan({
          companyId,
          employeeId,
          weekStartDate: weekStartUTC,
          // ONLY week template — day-level overrides/custom minutes stay untouched
          shiftTemplateId: tpl.id,
        })
      )
    );

    auditLog({
      action: "SHIFT_ASSIGNMENTS_BULK_WEEK_TEMPLATE",
      companyId,
      actorUserId: session.userId,
      actorRole: session.role,
      ip: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"),
      userAgent: req.headers.get("user-agent"),
      meta: {
        weekStartDate,
        weekStartUTC: weekStartUTC.toISOString(),
        shiftTemplateId: tpl.id,
        requested: uniq.length,
        updated: toUpdate.length,
        skipped,
        onlyChanged,
      },
    });

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.SHIFT_ASSIGNMENT_UPDATED,
      targetType: AuditTargetType.SHIFT_ASSIGNMENT,
      targetId: weekStartDate,
      details: {
        op: "BULK_ASSIGN",
        weekStartDate,
        shiftTemplateId,
        requested: uniq.length,
        updated: toUpdate.length,
        skipped,
        onlyChanged,
      },
    });

    await markRecomputeRequired({
      companyId,
      reason: RecomputeReason.SHIFT_ASSIGNMENT_UPDATED,
      createdByUserId: session.userId,
      rangeStartDayKey: weekStartDate,
      rangeEndDayKey: weekEndDate,
    });

    return NextResponse.json({ ok: true, updated: toUpdate.length, skipped, requested: uniq.length });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;

    // Route handlers must always return a Response/NextResponse
    console.error("[shift-assignments/bulk] unexpected error", e);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}