import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCapabilities } from "@/app/_auth/capabilities";
import { requireRole, type Role } from "@/src/auth/guard";
import { authErrorResponse } from "@/src/auth/http";
import { ROLE_SETS } from "@/src/auth/roleSets";
import { getEmployeeScopeWhereForSession, withCompanyEmployeeWhere } from "@/src/auth/scope";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";
import { resolveVisibleHomeQuickAccessCards } from "@/src/services/home/homeQuickAccessResolver.service";

type SearchResultItem = {
  type: "page" | "employee" | "organizationUnit" | "device";
  group: "pages" | "employees" | "organizationUnits" | "devices";
  title: string;
  subtitle: string;
  href: string;
};

const PAGE_RESULT_LIMIT = 6;
const EMPLOYEE_RESULT_LIMIT = 6;
const ORGANIZATION_UNIT_RESULT_LIMIT = 6;
const DEVICE_RESULT_LIMIT = 6;

type PageSearchEntry = {
  title: string;
  description: string;
  href: string;
  keywords?: string[];
};

const ORGANIZATION_PAGE_SEARCH_ENTRY: PageSearchEntry = {
  title: "Şirket Yönetimi",
  description: "Konum grubu ve konum tanımlarını açın.",
  href: "/company-management",
  keywords: [
    "şirket yönetimi",
    "şirket",
    "konum",
    "konum grubu",
    "lokasyon",
    "şube",
    "grup",
    "organizasyon",
    "org",
  ],
};

function normalizeSearchText(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .trim();
}

function getSearchTokens(query: string) {
  return normalizeSearchText(query)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function matchesPageQuery(item: PageSearchEntry, query: string) {
  const tokens = getSearchTokens(query);
  if (tokens.length === 0) return false;

  const haystack = normalizeSearchText(
    [item.title, item.description, item.href, ...(item.keywords ?? [])].join(" "),
  );

  return tokens.every((token) => haystack.includes(token));
}

function buildEmployeeWhere(args: {
  companyId: string;
  scopeWhere: Prisma.EmployeeWhereInput | null;
  query: string;
}): Prisma.EmployeeWhereInput {
  const tokens = args.query
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 5);

  return {
    AND: [
      withCompanyEmployeeWhere(args.companyId, args.scopeWhere),
      ...tokens.map((token) => ({
        OR: [
          { employeeCode: { contains: token, mode: Prisma.QueryMode.insensitive } },
          { firstName: { contains: token, mode: Prisma.QueryMode.insensitive } },
          { lastName: { contains: token, mode: Prisma.QueryMode.insensitive } },
        ],
      })),
    ],
  };
}

async function getSupervisorSearchScopes(session: { userId: string; role: Role }) {
  if (session.role !== "SUPERVISOR") {
    return {
      branchIds: null as string[] | null,
      groupIds: null as string[] | null,
      subgroupIds: null as string[] | null,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      scopeBranchIds: true,
      scopeEmployeeGroupIds: true,
      scopeEmployeeSubgroupIds: true,
    },
  });

  return {
    branchIds: (user?.scopeBranchIds ?? []).filter(Boolean),
    groupIds: (user?.scopeEmployeeGroupIds ?? []).filter(Boolean),
    subgroupIds: (user?.scopeEmployeeSubgroupIds ?? []).filter(Boolean),
  };
}

export async function GET(req: NextRequest) {
  let session: { userId: string; role: Role } | null = null;
  try {
    session = await requireRole(ROLE_SETS.READ_ALL);
  } catch (err) {
    const response = authErrorResponse(err);
    if (response) return response;
    throw err;
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) {
    return NextResponse.json({
      pages: [],
      employees: [],
      organizationUnits: [],
      devices: [],
    });
  }

  const [capabilities, companyId, scopeWhere, supervisorScopes] = await Promise.all([
    getCapabilities(),
    getActiveCompanyId(),
    getEmployeeScopeWhereForSession(session),
    getSupervisorSearchScopes(session),
  ]);

  const visibleHomeCards = await resolveVisibleHomeQuickAccessCards({
    companyId,
    role: session.role,
    canAccessEmployeeImport: capabilities.employeeImport.canAccessWorkspace,
  });

  const pageSearchEntries: PageSearchEntry[] = [
    ...visibleHomeCards.map((card) => ({
      title: card.title,
      description: card.description,
      href: card.href,
    })),
    ORGANIZATION_PAGE_SEARCH_ENTRY,
  ];

  const pages: SearchResultItem[] = pageSearchEntries.filter((item) =>
    matchesPageQuery(item, q),
  )
    .slice(0, PAGE_RESULT_LIMIT)
    .map((item) => ({
      type: "page",
      group: "pages",
      title: item.title,
      subtitle: item.description,
      href: item.href,
    }));

  const employees = await prisma.employee.findMany({
    where: buildEmployeeWhere({
      companyId,
      scopeWhere,
      query: q,
    }),
    orderBy: [{ employeeCode: "asc" }],
    take: EMPLOYEE_RESULT_LIMIT,
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
    },
  });

  const employeeResults: SearchResultItem[] = employees.map((employee) => {
    const fullName = [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim();
    return {
      type: "employee",
      group: "employees",
      title: fullName || `Çalışan ${employee.employeeCode}`,
      subtitle: `Sicil ${employee.employeeCode}`,
      href: `/employees/${employee.id}/master`,
    };
  });

  const normalizedQuery = normalizeSearchText(q);
  const branchWhere: Prisma.BranchWhereInput = {
    companyId,
    ...(supervisorScopes.branchIds
      ? { id: { in: supervisorScopes.branchIds.length ? supervisorScopes.branchIds : ["__NONE__"] } }
      : {}),
    OR: [
      { code: { contains: q, mode: Prisma.QueryMode.insensitive } },
      { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
    ],
  };

  const groupWhere: Prisma.EmployeeGroupWhereInput = {
    companyId,
    ...(supervisorScopes.groupIds
      ? { id: { in: supervisorScopes.groupIds.length ? supervisorScopes.groupIds : ["__NONE__"] } }
      : {}),
    OR: [
      { code: { contains: q, mode: Prisma.QueryMode.insensitive } },
      { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
    ],
  };

  const subgroupWhere: Prisma.EmployeeSubgroupWhereInput = {
    companyId,
    ...(supervisorScopes.subgroupIds
      ? { id: { in: supervisorScopes.subgroupIds.length ? supervisorScopes.subgroupIds : ["__NONE__"] } }
      : {}),
    OR: [
      { code: { contains: q, mode: Prisma.QueryMode.insensitive } },
      { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
      { group: { code: { contains: q, mode: Prisma.QueryMode.insensitive } } },
      { group: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } },
    ],
  };

  const deviceWhere: Prisma.DeviceWhereInput = {
    companyId,
    ...(supervisorScopes.branchIds
      ? { branchId: { in: supervisorScopes.branchIds.length ? supervisorScopes.branchIds : ["__NONE__"] } }
      : {}),
    OR: [
      { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
      { ip: { contains: q, mode: Prisma.QueryMode.insensitive } },
      { branch: { code: { contains: q, mode: Prisma.QueryMode.insensitive } } },
      { branch: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } },
    ],
  };

  const [branches, groups, subgroups, devices] = await Promise.all([
    prisma.branch.findMany({
      where: branchWhere,
      orderBy: [{ code: "asc" }],
      take: ORGANIZATION_UNIT_RESULT_LIMIT,
      select: {
        id: true,
        code: true,
        name: true,
      },
    }),
    prisma.employeeGroup.findMany({
      where: groupWhere,
      orderBy: [{ code: "asc" }],
      take: ORGANIZATION_UNIT_RESULT_LIMIT,
      select: {
        id: true,
        code: true,
        name: true,
      },
    }),
    prisma.employeeSubgroup.findMany({
      where: subgroupWhere,
      orderBy: [{ code: "asc" }],
      take: ORGANIZATION_UNIT_RESULT_LIMIT,
      select: {
        id: true,
        code: true,
        name: true,
        group: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    }),
    prisma.device.findMany({
      where: deviceWhere,
      orderBy: [{ createdAt: "desc" }],
      take: DEVICE_RESULT_LIMIT,
      select: {
        id: true,
        name: true,
        ip: true,
        branch: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    }),
  ]);

  const organizationUnitResults: SearchResultItem[] = [
    ...branches.map((branch) => ({
      type: "organizationUnit" as const,
      group: "organizationUnits" as const,
      title: branch.name,
      subtitle: `Konum · ${branch.code}`,
      href: `/company-management?module=locations#location-${branch.id}`,
    })),
    ...groups.map((group) => ({
      type: "organizationUnit" as const,
      group: "organizationUnits" as const,
      title: group.name,
      subtitle: `Grup · ${group.code}`,
      href: `/workforce/groups#group-${group.id}`,
    })),
    ...subgroups.map((subgroup) => ({
      type: "organizationUnit" as const,
      group: "organizationUnits" as const,
      title: subgroup.name,
      subtitle: `Alt grup · ${subgroup.code}${subgroup.group ? ` · ${subgroup.group.code}` : ""}`,
      href: `/workforce/subgroups#subgroup-${subgroup.id}`,
    })),
  ]
    .filter((item) => normalizeSearchText(`${item.title} ${item.subtitle}`).includes(normalizedQuery))
    .slice(0, ORGANIZATION_UNIT_RESULT_LIMIT);

  const deviceResults: SearchResultItem[] = devices.map((device) => ({
    type: "device",
    group: "devices",
    title: device.name,
    subtitle: `Cihaz${device.ip ? ` · ${device.ip}` : ""}${device.branch ? ` · ${device.branch.code}` : ""}`,
    href: `/org#device-${device.id}`,
  }));

  return NextResponse.json({
    pages,
    employees: employeeResults,
    organizationUnits: organizationUnitResults,
    devices: deviceResults,
  });
}
