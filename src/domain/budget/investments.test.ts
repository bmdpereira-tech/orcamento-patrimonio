import { describe, expect, it } from "vitest";
import {
  calculateGlobalInvestmentMetrics,
  calculateInvestmentMetrics,
  calculateInvestmentValueTotal,
  calculateInvestmentValueTotalForMonth,
  calculateXirr,
  getInvestmentValueForMonth,
  getLatestEligibleInvestmentValuation,
  getSignedInvestmentCashFlowAmount,
  type InvestmentCashFlow,
  type InvestmentCashFlowType,
  type InvestmentValuation,
} from "./investments";

function cashFlow(
  investmentAssetId: string,
  flowType: InvestmentCashFlowType,
  flowDate: string,
  amountCents: number,
): InvestmentCashFlow {
  return {
    investmentAssetId,
    flowType,
    flowDate,
    amountCents,
  };
}

function valuation(
  investmentAssetId: string,
  valuationDate: string,
  marketValueCents: number,
): InvestmentValuation {
  return {
    investmentAssetId,
    valuationDate,
    marketValueCents,
  };
}

describe("investment domain", () => {
  it("stores amounts as positive and signs contributions and redemptions only in the domain", () => {
    expect(getSignedInvestmentCashFlowAmount(cashFlow("fund-a", "contribution", "2026-07-01", 100_00))).toBe(-100_00);
    expect(getSignedInvestmentCashFlowAmount(cashFlow("fund-a", "redemption", "2026-08-01", 40_00))).toBe(40_00);
  });

  it("aggregates several contributions and calculates net invested capital", () => {
    const metrics = calculateInvestmentMetrics({
      investmentAssetId: "fund-a",
      cashFlows: [
        cashFlow("fund-a", "contribution", "2026-07-01", 600_00),
        cashFlow("fund-a", "contribution", "2026-08-01", 400_00),
      ],
      valuations: [valuation("fund-a", "2026-08-31", 1_050_00)],
      asOfDate: "2026-08-31",
    });

    expect(metrics.totalContributedCents).toBe(1_000_00);
    expect(metrics.totalRedeemedCents).toBe(0);
    expect(metrics.netInvestedCents).toBe(1_000_00);
    expect(metrics.gainLossCents).toBe(50_00);
  });

  it("handles a partial redemption in capital, gain/loss and simple return", () => {
    const metrics = calculateInvestmentMetrics({
      investmentAssetId: "fund-a",
      cashFlows: [
        cashFlow("fund-a", "contribution", "2026-07-01", 1_000_00),
        cashFlow("fund-a", "redemption", "2026-09-01", 200_00),
      ],
      valuations: [valuation("fund-a", "2026-09-30", 900_00)],
      asOfDate: "2026-09-30",
    });

    expect(metrics.totalRedeemedCents).toBe(200_00);
    expect(metrics.netInvestedCents).toBe(800_00);
    expect(metrics.gainLossCents).toBe(100_00);
    expect(metrics.simpleReturn).toBeCloseTo(0.1, 6);
  });

  it("handles a full redemption safely", () => {
    const metrics = calculateInvestmentMetrics({
      investmentAssetId: "fund-a",
      cashFlows: [
        cashFlow("fund-a", "contribution", "2026-07-01", 1_000_00),
        cashFlow("fund-a", "redemption", "2027-07-01", 1_000_00),
      ],
      valuations: [valuation("fund-a", "2027-07-01", 0)],
      asOfDate: "2027-07-01",
    });

    expect(metrics.netInvestedCents).toBe(0);
    expect(metrics.gainLossCents).toBe(0);
    expect(metrics.simpleReturn).toBe(0);
    expect(metrics.xirr).toBeCloseTo(0, 6);
  });

  it("uses only cash flows up to the calculation date", () => {
    const metrics = calculateInvestmentMetrics({
      investmentAssetId: "fund-a",
      cashFlows: [
        cashFlow("fund-a", "contribution", "2026-07-01", 1_000_00),
        cashFlow("fund-a", "redemption", "2026-08-15", 150_00),
        cashFlow("fund-a", "redemption", "2026-10-01", 250_00),
      ],
      valuations: [valuation("fund-a", "2026-08-31", 950_00)],
      asOfDate: "2026-08-31",
    });

    expect(metrics.totalContributedCents).toBe(1_000_00);
    expect(metrics.totalRedeemedCents).toBe(150_00);
  });

  it("calculates annualized XIRR with partial redemptions", () => {
    const metrics = calculateInvestmentMetrics({
      investmentAssetId: "fund-a",
      cashFlows: [
        cashFlow("fund-a", "contribution", "2026-07-01", 1_000_00),
        cashFlow("fund-a", "redemption", "2027-01-01", 200_00),
      ],
      valuations: [valuation("fund-a", "2027-07-01", 950_00)],
      asOfDate: "2027-07-01",
    });

    expect(metrics.xirr).not.toBeNull();
    expect(metrics.xirr ?? 0).toBeGreaterThan(0.1);
    expect(metrics.xirr ?? 0).toBeLessThan(0.25);
  });

  it("uses 2025 contributions, redemptions and valuations while excluding valuations after the reference date", () => {
    const metrics = calculateInvestmentMetrics({
      investmentAssetId: "fund-a",
      cashFlows: [
        cashFlow("fund-a", "contribution", "2025-01-10", 1_000_00),
        cashFlow("fund-a", "redemption", "2025-10-10", 200_00),
      ],
      valuations: [
        valuation("fund-a", "2025-12-31", 950_00),
        valuation("fund-a", "2026-07-01", 5_000_00),
      ],
      asOfDate: "2026-06-26",
    });

    expect(metrics.totalContributedCents).toBe(1_000_00);
    expect(metrics.totalRedeemedCents).toBe(200_00);
    expect(metrics.netInvestedCents).toBe(800_00);
    expect(metrics.latestValuation?.valuationDate).toBe("2025-12-31");
    expect(metrics.marketValueCents).toBe(950_00);
    expect(metrics.gainLossCents).toBe(150_00);
    expect(metrics.simpleReturn).toBeCloseTo(0.15, 6);
    expect(metrics.xirr).not.toBeNull();
  });

  it("returns null for XIRR when flows are insufficient or have no mathematical solution", () => {
    expect(calculateXirr([{ date: "2026-07-01", amountCents: -100_00 }])).toBeNull();
    expect(
      calculateXirr([
        { date: "2026-07-01", amountCents: -100_00 },
        { date: "2026-07-01", amountCents: 110_00 },
      ]),
    ).toBeNull();
  });

  it("finds the latest eligible valuation and excludes future valuations", () => {
    const valuations = [
      valuation("fund-a", "2026-07-20", 1_000_00),
      valuation("fund-a", "2026-08-05", 1_100_00),
      valuation("fund-a", "2026-09-01", 1_300_00),
    ];

    expect(getLatestEligibleInvestmentValuation("fund-a", valuations, "2026-08-31")?.marketValueCents).toBe(
      1_100_00,
    );
    expect(getLatestEligibleInvestmentValuation("fund-a", valuations, "2026-07-10")).toBeNull();
  });

  it("carries a valuation into following months until a newer one exists", () => {
    const valuations = [
      valuation("fund-a", "2026-07-20", 1_000_00),
      valuation("fund-a", "2026-09-01", 1_300_00),
    ];

    expect(getInvestmentValueForMonth("fund-a", valuations, "2026-07")?.marketValueCents).toBe(1_000_00);
    expect(getInvestmentValueForMonth("fund-a", valuations, "2026-08")?.marketValueCents).toBe(1_000_00);
    expect(getInvestmentValueForMonth("fund-a", valuations, "2026-09")?.marketValueCents).toBe(1_300_00);
  });

  it("marks missing valuations without assuming zero", () => {
    const total = calculateInvestmentValueTotal(["fund-a", "fund-b"], [valuation("fund-a", "2026-07-20", 1_000_00)], "2026-07-31");

    expect(total.totalMarketValueCents).toBeNull();
    expect(total.missingValuationAssetIds).toEqual(["fund-b"]);
    expect(total.snapshots).toContainEqual({
      investmentAssetId: "fund-b",
      valuation: null,
      marketValueCents: null,
    });
  });

  it("handles no contributions and zero total contributed safely", () => {
    const metrics = calculateInvestmentMetrics({
      investmentAssetId: "fund-a",
      cashFlows: [cashFlow("fund-a", "redemption", "2026-08-01", 100_00)],
      valuations: [valuation("fund-a", "2026-08-31", 500_00)],
      asOfDate: "2026-08-31",
    });

    expect(metrics.totalContributedCents).toBe(0);
    expect(metrics.gainLossCents).toBe(600_00);
    expect(metrics.simpleReturn).toBeNull();
    expect(metrics.xirr).toBeNull();
  });

  it("keeps asset valuations separate from investment_cash account balances", () => {
    const investmentCashBalanceCents = 750_00;
    const total = calculateInvestmentValueTotalForMonth(
      ["fund-a"],
      [valuation("fund-a", "2026-07-20", 1_000_00)],
      "2026-08",
    );

    expect(investmentCashBalanceCents).toBe(750_00);
    expect(total.totalMarketValueCents).toBe(1_000_00);
  });

  it("calculates global metrics across multiple investments", () => {
    const metrics = calculateGlobalInvestmentMetrics({
      investmentAssetIds: ["fund-a", "fund-b"],
      cashFlows: [
        cashFlow("fund-a", "contribution", "2026-07-01", 1_000_00),
        cashFlow("fund-a", "redemption", "2026-10-01", 100_00),
        cashFlow("fund-b", "contribution", "2026-08-01", 500_00),
      ],
      valuations: [
        valuation("fund-a", "2026-12-31", 1_050_00),
        valuation("fund-b", "2026-12-15", 550_00),
      ],
      asOfDate: "2026-12-31",
    });

    expect(metrics.totalContributedCents).toBe(1_500_00);
    expect(metrics.totalRedeemedCents).toBe(100_00);
    expect(metrics.netInvestedCents).toBe(1_400_00);
    expect(metrics.marketValueCents).toBe(1_600_00);
    expect(metrics.gainLossCents).toBe(200_00);
    expect(metrics.simpleReturn).toBeCloseTo(200_00 / 1_500_00, 6);
    expect(metrics.xirr).not.toBeNull();
  });
});
