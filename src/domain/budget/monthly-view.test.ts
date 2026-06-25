import { describe, expect, it } from "vitest";
import { INITIAL_LIQUIDITY_ACCOUNTS } from "./accounts";
import {
  calculateInvestmentTotal,
  calculateNetWorth,
  calculateNetWorthLiquidity,
  createBudgetTableColumns,
  createEmptySnapshot,
  sumAccountSnapshots,
} from "./monthly-view";

describe("monthly view calculations", () => {
  it("places the Total column after the last active account", () => {
    const columns = createBudgetTableColumns(INITIAL_LIQUIDITY_ACCOUNTS);

    expect(columns.at(-2)?.label).toBe("IGCP");
    expect(columns.at(-1)?.label).toBe("Total");
  });

  it("calculates net worth as final liquidity plus investments", () => {
    expect(calculateNetWorth(5_752_514, 4_404_000)).toBe(10_156_514);
  });

  it("uses only accounts marked for net worth in the liquidity part", () => {
    const snapshots = [
      { ...createEmptySnapshot("included"), finalBalanceCents: 100_000 },
      { ...createEmptySnapshot("excluded"), finalBalanceCents: 75_000 },
    ];

    expect(
      calculateNetWorthLiquidity(
        [
          {
            id: "included",
            name: "Incluída",
            isCreditCard: false,
            startMonth: "2026-07",
            includeInNetWorth: true,
            sortOrder: 10,
          },
          {
            id: "excluded",
            name: "Excluída",
            isCreditCard: false,
            startMonth: "2026-07",
            includeInNetWorth: false,
            sortOrder: 20,
          },
        ],
        snapshots,
      ),
    ).toBe(100_000);
  });

  it("includes credit cards in liquidity totals with their sign", () => {
    const snapshots = [
      { ...createEmptySnapshot("santander"), finalBalanceCents: 100_000 },
      { ...createEmptySnapshot("cc-santander"), finalBalanceCents: -25_000 },
    ];
    const accounts = INITIAL_LIQUIDITY_ACCOUNTS.filter((account) =>
      ["santander", "cc-santander"].includes(account.id),
    );

    expect(sumAccountSnapshots(accounts, snapshots, (snapshot) => snapshot.finalBalanceCents)).toBe(75_000);
  });

  it("sums investment assets independently from Trading 212", () => {
    expect(
      calculateInvestmentTotal(
        [
          { id: "a", name: "Activo A", startMonth: "2026-07", sortOrder: 10, monthlyValuesCents: { "2026-07": 10 } },
          { id: "b", name: "Activo B", startMonth: "2026-07", sortOrder: 20, monthlyValuesCents: { "2026-07": 15 } },
        ],
        "2026-07",
      ),
    ).toBe(25);
  });
});
