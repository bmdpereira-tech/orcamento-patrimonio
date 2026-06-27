import { isActiveInMonth } from "./accounts";
import {
  calculateGlobalInvestmentMetrics,
  calculateInvestmentMetrics,
  getMonthEndDate,
  type InvestmentCashFlow,
  type InvestmentValuation,
} from "./investments";
import { sumCents, type Cents } from "./money";
import { addMonths, FIRST_MONTH, type MonthId } from "./months";
import type { BudgetOverview, MonthlyAccountSnapshot } from "./monthly-view";

export type HistoryPeriod = "last-12" | "ytd" | "current-year";

export type MonthlyLiquidityHistoryPoint = {
  month: MonthId;
  saldoInicialTotalCents: Cents;
  saldoFinalTotalCents: Cents;
  variacaoMensalCents: Cents;
};

export type InvestmentHistoryAsset = {
  id: string;
  name: string;
  startMonth: MonthId;
  archivedFromMonth?: MonthId;
  sortOrder?: number;
};

export type MonthlyInvestmentXirrPoint = {
  month: MonthId;
  xirr: number | null;
};

export type InvestmentXirrSeries = {
  id: string;
  name: string;
  isGlobal: boolean;
  points: MonthlyInvestmentXirrPoint[];
};

export type InvestmentXirrHistory = {
  months: MonthId[];
  series: InvestmentXirrSeries[];
};

export function getHistoryMonthsUntil(
  currentMonth: MonthId,
  firstMonth: MonthId = FIRST_MONTH as MonthId,
) {
  return getHistoryMonthsBetween(firstMonth, currentMonth);
}

export function getHistoryMonthsBetween(firstMonth: MonthId, lastMonth: MonthId) {
  if (firstMonth > lastMonth) {
    return [];
  }

  const months: MonthId[] = [];
  let cursor = firstMonth;

  while (cursor <= lastMonth) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }

  return months;
}

function minMonth(...months: MonthId[]) {
  return [...months].sort()[0] ?? (FIRST_MONTH as MonthId);
}

function maxMonth(...months: MonthId[]) {
  return [...months].sort().at(-1) ?? (FIRST_MONTH as MonthId);
}

function yearStartMonth(month: MonthId) {
  return `${month.slice(0, 4)}-01` as MonthId;
}

function yearEndMonth(month: MonthId) {
  return `${month.slice(0, 4)}-12` as MonthId;
}

export function getLiquidityHistoryMonthsForReferenceMonth(
  referenceMonth: MonthId,
  firstMonth: MonthId = FIRST_MONTH as MonthId,
) {
  const rollingStart = addMonths(referenceMonth, -11);
  const startMonth = maxMonth(firstMonth, minMonth(rollingStart, yearStartMonth(referenceMonth)));
  const endMonth = maxMonth(referenceMonth, yearEndMonth(referenceMonth));

  return getHistoryMonthsBetween(startMonth, endMonth);
}

export function filterMonthsForHistoryPeriod(
  months: readonly MonthId[],
  period: HistoryPeriod,
  currentMonth: MonthId,
) {
  const availableMonths = [...months].filter((month) => month <= currentMonth).sort();

  if (period === "last-12") {
    return availableMonths.slice(-12);
  }

  const currentYear = currentMonth.slice(0, 4);

  return availableMonths.filter((month) => month.startsWith(`${currentYear}-`));
}

export function filterMonthsForLiquidityPeriod(
  months: readonly MonthId[],
  period: HistoryPeriod,
  referenceMonth: MonthId,
  firstMonth: MonthId = FIRST_MONTH as MonthId,
) {
  const periodStart =
    period === "last-12"
      ? addMonths(referenceMonth, -11)
      : yearStartMonth(referenceMonth);
  const periodEnd = period === "current-year" ? yearEndMonth(referenceMonth) : referenceMonth;
  const startMonth = maxMonth(firstMonth, periodStart);

  return [...months]
    .filter((month) => month >= startMonth && month <= periodEnd)
    .sort();
}

export function calculateLiquidityHistoryPoint(
  overview: Pick<BudgetOverview, "month" | "accounts" | "snapshots">,
) {
  const snapshotsByAccountId = new Map(overview.snapshots.map((snapshot) => [snapshot.accountId, snapshot]));
  const selectedSnapshots = overview.accounts
    .map((account) => snapshotsByAccountId.get(account.id))
    .filter((snapshot): snapshot is MonthlyAccountSnapshot => Boolean(snapshot));
  const saldoInicialTotalCents = sumCents(selectedSnapshots.map((snapshot) => snapshot.initialBalanceCents));
  const saldoFinalTotalCents = sumCents(selectedSnapshots.map((snapshot) => snapshot.finalBalanceCents));

  return {
    month: overview.month,
    saldoInicialTotalCents,
    saldoFinalTotalCents,
    variacaoMensalCents: saldoFinalTotalCents - saldoInicialTotalCents,
  } satisfies MonthlyLiquidityHistoryPoint;
}

export function buildMonthlyLiquidityHistoryPoints(overviews: readonly BudgetOverview[]) {
  return overviews
    .map(calculateLiquidityHistoryPoint)
    .sort((left, right) => left.month.localeCompare(right.month));
}

function monthFromDate(date: string) {
  return date.slice(0, 7) as MonthId;
}

function getFirstInvestmentHistoryMonth({
  assets,
  cashFlows,
  valuations,
  currentMonth,
}: {
  assets: readonly InvestmentHistoryAsset[];
  cashFlows: readonly InvestmentCashFlow[];
  valuations: readonly InvestmentValuation[];
  currentMonth: MonthId;
}) {
  const candidateMonths = [
    ...assets
      .filter((asset) => isActiveInMonth(asset, currentMonth))
      .map((asset) => asset.startMonth),
    ...cashFlows.map((flow) => monthFromDate(flow.flowDate)),
    ...valuations.map((valuation) => monthFromDate(valuation.valuationDate)),
  ].filter((month) => month <= currentMonth);

  return candidateMonths.sort()[0] ?? null;
}

function hasInvestmentHistory(
  investmentAssetId: string,
  cashFlows: readonly InvestmentCashFlow[],
  valuations: readonly InvestmentValuation[],
) {
  return (
    cashFlows.some((flow) => flow.investmentAssetId === investmentAssetId) ||
    valuations.some((valuation) => valuation.investmentAssetId === investmentAssetId)
  );
}

export function getInvestmentAssetsForHistory({
  assets,
  cashFlows,
  valuations,
  currentMonth,
}: {
  assets: readonly InvestmentHistoryAsset[];
  cashFlows: readonly InvestmentCashFlow[];
  valuations: readonly InvestmentValuation[];
  currentMonth: MonthId;
}) {
  return [...assets]
    .filter(
      (asset) =>
        isActiveInMonth(asset, currentMonth) ||
        hasInvestmentHistory(asset.id, cashFlows, valuations),
    )
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.name.localeCompare(right.name));
}

export function buildInvestmentXirrHistory({
  assets,
  cashFlows,
  valuations,
  currentMonth,
}: {
  assets: readonly InvestmentHistoryAsset[];
  cashFlows: readonly InvestmentCashFlow[];
  valuations: readonly InvestmentValuation[];
  currentMonth: MonthId;
}): InvestmentXirrHistory {
  const selectedAssets = getInvestmentAssetsForHistory({
    assets,
    cashFlows,
    valuations,
    currentMonth,
  });
  const firstMonth = getFirstInvestmentHistoryMonth({
    assets: selectedAssets,
    cashFlows,
    valuations,
    currentMonth,
  });

  if (!firstMonth || selectedAssets.length === 0) {
    return { months: [], series: [] };
  }

  const months = getHistoryMonthsUntil(currentMonth, firstMonth);
  const series = selectedAssets.map((asset): InvestmentXirrSeries => ({
    id: asset.id,
    name: asset.name,
    isGlobal: false,
    points: months.map((month) => ({
      month,
      xirr: calculateInvestmentMetrics({
        investmentAssetId: asset.id,
        cashFlows,
        valuations,
        asOfDate: getMonthEndDate(month),
      }).xirr,
    })),
  }));
  const assetIds = selectedAssets.map((asset) => asset.id);

  return {
    months,
    series: [
      ...series,
      {
        id: "global",
        name: "Global",
        isGlobal: true,
        points: months.map((month) => ({
          month,
          xirr: calculateGlobalInvestmentMetrics({
            investmentAssetIds: assetIds,
            cashFlows,
            valuations,
            asOfDate: getMonthEndDate(month),
          }).xirr,
        })),
      },
    ],
  };
}
