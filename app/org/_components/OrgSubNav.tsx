"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; desc?: string };

export function OrgSubNav() {
  const pathname = usePathname();

  const items: Item[] = [
    { href: "/org", label: "Organizasyon", desc: "Şube / Kapı / Cihaz yönetimi" },
    { href: "/org/branches/policy", label: "Şube Kural Atama", desc: "Branch → RuleSet (EMPLOYEE > BRANCH > DEFAULT)" },
  ];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        {items.map((it) => {
          const active = pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={
                "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition " +
                (active
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50")
              }
              title={it.desc ?? it.label}
            >
              <span className="font-medium">{it.label}</span>
              {it.desc ? <span className={active ? "text-white/80" : "text-zinc-500"}>• {it.desc}</span> : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
