import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { writeAudit } from "@/src/audit/writeAudit";
import { requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import {
  EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_FIELD_DEFINITIONS,
  EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY,
  type EmployeeMasterHistoryDisplayResolvedConfiguration,
} from "@/src/features/employees/employeeMasterHistoryDisplayConfiguration";
import { getActiveCompanyId } from "@/src/services/company.service";
import {
  isEmployeeMasterHistoryDisplayConfigurationMutationError,
  resetEmployeeMasterHistoryDisplayConfiguration,
  saveEmployeeMasterHistoryDisplayConfiguration,
} from "@/src/services/employees/employeeMasterHistoryDisplayConfigurationMutation.service";
import { resolveEmployeeMasterHistoryDisplayConfiguration } from "@/src/services/employees/employeeMasterHistoryDisplayConfiguration.service";
import { authErrorResponse } from "@/src/utils/api";

function getChangedFields(args: {
  before: EmployeeMasterHistoryDisplayResolvedConfiguration;
  after: EmployeeMasterHistoryDisplayResolvedConfiguration;
}) {
  return EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_FIELD_DEFINITIONS.filter(
    ({ fieldKey }) =>
      args.before.fields[fieldKey].isVisible !==
      args.after.fields[fieldKey].isVisible,
  ).map(({ fieldKey }) => fieldKey);
}

export async function PUT(req: Request) {
  try {
    const session = await requireRole(ROLE_SETS.CONFIG_WRITE);
    const companyId = await getActiveCompanyId();
    const before = await resolveEmployeeMasterHistoryDisplayConfiguration({
      companyId,
    });
    const body = await req.json().catch(() => null);

    const after = await saveEmployeeMasterHistoryDisplayConfiguration({
      companyId,
      input: {
        screenKey: String(body?.screenKey ?? ""),
        fields: Array.isArray(body?.fields) ? body.fields : [],
      },
    });

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.WORKFORCE_UPDATED,
      targetType: AuditTargetType.EMPLOYEES,
      targetId: EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY,
      details: {
        op: "EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SAVE",
        companyId,
        screenKey: EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY,
        changedFields: getChangedFields({ before, after }),
        before,
        after,
      },
    });

    return NextResponse.json({ configuration: after });
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth && auth.status !== 500) return auth;
    if (isEmployeeMasterHistoryDisplayConfigurationMutationError(err)) {
      return NextResponse.json({ error: err.code }, { status: 400 });
    }
    return auth ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireRole(ROLE_SETS.CONFIG_WRITE);
    const companyId = await getActiveCompanyId();
    const before = await resolveEmployeeMasterHistoryDisplayConfiguration({
      companyId,
    });
    const body = await req.json().catch(() => null);

    const after = await resetEmployeeMasterHistoryDisplayConfiguration({
      companyId,
      screenKey:
        body?.screenKey === undefined
          ? EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY
          : String(body.screenKey),
    });

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.WORKFORCE_UPDATED,
      targetType: AuditTargetType.EMPLOYEES,
      targetId: EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY,
      details: {
        op: "EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_RESET",
        companyId,
        screenKey: EMPLOYEE_MASTER_HISTORY_DISPLAY_CONFIGURATION_SCREEN_KEY,
        changedFields: getChangedFields({ before, after }),
        before,
        after,
      },
    });

    return NextResponse.json({ configuration: after });
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth && auth.status !== 500) return auth;
    if (isEmployeeMasterHistoryDisplayConfigurationMutationError(err)) {
      return NextResponse.json({ error: err.code }, { status: 400 });
    }
    return auth ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
