import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { WorkScheduleAssignmentScope } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import { dayKeyToday, dbDateFromDayKey, isISODate } from "@/src/utils/dayKey";
import { resolveShiftForEmployeeOnDate } from "@/src/services/shiftPlan.service";
import { resolvePolicyRuleSetForEmployeeOnDate } from "@/src/services/policyResolver.service";
import { resolveEmployeeHistoricalSnapshot } from "@/src/services/employeeHistory.service";
import {
  applyEmployeeMasterProfileVersionedEdit,
  isEmployeeMasterProfileVersionedEditError,
} from "@/src/services/employees/employeeMasterProfileVersionedEdit.service";

function toDayKey(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function resolveRequestedDayKey(req: Request, tz: string): string {
  const url = new URL(req.url);
  const raw = String(url.searchParams.get("asOf") ?? "").trim();
  if (!raw) return dayKeyToday(tz);
  if (!isISODate(raw)) {
    throw new Error("INVALID_ASOF_DAY_KEY");
  }
  return raw;
}

type AnomalyCounts = Record<string, number>;

type ShiftProfileKind = "NONE" | "FIXED" | "VARIABLE";

type WorkScheduleSummary = {
  patternId: string;
  code: string;
  name: string;
  label: string;
};

type WorkDurationSummary = {
  kind: ShiftProfileKind;
  minutes: number | null;
  label: string;
};

type WorkDaysSummary = {
  kind: ShiftProfileKind;
  days: number | null;
  label: string;
};

type ShiftProfileSummary = {
  workSchedule: WorkScheduleSummary | null;
  timeManagementStatus: string | null;
  dailyWork: WorkDurationSummary;
  weeklyWork: WorkDurationSummary;
  weeklyWorkDays: WorkDaysSummary;
};

type PatternForShiftProfile = Prisma.WorkSchedulePatternGetPayload<{
  include: {
    days: {
      select: {
        dayIndex: true;
        shiftTemplateId: true;
      };
    };
  };
}>;

type ShiftTemplateForProfile = {
  id: string;
  startTime: string;
  endTime: string;
  spansMidnight: boolean;
};

function scopeRank(scope: string | null | undefined): number {
  switch (String(scope ?? "").trim()) {
    case "EMPLOYEE":
      return 4;
    case "EMPLOYEE_SUBGROUP":
      return 3;
    case "EMPLOYEE_GROUP":
      return 2;
    case "BRANCH":
      return 1;
    default:
      return 0;
  }
}

function minutesFromTimeString(v: string | null | undefined): number | null {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function shiftDurationMinutes(args: {
  startTime: string | null | undefined;
  endTime: string | null | undefined;
  spansMidnight?: boolean | null | undefined;
}): number | null {
  const start = minutesFromTimeString(args.startTime);
  const end = minutesFromTimeString(args.endTime);
  if (start == null || end == null) return null;
  let diff = end - start;
  if (args.spansMidnight || diff < 0) diff += 24 * 60;
  if (diff < 0) return null;
  return diff;
}

function formatHoursLabelFromMinutes(minutes: number): string {
  const h = minutes / 60;
  if (Number.isInteger(h)) return `${h} sa`;
  return `${h.toFixed(1).replace(".", ",")} sa`;
}

function normalizePatternDayTemplateIds(pattern: PatternForShiftProfile): Array<string | null> {
  const cycle = Number(pattern?.cycleLengthDays ?? 0);
  if (!Number.isInteger(cycle) || cycle <= 0) return [];

  const rows = Array.isArray(pattern?.days) ? pattern.days : [];
  if (rows.length > 0) {
    const out = Array.from({ length: cycle }, () => null as string | null);
    for (const row of rows) {
      const idx = Number(row?.dayIndex);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cycle) continue;
      const tplId = row?.shiftTemplateId ? String(row.shiftTemplateId).trim() : "";
      out[idx] = tplId || null;
    }
    return out;
  }

  const legacy = Array.isArray(pattern?.dayShiftTemplateIds) ? pattern.dayShiftTemplateIds : [];
  return Array.from({ length: cycle }, (_, idx) => {
    const raw = String(legacy[idx] ?? "").trim();
    return raw || null;
  });
}

function summarizePattern(args: { pattern: PatternForShiftProfile; templatesById: Map<string, ShiftTemplateForProfile> }): ShiftProfileSummary {
  const { pattern, templatesById } = args;
  const dayTemplateIds = normalizePatternDayTemplateIds(pattern);
  const cycle = dayTemplateIds.length;

  if (cycle === 0) {
    return {
      workSchedule: {
        patternId: String(pattern?.id ?? ""),
        code: String(pattern?.code ?? ""),
        name: String(pattern?.name ?? ""),
        label: [String(pattern?.code ?? "").trim(), String(pattern?.name ?? "").trim()].filter(Boolean).join(" — ") || "—",
      },
      timeManagementStatus: null,
      dailyWork: { kind: "NONE", minutes: null, label: "—" },
      weeklyWork: { kind: "NONE", minutes: null, label: "—" },
      weeklyWorkDays: { kind: "NONE", days: null, label: "—" },
    };
  }

  const durations: Array<number | null> = dayTemplateIds.map((tplId) => {
    if (!tplId) return null;
    const tpl = templatesById.get(tplId);
    if (!tpl) return null;
    return shiftDurationMinutes({
      startTime: tpl.startTime,
      endTime: tpl.endTime,
      spansMidnight: tpl.spansMidnight,
    });
  });

  const workedDurations = durations.filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
  const uniqueWorkedDurations = Array.from(new Set(workedDurations));

  const dailyWork =
    workedDurations.length === 0
      ? { kind: "NONE" as const, minutes: null, label: "—" }
      : uniqueWorkedDurations.length === 1
        ? {
            kind: "FIXED" as const,
            minutes: uniqueWorkedDurations[0],
            label: formatHoursLabelFromMinutes(uniqueWorkedDurations[0]),
          }
        : { kind: "VARIABLE" as const, minutes: null, label: "Değişken" };

  const weeklyBuckets =
    cycle % 7 === 0
      ? Array.from({ length: cycle / 7 }, (_, weekIndex) => {
          const slice = durations.slice(weekIndex * 7, weekIndex * 7 + 7);
          const totalMinutes = slice.reduce<number>(
            (acc, v) => acc + (typeof v === "number" && Number.isFinite(v) ? v : 0),
            0,
          );
          const workDays = slice.reduce<number>(
            (acc, v) => acc + (typeof v === "number" && Number.isFinite(v) && v > 0 ? 1 : 0),
            0,
          );
          return { totalMinutes, workDays };
        })
      : [];

  const weeklyMinutesValues: number[] = Array.from(new Set(weeklyBuckets.map((x) => x.totalMinutes)));
  const weeklyWorkDaysValues: number[] = Array.from(new Set(weeklyBuckets.map((x) => x.workDays)));

  const weeklyWork =
    weeklyBuckets.length === 0
      ? { kind: "VARIABLE" as const, minutes: null, label: "Değişken" }
      : weeklyMinutesValues.length === 1
        ? {
            kind: "FIXED" as const,
            minutes: weeklyMinutesValues[0],
            label: formatHoursLabelFromMinutes(weeklyMinutesValues[0]),
          }
        : { kind: "VARIABLE" as const, minutes: null, label: "Değişken" };

  const weeklyWorkDays =
    weeklyBuckets.length === 0
      ? { kind: "VARIABLE" as const, days: null, label: "Değişken" }
      : weeklyWorkDaysValues.length === 1
        ? {
            kind: "FIXED" as const,
            days: weeklyWorkDaysValues[0],
            label: `${weeklyWorkDaysValues[0]} gün`,
          }
        : { kind: "VARIABLE" as const, days: null, label: "Değişken" };

  return {
    workSchedule: {
      patternId: String(pattern?.id ?? ""),
      code: String(pattern?.code ?? ""),
      name: String(pattern?.name ?? ""),
      label: [String(pattern?.code ?? "").trim(), String(pattern?.name ?? "").trim()].filter(Boolean).join(" — ") || "—",
    },
    timeManagementStatus: null,
    dailyWork,
    weeklyWork,
    weeklyWorkDays,
  };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "BAD_ID" }, { status: 400 });

    const companyId = await getActiveCompanyId();
    const bundle = await getCompanyBundle();
    const tz = bundle.policy?.timezone || "Europe/Istanbul";
    const todayKey = dayKeyToday(tz);
    const requestedDayKey = resolveRequestedDayKey(req, tz);
    const isHistorical = requestedDayKey !== todayKey;
    const requestedDayStart = DateTime.fromISO(requestedDayKey, { zone: tz }).startOf("day");
    const requestedDayEndExclusiveUtc = requestedDayStart.plus({ days: 1 }).toUTC().toJSDate();

    const employee = await prisma.employee.findFirst({
      where: { companyId, id },
      select: {
        id: true,
        employeeCode: true,

        cardNo: true,
        deviceUserId: true,

        integrationEmployeeLinks: {
          take: 20,
          orderBy: [{ createdAt: "desc" }],
          select: { id: true, sourceSystem: true, externalRef: true, createdAt: true, lastSeenAt: true },
        },
      },
    });

    if (!employee) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const snapshot = await resolveEmployeeHistoricalSnapshot({
      companyId,
      employeeId: id,
      dayKey: requestedDayKey,
    });

    if (!snapshot) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const resolvedEmployeeCode = isHistorical
      ? snapshot.profile.employeeCode
      : employee.employeeCode;
    const resolvedCardNo = isHistorical
      ? snapshot.profile.cardNo
      : employee.cardNo;

    const lastEvent = await prisma.rawEvent.findFirst({
      where: {
        companyId,
        employeeId: id,
        occurredAt: {
          lt: requestedDayEndExclusiveUtc,
        },
      },
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

    const resolvedShift = await resolveShiftForEmployeeOnDate(id, requestedDayKey, snapshot.org.context);

    const policyResolved = await resolvePolicyRuleSetForEmployeeOnDate({
      companyId,
      employeeId: id,
      dayKey: requestedDayKey,
      employeeContext: snapshot.org.context,
    });

    const requestedDb = dbDateFromDayKey(requestedDayKey);

    const scopeFilters: Prisma.WorkScheduleAssignmentWhereInput[] = [
      { scope: WorkScheduleAssignmentScope.EMPLOYEE, employeeId: id },
    ];

    if (snapshot.org.context.employeeSubgroupId) {
      scopeFilters.push({
        scope: WorkScheduleAssignmentScope.EMPLOYEE_SUBGROUP,
        employeeSubgroupId: snapshot.org.context.employeeSubgroupId,
      });
    }

    if (snapshot.org.context.employeeGroupId) {
      scopeFilters.push({
        scope: WorkScheduleAssignmentScope.EMPLOYEE_GROUP,
        employeeGroupId: snapshot.org.context.employeeGroupId,
      });
    }

    if (snapshot.org.context.branchId) {
      scopeFilters.push({
        scope: WorkScheduleAssignmentScope.BRANCH,
        branchId: snapshot.org.context.branchId,
      });
    }

    const wsAssignments = await prisma.workScheduleAssignment.findMany({
      where: {
        companyId,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: requestedDb } }] },
          { OR: [{ validTo: null }, { validTo: { gte: requestedDb } }] },
        ],
        OR: scopeFilters,
      },
      include: {
        pattern: {
          include: {
            days: {
              select: {
                dayIndex: true,
                shiftTemplateId: true,
              },
            },
          },
        },
      },
    });

    const activeWsAssignments = wsAssignments.filter((a) => a.pattern?.isActive);
    activeWsAssignments.sort((a, b) => {
      const sr = scopeRank(String(a.scope)) - scopeRank(String(b.scope));
      if (sr !== 0) return -sr;
      const pr = (a.priority ?? 0) - (b.priority ?? 0);
      if (pr !== 0) return -pr;
      const updatedDelta = (b.updatedAt?.getTime?.() ?? 0) - (a.updatedAt?.getTime?.() ?? 0);
      if (updatedDelta !== 0) return updatedDelta;
      return (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0);
    });

    const chosenWsAssignment = activeWsAssignments[0] ?? null;
    const chosenPattern = chosenWsAssignment?.pattern ?? null;

    let shiftProfile: ShiftProfileSummary = {
      workSchedule: null,
      timeManagementStatus: null,
      dailyWork: { kind: "NONE", minutes: null, label: "—" },
      weeklyWork: { kind: "NONE", minutes: null, label: "—" },
      weeklyWorkDays: { kind: "NONE", days: null, label: "—" },
    };

    if (chosenPattern) {
      const dayTemplateIds = normalizePatternDayTemplateIds(chosenPattern);
      const templateIds = Array.from(
        new Set(
          dayTemplateIds
            .map((x) => String(x ?? "").trim())
            .filter(Boolean),
        ),
      );

      const templates = templateIds.length
        ? await prisma.shiftTemplate.findMany({
            where: { companyId, id: { in: templateIds } },
            select: {
              id: true,
              startTime: true,
              endTime: true,
              spansMidnight: true,
            },
          })
        : [];

      const templatesById = new Map<string, ShiftTemplateForProfile>(templates.map((tpl) => [tpl.id, tpl]));
      shiftProfile = summarizePattern({ pattern: chosenPattern, templatesById });
    }

    const startKey = DateTime.fromISO(requestedDayKey, { zone: tz }).startOf("day").minus({ days: 6 }).toISODate()!;
    const startDb = dbDateFromDayKey(startKey);
    const endDb = dbDateFromDayKey(requestedDayKey);

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
          id: employee.id,
          employeeCode: resolvedEmployeeCode,
          firstName: snapshot.profile.firstName,
          lastName: snapshot.profile.lastName,
          email: snapshot.profile.email,
          nationalId: snapshot.profile.nationalId,
          phone: snapshot.profile.phone,
          gender: snapshot.profile.gender,
          isActive: snapshot.employment.isEmployed,
          hiredAt: snapshot.employment.startDate,
          terminatedAt: snapshot.employment.endDate,
          cardNo: resolvedCardNo,
          deviceUserId: employee.deviceUserId,
          branch: snapshot.org.branch,
          employeeGroup: snapshot.org.employeeGroup,
          employeeSubgroup: snapshot.org.employeeSubgroup
            ? {
                ...snapshot.org.employeeSubgroup,
                groupId: snapshot.org.context.employeeGroupId ?? "",
              }
            : null,
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
          shiftProfile,
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
        history: {
          dayKey: requestedDayKey,
          todayDayKey: todayKey,
          isHistorical,
          canEdit: !isHistorical,
          mode: isHistorical ? "AS_OF" : "CURRENT",
          profileSource: snapshot.meta.profileSource,
          orgSource: snapshot.meta.orgSource,
        },
        last7Days: {
          from: startKey,
          to: requestedDayKey,
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
      policy: {
        timezone: tz,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "INVALID_ASOF_DAY_KEY") return NextResponse.json({ error: "INVALID_ASOF_DAY_KEY" }, { status: 400 });
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    console.error("[api/employees/[id]/master][GET] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(ROLE_SETS.OPS_WRITE);
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "BAD_ID" }, { status: 400 });

    const companyId = await getActiveCompanyId();
    const bundle = await getCompanyBundle();
    const tz = bundle.policy?.timezone || "Europe/Istanbul";
    const todayKey = dayKeyToday(tz);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const result = await applyEmployeeMasterProfileVersionedEdit({
      companyId,
      employeeId: id,
      actorUserId: session.userId,
      todayKey,
      body,
    });

    return NextResponse.json({ item: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (isEmployeeMasterProfileVersionedEditError(err)) {
      const status =
        err.code === "EMPLOYEE_NOT_FOUND"
          ? 404
          : err.code === "EMPLOYEE_CODE_TAKEN" ||
              err.code === "CARD_NO_TAKEN" ||
              err.code === "UNIQUE_CONSTRAINT" ||
              err.code === "MULTIPLE_ACTIVE_PROFILE_VERSIONS_FOR_TODAY" ||
              err.code === "NO_ACTIVE_PROFILE_VERSION_FOR_TODAY"
            ? 409
            : 400;
      return NextResponse.json({ error: err.code }, { status });
    }
    console.error("[api/employees/[id]/master][PATCH] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
