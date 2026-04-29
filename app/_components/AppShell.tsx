"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildConfigurationCenterHref,
  isConfigurationCenterPathname,
} from "@/src/features/admin/configuration/configurationUrls";
import {
  isDataManagementDirtyGuardActive,
} from "@/src/features/data-management/dataManagementDirtyGuard";
import { isCompanyManagementPathname } from "@/src/features/company-management/companyManagementUrls";
import DataManagementDirtyExitDialog from "@/src/features/data-management/DataManagementDirtyExitDialog";

type UserRole = "SYSTEM_ADMIN" | "HR_CONFIG_ADMIN" | "HR_OPERATOR" | "SUPERVISOR";
type GlobalSearchItem = {
  type: "page" | "employee" | "organizationUnit" | "device";
  group: "pages" | "employees" | "organizationUnits" | "devices";
  title: string;
  subtitle: string;
  href: string;
};

type GlobalSearchResponse = {
  pages: GlobalSearchItem[];
  employees: GlobalSearchItem[];
  organizationUnits: GlobalSearchItem[];
  devices: GlobalSearchItem[];
};

const EMPTY_SEARCH_RESULTS: GlobalSearchResponse = {
  pages: [],
  employees: [],
  organizationUnits: [],
  devices: [],
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function shouldInterceptAppShellNavigation(
  event: ReactMouseEvent<HTMLAnchorElement>,
) {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  return true;
}

function pickInitialCollapsed() {
  if (typeof window === "undefined") return false;
  const saved = window.localStorage.getItem("appShell.sidebarCollapsed");
  if (saved === "1") return true;
  if (saved === "0") return false;
  return window.matchMedia("(max-width: 1100px)").matches;
}

function Icon({
  name,
  className,
}: {
  name:
    | "home"
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
    | "settings"
    | "user"
    | "menu"
    | "close"
    | "chevron"
    | "panel";
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
    case "panel":
      return (
        <svg {...common}>
          <path d="M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" stroke="currentColor" strokeWidth="2" />
          <path d="M9 5v14" stroke="currentColor" strokeWidth="2" />
          <path d="M13 10l-2 2 2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
    case "settings":
      return (
        <svg {...common}>
          <path
            d="M12 8.5A3.5 3.5 0 1012 15.5 3.5 3.5 0 0012 8.5z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M19 12a7.3 7.3 0 00-.08-1l2.03-1.58-2-3.46-2.44.74a7.87 7.87 0 00-1.73-1l-.4-2.52h-4l-.4 2.52a7.87 7.87 0 00-1.73 1l-2.44-.74-2 3.46L5.08 11A7.3 7.3 0 005 12c0 .34.03.67.08 1l-2.03 1.58 2 3.46 2.44-.74c.53.42 1.11.75 1.73 1l.4 2.52h4l.4-2.52c.62-.25 1.2-.58 1.73-1l2.44.74 2-3.46L18.92 13c.05-.33.08-.66.08-1z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
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
    case "home":
      return (
        <svg {...common}>
          <path d="m4 11 8-6 8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 10.5V20h12v-9.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M10 20v-5h4v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
    default:
      return null;
  }
}

type NavItem = {
  href: string;
  label: string;
  icon:
    | "home"
    | "dashboard"
    | "company"
    | "templates"
    | "assignments"
    | "org"
    | "rules"
    | "employees"
    | "events"
    | "bell"
    | "inbox"
    | "kiosk"
    | "daily"
    | "monthly"
    | "chevron"
    | "user";
  parentHref?: string; // UI: show as child under parent
  isNavigable?: boolean; // false => section/group header only, no direct page navigation
  requiresRoles?: UserRole[]; // if set, item only shown for these roles
};

const nav: NavItem[] = [
  { href: "/home", label: "Ana Sayfa", icon: "home" as const },
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
  { href: "/employees", label: "Çalışan Listesi", icon: "employees" as const },
  {
    href: "/admin/employees",
    label: "Yeni Çalışan Ekle",
    icon: "employees" as const,
    parentHref: "/employees",
  },
  {
    href: "/employees/import",
    label: "Çalışanları İçe Aktarma",
    icon: "employees" as const,
    parentHref: "/employees",
  },
  {
    href: "__master-data__",
    label: "Temel Tanımlar",
    icon: "dashboard" as const,
    isNavigable: false,
  },
  {
    href: "/company-management",
    label: "Şirket Yönetimi",
    icon: "org" as const,
    parentHref: "__master-data__",
  },
  {
    href: "/data-management",
    label: "Veri Yönetimi",
    icon: "dashboard" as const,
    parentHref: "__master-data__",
  },
  {
    href: "/shift-assignments/planner",
    label: "Vardiya Planlayıcı",
    icon: "assignments" as const,
    parentHref: "/policy/work-schedules",
  },
  {
    href: "/shift-assignments",
    label: "Vardiya İçe Aktarma",
    icon: "assignments" as const,
    parentHref: "/policy/work-schedules",
  },
  { href: "/workforce", label: "İş Gücü Yönetimi", icon: "employees" as const },
  { href: "/workforce/groups", label: "Segmentler", icon: "employees" as const, parentHref: "/workforce" },
  { href: "/workforce/subgroups", label: "Alt Segmentler", icon: "employees" as const, parentHref: "/workforce" },
  { href: "/workforce/classification", label: "Personel Sınıflandırma", icon: "employees" as const, parentHref: "/workforce" },
  { href: "/events", label: "Geçiş Kayıtları", icon: "events" as const },
  { href: "/integration", label: "Entegrasyon", icon: "bell" as const },
  { href: "/tools/sap-simulator", label: "SAP Simülatör", icon: "bell" as const },
  { href: "/test/console", label: "Test Console", icon: "events" as const, requiresRoles: ["SYSTEM_ADMIN", "HR_OPERATOR"] },
  { href: "/device-inbox", label: "Cihaz Gelen Kutusu", icon: "inbox" as const },
  { href: "/kiosk", label: "Turnike Ekranı", icon: "kiosk" as const },
  { href: "/reports/daily", label: "Günlük Rapor", icon: "daily" as const },
  { href: "/reports/monthly", label: "Aylık Rapor", icon: "monthly" as const },
  { href: "/puantaj/monthly", label: "Puantaj", icon: "monthly" as const },
  {
    href: "/puantaj/payroll-mapping",
    label: "Payroll Mapping",
    icon: "monthly" as const,
    parentHref: "/puantaj/monthly",
  },

  // Admin-only
  {
    href: "/admin/users",
    label: "Kullanıcı Yönetimi",
    icon: "user" as const,
    parentHref: "/policy",
    requiresRoles: ["SYSTEM_ADMIN"],
  },
  {
    href: "/admin/recompute-required",
    label: "Recompute Kuyruğu",
    icon: "bell" as const,
    parentHref: "/policy",
    requiresRoles: ["SYSTEM_ADMIN"],
  },
  {
    href: "/admin/audit",
    label: "Denetim Kayıtları",
    icon: "bell" as const,
    parentHref: "/policy",
    requiresRoles: ["SYSTEM_ADMIN"],
  },
];

export default function AppShell(props: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  contentDensity?: "default" | "tight";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<boolean>(() => pickInitialCollapsed());
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [expandedParentHref, setExpandedParentHref] = useState<string | null>(null);

  const [meRole, setMeRole] = useState<UserRole | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<GlobalSearchResponse>(EMPTY_SEARCH_RESULTS);
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [pendingGuardedNavigation, setPendingGuardedNavigation] = useState<{
    href: string;
    onNavigate?: () => void;
  } | null>(null);
  const sidebarNavRef = useRef<HTMLElement | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const searchItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const searchRequestSeqRef = useRef(0);
  const canAccessConfigurationCenter =
    meRole === "SYSTEM_ADMIN" || meRole === "HR_CONFIG_ADMIN";
  const configurationCenterHref = buildConfigurationCenterHref("employees");
  const configurationCenterActive = isConfigurationCenterPathname(pathname);
  const contentDensity = props.contentDensity ?? "default";

  const isAdminEmployeeCreateFocusMode = pathname === "/admin/employees";
  const sidebarScrollStorageKey = "appShell.sidebarScrollTop";

  const persistSidebarScroll = useCallback(() => {
    if (typeof window === "undefined") return;
    const nextScrollTop = sidebarNavRef.current?.scrollTop ?? 0;
    window.sessionStorage.setItem(sidebarScrollStorageKey, String(nextScrollTop));
  }, []);

  const restoreSidebarScroll = useCallback(() => {
    if (typeof window === "undefined") return;
    const saved = window.sessionStorage.getItem(sidebarScrollStorageKey);
    if (!saved) return;
    const parsed = Number(saved);
    if (!Number.isFinite(parsed)) return;
    window.requestAnimationFrame(() => {
      if (!sidebarNavRef.current) return;
      sidebarNavRef.current.scrollTop = parsed;
    });
  }, []);

  // Discover role client-side so we can hide admin-only nav items
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json().catch(() => null);
        const role = (j?.user?.role ?? null) as UserRole | null;
        if (!cancelled) setMeRole(role);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      searchRequestSeqRef.current += 1;
      setSearchLoading(false);
      setSearchResults(EMPTY_SEARCH_RESULTS);
      return;
    }

    const requestId = ++searchRequestSeqRef.current;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchOpen(true);
      try {
        const res = await fetch(`/api/search/global?q=${encodeURIComponent(query)}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`SEARCH_FAILED_${res.status}`);
        }

        const payload = (await res.json()) as Partial<GlobalSearchResponse>;
        if (controller.signal.aborted || requestId !== searchRequestSeqRef.current) return;

        setSearchResults({
          pages: Array.isArray(payload.pages) ? payload.pages : [],
          employees: Array.isArray(payload.employees) ? payload.employees : [],
          organizationUnits: Array.isArray(payload.organizationUnits) ? payload.organizationUnits : [],
          devices: Array.isArray(payload.devices) ? payload.devices : [],
        });
        setSearchOpen(true);
      } catch (error: unknown) {
        if (
          (error as { name?: string } | null)?.name === "AbortError" ||
          controller.signal.aborted ||
          requestId !== searchRequestSeqRef.current
        ) {
          return;
        }
        setSearchResults(EMPTY_SEARCH_RESULTS);
        setSearchOpen(true);
      } finally {
        if (!controller.signal.aborted && requestId === searchRequestSeqRef.current) {
          setSearchLoading(false);
        }
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [searchQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("appShell.sidebarCollapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setActiveSearchIndex(null);
    restoreSidebarScroll();
  }, [pathname, restoreSidebarScroll]);

  useEffect(() => {
    restoreSidebarScroll();
  }, [restoreSidebarScroll]);

  useEffect(() => {
    setActiveSearchIndex(null);
  }, [searchQuery]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!searchContainerRef.current) return;
      if (searchContainerRef.current.contains(event.target as Node)) return;
      setSearchOpen(false);
      setActiveSearchIndex(null);
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const visibleNav = useMemo(() => {
    return nav.filter((n) => {
      if (!n.requiresRoles || n.requiresRoles.length === 0) return true;
      if (!meRole) return false; // fail-closed in UI until role known
      return n.requiresRoles.includes(meRole);
    });
  }, [meRole]);

  const navRoots = useMemo(() => {
    return visibleNav.filter((n) => !n.parentHref);
  }, [visibleNav]);

  const navChildrenByParent = useMemo(() => {
    const map: Record<string, NavItem[]> = {};
    for (const item of visibleNav) {
      if (!item.parentHref) continue;
      if (!map[item.parentHref]) map[item.parentHref] = [];
      map[item.parentHref].push(item);
    }
    return map;
  }, [visibleNav]);

  const sidebarCollapsed = collapsed;

  const activeHref = useMemo(() => {
    const navigableNav = nav.filter((n) => n.isNavigable !== false);
    const exact = navigableNav.find((n) => n.href === pathname)?.href;
    if (exact) return exact;

    if (isCompanyManagementPathname(pathname)) {
      return "/company-management";
    }

    const pref = navigableNav
      .filter((n) => n.href !== "/dashboard")
      .sort((a, b) => b.href.length - a.href.length)
      .find((n) => pathname?.startsWith(n.href));

    return pref?.href ?? "/dashboard";
  }, [pathname]);

  const handleGuardedNavClick = useCallback(
    (
      event: ReactMouseEvent<HTMLAnchorElement>,
      href: string,
      onNavigate?: () => void,
    ) => {
      if (!shouldInterceptAppShellNavigation(event)) {
        onNavigate?.();
        return;
      }

      if (pathname === href) {
        onNavigate?.();
        return;
      }

      if (isDataManagementDirtyGuardActive()) {
        event.preventDefault();
        setPendingGuardedNavigation({ href, onNavigate });
        return;
      }

      onNavigate?.();
    },
    [pathname],
  );

  const confirmPendingGuardedNavigation = useCallback(() => {
    if (!pendingGuardedNavigation) return;
    const target = pendingGuardedNavigation;
    setPendingGuardedNavigation(null);
    target.onNavigate?.();
    router.push(target.href);
  }, [pendingGuardedNavigation, router]);

  function NavList(propsNav: {
    collapsed: boolean;
    onNavigate?: () => void;
  }) {
    return (
      <div className={cx("grid gap-1.5", propsNav.collapsed && "gap-2")}>
        {navRoots.map((n) => {
          const children = navChildrenByParent[n.href] ?? [];
          const isActive = n.href === activeHref;
          const isSection = n.isNavigable === false;
          const hasActiveChild = children.some((c) => c.href === activeHref);
          const isBranchActive = isActive || hasActiveChild;
          const isExpanded =
            !propsNav.collapsed &&
            children.length > 0 &&
            expandedParentHref === n.href;

          return (
            <div key={n.href} className="grid gap-1.5">
              <div className="flex items-stretch gap-2">
                {isSection ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (children.length === 0) return;
                      setExpandedParentHref((prev) => (prev === n.href ? null : n.href));
                    }}
                    aria-expanded={children.length > 0 ? isExpanded : undefined}
                    className={cx(
                      "group relative flex min-w-0 flex-1 items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm transition duration-200",
                      isBranchActive
                        ? "border-cyan-300/14 bg-white/10 text-white shadow-[0_14px_28px_rgba(15,23,42,0.16)]"
                        : "border-white/6 text-slate-200/84 hover:border-cyan-300/14 hover:bg-white/8 hover:text-white",
                      propsNav.collapsed && "justify-center gap-0 px-2.5 py-2.5",
                      propsNav.collapsed && !isBranchActive && "hover:bg-white/10"
                    )}
                    title={propsNav.collapsed ? n.label : undefined}
                  >
                    <span
                      className={cx(
                        "grid place-items-center rounded-xl border border-white/10 bg-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] h-9 w-9",
                        isBranchActive
                          ? "border-cyan-300/18 bg-white/12"
                          : "group-hover:border-cyan-300/20 group-hover:bg-white/12",
                        propsNav.collapsed && "h-10 w-10 rounded-[14px]"
                      )}
                    >
                      <Icon name={n.icon} className="h-[18px] w-[18px]" />
                    </span>

                    <span className={cx("min-w-0 flex-1 truncate", propsNav.collapsed && "hidden")}>
                      {n.label}
                    </span>
                  </button>
                ) : (
                  <Link
                  href={n.href}
                  onClick={(event) =>
                    handleGuardedNavClick(event, n.href, propsNav.onNavigate)
                  }
                  className={cx(
                    "group relative flex min-w-0 flex-1 items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm transition duration-200",
                    isActive
                      ? "border-indigo-300/22 bg-[linear-gradient(135deg,rgba(99,102,241,0.30),rgba(56,189,248,0.16))] text-white shadow-[0_18px_35px_rgba(49,46,129,0.34)]"
                      : isBranchActive
                        ? "border-cyan-300/14 bg-white/10 text-white shadow-[0_14px_28px_rgba(15,23,42,0.16)]"
                        : "border-white/6 text-slate-200/84 hover:border-cyan-300/14 hover:bg-white/8 hover:text-white",
                    propsNav.collapsed && "justify-center gap-0 px-2.5 py-2.5",
                    propsNav.collapsed && isActive && "shadow-[0_14px_28px_rgba(49,46,129,0.28)]",
                    propsNav.collapsed && !isActive && !isBranchActive && "hover:bg-white/10"
                  )}
                  title={propsNav.collapsed ? n.label : undefined}
                >
                  <span
                    className={cx(
                      "grid place-items-center rounded-xl border border-white/10 bg-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] h-9 w-9",
                      isActive
                        ? "border-indigo-300/24 bg-[linear-gradient(135deg,rgba(129,140,248,0.28),rgba(34,211,238,0.14))]"
                        : isBranchActive
                          ? "border-cyan-300/18 bg-white/12"
                          : "group-hover:border-cyan-300/20 group-hover:bg-white/12",
                      propsNav.collapsed && "h-10 w-10 rounded-[14px]"
                    )}
                  >
                    <Icon name={n.icon} className="h-[18px] w-[18px]" />
                  </span>

                  <span className={cx("min-w-0 flex-1 truncate", propsNav.collapsed && "hidden")}>
                    {n.label}
                  </span>
                  </Link>
                )}

                {!propsNav.collapsed && children.length > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedParentHref((prev) => (prev === n.href ? null : n.href))
                    }
                    className={cx(
                      "inline-flex items-center justify-center rounded-2xl border px-3 text-slate-200/80 transition",
                      isExpanded || hasActiveChild
                        ? "border-cyan-300/18 bg-white/10 text-white"
                        : "border-white/6 bg-white/6 hover:border-cyan-300/14 hover:bg-white/8 hover:text-white"
                    )}
                    aria-label={`${n.label} alt menüsünü aç/kapat`}
                    title="Alt menüyü aç/kapat"
                  >
                    <Icon
                      name="chevron"
                      className={cx(
                        "h-4 w-4 transition-transform",
                        isExpanded ? "rotate-90" : "rotate-0"
                      )}
                    />
                  </button>
                ) : null}
              </div>

              {!propsNav.collapsed && children.length > 0 && isExpanded ? (
                <div className="ml-6 rounded-2xl border border-white/6 bg-black/10 px-3 py-2">
                  <div className="border-l border-cyan-300/18 pl-3">
                    <div className="grid gap-1">
                      {children.map((child) => {
                        const childActive = child.href === activeHref;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={(event) =>
                              handleGuardedNavClick(
                                event,
                                child.href,
                                propsNav.onNavigate,
                              )
                            }
                            className={cx(
                              "group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition",
                              childActive
                                ? "bg-[linear-gradient(135deg,rgba(99,102,241,0.24),rgba(56,189,248,0.12))] text-white shadow-[0_10px_24px_rgba(49,46,129,0.22)]"
                                : "text-slate-300/84 hover:bg-white/8 hover:text-white"
                            )}
                          >
                            <span
                              className={cx(
                                "inline-flex h-2 w-2 rounded-full",
                                childActive ? "bg-cyan-300" : "bg-slate-400/60 group-hover:bg-cyan-300/80"
                              )}
                            />
                            <span className="min-w-0 truncate">{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  const hasSearchQuery = searchQuery.trim().length >= 2;
  const searchIndexOffsets = useMemo(() => {
    const pages = 0;
    const employees = pages + searchResults.pages.length;
    const organizationUnits = employees + searchResults.employees.length;
    const devices = organizationUnits + searchResults.organizationUnits.length;

    return {
      pages,
      employees,
      organizationUnits,
      devices,
    };
  }, [
    searchResults.employees.length,
    searchResults.organizationUnits.length,
    searchResults.pages.length,
  ]);

  const searchSections = useMemo(
    () => [
      {
        key: "pages",
        label: "Sayfalar",
        items: searchResults.pages,
        startIndex: searchIndexOffsets.pages,
      },
      {
        key: "employees",
        label: "Çalışanlar",
        items: searchResults.employees,
        startIndex: searchIndexOffsets.employees,
      },
      {
        key: "organizationUnits",
        label: "Organizasyon birimleri",
        items: searchResults.organizationUnits,
        startIndex: searchIndexOffsets.organizationUnits,
      },
      {
        key: "devices",
        label: "Cihazlar",
        items: searchResults.devices,
        startIndex: searchIndexOffsets.devices,
      },
    ].filter((section) => section.items.length > 0),
    [searchIndexOffsets, searchResults.devices, searchResults.employees, searchResults.organizationUnits, searchResults.pages],
  );

  const flatSearchItems = useMemo(
    () => [
      ...searchResults.pages,
      ...searchResults.employees,
      ...searchResults.organizationUnits,
      ...searchResults.devices,
    ],
    [searchResults.devices, searchResults.employees, searchResults.organizationUnits, searchResults.pages],
  );
  const totalSearchResults = flatSearchItems.length;

  useEffect(() => {
    if (activeSearchIndex === null) return;
    if (activeSearchIndex < flatSearchItems.length) return;
    setActiveSearchIndex(flatSearchItems.length > 0 ? flatSearchItems.length - 1 : null);
  }, [activeSearchIndex, flatSearchItems.length]);

  useEffect(() => {
    if (activeSearchIndex === null) return;
    const element = searchItemRefs.current[activeSearchIndex];
    if (!element) return;
    element.scrollIntoView({ block: "nearest" });
  }, [activeSearchIndex]);

  function handleSelectSearchItem(item: GlobalSearchItem) {
    if (isDataManagementDirtyGuardActive()) {
      setPendingGuardedNavigation({
        href: item.href,
        onNavigate: () => {
          setSearchQuery("");
          setSearchResults(EMPTY_SEARCH_RESULTS);
          setActiveSearchIndex(null);
          setSearchOpen(false);
        },
      });
      return;
    }

    setSearchQuery("");
    setSearchResults(EMPTY_SEARCH_RESULTS);
    setActiveSearchIndex(null);
    setSearchOpen(false);
    router.push(item.href);
  }

  function moveActiveSearchIndex(direction: "next" | "prev") {
    if (flatSearchItems.length === 0) return;
    setSearchOpen(true);
    setActiveSearchIndex((current) => {
      if (current === null) {
        return direction === "next" ? 0 : flatSearchItems.length - 1;
      }
      if (direction === "next") {
        return Math.min(current + 1, flatSearchItems.length - 1);
      }
      return Math.max(current - 1, 0);
    });
  }

  return (
    <div className="min-h-screen bg-app-bg text-app-text">
      {/* Soft app background (demo-like) */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(1200px_520px_at_10%_0%,rgba(56,189,248,0.14),transparent_55%),radial-gradient(980px_560px_at_100%_5%,rgba(99,102,241,0.18),transparent_58%),radial-gradient(900px_520px_at_50%_100%,rgba(139,92,246,0.10),transparent_60%)]" />
 
      {/* Mobile overlay */}
      <div
        className={cx(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setMobileOpen(false)}
      />

      <div
        className={cx("relative z-0 flex", isAdminEmployeeCreateFocusMode && "block")}
      >

        {/* Sidebar */}
        {!isAdminEmployeeCreateFocusMode ? (
          <aside
            className={cx(
              "fixed left-0 top-0 z-50 h-dvh md:sticky md:z-10",
               // demo-like sidebar tone
              "border-r border-white/10 bg-[linear-gradient(180deg,var(--shell-sidebar-from)_0%,var(--shell-sidebar-via)_48%,var(--shell-sidebar-to)_100%)]",
              "transition-[width,transform] duration-200 ease-out",
              "md:translate-x-0",
              mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
              sidebarCollapsed ? "w-[76px]" : "w-70"
            )}
            aria-label="Sidebar"
          >
            {/* Make sidebar internally scrollable (nav scroll), keep footer always reachable */}
            <div className="flex h-dvh min-h-0 flex-col">
              {/* Brand */}
              <div className={cx("flex items-center gap-3 px-4 py-3.5", sidebarCollapsed && "justify-center px-2.5")}>
                <button
                  type="button"
                  onClick={() => setCollapsed((prev) => !prev)}
                  className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-[linear-gradient(135deg,rgba(99,102,241,0.42),rgba(34,211,238,0.18))] text-white shadow-[0_14px_28px_rgba(14,165,233,0.16)] ring-1 ring-white/8 transition duration-200 hover:-translate-y-[1px] hover:bg-[linear-gradient(135deg,rgba(99,102,241,0.50),rgba(34,211,238,0.24))] hover:text-white hover:shadow-[0_18px_34px_rgba(14,165,233,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/30"
                  aria-label={sidebarCollapsed ? "Menüyü genişlet" : "Menüyü küçült"}
                  title={sidebarCollapsed ? "Menüyü genişlet" : "Menüyü küçült"}
                >
                  <Icon
                    name="panel"
                    className={cx(
                      "h-5 w-5 transition-transform duration-200",
                      sidebarCollapsed ? "rotate-180" : "rotate-0"
                    )}
                  />
                </button>

                <div className={cx("min-w-0", sidebarCollapsed && "hidden")}>
                  <div className="truncate text-[13px] font-semibold leading-tight tracking-[0.01em] text-white">Turnike Zaman Yönetimi</div>
                  <div className="truncate text-[11px] text-slate-300/72">On-prem PDKS</div>
                </div>

                {/* Mobile close */}
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="ml-auto inline-flex items-center justify-center rounded-xl border border-indigo-300/18 bg-white/10 p-2 text-slate-100/85 hover:bg-white/15 md:hidden"
                  aria-label="Menüyü gizle"
                  title="Menüyü gizle"
                >
                  <Icon name="panel" className="h-5 w-5 rotate-180" />
                </button>
              </div>

              {/* Nav (scroll region) */}
              <nav
              ref={sidebarNavRef}
                onScroll={persistSidebarScroll}
                className={cx(
                  "min-h-0 flex-1 overflow-y-auto px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                  sidebarCollapsed && "px-2 pt-1"
                )}
                aria-label="Navigation"
              >
                <NavList collapsed={sidebarCollapsed} onNavigate={persistSidebarScroll} />
              </nav>

              {/* Footer card */}
              <div className={cx("shrink-0 px-3 pb-4 pt-2", sidebarCollapsed && "px-2")}>
                <div
                  className={cx(
                    "rounded-2xl border border-indigo-300/14 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(99,102,241,0.10))] p-3.5 text-xs text-slate-200/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_14px_28px_rgba(15,23,42,0.12)]",
                    sidebarCollapsed && "hidden"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400/90 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" />
                    <div className="font-medium tracking-[0.01em] text-white">Sistem durumu</div>
                  </div>
                  <div className="mt-2 leading-relaxed text-slate-200/70">Çalışır durumda.</div>
                </div>
              </div>
            </div>
          </aside>
        ) : null}

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          {!isAdminEmployeeCreateFocusMode ? (
            <header className="sticky top-0 z-20 border-b border-indigo-300/12 bg-[linear-gradient(180deg,var(--shell-header-from)_0%,var(--shell-header-via)_55%,var(--shell-header-to)_100%)] backdrop-blur">
              <div className="mx-auto flex max-w-7xl items-center gap-2.5 px-4 py-2 md:px-6 md:py-2.5">
                {/* Mobile menu button */}
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="inline-flex items-center justify-center rounded-xl border border-indigo-300/18 bg-white/10 p-1.5 text-slate-100/85 hover:bg-white/15 md:hidden"
                  aria-label="Menüyü aç"
                >
                  <Icon name="menu" />
                </button>

                {/* Title */}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold tracking-tight text-white md:text-[17px]">
                    {props.title}
                  </div>
                  {props.subtitle ? (
                    <div className="truncate text-[11px] text-slate-300/72">{props.subtitle}</div>
                  ) : null}
                </div>

                {/* Search */}
                <div className="hidden lg:block lg:w-[390px]">
                  <div ref={searchContainerRef} className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300/58">
                      <Icon name="search" className="h-4 w-4" />
                    </span>
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => {
                        if (hasSearchQuery || totalSearchResults > 0 || searchLoading) {
                          setSearchOpen(true);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          moveActiveSearchIndex("next");
                          return;
                        }
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          moveActiveSearchIndex("prev");
                          return;
                        }
                        if (e.key === "Enter") {
                          if (activeSearchIndex !== null && flatSearchItems[activeSearchIndex]) {
                            e.preventDefault();
                            handleSelectSearchItem(flatSearchItems[activeSearchIndex]);
                          }
                          return;
                        }
                        if (e.key === "Escape") {
                          setSearchOpen(false);
                          setActiveSearchIndex(null);
                        }
                      }}
                      aria-label="Global arama"
                      placeholder="Global arama: Sayfa / Çalışan / Organizasyon / Cihaz"
                      className="w-full rounded-xl border border-indigo-300/16 bg-white/10 px-10 py-2 text-sm text-white placeholder:text-slate-300/45 outline-none focus:border-cyan-300/28 focus:ring-2 focus:ring-indigo-300/16"
                    />
                    {searchOpen && hasSearchQuery ? (
                      <div className="absolute right-0 top-[calc(100%+10px)] z-40 w-full overflow-hidden rounded-2xl border border-indigo-200/20 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(30,41,59,0.98))] shadow-[0_24px_48px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                        {searchLoading ? (
                          <div className="px-4 py-4 text-sm text-slate-200/88">Arama yapılıyor...</div>
                        ) : totalSearchResults === 0 ? (
                          <div className="px-4 py-4 text-sm text-slate-200/88">Sonuç bulunamadı.</div>
                        ) : (
                          <div className="max-h-[360px] overflow-y-auto py-2">
                            {searchSections.map((section, sectionIndex) => (
                              <div
                                key={section.key}
                                className={cx(
                                  sectionIndex > 0 && "border-t border-white/8",
                                  "px-2 pb-2",
                                  sectionIndex > 0 ? "pt-2" : "",
                                )}
                              >
                                <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                  {section.label}
                                </div>
                                <div className="grid gap-1">
                                  {section.items.map((item, itemIndex) => {
                                    const resultIndex = section.startIndex + itemIndex;
                                    return (
                                      <button
                                        key={`${item.group}:${item.href}:${item.title}`}
                                        type="button"
                                        ref={(element) => {
                                          searchItemRefs.current[resultIndex] = element;
                                        }}
                                        onClick={() => handleSelectSearchItem(item)}
                                        onMouseEnter={() => setActiveSearchIndex(resultIndex)}
                                        className={cx(
                                          "grid w-full gap-1 rounded-xl px-3 py-2.5 text-left text-slate-100 transition focus:outline-none",
                                          activeSearchIndex === resultIndex
                                            ? "bg-[linear-gradient(135deg,rgba(99,102,241,0.26),rgba(56,189,248,0.16))] shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
                                            : "hover:bg-white/8 focus:bg-white/8",
                                        )}
                                      >
                                        <div className="text-sm font-medium">{item.title}</div>
                                        <div className="text-xs text-slate-300/72">{item.subtitle}</div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                            {false ? (
                              <div className="border-t border-white/8 px-2 pt-2">
                                <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                  Çalışanlar
                                </div>
                                <div className="grid gap-1">
                                  {searchResults.employees.map((item, itemIndex) => (
                                    <button
                                      key={`${item.group}:${item.href}`}
                                      type="button"
                                      ref={(element) => {
                                        searchItemRefs.current[searchResults.pages.length + itemIndex] = element;
                                      }}
                                      onClick={() => handleSelectSearchItem(item)}
                                      onMouseEnter={() => setActiveSearchIndex(searchResults.pages.length + itemIndex)}
                                      className={cx(
                                        "grid w-full gap-1 rounded-xl px-3 py-2.5 text-left text-slate-100 transition focus:outline-none",
                                        activeSearchIndex === searchResults.pages.length + itemIndex
                                          ? "bg-[linear-gradient(135deg,rgba(99,102,241,0.26),rgba(56,189,248,0.16))] shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
                                          : "hover:bg-white/8 focus:bg-white/8",
                                      )}
                                    >
                                      <div className="text-sm font-medium">{item.title}</div>
                                      <div className="text-xs text-slate-300/72">{item.subtitle}</div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {canAccessConfigurationCenter ? (
                    <Link
                      href={configurationCenterHref}
                      onClick={(event) =>
                        handleGuardedNavClick(event, configurationCenterHref)
                      }
                      className={cx(
                        "inline-flex items-center justify-center rounded-xl border p-2 transition",
                        configurationCenterActive
                          ? "border-cyan-300/30 bg-white/18 text-white shadow-[0_10px_24px_rgba(56,189,248,0.14)]"
                          : "border-indigo-300/16 bg-white/10 text-slate-100/88 hover:bg-white/15",
                      )}
                      aria-label="Konfigurasyon merkezi"
                      title="Konfigurasyon merkezi"
                    >
                      <Icon
                        name="settings"
                        className={cx(
                          "h-4 w-4",
                          configurationCenterActive ? "text-cyan-100" : "text-slate-100/88",
                        )}
                      />
                    </Link>
                  ) : null}
                  <button
                    className="inline-flex items-center justify-center rounded-xl border border-indigo-300/16 bg-white/10 p-2 text-slate-100/88 transition hover:bg-white/15"
                    aria-label="Bildirim"
                    title="Bildirim"
                    type="button"
                  >
                    <Icon name="bell" className="h-4 w-4 text-slate-100/88" />
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-[linear-gradient(135deg,#ffffff,#eef2ff)] px-2.5 py-1.5 text-sm font-medium text-slate-900 shadow-[0_10px_24px_rgba(99,102,241,0.16)] hover:brightness-[0.985]">
                    <Icon name="user" className="h-4 w-4 text-indigo-700" />
                    <span className="hidden sm:inline">Kullanıcı</span>
                  </button>
                </div>
              </div>
            </header>
          ) : null}

          {/* Main */}
          {/* 
            Global horizontal overflow policy:
            - Content should NOT spill outside the "outer card"
            - If content needs more width (pinned sidebar / large tables / long chips), enable horizontal scroll
            - Keep the centered max width for normal pages, but allow overflow via scroll instead of squeezing.
          */}
          <main
            className={cx(
              "min-w-0 overflow-x-auto",
              isAdminEmployeeCreateFocusMode
                ? "mx-auto w-full max-w-[1180px] px-4 pt-6 pb-8 md:px-8 md:pt-8 md:pb-10"
                : contentDensity === "tight"
                  ? "mx-auto w-full max-w-7xl px-4 pt-0.5 pb-5 md:px-6 md:pt-1 md:pb-5"
                  : "mx-auto w-full max-w-7xl px-4 pt-1 pb-6 md:px-6 md:pt-3 md:pb-6"
            )}
          >
            <div
              className={cx(
                isAdminEmployeeCreateFocusMode
                  ? "min-w-full rounded-[28px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.94))] p-3 shadow-[0_24px_60px_rgba(15,23,42,0.10)] md:p-4"
                  : contentDensity === "tight"
                    ? "min-w-full rounded-3xl border border-app-border bg-app-surface p-2 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm md:p-3"
                    : "min-w-full rounded-3xl border border-app-border bg-app-surface p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm md:p-6"
              )}
            >
              {props.children}
            </div>
          </main>
        </div>
      </div>

      <DataManagementDirtyExitDialog
        open={pendingGuardedNavigation !== null}
        description="Kaydedilmemiş değişiklikler silinecek. Bu sayfadan çıkmak istiyor musunuz?"
        confirmLabel="Sayfadan Çık"
        onCancel={() => setPendingGuardedNavigation(null)}
        onConfirm={confirmPendingGuardedNavigation}
      />
    </div>
  );
}
