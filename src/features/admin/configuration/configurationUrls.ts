import {
  type ConfigurationCenterPageKey,
  getConfigurationCenterSectionIds,
  parseConfigurationCenterPageKey,
} from "./configurationRegistry";

export const CONFIGURATION_CENTER_BASE_PATH = "/admin/configuration";
export const LEGACY_EMPLOYEE_CONFIGURATION_PATH =
  "/admin/employees/configuration";
export const LEGACY_EMPLOYEE_CREATE_FORM_CONFIGURATION_PATH =
  "/admin/employees/create-form-configuration";

function normalizeHashValue(value: string | null | undefined): string {
  return String(value ?? "").trim().replace(/^#/, "");
}

export function normalizeConfigurationCenterSectionHash(
  pageKey: ConfigurationCenterPageKey,
  value: string | null | undefined,
): string {
  const normalized = normalizeHashValue(value);
  if (!normalized) {
    return "";
  }

  const sectionIds = getConfigurationCenterSectionIds(pageKey);
  return sectionIds.includes(normalized) ? normalized : "";
}

export function buildConfigurationCenterHref(
  pageKey: ConfigurationCenterPageKey | string = "employees",
  sectionHash?: string | null,
): string {
  const resolvedPageKey = parseConfigurationCenterPageKey(pageKey);
  const params = new URLSearchParams({
    page: resolvedPageKey,
  });

  const normalizedHash = normalizeConfigurationCenterSectionHash(
    resolvedPageKey,
    sectionHash,
  );

  return `${CONFIGURATION_CENTER_BASE_PATH}?${params.toString()}${
    normalizedHash ? `#${normalizedHash}` : ""
  }`;
}

export function isConfigurationCenterPathname(
  pathname: string | null | undefined,
): boolean {
  if (!pathname) {
    return false;
  }

  return (
    pathname.startsWith(CONFIGURATION_CENTER_BASE_PATH) ||
    pathname.startsWith(LEGACY_EMPLOYEE_CONFIGURATION_PATH) ||
    pathname.startsWith(LEGACY_EMPLOYEE_CREATE_FORM_CONFIGURATION_PATH)
  );
}