"use client";

import { EMPLOYEE_IMPORT_FIELDS, EmployeeImportFieldKey } from "@/src/features/employees/importTemplate";
import type { EmployeeImportIssueSummaryDto } from "@/src/services/employees/employeeImportIssueTaxonomy.service";

type ImportIssueSummaryPanelProps = {
  title: string;
  summary: EmployeeImportIssueSummaryDto;
  emptyText: string;
};

function cx(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}

function isKnownField(value: string): value is EmployeeImportFieldKey {
  return Object.prototype.hasOwnProperty.call(EMPLOYEE_IMPORT_FIELDS, value);
}

function formatFieldLabel(field: string) {
  if (isKnownField(field)) return EMPLOYEE_IMPORT_FIELDS[field].label;
  return field;
}

function formatPreviewPolicyText(summary: EmployeeImportIssueSummaryDto) {
  if (summary.source !== "PREVIEW") return null;
  if (summary.previewLimited) {
    return "Bu özet saklanan sorun önizlemesinden üretildi. Toplam hata veya uyarı sayısı, aşağıda görünen kümelerden daha yüksek olabilir.";
  }
  return "Bu özet saklanan sorun önizlemesinden üretildi.";
}

function severityLabel(severity: "error" | "warning") {
  return severity === "error" ? "Hata kümesi" : "Uyarı kümesi";
}

function severityTone(severity: "error" | "warning") {
  return severity === "error"
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

export function ImportIssueSummaryPanel(props: ImportIssueSummaryPanelProps) {
  const hasGroups = props.summary.errorGroups.length > 0 || props.summary.warningGroups.length > 0;
  const groups = [...props.summary.errorGroups, ...props.summary.warningGroups];
  const previewPolicyText = formatPreviewPolicyText(props.summary);

  return (
    <div className="rounded-[2rem] border border-rose-200/80 bg-rose-50/45 p-5 shadow-sm">
      <div className="h-1.5 w-14 rounded-full bg-rose-400" />
      <div className="flex flex-col gap-3 pt-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-900">{props.title}</div>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Mevcut sorun kodları benzer düzeltme başlıkları altında gruplanır; ikinci bir doğrulama motoru çalıştırılmaz.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-rose-200 bg-white px-3 py-1 font-medium text-rose-700 shadow-sm">
            Hata: {props.summary.totalErrorCount}
          </span>
          <span className="rounded-full border border-amber-200 bg-white px-3 py-1 font-medium text-amber-700 shadow-sm">
            Uyarı: {props.summary.totalWarningCount}
          </span>
        </div>
      </div>

      {previewPolicyText ? (
        <div className="mt-4 rounded-2xl border border-sky-200 bg-white px-4 py-3 text-xs leading-6 text-sky-900 shadow-sm">
          {previewPolicyText}
        </div>
      ) : null}

      {hasGroups ? (
        <div className={cx("mt-4 grid gap-3", groups.length > 1 && "xl:grid-cols-2")}>
          {groups.map((group) => (
            <div
              key={`${group.severity}-${group.key}`}
              className={cx(
                "min-w-0 rounded-[1.75rem] border p-4 shadow-sm",
                group.severity === "error" ? "border-rose-200 bg-white/85" : "border-amber-200 bg-white/85",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{group.title}</div>
                  <p className="mt-1 text-xs leading-6 text-slate-600">{group.description}</p>
                </div>
                <span className={cx("rounded-full border bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide shadow-sm", severityTone(group.severity))}>
                  {severityLabel(group.severity)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-slate-500">Kayıt</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{group.issueCount}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-slate-500">Satır</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{group.lineCount}</div>
                </div>
              </div>

              {group.fields.length ? (
                <div className="mt-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">İlgili alanlar</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {group.fields.slice(0, 4).map((field) => (
                      <span key={field} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                        {formatFieldLabel(field)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {group.codeBreakdown.length ? (
                <div className="mt-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">En çok görülen kodlar</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {group.codeBreakdown.slice(0, 3).map((item) => (
                      <span
                        key={item.code}
                        className="inline-flex max-w-full items-start rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium leading-5 text-slate-700"
                      >
                        <span className="break-all">
                          {item.code} · {item.count}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {group.sampleEmployeeCodes.length || group.sampleLines.length ? (
                <div className="mt-4 text-xs leading-6 text-slate-600">
                  {group.sampleEmployeeCodes.length ? (
                    <div className="break-all">
                      <span className="font-medium text-slate-900">Örnek çalışanlar:</span> {group.sampleEmployeeCodes.join(", ")}
                    </div>
                  ) : null}
                  {group.sampleLines.length ? (
                    <div>
                      <span className="font-medium text-slate-900">Örnek satırlar:</span> {group.sampleLines.map((line) => `#${line}`).join(", ")}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-rose-200 bg-white/80 px-4 py-4 text-sm text-slate-500">
          {props.emptyText}
        </div>
      )}
    </div>
  );
}
