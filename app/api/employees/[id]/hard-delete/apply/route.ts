import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/auth/http";
import {
  applyEmployeeHardDelete,
  HARD_DELETE_CONFIRMATION_PHRASE,
} from "@/src/services/employeeHardDelete.service";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let session: Awaited<ReturnType<typeof requireRole>>;

  try {
    session = await requireRole(["SYSTEM_ADMIN"]);
  } catch (err) {
    const r = authErrorResponse(err);
    if (r) return r;
    throw err;
  }

  try {
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "BAD_ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    const item = await applyEmployeeHardDelete({
      employeeId: id,
      actorUserId: session.userId,
      actorRole: session.role,
      req,
      confirmEmployeeCode: String(body?.confirmEmployeeCode ?? ""),
      confirmationText: String(body?.confirmationText ?? ""),
      allowActiveScopeDelete: !!body?.allowActiveScopeDelete,
      allowOperationalPeriodImpactDelete: !!body?.allowOperationalPeriodImpactDelete,
      preserveHistoricalLedger: body?.preserveHistoricalLedger !== false,
    });

    return NextResponse.json({ ok: true, item });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg === "EMPLOYEE_NOT_FOUND") {
      return NextResponse.json({ ok: false, error: "EMPLOYEE_NOT_FOUND" }, { status: 404 });
    }

    if (msg === "EMPLOYEE_CODE_CONFIRM_REQUIRED") {
      return NextResponse.json(
        { ok: false, error: "EMPLOYEE_CODE_CONFIRM_REQUIRED" },
        { status: 400 },
      );
    }

    if (msg === "EMPLOYEE_CODE_CONFIRM_MISMATCH") {
      return NextResponse.json(
        { ok: false, error: "EMPLOYEE_CODE_CONFIRM_MISMATCH" },
        { status: 400 },
      );
    }

    if (msg === "HARD_DELETE_CONFIRMATION_REQUIRED") {
      return NextResponse.json(
        {
          ok: false,
          error: "HARD_DELETE_CONFIRMATION_REQUIRED",
          expectedPhrase: HARD_DELETE_CONFIRMATION_PHRASE,
        },
        { status: 400 },
      );
    }

    if (msg === "HARD_DELETE_CONFIRMATION_MISMATCH") {
      return NextResponse.json(
        {
          ok: false,
          error: "HARD_DELETE_CONFIRMATION_MISMATCH",
          expectedPhrase: HARD_DELETE_CONFIRMATION_PHRASE,
        },
        { status: 400 },
      );
    }

    if (msg === "PRESERVE_HISTORICAL_LEDGER_REQUIRED") {
      return NextResponse.json(
        { ok: false, error: "PRESERVE_HISTORICAL_LEDGER_REQUIRED" },
        { status: 400 },
      );
    }

    if (msg === "ACTIVE_SCOPE_DELETE_REQUIRES_OVERRIDE") {
      return NextResponse.json(
        {
          ok: false,
          error: "ACTIVE_SCOPE_DELETE_REQUIRES_OVERRIDE",
          message:
            "Employee is still active today or has an open employment period. Terminate is recommended first. Hard delete can continue only with explicit override.",
        },
        { status: 409 },
      );
    }

    if (msg === "OPEN_PERIOD_IMPACT_REQUIRES_OVERRIDE") {
      return NextResponse.json(
        {
          ok: false,
          error: "OPEN_PERIOD_IMPACT_REQUIRES_OVERRIDE",
          message:
            "Hard delete touches OPEN or PRE_CLOSED operational periods. Continue only with explicit operational period impact override.",
        },
        { status: 409 },
      );
    }

    console.error("[api/employees/[id]/hard-delete/apply][POST] unexpected error", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}