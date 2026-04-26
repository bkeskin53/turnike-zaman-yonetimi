"use client";

import { DateTime } from "luxon";
import { createPortal } from "react-dom";

export type ScopedHistoryListItemBase = {
  id: string;
  recordId: string;
  dayKey: string;
  title: string;
  subtitle: string;
  rangeLabel: string | null;
  createdAtLabel: string;
  updatedAtLabel: string;
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function formatDayLabel(dayKey: string): string {
  const dt = DateTime.fromISO(dayKey, { zone: "Europe/Istanbul" }).setLocale("tr");
  if (!dt.isValid) return dayKey;
  return dt.toFormat("dd LLL yyyy");
}

export function HistoryIconTrigger(props: {
  variant?: "default" | "icon";
  activeLabel?: string | null;
  onOpen: () => void;
}) {
  const label = props.activeLabel?.trim() ? props.activeLabel : "Tarihçe";

  if (props.variant === "icon") {
    return (
      <button
        type="button"
        onClick={props.onOpen}
        title={label}
        aria-label={label}
        className={cx(
          "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/25",
          props.activeLabel
            ? "border-sky-200 bg-sky-50 text-sky-700 shadow-[0_8px_18px_rgba(14,116,144,0.10)] hover:border-sky-300 hover:bg-sky-100"
            : "border-slate-200 bg-slate-50 text-slate-600 shadow-[0_4px_12px_rgba(15,23,42,0.06)] hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700",
        )}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none">
          <path d="M4 6v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.2 14.8A7 7 0 1 0 7.1 6.7L4 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 8.3v4.1l2.7 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={props.onOpen}
      className={cx(
        "inline-flex min-h-[46px] items-center justify-center rounded-2xl border px-4 py-2.5 text-sm font-semibold transition",
        props.activeLabel
          ? "border-amber-200 bg-amber-50 text-amber-800 shadow-[0_8px_18px_rgba(180,83,9,0.10)] hover:border-amber-300 hover:bg-amber-100"
          : "border-white/80 bg-white/78 text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.05)] hover:-translate-y-[1px] hover:border-indigo-200 hover:bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(238,242,255,0.95))] hover:text-indigo-700 hover:shadow-[0_12px_24px_rgba(79,70,229,0.10)]",
      )}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}

export function ScopedHistoryList<TItem extends ScopedHistoryListItemBase>(props: {
  items: TItem[];
  loading: boolean;
  error: string | null;
  selectedRecordId: string | null;
  selectedDayKey: string | null;
  onSelect: (item: TItem) => void;
  emptyText: string;
}) {
  const groups = new Map<string, TItem[]>();
  for (const item of props.items) {
    if (!groups.has(item.dayKey)) groups.set(item.dayKey, []);
    groups.get(item.dayKey)!.push(item);
  }

  return (
    <div className="max-h-[72vh] overflow-y-auto px-3 py-3">
      {props.loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="h-4 w-24 animate-pulse rounded bg-zinc-100" />
              <div className="mt-3 h-4 w-48 animate-pulse rounded bg-zinc-100" />
              <div className="mt-2 h-3 w-full animate-pulse rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      ) : props.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="font-semibold">Tarihçe yüklenemedi</div>
          <div className="mt-1 break-words">{props.error}</div>
        </div>
      ) : groups.size === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">{props.emptyText}</div>
      ) : (
        <div className="grid gap-4">
          {Array.from(groups.entries()).map(([dayKey, items]) => {
            const groupActive = dayKey === props.selectedDayKey;
            return (
              <div
                key={dayKey}
                className={cx(
                  "grid gap-2 rounded-3xl border p-3 transition",
                  groupActive
                    ? "border-indigo-300 bg-[linear-gradient(180deg,rgba(224,231,255,0.98),rgba(238,242,255,0.96),rgba(255,255,255,0.98))] shadow-[0_18px_40px_rgba(79,70,229,0.14)] ring-1 ring-indigo-200/70"
                    : "border-transparent bg-transparent",
                )}
              >
                <div className={cx("px-1 text-sm font-semibold", groupActive ? "text-indigo-900" : "text-zinc-800")}>
                  {formatDayLabel(dayKey)}
                </div>

                <div className="grid gap-2">
                  {items.map((item) => {
                    const active = item.recordId === props.selectedRecordId;
                    const inSelectedGroup = item.dayKey === props.selectedDayKey;
                    return (
                      <button
                        key={item.recordId}
                        type="button"
                        onClick={() => props.onSelect(item)}
                        className={cx(
                          "grid gap-2 rounded-2xl border p-4 text-left transition",
                          active
                            ? "border-indigo-300 bg-[linear-gradient(135deg,rgba(238,242,255,0.95),rgba(224,231,255,0.92))] shadow-[0_14px_28px_rgba(79,70,229,0.14)]"
                            : inSelectedGroup
                              ? "border-indigo-200 bg-[linear-gradient(135deg,rgba(238,242,255,0.92),rgba(255,255,255,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] ring-1 ring-indigo-100/80"
                              : "border-zinc-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/70",
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          {item.rangeLabel ? <span className="text-[11px] text-zinc-500">{item.rangeLabel}</span> : null}
                          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700 ring-1 ring-zinc-200">
                            {item.updatedAtLabel}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-zinc-900">{item.title}</div>
                        <div className="text-sm text-zinc-600">{item.subtitle}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ScopedHistoryDialogShell(props: {
  mounted: boolean;
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  count: number;
  leftPane: React.ReactNode;
  rightPane: React.ReactNode;
  footer: React.ReactNode;
}) {
  const modalContent =
    props.open && props.mounted ? (
      <div className="fixed inset-0 z-[10000] overflow-y-auto bg-slate-950/72 p-4 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl items-center justify-center">
          <div className="w-full overflow-hidden rounded-[30px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
              <div className="grid gap-1">
                <div className="text-lg font-semibold text-zinc-900">{props.title}</div>
                <div className="text-sm text-zinc-600">{props.subtitle}</div>
              </div>

              <button
                type="button"
                onClick={props.onClose}
                className="inline-flex items-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:border-zinc-300 hover:bg-zinc-50"
              >
                Kapat
              </button>
            </div>

            <div className="grid min-h-[72vh] grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
              <div className="border-b border-zinc-200 bg-zinc-50/70 lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                  <div className="text-sm font-semibold text-zinc-900">Kayıt Listesi</div>
                  <div className="text-xs text-zinc-500">{props.count} kayıt</div>
                </div>
                {props.leftPane}
              </div>

              <div className="bg-white">
                <div className="max-h-[72vh] overflow-y-auto p-5">{props.rightPane}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-5 py-4">
              {props.footer}
            </div>
          </div>
        </div>
      </div>
    ) : null;

  return props.mounted ? createPortal(modalContent, document.body) : null;
}
