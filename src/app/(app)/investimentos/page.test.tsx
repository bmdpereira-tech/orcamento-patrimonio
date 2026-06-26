import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import InvestmentsPage from "./page";

vi.mock("@/server/budget/investments", () => ({
  listInvestmentOverview: vi.fn(async () => ({
    asOfDate: "2026-06-26",
    assets: [],
    globalMetrics: {
      investmentAssetId: "global",
      totalContributedCents: 0,
      totalRedeemedCents: 0,
      netInvestedCents: 0,
      latestValuation: null,
      marketValueCents: null,
      gainLossCents: null,
      simpleReturn: null,
      xirr: null,
    },
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("./actions", () => ({
  archiveInvestmentAssetAction: vi.fn(),
  createInvestmentAssetAction: vi.fn(),
  createInvestmentCashFlowAction: vi.fn(),
  createInvestmentValuationAction: vi.fn(),
  deleteInvestmentAssetAction: vi.fn(),
  deleteInvestmentCashFlowAction: vi.fn(),
  deleteInvestmentValuationAction: vi.fn(),
  reactivateInvestmentAssetAction: vi.fn(),
  updateInvestmentAssetAction: vi.fn(),
  updateInvestmentCashFlowAction: vi.fn(),
  updateInvestmentValuationAction: vi.fn(),
}));

afterEach(() => {
  vi.useRealTimers();
});

describe("InvestmentsPage", () => {
  it("opens in June 2026 without applying the budget first-month validation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-26T10:00:00.000Z"));

    render(await InvestmentsPage());

    expect(screen.getByRole("heading", { name: "Activos" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Resumo global" })).toBeTruthy();
    expect(screen.queryByText("O resumo deve ser igual ou posterior a Julho de 2026.")).toBeNull();
  });
});
