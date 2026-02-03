import { NextRequest, NextResponse } from "next/server";
import { requireIntegrationApiKey } from "@/src/services/integrationAuth.service";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { DateTime } from "luxon";

export async function GET(req: NextRequest) {
  const auth = requireIntegrationApiKey(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.code, message: auth.message } },
      { status: auth.status }
    );
  }

  const { searchParams } = new URL(req.url);
  const sourceSystem = String(searchParams.get("sourceSystem") ?? "").trim();
  const externalRef = String(searchParams.get("externalRef") ?? "").trim();
  if (!sourceSystem || !externalRef) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "sourceSystem and externalRef are required" } },
      { status: 400 }
    );
  }

  const companyId = await getActiveCompanyId();
  const { policy } = await getCompanyBundle();
  const tz = policy.timezone || "Europe/Istanbul";

  const link = await prisma.integrationWeeklyShiftPlanLink.findFirst({
    where: { companyId, sourceSystem, externalRef },
    include: {
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      weeklyShiftPlan: {
        include: {
          shiftTemplate: { select: { signature: true } },
        },
      },
    },
  });

  if (!link) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "shift plan not found for externalRef" } },
      { status: 404 }
    );
  }

  const p = link.weeklyShiftPlan as any;
  const weekLocal = DateTime.fromJSDate(p.weekStartDate).toUTC().setZone(tz).toISODate();

  return NextResponse.json({
    item: {
      sourceSystem,
      externalRef,
      employee: {
        id: link.employee.id,
        employeeCode: link.employee.employeeCode,
        fullName: `${link.employee.firstName} ${link.employee.lastName}`.trim(),
      },
      weeklyShiftPlan: {
        id: p.id,
        weekStartDateUtc: p.weekStartDate,
        weekStartDateLocal: weekLocal,
        defaultShiftTemplateSignature: p.shiftTemplate?.signature ?? null,
        dayTemplateIds: {
          mon: p.monShiftTemplateId ?? null,
          tue: p.tueShiftTemplateId ?? null,
          wed: p.wedShiftTemplateId ?? null,
          thu: p.thuShiftTemplateId ?? null,
          fri: p.friShiftTemplateId ?? null,
          sat: p.satShiftTemplateId ?? null,
          sun: p.sunShiftTemplateId ?? null,
        },
        dayMinutes: {
          mon: { start: p.monStartMinute ?? null, end: p.monEndMinute ?? null },
          tue: { start: p.tueStartMinute ?? null, end: p.tueEndMinute ?? null },
          wed: { start: p.wedStartMinute ?? null, end: p.wedEndMinute ?? null },
          thu: { start: p.thuStartMinute ?? null, end: p.thuEndMinute ?? null },
          fri: { start: p.friStartMinute ?? null, end: p.friEndMinute ?? null },
          sat: { start: p.satStartMinute ?? null, end: p.satEndMinute ?? null },
          sun: { start: p.sunStartMinute ?? null, end: p.sunEndMinute ?? null },
        },
      },
      lastSeenAt: link.lastSeenAt,
      updatedAt: link.updatedAt,
    },
  });
}

export async function POST() {
  return NextResponse.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });
}
