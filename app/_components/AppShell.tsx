"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function pickInitialCollapsed() {
  if (typeof window === "undefined") return false;
  const saved = window.localStorage.getItem("appShell.sidebarCollapsed");
  if (saved === "1") return true;
  if (saved === "0") return false;
  return window.matchMedia("(max-width: 1100px)").matches;
}

function pickInitialPinned() {
  if (typeof window === "undefined") return false;
  const saved = window.localStorage.getItem("appShell.sidebarPinned");
  if (saved === "1") return true;
  if (saved === "0") return false;
  return false;
}

function Icon({
  name,
  className,
}: {
  name:
    | "dashboard"
    | "company"
    | "templates"
    | "assignments"
    | "org"
    | "rules"
    | "employees"
    | "events"
    | "inbox"
    | "daily"
    | "monthly"
    | "kiosk"
    | "search"
    | "bell"
    | "user"
    | "menu"
    | "close"
    | "chevron";
  className?: string;
}) {
  const common = {
    className: cx("h-5 w-5", className),
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
  };

  switch (name) {
    case "menu":
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...common}>
          <path d="M10 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <path
            d="M11 4a7 7 0 105.2 12l3.3 3.3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path
            d="M12 22a2 2 0 002-2H10a2 2 0 002 2z"
            fill="currentColor"
            opacity="0.9"
          />
          <path
            d="M18 16H6c1-1 2-2 2-6a4 4 0 118 0c0 4 1 5 2 6z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <path
            d="M12 12a4 4 0 100-8 4 4 0 000 8z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M4 20c1.8-3.5 5-5 8-5s6.2 1.5 8 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "dashboard":
      return (
        <svg {...common}>
          <path d="M4 13h7V4H4v9zm9 7h7V11h-7v9zM4 20h7v-5H4v5zm9-7h7V4h-7v9z" fill="currentColor" opacity="0.9" />
        </svg>
      );
    case "company":
      return (
        <svg {...common}>
          <path
            d="M4 20V6a2 2 0 012-2h6v16H4z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M12 8h6a2 2 0 012 2v10h-8V8z" stroke="currentColor" strokeWidth="2" />
          <path d="M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "templates":
      return (
        <svg {...common}>
          <path d="M7 3h10v4H7V3z" stroke="currentColor" strokeWidth="2" />
          <path d="M5 7h14v14H5V7z" stroke="currentColor" strokeWidth="2" />
          <path d="M8 11h8M8 15h8M8 19h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "assignments":
      return (
        <svg {...common}>
          <path d="M7 3v3M17 3v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M4 7h16v14H4V7z" stroke="currentColor" strokeWidth="2" />
          <path d="M8 11h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M8 15h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
          <path d="M15 14l2 2 4-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "org":
      return (
        <svg {...common}>
          <path d="M12 3v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M6 21v-6h12v6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M8 9h8v6H8V9z" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "rules":
      return (
        <svg {...common}>
          <path d="M6 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M6 17h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M9 7v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
          <path d="M15 12v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
        </svg>
      );
    case "employees":
      return (
        <svg {...common}>
          <path d="M8 12a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="2" />
          <path d="M16 12a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="2" opacity="0.85" />
          <path
            d="M3.5 20c1.3-3 4-4.5 6.5-4.5S15.2 17 16.5 20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 16.5c2.1.2 4.1 1.4 5 3.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.85"
          />
        </svg>
      );
    case "events":
      return (
        <svg {...common}>
          <path d="M7 3v3M17 3v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M4 7h16v14H4V7z" stroke="currentColor" strokeWidth="2" />
          <path d="M7 11h4M7 15h4M13 11h4M13 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "inbox":
      return (
        <svg {...common}>
          <path d="M4 4h16v10l-3 3H7l-3-3V4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M4 14h5l2 2h2l2-2h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "daily":
      return (
        <svg {...common}>
          <path d="M7 4h10v4H7V4z" stroke="currentColor" strokeWidth="2" />
          <path d="M5 8h14v12H5V8z" stroke="currentColor" strokeWidth="2" />
          <path d="M8 12h8M8 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "monthly":
      return (
        <svg {...common}>
          <path d="M5 19V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M10 19V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M15 19v-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M20 19v-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "kiosk":
      return (
        <svg {...common}>
          <path
            d="M7 2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M9 6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M9 11h6M9 15h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
        </svg>
      );
  }
}

type NavItem = {
  href: string;
  label: string;
  icon: "dashboard" | "company" | "templates" | "assignments" | "org" | "rules" | "employees" | "events" | "bell" | "inbox" | "kiosk" | "daily" | "monthly" | "chevron";
  parentHref?: string; // UI: show as child under parent
};

const nav: NavItem[] = [
  { href: "/dashboard", label: "Kontrol Paneli", icon: "dashboard" as const },
  { href: "/policy", label: "Şirket & Politika", icon: "company" as const },
  {
    href: "/policy/rule-sets",
    label: "Kural Setleri",
    icon: "rules" as const,
    parentHref: "/policy",
  },
  {
    href: "/policy/shift-overrides",
    label: "Vardiya Kural İstisnaları",
    icon: "rules" as const,
    parentHref: "/policy",
  },
  {
    href: "/policy/work-schedules",
    label: "Çalışma Planları (Rota)",
    icon: "assignments" as const,
    parentHref: "/policy",
  },
  { href: "/shift-templates", label: "Vardiya Şablonları", icon: "templates" as const },
  { href: "/shift-assignments", label: "Toplu Vardiya Atama", icon: "assignments" as const },
  {
    href: "/shift-assignments/planner",
    label: "Vardiya Planlayıcı",
    icon: "assignments" as const,
    parentHref: "/shift-assignments",
  },
  { href: "/org", label: "Organizasyon Yapısı", icon: "org" as const },
  { href: "/org/branches/policy", label: "Şube Kural Atamaları", icon: "rules" as const, parentHref: "/org" },
  { href: "/employees", label: "Personeller", icon: "employees" as const },
  { href: "/workforce", label: "İş Gücü Yönetimi", icon: "employees" as const },
  { href: "/workforce/groups", label: "Segmentler", icon: "employees" as const, parentHref: "/workforce" },
  { href: "/workforce/subgroups", label: "Alt Segmentler", icon: "employees" as const, parentHref: "/workforce" },
  { href: "/workforce/classification", label: "Personel Sınıflandırma", icon: "employees" as const, parentHref: "/workforce" },
  { href: "/events", label: "Geçiş Kayıtları", icon: "events" as const },
  { href: "/integration", label: "Entegrasyon", icon: "bell" as const },
  { href: "/tools/sap-simulator", label: "SAP Simülatör", icon: "bell" as const },
  { href: "/device-inbox", label: "Cihaz Gelen Kutusu", icon: "inbox" as const },
  { href: "/kiosk", label: "Turnike Ekranı", icon: "kiosk" as const },
  { href: "/reports/daily", label: "Günlük Rapor", icon: "daily" as const },
  { href: "/reports/monthly", label: "Aylık Rapor", icon: "monthly" as const },
];

export default function AppShell(props: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<boolean>(() => pickInitialCollapsed());
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [pinned, setPinned] = useState<boolean>(() => pickInitialPinned());
  const [desktopOverlayOpen, setDesktopOverlayOpen] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("appShell.sidebarCollapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("appShell.sidebarPinned", pinned ? "1" : "0");
  }, [pinned]);

  useEffect(() => {
    setMobileOpen(false);
    setDesktopOverlayOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!desktopOverlayOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDesktopOverlayOpen(false);
   }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [desktopOverlayOpen]);

  // Desktop hybrid behavior:
  // - Unpinned: sidebar is always a slim icon rail (does not push content). Full menu opens as an overlay.
  // - Pinned: sidebar becomes a full-width push sidebar and stays open across navigation.
  const railCollapsed = !pinned;
  const sidebarCollapsed = railCollapsed ? true : collapsed;

  function openDesktopOverlay() {
    if (pinned) return;
    setDesktopOverlayOpen(true);
  }

  function closeDesktopOverlay() {
    setDesktopOverlayOpen(false);
  }

  function togglePinned() {
    setPinned((v) => {
      const next = !v;
      // When pinning, ensure full width; when unpinning, return to rail.
      if (next) setCollapsed(false);
      if (!next) setCollapsed(true);
      return next;
    });
  }

  const activeHref = useMemo(() => {
    const exact = nav.find((n) => n.href === pathname)?.href;
    if (exact) return exact;

    const pref = nav
      .filter((n) => n.href !== "/dashboard")
      .sort((a, b) => b.href.length - a.href.length)
      .find((n) => pathname?.startsWith(n.href));

    return pref?.href ?? "/dashboard";
  }, [pathname]);

  function NavList(propsNav: {
    collapsed: boolean;
    onNavigate?: () => void;
  }) {
    return (
      <div className={cx("grid gap-1.5", propsNav.collapsed && "gap-2")}>
        {nav.map((n) => {
          const isActive = n.href === activeHref;
          const isChild = !!n.parentHref;
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={propsNav.onNavigate}
              className={cx(
                "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition",
                "border border-transparent",
                isChild && !propsNav.collapsed && "ml-6",
                isActive
                  ? "bg-white/12 text-white border-white/12 shadow-[0_12px_28px_rgba(0,0,0,0.25)]"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
              title={propsNav.collapsed ? n.label : undefined}
            >
              <span
                className={cx(
                  "grid place-items-center rounded-xl border border-white/10 bg-white/8",
                  isChild ? "h-8 w-8" : "h-9 w-9",
                  isActive ? "bg-white/12" : "group-hover:bg-white/12"
               )}
              >
                <Icon name={n.icon} className="h-[18px] w-[18px]" />
              </span>

              <span className={cx("min-w-0 flex-1 truncate", propsNav.collapsed && "hidden")}>
                {isChild ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="text-white/50">›</span>
                    <span>{n.label}</span>
                  </span>
                ) : (
                  n.label
                )}
              </span>

              <span className={cx(propsNav.collapsed && "hidden")}>
                <Icon
                  name="chevron"
                  className={cx(
                   "h-4 w-4 text-white/40 transition group-hover:translate-x-0.5",
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}
                />
              </span>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      {/* Soft app background (demo-like) */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(1200px_500px_at_12%_0%,rgba(59,130,246,0.10),transparent_55%),radial-gradient(900px_520px_at_95%_10%,rgba(99,102,241,0.10),transparent_60%)]" />
 
      {/* Mobile overlay */}
      <div
        className={cx(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setMobileOpen(false)}
      />

      {/* Desktop overlay (unpinned full menu) */}
      <div
        className={cx(
          "fixed inset-0 z-40 hidden bg-black/40 backdrop-blur-sm transition-opacity md:block",
          desktopOverlayOpen && !pinned ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={closeDesktopOverlay}
      />

      {desktopOverlayOpen && !pinned ? (
        <aside
          className={cx(
            "fixed left-0 top-0 z-50 hidden h-dvh w-70 md:block",
            "border-r border-white/10 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800"
          )}
          aria-label="Sidebar (overlay)"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex h-dvh min-h-0 flex-col">
            <div className="flex items-center gap-3 px-4 py-4">
              <div className="relative">
                <div className="h-11 w-11 rounded-2xl bg-white/10 ring-1 ring-white/12" />
              </div>

              <div className="min-w-0">
                <div className="truncate text-sm font-semibold leading-tight text-white">Turnike Zaman Yönetimi</div>
                <div className="truncate text-xs text-white/60">On-prem PDKS</div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePinned}
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/15"
                  aria-label="Menüyü sabitle"
                  title="Sabitle (pinned)"
                >
                  📌
                </button>
                <button
                  type="button"
                  onClick={closeDesktopOverlay}
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/10 p-2 text-white/80 hover:bg-white/15"
                  aria-label="Menüyü kapat"
                >
                  <Icon name="close" />
                </button>
              </div>
            </div>

            <nav
              className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="Navigation"
            >
              <NavList collapsed={false} onNavigate={closeDesktopOverlay} />
            </nav>

            <div className="shrink-0 px-3 pb-4 pt-2">
              <div className="rounded-2xl border border-white/10 bg-white/6 p-3 text-xs text-white/70">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400/90 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" />
                  <div className="font-medium text-white/90">Sistem</div>
                </div>
                <div className="mt-2 leading-relaxed">
                  Demo kabuk. Modüller silinmedi; sadece yeni kurumsal görünüm giydirildi.
                </div>
              </div>
            </div>
          </div>
        </aside>
      ) : null}

      <div className="relative z-0 flex">
        {/* Sidebar */}
        <aside
          className={cx(
            "fixed left-0 top-0 z-50 h-dvh md:sticky md:z-10",
             // demo-like sidebar tone
            "border-r border-white/10 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800",
            "transition-[width,transform] duration-200 ease-out",
            "md:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
            pinned ? "w-70" : "w-[76px]"
          )}
          aria-label="Sidebar"
        >
          {/* Make sidebar internally scrollable (nav scroll), keep footer always reachable */}
          <div className="flex h-dvh min-h-0 flex-col">
            {/* Brand */}
            <div className={cx("flex items-center gap-3 px-4 py-4", sidebarCollapsed && "px-3")}>
              <div className="relative">
                <div className="h-11 w-11 rounded-2xl bg-white/10 ring-1 ring-white/12" />
              </div>

              <div className={cx("min-w-0", sidebarCollapsed && "hidden")}>
                <div className="truncate text-sm font-semibold leading-tight text-white">Turnike Zaman Yönetimi</div>
                <div className="truncate text-xs text-white/60">On-prem PDKS</div>
              </div>

              {/* Mobile close */}
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="ml-auto inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/10 p-2 text-white/80 hover:bg-white/15 md:hidden"
                aria-label="Menüyü kapat"
              >
                <Icon name="close" />
              </button>
            </div>

            {/* Nav (scroll region) */}
            <nav
              className={cx(
                "min-h-0 flex-1 overflow-y-auto px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                sidebarCollapsed && "px-2"
              )}
              aria-label="Navigation"
            >
              <NavList collapsed={sidebarCollapsed} />
            </nav>

            {/* Footer card */}
            <div className={cx("shrink-0 px-3 pb-4 pt-2", sidebarCollapsed && "px-2")}>
              <div
                className={cx(
                  "rounded-2xl border border-white/10 bg-white/6 p-3 text-xs text-white/70",
                  sidebarCollapsed && "hidden"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400/90 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" />
                  <div className="font-medium text-white/90">Sistem</div>
                </div>
                <div className="mt-2 leading-relaxed">
                  Demo kabuk. Modüller silinmedi; sadece yeni kurumsal görünüm giydirildi.
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (pinned) {
                    // Unpin -> rail
                    setPinned(false);
                    setCollapsed(true);
                    return;
                  }
                  // Unpinned -> open overlay menu (desktop)
                  openDesktopOverlay();
                }}
                className={cx(
                  "mt-3 hidden w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-3 py-2 text-xs text-white/80 hover:bg-white/12 md:flex",
                  sidebarCollapsed && "px-2"
                )}
                aria-label="Menüyü aç / sabitle"
              >
                <Icon name="menu" className="h-4 w-4" />
                <span className={cx(sidebarCollapsed && "hidden")}>
                  {pinned ? "Sabiti Kapat" : "Menü"}
                </span>
              </button>
            </div>
          </div>
        </aside>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="sticky top-0 z-20 border-b border-white/10 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800/95 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:px-6">
              {/* Mobile menu button */}
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/10 p-2 text-white/80 hover:bg-white/15 md:hidden"
                aria-label="Menüyü aç"
              >
                <Icon name="menu" />
              </button>

              {/* Desktop menu button (overlay) */}
              <button
                type="button"
                onClick={openDesktopOverlay}
                className="hidden items-center justify-center rounded-2xl border border-white/10 bg-white/10 p-2 text-white/80 hover:bg-white/15 md:inline-flex"
                aria-label="Menüyü aç (overlay)"
                title="Menü"
              >
                <Icon name="menu" />
              </button>

              {/* Title */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-semibold tracking-tight text-white">
                  {props.title}
                </div>
                {props.subtitle ? (
                  <div className="truncate text-xs text-white/60">{props.subtitle}</div>
                ) : null}
              </div>

              {/* Search */}
              <div className="hidden lg:block lg:w-105">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/55">
                    <Icon name="search" className="h-4 w-4" />
                  </span>
                  <input
                    placeholder="Global arama: Personel / Kart / Kapı / Cihaz"
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-10 py-2.5 text-sm text-white placeholder:text-white/45 outline-none focus:ring-2 focus:ring-white/15"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white/85 hover:bg-white/15">
                  <Icon name="bell" className="h-4 w-4 text-white/85" />
                  <span className="hidden sm:inline">Bildirim</span>
                </button>
                <button className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-zinc-100">
                  <Icon name="user" className="h-4 w-4 text-slate-900" />
                  <span className="hidden sm:inline">Kullanıcı</span>
                </button>
              </div>
            </div>
          </header>

          {/* Main */}
          {/* 
            Global horizontal overflow policy:
            - Content should NOT spill outside the "outer card"
            - If content needs more width (pinned sidebar / large tables / long chips), enable horizontal scroll
            - Keep the centered max width for normal pages, but allow overflow via scroll instead of squeezing.
          */}
          <main className="mx-auto w-full max-w-7xl min-w-0 overflow-x-auto px-4 py-6 md:px-6">
            <div className="min-w-full rounded-3xl border border-zinc-200/70 bg-white/70 p-4 shadow-sm md:p-6">
              {props.children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
