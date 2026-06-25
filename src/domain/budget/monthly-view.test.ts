import { describe, expect, it } from "vitest";
import { INITIAL_LIQUIDITY_ACCOUNTS } from "./accounts";
import {
  calculateInvestmentTotal,
  calculateNetWorth,
  calculateNetWorthLiquidity,
  applyCustomBudgetItemMutation,
  buildBudgetTableSections,
  calculateCustomBudgetItemTotal,
  createBudgetTableColumns,
  createEmptySnapshot,
  getCustomBudgetItemSignedAmount,
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

  it("applies the sign of custom expense and income rows", () => {
    const expense = {
      id: "expense",
      month: "2026-07" as const,
      description: "Viagem",
      category: "expense" as const,
      sortOrder: 10,
      valuesByAccountId: { santander: 4_000_00, n26: 2_500_00 },
    };
    const income = {
      id: "income",
      month: "2026-07" as const,
      description: "Reembolso",
      category: "income" as const,
      sortOrder: 20,
      valuesByAccountId: { santander: 3_000_00 },
    };

    expect(getCustomBudgetItemSignedAmount(expense, "santander")).toBe(-4_000_00);
    expect(calculateCustomBudgetItemTotal(expense)).toBe(-6_500_00);
    expect(calculateCustomBudgetItemTotal(income)).toBe(3_000_00);
  });

  it("places custom rows inside the forecast section", () => {
    const [account] = INITIAL_LIQUIDITY_ACCOUNTS;
    const sections = buildBudgetTableSections(
      account ? [account] : [],
      [createEmptySnapshot("santander")],
      [
        {
          id: "custom",
          month: "2026-07",
          description: "Seguro",
          category: "expense",
          sortOrder: 10,
          valuesByAccountId: { santander: 100_00 },
        },
      ],
    );
    const forecastSection = sections.find((section) => section.key === "monthly-forecasts");

    expect(forecastSection?.rows.map((row) => row.label)).toContain("Seguro");
  });

  it("applies create, edit and delete mutations for custom rows", () => {
    const created = {
      id: "custom",
      month: "2026-07" as const,
      description: "Seguro",
      category: "expense" as const,
      sortOrder: 10,
      valuesByAccountId: { santander: 100_00 },
    };
    const updated = {
      ...created,
      description: "Reembolso",
      category: "income" as const,
      valuesByAccountId: { santander: 120_00 },
    };
    const afterCreate = applyCustomBudgetItemMutation([], { type: "create", item: created });
    const afterUpdate = applyCustomBudgetItemMutation(afterCreate, { type: "update", item: updated });
    const afterDelete = applyCustomBudgetItemMutation(afterUpdate, { type: "delete", id: "custom" });

    expect(afterCreate).toEqual([created]);
    expect(afterUpdate).toEqual([updated]);
    expect(afterDelete).toEqual([]);
  });
});
