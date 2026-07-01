import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BudgetPage from "./page";

vi.mock("@/server/budget/monthly-overview", () => ({
  getSupabaseBudgetOverview: vi.fn(async (month: string) => {
    const { buildBudgetOverview, createEmptySnapshot } = await import("@/domain/budget/monthly-view");
    const { normaliseMonth } = await import("@/domain/budget/months");
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
    const monthId = normaliseMonth(month);

    return buildBudgetOverview({
      month: monthId,
      accounts: [account],
      investmentAssets: [
        {
          id: "core-equity",
          name: "Core Equity",
          startMonth: "2025-01",
          sortOrder: 10,
          monthlyValuesCents: { [monthId]: 10_000_00 },
        },
      ],
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
    expect((screen.getByLabelText("Mês") as HTMLInputElement).value).toBe("2026-09");
    expect(screen.getByRole("link", { name: "Mês actual" }).getAttribute("href")).toBe(
      "/orcamento?month=2026-09",
    );
  });

  it("keeps selector, heading and navigation links synchronized with the selected month", async () => {
    const page = await BudgetPage({
      searchParams: Promise.resolve({ month: "2026-08" }),
    });

    render(page);

    expect(screen.getByRole("heading", { name: "Agosto de 2026" })).toBeTruthy();
    expect((screen.getByLabelText("Mês") as HTMLInputElement).value).toBe("2026-08");
    expect(screen.getByRole("link", { name: "Mês anterior" }).getAttribute("href")).toBe(
      "/orcamento?month=2026-07",
    );
    expect(screen.getByRole("link", { name: "Mês seguinte" }).getAttribute("href")).toBe(
      "/orcamento?month=2026-09",
    );
  });

  it("keeps the current-month shortcut synchronized with the selector after navigation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T10:00:00.000Z"));

    const { rerender } = render(
      await BudgetPage({
        searchParams: Promise.resolve({ month: "2026-07" }),
      }),
    );

    expect(screen.getByRole("link", { name: "Mês actual" }).getAttribute("href")).toBe(
      "/orcamento?month=2026-09",
    );

    rerender(
      await BudgetPage({
        searchParams: Promise.resolve({ month: "2026-09" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "Setembro de 2026" })).toBeTruthy();
    expect((screen.getByLabelText("Mês") as HTMLInputElement).value).toBe("2026-09");
  });

  it("renders investment valuation cards and net worth from the monthly overview", async () => {
    const page = await BudgetPage({
      searchParams: Promise.resolve({ month: "2026-07" }),
    });

    render(page);

    expect(screen.getAllByText("Investimentos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("10 000,00 €").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Património líquido").length).toBeGreaterThan(0);
    expect(screen.getAllByText("10 100,00 €").length).toBeGreaterThan(0);
  });

  it("does not render or calculate the autonomous IGCP table in the monthly budget", async () => {
    const page = await BudgetPage({
      searchParams: Promise.resolve({ month: "2026-07" }),
    });

    render(page);

    expect(screen.queryByRole("heading", { name: "Juros trimestrais previstos" })).toBeNull();
    expect(screen.queryByText("Juro previsto TRIMESTRAL - líquido de retenção na fonte 28%")).toBeNull();
  });
});
