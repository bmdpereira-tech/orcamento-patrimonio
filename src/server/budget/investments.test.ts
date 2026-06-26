import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteInvestmentAssetWhenAllowed, listInvestmentOverview } from "./investments";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/server/supabase/client", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

function createOrderedSelectResult(result: { data: unknown[] | null; error: { message: string } | null }) {
  const query = {
    order: vi.fn(() => query),
    then: (resolve: (value: typeof result) => void, reject: (reason: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  };

  return {
    select: vi.fn(() => query),
  };
}

function createListClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === "investment_assets") {
        return createOrderedSelectResult({
          data: [
            {
              id: "asset-a",
              name: "Core Equity",
              description: "ETF global",
              start_month: "2026-07-01",
              archived_from_month: null,
              sort_order: 20,
            },
            {
              id: "asset-b",
              name: "Asia + EM",
              description: null,
              start_month: "2026-07-01",
              archived_from_month: "2026-12-01",
              sort_order: 10,
            },
          ],
          error: null,
        });
      }

      if (table === "investment_cash_flows") {
        return createOrderedSelectResult({
          data: [
            {
              id: "flow-a1",
              investment_asset_id: "asset-a",
              flow_type: "contribution",
              flow_date: "2026-08-15",
              amount_cents: 1000_00,
              note: null,
            },
            {
              id: "flow-a2",
              investment_asset_id: "asset-a",
              flow_type: "redemption",
              flow_date: "2026-10-10",
              amount_cents: 200_00,
              note: "Parcial",
            },
            {
              id: "flow-a3",
              investment_asset_id: "asset-a",
              flow_type: "contribution",
              flow_date: "2026-12-10",
              amount_cents: 500_00,
              note: "Futuro",
            },
            {
              id: "flow-b1",
              investment_asset_id: "asset-b",
              flow_type: "contribution",
              flow_date: "2026-09-01",
              amount_cents: 300_00,
              note: null,
            },
          ],
          error: null,
        });
      }

      if (table === "investment_valuations") {
        return createOrderedSelectResult({
          data: [
            {
              id: "valuation-a1",
              investment_asset_id: "asset-a",
              valuation_date: "2026-09-30",
              market_value_cents: 900_00,
              note: null,
            },
            {
              id: "valuation-a2",
              investment_asset_id: "asset-a",
              valuation_date: "2026-12-31",
              market_value_cents: 2000_00,
              note: "Futuro",
            },
            {
              id: "valuation-b1",
              investment_asset_id: "asset-b",
              valuation_date: "2026-10-15",
              market_value_cents: 330_00,
              note: null,
            },
          ],
          error: null,
        });
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function createHistoricalListClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === "investment_assets") {
        return createOrderedSelectResult({
          data: [
            {
              id: "asset-a",
              name: "Core Equity",
              description: "ETF global",
              start_month: "2025-01-01",
              archived_from_month: null,
              sort_order: 10,
            },
          ],
          error: null,
        });
      }

      if (table === "investment_cash_flows") {
        return createOrderedSelectResult({
          data: [
            {
              id: "flow-a1",
              investment_asset_id: "asset-a",
              flow_type: "contribution",
              flow_date: "2025-01-10",
              amount_cents: 1000_00,
              note: null,
            },
            {
              id: "flow-a2",
              investment_asset_id: "asset-a",
              flow_type: "redemption",
              flow_date: "2025-10-10",
              amount_cents: 200_00,
              note: "Parcial",
            },
          ],
          error: null,
        });
      }

      if (table === "investment_valuations") {
        return createOrderedSelectResult({
          data: [
            {
              id: "valuation-a1",
              investment_asset_id: "asset-a",
              valuation_date: "2025-12-31",
              market_value_cents: 950_00,
              note: null,
            },
            {
              id: "valuation-a2",
              investment_asset_id: "asset-a",
              valuation_date: "2026-07-01",
              market_value_cents: 5000_00,
              note: "Futura",
            },
          ],
          error: null,
        });
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function createDeleteClient({
  cashFlowCount = 0,
  valuationCount = 0,
  countError = null,
  deleteData = { id: "asset-a" },
  deleteError = null,
}: {
  cashFlowCount?: number;
  valuationCount?: number;
  countError?: { message: string } | null;
  deleteData?: { id: string } | null;
  deleteError?: { message: string } | null;
} = {}) {
  const deleteSingle = vi.fn(async () => ({ data: deleteData, error: deleteError }));
  const deleteSelect = vi.fn(() => ({ single: deleteSingle }));
  const deleteEq = vi.fn(() => ({ select: deleteSelect }));
  const deleteAsset = vi.fn(() => ({ eq: deleteEq }));

  const cashFlowCountEq = vi.fn(async () => ({ count: cashFlowCount, error: countError }));
  const valuationCountEq = vi.fn(async () => ({ count: valuationCount, error: countError }));
  const selectCashFlowCount = vi.fn(() => ({ eq: cashFlowCountEq }));
  const selectValuationCount = vi.fn(() => ({ eq: valuationCountEq }));
  const client = {
    from: vi.fn((table: string) => {
      if (table === "investment_cash_flows") {
        return { select: selectCashFlowCount };
      }

      if (table === "investment_valuations") {
        return { select: selectValuationCount };
      }

      if (table === "investment_assets") {
        return { delete: deleteAsset };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return {
    client,
    deleteAsset,
    deleteEq,
    deleteSelect,
    deleteSingle,
    cashFlowCountEq,
    valuationCountEq,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("investment server service", () => {
  it("opens the investment summary in June 2026 without the budget first-month limit", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-26T10:00:00.000Z"));

    const overview = await listInvestmentOverview({
      client: createListClient() as never,
    });

    expect(overview.asOfDate).toBe("2026-06-26");
    expect(overview.globalMetrics.totalContributedCents).toBe(0);
  });

  it("loads investments, records and metrics while excluding future records from calculations", async () => {
    const overview = await listInvestmentOverview({
      asOfDate: "2026-10-31",
      client: createListClient() as never,
    });

    expect(overview.assets.map((asset) => asset.name)).toEqual(["Asia + EM", "Core Equity"]);
    expect(overview.assets[1]?.timeline.map((entry) => entry.id)).toContain("flow-a3");
    expect(overview.assets[1]?.metrics).toMatchObject({
      totalContributedCents: 1000_00,
      totalRedeemedCents: 200_00,
      netInvestedCents: 800_00,
      marketValueCents: 900_00,
      gainLossCents: 100_00,
    });
    expect(overview.assets[1]?.metrics.latestValuation?.id).toBe("valuation-a1");
    expect(overview.globalMetrics).toMatchObject({
      totalContributedCents: 1300_00,
      totalRedeemedCents: 200_00,
      netInvestedCents: 1100_00,
      marketValueCents: 1230_00,
      gainLossCents: 130_00,
    });
  });

  it("uses pre-July-2026 investment history and excludes only records after the reference date", async () => {
    const overview = await listInvestmentOverview({
      asOfDate: "2026-06-26",
      client: createHistoricalListClient() as never,
    });

    expect(overview.assets[0]?.startMonth).toBe("2025-01");
    expect(overview.assets[0]?.metrics).toMatchObject({
      totalContributedCents: 1000_00,
      totalRedeemedCents: 200_00,
      netInvestedCents: 800_00,
      marketValueCents: 950_00,
      gainLossCents: 150_00,
    });
    expect(overview.assets[0]?.metrics.latestValuation?.valuationDate).toBe("2025-12-31");
    expect(overview.assets[0]?.metrics.xirr).not.toBeNull();
  });

  it("does not delete an investment when it has cash-flows or valuations", async () => {
    const client = createDeleteClient({ cashFlowCount: 1 });
    mocks.createSupabaseAdminClient.mockReturnValue(client.client);

    await expect(deleteInvestmentAssetWhenAllowed("asset-a")).resolves.toBe(false);

    expect(client.cashFlowCountEq).toHaveBeenCalledWith("investment_asset_id", "asset-a");
    expect(client.valuationCountEq).toHaveBeenCalledWith("investment_asset_id", "asset-a");
    expect(client.deleteAsset).not.toHaveBeenCalled();
  });

  it("deletes and confirms an investment without records", async () => {
    const client = createDeleteClient();
    mocks.createSupabaseAdminClient.mockReturnValue(client.client);

    await expect(deleteInvestmentAssetWhenAllowed("asset-a")).resolves.toBe(true);

    expect(client.deleteEq).toHaveBeenCalledWith("id", "asset-a");
    expect(client.deleteSelect).toHaveBeenCalledWith("id");
  });

  it("does not report delete success without the deleted row confirmation", async () => {
    const client = createDeleteClient({ deleteData: null });
    mocks.createSupabaseAdminClient.mockReturnValue(client.client);

    await expect(deleteInvestmentAssetWhenAllowed("asset-a")).rejects.toThrow(
      "Não foi possível confirmar a eliminação do investimento.",
    );
  });

  it("surfaces Supabase count errors before deleting", async () => {
    const client = createDeleteClient({ countError: { message: "count failed" } });
    mocks.createSupabaseAdminClient.mockReturnValue(client.client);

    await expect(deleteInvestmentAssetWhenAllowed("asset-a")).rejects.toThrow("count failed");
    expect(client.deleteAsset).not.toHaveBeenCalled();
  });
});
