"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PuantajMonthlyEmployeeSummary = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  month: string;
  dayCount: number;
  presentDays: number;
  absentDays: number;
  offDays: number;
  leaveDays: number;
  annualLeaveDays: number;
  sickLeaveDays: number;
  excusedLeaveDays: number;
  unpaidLeaveDays: number;
  unknownLeaveDays: number;
  workedMinutes: number;
  overtimeMinutes: number;
  overtimeEarlyMinutes: number;
  overtimeLateMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  blockedDays: number;
  readyDays: number;
  reviewRequiredDays: number;
  pendingReviewDays: number;
  rejectedReviewDays: number;
  manualAdjustmentDays: number;
  anomalyDays: number;
  puantajCodes: string[];
  isPayrollReady: boolean;
};

type PuantajDailyRow = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  dayKey: string;
  status: string;
  leaveType: string | null;
  firstIn: string | null;
  lastOut: string | null;
  workedMinutes: number;
  overtimeMinutes: number;
  overtimeEarlyMinutes: number;
  overtimeLateMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  anomalies: string[];
  requiresReview: boolean;
  reviewStatus: string;
  reviewReasons: string[];
  reviewedAt: string | null;
  reviewNote: string | null;
  manualAdjustmentApplied: boolean;
  adjustmentNote: string | null;
  puantajState: "READY" | "BLOCKED";
  puantajBlockReasons: Array<{ code: string; detail: string }>;
  puantajCodes: string[];
};

type ApiResponse = {
  ok: boolean;
  month: string;
  meta: {
    company: {
      id: string;
      name: string;
    };
    projection: {
      monthlyExportProfile: MonthlyProfile;
      monthlyExportProfileLabel: string;
      payrollMappingProfile: PayrollMappingProfile;
      payrollMappingActive: boolean;
     };
    tz: string;
    summary: {
      employeeCount: number;
      payrollReadyCount: number;
      blockedCount: number;
      blockedDayCount: number;
      reviewRequiredDayCount: number;
      pendingReviewDayCount: number;
      rejectedReviewDayCount: number;
    };
  };
  items: PuantajMonthlyEmployeeSummary[];
};

type DailyApiResponse = {
  ok: boolean;
  month: string;
  employee: {
    employeeId: string;
    employeeCode: string;
    fullName: string;
  };
  meta: {
    tz: string;
    summary: {
      dayCount: number;
      blockedDayCount: number;
      pendingReviewDayCount: number;
      rejectedReviewDayCount: number;
      anomalyDayCount: number;
    };
  };
  items: PuantajDailyRow[];
};

type MonthlyProfile = "STANDARD_MONTHLY" | "PAYROLL_CODE_SUMMARY";
type DailyProfile = "STANDARD_DAILY";
type PayrollMappingProfile = string;
type PayrollPreviewSort = "EMPLOYEE" | "PAYROLL_CODE" | "QUANTITY_DESC" | "MINUTES_DESC";
type PayrollPreviewMode = "ROWS" | "GROUPED";
type MappingUnit = "MINUTES" | "DAYS" | "COUNT";
type MappingSource = "DB" | "FILE";
type MappingQuantityStrategy = "WORKED_MINUTES" | "OVERTIME_MINUTES" | "FIXED_QUANTITY";

type PayrollMappingProfileListItem = {
  code: string;
  name: string;
  source: MappingSource;
  isDefault: boolean;
  isActive: boolean;
  itemCount: number;
  units: MappingUnit[];
};

type PayrollMappingProfilesApiResponse = {
  ok: boolean;
  meta: {
    company: { id: string; name: string };
    summary: {
      totalProfiles: number;
      activeProfiles: number;
      defaultProfileCode: string | null;
      sourceSummary: { dbCount: number; fileCount: number };
    };
  };
  items: PayrollMappingProfileListItem[];
};

type PayrollCodeSummaryRow = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  month: string;
  code: string;
  payrollCode: string;
  payrollLabel: string;
  unit: MappingUnit;
  quantityStrategy: MappingQuantityStrategy;
  fixedQuantity: number | null;
  projectionLabel?: string;
  projectionDetail?: string;
  quantity: number;
  dayCount: number;
  totalMinutes: number;
};

type GroupedPayrollCodeSummaryRow = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  payrollCode: string;
  payrollLabel: string;
  unit: MappingUnit;
  quantityStrategySet: string[];
  fixedQuantitySet: Array<number | null>;
  quantity: number;
  dayCount: number;
  totalMinutes: number;
  sourceRowCount: number;
};

function formatFixedQuantity(value: number | null) {
  return value == null ? "—" : String(value);
}

type ReadinessIssueCode =
  | "REVIEW_REQUIRED"
  | "PENDING_REVIEW"
  | "REJECTED_REVIEW"
  | "BLOCKED_DAYS";

type ReadinessRow = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  blockedDays: number;
  reviewRequiredDays: number;
  pendingReviewDays: number;
  rejectedReviewDays: number;
  issues: ReadinessIssueCode[];
};

type PayrollCodeSummaryApiResponse = {
  ok: boolean;
  month: string;
  meta: {
    company: {
      id: string;
      name: string;
    };
    projection: {
      monthlyExportProfile: "PAYROLL_CODE_SUMMARY";
      monthlyExportProfileLabel: string;
      payrollMappingProfile: PayrollMappingProfile;
      payrollMappingActive: true;
    };
    tz: string;
    summary: { rowCount: number; employeeCount: number; codeCount: number; quantityTotal: number; totalMinutes: number };
  };
  items: PayrollCodeSummaryRow[];
};

type PayrollPeriodStatus = "OPEN" | "PRE_CLOSED" | "CLOSED";

type PeriodReadinessIssueCode =
  | "BLOCKED_DAYS"
  | "REVIEW_REQUIRED"
  | "PENDING_REVIEW"
  | "REJECTED_REVIEW";

type PeriodBlockingEmployee = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  blockedDays: number;
  reviewRequiredDays: number;
  pendingReviewDays: number;
  rejectedReviewDays: number;
  issues: PeriodReadinessIssueCode[];
};

type PeriodApiResponse = {
  ok: boolean;
  month: string;
  meta: {
    company: {
      id: string;
      name: string;
    };
    tz: string;
    scope?: {
      isScoped: boolean;
    };
    actions: {
      canManagePeriod: boolean;
      canPreClose: boolean;
      canClose: boolean;
    };
  };
  period: {
    id: string;
    companyId: string;
    month: string;
    status: PayrollPeriodStatus;
    preClosedAt: string | null;
    preClosedByUserId: string | null;
    closedAt: string | null;
    closedByUserId: string | null;
    note: string | null;
    preClosedByUser?: { id: string; email: string; role: string } | null;
    closedByUser?: { id: string; email: string; role: string } | null;
  };
  readiness: {
    month: string;
    employeeCount: number;
    payrollReadyCount: number;
    blockedEmployeeCount: number;
    blockedDayCount: number;
    reviewRequiredDayCount: number;
    pendingReviewDayCount: number;
    rejectedReviewDayCount: number;
    isReadyToPreClose: boolean;
    isReadyToClose: boolean;
    topBlockingEmployees: PeriodBlockingEmployee[];
  };
  snapshot: {
    id: string;
    status: string;
    payrollMappingProfile: PayrollMappingProfile;
    dailyExportProfile: DailyProfile;
    monthlyExportProfile: MonthlyProfile;
    createdAt: string;
    createdByUser?: { id: string; email: string; role: string } | null;
    employeeCount: number;
    payrollReadyCount: number;
    blockedEmployeeCount: number;
    blockedDayCount: number;
    reviewRequiredDayCount: number;
    pendingReviewDayCount: number;
    rejectedReviewDayCount: number;
    rowCounts: {
      employeeRows: number;
      codeRows: number;
    };
  } | null;
};

type AuditEventType =
  | "REVIEW_STATUS_CHANGED"
  | "REVIEW_NOTE_CHANGED"
  | "PERIOD_PRE_CLOSED"
  | "PERIOD_CLOSED"
  | "PERIOD_REOPENED"
  | "SNAPSHOT_CREATED"
  | "MONTHLY_EXPORT_CREATED"
  | "DAILY_EXPORT_CREATED";

type AuditEntityType =
  | "PAYROLL_PERIOD"
  | "PAYROLL_PERIOD_SNAPSHOT"
  | "DAILY_ATTENDANCE"
  | "EMPLOYEE"
  | "EXPORT";

type AuditEventItem = {
  id: string;
  companyId: string;
  month: string | null;
  employeeId: string | null;
  eventType: AuditEventType;
  entityType: AuditEntityType;
  entityId: string;
  actorUserId: string | null;
  payload: any;
  createdAt: string;
  actorUser?: {
    id: string;
    email: string;
    role: string;
  } | null;
};

type AuditApiResponse = {
  ok: boolean;
  filters: {
    month: string | null;
    employeeId: string | null;
    entityType: string | null;
    entityId: string | null;
    eventTypes: string[];
    take: number;
    skip: number;
  };
  scope: {
    isScoped: boolean;
    employeeScopeCount: number | null;
  };
  page: {
    items: AuditEventItem[];
    total: number;
    page: {
      take: number;
      skip: number;
      hasMore: boolean;
    };
  };
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function currentMonthValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthlyProfileLabel(profile: MonthlyProfile) {
  switch (profile) {
    case "STANDARD_MONTHLY":
      return "Standard Monthly";
    case "PAYROLL_CODE_SUMMARY":
      return "Payroll Code Summary";
  }
}

function dailyProfileLabel(profile: DailyProfile) {
  switch (profile) {
    case "STANDARD_DAILY":
      return "Standard Daily";
  }
}

function fmtMinutes(minutes: number) {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}s ${String(m).padStart(2, "0")}d`;
}

function fmtDateTime(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(value: string) {
  return value;
}

function periodStatusLabel(status: PayrollPeriodStatus) {
  switch (status) {
    case "PRE_CLOSED":
      return "Pre-Closed";
    case "CLOSED":
      return "Closed";
    case "OPEN":
    default:
      return "Open";
  }
}

function periodStatusTone(status: PayrollPeriodStatus) {
  switch (status) {
    case "PRE_CLOSED":
      return "warn";
    case "CLOSED":
      return "good";
    case "OPEN":
    default:
      return "default";
  }
}

function auditEventLabel(eventType: AuditEventType) {
  switch (eventType) {
    case "PERIOD_PRE_CLOSED":
      return "Period Pre-Close";
    case "PERIOD_CLOSED":
      return "Period Closed";
    case "PERIOD_REOPENED":
      return "Period Reopened";
    case "SNAPSHOT_CREATED":
      return "Snapshot Created";
    case "MONTHLY_EXPORT_CREATED":
      return "Monthly Export";
    case "DAILY_EXPORT_CREATED":
      return "Daily Export";
    case "REVIEW_STATUS_CHANGED":
      return "Review Status";
    case "REVIEW_NOTE_CHANGED":
      return "Review Note";
    default:
      return eventType;
  }
}

function auditEventTone(eventType: AuditEventType) {
  switch (eventType) {
    case "PERIOD_CLOSED":
    case "SNAPSHOT_CREATED":
      return "good";
    case "PERIOD_PRE_CLOSED":
    case "MONTHLY_EXPORT_CREATED":
    case "DAILY_EXPORT_CREATED":
      return "info";
    default:
      return "default";
  }
}

function formatAuditPayload(event: AuditEventItem) {
  const payload = event.payload ?? {};

  switch (event.eventType) {
    case "PERIOD_PRE_CLOSED":
      return payload?.note ? `Not: ${payload.note}` : "Dönem pre-close olarak işaretlendi.";

    case "PERIOD_CLOSED": {
      const readiness = payload?.readiness;
      const parts = [
        readiness?.employeeCount != null ? `Personel: ${readiness.employeeCount}` : null,
        readiness?.payrollReadyCount != null ? `Hazır: ${readiness.payrollReadyCount}` : null,
        readiness?.monthlyExportProfile ? `Monthly: ${readiness.monthlyExportProfile}` : null,
        readiness?.dailyExportProfile ? `Daily: ${readiness.dailyExportProfile}` : null,
        payload?.snapshotId ? `Snapshot: ${payload.snapshotId}` : null,
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(" • ") : "Dönem kapatıldı.";
    }

    case "SNAPSHOT_CREATED": {
      const rowCounts = payload?.rowCounts;
      const parts = [
        payload?.payrollMappingProfile ? `Mapping: ${payload.payrollMappingProfile}` : null,
        payload?.monthlyExportProfile ? `Monthly: ${payload.monthlyExportProfile}` : null,
        payload?.dailyExportProfile ? `Daily: ${payload.dailyExportProfile}` : null,
        rowCounts?.employeeRows != null ? `Employee Rows: ${rowCounts.employeeRows}` : null,
        rowCounts?.codeRows != null ? `Code Rows: ${rowCounts.codeRows}` : null,
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(" • ") : "Snapshot oluşturuldu.";
    }

    case "MONTHLY_EXPORT_CREATED":
    case "DAILY_EXPORT_CREATED": {
      const parts = [
        payload?.exportProfile ? `Profil: ${payload.exportProfile}` : null,
        payload?.exportSource ? `Kaynak: ${payload.exportSource}` : null,
        payload?.rowCount != null ? `Satır: ${payload.rowCount}` : null,
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(" • ") : "Export oluşturuldu.";
    }

    case "REVIEW_STATUS_CHANGED": {
      const parts = [
        payload?.fromStatus ? `${payload.fromStatus}` : null,
        payload?.toStatus ? `→ ${payload.toStatus}` : null,
        payload?.note ? `Not: ${payload.note}` : null,
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(" • ") : "Review status güncellendi.";
    }

    case "REVIEW_NOTE_CHANGED":
      return payload?.note ? `Not: ${payload.note}` : "Review notu güncellendi.";

    default:
      return "Audit olayı kaydedildi.";
  }
}

function csvCell(value: unknown) {
  const s = String(value ?? "");
  if (/[\r\n",;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function quantityStrategyLabel(value: MappingQuantityStrategy) {
  switch (value) {
    case "WORKED_MINUTES":
      return "Worked Minutes";
    case "OVERTIME_MINUTES":
      return "Overtime Minutes";
    case "FIXED_QUANTITY":
    default:
      return "Fixed Quantity";
  }
}

function projectionDetailText(item: {
  unit: MappingUnit;
  quantityStrategy: MappingQuantityStrategy;
  fixedQuantity: number | null;
}) {
  if (item.quantityStrategy === "WORKED_MINUTES") {
    return "Quantity = workedMinutes";
  }
  if (item.quantityStrategy === "OVERTIME_MINUTES") {
    return "Quantity = overtimeMinutes";
  }
  return `Quantity = fixedQuantity (${formatFixedQuantity(item.fixedQuantity)})`;
}

function renderFilteredPayrollCsv(items: PayrollCodeSummaryRow[]) {
  const header = [
    "Employee Code",
    "Full Name",
    "Month",
    "Code",
    "Payroll Code",
    "Payroll Label",
    "Unit",
    "Quantity Strategy",
    "Fixed Quantity",
    "Projection Detail",
    "Quantity",
    "Day Count",
    "Total Minutes",
  ];
  const lines = [header.map(csvCell).join(";")];

  for (const item of items) {
    lines.push(
      [
        item.employeeCode,
        item.fullName,
        item.month,
        item.code,
        item.payrollCode,
        item.payrollLabel,
        item.unit,
        item.quantityStrategy,
        formatFixedQuantity(item.fixedQuantity),
        projectionDetailText(item),
        item.quantity,
        item.dayCount,
        item.totalMinutes,
      ]
        .map(csvCell)
        .join(";")
    );
  }
  return lines.join("\n");
}

function renderGroupedPayrollCsv(items: GroupedPayrollCodeSummaryRow[], month: string) {
  const header = [
    "Employee Code",
    "Full Name",
    "Month",
    "Payroll Code",
    "Payroll Label",
    "Unit",
    "Quantity Strategy Set",
    "Fixed Quantity Set",
    "Projection Detail",
    "Quantity",
    "Day Count",
    "Total Minutes",
    "Source Row Count",
  ];

  const lines = [header.map(csvCell).join(";")];

  for (const item of items) {
    lines.push(
      [
        item.employeeCode,
        item.fullName,
        month,
        item.payrollCode,
        item.payrollLabel,
        item.unit,
        item.quantityStrategySet.join(" | "),
        item.fixedQuantitySet.map((x) => formatFixedQuantity(x)).join(" | "),
        item.quantityStrategySet.length === 1 ? item.quantityStrategySet[0] : "Mixed projection sources",
        item.quantity,
        item.dayCount,
        item.totalMinutes,
        item.sourceRowCount,
      ].map(csvCell).join(";")
    );
  }

  return lines.join("\n");
}

function renderReadinessCsv(items: ReadinessRow[]) {
  const header = [
    "Employee Code",
    "Full Name",
    "Blocked Days",
    "Review Required Days",
    "Pending Review Days",
    "Rejected Review Days",
    "Issues",
  ];

  const lines = [header.map(csvCell).join(";")];

  for (const item of items) {
    lines.push(
      [
        item.employeeCode,
        item.fullName,
        item.blockedDays,
        item.reviewRequiredDays,
        item.pendingReviewDays,
        item.rejectedReviewDays,
        item.issues.join(", "),
      ].map(csvCell).join(";")
    );
  }

  return lines.join("\n");
}

function SummaryCard(props: { title: string; value: string | number; tone?: "default" | "good" | "warn" | "danger" | "info" }) {
  const tone =
    props.tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : props.tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : props.tone === "danger"
          ? "border-rose-200 bg-rose-50 text-rose-900"
          : "border-slate-200 bg-white text-slate-900";

  return (
    <div className={cx("rounded-2xl border p-4 shadow-sm", tone)}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-70">{props.title}</div>
      <div className="mt-2 text-2xl font-semibold">{props.value}</div>
    </div>
  );
}

function DailyDetailPanel(props: {
  month: string;
  selected: PuantajMonthlyEmployeeSummary | null;
  onClose: () => void;
}) {
  const { month, selected, onClose } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DailyApiResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!selected) {
        setData(null);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/puantaj/daily?month=${encodeURIComponent(month)}&employeeId=${encodeURIComponent(selected.employeeId)}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || "Günlük puantaj detayı alınamadı.");
        }
        if (!cancelled) {
          setData(json);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Beklenmeyen bir hata oluştu.");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [month, selected?.employeeId]);

  if (!selected) return null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Günlük Detay</div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
            {selected.fullName || "-"}
          </h2>
          <div className="mt-1 text-sm text-slate-500">
            {selected.employeeCode || "-"} · {month}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 transition hover:bg-slate-50"
        >
          Kapat
        </button>
      </div>

      {data ? (
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <SummaryCard title="Gün" value={data.meta.summary.dayCount} />
          <SummaryCard title="Bloklu Gün" value={data.meta.summary.blockedDayCount} tone="danger" />
          <SummaryCard title="Pending Review" value={data.meta.summary.pendingReviewDayCount} tone="warn" />
          <SummaryCard title="Anomaly Gün" value={data.meta.summary.anomalyDayCount} tone="warn" />
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
        {error ? (
          <div className="p-4 text-sm text-rose-700">{error}</div>
        ) : loading && !data ? (
          <div className="p-4 text-sm text-slate-500">Günlük detay yükleniyor...</div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">Detay bulunamadı.</div>
        ) : (
          <div className="max-h-[640px] overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-3 font-semibold">Gün</th>
                  <th className="px-4 py-3 font-semibold">Durum</th>
                  <th className="px-4 py-3 font-semibold">Giriş</th>
                  <th className="px-4 py-3 font-semibold">Çıkış</th>
                  <th className="px-4 py-3 font-semibold">Çalışma</th>
                  <th className="px-4 py-3 font-semibold">Mesai</th>
                  <th className="px-4 py-3 font-semibold">Geç</th>
                  <th className="px-4 py-3 font-semibold">Erken</th>
                  <th className="px-4 py-3 font-semibold">Review</th>
                  <th className="px-4 py-3 font-semibold">Blok Sebebi</th>
                  <th className="px-4 py-3 font-semibold">Anomaly</th>
                  <th className="px-4 py-3 font-semibold">Kodlar</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.dayKey} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3 text-slate-700">{fmtDate(item.dayKey)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium">{item.status}</div>
                      <div className="mt-1 text-[11px] text-slate-500">{item.leaveType || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{fmtDateTime(item.firstIn)}</td>
                    <td className="px-4 py-3 text-slate-700">{fmtDateTime(item.lastOut)}</td>
                    <td className="px-4 py-3 text-slate-700">{fmtMinutes(item.workedMinutes)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{fmtMinutes(item.overtimeMinutes)}</div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        E:{fmtMinutes(item.overtimeEarlyMinutes)} / G:{fmtMinutes(item.overtimeLateMinutes)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{fmtMinutes(item.lateMinutes)}</td>
                    <td className="px-4 py-3 text-slate-700">{fmtMinutes(item.earlyLeaveMinutes)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium">{item.reviewStatus}</div>
                      {item.reviewNote ? <div className="mt-1 text-[11px] text-slate-500">{item.reviewNote}</div> : null}
                      {item.reviewedAt ? <div className="mt-1 text-[11px] text-slate-400">{fmtDateTime(item.reviewedAt)}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.puantajBlockReasons.length > 0 ? (
                        <div className="space-y-1">
                          {item.puantajBlockReasons.map((reason) => (
                            <div key={reason.code} className="rounded-xl bg-rose-50 px-2 py-1 text-[11px] text-rose-700 ring-1 ring-rose-200">
                              <div className="font-semibold">{reason.code}</div>
                              <div>{reason.detail}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                          READY
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="space-y-1">
                        {item.anomalies.length > 0 ? item.anomalies.map((a) => (
                          <div key={a} className="rounded-xl bg-amber-50 px-2 py-1 text-[11px] text-amber-700 ring-1 ring-amber-200">
                            {a}
                          </div>
                        )) : <span className="text-xs text-slate-400">—</span>}
                        {item.manualAdjustmentApplied ? (
                          <div className="rounded-xl bg-violet-50 px-2 py-1 text-[11px] text-violet-700 ring-1 ring-violet-200">
                            Manual Adjustment
                            {item.adjustmentNote ? ` · ${item.adjustmentNote}` : ""}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-[260px] flex-wrap gap-1">
                        {item.puantajCodes.length > 0 ? item.puantajCodes.map((code) => (
                          <span
                            key={code}
                            className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700"
                          >
                            {code}
                          </span>
                        )) : <span className="text-xs text-slate-400">—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoBadge(props: { label: string; value: string; tone?: "default" | "info" | "good" | "warn" | "danger" }) {
  const tone =
     props.tone === "info"
       ? "border-sky-200 bg-sky-50 text-sky-800"
       : props.tone === "good"
         ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : props.tone === "warn"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : props.tone === "danger"
            ? "border-rose-200 bg-rose-50 text-rose-800"
          : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={cx("rounded-2xl border px-3 py-2", tone)}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">{props.label}</div>
      <div className="mt-1 text-sm font-medium">{props.value}</div>
    </div>
  );
}

function mappingSourceTone(source: MappingSource) {
  return source === "DB" ? "good" : "warn";
}

function PayrollMiniCard(props: { title: string; value: string | number; subtitle?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{props.title}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{props.value}</div>
      {props.subtitle ? <div className="mt-1 text-xs text-slate-500">{props.subtitle}</div> : null}
    </div>
  );
}

function ReadinessIssueBadge(props: { code: ReadinessIssueCode }) {
  const map: Record<ReadinessIssueCode, { label: string; cls: string }> = {
    REVIEW_REQUIRED: {
      label: "Review Required",
      cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    },
    PENDING_REVIEW: {
      label: "Pending Review",
      cls: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
    },
    REJECTED_REVIEW: {
      label: "Rejected Review",
      cls: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    },
    BLOCKED_DAYS: {
      label: "Blocked Days",
      cls: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
    },
  };

  const item = map[props.code];
  return (
    <span className={cx("inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold", item.cls)}>
      {item.label}
    </span>
  );
}

export default function MonthlyPuantajClient() {
  const [month, setMonth] = useState(currentMonthValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [periodError, setPeriodError] = useState<string | null>(null);
  const [periodData, setPeriodData] = useState<PeriodApiResponse | null>(null);
  const [periodActionLoading, setPeriodActionLoading] = useState<null | "PRE_CLOSE" | "CLOSE">(null);
  const [periodActionError, setPeriodActionError] = useState<string | null>(null);
  const [periodNote, setPeriodNote] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditData, setAuditData] = useState<AuditApiResponse | null>(null);
  const [auditTypeFilter, setAuditTypeFilter] = useState<"ALL" | AuditEventType>("ALL");
  const [auditVisibleCount, setAuditVisibleCount] = useState(8);
  const [query, setQuery] = useState("");
  const [readyFilter, setReadyFilter] = useState<"ALL" | "READY" | "BLOCKED">("ALL");
  const [selectedEmployee, setSelectedEmployee] = useState<PuantajMonthlyEmployeeSummary | null>(null);
  const [monthlyProfile, setMonthlyProfile] = useState<MonthlyProfile>("STANDARD_MONTHLY");
  const [dailyProfile, setDailyProfile] = useState<DailyProfile>("STANDARD_DAILY");
  const [mappingProfilesLoading, setMappingProfilesLoading] = useState(false);
  const [mappingProfilesError, setMappingProfilesError] = useState<string | null>(null);
  const [mappingProfilesData, setMappingProfilesData] = useState<PayrollMappingProfilesApiResponse | null>(null);
  const [payrollMappingProfile, setPayrollMappingProfile] = useState<PayrollMappingProfile>("DEFAULT_TR");
  const [payrollPreviewLoading, setPayrollPreviewLoading] = useState(false);
  const [payrollPreviewError, setPayrollPreviewError] = useState<string | null>(null);
  const [payrollPreview, setPayrollPreview] = useState<PayrollCodeSummaryApiResponse | null>(null);
  const [payrollQuery, setPayrollQuery] = useState("");
  const [payrollCodeFilter, setPayrollCodeFilter] = useState("ALL");
  const [payrollUnitFilter, setPayrollUnitFilter] = useState<"ALL" | "MINUTES" | "DAYS" | "COUNT">("ALL");
  const [payrollOnlySelectedEmployee, setPayrollOnlySelectedEmployee] = useState(false);
  const [payrollPreviewSort, setPayrollPreviewSort] = useState<PayrollPreviewSort>("EMPLOYEE");
  const [payrollPreviewMode, setPayrollPreviewMode] = useState<PayrollPreviewMode>("ROWS");
  const detailRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToDetailRef = useRef(false);
  const [readinessQuery, setReadinessQuery] = useState("");
  const [readinessIssueFilter, setReadinessIssueFilter] = useState<"ALL" | ReadinessIssueCode>("ALL");
  const [readinessOnlySelectedEmployee, setReadinessOnlySelectedEmployee] = useState(false);
  const [readinessVisibleCount, setReadinessVisibleCount] = useState(12);

  async function loadMappingProfiles(preferredCode?: string | null) {
    setMappingProfilesLoading(true);
    setMappingProfilesError(null);

    try {
      const res = await fetch("/api/puantaj/payroll-mapping/profiles", {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Payroll mapping profile listesi alınamadı.");
      }

      setMappingProfilesData(json);

      const availableCodes = new Set<string>((json?.items ?? []).map((x: PayrollMappingProfileListItem) => x.code));
      const nextCode =
        preferredCode && availableCodes.has(preferredCode)
          ? preferredCode
          : payrollMappingProfile && availableCodes.has(payrollMappingProfile)
            ? payrollMappingProfile
            : json?.meta?.summary?.defaultProfileCode
              ? String(json.meta.summary.defaultProfileCode)
              : json?.items?.[0]?.code ?? "DEFAULT_TR";

      setPayrollMappingProfile(nextCode);
    } catch (err: any) {
      setMappingProfilesError(err?.message || "Payroll mapping profile listesi alınamadı.");
      setMappingProfilesData(null);
    } finally {
      setMappingProfilesLoading(false);
    }
  }

  async function loadPeriod(targetMonth: string) {
    setPeriodLoading(true);
    setPeriodError(null);

    try {
      const res = await fetch(`/api/puantaj/period?month=${encodeURIComponent(targetMonth)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Period bilgisi alınamadı.");
      }

      setPeriodData(json);
      setPeriodNote(json?.period?.note ?? "");
    } catch (err: any) {
      setPeriodError(err?.message || "Period bilgisi alınamadı.");
      setPeriodData(null);
    } finally {
      setPeriodLoading(false);
    }
  }

  async function loadAudit(targetMonth: string) {
    setAuditLoading(true);
    setAuditError(null);

    try {
      const params = new URLSearchParams({
        month: targetMonth,
        take: "100",
      });

      const res = await fetch(`/api/puantaj/audit?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Audit timeline alınamadı.");
      }

      setAuditData(json);
    } catch (err: any) {
      setAuditError(err?.message || "Audit timeline alınamadı.");
      setAuditData(null);
    } finally {
      setAuditLoading(false);
    }
  }

  useEffect(() => {
    void loadMappingProfiles();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          month,
          profile: monthlyProfile,
          mappingProfile: payrollMappingProfile,
        });
        const res = await fetch(`/api/puantaj/monthly?${params.toString()}`, {
          cache: "no-store"
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || "Puantaj verisi alınamadı.");
        }
        if (!cancelled) {
          setData(json);
        }
        if (!cancelled) {
          const resolvedMappingProfile = String(
            json?.meta?.projection?.payrollMappingProfile ?? payrollMappingProfile ?? "DEFAULT_TR"
          );
          setPayrollMappingProfile(resolvedMappingProfile);
          if (mappingProfilesData) {
            const hasResolvedProfile = (mappingProfilesData.items ?? []).some((x) => x.code === resolvedMappingProfile);
            if (!hasResolvedProfile) {
              void loadMappingProfiles(resolvedMappingProfile);
            }
          }
        }
        if (!cancelled && selectedEmployee) {
          const refreshedSelected = (json.items as PuantajMonthlyEmployeeSummary[]).find(
            (x) => x.employeeId === selectedEmployee.employeeId
          );
          setSelectedEmployee(refreshedSelected ?? null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Beklenmeyen bir hata oluştu.");
          setData(null);
          setSelectedEmployee(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [month, monthlyProfile, payrollMappingProfile]);

  useEffect(() => {
    void loadPeriod(month);
  }, [month]);

  useEffect(() => {
    void loadAudit(month);
  }, [month]);

  useEffect(() => {
    if (!selectedEmployee) return;
    if (!shouldScrollToDetailRef.current) return;
    const el = detailRef.current;
    if (!el) return;

    shouldScrollToDetailRef.current = false;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedEmployee]);

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    const q = query.trim().toLocaleLowerCase("tr");

    return items.filter((item) => {
      if (readyFilter === "READY" && !item.isPayrollReady) return false;
      if (readyFilter === "BLOCKED" && item.isPayrollReady) return false;

      if (!q) return true;
      const haystack = [item.employeeCode, item.fullName].join(" ").toLocaleLowerCase("tr");
      return haystack.includes(q);
    });
  }, [data?.items, query, readyFilter]);

  const exportHref = useMemo(() => {
    const p = new URLSearchParams({ month, profile: monthlyProfile });
    if (monthlyProfile === "PAYROLL_CODE_SUMMARY") {
      p.set("mappingProfile", payrollMappingProfile);
    }
    return `/api/puantaj/monthly/export?${p.toString()}`;
  }, [month, monthlyProfile, payrollMappingProfile]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (monthlyProfile !== "PAYROLL_CODE_SUMMARY") {
        setPayrollPreview(null);
        setPayrollPreviewError(null);
        setPayrollPreviewLoading(false);
        return;
      }

      setPayrollPreviewLoading(true);
      setPayrollPreviewError(null);
      try {
        const params = new URLSearchParams({
          month,
          mappingProfile: payrollMappingProfile,
        });
        const res = await fetch(`/api/puantaj/payroll-code-summary?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || "Payroll code summary preview alınamadı.");
        }
        if (!cancelled) {
          setPayrollPreview(json);
        }
      } catch (err: any) {
        if (!cancelled) {
          setPayrollPreviewError(err?.message || "Beklenmeyen bir hata oluştu.");
          setPayrollPreview(null);
        }
      } finally {
        if (!cancelled) setPayrollPreviewLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [month, monthlyProfile, payrollMappingProfile]);

  const payrollCodeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of payrollPreview?.items ?? []) {
      if (item.payrollCode) set.add(item.payrollCode);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
  }, [payrollPreview?.items]);

  const filteredPayrollItems = useMemo(() => {
    const items = payrollPreview?.items ?? [];
    const q = payrollQuery.trim().toLocaleLowerCase("tr");

    return items.filter((item) => {
      if (payrollOnlySelectedEmployee && selectedEmployee && item.employeeId !== selectedEmployee.employeeId) {
        return false;
      }

      if (payrollCodeFilter !== "ALL" && item.payrollCode !== payrollCodeFilter) {
        return false;
      }

      if (payrollUnitFilter !== "ALL" && item.unit !== payrollUnitFilter) {
        return false;
      }

      if (!q) return true;

      const strategyText = quantityStrategyLabel(item.quantityStrategy).toLocaleLowerCase("tr");
      const projectionText = projectionDetailText(item).toLocaleLowerCase("tr");
      const fixedQuantityText = formatFixedQuantity(item.fixedQuantity).toLocaleLowerCase("tr");

      const haystack = [
        item.employeeCode,
        item.fullName,
        item.code,
        item.payrollCode,
        item.payrollLabel,
        item.unit,
        item.quantityStrategy,
        strategyText,
        projectionText,
        fixedQuantityText,
      ]
        .join(" ")
        .toLocaleLowerCase("tr");

      return haystack.includes(q);
    });
  }, [
    payrollPreview?.items,
    payrollQuery,
    payrollCodeFilter,
    payrollUnitFilter,
    payrollOnlySelectedEmployee,
    selectedEmployee,
  ]);

  const sortedPayrollItems = useMemo(() => {
    const items = [...filteredPayrollItems];

    items.sort((a, b) => {
      switch (payrollPreviewSort) {
        case "PAYROLL_CODE": {
          const c1 = a.payrollCode.localeCompare(b.payrollCode, "tr");
          if (c1 !== 0) return c1;
          const c2 = a.employeeCode.localeCompare(b.employeeCode, "tr");
          if (c2 !== 0) return c2;
          return a.code.localeCompare(b.code, "tr");
        }
        case "QUANTITY_DESC": {
          if (b.quantity !== a.quantity) return b.quantity - a.quantity;
          return a.employeeCode.localeCompare(b.employeeCode, "tr");
        }
        case "MINUTES_DESC": {
          if (b.totalMinutes !== a.totalMinutes) return b.totalMinutes - a.totalMinutes;
          return a.employeeCode.localeCompare(b.employeeCode, "tr");
        }
        case "EMPLOYEE":
        default: {
          const c1 = a.employeeCode.localeCompare(b.employeeCode, "tr");
          if (c1 !== 0) return c1;
          const c2 = a.payrollCode.localeCompare(b.payrollCode, "tr");
          if (c2 !== 0) return c2;
          return a.code.localeCompare(b.code, "tr");
        }
      }
    });

    return items;
  }, [filteredPayrollItems, payrollPreviewSort]);

  const payrollGroupedByCode = useMemo(() => {
    const map = new Map<
      string,
      {
        payrollCode: string;
        payrollLabel: string;
        unit: MappingUnit;
        rowCount: number;
        quantityStrategySet: string[];
        fixedQuantitySet: Array<number | null>;
        quantity: number;
        totalMinutes: number;
      }
    >();

    for (const item of filteredPayrollItems) {
      const key = `${item.payrollCode}__${item.unit}`;
      let acc = map.get(key);
      if (!acc) {
        acc = {
          payrollCode: item.payrollCode,
          payrollLabel: item.payrollLabel,
          unit: item.unit,
          rowCount: 0,
          quantityStrategySet: [],
          fixedQuantitySet: [],
          quantity: 0,
          totalMinutes: 0,
        };
        map.set(key, acc);
      }

      const strategyLabel = quantityStrategyLabel(item.quantityStrategy);
      if (!acc.quantityStrategySet.includes(strategyLabel)) {
        acc.quantityStrategySet.push(strategyLabel);
      }
      if (!acc.fixedQuantitySet.some((x) => x === item.fixedQuantity)) {
        acc.fixedQuantitySet.push(item.fixedQuantity);
      }

      acc.rowCount += 1;
      acc.quantity += item.quantity;
      acc.totalMinutes += item.totalMinutes;
    }

    return Array.from(map.values()).sort((a, b) => {
      const c = a.payrollCode.localeCompare(b.payrollCode, "tr");
      if (c !== 0) return c;
      return a.unit.localeCompare(b.unit, "tr");
    });
  }, [filteredPayrollItems]);

  const payrollMinutesSummary = useMemo(() => {
    return filteredPayrollItems
      .filter((x) => x.unit === "MINUTES")
      .reduce((sum, x) => sum + x.totalMinutes, 0);
  }, [filteredPayrollItems]);

  const payrollDaysSummary = useMemo(() => {
    return filteredPayrollItems
      .filter((x) => x.unit === "DAYS")
      .reduce((sum, x) => sum + x.quantity, 0);
  }, [filteredPayrollItems]);

  const payrollCountSummary = useMemo(() => {
    return filteredPayrollItems
      .filter((x) => x.unit === "COUNT")
      .reduce((sum, x) => sum + x.quantity, 0);
  }, [filteredPayrollItems]);

  const payrollDistinctEmployeeCount = useMemo(() => {
    return new Set(filteredPayrollItems.map((x) => x.employeeId)).size;
  }, [filteredPayrollItems]);

  const payrollDistinctCodeCount = payrollGroupedByCode.length;

  const readinessRows = useMemo<ReadinessRow[]>(() => {
    const items = data?.items ?? [];

    return items
      .filter((item) => !item.isPayrollReady || item.blockedDays > 0)
      .map((item) => {
        const issues: ReadinessIssueCode[] = [];

        if (item.reviewRequiredDays > 0) issues.push("REVIEW_REQUIRED");
        if (item.pendingReviewDays > 0) issues.push("PENDING_REVIEW");
        if (item.rejectedReviewDays > 0) issues.push("REJECTED_REVIEW");
        if (item.blockedDays > 0 && issues.length === 0) issues.push("BLOCKED_DAYS");

        return {
          employeeId: item.employeeId,
          employeeCode: item.employeeCode,
          fullName: item.fullName,
          blockedDays: item.blockedDays,
          reviewRequiredDays: item.reviewRequiredDays,
          pendingReviewDays: item.pendingReviewDays,
          rejectedReviewDays: item.rejectedReviewDays,
          issues,
        };
      })
      .sort((a, b) => {
        if (b.blockedDays !== a.blockedDays) return b.blockedDays - a.blockedDays;
        if (b.pendingReviewDays !== a.pendingReviewDays) return b.pendingReviewDays - a.pendingReviewDays;
        return a.employeeCode.localeCompare(b.employeeCode, "tr");
      });
  }, [data?.items]);

  const readinessSummary = useMemo(() => {
    return readinessRows.reduce(
      (acc, row) => {
        acc.blockedEmployeeCount += 1;
        acc.blockedDayCount += row.blockedDays;
        acc.reviewRequiredDayCount += row.reviewRequiredDays;
        acc.pendingReviewDayCount += row.pendingReviewDays;
        acc.rejectedReviewDayCount += row.rejectedReviewDays;
        return acc;
      },
      {
        blockedEmployeeCount: 0,
        blockedDayCount: 0,
        reviewRequiredDayCount: 0,
        pendingReviewDayCount: 0,
        rejectedReviewDayCount: 0,
      }
    );
  }, [readinessRows]);

  const filteredReadinessRows = useMemo(() => {
    const q = readinessQuery.trim().toLocaleLowerCase("tr");

    return readinessRows.filter((row) => {
      if (readinessOnlySelectedEmployee && selectedEmployee && row.employeeId !== selectedEmployee.employeeId) {
        return false;
      }

      if (readinessIssueFilter !== "ALL" && !row.issues.includes(readinessIssueFilter)) {
        return false;
      }

      if (!q) return true;

      const haystack = [row.employeeCode, row.fullName, ...row.issues].join(" ").toLocaleLowerCase("tr");
      return haystack.includes(q);
    });
  }, [
    readinessRows,
    readinessQuery,
    readinessIssueFilter,
    readinessOnlySelectedEmployee,
    selectedEmployee,
  ]);

  const topReadinessRows = filteredReadinessRows.slice(0, readinessVisibleCount);

  const hasReadinessFilters =
    readinessQuery.trim().length > 0 ||
    readinessIssueFilter !== "ALL" ||
    readinessOnlySelectedEmployee;

  const resetReadinessFilters = () => {
    setReadinessQuery("");
    setReadinessIssueFilter("ALL");
    setReadinessOnlySelectedEmployee(false);
  };

  const readinessExportFileName = useMemo(() => {
    const scope =
      readinessOnlySelectedEmployee && selectedEmployee?.employeeCode
        ? selectedEmployee.employeeCode
        : "filtered";
    return `puantaj-readiness-${month}-${scope}.csv`;
  }, [month, readinessOnlySelectedEmployee, selectedEmployee?.employeeCode]);

  const handleReadinessExport = () => {
    if (filteredReadinessRows.length === 0) return;
    const csv = renderReadinessCsv(filteredReadinessRows);
    downloadCsv(readinessExportFileName, csv);
  };

  const readinessIssueCounts = useMemo(() => {
    return filteredReadinessRows.reduce(
      (acc, row) => {
        if (row.issues.includes("REVIEW_REQUIRED")) acc.reviewRequired += 1;
        if (row.issues.includes("PENDING_REVIEW")) acc.pending += 1;
        if (row.issues.includes("REJECTED_REVIEW")) acc.rejected += 1;
        return acc;
      },
      {
        total: filteredReadinessRows.length,
        reviewRequired: 0,
        pending: 0,
        rejected: 0,
      }
    );
  }, [filteredReadinessRows]);

  const groupedPayrollItems = useMemo(() => {
    const map = new Map<string, GroupedPayrollCodeSummaryRow>();

    for (const item of sortedPayrollItems) {
      const key = `${item.employeeId}__${item.payrollCode}__${item.unit}`;
      let acc = map.get(key);
      if (!acc) {
        acc = {
          employeeId: item.employeeId,
          employeeCode: item.employeeCode,
          fullName: item.fullName,
          payrollCode: item.payrollCode,
          payrollLabel: item.payrollLabel,
          unit: item.unit,
          quantityStrategySet: [],
          fixedQuantitySet: [],
          quantity: 0,
          dayCount: 0,
          totalMinutes: 0,
          sourceRowCount: 0,
        };
        map.set(key, acc);
      }

      const strategyLabel = quantityStrategyLabel(item.quantityStrategy);
      if (!acc.quantityStrategySet.includes(strategyLabel)) {
        acc.quantityStrategySet.push(strategyLabel);
      }
      if (!acc.fixedQuantitySet.some((x) => x === item.fixedQuantity)) {
        acc.fixedQuantitySet.push(item.fixedQuantity);
      }
      acc.quantity += item.quantity;
      acc.dayCount += item.dayCount;
      acc.totalMinutes += item.totalMinutes;
      acc.sourceRowCount += 1;
    }

    return Array.from(map.values()).sort((a, b) => {
      const c1 = a.employeeCode.localeCompare(b.employeeCode, "tr");
      if (c1 !== 0) return c1;
      return a.payrollCode.localeCompare(b.payrollCode, "tr");
    });
  }, [sortedPayrollItems]);

  const filteredPayrollExportFileName = useMemo(() => {
    const scope = payrollOnlySelectedEmployee && selectedEmployee?.employeeCode
      ? selectedEmployee.employeeCode
      : "filtered";
    const mode = payrollPreviewMode === "GROUPED" ? "grouped" : "rows";
    return `puantaj-payroll-code-summary-${month}-${scope}-${mode}.csv`;
  }, [month, payrollOnlySelectedEmployee, selectedEmployee?.employeeCode, payrollPreviewMode]);

  const handleFilteredPayrollExport = () => {
    if (payrollPreviewMode === "GROUPED") {
      if (groupedPayrollItems.length === 0) return;
      const csv = renderGroupedPayrollCsv(groupedPayrollItems, month);
      downloadCsv(filteredPayrollExportFileName, csv);
      return;
    }

    if (sortedPayrollItems.length === 0) return;
    const csv = renderFilteredPayrollCsv(sortedPayrollItems);
    downloadCsv(filteredPayrollExportFileName, csv);
  };

  const dailyExportHref = useMemo(() => {
    const p = new URLSearchParams({ month, profile: dailyProfile });
    if (selectedEmployee?.employeeId) {
      p.set("employeeId", selectedEmployee.employeeId);
    }
    
    return `/api/puantaj/daily/export?${p.toString()}`;
  }, [month, dailyProfile, selectedEmployee?.employeeId]);

  const periodTopBlockingRows = periodData?.readiness.topBlockingEmployees ?? [];
  const canManagePeriod = periodData?.meta.actions.canManagePeriod ?? false;
  const canPreClose = periodData?.meta.actions.canPreClose ?? false;
  const canClose = periodData?.meta.actions.canClose ?? false;
  const isScopedPeriodView = periodData?.meta.scope?.isScoped ?? false;
  const filteredAuditItems = useMemo(() => {
    const items = auditData?.page.items ?? [];
    if (auditTypeFilter === "ALL") return items;
    return items.filter((item) => item.eventType === auditTypeFilter);
  }, [auditData?.page.items, auditTypeFilter]);
  const visibleAuditItems = filteredAuditItems.slice(0, auditVisibleCount);

  const selectedMappingProfileDetail = useMemo(() => {
    return (mappingProfilesData?.items ?? []).find((x) => x.code === payrollMappingProfile) ?? null;
  }, [mappingProfilesData?.items, payrollMappingProfile]);

  const mappingProfileOptions = useMemo(() => {
    return (mappingProfilesData?.items ?? []).filter((x) => x.isActive || x.code === payrollMappingProfile);
  }, [mappingProfilesData?.items, payrollMappingProfile]);

  async function handlePeriodAction(action: "PRE_CLOSE" | "CLOSE") {
    setPeriodActionLoading(action);
    setPeriodActionError(null);

    try {
      const url =
        action === "PRE_CLOSE"
          ? "/api/puantaj/period/pre-close"
          : "/api/puantaj/period/close";

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          month,
          note: periodNote.trim(),
          payrollMappingProfile,
          monthlyExportProfile: monthlyProfile,
          dailyExportProfile: dailyProfile,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json?.error === "PERIOD_NOT_READY_TO_CLOSE") {
          const r = json?.readiness;
          const parts = [
            r?.blockedDayCount ? `Bloklu Gün: ${r.blockedDayCount}` : null,
            r?.reviewRequiredDayCount ? `Review Required: ${r.reviewRequiredDayCount}` : null,
            r?.pendingReviewDayCount ? `Pending: ${r.pendingReviewDayCount}` : null,
            r?.rejectedReviewDayCount ? `Rejected: ${r.rejectedReviewDayCount}` : null,
          ].filter(Boolean);

          throw new Error(
            parts.length > 0
              ? `Dönem kapatılamadı. ${parts.join(" • ")}`
              : "Dönem kapatılamadı. Readiness uygun değil."
          );
        }

        throw new Error(json?.message || json?.error || "İşlem başarısız.");
      }

      setPeriodData(json);
      setPeriodNote(json?.period?.note ?? "");
      if (action === "CLOSE" && json?.snapshot) {
        if (json.snapshot.payrollMappingProfile) {
          setPayrollMappingProfile(json.snapshot.payrollMappingProfile);
        }
        if (json.snapshot.monthlyExportProfile) {
          setMonthlyProfile(json.snapshot.monthlyExportProfile as MonthlyProfile);
        }
        if (json.snapshot.dailyExportProfile) {
          setDailyProfile(json.snapshot.dailyExportProfile as DailyProfile);
        }
      }
      await loadAudit(month);
    } catch (err: any) {
      setPeriodActionError(err?.message || "İşlem başarısız.");
    } finally {
      setPeriodActionLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Puantaj</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Aylık Puantaj Özeti</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Bu ekran time engine sonucunu değiştirmez. DailyAttendance gerçeğinden türetilen ayrı puantaj projection
            katmanını gösterir.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Payroll Mapping Profile</label>
            <select
              value={payrollMappingProfile}
              onChange={(e) => setPayrollMappingProfile(e.target.value as PayrollMappingProfile)}
              disabled={mappingProfilesLoading}
              className={cx(
                "h-10 rounded-xl border bg-white px-3 text-sm outline-none transition focus:border-slate-400",
                mappingProfilesLoading
                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                  : "border-slate-300"
              )}
            >
              {mappingProfileOptions.length > 0 ? (
                mappingProfileOptions.map((profile) => (
                  <option key={profile.code} value={profile.code}>
                    {profile.code} · {profile.name}
                  </option>
                ))
              ) : (
                <option value="DEFAULT_TR">DEFAULT_TR</option>
              )}
            </select>
            {mappingProfilesError ? (
              <div className="mt-1 text-[11px] text-rose-600">{mappingProfilesError}</div>
            ) : selectedMappingProfileDetail ? (
              <div className="mt-1 text-[11px] text-slate-500">
                {selectedMappingProfileDetail.source} · {selectedMappingProfileDetail.isDefault ? "Default" : "Custom"} ·{" "}
                {selectedMappingProfileDetail.isActive ? "Active" : "Passive"} · Item: {selectedMappingProfileDetail.itemCount}
              </div>
            ) : (
              <div className="mt-1 text-[11px] text-slate-500">
                {mappingProfilesLoading ? "Mapping profilleri yükleniyor..." : "Aktif mapping profile seç."}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Monthly Export Profile</label>
            <select
              value={monthlyProfile}
              onChange={(e) => setMonthlyProfile(e.target.value as MonthlyProfile)}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
            >
              <option value="STANDARD_MONTHLY">Standard Monthly</option>
              <option value="PAYROLL_CODE_SUMMARY">Payroll Code Summary</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Daily Export Profile</label>
            <select
              value={dailyProfile}
              onChange={(e) => setDailyProfile(e.target.value as DailyProfile)}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
            >
              <option value="STANDARD_DAILY">Standard Daily</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Ay</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none ring-0 transition focus:border-slate-400"
            />
          </div>

          <div className="pt-0 sm:pt-5">
            <a
              href={exportHref}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              CSV İndir
            </a>
          </div>

          <div className="pt-0 sm:pt-5">
            <a
              href={dailyExportHref}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {selectedEmployee ? "Seçili Günlük CSV" : "Tüm Günlük CSV"}
            </a>
          </div>
        </div>
      </div>

      {data ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoBadge
            label="Monthly Profile"
            value={data.meta.projection.monthlyExportProfileLabel}
            tone="info"
          />
          <InfoBadge
            label="Mapping Profile"
            value={data.meta.projection.payrollMappingProfile}
            tone={data.meta.projection.payrollMappingActive ? "good" : "default"}
          />
          {selectedMappingProfileDetail ? (
            <InfoBadge
              label="Mapping Source"
              value={selectedMappingProfileDetail.source}
              tone={mappingSourceTone(selectedMappingProfileDetail.source)}
            />
          ) : null}
          <InfoBadge label="Timezone" value={data.meta.tz} />
          <InfoBadge label="Company" value={data.meta.company.name || "-"} />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Period Workflow</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">Ay Kapanış Durumu</div>
              <div className="mt-1 text-sm text-slate-600">
                Bu panel puantaj döneminin resmi lifecycle state bilgisini gösterir.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <InfoBadge
                label="Period Status"
                value={periodData ? periodStatusLabel(periodData.period.status) : periodLoading ? "Yükleniyor..." : "-"}
                tone={periodData ? periodStatusTone(periodData.period.status) : "default"}
              />
              <InfoBadge
                label="Close Readiness"
                value={periodData ? (periodData.readiness.isReadyToClose ? "Ready" : "Blocked") : "-"}
                tone={periodData ? (periodData.readiness.isReadyToClose ? "good" : "danger") : "default"}
              />
            </div>
          </div>
        </div>

        <div className="px-5 py-4">
          {periodError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {periodError}
            </div>
          ) : null}

          {periodActionError ? (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {periodActionError}
            </div>
          ) : null}

          {isScopedPeriodView ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Bu görünüm erişim kapsamına göre filtrelidir. Period kapanış işlemleri company-wide yetki gerektirir.
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                  title="Bloklu Personel"
                  value={periodData?.readiness.blockedEmployeeCount ?? readinessSummary.blockedEmployeeCount}
                  tone="danger"
                />
                <SummaryCard
                  title="Bloklu Gün"
                  value={periodData?.readiness.blockedDayCount ?? readinessSummary.blockedDayCount}
                  tone="danger"
                />
                <SummaryCard
                  title="Pending Review"
                  value={periodData?.readiness.pendingReviewDayCount ?? readinessSummary.pendingReviewDayCount}
                  tone="warn"
                />
                <SummaryCard
                  title="Rejected Review"
                  value={periodData?.readiness.rejectedReviewDayCount ?? readinessSummary.rejectedReviewDayCount}
                  tone="danger"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Kapanış Notu</div>
                    <div className="text-xs text-slate-500">Pre-close ve close işlemlerinde period kaydına yazılır.</div>
                  </div>
                  {periodData?.period.note ? (
                    <div className="text-xs text-slate-500">
                      Mevcut not kaydı var
                    </div>
                  ) : null}
                </div>

                <textarea
                  value={periodNote}
                  onChange={(e) => setPeriodNote(e.target.value)}
                  rows={4}
                  disabled={!canManagePeriod || periodData?.period.status === "CLOSED"}
                  placeholder="Örn: Mart 2026 puantajı kontrol edildi, kritik blok bulunmadı."
                  className={cx(
                    "w-full rounded-2xl border bg-white px-3 py-3 text-sm outline-none transition",
                    !canManagePeriod || periodData?.period.status === "CLOSED"
                      ? "cursor-not-allowed border-slate-200 text-slate-400"
                      : "border-slate-300 focus:border-slate-400"
                  )}
                />

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handlePeriodAction("PRE_CLOSE")}
                    disabled={!canPreClose || periodActionLoading !== null || periodLoading}
                    className={cx(
                      "inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium transition",
                      !canPreClose || periodActionLoading !== null || periodLoading
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                        : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                    )}
                  >
                    {periodActionLoading === "PRE_CLOSE" ? "Pre-Close Çalışıyor..." : "Pre-Close"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePeriodAction("CLOSE")}
                    disabled={!canClose || periodActionLoading !== null || periodLoading}
                    className={cx(
                      "inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium transition",
                      !canClose || periodActionLoading !== null || periodLoading
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                        : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                    )}
                  >
                    {periodActionLoading === "CLOSE" ? "Close Çalışıyor..." : "Close Period"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void loadPeriod(month)}
                    disabled={periodActionLoading !== null || periodLoading}
                    className={cx(
                      "inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium transition",
                      periodActionLoading !== null || periodLoading
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    Yenile
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Lifecycle Özeti</div>
              <div className="mt-3 space-y-3 text-sm">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Pre-Closed</div>
                  <div className="mt-1 font-medium text-slate-900">
                    {fmtDateTime(periodData?.period.preClosedAt ?? null)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {periodData?.period.preClosedByUser?.email ?? "—"}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Closed</div>
                  <div className="mt-1 font-medium text-slate-900">
                    {fmtDateTime(periodData?.period.closedAt ?? null)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {periodData?.period.closedByUser?.email ?? "—"}
                  </div>
                </div>
                
                {periodData?.snapshot ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                    <div className="text-xs uppercase tracking-wide text-emerald-700">Locked Snapshot Truth</div>
                    <div className="mt-2 space-y-1 text-sm text-emerald-950">
                      <div>
                        <span className="font-medium">Mapping:</span> {periodData.snapshot.payrollMappingProfile}
                      </div>
                      <div>
                        <span className="font-medium">Monthly:</span>{" "}
                        {monthlyProfileLabel(periodData.snapshot.monthlyExportProfile)}
                      </div>
                      <div>
                        <span className="font-medium">Daily:</span> {dailyProfileLabel(periodData.snapshot.dailyExportProfile)}
                      </div>
                      <div>
                        <span className="font-medium">Created:</span> {fmtDateTime(periodData.snapshot.createdAt)}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Close Kuralı</div>
                  <div className="mt-1 text-slate-700">
                    {periodData?.readiness.isReadyToClose
                      ? "Bu dönem close için uygun görünüyor."
                      : "Blocked / review açıkları kapanmadan close yapılamaz."}
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="mb-2 text-sm font-semibold text-slate-900">İlk Bloklayıcı Personeller</div>
                {periodLoading && !periodData ? (
                  <div className="text-sm text-slate-500">Period bilgisi yükleniyor...</div>
                ) : periodTopBlockingRows.length === 0 ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    Bu dönem için resmi readiness tarafında bloklayıcı personel görünmüyor.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {periodTopBlockingRows.map((row) => (
                      <button
                        key={`period-block-${row.employeeId}`}
                        type="button"
                        onClick={() => {
                          shouldScrollToDetailRef.current = true;
                          const target = (data?.items ?? []).find((x) => x.employeeId === row.employeeId) ?? null;
                          setSelectedEmployee(target);
                        }}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-slate-900">{row.fullName || "-"}</div>
                            <div className="mt-1 text-xs text-slate-500">{row.employeeCode || "-"}</div>
                          </div>
                          <div className="text-right text-xs text-slate-600">
                            <div>Blok: <span className="font-semibold text-slate-900">{row.blockedDays}</span></div>
                            <div>Pending: <span className="font-semibold text-slate-900">{row.pendingReviewDays}</span></div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Audit Timeline</div>
                <div className="mt-1 text-xs text-slate-500">
                  Period, snapshot, export ve review olaylarının resmi kayıt akışı.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={auditTypeFilter}
                  onChange={(e) => {
                    setAuditTypeFilter(e.target.value as "ALL" | AuditEventType);
                    setAuditVisibleCount(8);
                  }}
                  className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="ALL">Tüm Audit Olayları</option>
                  <option value="PERIOD_PRE_CLOSED">Period Pre-Close</option>
                  <option value="PERIOD_CLOSED">Period Closed</option>
                  <option value="SNAPSHOT_CREATED">Snapshot Created</option>
                  <option value="MONTHLY_EXPORT_CREATED">Monthly Export</option>
                  <option value="DAILY_EXPORT_CREATED">Daily Export</option>
                  <option value="REVIEW_STATUS_CHANGED">Review Status</option>
                  <option value="REVIEW_NOTE_CHANGED">Review Note</option>
                </select>

                <button
                  type="button"
                  onClick={() => void loadAudit(month)}
                  disabled={auditLoading}
                  className={cx(
                    "inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium transition",
                    auditLoading
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                >
                  Yenile
                </button>
              </div>
            </div>

            <div className="px-4 py-4">
              {auditError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {auditError}
                </div>
              ) : auditLoading && !auditData ? (
                <div className="text-sm text-slate-500">Audit timeline yükleniyor...</div>
              ) : filteredAuditItems.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Bu filtre için gösterilecek audit olayı bulunamadı.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      {visibleAuditItems.length} / {filteredAuditItems.length} olay gösteriliyor
                    </div>
                    {filteredAuditItems.length > 8 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setAuditVisibleCount((prev) =>
                            prev >= filteredAuditItems.length ? 8 : Math.min(prev + 8, filteredAuditItems.length)
                          )
                        }
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        {auditVisibleCount >= filteredAuditItems.length ? "Daha Az Göster" : "Daha Fazla Göster"}
                      </button>
                    ) : null}
                  </div>

                  {visibleAuditItems.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <InfoBadge
                              label="Event"
                              value={auditEventLabel(event.eventType)}
                              tone={auditEventTone(event.eventType)}
                            />
                            <InfoBadge
                              label="Entity"
                              value={event.entityType}
                              tone="default"
                            />
                          </div>

                          <div className="mt-3 text-sm font-medium text-slate-900">
                            {formatAuditPayload(event)}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span>Zaman: {fmtDateTime(event.createdAt)}</span>
                            <span>Kullanıcı: {event.actorUser?.email ?? "System / Unknown"}</span>
                            {event.employeeId ? <span>Employee: {event.employeeId}</span> : null}
                            <span>EntityId: {event.entityId}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <SummaryCard title="Çalışan" value={data.meta.summary.employeeCount} />
          <SummaryCard title="Puantaja Hazır" value={data.meta.summary.payrollReadyCount} tone="good" />
          <SummaryCard title="Bloklu Kişi" value={data.meta.summary.blockedCount} tone="danger" />
          <SummaryCard title="Bloklu Gün" value={data.meta.summary.blockedDayCount} tone="danger" />
          <SummaryCard title="Pending Review Gün" value={data.meta.summary.pendingReviewDayCount} tone="warn" />
          <SummaryCard title="Review Gerekli Gün" value={data.meta.summary.reviewRequiredDayCount} tone="warn" />
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Personel kodu veya ad ile ara..."
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
            />

            <select
             value={readyFilter}
              onChange={(e) => setReadyFilter(e.target.value as "ALL" | "READY" | "BLOCKED")}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
            >
              <option value="ALL">Tümü</option>
              <option value="READY">Puantaja Hazır</option>
              <option value="BLOCKED">Bloklu</option>
            </select>
          </div>

          <div className="text-sm text-slate-500">
            {loading ? "Yükleniyor..." : `${filteredItems.length} kayıt gösteriliyor`}
          </div>
        </div>
      </div>

      {monthlyProfile === "PAYROLL_CODE_SUMMARY" ? (
        <div className="space-y-4">
          {payrollPreview ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard title="Payroll Satırı" value={payrollPreview.meta.summary.rowCount} />
              <SummaryCard title="Personel" value={payrollPreview.meta.summary.employeeCount} />
              <SummaryCard title="Payroll Kod" value={payrollPreview.meta.summary.codeCount} tone="info" />
              <SummaryCard title="Toplam Dakika" value={fmtMinutes(payrollPreview.meta.summary.totalMinutes)} tone="good" />
            </div>
          ) : null}

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Payroll Code Summary Preview</div>
                <div className="mt-1 text-xs text-slate-500">
                  Export almadan önce payroll projection satırlarını önizleme olarak gösterir.
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleFilteredPayrollExport}
                    disabled={filteredPayrollItems.length === 0}
                    className={cx(
                      "inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium transition",
                      (payrollPreviewMode === "GROUPED" ? groupedPayrollItems.length === 0 : sortedPayrollItems.length === 0)
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {payrollPreviewMode === "GROUPED" ? "Gruplu Payroll CSV" : "Filtrelenmiş Payroll CSV"}
                  </button>
                </div>
              </div>
              <div className="text-xs text-slate-500">{payrollMappingProfile}</div>
            </div>

            <div className="border-b border-slate-200 px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 flex-col gap-3 xl:flex-row">
                  <input
                    type="text"
                    value={payrollQuery}
                    onChange={(e) => setPayrollQuery(e.target.value)}
                    placeholder="Personel, iç kod, payroll kod veya açıklama ara..."
                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
                  />

                  <select
                    value={payrollCodeFilter}
                    onChange={(e) => setPayrollCodeFilter(e.target.value)}
                    className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
                  >
                    <option value="ALL">Tüm Payroll Kodları</option>
                    {payrollCodeOptions.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>

                  <select
                    value={payrollUnitFilter}
                    onChange={(e) =>
                      setPayrollUnitFilter(e.target.value as "ALL" | "MINUTES" | "DAYS" | "COUNT")
                    }
                    className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
                  >
                    <option value="ALL">Tüm Birimler</option>
                    <option value="MINUTES">MINUTES</option>
                    <option value="DAYS">DAYS</option>
                    <option value="COUNT">COUNT</option>
                  </select>

                  <select
                    value={payrollPreviewSort}
                    onChange={(e) => setPayrollPreviewSort(e.target.value as PayrollPreviewSort)}
                    className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
                  >
                    <option value="EMPLOYEE">Sırala: Personel</option>
                    <option value="PAYROLL_CODE">Sırala: Payroll Kod</option>
                    <option value="QUANTITY_DESC">Sırala: Quantity ↓</option>
                    <option value="MINUTES_DESC">Sırala: Dakika ↓</option>
                  </select>

                  <select
                    value={payrollPreviewMode}
                    onChange={(e) => setPayrollPreviewMode(e.target.value as PayrollPreviewMode)}
                    className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
                  >
                    <option value="ROWS">Görünüm: Satırlar</option>
                    <option value="GROUPED">Görünüm: Gruplu</option>
                  </select>
                </div>

                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={payrollOnlySelectedEmployee}
                    onChange={(e) => setPayrollOnlySelectedEmployee(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Sadece seçili personel
                </label>
              </div>
            </div>

            <div className="border-b border-slate-200 px-4 py-3">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <PayrollMiniCard
                  title="Filtrelenmiş Satır"
                  value={filteredPayrollItems.length}
                  subtitle="Strategy-aware payroll projection satırı"
                />
                <PayrollMiniCard
                  title="Personel"
                  value={payrollDistinctEmployeeCount}
                  subtitle="Filtre sonrası görünen personel"
                />
                <PayrollMiniCard
                  title="Dakika Toplamı"
                  value={fmtMinutes(payrollMinutesSummary)}
                  subtitle="MINUTES birimli satır toplamı"
                />
                <PayrollMiniCard
                  title="Gün Toplamı"
                  value={payrollDaysSummary}
                  subtitle="DAYS birimli quantity toplamı"
                />
                <PayrollMiniCard
                  title="Count Toplamı"
                  value={payrollCountSummary}
                  subtitle="COUNT birimli quantity toplamı"
                />
                <PayrollMiniCard
                  title="Projection Modu"
                  value={payrollPreviewMode === "GROUPED" ? "Grouped" : "Rows"}
                  subtitle={selectedMappingProfileDetail ? `${selectedMappingProfileDetail.code} · ${selectedMappingProfileDetail.source}` : payrollMappingProfile}  
                />
              </div>
            </div>

            <div className="border-b border-slate-200 px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Payroll Code Toplamları</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {payrollGroupedByCode.length > 0 ? (
                  payrollGroupedByCode.map((item) => (
                    <div
                      key={`${item.payrollCode}-${item.unit}`}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <div className="text-xs font-semibold text-slate-800">
                        {item.payrollCode} · {item.payrollLabel}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {item.unit} · {item.rowCount} satır
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        {item.unit === "MINUTES"
                          ? fmtMinutes(item.totalMinutes)
                          : item.unit === "DAYS"
                            ? `${item.quantity} gün`
                            : `${item.quantity} adet`}{" "}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        Strategy: {item.quantityStrategySet.join(" | ") || "—"}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        Fixed: {item.fixedQuantitySet.map((x) => formatFixedQuantity(x)).join(" | ") || "—"}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">Gösterilecek toplu özet bulunamadı.</div>
                )}
              </div>
            </div>

            {payrollPreviewError ? (
              <div className="p-6 text-sm text-rose-700">{payrollPreviewError}</div>
            ) : payrollPreviewLoading && !payrollPreview ? (
              <div className="p-6 text-sm text-slate-500">Payroll code summary preview yükleniyor...</div>
            ) : !payrollPreview || sortedPayrollItems.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">Payroll code summary kaydı bulunamadı.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-slate-600">
                      <th className="px-4 py-3 font-semibold">Personel</th>
                      <th className="px-4 py-3 font-semibold">İç Kod</th>
                      <th className="px-4 py-3 font-semibold">Payroll Kod</th>
                      <th className="px-4 py-3 font-semibold">Açıklama</th>
                      <th className="px-4 py-3 font-semibold">Birim</th>
                      <th className="px-4 py-3 font-semibold">Strategy</th>
                      <th className="px-4 py-3 font-semibold">Fixed Qty</th>
                      <th className="px-4 py-3 font-semibold">Projection</th>
                      <th className="px-4 py-3 font-semibold">Quantity</th>
                      <th className="px-4 py-3 font-semibold">Gün</th>
                      <th className="px-4 py-3 font-semibold">Dakika</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollPreviewMode === "ROWS" ? sortedPayrollItems.map((item, idx) => (
                      <tr key={`${item.employeeId}-${item.payrollCode}-${idx}`} className="border-t border-slate-100 align-top">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{item.fullName || "-"}</div>
                          <div className="text-xs text-slate-500">{item.employeeCode || "-"}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{item.code}</td>
                        <td className="px-4 py-3 text-slate-700">
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                            {item.payrollCode}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{item.payrollLabel}</td>
                        <td className="px-4 py-3 text-slate-700">{item.unit}</td>
                        <td className="px-4 py-3 text-slate-700">{quantityStrategyLabel(item.quantityStrategy)}</td>
                        <td className="px-4 py-3 text-slate-700">{item.fixedQuantity == null ? "—" : item.fixedQuantity}</td>
                        <td className="px-4 py-3 text-slate-700">
                          <div>{projectionDetailText(item)}</div>
                          <div className="mt-1 text-[11px] text-slate-500">
                            {item.unit === "MINUTES" ? "Minute projection" : item.unit === "DAYS" ? "Day projection" : "Count projection"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{item.quantity}</td>
                        <td className="px-4 py-3 text-slate-700">{item.dayCount}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {item.unit === "MINUTES" ? fmtMinutes(item.totalMinutes) : item.totalMinutes}
                        </td>
                      </tr>
                    )) : groupedPayrollItems.map((item, idx) => (
                      <tr key={`${item.employeeId}-${item.payrollCode}-${idx}`} className="border-t border-slate-100 align-top">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{item.fullName || "-"}</div>
                          <div className="text-xs text-slate-500">{item.employeeCode || "-"}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-500">—</td>
                        <td className="px-4 py-3 text-slate-700">
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                            {item.payrollCode}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <div>{item.payrollLabel}</div>
                          <div className="mt-1 text-[11px] text-slate-500">{item.sourceRowCount} kaynak satır</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{item.unit}</td>
                        <td className="px-4 py-3 text-slate-700">{item.quantityStrategySet.join(" | ") || "—"}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {item.fixedQuantitySet.map((x) => formatFixedQuantity(x)).join(" | ") || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {item.quantityStrategySet.length === 1
                            ? item.quantityStrategySet[0]
                            : "Mixed projection sources"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{item.quantity}</td>
                        <td className="px-4 py-3 text-slate-700">{item.dayCount}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {item.unit === "MINUTES" ? fmtMinutes(item.totalMinutes) : item.totalMinutes}
                        </td>
                      </tr>
                    ))}                  
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {data ? (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">Puantaj Kapanış Hazırlık Paneli</div>
            <div className="mt-1 text-xs text-slate-500">
              Kapanışa engel kayıtları ve öncelikli müdahale alanlarını özetler.
            </div>
          </div>

          <div className="border-b border-slate-200 px-4 py-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <PayrollMiniCard
                title="Bloklu Kişi"
                value={readinessSummary.blockedEmployeeCount}
                subtitle="Kapanışa hazır olmayan personel"
              />
              <PayrollMiniCard
                title="Bloklu Gün"
                value={readinessSummary.blockedDayCount}
                subtitle="Toplam engelli gün sayısı"
              />
              <PayrollMiniCard
                title="Review Required"
                value={readinessSummary.reviewRequiredDayCount}
                subtitle="Karar verilmemiş review günleri"
              />
              <PayrollMiniCard
                title="Pending Review"
                value={readinessSummary.pendingReviewDayCount}
                subtitle="Bekleyen review günleri"
              />
              <PayrollMiniCard
                title="Rejected Review"
                value={readinessSummary.rejectedReviewDayCount}
                subtitle="Reddedilmiş review günleri"
              />
            </div>
          </div>

          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-col gap-3 xl:flex-row">
                <input
                  type="text"
                  value={readinessQuery}
                  onChange={(e) => setReadinessQuery(e.target.value)}
                  placeholder="Personel kodu, ad veya issue ara..."
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
                />

                <select
                  value={readinessIssueFilter}
                  onChange={(e) => setReadinessIssueFilter(e.target.value as "ALL" | ReadinessIssueCode)}
                  className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="ALL">Tüm Sorunlar</option>
                  <option value="REVIEW_REQUIRED">Review Required</option>
                  <option value="PENDING_REVIEW">Pending Review</option>
                  <option value="REJECTED_REVIEW">Rejected Review</option>
                  <option value="BLOCKED_DAYS">Blocked Days</option>
                </select>
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={readinessOnlySelectedEmployee}
                  onChange={(e) => setReadinessOnlySelectedEmployee(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Sadece seçili personel
              </label>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {filteredReadinessRows.length} readiness kaydı bulundu
              </div>
              <button
                type="button"
                onClick={resetReadinessFilters}
                disabled={!hasReadinessFilters}
                className={cx(
                  "inline-flex h-9 items-center justify-center rounded-xl border px-3 text-xs font-medium transition",
                  hasReadinessFilters ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50" : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                )}
              >
                Filtreleri Temizle
              </button>
            </div>
            
            <div className="mt-3">
              <button
                type="button"
                onClick={handleReadinessExport}
                disabled={filteredReadinessRows.length === 0}
                className={cx(
                  "inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium transition",
                  filteredReadinessRows.length === 0
                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                )}
              >
                Filtrelenmiş Readiness CSV
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setReadinessIssueFilter("ALL")}
                className={cx(
                  "inline-flex rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  readinessIssueFilter === "ALL" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                )}
              >
                Tümü ({readinessIssueCounts.total})
              </button>
              <button
                type="button"
                onClick={() => setReadinessIssueFilter("REVIEW_REQUIRED")}
                className={cx(
                  "inline-flex rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  readinessIssueFilter === "REVIEW_REQUIRED" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                )}
              >
                Review Required ({readinessIssueCounts.reviewRequired})
              </button>
              <button
                type="button"
                onClick={() => setReadinessIssueFilter("PENDING_REVIEW")}
                className={cx(
                  "inline-flex rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  readinessIssueFilter === "PENDING_REVIEW" ? "bg-orange-600 text-white" : "bg-orange-50 text-orange-700 hover:bg-orange-100"
                )}
              >
                Pending ({readinessIssueCounts.pending})
              </button>
              <button
                type="button"
                onClick={() => setReadinessIssueFilter("REJECTED_REVIEW")}
                className={cx(
                  "inline-flex rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  readinessIssueFilter === "REJECTED_REVIEW" ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                )}
              >
                Rejected ({readinessIssueCounts.rejected})
              </button>
            </div>
          </div>

          <div className="px-4 py-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Öncelikli Bloklu Personeller</div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-slate-500">
                  {topReadinessRows.length} / {filteredReadinessRows.length} kayıt gösteriliyor
                </div>
                {filteredReadinessRows.length > 12 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setReadinessVisibleCount((prev) =>
                        prev >= filteredReadinessRows.length ? 12 : Math.min(prev + 12, filteredReadinessRows.length)
                      )
                    }
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    {readinessVisibleCount >= filteredReadinessRows.length ? "Daha Az Göster" : "Daha Fazla Göster"}
                  </button>
                ) : null}
              </div>
            </div>

            {topReadinessRows.length === 0 ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Bu ay için puantaj kapanışına engel görünen personel yok.
              </div>
            ) : (
              <div className="space-y-3">
                {topReadinessRows.map((row) => (
                  <button
                    key={row.employeeId}
                    type="button"
                    onClick={() => {
                      if (selectedEmployee?.employeeId === row.employeeId) {
                        setSelectedEmployee(null);
                        return;
                      }

                      shouldScrollToDetailRef.current = true;

                      const target = (data?.items ?? []).find((x) => x.employeeId === row.employeeId) ?? null;
                      setSelectedEmployee(target);
                    }}
                    className={cx(
                      "w-full rounded-2xl border px-4 py-3 text-left transition",
                      selectedEmployee?.employeeId === row.employeeId
                        ? "border-sky-300 bg-sky-50"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100"
                    )}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="font-medium text-slate-900">{row.fullName || "-"}</div>
                        <div className="mt-1 text-xs text-slate-500">{row.employeeCode || "-"}</div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {row.issues.map((issue) => (
                          <ReadinessIssueBadge key={`${row.employeeId}-${issue}`} code={issue} />
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 md:grid-cols-4">
                      <div className="text-xs text-slate-600">Bloklu Gün: <span className="font-semibold text-slate-900">{row.blockedDays}</span></div>
                      <div className="text-xs text-slate-600">Review Required: <span className="font-semibold text-slate-900">{row.reviewRequiredDays}</span></div>
                      <div className="text-xs text-slate-600">Pending: <span className="font-semibold text-slate-900">{row.pendingReviewDays}</span></div>
                      <div className="text-xs text-slate-600">Rejected: <span className="font-semibold text-slate-900">{row.rejectedReviewDays}</span></div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {error ? (
          <div className="p-6 text-sm text-rose-700">{error}</div>
        ) : loading && !data ? (
          <div className="p-6 text-sm text-slate-500">Puantaj verisi yükleniyor...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Kayıt bulunamadı.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-3 font-semibold">Personel</th>
                  <th className="px-4 py-3 font-semibold">Hazır</th>
                  <th className="px-4 py-3 font-semibold">Gün</th>
                  <th className="px-4 py-3 font-semibold">Present</th>
                  <th className="px-4 py-3 font-semibold">Absent</th>
                  <th className="px-4 py-3 font-semibold">Leave</th>
                  <th className="px-4 py-3 font-semibold">Off</th>
                  <th className="px-4 py-3 font-semibold">Çalışma</th>
                  <th className="px-4 py-3 font-semibold">Mesai</th>
                  <th className="px-4 py-3 font-semibold">Geç</th>
                  <th className="px-4 py-3 font-semibold">Erken</th>
                  <th className="px-4 py-3 font-semibold">Blok</th>
                  <th className="px-4 py-3 font-semibold">Review</th>
                  <th className="px-4 py-3 font-semibold">Anomaly</th>
                  <th className="px-4 py-3 font-semibold">Kodlar</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr
                    key={item.employeeId}
                    className={cx(
                      "cursor-pointer border-t border-slate-100 align-top transition",
                      selectedEmployee?.employeeId === item.employeeId
                        ? "bg-sky-50 ring-1 ring-inset ring-sky-300"
                        : "hover:bg-slate-50"
                    )}
                    onClick={() => {
                      if (selectedEmployee?.employeeId === item.employeeId) {
                        setSelectedEmployee(null);
                        return;
                      }

                      shouldScrollToDetailRef.current = true;
                      setSelectedEmployee(item);
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{item.fullName || "-"}</div>
                      <div className="text-xs text-slate-500">{item.employeeCode || "-"}</div>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={cx(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          item.isPayrollReady
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                            : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                        )}
                      >
                        {item.isPayrollReady ? "Hazır" : "Bloklu"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-700">{item.dayCount}</td>
                    <td className="px-4 py-3 text-slate-700">{item.presentDays}</td>
                    <td className="px-4 py-3 text-slate-700">{item.absentDays}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{item.leaveDays}</div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        Y:{item.annualLeaveDays} / R:{item.sickLeaveDays} / M:{item.excusedLeaveDays} / Ü:{item.unpaidLeaveDays}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.offDays}</td>
                    <td className="px-4 py-3 text-slate-700">{fmtMinutes(item.workedMinutes)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{fmtMinutes(item.overtimeMinutes)}</div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        E:{fmtMinutes(item.overtimeEarlyMinutes)} / G:{fmtMinutes(item.overtimeLateMinutes)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{fmtMinutes(item.lateMinutes)}</td>
                    <td className="px-4 py-3 text-slate-700">{fmtMinutes(item.earlyLeaveMinutes)}</td>
                    <td className="px-4 py-3 text-slate-700">{item.blockedDays}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>Req: {item.reviewRequiredDays}</div>
                      <div>Pen: {item.pendingReviewDays}</div>
                      <div>Rej: {item.rejectedReviewDays}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{item.anomalyDays}</div>
                      <div className="mt-1 text-[11px] text-slate-500">Adj: {item.manualAdjustmentDays}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-[280px] flex-wrap gap-1">
                        {item.puantajCodes.length > 0 ? (
                          item.puantajCodes.map((code) => (
                            <span
                              key={code}
                              className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700"
                            >
                              {code}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div ref={detailRef}>
        <DailyDetailPanel month={month} selected={selectedEmployee} onClose={() => setSelectedEmployee(null)} />
      </div>
    </div>
  );
}