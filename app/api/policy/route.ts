import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/utils/api";
import { getCompanyBundle, updateCompanyPolicy } from "@/src/services/company.service";
import { writeAudit } from "@/src/audit/writeAudit";
import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";

function toBool(v: unknown): boolean | undefined {
  if (v === true || v === false) return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

export async function GET() {
  try {
    await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR", "SUPERVISOR"]);
    const data = await getCompanyBundle();
    return NextResponse.json({ policy: data.policy });
  } catch (err) {
    return authErrorResponse(err) ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"]);
    const body = await req.json().catch(() => null);

    // Minimal normalize: boolean + new optional ints
    const payload = {
      ...(body ?? {}),
      overtimeEnabled: toBool(body?.overtimeEnabled),
      breakAutoDeductEnabled: toBool(body?.breakAutoDeductEnabled),
    };

    const data = await updateCompanyPolicy(payload);

    const ALLOWED_KEYS = new Set([
      "timezone",
      "shiftStartMinute",
      "shiftEndMinute",
      "breakMinutes",
      "lateGraceMinutes",
      "earlyLeaveGraceMinutes",
      "breakAutoDeductEnabled",
      "offDayEntryBehavior",
      "leaveEntryBehavior",
      "overtimeEnabled",
      "workedCalculationMode",
      "otBreakInterval",
      "otBreakDuration",
      "graceAffectsWorked",
      "graceMode",
      "exitConsumesBreak",
      "maxSingleExitMinutes",
      "maxDailyExitMinutes",
      "exitExceedAction",
    ]);

    const changedKeys = Object.keys(body ?? {}).filter((k) => ALLOWED_KEYS.has(k));

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.POLICY_UPDATE,
      targetType: AuditTargetType.POLICY,
      targetId: "company_policy",
      details: {
        route: "/api/policy",
        changedKeys,
      },
    });

    return NextResponse.json({ policy: data.policy });
  } catch (err) {
    return authErrorResponse(err) ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
