import type { Role } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";

export const DATA_MANAGEMENT_MODULE_KEYS = [
  "shift-templates",
  "break-plans",
  "work-schedules",
] as const;

export type DataManagementModuleKey =
  (typeof DATA_MANAGEMENT_MODULE_KEYS)[number];

export type DataManagementModuleCategory =
  | "time-definitions";

export type DataManagementWorkspaceOpenMode =
  | "immediate"
  | "explicit-selection";

export type DataManagementWorkspaceCreateOption = {
  value: string;
  label: string;
};

export type DataManagementCreateActionOption = {
  id: string;
  moduleKey: DataManagementModuleKey;
  value: string;
  label: string;
};

export type DataManagementModuleDefinition = {
  key: DataManagementModuleKey;
  label: string;
  shortLabel: string;
  description: string;
  category: DataManagementModuleCategory;
  categoryLabel: string;
  standaloneHref: string;
  embeddedWorkspaceOpenMode?: DataManagementWorkspaceOpenMode;
  workspaceRecordSelectLabel?: string;
  workspaceRecordSelectPlaceholder?: string;
  workspaceCreateSelectOptions?: readonly DataManagementWorkspaceCreateOption[];
  readRoles: readonly Role[];
  writeRoles: readonly Role[];
  order: number;
};

export const DATA_MANAGEMENT_MODULES: readonly DataManagementModuleDefinition[] =
  [
    {
      key: "shift-templates",
      label: "Günlük Çalışma Programı",
      shortLabel: "Günlük Çalışma Programı",
      description:
        "Kurumsal vardiya şablonlarını, saat imzalarını ve sistem OFF şablonunu tek merkezden yönetin.",
      category: "time-definitions",
      categoryLabel: "Zaman Tanımları",
      standaloneHref: "/shift-templates",
      embeddedWorkspaceOpenMode: "explicit-selection",
      workspaceRecordSelectLabel: "Kayıtlı Vardiya",
      workspaceRecordSelectPlaceholder: "Vardiya seç…",
      workspaceCreateSelectOptions: [
        { value: "shift-templates", label: "Günlük Çalışma Programı" },
      ],
      readRoles: ROLE_SETS.READ_ALL,
      writeRoles: ROLE_SETS.CONFIG_WRITE,
      order: 10,
    },
    {
      key: "break-plans",
      label: "Mola Planları",
      shortLabel: "Mola Planları",
      description:
        "Vardiya şablonlarında kullanılacak ücretli veya ücretsiz toplam mola sürelerini yönetin.",
      category: "time-definitions",
      categoryLabel: "Zaman Tanımları",
      standaloneHref: "/break-plans",
      embeddedWorkspaceOpenMode: "explicit-selection",
      workspaceRecordSelectLabel: "Kayıtlı Mola",
      workspaceRecordSelectPlaceholder: "Mola seç…",
      workspaceCreateSelectOptions: [
        { value: "break-plans", label: "Mola Planı" },
      ],
      readRoles: ROLE_SETS.READ_ALL,
      writeRoles: ROLE_SETS.CONFIG_WRITE,
      order: 15,
    },
    {
      key: "work-schedules",
      label: "Çalışma Planları",
      shortLabel: "Çalışma Planları",
      description:
        "Rota ve periyodik çalışma planlarını tek kabuk altında seçin, inceleyin ve yönetin.",
      category: "time-definitions",
      categoryLabel: "Zaman Tanımları",
      standaloneHref: "/policy/work-schedules",
      embeddedWorkspaceOpenMode: "explicit-selection",
      workspaceRecordSelectLabel: "Kayıtlı Rota",
      workspaceRecordSelectPlaceholder: "Seç…",
      workspaceCreateSelectOptions: [
        { value: "work-schedules", label: "Çalışma Planları" },
      ],
      readRoles: ROLE_SETS.READ_ALL,
      writeRoles: ROLE_SETS.CONFIG_WRITE,
      order: 20,
    },
  ] as const;

const DEFAULT_DATA_MANAGEMENT_MODULE_KEY: DataManagementModuleKey =
  "shift-templates";

export function parseOptionalDataManagementModuleKey(
  value: string | null | undefined,
): DataManagementModuleKey | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const matched = DATA_MANAGEMENT_MODULES.find(
    (module) => module.key === normalized,
  );

  return matched?.key ?? null;
}

export function parseDataManagementModuleKey(
  value: string | null | undefined,
): DataManagementModuleKey {
  return (
    parseOptionalDataManagementModuleKey(value) ??
    DEFAULT_DATA_MANAGEMENT_MODULE_KEY
  );
}

export function getDataManagementModuleDefinition(
  key: DataManagementModuleKey,
): DataManagementModuleDefinition {
  const matched = DATA_MANAGEMENT_MODULES.find((module) => module.key === key);
  return matched ?? DATA_MANAGEMENT_MODULES[0];
}

export function canReadDataManagementModule(
  role: Role | null | undefined,
  moduleKey: DataManagementModuleKey,
): boolean {
  if (!role) {
    return false;
  }

  const module = getDataManagementModuleDefinition(moduleKey);
  return module.readRoles.includes(role);
}

export function canWriteDataManagementModule(
  role: Role | null | undefined,
  moduleKey: DataManagementModuleKey,
): boolean {
  if (!role) {
    return false;
  }

  const module = getDataManagementModuleDefinition(moduleKey);
  return module.writeRoles.includes(role);
}

export function getReadableDataManagementModules(
  role: Role | null | undefined,
): readonly DataManagementModuleDefinition[] {
  if (!role) {
    return [];
  }

  return DATA_MANAGEMENT_MODULES
    .filter((module) => module.readRoles.includes(role))
    .sort((a, b) => a.order - b.order);
}

export function getWritableDataManagementCreateOptions(
  role: Role | null | undefined,
): readonly DataManagementCreateActionOption[] {
  if (!role) {
    return [];
  }

  return DATA_MANAGEMENT_MODULES
    .filter((module) => module.writeRoles.includes(role))
    .flatMap((module) =>
      (module.workspaceCreateSelectOptions ?? []).map((option) => ({
        id: `${module.key}:${option.value}`,
        moduleKey: module.key,
        value: option.value,
        label: option.label,
      })),
    );
}