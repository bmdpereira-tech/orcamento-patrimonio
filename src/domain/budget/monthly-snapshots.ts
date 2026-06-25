import { getActualMovementAmount } from "./actual-movements";
import { getBudgetVisibleLiquidityAccounts, type LiquidityAccount } from "./accounts";
import { sumCents, type Cents } from "./money";
import { addMonths, FIRST_MONTH, type MonthId } from "./months";
import type { MonthlyAccountSnapshot } from "./monthly-view";

export type AccountMonthState = {
  accountId: string;
  month: MonthId;
  initialBalanceOverrideCents: Cents | null;
};

export type MonthlySystemSourceType = "direct_debits" | "day_to_day" | "credit_card_payments" | "salary";

export function monthlySourceAmountKey(month: MonthId, sourceType: MonthlySystemSourceType, accountId: string) {
  return `${month}:${sourceType}:${accountId}`;
}

export function getMonthlySourceAmount(
  sourceAmounts: ReadonlyMap<string, Cents>,
  month: MonthId,
  sourceType: MonthlySystemSourceType,
  accountId: string,
) {
  return sourceAmounts.get(monthlySourceAmountKey(month, sourceType, accountId)) ?? 0;
}

export function calculateCurrentBalance(initialBalanceCents: Cents, realisedMovementsCents: Cents) {
  return sumCents([initialBalanceCents, realisedMovementsCents]);
}

function monthRangeUntil(month: MonthId) {
  const months: MonthId[] = [];
  let cursor = FIRST_MONTH as MonthId;

  while (cursor <= month) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }

  return months;
}

function stateKey(month: MonthId, accountId: string) {
  return `${month}:${accountId}`;
}

function buildStateMap(states: readonly AccountMonthState[]) {
  return new Map(
    states.map((state) => [
      stateKey(state.month, state.accountId),
      {
        initialBalanceOverrideCents: state.initialBalanceOverrideCents,
      },
    ]),
  );
}

export function buildSnapshotsForMonth({
  month,
  accounts,
  states,
  sourceAmounts,
  actualMovementAmounts,
}: {
  month: MonthId;
  accounts: readonly LiquidityAccount[];
  states: readonly AccountMonthState[];
  sourceAmounts: ReadonlyMap<string, Cents>;
  actualMovementAmounts: ReadonlyMap<string, Cents>;
}) {
  const stateByMonthAccount = buildStateMap(states);
  const previousFinalByAccount = new Map<string, Cents>();
  let snapshotsForSelectedMonth: MonthlyAccountSnapshot[] = [];

  for (const currentMonth of monthRangeUntil(month)) {
    const activeAccounts = getBudgetVisibleLiquidityAccounts(accounts, currentMonth);
    const snapshotsForCurrentMonth = activeAccounts.map((account) => {
      const state = stateByMonthAccount.get(stateKey(currentMonth, account.id));
      const initialBalanceCents =
        currentMonth === FIRST_MONTH
          ? state?.initialBalanceOverrideCents ?? 0
          : previousFinalByAccount.get(account.id) ?? 0;
      const realisedMovementsCents = getActualMovementAmount(actualMovementAmounts, currentMonth, account.id);
      const currentBalanceCents = calculateCurrentBalance(initialBalanceCents, realisedMovementsCents);
      const directDebitsCents = getMonthlySourceAmount(sourceAmounts, currentMonth, "direct_debits", account.id);
      const dayToDayCents = getMonthlySourceAmount(sourceAmounts, currentMonth, "day_to_day", account.id);
      const creditCardPaymentsCents = getMonthlySourceAmount(
        sourceAmounts,
        currentMonth,
        "credit_card_payments",
        account.id,
      );
      const manualForecastsCents = 0;
      const subtotalBeforeSalaryCents = sumCents([
        currentBalanceCents,
        directDebitsCents,
        dayToDayCents,
        creditCardPaymentsCents,
        manualForecastsCents,
      ]);
      const salaryCents = getMonthlySourceAmount(sourceAmounts, currentMonth, "salary", account.id);
      const finalBalanceCents = sumCents([subtotalBeforeSalaryCents, salaryCents]);

      return {
        accountId: account.id,
        initialBalanceCents,
        realisedMovementsCents,
        currentBalanceCents,
        directDebitsCents,
        dayToDayCents,
        creditCardPaymentsCents,
        manualForecastsCents,
        subtotalBeforeSalaryCents,
        salaryCents,
        finalBalanceCents,
      };
    });

    for (const snapshot of snapshotsForCurrentMonth) {
      previousFinalByAccount.set(snapshot.accountId, snapshot.finalBalanceCents);
    }

    if (currentMonth === month) {
      snapshotsForSelectedMonth = snapshotsForCurrentMonth;
    }
  }

  return snapshotsForSelectedMonth;
}
