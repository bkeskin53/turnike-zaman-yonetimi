import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { getActiveCompanyId } from "@/src/services/company.service";
import { previewShiftImport } from "@/src/services/shiftImport.service";

export async function POST(req: Request) {
  await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);

  const body: any = await req.json().catch(() => ({}));
  const companyId = await getActiveCompanyId();
  const mode =
    body?.mode === "skip_existing_days" ? "skip_existing_days" : "merge_days";
  const layoutType =
    body?.layoutType === "GRID_DATE_COLUMNS" ? "GRID_DATE_COLUMNS" : "ROW";

  const mapping =
    body?.mapping && typeof body.mapping === "object"
      ? layoutType === "GRID_DATE_COLUMNS"
        ? {
            employeeCodeColumn: body.mapping.employeeCodeColumn
              ? String(body.mapping.employeeCodeColumn)
              : "",
            employeeNameColumn: body.mapping.employeeNameColumn
              ? String(body.mapping.employeeNameColumn)
              : "",
            dateHeaderRow:
              body.mapping.dateHeaderRow != null && body.mapping.dateHeaderRow !== ""
                ? Number(body.mapping.dateHeaderRow)
                : undefined,
            dataStartRow:
              body.mapping.dataStartRow != null && body.mapping.dataStartRow !== ""
                ? Number(body.mapping.dataStartRow)
                : undefined,
            firstDateColumn: body.mapping.firstDateColumn
              ? String(body.mapping.firstDateColumn)
              : "",
          }
        : {
            employeeCode: body.mapping.employeeCode ? String(body.mapping.employeeCode) : "",
            date: body.mapping.date ? String(body.mapping.date) : "",
            shiftCode: body.mapping.shiftCode ? String(body.mapping.shiftCode) : "",
          }
      : undefined;
  
  const aliasMappings = Array.isArray(body?.aliasMappings)
    ? body.aliasMappings.map((item: any) => ({
        sourceValue: String(item?.sourceValue ?? ""),
        shiftTemplateId: String(item?.shiftTemplateId ?? ""),
        persist: Boolean(item?.persist),
      }))
    : undefined;
  
  const importText =
    typeof body?.fileText === "string" && body.fileText.trim()
      ? String(body.fileText)
      : String(body?.csvText ?? "");

  const result = await previewShiftImport(
    companyId,
    importText,
    mode,
    mapping,
    aliasMappings,
    layoutType
  );

  return NextResponse.json({
    ok: true,
    ...result,
  });
}