"use client";

import { DateTime } from "luxon";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type EmployeeHistoryMeta = {
  dayKey: string;
  todayDayKey: string;
  isHistorical: boolean;
  canEdit: boolean;
  mode: "AS_OF" | "CURRENT";
  profileSource?: string;
  orgSource?: string;
};

function formatDayLabel(dayKey: string): string {
  const dt = DateTime.fromISO(dayKey, { zone: "Europe/Istanbul" }).setLocale("tr");
  if (!dt.isValid) return dayKey;
  return dt.toFormat("dd.MM.yyyy");
}

function isValidIsoDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const WEEKDAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function buildCalendarDays(args: {
  monthKey: string;
  selectedDayKey: string;
  todayDayKey: string;
}) {
  const monthStart =
    DateTime.fromISO(args.monthKey, { zone: "Europe/Istanbul" }).startOf("month");
  const safeMonthStart = monthStart.isValid
    ? monthStart
    : DateTime.fromISO(args.todayDayKey, { zone: "Europe/Istanbul" }).startOf("month");

  const gridStart = safeMonthStart.minus({ days: safeMonthStart.weekday - 1 });

  return Array.from({ length: 42 }).map((_, index) => {
    const day = gridStart.plus({ days: index });
    const dayKey = day.toISODate() || "";
    return {
      key: `${dayKey}-${index}`,
      dayKey,
      label: String(day.day),
      isCurrentMonth: day.month === safeMonthStart.month && day.year === safeMonthStart.year,
      isSelected: dayKey === args.selectedDayKey,
      isToday: dayKey === args.todayDayKey,
    };
  });
}

export default function EmployeeAsOfDateControl({
  history,
}: {
  history: EmployeeHistoryMeta | null | undefined;
}) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [visibleMonthKey, setVisibleMonthKey] = useState("");
  const [openDirection, setOpenDirection] = useState<"down" | "up">("down");
  const [popupStyle, setPopupStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  }>({
    top: 0,
    left: 0,
    width: 320,
    maxHeight: 440,
  });

  const todayDayKey = String(history?.todayDayKey ?? "").trim();
  const visibleDayKey = String(history?.dayKey ?? todayDayKey).trim();
  const isHistorical = Boolean(history?.isHistorical || (visibleDayKey && visibleDayKey !== todayDayKey));
  const selectedDayKey = visibleDayKey || todayDayKey;

  const calendarMonth = useMemo(() => {
    const raw = visibleMonthKey || selectedDayKey || todayDayKey;
    const dt = DateTime.fromISO(raw, { zone: "Europe/Istanbul" }).startOf("month").setLocale("tr");
    return dt.isValid
      ? dt
      : DateTime.fromISO(todayDayKey, { zone: "Europe/Istanbul" }).startOf("month").setLocale("tr");
  }, [selectedDayKey, todayDayKey, visibleMonthKey]);

  const calendarDays = useMemo(
    () =>
      buildCalendarDays({
        monthKey: calendarMonth.toISODate() || todayDayKey,
        selectedDayKey,
        todayDayKey,
      }),
    [calendarMonth, selectedDayKey, todayDayKey],
  );

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function updatePopupPosition() {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

      const popupWidth = 320;
      const margin = 12;
      const gap = 10;
      const estimatedPopupHeight = 420;

      const spaceBelow = viewportHeight - rect.bottom - gap - margin;
      const spaceAbove = rect.top - gap - margin;
      const shouldOpenUp = spaceBelow < estimatedPopupHeight && spaceAbove > spaceBelow;

      const left = Math.min(
        Math.max(rect.right - popupWidth, margin),
        Math.max(margin, viewportWidth - popupWidth - margin),
      );

      const maxHeight = Math.max(
        260,
        shouldOpenUp
          ? rect.top - margin * 2 - gap
          : viewportHeight - rect.bottom - margin * 2 - gap,
      );

      const top = shouldOpenUp
        ? Math.max(margin, rect.top - gap - Math.min(estimatedPopupHeight, maxHeight))
        : Math.min(
            viewportHeight - margin - Math.min(estimatedPopupHeight, maxHeight),
            rect.bottom + gap,
          );

      setOpenDirection(shouldOpenUp ? "up" : "down");
      setPopupStyle({
        top,
        left,
        width: popupWidth,
        maxHeight,
      });
    }

    updatePopupPosition();
    window.addEventListener("resize", updatePopupPosition);
    window.addEventListener("scroll", updatePopupPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopupPosition);
      window.removeEventListener("scroll", updatePopupPosition, true);
    };
  }, [open]);

  if (!history) return null;

  function applyDayKey(nextDayKey: string) {
    const selectedDayKey = String(nextDayKey || todayDayKey).trim();
    if (!isValidIsoDay(selectedDayKey)) return;

    const params = new URLSearchParams(searchParams.toString());
    if (selectedDayKey === todayDayKey) {
      params.delete("asOf");
    } else {
      params.set("asOf", selectedDayKey);
    }

    const nextPath = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    setOpen(false);
    router.push(nextPath);
  }

  function openCalendar() {
    const seed = selectedDayKey || todayDayKey;
    const month = DateTime.fromISO(seed, { zone: "Europe/Istanbul" }).startOf("month");
    setVisibleMonthKey(month.isValid ? month.toISODate() || todayDayKey : todayDayKey);
    setOpen((current) => !current);
  }

  function shiftMonth(offset: number) {
    const next = calendarMonth.plus({ months: offset }).startOf("month");
    setVisibleMonthKey(next.toISODate() || todayDayKey);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={openCalendar}
        className={cx(
          "inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-sm font-semibold shadow-sm transition",
          isHistorical
            ? "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100"
            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700",
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none">
          <rect x="4" y="5" width="16" height="15" rx="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 3.8v3.4M16 3.8v3.4M4 9.5h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span>{formatDayLabel(visibleDayKey)} itibarıyla</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className={cx("h-4 w-4 transition", open ? "rotate-180" : "")} fill="none">
          <path d="m5 8 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
        <div
          ref={popupRef}
          className="fixed z-[120] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_48px_rgba(15,23,42,0.18)]"
          style={{
            top: popupStyle.top,
            left: popupStyle.left,
            width: popupStyle.width,
            maxHeight: popupStyle.maxHeight,
          }}
        >
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">Veriler Şu Tarih İtibarıyla Gösteriliyor</div>
          </div>

          <div className="overflow-y-auto px-4 py-2.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Önceki ay"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none">
                  <path d="m12.5 4.5-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div className="text-sm font-semibold text-slate-900">
                {calendarMonth.toFormat("LLLL yyyy")}
              </div>

              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Sonraki ay"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none">
                  <path d="m7.5 4.5 5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="mt-2.5 grid grid-cols-7 gap-1">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="flex h-7 items-center justify-center text-[11px] font-semibold text-slate-500"
                >
                  {label}
                </div>
              ))}

              {calendarDays.map((day) => (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => applyDayKey(day.dayKey)}
                  className={cx(
                    "flex h-8 items-center justify-center rounded-xl text-sm transition",
                    day.isSelected
                      ? "border border-indigo-500 bg-indigo-50 font-semibold text-indigo-700 shadow-sm"
                      : day.isToday
                        ? "border border-slate-300 bg-slate-50 font-medium text-slate-800"
                        : day.isCurrentMonth
                          ? "text-slate-800 hover:bg-slate-100"
                          : "text-slate-400 hover:bg-slate-50",
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>

            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => applyDayKey(todayDayKey)}
                className="inline-flex items-center rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
              >
                Bugün
              </button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
