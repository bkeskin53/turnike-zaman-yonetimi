import { prisma } from "@/src/repositories/prisma";
import {
  buildDefaultHomeQuickAccessConfiguration,
  parseHomeQuickAccessCardId,
  type HomeQuickAccessResolvedConfiguration,
} from "@/src/features/home/homeQuickAccess";

type HomeQuickAccessProfileReader = {
  homeQuickAccessProfile: {
    findUnique: (args: {
      where: { companyId: string };
      select: {
        cards: {
          orderBy: { sortOrder: "asc" };
          select: {
            cardId: true;
            sortOrder: true;
            isVisible: true;
          };
        };
      };
    }) => Promise<{
      cards: Array<{
        cardId: string;
        sortOrder: number;
        isVisible: boolean;
      }>;
    } | null>;
  };
};

export function mergeHomeQuickAccessConfigurationOverrides(args: {
  base?: HomeQuickAccessResolvedConfiguration;
  overrides: Array<{
    cardId: string;
    sortOrder: number;
    isVisible: boolean;
  }>;
}): HomeQuickAccessResolvedConfiguration {
  const base = args.base ?? buildDefaultHomeQuickAccessConfiguration();
  const baseOrderMap = new Map(
    base.cards.map((card, index) => [card.id, index] as const),
  );
  const overrideMap = new Map<
    string,
    {
      sortOrder: number;
      isVisible: boolean;
    }
  >();

  for (const raw of args.overrides) {
    try {
      const cardId = parseHomeQuickAccessCardId(raw.cardId);
      if (overrideMap.has(cardId)) continue;

      overrideMap.set(cardId, {
        sortOrder:
          Number.isInteger(raw.sortOrder) && raw.sortOrder >= 0
            ? raw.sortOrder
            : (baseOrderMap.get(cardId) ?? 0),
        isVisible: Boolean(raw.isVisible),
      });
    } catch {
      continue;
    }
  }

  const merged = base.cards
    .map((card, index) => {
      const override = overrideMap.get(card.id);
      return {
        ...card,
        order: override?.sortOrder ?? index,
        isVisible: override?.isVisible ?? card.isVisible,
      };
    })
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return (baseOrderMap.get(a.id) ?? 0) - (baseOrderMap.get(b.id) ?? 0);
    })
    .map((card, index) => ({
      ...card,
      order: index,
    }));

  return {
    key: base.key,
    cards: merged,
  };
}

export async function resolveHomeQuickAccessConfiguration(args: {
  companyId: string;
  db?: HomeQuickAccessProfileReader;
}): Promise<HomeQuickAccessResolvedConfiguration> {
  const db = (args.db ?? prisma) as HomeQuickAccessProfileReader;
  const profile = await db.homeQuickAccessProfile.findUnique({
    where: {
      companyId: args.companyId,
    },
    select: {
      cards: {
        orderBy: { sortOrder: "asc" },
        select: {
          cardId: true,
          sortOrder: true,
          isVisible: true,
        },
      },
    },
  });

  if (!profile) {
    return buildDefaultHomeQuickAccessConfiguration();
  }

  return mergeHomeQuickAccessConfigurationOverrides({
    overrides: profile.cards,
  });
}