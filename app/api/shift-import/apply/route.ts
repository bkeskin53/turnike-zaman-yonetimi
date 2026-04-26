import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { getActiveCompanyId, getCompanyBundle } from "@/src/services/company.service";
import {
  applyShiftImport,
  upsertShiftImportAliases,
} from "@/src/services/shiftImport.service";
import { markRecomputeRequired } from "@/src/services/recomputeRequired.service";
import { writeAudit } from "@/src/audit/writeAudit";
import { authErrorResponse } from "@/src/utils/api";
import {
  AuditAction,
  AuditTargetType,
  RecomputeReason,
  UserRole,
} from "@prisma/client";

export async function POST(req: Request) {
  try {
    const session = await requireRole(["SYSTEM_ADMIN", "HR_OPERATOR"]);

    const body: any = await req.json().catch(() => ({}));
    const companyId = await getActiveCompanyId();
    const { policy } = await getCompanyBundle();

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
      : [];

    const persistableAliases = aliasMappings.filter(
      (x: any) => x.persist && x.sourceValue && x.shiftTemplateId
    );
    
    if (persistableAliases.length > 0) {
      await upsertShiftImportAliases(companyId, persistableAliases);
    }

    const importText =
      typeof body?.fileText === "string" && body.fileText.trim()
        ? String(body.fileText)
        : String(body?.csvText ?? "");

    const result = await applyShiftImport(
      companyId,
      policy.timezone || "Europe/Istanbul",
      importText,
      mode,
      mapping,
      aliasMappings,
      layoutType
    );

    if (result.applied > 0 && result.startDayKey && result.endDayKey) {
      await markRecomputeRequired({
        companyId,
        createdByUserId: session.userId,
        reason: RecomputeReason.SHIFT_ASSIGNMENT_UPDATED,
        rangeStartDayKey: result.startDayKey,
        rangeEndDayKey: result.endDayKey,
      });
    }

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as UserRole,
      action: AuditAction.SHIFT_ASSIGNMENT_UPDATED,
      targetType: AuditTargetType.SHIFT_ASSIGNMENT,
      targetId:
        result.startDayKey && result.endDayKey
          ? `${result.startDayKey}..${result.endDayKey}`
          : "SHIFT_IMPORT",
      details: {
        op: "SHIFT_IMPORT_APPLY",
        mode: result.mode,
        layoutType,
        applied: result.applied,
        touchedEmployees: result.touchedEmployees,
        touchedWeeks: result.touchedWeeks,
        startDayKey: result.startDayKey,
        endDayKey: result.endDayKey,
        totals: result.totals,
        mapping,
        sourceType:
          body?.sourceType === "xlsx"
            ? "xlsx"
            : typeof body?.fileText === "string" && body.fileText.trim()
            ? "fileText"
            : "csvText",
        sourceSheetName: body?.sourceSheetName ? String(body.sourceSheetName) : undefined,
      },
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;

    console.error("[shift-import/apply] unexpected error", e);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}