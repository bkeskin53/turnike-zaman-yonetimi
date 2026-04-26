import { describe, expect, it, vi } from "vitest";
import {
  buildDefaultHomeQuickAccessConfiguration,
  parseHomeQuickAccessCardId,
} from "@/src/features/home/homeQuickAccess";
import {
  mergeHomeQuickAccessConfigurationOverrides,
  resolveHomeQuickAccessConfiguration,
} from "../homeQuickAccessConfiguration.service";

describe("homeQuickAccessConfiguration", () => {
  it("resolves default configuration when company override is missing", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);

    const resolved = await resolveHomeQuickAccessConfiguration({
      companyId: "company_1",
      db: {
        homeQuickAccessProfile: {
          findUnique,
        },
      } as never,
    });

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        companyId: "company_1",
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

    expect(resolved).toEqual(buildDefaultHomeQuickAccessConfiguration());
  });

  it("merges saved visibility and order onto defaults", async () => {
    const resolved = await resolveHomeQuickAccessConfiguration({
      companyId: "company_1",
      db: {
        homeQuickAccessProfile: {
          findUnique: vi.fn().mockResolvedValue({
            cards: [
              { cardId: "dashboard", sortOrder: 0, isVisible: true },
              { cardId: "employees", sortOrder: 4, isVisible: false },
            ],
          }),
        },
      } as never,
    });

    expect(resolved.cards[0].id).toBe("dashboard");
    expect(
      resolved.cards.find((card) => card.id === "employees")?.isVisible,
    ).toBe(false);
    expect(resolved.cards.map((card) => card.order)).toEqual(
      resolved.cards.map((_, index) => index),
    );
  });

  it("rejects invalid card ids", () => {
    expect(() => parseHomeQuickAccessCardId("unknown-card")).toThrow(
      "INVALID_HOME_QUICK_ACCESS_CARD_ID",
    );
  });

  it("ignores invalid override rows during merge", () => {
    const resolved = mergeHomeQuickAccessConfigurationOverrides({
      overrides: [
        { cardId: "dashboard", sortOrder: 0, isVisible: true },
        { cardId: "unknown-card", sortOrder: 1, isVisible: false },
      ],
    });

    expect(resolved.cards[0].id).toBe("dashboard");
    expect(
      resolved.cards.some((card) => card.id === ("unknown-card" as never)),
    ).toBe(false);
  });
});