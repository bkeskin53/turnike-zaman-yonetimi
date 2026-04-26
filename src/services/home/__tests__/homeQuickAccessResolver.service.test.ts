import { describe, expect, it, vi } from "vitest";
import { buildDefaultHomeQuickAccessConfiguration } from "@/src/features/home/homeQuickAccess";
import { resolveVisibleHomeQuickAccessCards } from "../homeQuickAccessResolver.service";

describe("homeQuickAccessResolver", () => {
  it("filters hidden and inaccessible cards while preserving configured order", async () => {
    const base = buildDefaultHomeQuickAccessConfiguration();
    const cards = base.cards.map((card, index) => ({
      cardId: card.id,
      sortOrder: index,
      isVisible: true,
    }));

    cards[0] = { cardId: "monthly-payroll", sortOrder: 0, isVisible: true };
    cards[1] = { cardId: "employee-import", sortOrder: 1, isVisible: true };
    cards[2] = { cardId: "employees", sortOrder: 2, isVisible: false };

    const resolved = await resolveVisibleHomeQuickAccessCards({
      companyId: "company_1",
      role: "HR_OPERATOR",
      canAccessEmployeeImport: false,
      db: {
        homeQuickAccessProfile: {
          findUnique: vi.fn().mockResolvedValue({
            cards,
          }),
        },
      } as never,
    });

    expect(resolved.some((card) => card.id === "employee-import")).toBe(false);
    expect(resolved.some((card) => card.id === "employees")).toBe(false);
    expect(resolved[0]?.id).toBe("monthly-payroll");
  });
});