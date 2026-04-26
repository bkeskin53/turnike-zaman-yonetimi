import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { writeAudit } from "@/src/audit/writeAudit";
import { requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import {
  EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_FIELD_DEFINITIONS,
  EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_SCREEN_KEY,
  type EmployeeMasterDisplayResolvedConfiguration,
} from "@/src/features/employees/employeeMasterDisplayConfiguration";
import { getActiveCompanyId } from "@/src/services/company.service";
import {
  isEmployeeMasterDisplayConfigurationMutationError,
  resetEmployeeMasterDisplayConfiguration,
  saveEmployeeMasterDisplayConfiguration,
} from "@/src/services/employees/employeeMasterDisplayConfigurationMutation.service";
import { resolveEmployeeMasterDisplayConfiguration } from "@/src/services/employees/employeeMasterDisplayConfiguration.service";
import { authErrorResponse } from "@/src/utils/api";

function getChangedFields(args: {
  before: EmployeeMasterDisplayResolvedConfiguration;
  after: EmployeeMasterDisplayResolvedConfiguration;
}) {
  return EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_FIELD_DEFINITIONS.filter(
    ({ fieldKey }) =>
      args.before.fields[fieldKey].isVisible !==
      args.after.fields[fieldKey].isVisible,
  ).map(({ fieldKey }) => fieldKey);
}

export async function PUT(req: Request) {
  try {
    const session = await requireRole(ROLE_SETS.CONFIG_WRITE);
    const companyId = await getActiveCompanyId();
    const before = await resolveEmployeeMasterDisplayConfiguration({
      companyId,
    });
    const body = await req.json().catch(() => null);

    const after = await saveEmployeeMasterDisplayConfiguration({
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
      targetId: EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_SCREEN_KEY,
      details: {
        op: "EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_SAVE",
        companyId,
        screenKey: EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_SCREEN_KEY,
        changedFields: getChangedFields({ before, after }),
        before,
        after,
      },
    });

    return NextResponse.json({ configuration: after });
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth && auth.status !== 500) return auth;
    if (isEmployeeMasterDisplayConfigurationMutationError(err)) {
      return NextResponse.json({ error: err.code }, { status: 400 });
    }
    return auth ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireRole(ROLE_SETS.CONFIG_WRITE);
    const companyId = await getActiveCompanyId();
    const before = await resolveEmployeeMasterDisplayConfiguration({
      companyId,
    });
    const body = await req.json().catch(() => null);

    const after = await resetEmployeeMasterDisplayConfiguration({
      companyId,
      screenKey:
        body?.screenKey === undefined
          ? EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_SCREEN_KEY
          : String(body.screenKey),
    });

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.WORKFORCE_UPDATED,
      targetType: AuditTargetType.EMPLOYEES,
      targetId: EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_SCREEN_KEY,
      details: {
        op: "EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_RESET",
        companyId,
        screenKey: EMPLOYEE_MASTER_DISPLAY_CONFIGURATION_SCREEN_KEY,
        changedFields: getChangedFields({ before, after }),
        before,
        after,
      },
    });

    return NextResponse.json({ configuration: after });
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth && auth.status !== 500) return auth;
    if (isEmployeeMasterDisplayConfigurationMutationError(err)) {
      return NextResponse.json({ error: err.code }, { status: 400 });
    }
    return auth ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
