import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse } from "@/src/auth/http";
import {
  isEmployeeImportVisibilityScopeError,
  requireEmployeeImportAccess,
} from "@/src/services/employees/employeeImportVisibility.service";
import {
  isEmployeeImportOperationalRecoveryError,
  normalizeEmployeeImportOperationalRecoverySheetKind,
  normalizeEmployeeImportSheetOperationalState,
} from "@/src/services/employees/employeeImportRunOperations.service";

type RecoverRequestBody = {
  action?: string;
  sheetKind?: string;
};

export async function POST(req: NextRequest) {
  let scope: Awaited<ReturnType<typeof requireEmployeeImportAccess>>["scope"];
  try {
    ({ scope } = await requireEmployeeImportAccess("RUN_OPERATIONS"));
  } catch (err) {
    const r = authErrorResponse(err);
    if (r) return r;
    if (isEmployeeImportVisibilityScopeError(err)) {
      return NextResponse.json(
        {
          ok: false,
          error: err.code,
          message: err.message,
        },
        { status: 403 },
      );
    }
    throw err;
  }

  const body = (await req.json().catch(() => null)) as RecoverRequestBody | null;
  if (!body || body.action !== "NORMALIZE_STALE_SHEET_STATE") {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_RECOVERY_ACTION",
        message: "Desteklenmeyen operational recovery aksiyonu.",
      },
      { status: 400 },
    );
  }

  try {
    const item = await normalizeEmployeeImportSheetOperationalState({
      companyId: scope.companyId,
      sheetKind: normalizeEmployeeImportOperationalRecoverySheetKind(body.sheetKind),
    });

    return NextResponse.json({
      ok: true,
      item,
    });
  } catch (err) {
    if (isEmployeeImportOperationalRecoveryError(err)) {
      return NextResponse.json(
        {
          ok: false,
          error: err.code,
          message: err.message,
          meta: err.meta ?? null,
        },
        { status: err.status },
      );
    }
    throw err;
  }
}
