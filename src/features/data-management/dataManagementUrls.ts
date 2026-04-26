import {
  type DataManagementModuleKey,
  parseOptionalDataManagementModuleKey,
  parseDataManagementModuleKey,
} from "./dataManagementRegistry";

export const DATA_MANAGEMENT_BASE_PATH = "/data-management";

type BuildDataManagementHrefOptions = {
  create?: string | null;
};

export function buildDataManagementHref(
  moduleKey?: DataManagementModuleKey | string | null,
  options?: BuildDataManagementHrefOptions,
): string {
  const resolvedModuleKey =
    moduleKey == null
      ? null
      : parseOptionalDataManagementModuleKey(moduleKey);

  if (!resolvedModuleKey) {
    return DATA_MANAGEMENT_BASE_PATH;
  }
  const params = new URLSearchParams({
    module: resolvedModuleKey,
  });

  const createValue = String(options?.create ?? "").trim();
  if (createValue) {
    params.set("create", createValue);
  }

  return `${DATA_MANAGEMENT_BASE_PATH}?${params.toString()}`;
}

export function isDataManagementPathname(
  pathname: string | null | undefined,
): boolean {
  if (!pathname) {
    return false;
  }

  return pathname.startsWith(DATA_MANAGEMENT_BASE_PATH);
}