import Link from "next/link";
import type { ReactNode } from "react";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/policy", label: "Company & Policy" },
  { href: "/employees", label: "Employees" },
  { href: "/events", label: "Events" },
  { href: "/reports/daily", label: "Daily" },
  { href: "/reports/monthly", label: "Monthly" },
];

export default function AppShell(props: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="flex">
        <aside className="hidden md:flex md:w-72 md:flex-col md:gap-6 md:border-r md:border-zinc-200 md:bg-white md:px-5 md:py-6">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-zinc-900" />
            <div className="leading-tight">
              <div className="text-sm font-semibold">Turnike Zaman Yönetimi</div>
              <div className="text-xs text-zinc-500">On-prem PDKS</div>
            </div>
          </div>

          <nav className="grid gap-1">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-xl px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
            <div className="font-medium text-zinc-800">Hızlı Not</div>
            <div className="mt-1">
              Dashboard kabuğu hazır. Modüller silinmedi; sadece üst kabuk giydiriliyor.
            </div>
          </div>
        </aside>

        <div className="flex-1">
          <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
              <div className="flex-1">
                <div className="text-lg font-semibold">{props.title}</div>
                {props.subtitle ? (
                  <div className="text-xs text-zinc-500">{props.subtitle}</div>
                ) : null}
              </div>

              <div className="hidden sm:flex sm:w-[360px]">
                <input
                  placeholder="Global arama: Personel / Kart / Kapı / Cihaz"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                />
              </div>

              <div className="flex items-center gap-2">
                <button className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50">
                  Bildirim
                </button>
                <button className="rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800">
                  Kullanıcı
                </button>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-4 py-6">{props.children}</main>
        </div>
      </div>
    </div>
  );
}
