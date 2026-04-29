import type { Role } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";

export const COMPANY_MANAGEMENT_MODULE_KEYS = [
  "location-groups",
  "locations",
] as const;

export type CompanyManagementModuleKey =
  (typeof COMPANY_MANAGEMENT_MODULE_KEYS)[number];

export type CompanyManagementModuleCategory = "company-structure";

export type CompanyManagementModuleDefinition = {
  key: CompanyManagementModuleKey;
  label: string;
  shortLabel: string;
  recordLabel: string;
  createLabel: string;
  description: string;
  category: CompanyManagementModuleCategory;
  categoryLabel: string;
  standaloneHref?: string;
  readRoles: readonly Role[];
  writeRoles: readonly Role[];
  order: number;
};

export const COMPANY_MANAGEMENT_MODULES: readonly CompanyManagementModuleDefinition[] =
  [
    {
      key: "location-groups",
      label: "Konum Grubu",
      shortLabel: "Konum Grubu",
      recordLabel: "Kayıtlı Konum Grupları",
      createLabel: "Konum Grubu",
      description:
        "Şirket altındaki ana konum grubu kod ve ad tanımlarını yönetin.",
      category: "company-structure",
      categoryLabel: "Şirket Yapısı",
      readRoles: ROLE_SETS.READ_ALL,
      writeRoles: ROLE_SETS.CONFIG_WRITE,
      order: 10,
    },
    {
      key: "locations",
      label: "Konum",
      shortLabel: "Konum",
      recordLabel: "Kayıtlı Konumlar",
      createLabel: "Konum",
      description:
        "Mevcut şube kayıtlarını Konum olarak, bağlı konum grubu ile birlikte yönetin.",
      category: "company-structure",
      categoryLabel: "Şirket Yapısı",
      readRoles: ROLE_SETS.READ_ALL,
      writeRoles: ROLE_SETS.CONFIG_WRITE,
      order: 20,
    }
  ] as const;

const DEFAULT_COMPANY_MANAGEMENT_MODULE_KEY: CompanyManagementModuleKey = 
"location-groups";

export function parseOptionalCompanyManagementModuleKey(
  value: string | null | undefined,
): CompanyManagementModuleKey | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const matched = COMPANY_MANAGEMENT_MODULES.find(
    (module) => module.key === normalized,
  );

  return matched?.key ?? null;
}

export function parseCompanyManagementModuleKey(
  value: string | null | undefined,
): CompanyManagementModuleKey {
  return (
    parseOptionalCompanyManagementModuleKey(value) ??
    DEFAULT_COMPANY_MANAGEMENT_MODULE_KEY
  );
}

export function getCompanyManagementModuleDefinition(
  key: CompanyManagementModuleKey,
): CompanyManagementModuleDefinition {
  const matched = COMPANY_MANAGEMENT_MODULES.find((module) => module.key === key);
  return matched ?? COMPANY_MANAGEMENT_MODULES[0];
}

export function canWriteCompanyManagementModule(
  role: Role | null | undefined,
  moduleKey: CompanyManagementModuleKey,
): boolean {
  if (!role) {
    return false;
  }

  const module = getCompanyManagementModuleDefinition(moduleKey);
  return module.writeRoles.includes(role);
}

export function getReadableCompanyManagementModules(
  role: Role | null | undefined,
): readonly CompanyManagementModuleDefinition[] {
  if (!role) {
    return [];
  }

  return COMPANY_MANAGEMENT_MODULES
    .filter((module) => module.readRoles.includes(role))
    .sort((a, b) => a.order - b.order);
}