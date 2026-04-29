import type { Role } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";

export type CompanyManagementAccess = {
  role: Role | "UNKNOWN";
  canViewCompanyManagement: boolean;
  canManageOrg: boolean;
  canOperateDevices: boolean;
};

export function resolveCompanyManagementAccess(
  role: Role | null | undefined,
): CompanyManagementAccess {
  const normalizedRole = role ?? null;
  const canViewCompanyManagement = normalizedRole
    ? ROLE_SETS.READ_ALL.includes(normalizedRole)
    : false;
  const canManageOrg = normalizedRole
    ? ROLE_SETS.CONFIG_WRITE.includes(normalizedRole)
    : false;
  const canOperateDevices = normalizedRole
    ? canManageOrg || ROLE_SETS.OPS_WRITE.includes(normalizedRole)
    : false;

  return {
    role: normalizedRole ?? "UNKNOWN",
    canViewCompanyManagement,
    canManageOrg,
    canOperateDevices,
  };
}