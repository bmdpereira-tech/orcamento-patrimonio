import { HistoryDashboard } from "@/components/history-dashboard";
import { getMonthIdForDate, normaliseMonth } from "@/domain/budget/months";
import { getSupabaseHistoryDashboard } from "@/server/budget/monthly-history";

export const dynamic = "force-dynamic";

type HistoryPageProps = {
  searchParams: Promise<{
    liquidityMonth?: string;
  }>;
};

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const params = await searchParams;
  const currentMonth = getMonthIdForDate();
  const liquidityReferenceMonth = normaliseMonth(params.liquidityMonth ?? currentMonth);
  const historyResult = await getSupabaseHistoryDashboard({
    currentMonth,
    liquidityReferenceMonth,
  })
    .then((dashboard) => ({ dashboard, error: null }))
    .catch((error: unknown) => ({
      dashboard: null,
      error: error instanceof Error ? error.message : "Não foi possível carregar o histórico.",
    }));

  return (
    <div className="relative left-1/2 w-[calc(100vw-32px)] max-w-[1800px] -translate-x-1/2 space-y-6">
      <div>
        <p className="text-sm font-medium text-brand-700">Histórico</p>
        <h1 className="text-2xl font-semibold text-slate-950">Evolução mensal</h1>
      </div>

      {historyResult.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {historyResult.error}
        </div>
      ) : null}

      {historyResult.dashboard ? (
        <HistoryDashboard
          currentMonth={historyResult.dashboard.currentMonth}
          liquidity={historyResult.dashboard.liquidity}
          investments={historyResult.dashboard.investments}
        />
      ) : null}
    </div>
  );
}
