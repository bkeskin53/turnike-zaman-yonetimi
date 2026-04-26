"use client";

import { Fragment } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type AuditItem = {
  id: string;
  createdAt: string;
  actorEmail: string | null;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string | null;
  endpoint: string | null;
  method: string | null;
  sourceIp: string | null;
  details: any;
};

type Tone = "neutral" | "info" | "good" | "warn" | "danger";
type AuditView =
  | "ALL"
  | "EMPLOYEE_HARD_DELETE"
  | "SHIFT"
  | "IMPORT"
  | "RECOMPUTE"
  | "WORKFORCE";

function Badge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  const tones: Record<Tone, string> = {
    neutral: "border-zinc-200 bg-zinc-100 text-zinc-800",
    info: "border-sky-200 bg-sky-50 text-sky-800",
    good: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-rose-200 bg-rose-50 text-rose-800",
  };

  return (
    <span className={cx("inline-flex items-center rounded-lg border px-2 py-1 text-[11px] font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString("tr-TR");
  } catch {
    return value;
  }
}

function getActionMeta(action: string) {
  const key = String(action ?? "").trim();

  const map: Record<string, { label: string; tone: Tone }> = {
    EMPLOYEE_HARD_DELETE: { label: "Personel Hard Delete", tone: "danger" },
    MANUAL_EVENT: { label: "Manuel Olay", tone: "info" },
    RECOMPUTE: { label: "Recompute", tone: "warn" },
    IMPORT: { label: "İçe Aktarım", tone: "info" },
    POLICY_UPDATE: { label: "Politika Güncellemesi", tone: "warn" },
    USER_CREATED: { label: "Kullanıcı Oluşturuldu", tone: "good" },
    USER_ROLE_CHANGED: { label: "Kullanıcı Rolü Değişti", tone: "warn" },
    USER_STATUS_CHANGED: { label: "Kullanıcı Durumu Değişti", tone: "warn" },
    USER_PASSWORD_RESET: { label: "Kullanıcı Şifresi Sıfırlandı", tone: "warn" },
    SUPERVISOR_SCOPE_UPDATED: { label: "Supervisor Kapsamı Güncellendi", tone: "warn" },
    RULESET_UPDATED: { label: "RuleSet Güncellendi", tone: "warn" },
    POLICY_ASSIGNMENT_UPDATED: { label: "Politika Ataması Güncellendi", tone: "warn" },
    SHIFT_TEMPLATE_UPDATED: { label: "Vardiya Şablonu Güncellendi", tone: "warn" },
    WORK_SCHEDULE_UPDATED: { label: "Çalışma Takvimi Güncellendi", tone: "warn" },
    WORKFORCE_UPDATED: { label: "İşgücü / Organizasyon Güncellemesi", tone: "info" },
  };

  return map[key] ?? { label: key || "Bilinmeyen İşlem", tone: "neutral" };
}

function getTargetTypeLabel(value: string) {
  const key = String(value ?? "").trim();
  const map: Record<string, string> = {
    EMPLOYEES: "Çalışan",
    USERS: "Kullanıcı",
    COMPANY_POLICY: "Şirket Politikası",
    POLICY_RULESET: "Policy RuleSet",
    SHIFT_TEMPLATE: "Vardiya Şablonu",
    WORK_SCHEDULE: "Çalışma Takvimi",
    WORKFORCE: "İşgücü / Organizasyon",
  };
  const fallback = key || "-";
  return map[key] ?? fallback;
}

function formatCountLabel(key: string) {
  const map: Record<string, string> = {
    employmentPeriods: "Kapsam Dönemi",
    employeeActions: "Personel Aksiyonu",
    rawEvents: "Ham Olay",
    normalizedEvents: "Normalize Olay",
    dailyAttendances: "Günlük Devam",
    attendanceOwnershipAudits: "Sahiplik Denetimi",
    dailyAdjustments: "Günlük Düzeltme",
    employeeLeaves: "İzin",
    weeklyShiftPlans: "Haftalık Plan",
    policyAssignments: "Politika Ataması",
    shiftPolicyAssignments: "Vardiya Politikası Ataması",
    workScheduleAssignments: "Çalışma Takvimi Ataması",
  };
  return map[key] ?? key;
}

function toPreviewArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function readWorkforceSummary(details: any) {
  const targetBranch = {
    code: details?.targetBranchCode ? String(details.targetBranchCode) : null,
    name: details?.targetBranchName ? String(details.targetBranchName) : null,
  };

  const changedEmployeeIdsPreview = toPreviewArray<string>(details?.changedEmployeeIdsPreview)
    .map((value) => String(value))
    .filter(Boolean);
  const unchangedEmployeeIdsPreview = toPreviewArray<string>(details?.unchangedEmployeeIdsPreview)
    .map((value) => String(value))
    .filter(Boolean);
  const selectedEmployeeIdsPreview = toPreviewArray<string>(details?.selectedEmployeeIdsPreview)
    .map((value) => String(value))
    .filter(Boolean);

  const rejectedEmployeesPreview = toPreviewArray<any>(details?.rejectedEmployeesPreview)
    .map((item) => ({
      employeeId: item?.employeeId ? String(item.employeeId) : "",
      employeeCode: item?.employeeCode ? String(item.employeeCode) : null,
      fullName: item?.fullName ? String(item.fullName) : "",
      code: item?.code ? String(item.code) : "UNKNOWN",
      message: item?.message ? String(item.message) : "",
    }))
    .filter((item) => item.employeeId || item.employeeCode || item.fullName || item.message);

  const recomputeRequired = details?.recomputeRequired
    ? {
        id: details.recomputeRequired?.id ? String(details.recomputeRequired.id) : null,
        reason: details.recomputeRequired?.reason ? String(details.recomputeRequired.reason) : null,
        rangeStartDayKey: details.recomputeRequired?.rangeStartDayKey
          ? String(details.recomputeRequired.rangeStartDayKey)
          : null,
        rangeEndDayKey: details.recomputeRequired?.rangeEndDayKey
          ? String(details.recomputeRequired.rangeEndDayKey)
          : null,
        status: details.recomputeRequired?.status ? String(details.recomputeRequired.status) : null,
      }
    : null;

  return {
    op: details?.op ? String(details.op) : null,
    targetMode: details?.targetMode === "filter" ? "filter" : "selected",
    effectiveDayKey: details?.effectiveDayKey ? String(details.effectiveDayKey) : null,
    targetBranch,
    requestedEmployeeCount: Number(details?.requestedEmployeeCount || 0),
    foundEmployeeCount: Number(details?.foundEmployeeCount || 0),
    changedEmployeeCount: Number(details?.changedEmployeeCount || 0),
    unchangedEmployeeCount: Number(details?.unchangedEmployeeCount || 0),
    rejectedEmployeeCount: Number(details?.rejectedEmployeeCount || 0),
    selectedEmployeeIdsPreview,
    changedEmployeeIdsPreview,
    unchangedEmployeeIdsPreview,
    rejectedEmployeesPreview,
    filters: details?.filters ?? null,
    recomputeRequired,
  };
}

function readHardDeleteSummary(details: any) {
  const employee = details?.employee ?? {};
  const warning = details?.warning ?? {};
  const confirmation = details?.confirmation ?? {};
  const counts = (details?.counts?.operationalDelete ?? {}) as Record<string, unknown>;
  const detachOnly = (details?.counts?.detachOnly ?? {}) as Record<string, unknown>;
  const preservedCounts = (details?.counts?.preserveHistoricalLedger ?? {}) as Record<string, unknown>;
  const preserved = details?.preservesHistoricalLedger === true;
  const operationalImpact = details?.operationalImpact ?? null;
  const payrollImpact = details?.payrollImpact ?? null;

  return {
    employeeCode: employee?.employeeCode ? String(employee.employeeCode) : null,
    fullName: employee?.fullName ? String(employee.fullName) : null,
    warningLevel: warning?.level ? String(warning.level) : null,
    activeToday: employee?.activeToday === true,
    isActive: employee?.isActive === true,
    preservedHistoricalLedger: preserved,
    allowActiveScopeDelete: confirmation?.allowActiveScopeDelete === true,
    allowOperationalPeriodImpactDelete:
      confirmation?.allowOperationalPeriodImpactDelete === true,
    touchedOpenPeriods: Array.isArray(operationalImpact?.touchedOpenPeriods)
      ? operationalImpact.touchedOpenPeriods
      : [],
    touchedPreClosedPeriods: Array.isArray(operationalImpact?.touchedPreClosedPeriods)
      ? operationalImpact.touchedPreClosedPeriods
      : [],
    touchedHistoricalPeriods: Array.isArray(payrollImpact?.touchedPeriods)
      ? payrollImpact.touchedPeriods
      : [],
    operationalDeleteCounts: Object.entries(counts)
      .filter(([, v]) => Number(v || 0) > 0)
      .slice(0, 6)
      .map(([k, v]) => ({
        label: formatCountLabel(k),
        count: Number(v || 0),
      })),
    operationalDeleteTotal: Object.values(counts).reduce<number>(
      (acc, v) => acc + Number(v || 0),
      0,
    ),
    detachOnlyCounts: [
      {
        label: "Çözümlenmiş Cihaz Gelen Kutusu Ref",
        count: Number(detachOnly?.resolvedDeviceInboxRefs || 0),
      },
    ].filter((x) => x.count > 0),
    preservedLedgerCounts: [
      {
        label: "Snapshot Personel Satırı",
        count: Number(preservedCounts?.payrollSnapshotEmployeeRows || 0),
      },
      {
        label: "Snapshot Kod Satırı",
        count: Number(preservedCounts?.payrollSnapshotCodeRows || 0),
      },
      {
        label: "Payroll Audit Olayı",
        count: Number(preservedCounts?.payrollAuditEvents || 0),
      },
    ].filter((x) => x.count > 0),
  };
}

const AUDIT_VIEW_META: Record<
  AuditView,
  {
    label: string;
    hint: string;
    tone: Tone;
    activeClass: string;
    idleClass: string;
  }
> = {
  ALL: {
    label: "Tüm Kayıtlar",
    hint: "Tüm audit kayıtları",
    tone: "neutral",
    activeClass:
      "border-slate-900 bg-slate-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]",
    idleClass:
      "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
  },
  EMPLOYEE_HARD_DELETE: {
    label: "Personel Silme",
    hint: "Hard delete kayıtları",
    tone: "danger",
    activeClass:
      "border-rose-600 bg-rose-600 text-white shadow-[0_10px_24px_rgba(225,29,72,0.18)]",
    idleClass:
      "border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
  },
  SHIFT: {
    label: "Vardiya",
    hint: "Vardiya değişiklikleri",
    tone: "warn",
    activeClass:
      "border-amber-500 bg-amber-500 text-white shadow-[0_10px_24px_rgba(245,158,11,0.18)]",
    idleClass:
      "border-amber-200 bg-white text-amber-800 hover:bg-amber-50",
  },
  IMPORT: {
    label: "İçe Aktarım",
    hint: "Import işlemleri",
    tone: "info",
    activeClass:
      "border-sky-600 bg-sky-600 text-white shadow-[0_10px_24px_rgba(14,165,233,0.18)]",
    idleClass:
      "border-sky-200 bg-white text-sky-800 hover:bg-sky-50",
  },
  RECOMPUTE: {
    label: "Recompute",
    hint: "Yeniden hesaplama",
    tone: "good",
    activeClass:
      "border-emerald-600 bg-emerald-600 text-white shadow-[0_10px_24px_rgba(16,185,129,0.18)]",
    idleClass:
      "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50",
  },
  WORKFORCE: {
    label: "Organizasyon",
    hint: "Toplu organizasyon / lokasyon değişiklikleri",
    tone: "info",
    activeClass:
      "border-sky-600 bg-sky-600 text-white shadow-[0_10px_24px_rgba(14,165,233,0.18)]",
    idleClass:
      "border-sky-200 bg-white text-sky-800 hover:bg-sky-50",
  },
};

function isEmployeeHardDeleteAudit(item: AuditItem) {
  return item.action === "EMPLOYEE_HARD_DELETE";
}

function isShiftAudit(item: AuditItem) {
  return item.action === "SHIFT_TEMPLATE_UPDATED";
}

function isImportAudit(item: AuditItem) {
  return item.action === "IMPORT";
}

function isRecomputeAudit(item: AuditItem) {
  return item.action === "RECOMPUTE";
}

function isWorkforceAudit(item: AuditItem) {
  return item.action === "WORKFORCE_UPDATED";
}

function matchesAuditView(item: AuditItem, view: AuditView) {
  if (view === "ALL") return true;
  if (view === "EMPLOYEE_HARD_DELETE") return isEmployeeHardDeleteAudit(item);
  if (view === "SHIFT") return isShiftAudit(item);
  if (view === "IMPORT") return isImportAudit(item);
  if (view === "RECOMPUTE") return isRecomputeAudit(item);
  if (view === "WORKFORCE") return isWorkforceAudit(item);
  return true;
}

function renderDetail(
  item: AuditItem,
  rawOpen: boolean,
  onToggleRaw: () => void,
) {
  if (item.action === "EMPLOYEE_HARD_DELETE") {
    const s = readHardDeleteSummary(item.details);

    return (
      <div className="grid min-w-[440px] gap-3">
        <div className="rounded-2xl border border-rose-200 bg-[linear-gradient(135deg,rgba(255,241,242,0.9),rgba(255,255,255,0.96))] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="danger">Kalıcı Silme</Badge>
            {s.warningLevel ? <Badge tone="warn">Uyarı {s.warningLevel}</Badge> : null}
            {s.preservedHistoricalLedger ? (
              <Badge tone="info">Tarihsel Bordro İzleri Korundu</Badge>
            ) : null}
            {s.allowActiveScopeDelete ? (
              <Badge tone="warn">Aktif Kapsam Override</Badge>
            ) : null}
            {s.allowOperationalPeriodImpactDelete ? (
              <Badge tone="warn">Canlı Dönem Override</Badge>
            ) : null}
          </div>

          <div className="mt-3 text-base font-semibold text-zinc-950">
            {s.employeeCode ? `${s.employeeCode}` : "Personel"}
            {s.fullName ? ` — ${s.fullName}` : ""}
          </div>

          <div className="mt-1 text-sm text-zinc-700">
            {s.activeToday || s.isActive
              ? "Silme öncesinde çalışan aktif kapsam etkisi taşıyordu."
              : "Silme öncesinde çalışan pasif / kapalı kapsam görünümündeydi."}
          </div>

          {(s.touchedOpenPeriods.length > 0 ||
            s.touchedPreClosedPeriods.length > 0) ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-white/75 px-3 py-2 text-xs text-rose-900">
              <div className="font-semibold uppercase tracking-wide text-rose-700">
                Canlı Dönem Etkisi
              </div>
              <div className="mt-1 leading-6">
                {[
                  ...s.touchedOpenPeriods.map(
                    (x: any) => `${x.month} (${x.status})`,
                  ),
                  ...s.touchedPreClosedPeriods.map(
                    (x: any) => `${x.month} (${x.status})`,
                  ),
                ].join(", ")}
              </div>
            </div>
          ) : null}

          {s.touchedHistoricalPeriods.length > 0 ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
              <div className="font-semibold uppercase tracking-wide text-amber-700">
                Tarihsel Bordro Dönemleri
              </div>
              <div className="mt-1 leading-6">
                {s.touchedHistoricalPeriods
                  .map((x: any) => `${x.month} (${x.status})`)
                  .join(", ")}
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/90 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Silinen Operasyonel Kayıtlar
            </div>
            <div className="mt-1 text-lg font-semibold text-zinc-950">
              {s.operationalDeleteTotal} kayıt
            </div>
            {s.operationalDeleteCounts.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {s.operationalDeleteCounts.map((x) => (
                  <Badge key={x.label} tone="neutral">
                    {x.label}: {x.count}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-xs text-zinc-500">
                Sayılabilir operasyonel kayıt bulunamadı.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
              Korunan / Ayrılan İzler
            </div>

            {s.detachOnlyCounts.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {s.detachOnlyCounts.map((x) => (
                  <Badge key={x.label} tone="info">
                    {x.label}: {x.count}
                  </Badge>
                ))}
              </div>
            ) : null}

            {s.preservedLedgerCounts.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {s.preservedLedgerCounts.map((x) => (
                  <Badge key={x.label} tone="info">
                    {x.label}: {x.count}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-xs text-sky-700/80">
                Korunan ek ledger kaydı bulunamadı.
              </div>
            )}
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onToggleRaw}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            {rawOpen ? "Ham JSON’u Gizle" : "Ham JSON’u Göster"}
          </button>
        </div>

        {rawOpen ? (
          <pre className="max-h-56 overflow-auto rounded-xl bg-zinc-50 p-3 text-xs text-zinc-700">
            {JSON.stringify(item.details ?? {}, null, 2)}
          </pre>
        ) : null}
      </div>
    );
  }

  if (item.action === "WORKFORCE_UPDATED" && item.details?.op === "LOCATION_ASSIGNMENT_BULK_APPLY") {
    const s = readWorkforceSummary(item.details);

    return (
      <div className="grid min-w-[440px] gap-3">
        <div className="rounded-2xl border border-sky-200 bg-[linear-gradient(135deg,rgba(240,249,255,0.92),rgba(255,255,255,0.98))] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">Toplu Lokasyon Atama</Badge>
            {s.targetMode === "filter" ? <Badge tone="warn">Filtre Modu</Badge> : <Badge tone="neutral">Seçili Personeller</Badge>}
            {s.recomputeRequired ? <Badge tone="good">Recompute Kuyruğa Yazıldı</Badge> : <Badge tone="neutral">Recompute Yok</Badge>}
          </div>

          <div className="mt-3 text-base font-semibold text-zinc-950">
            {s.targetBranch.code ? `${s.targetBranch.code}` : "Lokasyon"}
            {s.targetBranch.name ? ` — ${s.targetBranch.name}` : ""}
          </div>

          <div className="mt-1 text-sm text-zinc-700">
            {s.effectiveDayKey
              ? `Etkili tarih: ${s.effectiveDayKey}`
              : "Etkili tarih bilgisi yok."}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="info">İstenen: {s.requestedEmployeeCount}</Badge>
            <Badge tone="good">Değişen: {s.changedEmployeeCount}</Badge>
            <Badge tone="neutral">No-op: {s.unchangedEmployeeCount}</Badge>
            <Badge tone={s.rejectedEmployeeCount > 0 ? "danger" : "neutral"}>Reject: {s.rejectedEmployeeCount}</Badge>
          </div>

          {s.recomputeRequired ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900">
              <div className="font-semibold uppercase tracking-wide text-emerald-700">
                Recompute Etkisi
              </div>
              <div className="mt-1 leading-6">
                {s.recomputeRequired.reason || "WORKFORCE_UPDATED"}
                {s.recomputeRequired.rangeStartDayKey
                  ? ` • ${s.recomputeRequired.rangeStartDayKey}`
                  : ""}
                {s.recomputeRequired.rangeEndDayKey
                  ? ` → ${s.recomputeRequired.rangeEndDayKey}`
                  : ""}
                {s.recomputeRequired.rangeStartDayKey && !s.recomputeRequired.rangeEndDayKey
                  ? " → açık uçlu"
                  : ""}
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/90 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              İşlem Özeti
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="neutral">Bulunan: {s.foundEmployeeCount}</Badge>
              <Badge tone="good">Değişen: {s.changedEmployeeCount}</Badge>
              <Badge tone="neutral">Değişmeyen: {s.unchangedEmployeeCount}</Badge>
              <Badge tone={s.rejectedEmployeeCount > 0 ? "danger" : "neutral"}>Reject: {s.rejectedEmployeeCount}</Badge>
            </div>
            {s.targetMode === "filter" && s.filters ? (
              <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700">
                <div className="font-semibold uppercase tracking-wide text-zinc-500">Filtre Özeti</div>
                <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-all text-[11px] text-zinc-600">
                  {JSON.stringify(s.filters, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
              Önizleme Kimlikleri
            </div>
            <div className="mt-2 space-y-2 text-xs text-sky-900">
              {s.selectedEmployeeIdsPreview.length > 0 ? (
                <div>
                  <div className="font-semibold">Seçili Personeller</div>
                  <div className="mt-1 break-all">{s.selectedEmployeeIdsPreview.join(", ")}</div>
                </div>
              ) : null}

              {s.changedEmployeeIdsPreview.length > 0 ? (
                <div>
                  <div className="font-semibold">Değişen Personeller</div>
                  <div className="mt-1 break-all">{s.changedEmployeeIdsPreview.join(", ")}</div>
                </div>
              ) : null}

              {s.unchangedEmployeeIdsPreview.length > 0 ? (
                <div>
                  <div className="font-semibold">No-op Personeller</div>
                  <div className="mt-1 break-all">{s.unchangedEmployeeIdsPreview.join(", ")}</div>
                </div>
              ) : null}

              {s.selectedEmployeeIdsPreview.length === 0 &&
              s.changedEmployeeIdsPreview.length === 0 &&
              s.unchangedEmployeeIdsPreview.length === 0 ? (
                <div className="text-sky-700/80">Önizleme kimliği bulunmuyor.</div>
              ) : null}
            </div>
          </div>
        </div>

        {s.rejectedEmployeesPreview.length > 0 ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">
              Reject Önizlemesi
            </div>
            <div className="mt-2 grid gap-2">
              {s.rejectedEmployeesPreview.map((item) => (
                <div key={`${item.employeeId}:${item.code}`} className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs text-rose-900">
                  <div className="font-semibold">
                    {item.employeeCode ? `${item.employeeCode}` : item.employeeId}
                    {item.fullName ? ` — ${item.fullName}` : ""}
                  </div>
                  <div className="mt-1">{item.code}</div>
                  {item.message ? <div className="mt-1 text-rose-800/80">{item.message}</div> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onToggleRaw}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            {rawOpen ? "Ham JSON’u Gizle" : "Ham JSON’u Göster"}
          </button>
        </div>

        {rawOpen ? (
          <pre className="max-h-56 overflow-auto rounded-xl bg-zinc-50 p-3 text-xs text-zinc-700">
            {JSON.stringify(item.details ?? {}, null, 2)}
          </pre>
        ) : null}
      </div>
    );
  }

  return (
    <pre className="max-h-28 overflow-auto rounded-xl bg-zinc-50 p-2 text-xs text-zinc-700">
      {JSON.stringify(item.details ?? {}, null, 2)}
    </pre>
  );
}

export default function AuditAdminClient() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [auditView, setAuditView] = useState<AuditView>("ALL");
  const [openRawById, setOpenRawById] = useState<Record<string, boolean>>({});
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/audit?take=300", { cache: "no-store" });
        if (!res.ok) throw new Error("LOAD_FAILED");
        const data = await res.json();
        if (!alive) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch {
        if (!alive) return;
        setItems([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const rawView = (searchParams.get("view") ?? "").trim();
    const nextView: AuditView =
      rawView === "EMPLOYEE_HARD_DELETE"
        ? "EMPLOYEE_HARD_DELETE"
        : rawView === "SHIFT"
          ? "SHIFT"
          : rawView === "IMPORT"
            ? "IMPORT"
            : rawView === "RECOMPUTE"
              ? "RECOMPUTE"
              : "ALL";
    const nextQ = searchParams.get("q") ?? "";

    setAuditView(nextView);
    setQ(nextQ);
  }, [searchParams]);

  const hardDeleteCount = useMemo(
    () => items.filter(isEmployeeHardDeleteAudit).length,
    [items],
  );

  const shiftCount = useMemo(
    () => items.filter(isShiftAudit).length,
    [items],
  );

  const importCount = useMemo(
    () => items.filter(isImportAudit).length,
    [items],
  );

  const recomputeCount = useMemo(
    () => items.filter(isRecomputeAudit).length,
    [items],
  );

  const visibleItems = useMemo(() => {
    return items.filter((item) => matchesAuditView(item, auditView));
  }, [items, auditView]);

  const visibleCount = visibleItems.length;
  const activeViewMeta = AUDIT_VIEW_META[auditView];

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return visibleItems;
    return visibleItems.filter((x) => {
      const blob = [
        x.actorEmail ?? "",
        x.actorRole ?? "",
        x.action ?? "",
        x.endpoint ?? "",
        x.method ?? "",
        x.targetId ?? "",
        JSON.stringify(x.details ?? {}),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(s);
    });
  }, [visibleItems, q]);

  function toggleRaw(id: string) {
    setOpenRawById((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function toggleExpanded(id: string) {
    setExpandedAuditId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-zinc-600">
          {loading ? "Yükleniyor…" : `${filtered.length} kayıt`}
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ara: actor, action, endpoint, targetId…"
          className="h-9 w-full max-w-md rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
        />
      </div>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["ALL", "EMPLOYEE_HARD_DELETE", "SHIFT", "IMPORT", "RECOMPUTE"] as const).map((view) => {
            const meta = AUDIT_VIEW_META[view];
            const isActive = auditView === view;
            const count =
              view === "ALL"
                ? items.length
                : view === "EMPLOYEE_HARD_DELETE"
                  ? hardDeleteCount
                  : view === "SHIFT"
                    ? shiftCount
                    : view === "IMPORT"
                      ? importCount
                      : recomputeCount;

            return (
              <button
                key={view}
                type="button"
                onClick={() => setAuditView(view)}
                className={cx(
                  "rounded-2xl border px-3 py-2.5 text-left transition-all",
                  isActive ? meta.activeClass : meta.idleClass,
                )}
                aria-pressed={isActive}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold tracking-tight">
                    {meta.label}
                  </span>
                  <Badge tone={isActive ? "neutral" : meta.tone}>
                    {count}
                  </Badge>
                </div>
                <div
                  className={cx(
                    "mt-1 text-[11px] font-medium leading-snug",
                    isActive ? "text-current/85" : "text-zinc-500",
                  )}
                >
                  {meta.hint}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
          <Badge tone={activeViewMeta.tone}>{activeViewMeta.label}</Badge>
          <span className="text-sm font-medium text-zinc-600">
            {activeViewMeta.hint}
          </span>
          <span className="ml-auto text-xs font-semibold text-zinc-500">
            {loading ? "Yükleniyor…" : `${visibleCount} kayıt`}
          </span>
        </div>
      </div>

      <div className="overflow-auto rounded-2xl border border-zinc-200">
        <table className="min-w-[1120px] w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-700">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Tarih</th>
              <th className="px-3 py-2 text-left font-medium">Actor</th>
              <th className="px-3 py-2 text-left font-medium">Action</th>
              <th className="px-3 py-2 text-left font-medium w-[210px]">Target</th>
              <th className="px-3 py-2 text-left font-medium w-[260px]">Endpoint</th>
              <th className="px-3 py-2 text-left font-medium w-[180px]">Detay</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((x, index) => {
              const isExpanded = expandedAuditId === x.id;
              const stripeClass = index % 2 === 0 ? "bg-white" : "bg-zinc-100";

              return (
                <Fragment key={x.id}>
                  <tr className={cx("border-t border-zinc-300 align-top", stripeClass)}>
                    <td className="px-3 py-3 whitespace-nowrap text-zinc-700">{formatDateTime(x.createdAt)}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-zinc-900">{x.actorEmail ?? x.actorRole}</div>
                      <div className="text-xs text-zinc-500">{x.actorRole}</div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={getActionMeta(x.action).tone}>
                          {getActionMeta(x.action).label}
                        </Badge>
                        {x.method ? <Badge tone="neutral">{x.method}</Badge> : null}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-zinc-800">{getTargetTypeLabel(x.targetType)}</div>
                      <div className="text-xs text-zinc-500 break-all">{x.targetId ?? "-"}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-zinc-800">{x.method ?? "-"}</div>
                      <div className="text-xs text-zinc-500 break-all">{x.endpoint ?? "-"}</div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(x.id)}
                        className={cx(
                          "inline-flex items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition",
                          isExpanded
                            ? "border-indigo-300 bg-indigo-100 text-indigo-900 hover:bg-indigo-200"
                            : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                        )}
                      >
                        {isExpanded ? "Detayı Gizle" : "Detayı Aç"}
                      </button>
                    </td>
                  </tr>

                  {isExpanded ? (
                    <tr className={cx("border-t border-zinc-300", stripeClass)}>
                      <td colSpan={6} className="px-4 py-4">
                        {renderDetail(
                          x,
                          !!openRawById[x.id],
                          () => toggleRaw(x.id),
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {!loading && filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-zinc-500">
                  {auditView === "EMPLOYEE_HARD_DELETE"
                    ? "Personel silme görünümünde kayıt bulunamadı."
                    : auditView === "SHIFT"
                      ? "Vardiya görünümünde kayıt bulunamadı."
                      : auditView === "IMPORT"
                        ? "İçe aktarım görünümünde kayıt bulunamadı."
                        : auditView === "RECOMPUTE"
                          ? "Recompute görünümünde kayıt bulunamadı."
                          : "Kayıt bulunamadı."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-zinc-500">
        Not: v1’de audit “best-effort” yazılır. İsterseniz daha sonra “audit yazılamazsa write’u blokla” moduna sıkılaştırırız.
      </div>
    </div>
  );
}