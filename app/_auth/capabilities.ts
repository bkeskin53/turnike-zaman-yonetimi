import { getSessionOrNull } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import {
  EmployeeImportCapabilities,
  getEmployeeImportCapabilities,
} from "@/src/services/employees/employeeImportPermission.service";
import {
  applyEmployeeImportVisibilityToCapabilities,
  EmployeeImportVisibilityState,
  resolveEmployeeImportVisibilityScope,
} from "@/src/services/employees/employeeImportVisibility.service";

export type Capabilities = {
  canWrite: boolean;
  employeeImport: EmployeeImportCapabilities;
  employeeImportVisibility: EmployeeImportVisibilityState;
  canRecompute: boolean;
  canEditEvents: boolean;
};

export async function getCapabilities(): Promise<Capabilities> {
  const s = await getSessionOrNull();
  const role = s?.role ?? null;

  // Default: read-only
  const base: Capabilities = {
    canWrite: false,
    employeeImport: {
      canAccessWorkspace: false,
      canDownloadTemplate: false,
      canValidate: false,
      canApply: false,
      canReadHistory: false,
      canRecoverOperations: false,
    },
    employeeImportVisibility: {
      mode: "COMPANY_ALL",
      blockedReason: null,
    },
    canRecompute: false,
    canEditEvents: false,
  };

  if (!role) return base;
  const session = s;
  if (!session) return base;

  /**
   * IMPORTANT:
   * Capabilities MUST reflect backend role sets.
   * - CONFIG_WRITE: policy/config changes (HR_CONFIG_ADMIN)
   * - OPS_WRITE: operational actions (HR_OPERATOR)
   * UI may hide actions, but backend remains the real lock.
   */

  const isConfigWrite = ROLE_SETS.CONFIG_WRITE.includes(role);
  const isOpsWrite = ROLE_SETS.OPS_WRITE.includes(role);
  const roleBasedEmployeeImport = getEmployeeImportCapabilities(role);
  const employeeImportScopeResult = roleBasedEmployeeImport.canAccessWorkspace
    ? await resolveEmployeeImportVisibilityScope(session)
        .then((scope) => ({ scope, failed: false as const }))
        .catch(() => ({ scope: null, failed: true as const }))
    : { scope: null, failed: false as const };
  const employeeImportVisibility: EmployeeImportVisibilityState = employeeImportScopeResult.scope
    ? {
        mode: employeeImportScopeResult.scope.mode,
        blockedReason: employeeImportScopeResult.scope.blockedReason,
      }
    : employeeImportScopeResult.failed
      ? {
          mode: "LIMITED_USER_SCOPE_BLOCKED",
          blockedReason: "Import workspace kapsamı doğrulanamadı. Lütfen oturumu yenileyip tekrar deneyin.",
        }
      : {
          mode: "COMPANY_ALL",
          blockedReason: null,
        };
  const employeeImport = employeeImportScopeResult.failed
    ? {
        canAccessWorkspace: false,
        canDownloadTemplate: false,
        canValidate: false,
        canApply: false,
        canReadHistory: false,
        canRecoverOperations: false,
      }
    : employeeImportScopeResult.scope
      ? applyEmployeeImportVisibilityToCapabilities(roleBasedEmployeeImport, employeeImportVisibility)
      : roleBasedEmployeeImport;

  // Supervisor (and anyone else without write sets): enterprise read-only
  if (!isConfigWrite && !isOpsWrite && !employeeImport.canAccessWorkspace) return base;

  // SYSTEM_ADMIN is in both sets, so "all true" naturally falls out.
  return {
    /**
     * canWrite = "this user can mutate something somewhere"
     * (config OR ops). UI may still hide individual ops buttons below.
     */
    canWrite: isConfigWrite || isOpsWrite,

    /**
     * Operational permissions (import/recompute/events edit)
     * HR_CONFIG_ADMIN must NOT get these by default.
     */
    employeeImport,
    employeeImportVisibility,
    canRecompute: isOpsWrite,
    canEditEvents: isOpsWrite,
  };

  // (no fallback)
}
