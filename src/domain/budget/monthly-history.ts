import type { LiquidityAccount } from "./accounts";
import { sumCents, type Cents } from "./money";
import { addMonths, FIRST_MONTH, type MonthId } from "./months";
import type { BudgetOverview, MonthlyAccountSnapshot } from "./monthly-view";

export type MonthlyHistoryRow = {
  month: MonthId;
  liquidityVariationCents: Cents;
  investmentVariationCents: Cents;
};

export function isInvestmentAccount(account: Pick<LiquidityAccount, "accountType">) {
  return account.accountType === "investment_cash";
}

export function isLiquidityHistoryAccount(account: Pick<LiquidityAccount, "accountType">) {
  return !isInvestmentAccount(account);
}

export function getPastMonthsUntil(currentMonth: MonthId, firstMonth: MonthId = FIRST_MONTH as MonthId) {
  const months: MonthId[] = [];
  let cursor = addMonths(currentMonth, -1);

  while (cursor >= firstMonth) {
    months.push(cursor);
    cursor = addMonths(cursor, -1);
  }

  return months;
}

export function calculateMonthlyVariation(
  accounts: readonly LiquidityAccount[],
  snapshots: readonly MonthlyAccountSnapshot[],
  includeAccount: (account: LiquidityAccount) => boolean,
) {
  const snapshotsByAccountId = new Map(snapshots.map((snapshot) => [snapshot.accountId, snapshot]));
  const selectedSnapshots = accounts
    .filter(includeAccount)
    .map((account) => snapshotsByAccountId.get(account.id))
    .filter((snapshot): snapshot is MonthlyAccountSnapshot => Boolean(snapshot));

  return sumCents(
    selectedSnapshots.map((snapshot) => snapshot.finalBalanceCents - snapshot.initialBalanceCents),
  );
}

export function buildMonthlyHistoryRows(overviews: readonly BudgetOverview[], currentMonth: MonthId) {
  return overviews
    .filter((overview) => overview.month < currentMonth)
    .map(
      (overview): MonthlyHistoryRow => ({
        month: overview.month,
        liquidityVariationCents: calculateMonthlyVariation(
          overview.accounts,
          overview.snapshots,
          isLiquidityHistoryAccount,
        ),
        investmentVariationCents: calculateMonthlyVariation(overview.accounts, overview.snapshots, isInvestmentAccount),
      }),
    )
    .sort((left, right) => right.month.localeCompare(left.month));
}
