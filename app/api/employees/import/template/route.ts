import { authErrorResponse } from "@/src/auth/http";
import {
  buildTemplateMatrix,
  EMPLOYEE_IMPORT_SHEETS,
} from "@/src/features/employees/importTemplate";
import {
  isEmployeeImportVisibilityScopeError,
  requireEmployeeImportAccess,
} from "@/src/services/employees/employeeImportVisibility.service";

export async function GET() {
  try {
    await requireEmployeeImportAccess("TEMPLATE_DOWNLOAD");
  } catch (err) {
    const r = authErrorResponse(err);
    if (r) return r;
    if (isEmployeeImportVisibilityScopeError(err)) {
      return Response.json(
        { ok: false, error: err.code, message: err.message },
        { status: 403 },
      );
    }
    throw err;
  }

  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  for (const sheet of EMPLOYEE_IMPORT_SHEETS) {
    const aoa = buildTemplateMatrix(sheet);
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.sheetName);
  }

  const file = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;

  const bytes = new Uint8Array(file.length);
  bytes.set(file);

  return new Response(bytes.buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="employee-import-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
