import { describe, expect, it } from "vitest";
import type { LiquidityAccount } from "./accounts";
import { buildSnapshotsForMonth, calculateRealisedMovements, monthlySourceAmountKey } from "./monthly-snapshots";
import type { MonthlyCustomBudgetItem } from "./monthly-view";

const accounts: LiquidityAccount[] = [
  {
    id: "account-a",
    name: "Conta A",
    isCreditCard: false,
    startMonth: "2026-07",
    showInBudget: true,
    includeInNetWorth: true,
    sortOrder: 10,
  },
  {
    id: "account-b",
    name: "Conta B",
    isCreditCard: false,
    startMonth: "2026-07",
    showInBudget: true,
    includeInNetWorth: true,
    sortOrder: 20,
  },
];

describe("monthly snapshots", () => {
  it("calculates realised movements as current balance minus initial balance", () => {
    expect(calculateRealisedMovements(85_00, 100_00)).toBe(-15_00);
    expect(calculateRealisedMovements(320_00, 200_00)).toBe(120_00);
  });

  it("uses the manually entered current balance and updates the final balance", () => {
    const [snapshot] = buildSnapshotsForMonth({
      month: "2026-07",
      accounts,
      states: [
        {
          accountId: "account-a",
          month: "2026-07",
          initialBalanceOverrideCents: 100_00,
          currentBalanceOverrideCents: 85_00,
        },
      ],
      sourceAmounts: new Map(),
    });

    expect(snapshot?.currentBalanceCents).toBe(85_00);
    expect(snapshot?.realisedMovementsCents).toBe(-15_00);
    expect(snapshot?.finalBalanceCents).toBe(85_00);
  });

  it("includes signed custom forecasts in the final balance", () => {
    const customItems: MonthlyCustomBudgetItem[] = [
      {
        id: "trip",
        month: "2026-07",
        description: "Viagem",
        sortOrder: 10,
        valuesByAccountId: { "account-a": -40_00 },
      },
      {
        id: "refund",
        month: "2026-07",
        description: "Reembolso",
        sortOrder: 20,
        valuesByAccountId: { "account-a": 25_00 },
      },
    ];
    const [snapshot] = buildSnapshotsForMonth({
      month: "2026-07",
      accounts,
      states: [
        {
          accountId: "account-a",
          month: "2026-07",
          initialBalanceOverrideCents: 100_00,
          currentBalanceOverrideCents: 85_00,
        },
      ],
      sourceAmounts: new Map(),
      customItems,
    });

    expect(snapshot?.manualForecastsCents).toBe(-15_00);
    expect(snapshot?.finalBalanceCents).toBe(70_00);
  });

  it("includes automatic direct debit source amounts in the final balance", () => {
    const [snapshot] = buildSnapshotsForMonth({
      month: "2026-07",
      accounts,
      states: [
        {
          accountId: "account-a",
          month: "2026-07",
          initialBalanceOverrideCents: 100_00,
          currentBalanceOverrideCents: 100_00,
        },
      ],
      sourceAmounts: new Map([[monthlySourceAmountKey("2026-07", "direct_debits", "account-a"), -45_00]]),
    });

    expect(snapshot?.directDebitsCents).toBe(-45_00);
    expect(snapshot?.finalBalanceCents).toBe(55_00);
  });

  it("keeps custom forecast lines isolated by month", () => {
    const customItems: MonthlyCustomBudgetItem[] = [
      {
        id: "july",
        month: "2026-07",
        description: "Julho",
        sortOrder: 10,
        valuesByAccountId: { "account-a": -40_00 },
      },
      {
        id: "august",
        month: "2026-08",
        description: "Agosto",
        sortOrder: 20,
        valuesByAccountId: { "account-a": -10_00 },
      },
    ];
    const [snapshot] = buildSnapshotsForMonth({
      month: "2026-07",
      accounts,
      states: [
        {
          accountId: "account-a",
          month: "2026-07",
          initialBalanceOverrideCents: 100_00,
          currentBalanceOverrideCents: 100_00,
        },
      ],
      sourceAmounts: new Map(),
      customItems,
    });

    expect(snapshot?.manualForecastsCents).toBe(-40_00);
  });

  it("transports the previous final balance to the next month", () => {
    const julySnapshots = buildSnapshotsForMonth({
      month: "2026-07",
      accounts,
      states: [
        {
          accountId: "account-a",
          month: "2026-07",
          initialBalanceOverrideCents: 100_00,
          currentBalanceOverrideCents: 85_00,
        },
      ],
      sourceAmounts: new Map(),
    });
    const augustSnapshots = buildSnapshotsForMonth({
      month: "2026-08",
      accounts,
      states: [
        {
          accountId: "account-a",
          month: "2026-07",
          initialBalanceOverrideCents: 100_00,
          currentBalanceOverrideCents: 85_00,
        },
        {
          accountId: "account-a",
          month: "2026-08",
          initialBalanceOverrideCents: null,
          currentBalanceOverrideCents: 120_00,
        },
      ],
      sourceAmounts: new Map(),
    });

    expect(julySnapshots[0]?.finalBalanceCents).toBe(85_00);
    expect(augustSnapshots[0]?.initialBalanceCents).toBe(85_00);
    expect(augustSnapshots[0]?.realisedMovementsCents).toBe(35_00);
    expect(augustSnapshots[0]?.finalBalanceCents).toBe(120_00);
  });
});
