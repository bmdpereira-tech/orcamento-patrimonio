import { getBudgetVisibleLiquidityAccounts, type LiquidityAccount } from "./accounts";
import {
  buildCreditCardPaymentAmountMap,
  buildMonthlyCreditCardPayments,
  type CreditCardStatementOverride,
} from "./credit-card-payments";
import { sumCents, type Cents } from "./money";
import { addMonths, FIRST_MONTH, type MonthId } from "./months";
import { getCustomBudgetItemSignedAmount, type MonthlyAccountSnapshot, type MonthlyCustomBudgetItem } from "./monthly-view";

export type AccountMonthState = {
  accountId: string;
  month: MonthId;
  initialBalanceOverrideCents: Cents | null;
  currentBalanceOverrideCents: Cents | null;
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

export function calculateRealisedMovements(currentBalanceCents: Cents, initialBalanceCents: Cents) {
  return sumCents([currentBalanceCents, -initialBalanceCents]);
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
        currentBalanceOverrideCents: state.currentBalanceOverrideCents,
      },
    ]),
  );
}

function getCustomForecastAmount(
  customItems: readonly MonthlyCustomBudgetItem[],
  month: MonthId,
  accountId: string,
) {
  return sumCents(
    customItems
      .filter((item) => item.month === month)
      .map((item) => getCustomBudgetItemSignedAmount(item, accountId)),
  );
}

export function buildSnapshotsForMonth({
  month,
  accounts,
  states,
  sourceAmounts,
  customItems = [],
  creditCardStatementOverrides = [],
}: {
  month: MonthId;
  accounts: readonly LiquidityAccount[];
  states: readonly AccountMonthState[];
  sourceAmounts: ReadonlyMap<string, Cents>;
  customItems?: readonly MonthlyCustomBudgetItem[];
  creditCardStatementOverrides?: readonly CreditCardStatementOverride[];
}) {
  const stateByMonthAccount = buildStateMap(states);
  const previousFinalByAccount = new Map<string, Cents>();
  let snapshotsForSelectedMonth: MonthlyAccountSnapshot[] = [];

  for (const currentMonth of monthRangeUntil(month)) {
    const activeAccounts = getBudgetVisibleLiquidityAccounts(accounts, currentMonth);
    const baseSnapshotsForCurrentMonth = activeAccounts.map((account) => {
      const state = stateByMonthAccount.get(stateKey(currentMonth, account.id));
      const initialBalanceCents =
        currentMonth === FIRST_MONTH
          ? state?.initialBalanceOverrideCents ?? 0
          : previousFinalByAccount.get(account.id) ?? 0;
      const currentBalanceCents = state?.currentBalanceOverrideCents ?? initialBalanceCents;
      const realisedMovementsCents = calculateRealisedMovements(currentBalanceCents, initialBalanceCents);
      const directDebitsCents = getMonthlySourceAmount(sourceAmounts, currentMonth, "direct_debits", account.id);
      const dayToDayCents = getMonthlySourceAmount(sourceAmounts, currentMonth, "day_to_day", account.id);
      const manualForecastsCents = getCustomForecastAmount(customItems, currentMonth, account.id);
      const salaryCents = getMonthlySourceAmount(sourceAmounts, currentMonth, "salary", account.id);

      return {
        accountId: account.id,
        initialBalanceCents,
        realisedMovementsCents,
        currentBalanceCents,
        directDebitsCents,
        dayToDayCents,
        creditCardPaymentsCents: 0,
        manualForecastsCents,
        subtotalBeforeSalaryCents: 0,
        salaryCents,
        finalBalanceCents: 0,
      };
    });
    const creditCardPayments = buildMonthlyCreditCardPayments({
      accounts: activeAccounts,
      snapshots: baseSnapshotsForCurrentMonth,
      month: currentMonth,
      overrides: creditCardStatementOverrides,
    });
    const creditCardPaymentAmountsByAccount = buildCreditCardPaymentAmountMap(creditCardPayments);
    const snapshotsForCurrentMonth = baseSnapshotsForCurrentMonth.map((snapshot): MonthlyAccountSnapshot => {
      const creditCardPaymentsCents = creditCardPaymentAmountsByAccount.get(snapshot.accountId) ?? 0;
      const subtotalBeforeSalaryCents = sumCents([
        snapshot.currentBalanceCents,
        snapshot.directDebitsCents,
        snapshot.dayToDayCents,
        creditCardPaymentsCents,
        snapshot.manualForecastsCents,
      ]);

      return {
        ...snapshot,
        creditCardPaymentsCents,
        subtotalBeforeSalaryCents,
        finalBalanceCents: sumCents([subtotalBeforeSalaryCents, snapshot.salaryCents]),
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
