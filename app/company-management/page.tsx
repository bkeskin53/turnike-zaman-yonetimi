import AppShell from "@/app/_components/AppShellNoSSR";
import { requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import { resolveCompanyManagementAccess } from "@/src/features/company-management/companyManagementAccess";
import {
  canWriteCompanyManagementModule,
  getReadableCompanyManagementModules,
  parseOptionalCompanyManagementModuleKey,
} from "@/src/features/company-management/companyManagementRegistry";
import CompanyManagementShell from "@/src/features/company-management/CompanyManagementShell";

const pageTitle = (
  <div className="min-w-0">
    <div className="block max-w-full truncate text-[clamp(1.35rem,2.15vw,1.95rem)] font-extrabold leading-none tracking-tight">
      Şirket Yönetimi
    </div>
    <div className="mt-1 max-w-full truncate text-[11px] font-medium text-white/72">
      Organizasyon yapısını tek merkezden yönetin
    </div>
  </div>
);

function UnauthorizedState() {
  return (
    <AppShell title={pageTitle} contentDensity="tight">
      <div className="min-w-0 max-w-full overflow-x-hidden p-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-sm font-semibold tracking-tight text-amber-900">
            Yetki yok
          </div>
          <div className="mt-1 text-sm text-amber-900/90">
            Bu ekranı görüntülemek için yetkili bir kullanıcı ile giriş yapılmalıdır.
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default async function CompanyManagementPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  let session: Awaited<ReturnType<typeof requireRole>>;

  try {
    session = await requireRole(ROLE_SETS.READ_ALL);
  } catch {
    return <UnauthorizedState />;
  }

  const sp = (await props.searchParams) ?? {};
  const rawModule = Array.isArray(sp.module) ? sp.module[0] : sp.module;
  const rawCreate = Array.isArray(sp.create) ? sp.create[0] : sp.create;
  const activeModuleKey = parseOptionalCompanyManagementModuleKey(rawModule);
  const createModuleKey = parseOptionalCompanyManagementModuleKey(rawCreate);
  const readableModules = getReadableCompanyManagementModules(session.role);
  const activeModule = activeModuleKey
    ? readableModules.find((module) => module.key === activeModuleKey) ?? null
    : null;
  const access = resolveCompanyManagementAccess(session.role);

  return (
    <AppShell title={pageTitle} contentDensity="tight">
      <div className="min-w-0 max-w-full overflow-x-hidden px-2.5 pt-0 pb-1.5 md:px-3 md:pt-0 md:pb-2">
        <CompanyManagementShell
          activeModule={activeModule}
          createModuleKey={createModuleKey}
          modules={readableModules}
          access={{
            ...access,
            canManageOrg: activeModule
              ? canWriteCompanyManagementModule(session.role, activeModule.key)
              : access.canManageOrg,
          }}
        />
      </div>
    </AppShell>
  );
}