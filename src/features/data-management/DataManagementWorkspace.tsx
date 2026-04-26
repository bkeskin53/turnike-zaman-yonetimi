"use client";

import dynamic from "next/dynamic";
import type { DataManagementModuleKey } from "./dataManagementRegistry";
import type { DataManagementWorkspaceRecordOption } from "./DataManagementModuleSelect";

const ShiftTemplatesWorkspace = dynamic(
  () => import("@/app/shift-templates/ui"),
  {
    loading: () => <WorkspaceLoadingState label="Vardiya Şablonları yükleniyor" />,
  },
);

const BreakPlansWorkspace = dynamic(
  () => import("@/app/break-plans/ui"),
  {
    loading: () => <WorkspaceLoadingState label="Mola Planları yükleniyor" />,
  },
);

const WorkSchedulesWorkspace = dynamic(
  () => import("@/app/policy/work-schedules/ui"),
  {
    loading: () => <WorkspaceLoadingState label="Çalışma Planları yükleniyor" />,
  },
);

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function WorkspaceLoadingState(props: { label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
        <div className="text-sm font-medium text-slate-700">{props.label}</div>
      </div>
      <div className="mt-4 grid gap-3">
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

function WorkspaceCard(props: {
  moduleKey: DataManagementModuleKey;
  canWrite: boolean;
  onDirtyStateChange?: (isDirty: boolean) => void;
  selectedRecordId?: string;
  selectedCreateValue?: string;
  onSelectedRecordIdChange?: (nextValue: string) => void;
  onRecordOptionsChange?: (options: DataManagementWorkspaceRecordOption[]) => void;
}) {
  switch (props.moduleKey) {
    case "shift-templates":
      return (
        <ShiftTemplatesWorkspace
          canWrite={props.canWrite}
          embedded
          onDirtyStateChange={props.onDirtyStateChange}
          selectedShiftTemplateId={props.selectedRecordId}
          embeddedCreateRequested={props.selectedCreateValue === "shift-templates"}
          onSelectedShiftTemplateIdChange={props.onSelectedRecordIdChange}
          onEmbeddedShiftTemplateOptionsChange={props.onRecordOptionsChange}
        />
      );
    case "break-plans":
      return (
        <BreakPlansWorkspace
          canWrite={props.canWrite}
          embedded
          onDirtyStateChange={props.onDirtyStateChange}
          selectedBreakPlanId={props.selectedRecordId}
          embeddedCreateRequested={props.selectedCreateValue === "break-plans"}
          onSelectedBreakPlanIdChange={props.onSelectedRecordIdChange}
          onEmbeddedBreakPlanOptionsChange={props.onRecordOptionsChange}
        />
      );
    case "work-schedules":
      return (
        <WorkSchedulesWorkspace
          canWrite={props.canWrite}
          embedded
          onDirtyStateChange={props.onDirtyStateChange}
          selectedPatternId={props.selectedRecordId}
          embeddedCreateRequested={props.selectedCreateValue === "work-schedules"}
          onSelectedPatternIdChange={props.onSelectedRecordIdChange}
          onEmbeddedPatternOptionsChange={props.onRecordOptionsChange}
          hideEmbeddedPatternPicker
        />
      );
    default:
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-sm font-semibold text-amber-900">
            Bu yönetim başlığı henüz bağlanmadı
          </div>
          <div className="mt-1 text-sm text-amber-900/90">
            Seçilen modül için workspace bağlantısı henüz tamamlanmadı.
          </div>
        </div>
      );
  }
}

export default function DataManagementWorkspace(props: {
  moduleKey: DataManagementModuleKey;
  canWrite: boolean;
  onDirtyStateChange?: (isDirty: boolean) => void;
  selectedRecordId?: string;
  selectedCreateValue?: string;
  onSelectedRecordIdChange?: (nextValue: string) => void;
  onRecordOptionsChange?: (options: DataManagementWorkspaceRecordOption[]) => void;
}) {
  return (
    <div
      className={cx(
        "min-w-0",
        "[&_.rounded-2xl]:rounded-[20px]",
        "[&_.rounded-3xl]:rounded-[22px]",
        "[&_.shadow-sm]:shadow-sm",
      )}
    >
      <WorkspaceCard
        moduleKey={props.moduleKey}
        canWrite={props.canWrite}
        onDirtyStateChange={props.onDirtyStateChange}
        selectedRecordId={props.selectedRecordId}
        selectedCreateValue={props.selectedCreateValue}
        onSelectedRecordIdChange={props.onSelectedRecordIdChange}
        onRecordOptionsChange={props.onRecordOptionsChange}
      />
    </div>
  );
}