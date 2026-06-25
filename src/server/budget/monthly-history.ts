import "server-only";

import { buildMonthlyHistoryRows, getPastMonthsUntil } from "@/domain/budget/monthly-history";
import { getMonthIdForDate, type MonthId } from "@/domain/budget/months";
import { getSupabaseBudgetOverview } from "./monthly-overview";

export async function getSupabaseMonthlyHistory(currentMonth: MonthId = getMonthIdForDate()) {
  const months = getPastMonthsUntil(currentMonth);

  if (months.length === 0) {
    return [];
  }

  const overviews = await Promise.all(months.map((month) => getSupabaseBudgetOverview(month)));

  return buildMonthlyHistoryRows(overviews, currentMonth);
}
