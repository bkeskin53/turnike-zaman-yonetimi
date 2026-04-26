import { Prisma } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import {
  buildDefaultHomeQuickAccessConfiguration,
  HOME_QUICK_ACCESS_CARD_IDS,
  parseHomeQuickAccessCardId,
  type HomeQuickAccessCardId,
  type HomeQuickAccessResolvedConfiguration,
} from "@/src/features/home/homeQuickAccess";
import { mergeHomeQuickAccessConfigurationOverrides } from "./homeQuickAccessConfiguration.service";

type TxClient = Prisma.TransactionClient;

export type HomeQuickAccessConfigurationWriteCardInput = {
  cardId: string;
  isVisible: boolean;
  order: number;
};

export type HomeQuickAccessConfigurationWriteInput = {
  cards: HomeQuickAccessConfigurationWriteCardInput[];
};

export type HomeQuickAccessConfigurationMutationErrorCode =
  | "INVALID_HOME_QUICK_ACCESS_CARD_ID"
  | "INVALID_HOME_QUICK_ACCESS_CARD_SET"
  | "INVALID_HOME_QUICK_ACCESS_CARD_ORDER"
  | "INVALID_HOME_QUICK_ACCESS_VISIBILITY";

export class HomeQuickAccessConfigurationMutationError extends Error {
  code: HomeQuickAccessConfigurationMutationErrorCode;

  constructor(
    code: HomeQuickAccessConfigurationMutationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "HomeQuickAccessConfigurationMutationError";
    this.code = code;
  }
}

export function isHomeQuickAccessConfigurationMutationError(
  error: unknown,
): error is HomeQuickAccessConfigurationMutationError {
  return error instanceof HomeQuickAccessConfigurationMutationError;
}

function normalizeWriteInput(
  input: HomeQuickAccessConfigurationWriteInput,
): Array<{
  cardId: HomeQuickAccessCardId;
  isVisible: boolean;
  order: number;
}> {
  if (!Array.isArray(input.cards)) {
    throw new HomeQuickAccessConfigurationMutationError(
      "INVALID_HOME_QUICK_ACCESS_CARD_SET",
      "Kart listesi geçersiz.",
    );
  }

  const seenIds = new Set<HomeQuickAccessCardId>();
  const seenOrders = new Set<number>();

  const normalized = input.cards.map((item) => {
    let cardId: HomeQuickAccessCardId;
    try {
      cardId = parseHomeQuickAccessCardId(String(item?.cardId ?? ""));
    } catch {
      throw new HomeQuickAccessConfigurationMutationError(
        "INVALID_HOME_QUICK_ACCESS_CARD_ID",
        "Geçersiz home quick access card id.",
      );
    }

    if (typeof item?.isVisible !== "boolean") {
      throw new HomeQuickAccessConfigurationMutationError(
        "INVALID_HOME_QUICK_ACCESS_VISIBILITY",
        "isVisible yalnızca boolean olabilir.",
      );
    }

    const order = Number(item?.order);
    if (!Number.isInteger(order) || order < 0) {
      throw new HomeQuickAccessConfigurationMutationError(
        "INVALID_HOME_QUICK_ACCESS_CARD_ORDER",
        "Kart sırası 0 ve üzeri tam sayı olmalıdır.",
      );
    }

    if (seenIds.has(cardId)) {
      throw new HomeQuickAccessConfigurationMutationError(
        "INVALID_HOME_QUICK_ACCESS_CARD_SET",
        "Aynı kart birden fazla kez gönderilemez.",
      );
    }
    seenIds.add(cardId);

    if (seenOrders.has(order)) {
      throw new HomeQuickAccessConfigurationMutationError(
        "INVALID_HOME_QUICK_ACCESS_CARD_ORDER",
        "Aynı sıra değeri birden fazla kez gönderilemez.",
      );
    }
    seenOrders.add(order);

    return {
      cardId,
      isVisible: item.isVisible,
      order,
    };
  });

  const expectedIds = [...HOME_QUICK_ACCESS_CARD_IDS].sort();
  const actualIds = normalized.map((item) => item.cardId).sort();

  if (
    expectedIds.length !== actualIds.length ||
    expectedIds.some((id, index) => id !== actualIds[index])
  ) {
    throw new HomeQuickAccessConfigurationMutationError(
      "INVALID_HOME_QUICK_ACCESS_CARD_SET",
      "Tam ve geçerli kart seti gönderilmelidir.",
    );
  }

  const expectedOrders = Array.from(
    { length: HOME_QUICK_ACCESS_CARD_IDS.length },
    (_, index) => index,
  );
  const actualOrders = normalized
    .map((item) => item.order)
    .sort((a, b) => a - b);

  if (expectedOrders.some((value, index) => value !== actualOrders[index])) {
    throw new HomeQuickAccessConfigurationMutationError(
      "INVALID_HOME_QUICK_ACCESS_CARD_ORDER",
      "Kart sıraları 0..N-1 aralığında eksiksiz olmalıdır.",
    );
  }

  return normalized.sort((a, b) => a.order - b.order);
}

export async function saveHomeQuickAccessConfiguration(args: {
  companyId: string;
  input: HomeQuickAccessConfigurationWriteInput;
  db?: typeof prisma;
}): Promise<HomeQuickAccessResolvedConfiguration> {
  const normalized = normalizeWriteInput(args.input);
  const db = args.db ?? prisma;

  await db.$transaction(async (tx: TxClient) => {
    const profile = await tx.homeQuickAccessProfile.upsert({
      where: {
        companyId: args.companyId,
      },
      create: {
        companyId: args.companyId,
      },
      update: {},
      select: {
        id: true,
      },
    });

    await tx.homeQuickAccessCardSetting.deleteMany({
      where: {
        profileId: profile.id,
      },
    });

    await tx.homeQuickAccessCardSetting.createMany({
      data: normalized.map((card) => ({
        profileId: profile.id,
        cardId: card.cardId,
        sortOrder: card.order,
        isVisible: card.isVisible,
      })),
    });
  });

  return mergeHomeQuickAccessConfigurationOverrides({
    base: buildDefaultHomeQuickAccessConfiguration(),
    overrides: normalized.map((item) => ({
      cardId: item.cardId,
      sortOrder: item.order,
      isVisible: item.isVisible,
    })),
  });
}

export async function resetHomeQuickAccessConfiguration(args: {
  companyId: string;
  db?: typeof prisma;
}): Promise<HomeQuickAccessResolvedConfiguration> {
  const db = args.db ?? prisma;

  await db.homeQuickAccessProfile.deleteMany({
    where: {
      companyId: args.companyId,
    },
  });

  return buildDefaultHomeQuickAccessConfiguration();
}