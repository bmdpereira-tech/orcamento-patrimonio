import { describe, expect, it } from "vitest";
import { buildActualMovementAmountMap, type ActualMovement } from "./actual-movements";
import type { LiquidityAccount } from "./accounts";
import { buildSnapshotsForMonth, calculateCurrentBalance } from "./monthly-snapshots";

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
];

describe("monthly snapshots", () => {
  it("calculates current balance from initial balance and realised movements", () => {
    expect(calculateCurrentBalance(100_00, -25_00)).toBe(75_00);
  });

  it("transports the previous final balance to the next month", () => {
    const movements: ActualMovement[] = [
      {
        id: "july-expense",
        accountId: "account-a",
        movementDate: "2026-07-10",
        description: "Despesa",
        amountCents: 20_00,
        movementType: "expense",
      },
      {
        id: "august-income",
        accountId: "account-a",
        movementDate: "2026-08-02",
        description: "Entrada",
        amountCents: 50_00,
        movementType: "income",
      },
    ];

    const julySnapshots = buildSnapshotsForMonth({
      month: "2026-07",
      accounts,
      states: [{ accountId: "account-a", month: "2026-07", initialBalanceOverrideCents: 100_00 }],
      sourceAmounts: new Map(),
      actualMovementAmounts: buildActualMovementAmountMap(movements),
    });
    const augustSnapshots = buildSnapshotsForMonth({
      month: "2026-08",
      accounts,
      states: [{ accountId: "account-a", month: "2026-07", initialBalanceOverrideCents: 100_00 }],
      sourceAmounts: new Map(),
      actualMovementAmounts: buildActualMovementAmountMap(movements),
    });

    expect(julySnapshots[0]?.currentBalanceCents).toBe(80_00);
    expect(julySnapshots[0]?.finalBalanceCents).toBe(80_00);
    expect(augustSnapshots[0]?.initialBalanceCents).toBe(80_00);
    expect(augustSnapshots[0]?.currentBalanceCents).toBe(130_00);
  });
});
