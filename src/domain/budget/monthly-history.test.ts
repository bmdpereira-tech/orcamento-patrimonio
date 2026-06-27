import { describe, expect, it } from "vitest";
import type { LiquidityAccount } from "./accounts";
import {
  calculateGlobalInvestmentMetrics,
  calculateInvestmentMetrics,
  getMonthEndDate,
  type InvestmentCashFlow,
  type InvestmentValuation,
} from "./investments";
import {
  buildInvestmentXirrHistory,
  buildMonthlyLiquidityHistoryPoints,
  calculateLiquidityHistoryPoint,
  filterMonthsForLiquidityPeriod,
  filterMonthsForHistoryPeriod,
  getLiquidityHistoryMonthsForReferenceMonth,
  getHistoryMonthsUntil,
  getInvestmentAssetsForHistory,
  type InvestmentXirrSeries,
} from "./monthly-history";
import type { MonthId } from "./months";
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
  it("calculates monthly liquidity from total final balance minus total initial balance", () => {
    const overview = buildBudgetOverview({
      month: "2026-07",
      accounts,
      investmentAssets: [],
      snapshots: [
        { ...createEmptySnapshot("bank"), initialBalanceCents: 100_00, finalBalanceCents: 135_00 },
        { ...createEmptySnapshot("investment-cash"), initialBalanceCents: 50_00, finalBalanceCents: 35_00 },
      ],
    });

    expect(calculateLiquidityHistoryPoint(overview)).toEqual({
      month: "2026-07",
      saldoInicialTotalCents: 150_00,
      saldoFinalTotalCents: 170_00,
      variacaoMensalCents: 20_00,
    });
  });

  it("lists available history months up to the current month and handles insufficient data", () => {
    expect(getHistoryMonthsUntil("2026-10", "2026-07")).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
    expect(getHistoryMonthsUntil("2026-06", "2026-07")).toEqual([]);
  });

  it("filters history periods for 12 months, YTD and current year", () => {
    const months = getHistoryMonthsUntil("2026-10", "2025-09");

    expect(filterMonthsForHistoryPeriod(months, "last-12", "2026-10")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
    expect(filterMonthsForHistoryPeriod(months, "ytd", "2026-10")).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
    expect(filterMonthsForHistoryPeriod(months, "current-year", "2026-10")).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
    expect(filterMonthsForHistoryPeriod(["2026-09", "2026-10"], "last-12", "2026-10")).toEqual([
      "2026-09",
      "2026-10",
    ]);
  });

  it("builds liquidity ranges from the selected reference month, including future months", () => {
    const months = getLiquidityHistoryMonthsForReferenceMonth("2027-07");

    expect(filterMonthsForLiquidityPeriod(months, "last-12", "2027-07")).toEqual([
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
      "2027-03",
      "2027-04",
      "2027-05",
      "2027-06",
      "2027-07",
    ]);
    expect(filterMonthsForLiquidityPeriod(months, "ytd", "2027-07")).toEqual([
      "2027-01",
      "2027-02",
      "2027-03",
      "2027-04",
      "2027-05",
      "2027-06",
      "2027-07",
    ]);
    expect(filterMonthsForLiquidityPeriod(months, "current-year", "2027-07")).toEqual([
      "2027-01",
      "2027-02",
      "2027-03",
      "2027-04",
      "2027-05",
      "2027-06",
      "2027-07",
      "2027-08",
      "2027-09",
      "2027-10",
      "2027-11",
      "2027-12",
    ]);
  });

  it("never includes liquidity months before the budget first month", () => {
    const months = getLiquidityHistoryMonthsForReferenceMonth("2026-08");

    expect(filterMonthsForLiquidityPeriod(months, "last-12", "2026-08")).toEqual(["2026-07", "2026-08"]);
    expect(filterMonthsForLiquidityPeriod(months, "current-year", "2026-08")[0]).toBe("2026-07");
  });

  it("builds monthly liquidity series in chronological order with positive and negative bars", () => {
    const july = buildBudgetOverview({
      month: "2026-07",
      accounts,
      investmentAssets: [],
      snapshots: [
        { ...createEmptySnapshot("bank"), initialBalanceCents: 100_00, finalBalanceCents: 80_00 },
        { ...createEmptySnapshot("investment-cash"), initialBalanceCents: 50_00, finalBalanceCents: 40_00 },
      ],
    });
    const august = buildBudgetOverview({
      month: "2026-08",
      accounts,
      investmentAssets: [],
      snapshots: [
        { ...createEmptySnapshot("bank"), initialBalanceCents: 80_00, finalBalanceCents: 125_00 },
        { ...createEmptySnapshot("investment-cash"), initialBalanceCents: 40_00, finalBalanceCents: 50_00 },
      ],
    });

    expect(buildMonthlyLiquidityHistoryPoints([august, july]).map((point) => point.variacaoMensalCents)).toEqual([
      -30_00,
      55_00,
    ]);
  });

  it("keeps future liquidity points when the budget overview can calculate them", () => {
    const future = buildBudgetOverview({
      month: "2027-03",
      accounts,
      investmentAssets: [],
      snapshots: [
        { ...createEmptySnapshot("bank"), initialBalanceCents: 100_00, finalBalanceCents: 130_00 },
        { ...createEmptySnapshot("investment-cash"), initialBalanceCents: 50_00, finalBalanceCents: 75_00 },
      ],
    });

    expect(buildMonthlyLiquidityHistoryPoints([future])).toEqual([
      {
        month: "2027-03",
        saldoInicialTotalCents: 150_00,
        saldoFinalTotalCents: 205_00,
        variacaoMensalCents: 55_00,
      },
    ]);
  });
});

const investmentAssets = [
  {
    id: "core-equity",
    name: "Core Equity",
    startMonth: "2026-01" as MonthId,
    sortOrder: 10,
  },
  {
    id: "archived-growth",
    name: "Growth arquivado",
    startMonth: "2026-01" as MonthId,
    archivedFromMonth: "2026-02" as MonthId,
    sortOrder: 20,
  },
  {
    id: "empty-active",
    name: "Activo sem dados",
    startMonth: "2026-01" as MonthId,
    sortOrder: 30,
  },
];
const investmentCashFlows: InvestmentCashFlow[] = [
  {
    investmentAssetId: "core-equity",
    flowType: "contribution",
    flowDate: "2026-01-01",
    amountCents: 1_000_00,
  },
  {
    investmentAssetId: "archived-growth",
    flowType: "contribution",
    flowDate: "2026-01-15",
    amountCents: 500_00,
  },
];
const investmentValuations: InvestmentValuation[] = [
  {
    investmentAssetId: "core-equity",
    valuationDate: "2026-01-31",
    marketValueCents: 1_050_00,
  },
  {
    investmentAssetId: "core-equity",
    valuationDate: "2026-03-31",
    marketValueCents: 1_300_00,
  },
  {
    investmentAssetId: "archived-growth",
    valuationDate: "2026-02-28",
    marketValueCents: 610_00,
  },
];

function getSeries(historySeries: readonly InvestmentXirrSeries[], id: string) {
  const series = historySeries.find((candidate) => candidate.id === id);

  if (!series) {
    throw new Error(`Missing series ${id}.`);
  }

  return series;
}

function getSeriesPoint(series: InvestmentXirrSeries, month: MonthId) {
  const point = series.points.find((candidate) => candidate.month === month);

  if (!point) {
    throw new Error(`Missing point ${month}.`);
  }

  return point.xirr;
}

describe("monthly investment XIRR history", () => {
  it("keeps active investments and archived investments with history", () => {
    expect(
      getInvestmentAssetsForHistory({
        assets: investmentAssets,
        cashFlows: investmentCashFlows,
        valuations: investmentValuations,
        currentMonth: "2026-03",
      }).map((asset) => asset.id),
    ).toEqual(["core-equity", "archived-growth", "empty-active"]);
  });

  it("builds monthly XIRR series by investment and excludes future valuations", () => {
    const history = buildInvestmentXirrHistory({
      assets: investmentAssets,
      cashFlows: investmentCashFlows,
      valuations: investmentValuations,
      currentMonth: "2026-03",
    });
    const coreSeries = getSeries(history.series, "core-equity");
    const februaryXirr = getSeriesPoint(coreSeries, "2026-02");
    const expectedFebruaryXirr = calculateInvestmentMetrics({
      investmentAssetId: "core-equity",
      cashFlows: investmentCashFlows,
      valuations: investmentValuations,
      asOfDate: getMonthEndDate("2026-02"),
    }).xirr;
    const marchXirr = getSeriesPoint(coreSeries, "2026-03");

    expect(history.months).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(februaryXirr).toBe(expectedFebruaryXirr);
    expect(marchXirr).not.toBe(februaryXirr);
  });

  it("uses gaps when an investment does not have enough data for XIRR", () => {
    const history = buildInvestmentXirrHistory({
      assets: investmentAssets,
      cashFlows: investmentCashFlows,
      valuations: investmentValuations,
      currentMonth: "2026-03",
    });

    expect(getSeriesPoint(getSeries(history.series, "archived-growth"), "2026-01")).toBeNull();
    expect(getSeriesPoint(getSeries(history.series, "empty-active"), "2026-03")).toBeNull();
  });

  it("builds the global XIRR series from all flows and latest eligible valuations", () => {
    const history = buildInvestmentXirrHistory({
      assets: investmentAssets,
      cashFlows: investmentCashFlows,
      valuations: investmentValuations,
      currentMonth: "2026-03",
    });
    const expectedGlobalXirr = calculateGlobalInvestmentMetrics({
      investmentAssetIds: investmentAssets.map((asset) => asset.id),
      cashFlows: investmentCashFlows,
      valuations: investmentValuations,
      asOfDate: getMonthEndDate("2026-03"),
    }).xirr;

    expect(getSeriesPoint(getSeries(history.series, "global"), "2026-03")).toBe(expectedGlobalXirr);
  });
});
