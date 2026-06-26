import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UI_TEXT } from "@/content/ui-text";
import BudgetPage from "./page";

vi.mock("@/server/budget/monthly-overview", () => ({
  getSupabaseBudgetOverview: vi.fn(async (month: "2026-07") => {
    const { buildBudgetOverview, createEmptySnapshot } = await import("@/domain/budget/monthly-view");
    const account = {
      id: "account-a",
      name: "Conta A",
      shortName: "Conta A",
      isCreditCard: false,
      startMonth: "2026-07" as const,
      showInBudget: true,
      includeInNetWorth: true,
      sortOrder: 10,
    };

    return buildBudgetOverview({
      month,
      accounts: [account],
      investmentAssets: [],
      snapshots: [
        {
          ...createEmptySnapshot("account-a"),
          initialBalanceCents: 100_00,
          currentBalanceCents: 100_00,
          finalBalanceCents: 100_00,
        },
      ],
    });
  }),
}));

vi.mock("./actions", () => ({
  addCustomBudgetItemAction: vi.fn(),
  deleteCustomBudgetItemAction: vi.fn(),
  saveMonthlyBudgetAction: vi.fn(),
  setCreditCardStatementOverrideAction: vi.fn(),
  setDirectDebitForecastExclusionAction: vi.fn(),
  setSalaryMonthOverrideAction: vi.fn(),
}));

describe("BudgetPage", () => {
  it("does not render the first month warning", async () => {
    const page = await BudgetPage({
      searchParams: Promise.resolve({ month: "2026-07" }),
    });

    render(page);

    expect(screen.queryByText(UI_TEXT.budget.firstMonthNotice)).toBeNull();
    expect(screen.getByRole("heading", { name: "Julho de 2026" })).toBeTruthy();
  });
});
