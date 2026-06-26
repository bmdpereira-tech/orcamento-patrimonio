import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BudgetPage from "./page";

vi.mock("@/server/budget/monthly-overview", () => ({
  getSupabaseBudgetOverview: vi.fn(async (month: "2026-07" | "2026-09") => {
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

afterEach(() => {
  vi.useRealTimers();
});

describe("BudgetPage", () => {
  it("does not render the first month warning", async () => {
    const page = await BudgetPage({
      searchParams: Promise.resolve({ month: "2026-07" }),
    });

    render(page);

    expect(
      screen.queryByText("Julho de 2026 é o primeiro mês disponível. Os saldos iniciais serão introduzidos manualmente."),
    ).toBeNull();
    expect(screen.getByRole("heading", { name: "Julho de 2026" })).toBeTruthy();
  });

  it("opens the current Lisbon month by default and links the shortcut to it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T10:00:00.000Z"));

    const page = await BudgetPage({
      searchParams: Promise.resolve({}),
    });

    render(page);

    expect(screen.getByRole("heading", { name: "Setembro de 2026" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Mês actual" }).getAttribute("href")).toBe(
      "/orcamento?month=2026-09",
    );
  });
});
