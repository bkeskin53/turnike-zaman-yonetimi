import { describe, expect, it, vi } from "vitest";
import {
  buildDefaultHomeQuickAccessConfiguration,
  HOME_QUICK_ACCESS_CARD_IDS,
} from "@/src/features/home/homeQuickAccess";
import {
  type HomeQuickAccessConfigurationWriteInput,
  resetHomeQuickAccessConfiguration,
  saveHomeQuickAccessConfiguration,
} from "../homeQuickAccessConfigurationMutation.service";

function buildValidCards(): HomeQuickAccessConfigurationWriteInput["cards"] {
  return buildDefaultHomeQuickAccessConfiguration().cards.map((card, index) => ({
    cardId: card.id,
    isVisible: true,
    order: index,
  }));
}

describe("homeQuickAccessConfigurationMutation", () => {
  it("rejects invalid card ids", async () => {
    const cards = buildValidCards();
    cards[0] = {
      cardId: "unknown-card",
      isVisible: true,
      order: 0,
    };

    await expect(
      saveHomeQuickAccessConfiguration({
        companyId: "company_1",
        input: { cards },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_HOME_QUICK_ACCESS_CARD_ID",
    });
  });

  it("rejects invalid order and incomplete sets", async () => {
    await expect(
      saveHomeQuickAccessConfiguration({
        companyId: "company_1",
        input: {
          cards: buildValidCards()
            .slice(0, HOME_QUICK_ACCESS_CARD_IDS.length - 1)
            .map((card, index) => ({
              ...card,
              order: index,
            })),
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_HOME_QUICK_ACCESS_CARD_SET",
    });

    const cards = buildValidCards();
    cards[1] = {
      ...cards[1],
      order: 0,
    };

    await expect(
      saveHomeQuickAccessConfiguration({
        companyId: "company_1",
        input: { cards },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_HOME_QUICK_ACCESS_CARD_ORDER",
    });
  });

  it("saves the exact card sequence and visibility set", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "profile_1" });
    const deleteMany = vi.fn().mockResolvedValue({ count: 8 });
    const createMany = vi.fn().mockResolvedValue({ count: 8 });
    const transaction = vi.fn(async (callback) =>
      callback({
        homeQuickAccessProfile: { upsert },
        homeQuickAccessCardSetting: { deleteMany, createMany },
      }),
    );

    const cards = buildValidCards();
    cards[0] = { ...cards[0], cardId: "dashboard", order: 0 };
    cards[4] = { ...cards[4], cardId: "employees", order: 4, isVisible: false };

    const resolved = await saveHomeQuickAccessConfiguration({
      companyId: "company_1",
      input: { cards },
      db: {
        $transaction: transaction,
      } as never,
    });

    expect(upsert).toHaveBeenCalledWith({
      where: {
        companyId: "company_1",
      },
      create: {
        companyId: "company_1",
      },
      update: {},
      select: {
        id: true,
      },
    });

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        profileId: "profile_1",
      },
    });

    expect(createMany).toHaveBeenCalled();
    expect(resolved.cards[0].id).toBe("dashboard");
    expect(
      resolved.cards.find((card) => card.id === "employees")?.isVisible,
    ).toBe(false);
  });

  it("resets by removing company profile", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });

    const resolved = await resetHomeQuickAccessConfiguration({
      companyId: "company_1",
      db: {
        homeQuickAccessProfile: {
          deleteMany,
        },
      } as never,
    });

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        companyId: "company_1",
      },
    });
    expect(resolved).toEqual(buildDefaultHomeQuickAccessConfiguration());
  });
});