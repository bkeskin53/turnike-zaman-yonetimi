import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/src/auth/guard";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import {
  evaluatePayrollPeriodReadiness,
  setPayrollPeriodPreClosed,
} from "@/src/services/puantaj/period.service";
import { logPayrollPeriodPreClosed } from "@/src/services/puantaj/audit.service";

function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

export async function POST(req: Request) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR"].includes(session.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const body: any = await req.json().catch(() => ({}));
    const month = body?.month;
    const note =
      body?.note == null || body?.note === ""
        ? null
        : String(body.note);

    if (!isValidMonth(month)) {
      return NextResponse.json({ error: "BAD_MONTH" }, { status: 400 });
    }

    const companyId = await getActiveCompanyId();
    const { policy, company } = await getCompanyBundle();
    const tz = policy.timezone || "Europe/Istanbul";
    const actorUserId = String((session as any).userId ?? (session as any).id ?? "");

    const [period, readiness] = await Promise.all([
      setPayrollPeriodPreClosed({
        companyId,
        month,
        actorUserId,
        note,
      }),
      evaluatePayrollPeriodReadiness({
        companyId,
        month,
        tz,
        employeeWhere: null,
      }),
    ]);

    await logPayrollPeriodPreClosed({
      companyId,
      periodId: period.id,
      month,
      actorUserId,
      note,
      periodStatus: period.status,
    });

    return NextResponse.json({
      ok: true,
      month,
      meta: {
        company: {
          id: companyId,
          name: company?.name ?? "",
        },
        tz,
        actions: {
          canManagePeriod: true,
          canPreClose: period.status !== "CLOSED",
          canClose: period.status !== "CLOSED" && readiness.isReadyToClose,
        },
      },
      period,
      readiness,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "PERIOD_PRE_CLOSE_FAILED",
        message: error?.message ?? "UNKNOWN_ERROR",
      },
      { status: 400 }
    );
  }
}