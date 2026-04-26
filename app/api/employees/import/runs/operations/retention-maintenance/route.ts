import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse } from "@/src/auth/http";
import {
  isEmployeeImportVisibilityScopeError,
  requireEmployeeImportAccess,
} from "@/src/services/employees/employeeImportVisibility.service";
import {
  getEmployeeImportRunRetentionMaintenanceSummary,
  pruneEmployeeImportRunAgedDetailPayloads,
} from "@/src/services/employees/employeeImportRunRetentionMaintenance.service";

type RetentionMaintenanceRequestBody = {
  action?: string;
};

export async function GET() {
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

  const item = await getEmployeeImportRunRetentionMaintenanceSummary({
    companyId: scope.companyId,
  });

  return NextResponse.json({
    ok: true,
    item,
  });
}

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

  const body = (await req.json().catch(() => null)) as RetentionMaintenanceRequestBody | null;
  if (!body || body.action !== "PRUNE_AGED_DETAIL_PAYLOADS") {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_RETENTION_MAINTENANCE_ACTION",
        message: "Desteklenmeyen retention maintenance aksiyonu.",
      },
      { status: 400 },
    );
  }

  const item = await pruneEmployeeImportRunAgedDetailPayloads({
    companyId: scope.companyId,
  });

  return NextResponse.json({
    ok: true,
    item,
  });
}
