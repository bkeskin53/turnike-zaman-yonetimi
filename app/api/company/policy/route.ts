import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { updateCompanyPolicy } from "@/src/services/company.service";

/**
 * Yardımcılar
 */
function toBool(v: unknown) {
  if (v === true || v === false) return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

function toIntOrNullOrUndefined(v: unknown): number | null | undefined {
  // undefined => field not provided (do not touch DB)
  if (v === undefined) return undefined;
  // null => explicitly clear (persist null)
  if (v === null) return null;
  // number/string => parse int
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}

/**
 * Exit exceed action tipi (TS daraltma için şart)
 */
const EXIT_ACTIONS = ["IGNORE", "WARN", "FLAG"] as const;
type ExitExceedAction = (typeof EXIT_ACTIONS)[number];

const WORKED_MODES = ["ACTUAL", "CLAMP_TO_SHIFT"] as const;
type WorkedCalculationMode = (typeof WORKED_MODES)[number];

export async function PUT(req: Request) {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const body = await req.json().catch(() => null);

    /**
     * Off-day behavior validation
     */
    const off = body?.offDayEntryBehavior;
    const offDayEntryBehavior =
      off === "IGNORE" || off === "FLAG" || off === "COUNT_AS_OT" ? off : undefined;

    /**
    * Leave-day behavior validation. Uses the same enum values as offDayEntryBehavior.
    */
    const leave = body?.leaveEntryBehavior;
    const leaveEntryBehavior =
      leave === "IGNORE" || leave === "FLAG" || leave === "COUNT_AS_OT" ? leave : undefined;

    const wcm = body?.workedCalculationMode;
    const workedCalculationMode =
      WORKED_MODES.includes(wcm) ? (wcm as WorkedCalculationMode) : undefined;

    /**
     * Payload (senin pattern'in korunuyor)
     */
    const payload = {
      timezone: body?.timezone !== undefined ? String(body.timezone) : undefined,

      shiftStartMinute:
        body?.shiftStartMinute !== undefined ? Number(body.shiftStartMinute) : undefined,

      shiftEndMinute:
        body?.shiftEndMinute !== undefined ? Number(body.shiftEndMinute) : undefined,

      breakMinutes:
        body?.breakMinutes !== undefined ? Number(body.breakMinutes) : undefined,

      lateGraceMinutes:
        body?.lateGraceMinutes !== undefined ? Number(body.lateGraceMinutes) : undefined,

      earlyLeaveGraceMinutes:
        body?.earlyLeaveGraceMinutes !== undefined
          ? Number(body.earlyLeaveGraceMinutes)
          : undefined,

      breakAutoDeductEnabled: toBool(body?.breakAutoDeductEnabled),
      offDayEntryBehavior,
      overtimeEnabled: toBool(body?.overtimeEnabled),
      workedCalculationMode,

      /**
       * Enterprise: Overtime dynamic break
       * null gönderilebilmeli (disable/clear)
       */
      otBreakInterval: toIntOrNullOrUndefined(body?.otBreakInterval),
      otBreakDuration: toIntOrNullOrUndefined(body?.otBreakDuration),

      /**
       * Yeni opsiyonel policy alanları
       * (hesaplamayı etkilemez)
       */
      graceAffectsWorked:
        body?.graceAffectsWorked !== undefined
          ? toBool(body.graceAffectsWorked)
          : undefined,

      // Grace mode: accepts "ROUND_ONLY" or "PAID_PARTIAL"; otherwise undefined
      graceMode:
        body?.graceMode === "ROUND_ONLY" || body?.graceMode === "PAID_PARTIAL"
          ? (body.graceMode as "ROUND_ONLY" | "PAID_PARTIAL")
          : undefined,

      exitConsumesBreak:
        body?.exitConsumesBreak !== undefined
          ? toBool(body.exitConsumesBreak)
          : undefined,

      maxSingleExitMinutes:
        body?.maxSingleExitMinutes !== undefined && body.maxSingleExitMinutes !== ""
          ? Number(body.maxSingleExitMinutes)
          : undefined,

      maxDailyExitMinutes:
        body?.maxDailyExitMinutes !== undefined && body.maxDailyExitMinutes !== ""
          ? Number(body.maxDailyExitMinutes)
          : undefined,

      exitExceedAction:
        EXIT_ACTIONS.includes(body?.exitExceedAction)
          ? (body.exitExceedAction as ExitExceedAction)
          : undefined,

      // Leave-day punch handling behavior
      leaveEntryBehavior,
    };

    const data = await updateCompanyPolicy(payload);
    return NextResponse.json(data);
  } catch (err) {
    return authErrorResponse(err) ??
      NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
