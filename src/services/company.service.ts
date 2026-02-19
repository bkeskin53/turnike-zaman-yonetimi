import { getSetting, upsertSetting } from "@/src/repositories/systemSetting.repo";
import {
  createCompanyWithDefaultPolicy,
  findCompanyById,
  updateCompanyName,
  upsertPolicy,
} from "@/src/repositories/company.repo";

const ACTIVE_COMPANY_KEY = "ACTIVE_COMPANY_ID";

/**
 * V1: Tek company varsayımı.
 * - Önce SystemSetting(ACTIVE_COMPANY_ID) oku.
 * - Eğer setting bozuk / company yoksa yeni company oluştur (default policy ile).
 * - Her durumda setting'i güncellemeyi dener (best-effort).
 *
 * Amaç: SystemSetting kaynaklı Prisma/DB hatası olsa bile API'ler 500 ile patlamasın.
 */
async function ensureActiveCompanyId(): Promise<string> {
  // 1) SystemSetting ile dene (hata verirse swallow + fallback)
  try {
    const existing = await getSetting(ACTIVE_COMPANY_KEY);

    if (existing?.value) {
      try {
        const company = await findCompanyById(existing.value);
        if (company) return company.id;
      } catch (err) {
        // company lookup hatası -> fallback
        console.warn("ensureActiveCompanyId: findCompanyById failed", err);
      }
    }
  } catch (err) {
    console.warn("ensureActiveCompanyId: getSetting failed", err);
  }

  // 2) Fallback: Company yoksa/setting bozuksa yeni company oluştur
  const name = process.env.SEED_COMPANY_NAME ?? "Default Company";
  const company = await createCompanyWithDefaultPolicy(name);

  // 3) Best-effort: setting'e yaz (yazamazsa da devam)
  try {
    await upsertSetting(ACTIVE_COMPANY_KEY, company.id);
  } catch (err) {
    console.warn("ensureActiveCompanyId: upsertSetting failed", err);
  }

  return company.id;
}

export async function getActiveCompanyId() {
  return ensureActiveCompanyId();
}

export async function getCompanyBundle() {
  const companyId = await ensureActiveCompanyId();

  let company: Awaited<ReturnType<typeof findCompanyById>> | null = null;
  try {
    company = await findCompanyById(companyId);
  } catch (err) {
    console.warn("getCompanyBundle: findCompanyById failed", err);
  }

  if (!company) {
    // Bu durumda companyId'nin pointing ettiği company yok, yeniden yarat
    const name = process.env.SEED_COMPANY_NAME ?? "Default Company";
    const created = await createCompanyWithDefaultPolicy(name);
    try {
      await upsertSetting(ACTIVE_COMPANY_KEY, created.id);
    } catch (err) {
      console.warn("getCompanyBundle: upsertSetting failed", err);
    }
    return { company: { id: created.id, name: created.name }, policy: created.policy! };
  }

  if (!company.policy) {
    const policy = await upsertPolicy(companyId, {});
    return { company: { id: company.id, name: company.name }, policy };
  }

  return { company: { id: company.id, name: company.name }, policy: company.policy };
}

export async function adminUpdateCompanyName(name: string) {
  const companyId = await ensureActiveCompanyId();
  const updated = await updateCompanyName(companyId, name);
  return { company: { id: updated.id, name: updated.name }, policy: updated.policy };
}

export async function updateCompanyPolicy(input: {
  timezone?: string;
  shiftStartMinute?: number;
  shiftEndMinute?: number;
  breakMinutes?: number;
  lateGraceMinutes?: number;
  earlyLeaveGraceMinutes?: number;

  breakAutoDeductEnabled?: boolean;
  offDayEntryBehavior?: "IGNORE" | "FLAG" | "COUNT_AS_OT";
  overtimeEnabled?: boolean;

  /**
   * Enterprise: Overtime dynamic break
   * - null => disable / clear
   */
  otBreakInterval?: number | null;
  otBreakDuration?: number | null;
  graceAffectsWorked?: boolean;
  /**
   * Optional grace mode. When provided, overrides graceAffectsWorked.
   */
  graceMode?: "ROUND_ONLY" | "PAID_PARTIAL";
  workedCalculationMode?: "ACTUAL" | "CLAMP_TO_SHIFT";
  exitConsumesBreak?: boolean;
  maxSingleExitMinutes?: number;
  maxDailyExitMinutes?: number;
  exitExceedAction?: "IGNORE" | "WARN" | "FLAG"
  leaveEntryBehavior?: "IGNORE" | "FLAG" | "COUNT_AS_OT";
}) {
  const companyId = await ensureActiveCompanyId();
  const policy = await upsertPolicy(companyId, input);

  const company = await findCompanyById(companyId);
  if (!company) throw new Error("COMPANY_NOT_FOUND");

  return { company: { id: company.id, name: company.name }, policy };
}
