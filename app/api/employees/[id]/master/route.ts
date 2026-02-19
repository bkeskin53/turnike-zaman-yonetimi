import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { requireRole } from "@/src/auth/guard";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import { dayKeyToday, dbDateFromDayKey } from "@/src/utils/dayKey";
import { resolveShiftForEmployeeOnDate } from "@/src/services/shiftPlan.service";
import { resolvePolicyRuleSetForEmployeeOnDate } from "@/src/services/policyResolver.service";

function toDayKey(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

type AnomalyCounts = Record<string, number>;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "BAD_ID" }, { status: 400 });

    const companyId = await getActiveCompanyId();
    const bundle = await getCompanyBundle();
    const tz = bundle.policy?.timezone || "Europe/Istanbul";
    const todayKey = dayKeyToday(tz);

    const employee = await prisma.employee.findFirst({
      where: { companyId, id },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        hiredAt: true,
        terminatedAt: true,

        cardNo: true,
        deviceUserId: true,

        branch: { select: { id: true, code: true, name: true } },
        employeeGroup: { select: { id: true, code: true, name: true } },
        employeeSubgroup: { select: { id: true, code: true, name: true, groupId: true, } },

        integrationEmployeeLinks: {
          take: 20,
          orderBy: [{ createdAt: "desc" }],
          select: { id: true, sourceSystem: true, externalRef: true, createdAt: true, lastSeenAt: true },
        },
      },
    });

    if (!employee) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const lastEvent = await prisma.rawEvent.findFirst({
      where: { companyId, employeeId: id },
      orderBy: [{ occurredAt: "desc" }],
      select: {
        id: true,
        occurredAt: true,
        direction: true,
        source: true,
        door: { select: { id: true, name: true, role: true } },
        device: { select: { id: true, name: true, driver: true } },
      },
    });

    const resolvedShift = await resolveShiftForEmployeeOnDate(id, todayKey);

    const policyResolved = await resolvePolicyRuleSetForEmployeeOnDate({
      companyId,
      employeeId: id,
      dayKey: todayKey,
    });

    const startKey = DateTime.fromISO(todayKey, { zone: tz }).startOf("day").minus({ days: 6 }).toISODate()!;
    const startDb = dbDateFromDayKey(startKey);
    const endDb = dbDateFromDayKey(todayKey);

    const last7 = await prisma.dailyAttendance.findMany({
      where: { companyId, employeeId: id, workDate: { gte: startDb, lte: endDb } },
      orderBy: [{ workDate: "asc" }],
      select: {
        workDate: true,
        status: true,
        anomalies: true,
        lateMinutes: true,
        earlyLeaveMinutes: true,
        overtimeMinutes: true,
        workedMinutes: true,
        shiftSource: true,
        shiftSignature: true,
      },
    });

    const anomalyCounts: AnomalyCounts = {};
    let presentDays = 0;
    let offDays = 0;
    let leaveDays = 0;
    let absentDays = 0;
    let anomalyDays = 0;

    let totalLateMinutes = 0;
    let totalEarlyLeaveMinutes = 0;
    let totalWorkedMinutes = 0;
    let totalOvertimeMinutes = 0;

    for (const d of last7) {
      if (d.status === "PRESENT") presentDays += 1;
      else if (d.status === "OFF") offDays += 1;
      else if (d.status === "LEAVE") leaveDays += 1;
      else absentDays += 1;

      totalLateMinutes += d.lateMinutes ?? 0;
      totalEarlyLeaveMinutes += d.earlyLeaveMinutes ?? 0;
      totalWorkedMinutes += d.workedMinutes ?? 0;
      totalOvertimeMinutes += d.overtimeMinutes ?? 0;

      const an = Array.isArray(d.anomalies) ? d.anomalies : [];
      if (an.length > 0) anomalyDays += 1;
      for (const code of an) {
        const k = String(code || "").trim();
        if (!k) continue;
        anomalyCounts[k] = (anomalyCounts[k] ?? 0) + 1;
      }
    }

    return NextResponse.json({
      item: {
        employee: {
          ...employee,
          hiredAt: toDayKey(employee.hiredAt),
          terminatedAt: toDayKey(employee.terminatedAt),
          integrationEmployeeLinks: employee.integrationEmployeeLinks.map((l) => ({
            id: l.id,
            sourceSystem: l.sourceSystem,
            externalRef: l.externalRef,
            createdAt: l.createdAt,
            lastSeenAt: l.lastSeenAt ?? null,
          })),
        },
        today: {
          dayKey: todayKey,
          shift: resolvedShift,
          policyRuleSet: policyResolved
            ? { source: policyResolved.source, assignmentId: policyResolved.assignmentId, ruleSet: policyResolved.ruleSet }
            : null,
          lastEvent: lastEvent
            ? {
                id: lastEvent.id,
                occurredAt: lastEvent.occurredAt,
                direction: lastEvent.direction,
                source: lastEvent.source,
                door: lastEvent.door ?? null,
                device: lastEvent.device ?? null,
              }
            : null,
        },
        last7Days: {
          from: startKey,
          to: todayKey,
          presentDays,
          offDays,
          leaveDays,
          absentDays,
          anomalyDays,
          anomalyCounts,
          totals: {
            lateMinutes: totalLateMinutes,
            earlyLeaveMinutes: totalEarlyLeaveMinutes,
            workedMinutes: totalWorkedMinutes,
            overtimeMinutes: totalOvertimeMinutes,
          },
          days: last7.map((d) => ({
            dayKey: toDayKey(d.workDate),
            status: d.status,
            anomalies: d.anomalies,
            lateMinutes: d.lateMinutes,
            earlyLeaveMinutes: d.earlyLeaveMinutes,
            overtimeMinutes: d.overtimeMinutes,
            workedMinutes: d.workedMinutes,
            shiftSource: d.shiftSource ?? null,
            shiftSignature: d.shiftSignature ?? null,
          })),
        },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    console.error("[api/employees/[id]/master][GET] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}