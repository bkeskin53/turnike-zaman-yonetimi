import AppShell from "@/app/_components/AppShellNoSSR";
import { getSessionOrNull, requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import {
  canWriteDataManagementModule,
  getReadableDataManagementModules,
  getWritableDataManagementCreateOptions,
  parseOptionalDataManagementModuleKey,
} from "@/src/features/data-management/dataManagementRegistry";
import DataManagementShell from "@/src/features/data-management/DataManagementShell";

const pageTitle = (
  <div className="min-w-0">
    <div className="block max-w-full truncate text-[clamp(1.35rem,2.15vw,1.95rem)] font-extrabold leading-none tracking-tight">
      Verileri Yönet
    </div>
    <div className="mt-1 max-w-full truncate text-[11px] font-medium text-white/72">
      Zaman tanımlarını tek merkezden yönetin
    </div>
  </div>
);

export default async function DataManagementPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionOrNull();
  const role = session?.role ?? null;

  try {
    await requireRole(ROLE_SETS.READ_ALL);
  } catch {
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

  const sp = (await props.searchParams) ?? {};
  const rawModule = Array.isArray(sp.module) ? sp.module[0] : sp.module;
  const rawCreate = Array.isArray(sp.create) ? sp.create[0] : sp.create;
  const activeModuleKey = parseOptionalDataManagementModuleKey(rawModule);
  const readableModules = getReadableDataManagementModules(role);
  const createActionOptions = getWritableDataManagementCreateOptions(role);
  const activeModule = readableModules.find((module) => module.key === activeModuleKey) ??
    null;
  const initialCreateActionId =
    activeModule && rawCreate
      ? createActionOptions.find(
          (option) => option.moduleKey === activeModule.key && option.value === rawCreate,
        )?.id ?? ""
      : "";

  if (!activeModule) {
    return rawModule ? (
      <AppShell title={pageTitle} contentDensity="tight">
        <div className="min-w-0 max-w-full overflow-x-hidden p-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="text-sm font-semibold tracking-tight text-amber-900">
              Erişilebilir başlık bulunamadı
            </div>
            <div className="mt-1 text-sm text-amber-900/90">
              Mevcut rol için Veri Yönetimi içinde görüntülenebilir bir başlık bulunamadı.
            </div>
          </div>
        </div>
      </AppShell>
    ) : (
      <AppShell title={pageTitle} contentDensity="tight">
        <div className="min-w-0 max-w-full overflow-x-hidden px-2.5 pt-0 pb-1.5 md:px-3 md:pt-0 md:pb-2">
          <DataManagementShell
            activeModule={null}
            modules={readableModules}
            createActionOptions={createActionOptions}
            initialCreateActionId=""
            activeCanWrite={false}
          />
        </div>
      </AppShell>
    );
  }
  const activeCanWrite = canWriteDataManagementModule(role, activeModule.key);

  return (
    <AppShell title={pageTitle} contentDensity="tight">
      <div className="min-w-0 max-w-full overflow-x-hidden px-2.5 pt-0 pb-1.5 md:px-3 md:pt-0 md:pb-2">
        <div className="grid gap-1.5">
          <DataManagementShell
            activeModule={activeModule}
            modules={readableModules}
            createActionOptions={createActionOptions}
            initialCreateActionId={initialCreateActionId}
            activeCanWrite={activeCanWrite}
          />
        </div>
      </div>
    </AppShell>
  );
}