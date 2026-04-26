import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse } from "@/src/auth/http";
import {
  EmployeeImportRunQueryParseError,
  parseEmployeeImportRunListFilters,
} from "@/src/services/employees/employeeImportRunHttpQuery.util";
import {
  isEmployeeImportVisibilityScopeError,
  requireEmployeeImportAccess,
} from "@/src/services/employees/employeeImportVisibility.service";
import { listEmployeeImportRuns } from "@/src/services/employees/employeeImportRunQuery.service";

export async function GET(req: NextRequest) {
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

  const url = new URL(req.url);

  let filters;
  try {
    filters = parseEmployeeImportRunListFilters(url.searchParams);
  } catch (err) {
    if (err instanceof EmployeeImportRunQueryParseError) {
      return NextResponse.json(
        {
          ok: false,
          error: err.code,
          message: err.message,
        },
        { status: 400 },
      );
    }
    throw err;
  }

  const result = await listEmployeeImportRuns({
    companyId: scope.companyId,
    filters,
  });

  return NextResponse.json({
    ok: true,
    items: result.items,
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
    filters: {
      runId: filters.runId ?? null,
      actor: filters.actor ?? null,
      employeeCode: filters.employeeCode ?? null,
      mode: filters.mode ?? null,
      sheetKind: filters.sheetKind ?? null,
      status: filters.status ?? null,
      outcome: filters.outcome ?? null,
      duplicateLinkage: filters.duplicateLinkage ?? null,
      startedAtFrom: filters.startedAtFrom?.toISOString() ?? null,
      startedAtTo: filters.startedAtTo?.toISOString() ?? null,
    },
  });
}
