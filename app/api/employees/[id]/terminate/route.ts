import { NextRequest, NextResponse } from "next/server";
import { RecomputeReason } from "@prisma/client";
import { requireRole } from "@/src/auth/guard";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import { prisma } from "@/src/repositories/prisma";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import {
  applyEmployeeEmploymentLifecycleMutation,
  isEmployeeEmploymentLifecycleMutationError,
} from "@/src/services/employees/employeeEmploymentLifecycleMutation.service";
import { dayKeyToday, isISODate } from "@/src/utils/dayKey";

function statusForLifecycleError(code: string) {
  if (code === "EMPLOYEE_NOT_FOUND") return 404;
  return 400;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "BAD_ID" }, { status: 400 });

    const companyId = await getActiveCompanyId();
    const bundle = await getCompanyBundle();
    const tz = bundle.policy?.timezone || "Europe/Istanbul";
    const todayKey = dayKeyToday(tz);

    const body = await req.json();
    const endKeyRaw = String(body?.endDate ?? "").trim();
    const endKey = endKeyRaw || todayKey;
    const reason = body?.reason ? String(body.reason).trim() : null;

    if (!isISODate(endKey)) {
      return NextResponse.json({ error: "INVALID_END_DATE" }, { status: 400 });
    }

    try {
      const result = await prisma.$transaction((tx) =>
        applyEmployeeEmploymentLifecycleMutation({
          tx,
          companyId,
          employeeId: id,
          todayKey,
          actorUserId: session.userId,
          action: "TERMINATE",
          effectiveDayKey: endKey,
          reason,
          actionNote: reason,
          timezone: tz,
          actionDetails: {
            source: "EMPLOYEE_TERMINATE_ROUTE_PATCH_8_8",
          },
        }),
      );

      if (result.changed) {
        await markRecomputeRequired({
          companyId,
          reason: RecomputeReason.WORKFORCE_UPDATED,
          createdByUserId: session.userId,
          rangeStartDayKey: endKey,
          rangeEndDayKey: null,
        });
      }

      return NextResponse.json(
        {
          ok: true,
          endDate: endKey,
          derivedIsActive: result.derivedIsActive,
          ...(result.cleanup ? { cleanup: result.cleanup } : {}),
        },
        { status: 200 },
      );
    } catch (error) {
      if (isEmployeeEmploymentLifecycleMutationError(error)) {
        return NextResponse.json(
          { error: error.code },
          { status: statusForLifecycleError(error.code) },
        );
      }

      throw error;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    console.error("[api/employees/[id]/terminate][POST] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
