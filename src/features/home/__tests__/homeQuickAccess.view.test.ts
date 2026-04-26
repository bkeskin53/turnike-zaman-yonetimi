import { describe, expect, it } from "vitest";
import {
  buildDefaultHomeQuickAccessConfiguration,
  buildHomeQuickAccessCardsForView,
} from "../homeQuickAccess";

describe("homeQuickAccess view cards", () => {
  it("always appends the manage CTA card at the end", () => {
    const baseCards = buildDefaultHomeQuickAccessConfiguration()
      .cards
      .slice(0, 2)
      .map(({ order: _order, isVisible: _isVisible, ...card }) => card);

    const cards = buildHomeQuickAccessCardsForView({
      cards: baseCards,
      manageHref: "/admin/configuration?page=home#home-quick-access-cards",
    });

    expect(cards).toHaveLength(3);
    expect(cards[0]?.id).toBe(baseCards[0]?.id);
    expect(cards[1]?.id).toBe(baseCards[1]?.id);
    expect(cards[2]).toMatchObject({
      kind: "manage",
      id: "manage-home-quick-access",
      href: "/admin/configuration?page=home#home-quick-access-cards",
    });
  });

  it("still returns the manage CTA when all runtime cards are hidden", () => {
    const cards = buildHomeQuickAccessCardsForView({
      cards: [],
      manageHref: "/admin/configuration?page=home#home-quick-access-cards",
    });

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      kind: "manage",
      id: "manage-home-quick-access",
    });
  });
});