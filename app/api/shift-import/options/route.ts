import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { getActiveCompanyId } from "@/src/services/company.service";
import { getShiftImportOptions } from "@/src/services/shiftImport.service";

export async function GET() {
  await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);

  const companyId = await getActiveCompanyId();
  const result = await getShiftImportOptions(companyId);

  return NextResponse.json({
    ok: true,
    ...result,
    supportedLayouts: [
      {
        code: "ROW",
        label: "Satır Bazlı (employeeCode, date, shiftCode)",
      },
      {
        code: "GRID_DATE_COLUMNS",
        label: "Tarih Sütunlu Grid",
      },
    ],
    supportedFileTypes: ["csv", "txt", "xlsx"],
    limits: {
      maxPreviewRows: 20000,
      maxApplyRows: 50000,
    },
  });
}