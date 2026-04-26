import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { prisma } from "@/src/repositories/prisma";
import { dayKeyToday } from "@/src/utils/dayKey";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";

function toDayKey(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

type TimelineItemKind =
  | "EMPLOYMENT_START"
  | "EMPLOYMENT_END"
  | "PROFILE_VERSION"
  | "ORG_ASSIGNMENT"
  | "WORK_SCHEDULE";

type TimelineItem = {
  id: string;
  dayKey: string;
  kind: TimelineItemKind;
  title: string;
  subtitle: string;
  rangeLabel: string | null;
  createdAt: string;
};

function rangeLabel(from: Date | null | undefined, to: Date | null | undefined): string | null {
  const a = toDayKey(from);
  const b = toDayKey(to);
  if (!a && !b) return null;
  if (a && b) return `${a} → ${b}`;
  if (a && !b) return `${a} → Açık`;
  return b ? `→ ${b}` : null;
}

function nonEmptyParts(parts: Array<string | null | undefined>): string {
  return parts.map((x) => String(x ?? "").trim()).filter(Boolean).join(" · ");
}

function summarizeProfile(row: {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  nationalId: string | null;
}) {
  const name = `${row.firstName} ${row.lastName}`.trim();
  return (
    nonEmptyParts([
      name || null,
      row.email ? `E-posta: ${row.email}` : null,
      row.phone ? `Telefon: ${row.phone}` : null,
      row.nationalId ? `TC: ${row.nationalId}` : null,
    ]) || "Profil kaydı"
  );
}

function summarizeOrg(row: {
  branch: { code: string; name: string } | null;
  employeeGroup: { code: string; name: string } | null;
  employeeSubgroup: { code: string; name: string } | null;
}) {
  return (
    nonEmptyParts([
      row.branch ? `Lokasyon: ${row.branch.code} — ${row.branch.name}` : null,
      row.employeeGroup ? `Grup: ${row.employeeGroup.code} — ${row.employeeGroup.name}` : null,
      row.employeeSubgroup ? `Alt Grup: ${row.employeeSubgroup.code} — ${row.employeeSubgroup.name}` : null,
    ]) || "Organizasyon kaydı"
  );
}

function summarizeWorkSchedule(row: {
  pattern: { code: string; name: string } | null;
}) {
  if (!row.pattern) return "Çalışma planı ataması";
  return nonEmptyParts([row.pattern.code, row.pattern.name]) || "Çalışma planı ataması";
}

function itemPriority(kind: TimelineItemKind): number {
  switch (kind) {
    case "EMPLOYMENT_END":
      return 1;
    case "WORK_SCHEDULE":
      return 2;
    case "ORG_ASSIGNMENT":
      return 3;
    case "PROFILE_VERSION":
      return 4;
    case "EMPLOYMENT_START":
      return 5;
    default:
      return 99;
  }
}

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
      },
    });

    if (!employee) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const [profileVersions, orgAssignments, workScheduleAssignments, employmentPeriods, employeeActions] =
      await Promise.all([
        prisma.employeeProfileVersion.findMany({
          where: { companyId, employeeId: id },
          orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            validFrom: true,
            validTo: true,
            createdAt: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            nationalId: true,
          },
        }),
        prisma.employeeOrgAssignment.findMany({
          where: { companyId, employeeId: id },
          orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            validFrom: true,
            validTo: true,
            createdAt: true,
            branch: { select: { code: true, name: true } },
            employeeGroup: { select: { code: true, name: true } },
            employeeSubgroup: { select: { code: true, name: true } },
          },
        }),
        prisma.workScheduleAssignment.findMany({
          where: {
            companyId,
            scope: "EMPLOYEE",
            employeeId: id,
          },
          orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            validFrom: true,
            validTo: true,
            createdAt: true,
            pattern: { select: { code: true, name: true } },
          },
        }),
        prisma.employeeEmploymentPeriod.findMany({
          where: { companyId, employeeId: id },
          orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            startDate: true,
            endDate: true,
            reason: true,
            createdAt: true,
          },
        }),
        prisma.employeeAction.findMany({
          where: { companyId, employeeId: id },
          orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
          select: {
            type: true,
            effectiveDate: true,
            note: true,
          },
        }),
      ]);

    const actionNoteMap = new Map<string, string>();
    for (const action of employeeActions) {
      const dayKey = toDayKey(action.effectiveDate);
      if (!dayKey) continue;
      const note = String(action.note ?? "").trim();
      if (!note) continue;
      actionNoteMap.set(`${action.type}:${dayKey}`, note);
    }

    const items: TimelineItem[] = [];

    const profileCount = profileVersions.length;
    profileVersions.forEach((row, index) => {
      const dayKey = toDayKey(row.validFrom);
      if (!dayKey) return;
      items.push({
        id: `profile:${row.id}`,
        dayKey,
        kind: "PROFILE_VERSION",
        title: index === profileCount - 1 ? "İlk Bilinen Profil Kaydı" : "Kimlik / İletişim Güncellemesi",
        subtitle: summarizeProfile(row),
        rangeLabel: rangeLabel(row.validFrom, row.validTo),
        createdAt: row.createdAt.toISOString(),
      });
    });

    const orgCount = orgAssignments.length;
    orgAssignments.forEach((row, index) => {
      const dayKey = toDayKey(row.validFrom);
      if (!dayKey) return;
      items.push({
        id: `org:${row.id}`,
        dayKey,
        kind: "ORG_ASSIGNMENT",
        title: index === orgCount - 1 ? "İlk Bilinen Organizasyon Kaydı" : "Organizasyon Değişikliği",
        subtitle: summarizeOrg(row),
        rangeLabel: rangeLabel(row.validFrom, row.validTo),
        createdAt: row.createdAt.toISOString(),
      });
    });

    workScheduleAssignments.forEach((row) => {
      const dayKey = toDayKey(row.validFrom ?? row.createdAt);
      if (!dayKey) return;
      items.push({
        id: `work-schedule:${row.id}`,
        dayKey,
        kind: "WORK_SCHEDULE",
        title: "Çalışma Planı Değişikliği",
        subtitle: summarizeWorkSchedule(row),
        rangeLabel: rangeLabel(row.validFrom ?? row.createdAt, row.validTo),
        createdAt: row.createdAt.toISOString(),
      });
    });

    employmentPeriods.forEach((row, index) => {
      const startDayKey = toDayKey(row.startDate);
      if (startDayKey) {
        const title = index === 0 ? "İşe Giriş" : "Yeniden İşe Giriş";
        const subtitle =
          actionNoteMap.get(`${index === 0 ? "HIRE" : "REHIRE"}:${startDayKey}`) ||
          String(row.reason ?? "").trim() ||
          "İstihdam dönemi başlangıcı";

        items.push({
          id: `employment-start:${row.id}`,
          dayKey: startDayKey,
          kind: "EMPLOYMENT_START",
          title,
          subtitle,
          rangeLabel: rangeLabel(row.startDate, row.endDate),
          createdAt: row.createdAt.toISOString(),
        });
      }

      const endDayKey = toDayKey(row.endDate);
      if (endDayKey) {
        const subtitle =
          actionNoteMap.get(`TERMINATE:${endDayKey}`) ||
          String(row.reason ?? "").trim() ||
          "İstihdam dönemi sonlandırıldı";

        items.push({
          id: `employment-end:${row.id}`,
          dayKey: endDayKey,
          kind: "EMPLOYMENT_END",
          title: "İstihdam Sonlandırma",
          subtitle,
          rangeLabel: rangeLabel(row.startDate, row.endDate),
          createdAt: row.createdAt.toISOString(),
        });
      }
    });

    items.sort((a, b) => {
      if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? 1 : -1;
      const p = itemPriority(a.kind) - itemPriority(b.kind);
      if (p !== 0) return p;
      return a.createdAt < b.createdAt ? 1 : -1;
    });

    return NextResponse.json({
      item: {
        employee: {
          id: employee.id,
          employeeCode: employee.employeeCode,
          fullName: `${employee.firstName} ${employee.lastName}`.trim(),
        },
        todayDayKey: todayKey,
        items,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    console.error("[api/employees/[id]/history][GET] unexpected error", err);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}