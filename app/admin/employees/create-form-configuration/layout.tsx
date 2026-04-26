import { redirect } from "next/navigation";
import { buildConfigurationCenterHref } from "@/src/features/admin/configuration/configurationUrls";

export default function EmployeeCreateFormConfigurationLegacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  void children;
  redirect(buildConfigurationCenterHref("employees", "create-form-visibility"));
}
