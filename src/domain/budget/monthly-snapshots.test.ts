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
const creditCardAccounts: LiquidityAccount[] = [
  accounts[0] as LiquidityAccount,
  {
    id: "cc-account-a",
    name: "CC Conta A",
    accountType: "credit_card",
    isCreditCard: true,
    linkedPaymentAccountId: "account-a",
    startMonth: "2026-07",
    showInBudget: true,
    includeInNetWorth: true,
    sortOrder: 30,
  },
];

describe("monthly snapshots", () => {
  it("calculates realised movements as current balance minus initial balance", () => {
    expect(calculateRealisedMovements(85_00, 100_00)).toBe(-15_00);
    expect(calculateRealisedMovements(320_00, 200_00)).toBe(120_00);
  });

  it("calculates current balance from the manually entered realised movement", () => {
    const [snapshot] = buildSnapshotsForMonth({
      month: "2026-07",
      accounts,
      states: [
        {
          accountId: "account-a",
          month: "2026-07",
          initialBalanceOverrideCents: 100_00,
          currentBalanceOverrideCents: null,
          realisedMovementsOverrideCents: -15_00,
        },
      ],
      sourceAmounts: new Map(),
    });

    expect(snapshot?.currentBalanceCents).toBe(85_00);
    expect(snapshot?.realisedMovementsCents).toBe(-15_00);
    expect(snapshot?.finalBalanceCents).toBe(85_00);
  });

  it("supports positive realised movements", () => {
    const [snapshot] = buildSnapshotsForMonth({
      month: "2026-07",
      accounts,
      states: [
        {
          accountId: "account-a",
          month: "2026-07",
          initialBalanceOverrideCents: 200_00,
          currentBalanceOverrideCents: null,
          realisedMovementsOverrideCents: 120_00,
        },
      ],
      sourceAmounts: new Map(),
    });

    expect(snapshot?.currentBalanceCents).toBe(320_00);
    expect(snapshot?.realisedMovementsCents).toBe(120_00);
    expect(snapshot?.finalBalanceCents).toBe(320_00);
  });

  it("falls back to legacy current balance rows when no realised movement exists", () => {
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
          currentBalanceOverrideCents: null,
          realisedMovementsOverrideCents: -15_00,
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
          currentBalanceOverrideCents: null,
          realisedMovementsOverrideCents: 0,
        },
      ],
      sourceAmounts: new Map([[monthlySourceAmountKey("2026-07", "direct_debits", "account-a"), -45_00]]),
    });

    expect(snapshot?.directDebitsCents).toBe(-45_00);
    expect(snapshot?.finalBalanceCents).toBe(55_00);
  });

  it("includes automatic day-to-day source amounts in the final balance", () => {
    const [snapshot] = buildSnapshotsForMonth({
      month: "2026-07",
      accounts,
      states: [
        {
          accountId: "account-a",
          month: "2026-07",
          initialBalanceOverrideCents: 100_00,
          currentBalanceOverrideCents: null,
          realisedMovementsOverrideCents: 0,
        },
      ],
      sourceAmounts: new Map([[monthlySourceAmountKey("2026-07", "day_to_day", "account-a"), -50_00]]),
    });

    expect(snapshot?.dayToDayCents).toBe(-50_00);
    expect(snapshot?.finalBalanceCents).toBe(50_00);
  });

  it("includes automatic salary source amounts in the final balance", () => {
    const [snapshot] = buildSnapshotsForMonth({
      month: "2026-07",
      accounts,
      states: [
        {
          accountId: "account-a",
          month: "2026-07",
          initialBalanceOverrideCents: 100_00,
          currentBalanceOverrideCents: null,
          realisedMovementsOverrideCents: 0,
        },
      ],
      sourceAmounts: new Map([[monthlySourceAmountKey("2026-07", "salary", "account-a"), 3_000_00]]),
    });

    expect(snapshot?.salaryCents).toBe(3_000_00);
    expect(snapshot?.finalBalanceCents).toBe(3_100_00);
  });

  it("calculates credit card payments from current card debt as a zero-sum transfer", () => {
    const snapshots = buildSnapshotsForMonth({
      month: "2026-07",
      accounts: creditCardAccounts,
      states: [
        {
          accountId: "account-a",
          month: "2026-07",
          initialBalanceOverrideCents: 1_000_00,
          currentBalanceOverrideCents: null,
          realisedMovementsOverrideCents: 0,
        },
        {
          accountId: "cc-account-a",
          month: "2026-07",
          initialBalanceOverrideCents: 0,
          currentBalanceOverrideCents: null,
          realisedMovementsOverrideCents: -125_00,
        },
      ],
      sourceAmounts: new Map(),
    });

    expect(snapshots.find((snapshot) => snapshot.accountId === "account-a")?.creditCardPaymentsCents).toBe(-125_00);
    expect(snapshots.find((snapshot) => snapshot.accountId === "cc-account-a")?.creditCardPaymentsCents).toBe(125_00);
    expect(snapshots.reduce((total, snapshot) => total + snapshot.creditCardPaymentsCents, 0)).toBe(0);
  });

  it("uses statement overrides and distinguishes zero from absence", () => {
    const automaticSnapshots = buildSnapshotsForMonth({
      month: "2026-07",
      accounts: creditCardAccounts,
      states: [
        {
          accountId: "cc-account-a",
          month: "2026-07",
          initialBalanceOverrideCents: 0,
          currentBalanceOverrideCents: null,
          realisedMovementsOverrideCents: -125_00,
        },
      ],
      sourceAmounts: new Map(),
    });
    const zeroOverrideSnapshots = buildSnapshotsForMonth({
      month: "2026-07",
      accounts: creditCardAccounts,
      states: [
        {
          accountId: "cc-account-a",
          month: "2026-07",
          initialBalanceOverrideCents: 0,
          currentBalanceOverrideCents: null,
          realisedMovementsOverrideCents: -125_00,
        },
      ],
      sourceAmounts: new Map(),
      creditCardStatementOverrides: [
        { creditCardAccountId: "cc-account-a", month: "2026-07", statementAmountCents: 0 },
      ],
    });

    expect(automaticSnapshots.find((snapshot) => snapshot.accountId === "cc-account-a")?.creditCardPaymentsCents).toBe(125_00);
    expect(zeroOverrideSnapshots.find((snapshot) => snapshot.accountId === "cc-account-a")?.creditCardPaymentsCents).toBe(0);
  });

  it("ignores legacy credit card payment source amounts", () => {
    const snapshots = buildSnapshotsForMonth({
      month: "2026-07",
      accounts: creditCardAccounts,
      states: [
        {
          accountId: "cc-account-a",
          month: "2026-07",
          initialBalanceOverrideCents: 0,
          currentBalanceOverrideCents: null,
          realisedMovementsOverrideCents: 0,
        },
      ],
      sourceAmounts: new Map([
        [monthlySourceAmountKey("2026-07", "credit_card_payments", "account-a"), -500_00],
        [monthlySourceAmountKey("2026-07", "credit_card_payments", "cc-account-a"), 500_00],
      ]),
    });

    expect(snapshots.find((snapshot) => snapshot.accountId === "account-a")?.creditCardPaymentsCents).toBe(0);
    expect(snapshots.find((snapshot) => snapshot.accountId === "cc-account-a")?.creditCardPaymentsCents).toBe(0);
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
          currentBalanceOverrideCents: null,
          realisedMovementsOverrideCents: 0,
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
          currentBalanceOverrideCents: null,
          realisedMovementsOverrideCents: -15_00,
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
          currentBalanceOverrideCents: null,
          realisedMovementsOverrideCents: -15_00,
        },
        {
          accountId: "account-a",
          month: "2026-08",
          initialBalanceOverrideCents: null,
          currentBalanceOverrideCents: null,
          realisedMovementsOverrideCents: 35_00,
        },
      ],
      sourceAmounts: new Map(),
    });

    expect(julySnapshots[0]?.finalBalanceCents).toBe(85_00);
    expect(augustSnapshots[0]?.initialBalanceCents).toBe(85_00);
    expect(augustSnapshots[0]?.realisedMovementsCents).toBe(35_00);
    expect(augustSnapshots[0]?.finalBalanceCents).toBe(120_00);
  });

  it("keeps future months without movements at the transported initial balance and still forecasts final balance", () => {
    const augustSnapshots = buildSnapshotsForMonth({
      month: "2026-08",
      accounts,
      states: [
        {
          accountId: "account-a",
          month: "2026-07",
          initialBalanceOverrideCents: 100_00,
          currentBalanceOverrideCents: null,
          realisedMovementsOverrideCents: 20_00,
        },
      ],
      sourceAmounts: new Map([[monthlySourceAmountKey("2026-08", "direct_debits", "account-a"), -25_00]]),
    });
    const septemberSnapshots = buildSnapshotsForMonth({
      month: "2026-09",
      accounts,
      states: [
        {
          accountId: "account-a",
          month: "2026-07",
          initialBalanceOverrideCents: 100_00,
          currentBalanceOverrideCents: null,
          realisedMovementsOverrideCents: 20_00,
        },
      ],
      sourceAmounts: new Map([[monthlySourceAmountKey("2026-08", "direct_debits", "account-a"), -25_00]]),
    });

    expect(augustSnapshots[0]?.initialBalanceCents).toBe(120_00);
    expect(augustSnapshots[0]?.realisedMovementsCents).toBe(0);
    expect(augustSnapshots[0]?.currentBalanceCents).toBe(120_00);
    expect(augustSnapshots[0]?.finalBalanceCents).toBe(95_00);
    expect(septemberSnapshots[0]?.initialBalanceCents).toBe(95_00);
    expect(septemberSnapshots[0]?.realisedMovementsCents).toBe(0);
    expect(septemberSnapshots[0]?.currentBalanceCents).toBe(95_00);
  });
});
