import {
  type CompanyManagementModuleKey,
  parseOptionalCompanyManagementModuleKey,
} from "./companyManagementRegistry";

export const COMPANY_MANAGEMENT_BASE_PATH = "/company-management";

export function buildCompanyManagementHref(
  moduleKey?: CompanyManagementModuleKey | string | null,
): string {
  const resolvedModuleKey =
    moduleKey == null
      ? null
      : parseOptionalCompanyManagementModuleKey(moduleKey);

  if (!resolvedModuleKey) {
    return COMPANY_MANAGEMENT_BASE_PATH;
  }

  const params = new URLSearchParams({
    module: resolvedModuleKey,
  });

  return `${COMPANY_MANAGEMENT_BASE_PATH}?${params.toString()}`;
}

export function buildCompanyManagementCreateHref(
  moduleKey?: CompanyManagementModuleKey | string | null,
): string {
  const resolvedModuleKey =
    moduleKey == null
      ? null
      : parseOptionalCompanyManagementModuleKey(moduleKey);

  if (!resolvedModuleKey) {
    return COMPANY_MANAGEMENT_BASE_PATH;
  }

  const params = new URLSearchParams({
    module: resolvedModuleKey,
    create: resolvedModuleKey,
  });

  return `${COMPANY_MANAGEMENT_BASE_PATH}?${params.toString()}`;
}

export function isCompanyManagementPathname(
  pathname: string | null | undefined,
): boolean {
  if (!pathname) {
    return false;
  }

  return pathname.startsWith(COMPANY_MANAGEMENT_BASE_PATH);
}