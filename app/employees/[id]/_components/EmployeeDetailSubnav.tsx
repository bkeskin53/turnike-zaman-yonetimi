"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { employeeCardScopeTerms } from "@/src/features/employees/cardScopeTerminology";
import EmployeeHistoryDialog from "./EmployeeHistoryDialog";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type NavKey =
  | "profile"
  | "assignments"
  | "weekly-plan"
  | "leaves"
  | "master"
  | "records";

export default function EmployeeDetailSubnav({
  id,
  current,
  hideHistoryTrigger = false,
}: {
  id: string;
  current: NavKey;
  hideHistoryTrigger?: boolean;
}) {
  const searchParams = useSearchParams();
  const asOf = String(searchParams.get("asOf") ?? "").trim();
  const withAsOf = (href: string) => {
    if (!asOf) return href;
    return `${href}?asOf=${encodeURIComponent(asOf)}`;
  };
  const items = [
    { key: "master", href: withAsOf(`/employees/${id}/master`), label: employeeCardScopeTerms.masterNavLabel },
    { key: "assignments", href: withAsOf(`/employees/${id}/assignments`), label: "Organizasyon Veri" },
    { key: "profile", href: withAsOf(`/employees/${id}/profile`), label: "Vardiya Bilgileri" },
    { key: "weekly-plan", href: withAsOf(`/employees/${id}/weekly-plan`), label: "Vardiya Programı" },
    { key: "leaves", href: withAsOf(`/employees/${id}/leaves`), label: "İzin Yönetimi" },
    { key: "records", href: withAsOf(`/employees/${id}/records`), label: "Zaman Kayıtları" },
  ] as const;

  return (
    <div className="sticky top-3 z-30">
      <div className="relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,250,252,0.96),rgba(238,242,255,0.96))] p-2.5 shadow-[0_14px_34px_rgba(15,23,42,0.10)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white/30 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-indigo-100/20 to-transparent" />

        <div className="grid gap-2.5">
          {!hideHistoryTrigger ? (
            <div className="flex justify-end px-1">
              <EmployeeHistoryDialog employeeId={id} current={current} />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {items.map((item) =>
              item.key === current ? (
                <span
                  key={item.href}
                  className={cx(
                    "inline-flex min-h-[46px] items-center justify-center rounded-2xl border px-4 py-2.5 text-center text-sm font-semibold transition",
                    "border-slate-900/90 bg-[linear-gradient(135deg,#0f172a,#1e1b4b,#0f172a)] text-white shadow-[0_10px_24px_rgba(15,23,42,0.24)]"
                  )}
                >
                  <span className="truncate">{item.label}</span>
                </span>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    "inline-flex h-[52px] w-full items-center justify-center rounded-2xl border px-3 py-2 text-center text-sm font-semibold transition",
                    "border-white/80 bg-white/78 text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.05)]",
                    "hover:-translate-y-[1px] hover:border-indigo-200 hover:bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(238,242,255,0.95))] hover:text-indigo-700 hover:shadow-[0_12px_24px_rgba(79,70,229,0.10)]"
                  )}
                >
                  <span className="block min-w-0 truncate leading-tight">{item.label}</span>
                </Link>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}