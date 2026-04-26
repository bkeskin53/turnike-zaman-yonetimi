import { requireRole, Role } from "@/src/auth/guard";

export type EmployeeImportPermissionKey =
  | "TEMPLATE_DOWNLOAD"
  | "VALIDATE"
  | "APPLY"
  | "RUN_HISTORY_READ"
  | "RUN_OPERATIONS";

export type EmployeeImportCapabilities = {
  canAccessWorkspace: boolean;
  canDownloadTemplate: boolean;
  canValidate: boolean;
  canApply: boolean;
  canReadHistory: boolean;
  canRecoverOperations: boolean;
};

const EMPLOYEE_IMPORT_PERMISSION_MATRIX: Record<EmployeeImportPermissionKey, Role[]> = {
  TEMPLATE_DOWNLOAD: ["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR"],
  VALIDATE: ["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR"],
  APPLY: ["SYSTEM_ADMIN", "HR_OPERATOR"],
  RUN_HISTORY_READ: ["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR"],
  RUN_OPERATIONS: ["SYSTEM_ADMIN"],
};

export function getEmployeeImportPermissionRoles(permission: EmployeeImportPermissionKey): Role[] {
  return EMPLOYEE_IMPORT_PERMISSION_MATRIX[permission];
}

export function canRoleUseEmployeeImportPermission(
  role: Role | null | undefined,
  permission: EmployeeImportPermissionKey,
): boolean {
  if (!role) return false;
  return EMPLOYEE_IMPORT_PERMISSION_MATRIX[permission].includes(role);
}

export function getEmployeeImportCapabilities(role: Role | null | undefined): EmployeeImportCapabilities {
  const canDownloadTemplate = canRoleUseEmployeeImportPermission(role, "TEMPLATE_DOWNLOAD");
  const canValidate = canRoleUseEmployeeImportPermission(role, "VALIDATE");
  const canApply = canRoleUseEmployeeImportPermission(role, "APPLY");
  const canReadHistory = canRoleUseEmployeeImportPermission(role, "RUN_HISTORY_READ");
  const canRecoverOperations = canRoleUseEmployeeImportPermission(role, "RUN_OPERATIONS");

  return {
    canAccessWorkspace: canDownloadTemplate || canValidate || canApply || canReadHistory || canRecoverOperations,
    canDownloadTemplate,
    canValidate,
    canApply,
    canReadHistory,
    canRecoverOperations,
  };
}

export async function requireEmployeeImportPermission(permission: EmployeeImportPermissionKey) {
  return await requireRole(EMPLOYEE_IMPORT_PERMISSION_MATRIX[permission]);
}
