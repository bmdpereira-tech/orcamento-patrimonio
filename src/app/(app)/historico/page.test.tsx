import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HistoryPage from "./page";

const mocks = vi.hoisted(() => ({
  getSupabaseHistoryDashboard: vi.fn(async () => ({
    currentMonth: "2026-06",
    liquidity: {
      referenceMonth: "2026-07",
      months: [],
      points: [],
    },
    investments: {
      months: [],
      series: [],
    },
  })),
}));

vi.mock("@/server/budget/monthly-history", () => ({
  getSupabaseHistoryDashboard: mocks.getSupabaseHistoryDashboard,
}));

vi.mock("@/components/history-dashboard", () => ({
  HistoryDashboard: ({ liquidity }: { liquidity: { referenceMonth: string } }) => (
    <div>Referência da liquidez: {liquidity.referenceMonth}</div>
  ),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("HistoryPage", () => {
  it("uses the current month normalised to the first budget month by default", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-27T10:00:00.000Z"));

    render(await HistoryPage({ searchParams: Promise.resolve({}) }));

    expect(mocks.getSupabaseHistoryDashboard).toHaveBeenCalledWith({
      currentMonth: "2026-06",
      liquidityReferenceMonth: "2026-07",
    });
    expect(screen.getByText("Referência da liquidez: 2026-07")).toBeTruthy();
  });

  it("passes the selected future liquidity month to the dashboard service", async () => {
    await HistoryPage({ searchParams: Promise.resolve({ liquidityMonth: "2027-07" }) });

    expect(mocks.getSupabaseHistoryDashboard).toHaveBeenCalledWith({
      currentMonth: expect.any(String),
      liquidityReferenceMonth: "2027-07",
    });
  });
});
