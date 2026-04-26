import { NextResponse } from "next/server";
import { authErrorResponse } from "@/src/auth/http";
import {
  isEmployeeImportVisibilityScopeError,
  requireEmployeeImportAccess,
} from "@/src/services/employees/employeeImportVisibility.service";
import { getEmployeeImportRunHealthSummary } from "@/src/services/employees/employeeImportRunHealthQuery.service";

export async function GET() {
  let scope: Awaited<ReturnType<typeof requireEmployeeImportAccess>>["scope"];
  try {
    ({ scope } = await requireEmployeeImportAccess("RUN_HISTORY_READ"));
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

  const item = await getEmployeeImportRunHealthSummary({
    companyId: scope.companyId,
  });

  return NextResponse.json({
    ok: true,
    item,
  });
}
