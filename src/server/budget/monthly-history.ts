import "server-only";

import {
  buildInvestmentXirrHistory,
  buildMonthlyLiquidityHistoryPoints,
  getLiquidityHistoryMonthsForReferenceMonth,
  type InvestmentXirrHistory,
  type MonthlyLiquidityHistoryPoint,
} from "@/domain/budget/monthly-history";
import { getMonthEndDate } from "@/domain/budget/investments";
import { getMonthIdForDate, normaliseMonth, type MonthId } from "@/domain/budget/months";
import { listInvestmentOverview } from "./investments";
import { getSupabaseBudgetOverview } from "./monthly-overview";

export type HistoryDashboardData = {
  currentMonth: MonthId;
  liquidity: {
    referenceMonth: MonthId;
    months: MonthId[];
    points: MonthlyLiquidityHistoryPoint[];
  };
  investments: InvestmentXirrHistory;
};

export async function getSupabaseHistoryDashboard({
  currentMonth = getMonthIdForDate(),
  liquidityReferenceMonth = normaliseMonth(currentMonth),
}: {
  currentMonth?: MonthId;
  liquidityReferenceMonth?: MonthId;
} = {}) {
  const referenceMonth = normaliseMonth(liquidityReferenceMonth);
  const liquidityMonths = getLiquidityHistoryMonthsForReferenceMonth(referenceMonth);
  const [budgetOverviews, investmentOverview] = await Promise.all([
    Promise.all(liquidityMonths.map((month) => getSupabaseBudgetOverview(month))),
    listInvestmentOverview({ asOfDate: getMonthEndDate(currentMonth) }),
  ]);
  const cashFlows = investmentOverview.assets.flatMap((asset) => asset.cashFlows);
  const valuations = investmentOverview.assets.flatMap((asset) => asset.valuations);

  return {
    currentMonth,
    liquidity: {
      referenceMonth,
      months: liquidityMonths,
      points: buildMonthlyLiquidityHistoryPoints(budgetOverviews),
    },
    investments: buildInvestmentXirrHistory({
      assets: investmentOverview.assets,
      cashFlows,
      valuations,
      currentMonth,
    }),
  } satisfies HistoryDashboardData;
}
