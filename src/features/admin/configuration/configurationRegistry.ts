export const CONFIGURATION_CENTER_PAGE_KEYS = ["employees", "home"] as const;

export type ConfigurationCenterPageKey =
  (typeof CONFIGURATION_CENTER_PAGE_KEYS)[number];

export type ConfigurationCenterSectionLink = {
  id: string;
  label: string;
};

export type ConfigurationCenterPageDefinition = {
  key: ConfigurationCenterPageKey;
  label: string;
  description: string;
  sections: readonly ConfigurationCenterSectionLink[];
};

export const CONFIGURATION_CENTER_PAGES: readonly ConfigurationCenterPageDefinition[] =
  [
    {
      key: "employees",
      label: "Employees",
      description:
        "Calisan ekranlarina ait gorunurluk ve alan davranisi ayarlari.",
      sections: [
        { id: "create-form-visibility", label: "Create Form" },
        { id: "master-display-visibility", label: "Master Kart" },
        { id: "master-modal-visibility", label: "Master Modal" },
        { id: "master-history-visibility", label: "Tarihce Kart" },
        { id: "master-history-form-visibility", label: "Tarihce Form" },
        { id: "master-history-list-visibility", label: "Tarihce Liste" },
      ],
    },
    {
      key: "home",
      label: "Home",
      description:
        "Ana sayfadaki hizli erisim kartlarinin sirasi ve gorunurlugu.",
      sections: [
        { id: "home-quick-access-cards", label: "Hizli Erisim" },
      ],
    },
  ] as const;

const DEFAULT_CONFIGURATION_CENTER_PAGE_KEY: ConfigurationCenterPageKey =
  "employees";

export function parseConfigurationCenterPageKey(
  value: string | null | undefined,
): ConfigurationCenterPageKey {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_CONFIGURATION_CENTER_PAGE_KEY;
  }

  const matched = CONFIGURATION_CENTER_PAGES.find(
    (page) => page.key === normalized,
  );

  return matched?.key ?? DEFAULT_CONFIGURATION_CENTER_PAGE_KEY;
}

export function getConfigurationCenterPageDefinition(
  key: ConfigurationCenterPageKey,
): ConfigurationCenterPageDefinition {
  const matched = CONFIGURATION_CENTER_PAGES.find((page) => page.key === key);
  return matched ?? CONFIGURATION_CENTER_PAGES[0];
}

export function getConfigurationCenterSectionIds(
  key: ConfigurationCenterPageKey,
): readonly string[] {
  return getConfigurationCenterPageDefinition(key).sections.map(
    (section) => section.id,
  );
}