import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse } from "@/src/auth/http";
import {
  EmployeeImportRunQueryParseError,
  parseEmployeeImportRunId,
} from "@/src/services/employees/employeeImportRunHttpQuery.util";
import {
  isEmployeeImportVisibilityScopeError,
  requireEmployeeImportAccess,
} from "@/src/services/employees/employeeImportVisibility.service";
import { getEmployeeImportRunDetail } from "@/src/services/employees/employeeImportRunQuery.service";
import { buildEmployeeImportRunSupportHandoffBundle } from "@/src/services/employees/employeeImportRunSupportHandoff.service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  let runId: string;
  try {
    const { id } = await params;
    runId = parseEmployeeImportRunId(id);
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

  const item = await getEmployeeImportRunDetail({
    companyId: scope.companyId,
    runId,
  });

  if (!item) {
    return NextResponse.json(
      {
        ok: false,
        error: "EMPLOYEE_IMPORT_RUN_NOT_FOUND",
        message: "Import run bulunamadi.",
      },
      { status: 404 },
    );
  }

  const exportFile = buildEmployeeImportRunSupportHandoffBundle(item);

  return new NextResponse(exportFile.content, {
    status: 200,
    headers: {
      "Content-Type": exportFile.contentType,
      "Content-Disposition": `attachment; filename="${exportFile.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
