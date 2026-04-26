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
    const startKeyRaw = String(body?.startDate ?? "").trim();
    const startKey = startKeyRaw || todayKey;
    const reason = body?.reason ? String(body.reason).trim() : null;

    if (!isISODate(startKey)) {
      return NextResponse.json({ error: "INVALID_START_DATE" }, { status: 400 });
    }

    try {
      const result = await prisma.$transaction((tx) =>
        applyEmployeeEmploymentLifecycleMutation({
          tx,
          companyId,
          employeeId: id,
          todayKey,
          actorUserId: session.userId,
          action: "REHIRE",
          effectiveDayKey: startKey,
          reason,
          actionNote: reason,
          actionDetails: {
            source: "EMPLOYEE_REHIRE_ROUTE_PATCH_8_8",
          },
        }),
      );

      if (result.changed) {
        await markRecomputeRequired({
          companyId,
          reason: RecomputeReason.WORKFORCE_UPDATED,
          createdByUserId: session.userId,
          rangeStartDayKey: startKey,
          rangeEndDayKey: null,
        });
      }

      return NextResponse.json(
        {
          ok: true,
          startDate: startKey,
          derivedIsActive: result.derivedIsActive,
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
    console.error("[api/employees/[id]/rehire][POST] unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
