"use client";

import { useMemo, useState } from "react";
import {
  EMPLOYEE_MASTER_FORM_CONFIGURATION_FIELD_DEFINITIONS,
  EMPLOYEE_MASTER_FORM_CONFIGURATION_SCREEN_KEY,
  type EmployeeMasterFormConfigurationFieldKey,
  type EmployeeMasterFormResolvedConfiguration,
} from "@/src/features/employees/employeeMasterFormConfiguration";

type Notice =
  | {
      kind: "success" | "error";
      text: string;
    }
  | null;

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function extractApiError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const error = (payload as { error?: unknown }).error;
  return typeof error === "string" && error.trim() ? error.trim() : null;
}

function humanizeError(code: string | null, fallback: string): string {
  switch (code) {
    case "INVALID_EMPLOYEE_MASTER_FORM_CONFIGURATION_SCREEN_KEY":
      return "Screen key gecersiz.";
    case "INVALID_EMPLOYEE_MASTER_FORM_CONFIGURATION_FIELD_KEY":
      return "Ayar alanlarindan biri gecersiz.";
    case "INVALID_EMPLOYEE_MASTER_FORM_CONFIGURATION_FIELD_SET":
      return "Gecerli ve tam field set gonderilmelidir.";
    case "INVALID_EMPLOYEE_MASTER_FORM_CONFIGURATION_VISIBILITY":
      return "Gorunurluk degeri yalnizca true veya false olabilir.";
    case "FORBIDDEN":
    case "forbidden":
      return "Bu ayari duzenlemek icin yetkin yok.";
    case "UNAUTHORIZED":
    case "unauthorized":
      return "Oturum bilgisi gecersiz. Lutfen yeniden giris yap.";
    default:
      return fallback;
  }
}

function buildFieldsPayload(
  fields: EmployeeMasterFormResolvedConfiguration["fields"],
) {
  return EMPLOYEE_MASTER_FORM_CONFIGURATION_FIELD_DEFINITIONS.map(
    ({ fieldKey }) => ({
      fieldKey,
      isVisible: fields[fieldKey].isVisible,
    }),
  );
}

export default function EmployeeMasterFormConfigurationClient(props: {
  initialConfiguration: EmployeeMasterFormResolvedConfiguration;
}) {
  const [baseline, setBaseline] = useState(props.initialConfiguration);
  const [fields, setFields] = useState(props.initialConfiguration.fields);
  const [pendingAction, setPendingAction] = useState<"save" | "reset" | null>(
    null,
  );
  const [notice, setNotice] = useState<Notice>(null);

  const isDirty = useMemo(
    () =>
      EMPLOYEE_MASTER_FORM_CONFIGURATION_FIELD_DEFINITIONS.some(
        ({ fieldKey }) =>
          fields[fieldKey].isVisible !== baseline.fields[fieldKey].isVisible,
      ),
    [baseline.fields, fields],
  );

  function setFieldVisibility(
    fieldKey: EmployeeMasterFormConfigurationFieldKey,
    isVisible: boolean,
  ) {
    setFields((current) => ({
      ...current,
      [fieldKey]: { isVisible },
    }));
    setNotice(null);
  }

  async function saveConfiguration() {
    setPendingAction("save");
    setNotice(null);

    try {
      const response = await fetch(
        "/api/admin/employees/master-form-configuration",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            screenKey: EMPLOYEE_MASTER_FORM_CONFIGURATION_SCREEN_KEY,
            fields: buildFieldsPayload(fields),
          }),
        },
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice({
          kind: "error",
          text: humanizeError(
            extractApiError(payload),
            "Ayarlar kaydedilemedi.",
          ),
        });
        return;
      }

      const configuration = payload?.configuration as
        | EmployeeMasterFormResolvedConfiguration
        | undefined;
      if (!configuration?.fields) {
        setNotice({
          kind: "error",
          text: "Sunucudan gecerli konfigurasyon donmedi.",
        });
        return;
      }

      setBaseline(configuration);
      setFields(configuration.fields);
      setNotice({
        kind: "success",
        text: "Master modal gorunurluk ayarlari kaydedildi.",
      });
    } catch {
      setNotice({
        kind: "error",
        text: "Ayarlar kaydedilirken baglanti hatasi olustu.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function resetConfiguration() {
    setPendingAction("reset");
    setNotice(null);

    try {
      const response = await fetch(
        "/api/admin/employees/master-form-configuration",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            screenKey: EMPLOYEE_MASTER_FORM_CONFIGURATION_SCREEN_KEY,
          }),
        },
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice({
          kind: "error",
          text: humanizeError(
            extractApiError(payload),
            "Varsayilan ayarlara donulemedi.",
          ),
        });
        return;
      }

      const configuration = payload?.configuration as
        | EmployeeMasterFormResolvedConfiguration
        | undefined;
      if (!configuration?.fields) {
        setNotice({
          kind: "error",
          text: "Sunucudan gecerli konfigurasyon donmedi.",
        });
        return;
      }

      setBaseline(configuration);
      setFields(configuration.fields);
      setNotice({
        kind: "success",
        text: "Varsayilan master modal gorunurluk ayarlari geri yuklendi.",
      });
    } catch {
      setNotice({
        kind: "error",
        text: "Varsayilan ayarlar yuklenirken baglanti hatasi olustu.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="grid min-w-0">
      <section className="h-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="min-w-0">
            <div className="text-base font-semibold tracking-tight text-slate-950">
              Master Modal Gorunurlugu
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Master ana kalem modalindaki profile alanlari.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-700">
            employees.master
          </span>
        </div>

        {notice ? (
          <div
            className={cx(
              "mt-3 rounded-xl border px-3 py-2 text-sm font-medium",
              notice.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800",
            )}
            role="status"
          >
            {notice.text}
          </div>
        ) : null}

        <div className="mt-4 grid gap-2">
          {EMPLOYEE_MASTER_FORM_CONFIGURATION_FIELD_DEFINITIONS.map(
            ({ fieldKey, label }) => {
              const isVisible = fields[fieldKey].isVisible;
              return (
                <div
                  key={fieldKey}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                >
                  <div className="min-w-0 text-sm font-medium text-slate-900">
                    {label}
                  </div>

                  <button
                    type="button"
                    aria-pressed={isVisible}
                    onClick={() => setFieldVisibility(fieldKey, !isVisible)}
                    disabled={pendingAction !== null}
                    className={cx(
                      "inline-flex min-w-[108px] items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60",
                      isVisible
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100",
                    )}
                  >
                    {isVisible ? "Gorunur" : "Gizli"}
                  </button>
                </div>
              );
            },
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
          <div className="text-xs text-slate-500">
            {isDirty
              ? "Kaydedilmemis degisiklik var."
              : "Kayitli konfigurasyon aktif durumda."}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={resetConfiguration}
              disabled={pendingAction !== null}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingAction === "reset"
                ? "Varsayilanlara donuluyor..."
                : "Varsayilana don"}
            </button>
            <button
              type="button"
              onClick={saveConfiguration}
              disabled={pendingAction !== null || !isDirty}
              className="inline-flex items-center justify-center rounded-lg border border-indigo-400/30 bg-[linear-gradient(135deg,#4f46e5,#7c3aed)] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingAction === "save" ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
