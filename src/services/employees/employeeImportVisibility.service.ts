import { UserDataScope } from "@prisma/client";
import type { Role } from "@/src/auth/guard";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";
import type { EmployeeImportCapabilities, EmployeeImportPermissionKey } from "@/src/services/employees/employeeImportPermission.service";
import { requireEmployeeImportPermission } from "@/src/services/employees/employeeImportPermission.service";

export type EmployeeImportVisibilityMode = "COMPANY_ALL" | "LIMITED_USER_SCOPE_BLOCKED";

export type EmployeeImportVisibilityState = {
  mode: EmployeeImportVisibilityMode;
  blockedReason: string | null;
};

export type EmployeeImportVisibilityScope = EmployeeImportVisibilityState & {
  companyId: string;
  userId: string;
  role: Role;
  userDataScope: UserDataScope;
  scopeBranchIds: string[];
  scopeEmployeeGroupIds: string[];
  scopeEmployeeSubgroupIds: string[];
};

export class EmployeeImportVisibilityScopeError extends Error {
  code: "EMPLOYEE_IMPORT_SCOPE_NOT_SUPPORTED";

  constructor(message: string) {
    super(message);
    this.name = "EmployeeImportVisibilityScopeError";
    this.code = "EMPLOYEE_IMPORT_SCOPE_NOT_SUPPORTED";
  }
}

export function isEmployeeImportVisibilityScopeError(error: unknown): error is EmployeeImportVisibilityScopeError {
  return error instanceof EmployeeImportVisibilityScopeError;
}

function normalizeScopeIds(values: string[] | null | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => String(value ?? "").trim()).filter(Boolean)));
}

export function deriveEmployeeImportVisibilityMode(args: {
  dataScope?: UserDataScope | null;
  scopeBranchIds?: string[] | null;
  scopeEmployeeGroupIds?: string[] | null;
  scopeEmployeeSubgroupIds?: string[] | null;
}): EmployeeImportVisibilityMode {
  const dataScope = args.dataScope ?? UserDataScope.ALL;
  const branchIds = normalizeScopeIds(args.scopeBranchIds);
  const groupIds = normalizeScopeIds(args.scopeEmployeeGroupIds);
  const subgroupIds = normalizeScopeIds(args.scopeEmployeeSubgroupIds);

  if (dataScope !== UserDataScope.ALL) return "LIMITED_USER_SCOPE_BLOCKED";
  if (branchIds.length > 0 || groupIds.length > 0 || subgroupIds.length > 0) {
    return "LIMITED_USER_SCOPE_BLOCKED";
  }

  return "COMPANY_ALL";
}

export function buildEmployeeImportVisibilityBlockedReason(): string {
  return "İçe aktarım modülü bu aşamada şirket genelinde çalışır. Sınırlı lokasyon, grup veya alt grup veri kapsamı olan hesaplar yalnızca sabit şablonu indirebilir; doğrulama, uygulama ve işlem kaydı geçmişini kullanamaz.";
}

export function applyEmployeeImportVisibilityToCapabilities(
  capabilities: EmployeeImportCapabilities,
  visibility: EmployeeImportVisibilityState,
): EmployeeImportCapabilities {
  if (visibility.mode === "COMPANY_ALL") return capabilities;

  return {
    ...capabilities,
    canValidate: false,
    canApply: false,
    canReadHistory: false,
    canRecoverOperations: false,
    canAccessWorkspace: capabilities.canDownloadTemplate,
  };
}

export async function resolveEmployeeImportVisibilityScope(args: {
  userId: string;
  role: Role;
}): Promise<EmployeeImportVisibilityScope> {
  const [companyId, user] = await Promise.all([
    getActiveCompanyId(),
    prisma.user.findUnique({
      where: { id: args.userId },
      select: {
        id: true,
        isActive: true,
        dataScope: true,
        scopeBranchIds: true,
        scopeEmployeeGroupIds: true,
        scopeEmployeeSubgroupIds: true,
      },
    }),
  ]);

  if (!user || !user.isActive) {
    throw new Error("FORBIDDEN");
  }

  const scopeBranchIds = normalizeScopeIds(user.scopeBranchIds);
  const scopeEmployeeGroupIds = normalizeScopeIds(user.scopeEmployeeGroupIds);
  const scopeEmployeeSubgroupIds = normalizeScopeIds(user.scopeEmployeeSubgroupIds);
  const userDataScope = user.dataScope ?? UserDataScope.ALL;
  const mode = deriveEmployeeImportVisibilityMode({
    dataScope: userDataScope,
    scopeBranchIds,
    scopeEmployeeGroupIds,
    scopeEmployeeSubgroupIds,
  });
  const blockedReason = mode === "LIMITED_USER_SCOPE_BLOCKED" ? buildEmployeeImportVisibilityBlockedReason() : null;

  return {
    companyId,
    userId: args.userId,
    role: args.role,
    userDataScope,
    scopeBranchIds,
    scopeEmployeeGroupIds,
    scopeEmployeeSubgroupIds,
    mode,
    blockedReason,
  };
}

export function assertEmployeeImportCompanyWideScope(scope: EmployeeImportVisibilityScope) {
  if (scope.mode !== "COMPANY_ALL") {
    throw new EmployeeImportVisibilityScopeError(scope.blockedReason ?? buildEmployeeImportVisibilityBlockedReason());
  }
}

export async function requireEmployeeImportAccess(permission: EmployeeImportPermissionKey) {
  const session = await requireEmployeeImportPermission(permission);
  const scope = await resolveEmployeeImportVisibilityScope(session);

  if (permission !== "TEMPLATE_DOWNLOAD") {
    assertEmployeeImportCompanyWideScope(scope);
  }

  return {
    session,
    scope,
  };
}
