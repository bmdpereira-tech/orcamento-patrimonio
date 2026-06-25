import { describe, expect, it } from "vitest";
import type { LiquidityAccount } from "./accounts";
import {
  buildMonthlyHistoryRows,
  calculateMonthlyVariation,
  getPastMonthsUntil,
  isInvestmentAccount,
  isLiquidityHistoryAccount,
} from "./monthly-history";
import { buildBudgetOverview, createEmptySnapshot } from "./monthly-view";

const accounts: LiquidityAccount[] = [
  {
    id: "bank",
    name: "Banco",
    accountType: "bank_account",
    isCreditCard: false,
    startMonth: "2026-07",
    sortOrder: 10,
  },
  {
    id: "investment-cash",
    name: "Investimento",
    accountType: "investment_cash",
    isCreditCard: false,
    startMonth: "2026-07",
    sortOrder: 20,
  },
];

describe("monthly history", () => {
  it("calculates monthly liquidity variation with account signs", () => {
    expect(
      calculateMonthlyVariation(
        accounts,
        [
          { ...createEmptySnapshot("bank"), initialBalanceCents: 100_00, finalBalanceCents: 80_00 },
          { ...createEmptySnapshot("investment-cash"), initialBalanceCents: 50_00, finalBalanceCents: 90_00 },
        ],
        isLiquidityHistoryAccount,
      ),
    ).toBe(-20_00);
  });

  it("calculates monthly investment variation from investment accounts only", () => {
    expect(
      calculateMonthlyVariation(
        accounts,
        [
          { ...createEmptySnapshot("bank"), initialBalanceCents: 100_00, finalBalanceCents: 80_00 },
          { ...createEmptySnapshot("investment-cash"), initialBalanceCents: 50_00, finalBalanceCents: 90_00 },
        ],
        isInvestmentAccount,
      ),
    ).toBe(40_00);
  });

  it("lists past months from most recent to oldest and excludes the current month", () => {
    expect(getPastMonthsUntil("2026-10")).toEqual(["2026-09", "2026-08", "2026-07"]);
  });

  it("sorts history rows newest first and excludes the current month", () => {
    const july = buildBudgetOverview({
      month: "2026-07",
      accounts,
      investmentAssets: [],
      snapshots: [
        { ...createEmptySnapshot("bank"), initialBalanceCents: 100_00, finalBalanceCents: 80_00 },
        { ...createEmptySnapshot("investment-cash"), initialBalanceCents: 50_00, finalBalanceCents: 90_00 },
      ],
    });
    const august = buildBudgetOverview({
      month: "2026-08",
      accounts,
      investmentAssets: [],
      snapshots: [
        { ...createEmptySnapshot("bank"), initialBalanceCents: 80_00, finalBalanceCents: 85_00 },
        { ...createEmptySnapshot("investment-cash"), initialBalanceCents: 90_00, finalBalanceCents: 95_00 },
      ],
    });
    const september = buildBudgetOverview({
      month: "2026-09",
      accounts,
      investmentAssets: [],
      snapshots: [createEmptySnapshot("bank"), createEmptySnapshot("investment-cash")],
    });

    expect(buildMonthlyHistoryRows([july, september, august], "2026-09").map((row) => row.month)).toEqual([
      "2026-08",
      "2026-07",
    ]);
  });
});
