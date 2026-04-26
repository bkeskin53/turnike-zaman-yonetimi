"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DataManagementModuleSelect, {
  type DataManagementWorkspaceRecordOption,
} from "./DataManagementModuleSelect";
import DataManagementDirtyExitDialog from "./DataManagementDirtyExitDialog";
import DataManagementWorkspace from "./DataManagementWorkspace";
import {
  buildDataManagementHref,
} from "./dataManagementUrls";
import type {
  DataManagementCreateActionOption,
  DataManagementModuleDefinition,
  DataManagementModuleKey,
} from "./dataManagementRegistry";
import {
  clearDataManagementDirtyGuard,
  setDataManagementDirtyGuardActive,
} from "./dataManagementDirtyGuard";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type PendingDirtyAction =
  | { type: "module"; moduleKey: DataManagementModuleKey | null }
  | { type: "record"; value: string }
  | { type: "create"; value: string }
  | { type: "standalone"; href: string };

export default function DataManagementShell(props: {
  activeModule: DataManagementModuleDefinition | null;
  modules: readonly DataManagementModuleDefinition[];
  createActionOptions: readonly DataManagementCreateActionOption[];
  initialCreateActionId?: string;
  activeCanWrite: boolean;
}) {
  const router = useRouter();
  const [hasDirtyWorkspace, setHasDirtyWorkspace] = useState(false);
  const [workspaceRecordOptions, setWorkspaceRecordOptions] = useState<
    DataManagementWorkspaceRecordOption[]
  >([]);
  const [selectedWorkspaceRecordId, setSelectedWorkspaceRecordId] = useState("");
  const [selectedWorkspaceCreateActionId, setSelectedWorkspaceCreateActionId] =
    useState(props.initialCreateActionId ?? "");
  const [pendingDirtyAction, setPendingDirtyAction] = useState<PendingDirtyAction | null>(null);

  useEffect(() => {
    setHasDirtyWorkspace(false);
  }, [props.activeModule?.key]);

  useEffect(() => {
    setDataManagementDirtyGuardActive(hasDirtyWorkspace);
  }, [hasDirtyWorkspace]);

  useEffect(() => {
    setWorkspaceRecordOptions([]);
    setSelectedWorkspaceRecordId("");
  }, [props.activeModule?.key]);

  useEffect(() => {
    setSelectedWorkspaceCreateActionId(props.initialCreateActionId ?? "");
  }, [props.initialCreateActionId, props.activeModule?.key]);

  useEffect(() => {
    return () => {
      clearDataManagementDirtyGuard();
    };
  }, []);

  useEffect(() => {
    if (!hasDirtyWorkspace) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasDirtyWorkspace]);

  const navigateToModuleImmediate = useCallback(
    (nextModuleKey: DataManagementModuleKey | null) => {
      if (nextModuleKey === props.activeModule?.key) return;
      router.push(buildDataManagementHref(nextModuleKey));
    },
    [props.activeModule?.key, router],
  );

  const navigateToModule = useCallback(
    (nextModuleKey: DataManagementModuleKey | null) => {
      if (nextModuleKey === props.activeModule?.key) return;
      if (hasDirtyWorkspace) {
        setPendingDirtyAction({ type: "module", moduleKey: nextModuleKey });
        return;
      }
      navigateToModuleImmediate(nextModuleKey);
    },
    [hasDirtyWorkspace, navigateToModuleImmediate, props.activeModule?.key],
  );

  const standaloneHref = useMemo(
    () => props.activeModule?.standaloneHref ?? null,
    [props.activeModule],
  );

  const workspaceCreateOptions = useMemo(() => {
    if (!props.activeModule) {
      return props.createActionOptions;
    }

    return props.createActionOptions.filter(
      (option) => option.moduleKey === props.activeModule?.key,
    );
  }, [props.activeModule, props.createActionOptions]);

  const selectedWorkspaceCreateValue = useMemo(() => {
    const matched = props.createActionOptions.find(
      (option) =>
        option.id === selectedWorkspaceCreateActionId &&
        (!props.activeModule || option.moduleKey === props.activeModule.key),
    );
    return matched?.value ?? "";
  }, [
    props.activeModule,
    props.createActionOptions,
    selectedWorkspaceCreateActionId,
  ]);

  const createSelectPlaceholder = useMemo(() => {
    if (workspaceCreateOptions.length === 0) {
      return props.activeModule
        ? "Bu başlık için oluşturma yok"
        : "Oluşturulabilir başlık yok";
    }

    return "Seç…";
  }, [props.activeModule, workspaceCreateOptions]);

  const createSelectDisabled = workspaceCreateOptions.length === 0;

  const requiresExplicitWorkspaceSelection =
    props.activeModule?.embeddedWorkspaceOpenMode === "explicit-selection";

  const hasWorkspaceEntrySelection =
    !!selectedWorkspaceRecordId || !!selectedWorkspaceCreateValue;

  const hideWorkspaceSection =
    !!props.activeModule &&
    requiresExplicitWorkspaceSelection &&
    !hasWorkspaceEntrySelection;

  const recordSelectLabel = useMemo(
    () => props.activeModule?.workspaceRecordSelectLabel ?? "Kayıtlı Kayıt",
    [props.activeModule],
  );

  const recordSelectPlaceholder = useMemo(() => {
    if (!props.activeModule) {
      return "Önce veri başlığı seçin";
    }

    if (!props.activeModule.workspaceRecordSelectLabel) {
      return "Bu başlık için kayıt seçimi yok";
    }

    return props.activeModule.workspaceRecordSelectPlaceholder ?? "Seç…";
  }, [props.activeModule]);

  const recordSelectDisabled =
    !props.activeModule ||
    !props.activeModule.workspaceRecordSelectLabel ||
    workspaceRecordOptions.length === 0;

  const applyRecordValueImmediate = useCallback(
    (nextValue: string) => {
      setSelectedWorkspaceCreateActionId("");
      setSelectedWorkspaceRecordId(nextValue);
      if (props.activeModule) {
        router.replace(buildDataManagementHref(props.activeModule.key));
      }
    },
    [props.activeModule, router],
  );

  const handleRecordValueChange = useCallback(
    (nextValue: string) => {
      const normalized = String(nextValue ?? "");
      if (
        normalized === selectedWorkspaceRecordId &&
        !selectedWorkspaceCreateActionId
      ) {
        return;
      }
      if (hasDirtyWorkspace) {
        setPendingDirtyAction({ type: "record", value: normalized });
        return;
      }
      applyRecordValueImmediate(normalized);
    },
    [
      applyRecordValueImmediate,
      hasDirtyWorkspace,
      props.activeModule,
      router,
      selectedWorkspaceCreateActionId,
      selectedWorkspaceRecordId,
    ],
  );

  const applyCreateValueImmediate = useCallback(
    (nextValue: string) => {
      const normalized = String(nextValue ?? "").trim();

      if (!normalized) {
        setSelectedWorkspaceRecordId("");
        setSelectedWorkspaceCreateActionId("");
        if (props.activeModule) {
          router.replace(buildDataManagementHref(props.activeModule.key));
        }
        return;
      }

      const targetAction = props.createActionOptions.find(
        (option) => option.id === normalized,
      );
      if (!targetAction) return;

      setSelectedWorkspaceRecordId("");
      setSelectedWorkspaceCreateActionId(targetAction.id);

      if (props.activeModule?.key !== targetAction.moduleKey) {
        router.push(
          buildDataManagementHref(targetAction.moduleKey, {
            create: targetAction.value,
          }),
        );
        return;
      }

      router.replace(
        buildDataManagementHref(targetAction.moduleKey, {
          create: targetAction.value,
        }),
      );
    },
    [props.activeModule, props.createActionOptions, router],
  );

  const handleCreateValueChange = useCallback(
    (nextValue: string) => {
      const normalized = String(nextValue ?? "").trim();
      if (
        normalized === selectedWorkspaceCreateActionId &&
        !selectedWorkspaceRecordId
      ) {
        return;
      }
      if (hasDirtyWorkspace) {
        setPendingDirtyAction({ type: "create", value: normalized });
        return;
      }

      applyCreateValueImmediate(normalized);
    },
    [
      applyCreateValueImmediate,
      hasDirtyWorkspace,
      selectedWorkspaceCreateActionId,
      selectedWorkspaceRecordId,
    ],
  );

  const handleStandaloneClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      event.preventDefault();
      if (hasDirtyWorkspace) {
        setPendingDirtyAction({ type: "standalone", href });
        return;
      }
      router.push(href);
    },
    [hasDirtyWorkspace, router],
  );

  const confirmPendingDirtyAction = useCallback(() => {
    if (!pendingDirtyAction) return;
    const action = pendingDirtyAction;
    setPendingDirtyAction(null);

    switch (action.type) {
      case "module":
        navigateToModuleImmediate(action.moduleKey);
        return;
      case "record":
        applyRecordValueImmediate(action.value);
        return;
      case "create":
        applyCreateValueImmediate(action.value);
        return;
      case "standalone":
        router.push(action.href);
        return;
    }
  }, [
    applyCreateValueImmediate,
    applyRecordValueImmediate,
    navigateToModuleImmediate,
    pendingDirtyAction,
    router,
  ]);

  const compactActionSelectClass =
    "h-10 w-full sm:w-[165px] md:w-[185px] rounded-xl border border-slate-200 bg-slate-50/90 px-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition hover:border-slate-300 hover:bg-white focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none";

  return (
    <div className="grid gap-1">
      <section className="rounded-[20px] border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
          <DataManagementModuleSelect
            value={props.activeModule?.key ?? null}
            modules={props.modules}
            onValueChange={navigateToModule}
            recordSelectLabel={recordSelectLabel}
            recordSelectValue={selectedWorkspaceRecordId}
            recordSelectPlaceholder={recordSelectPlaceholder}
            recordSelectDisabled={recordSelectDisabled}
            recordOptions={workspaceRecordOptions}
            onRecordValueChange={handleRecordValueChange}
          />

          <div className="flex flex-wrap items-end gap-1.5">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Yeni Oluştur
              </span>
              <select
                value={selectedWorkspaceCreateActionId}
                onChange={(event) =>
                  handleCreateValueChange(String(event.target.value ?? ""))
                }
                disabled={createSelectDisabled}
                className={compactActionSelectClass}
              >
                <option value="">{createSelectPlaceholder}</option>
                {workspaceCreateOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {props.activeModule && standaloneHref ? (
              <Link
                href={standaloneHref}
                onClick={(event) => handleStandaloneClick(event, standaloneHref)}
                className="inline-flex items-center rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Tam sayfada aç
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {props.activeModule ? (
        <section
          aria-hidden={hideWorkspaceSection || undefined}
          className={cx(
            "rounded-[20px] border border-slate-200 bg-slate-50/40 px-2.5 py-2 shadow-sm md:px-3 md:py-2.5",
            hideWorkspaceSection && "hidden",
          )}
        >
        <DataManagementWorkspace
          moduleKey={props.activeModule.key}
          canWrite={props.activeCanWrite}
          onDirtyStateChange={setHasDirtyWorkspace}
          selectedRecordId={selectedWorkspaceRecordId}
          selectedCreateValue={selectedWorkspaceCreateValue}
          onSelectedRecordIdChange={(nextValue) => {
            setSelectedWorkspaceRecordId(nextValue);
            if (nextValue) {
              setSelectedWorkspaceCreateActionId("");
              router.replace(buildDataManagementHref(props.activeModule!.key));
            }
          }}
          onRecordOptionsChange={setWorkspaceRecordOptions}
        />
        </section>
      ) : null}

      <DataManagementDirtyExitDialog
        open={pendingDirtyAction !== null}
        description="Kaydedilmemiş değişiklikler silinecek. Bu ekrandan çıkmak istiyor musunuz?"
        confirmLabel="Ekrandan Çık"
        onCancel={() => setPendingDirtyAction(null)}
        onConfirm={confirmPendingDirtyAction}
      />
    </div>
  );
}