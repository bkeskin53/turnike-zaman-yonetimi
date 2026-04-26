export const HOME_QUICK_ACCESS_CONFIGURATION_KEY =
  "home.quick-access" as const;

export type HomeCardTone =
  | "blue"
  | "violet"
  | "teal"
  | "rose"
  | "slate"
  | "indigo"
  | "cyan"
  | "amber";

export type HomeCardIcon =
  | "employees"
  | "import"
  | "planner"
  | "calendar"
  | "dashboard"
  | "payroll"
  | "mapping"
  | "audit"
  | "plus";

export type HomeCardRole =
  | "SYSTEM_ADMIN"
  | "HR_CONFIG_ADMIN"
  | "HR_OPERATOR"
  | "SUPERVISOR";

export type HomeCardRoleSet = "READ_ALL" | "CONFIG_WRITE" | "OPS_WRITE";

export const HOME_QUICK_ACCESS_CARD_IDS = [
  "employees",
  "employee-import",
  "shift-planner",
  "shift-import",
  "dashboard",
  "monthly-payroll",
  "payroll-mapping",
  "audit",
] as const;

export type HomeQuickAccessCardId =
  (typeof HOME_QUICK_ACCESS_CARD_IDS)[number];

export type HomeQuickAccessCardDefinition = {
  id: HomeQuickAccessCardId;
  title: string;
  description: string;
  href: string;
  tone: HomeCardTone;
  icon: HomeCardIcon;
  roleSet?: HomeCardRoleSet;
  roles?: HomeCardRole[];
  requiresEmployeeImportAccess?: boolean;
};

export type HomeQuickAccessConfiguredCard = HomeQuickAccessCardDefinition & {
  order: number;
  isVisible: boolean;
};

export type HomeQuickAccessRuntimeCard = Omit<
  HomeQuickAccessConfiguredCard,
  "order" | "isVisible"
>;

export type HomeQuickAccessManageCard = {
  kind: "manage";
  id: "manage-home-quick-access";
  title: string;
  description: string;
  href: string;
  tone: "slate";
  icon: "plus";
};

export type HomeQuickAccessViewCard =
  | HomeQuickAccessRuntimeCard
  | HomeQuickAccessManageCard;

export type HomeQuickAccessResolvedConfiguration = {
  key: typeof HOME_QUICK_ACCESS_CONFIGURATION_KEY;
  cards: HomeQuickAccessConfiguredCard[];
};

export const HOME_QUICK_ACCESS_CARD_DEFINITIONS: readonly HomeQuickAccessCardDefinition[] =
  [
    {
      id: "employees",
      title: "Çalışanlar",
      description: "Çalışan listesi ve personel detay ekranlarını açın.",
      href: "/employees",
      tone: "blue",
      icon: "employees",
      roleSet: "READ_ALL",
    },
    {
      id: "employee-import",
      title: "Personel İçe Aktarım",
      description:
        "Personel dosyasını doğrulayın ve içe aktarım akışını başlatın.",
      href: "/employees/import",
      tone: "violet",
      icon: "import",
      requiresEmployeeImportAccess: true,
    },
    {
      id: "shift-planner",
      title: "Vardiya Planlayıcı",
      description: "Tarih aralığı bazlı vardiya planına geçin.",
      href: "/shift-assignments/planner",
      tone: "teal",
      icon: "planner",
      roleSet: "READ_ALL",
    },
    {
      id: "shift-import",
      title: "Vardiya İçe Aktarım",
      description: "Plan dosyalarını içeri alın ve planner akışına ilerleyin.",
      href: "/shift-assignments",
      tone: "rose",
      icon: "calendar",
      roleSet: "READ_ALL",
    },
    {
      id: "dashboard",
      title: "Dashboard / Raporlama",
      description: "Kontrol paneli ve raporlama ekranını açın.",
      href: "/dashboard",
      tone: "slate",
      icon: "dashboard",
      roleSet: "READ_ALL",
    },
    {
      id: "monthly-payroll",
      title: "Puantaj",
      description: "Aylık puantaj görünümüne geçin.",
      href: "/puantaj/monthly",
      tone: "indigo",
      icon: "payroll",
      roleSet: "READ_ALL",
    },
    {
      id: "payroll-mapping",
      title: "Payroll Mapping",
      description: "Bordro eşleştirme ekranını açın.",
      href: "/puantaj/payroll-mapping",
      tone: "cyan",
      icon: "mapping",
      roleSet: "CONFIG_WRITE",
    },
    {
      id: "audit",
      title: "Denetim Kayıtları",
      description: "Denetim kayıtlarını sade görünümde inceleyin.",
      href: "/admin/audit",
      tone: "amber",
      icon: "audit",
      roles: ["SYSTEM_ADMIN"],
    },
  ] as const;

const CARD_ID_SET = new Set<string>(HOME_QUICK_ACCESS_CARD_IDS);

export function parseHomeQuickAccessCardId(
  value: string,
): HomeQuickAccessCardId {
  const normalized = String(value ?? "").trim();
  if (!CARD_ID_SET.has(normalized)) {
    throw new Error("INVALID_HOME_QUICK_ACCESS_CARD_ID");
  }
  return normalized as HomeQuickAccessCardId;
}

export function buildDefaultHomeQuickAccessConfiguration(): HomeQuickAccessResolvedConfiguration {
  return {
    key: HOME_QUICK_ACCESS_CONFIGURATION_KEY,
    cards: HOME_QUICK_ACCESS_CARD_DEFINITIONS.map((card, index) => ({
      ...card,
      order: index,
      isVisible: true,
    })),
  };
}

export function buildHomeQuickAccessManageCard(
  href: string,
): HomeQuickAccessManageCard {
  return {
    kind: "manage",
    id: "manage-home-quick-access",
    title: "Hızlı Erişimi Düzenle",
    description:
      "Kart ekleyin, gizleyin veya sıralamayı değiştirin.",
    href,
    tone: "slate",
    icon: "plus",
  };
}

export function buildHomeQuickAccessCardsForView(args: {
  cards: HomeQuickAccessRuntimeCard[];
  manageHref: string;
}): HomeQuickAccessViewCard[] {
  return [...args.cards, buildHomeQuickAccessManageCard(args.manageHref)];
}