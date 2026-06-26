import { describe, expect, it } from "vitest";
import type { InvestmentAsset, LiquidityAccount } from "@/domain/budget/accounts";
import { calculateInvestmentTotal, buildBudgetOverview, createEmptySnapshot } from "@/domain/budget/monthly-view";
import { attachInvestmentValuationsForMonth } from "./monthly-overview";

const investmentAssets: InvestmentAsset[] = [
  {
    id: "core-equity",
    name: "Core Equity",
    startMonth: "2025-01",
    sortOrder: 10,
  },
  {
    id: "growth-tech",
    name: "Growth Tech",
    startMonth: "2025-01",
    sortOrder: 20,
  },
];

const valuations = [
  {
    investmentAssetId: "core-equity",
    valuationDate: "2026-07-20",
    marketValueCents: 10_000_00,
  },
  {
    investmentAssetId: "core-equity",
    valuationDate: "2026-08-01",
    marketValueCents: 11_000_00,
  },
  {
    investmentAssetId: "growth-tech",
    valuationDate: "2026-07-31",
    marketValueCents: 5_000_00,
  },
];

describe("Supabase monthly overview investment valuations", () => {
  it("uses July valuations in July and excludes valuations after the month end", () => {
    const assets = attachInvestmentValuationsForMonth({
      assets: investmentAssets,
      valuations,
      month: "2026-07",
    });

    expect(calculateInvestmentTotal(assets, "2026-07")).toBe(15_000_00);
  });

  it("carries the latest eligible valuation into following months and sums several investments", () => {
    const assets = attachInvestmentValuationsForMonth({
      assets: investmentAssets,
      valuations,
      month: "2026-08",
    });

    expect(calculateInvestmentTotal(assets, "2026-08")).toBe(16_000_00);
  });

  it("keeps investment cash accounts outside the investment valuation total and avoids duplicate net worth", () => {
    const t212Cash: LiquidityAccount = {
      id: "t212-cash",
      name: "T212 Cash",
      accountType: "investment_cash",
      isCreditCard: false,
      startMonth: "2026-07",
      includeInNetWorth: true,
      showInBudget: true,
      sortOrder: 10,
    };
    const assets = attachInvestmentValuationsForMonth({
      assets: investmentAssets.slice(0, 1),
      valuations,
      month: "2026-07",
    });
    const overview = buildBudgetOverview({
      month: "2026-07",
      accounts: [t212Cash],
      investmentAssets: assets,
      snapshots: [{ ...createEmptySnapshot("t212-cash"), finalBalanceCents: 2_500_00 }],
    });

    expect(overview.investmentTotalCents).toBe(10_000_00);
    expect(overview.netWorthCents).toBe(12_500_00);
  });
});
