import { prisma } from "@/src/repositories/prisma";
import { getCompanyBundle } from "@/src/services/company.service";
import { buildShiftSignature } from "@/src/services/shiftPlan.service";
import { findOrCreateShiftTemplate } from "@/src/services/shiftTemplate.service";
import {
  createWorkSchedulePattern,
  findWorkSchedulePatternByCode,
  updateWorkSchedulePattern,
} from "@/src/repositories/workSchedule.repo";
import { dbDateFromDayKey } from "@/src/utils/dayKey";

const DEFAULT_REFERENCE_DAY_KEY = "2024-01-01"; // Monday

function minuteToHHMM(min: number): string {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function buildNormDayShiftTemplateIds(templateId: string): Array<string | null> {
  // 5+2 => Mon-Fri work, Sat-Sun off
  return [templateId, templateId, templateId, templateId, templateId, null, null];
}

function buildNorpDayShiftTemplateIds(templateId: string): Array<string | null> {
  // 6+1 => Mon-Sat work, Sun off
  return [templateId, templateId, templateId, templateId, templateId, templateId, null];
}

async function ensurePattern(args: {
  companyId: string;
  code: "NORM" | "NORP";
  name: string;
  dayShiftTemplateIds: Array<string | null>;
}) {
  const existing = await findWorkSchedulePatternByCode(args.companyId, args.code);
  if (existing) {
    if (!existing.isActive) {
      const reactivated = await updateWorkSchedulePattern({
        companyId: args.companyId,
        id: existing.id,
        isActive: true,
      });
      return { created: false, pattern: reactivated };
    }
    return { created: false, pattern: existing };
  }

  const created = await createWorkSchedulePattern({
    companyId: args.companyId,
    code: args.code,
    name: args.name,
    cycleLengthDays: 7,
    referenceDate: dbDateFromDayKey(DEFAULT_REFERENCE_DAY_KEY),
    dayShiftTemplateIds: args.dayShiftTemplateIds,
    isActive: true,
  });

  return { created: true, pattern: created };
}

export async function ensureDefaultWorkSchedulesForActiveCompany() {
  const { company, policy } = await getCompanyBundle();

  const activePatterns = await prisma.workSchedulePattern.findMany({
    where: { companyId: company.id, isActive: true },
    include: { days: { orderBy: { dayIndex: "asc" } } },
    orderBy: [{ createdAt: "desc" }],
  });

  if (activePatterns.length > 0) {
    return {
      item: {
        createdPatternCodes: [] as string[],
        policyFallbackWindow: {
          startTime: minuteToHHMM(policy.shiftStartMinute),
          endTime: minuteToHHMM(policy.shiftEndMinute),
        },
        patterns: activePatterns,
      },
    };
  }

  const fallbackSig = buildShiftSignature(
    minuteToHHMM(policy.shiftStartMinute),
    minuteToHHMM(policy.shiftEndMinute),
  );

  const baseTemplate = await findOrCreateShiftTemplate(company.id, fallbackSig);

  const norm = await ensurePattern({
    companyId: company.id,
    code: "NORM",
    name: "Sabit Beyaz Yaka 5+2",
    dayShiftTemplateIds: buildNormDayShiftTemplateIds(baseTemplate.id),
  });

  const norp = await ensurePattern({
    companyId: company.id,
    code: "NORP",
    name: "Sabit Mavi Yaka 6+1",
    dayShiftTemplateIds: buildNorpDayShiftTemplateIds(baseTemplate.id),
  });

  const patterns = await prisma.workSchedulePattern.findMany({
    where: { companyId: company.id, isActive: true },
    include: { days: { orderBy: { dayIndex: "asc" } } },
    orderBy: [{ createdAt: "desc" }],
  });

  return {
    item: {
      createdPatternCodes: [
        ...(norm.created ? ["NORM"] : []),
        ...(norp.created ? ["NORP"] : []),
      ],
      policyFallbackWindow: {
        startTime: fallbackSig.startTime,
        endTime: fallbackSig.endTime,
      },
      patterns,
    },
  };
}