import type { Role } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import {
  type HomeCardRole,
  type HomeQuickAccessCardDefinition,
  type HomeQuickAccessRuntimeCard,
} from "@/src/features/home/homeQuickAccess";
import { resolveHomeQuickAccessConfiguration } from "./homeQuickAccessConfiguration.service";

export function isHomeQuickAccessCardAccessible(args: {
  card: Pick<
    HomeQuickAccessCardDefinition,
    "roleSet" | "roles" | "requiresEmployeeImportAccess"
  >;
  role: Role | null;
  canAccessEmployeeImport: boolean;
}) {
  const { card, role, canAccessEmployeeImport } = args;

  if (card.requiresEmployeeImportAccess && !canAccessEmployeeImport) {
    return false;
  }

  if (card.roles?.length) {
    return role ? card.roles.includes(role as HomeCardRole) : false;
  }

  if (card.roleSet) {
    return role ? ROLE_SETS[card.roleSet].includes(role) : false;
  }

  return true;
}

export async function resolveVisibleHomeQuickAccessCards(args: {
  companyId: string;
  role: Role | null;
  canAccessEmployeeImport: boolean;
  db?: Parameters<typeof resolveHomeQuickAccessConfiguration>[0]["db"];
}): Promise<HomeQuickAccessRuntimeCard[]> {
  const configuration = await resolveHomeQuickAccessConfiguration({
    companyId: args.companyId,
    db: args.db,
  });

  return configuration.cards
    .filter(
      (card) =>
        card.isVisible &&
        isHomeQuickAccessCardAccessible({
          card,
          role: args.role,
          canAccessEmployeeImport: args.canAccessEmployeeImport,
        }),
    )
    .map(({ order: _order, isVisible: _isVisible, ...card }) => card);
}