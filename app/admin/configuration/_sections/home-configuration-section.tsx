import { getActiveCompanyId } from "@/src/services/company.service";
import { resolveHomeQuickAccessConfiguration } from "@/src/services/home/homeQuickAccessConfiguration.service";
import HomeQuickAccessConfigurationClient from "../home-quick-access-ui";

export default async function HomeConfigurationSection() {
  const companyId = await getActiveCompanyId();
  const configuration = await resolveHomeQuickAccessConfiguration({
    companyId,
  });

  return (
    <section id="home-quick-access-cards" className="scroll-mt-24">
      <HomeQuickAccessConfigurationClient
        initialConfiguration={configuration}
      />
    </section>
  );
}