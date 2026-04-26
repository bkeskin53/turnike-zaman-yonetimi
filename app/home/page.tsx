import AppShell from "@/app/_components/AppShellNoSSR";
import { getCapabilities } from "@/app/_auth/capabilities";
import { getSessionOrNull } from "@/src/auth/guard";
import { buildConfigurationCenterHref } from "@/src/features/admin/configuration/configurationUrls";
import { buildHomeQuickAccessCardsForView } from "@/src/features/home/homeQuickAccess";
import { getActiveCompanyId } from "@/src/services/company.service";
import { resolveVisibleHomeQuickAccessCards } from "@/src/services/home/homeQuickAccessResolver.service";
import HomeLandingPage from "./ui";

export default async function HomePage() {
  const [session, capabilities, companyId] = await Promise.all([
    getSessionOrNull(),
    getCapabilities(),
    getActiveCompanyId(),
  ]);
  const role = session?.role ?? null;
  const visibleCards = await resolveVisibleHomeQuickAccessCards({
    companyId,
    role,
    canAccessEmployeeImport: capabilities.employeeImport.canAccessWorkspace,
  });
  const cards = buildHomeQuickAccessCardsForView({
    cards: visibleCards,
    manageHref: buildConfigurationCenterHref(
      "home",
      "home-quick-access-cards",
    ),
  });

  return (
    <AppShell
      title="Ana Sayfa"
      subtitle="Sık kullandığınız modüllere hızlı erişim sağlayın ve iş akışınızı tek noktadan başlatın"
    >
      <HomeLandingPage cards={cards} />
    </AppShell>
  );
}
