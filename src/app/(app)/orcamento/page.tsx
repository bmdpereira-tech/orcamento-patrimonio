import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { MonthlyBudgetTable } from "@/components/monthly-budget-table";
import { SummaryCard } from "@/components/summary-card";
import { UI_TEXT } from "@/content/ui-text";
import { FIRST_MONTH, addMonths, formatMonthLabel, getMonthIdForDate, normaliseMonth } from "@/domain/budget/months";
import { formatEuroCents } from "@/domain/budget/money";
import { getSupabaseBudgetOverview } from "@/server/budget/monthly-overview";
import {
  addCustomBudgetItemAction,
  deleteCustomBudgetItemAction,
  saveMonthlyBudgetAction,
  setCreditCardStatementOverrideAction,
  setDirectDebitForecastExclusionAction,
  setSalaryMonthOverrideAction,
} from "./actions";

export const dynamic = "force-dynamic";

type BudgetPageProps = {
  searchParams: Promise<{
    month?: string;
    status?: string;
    erro?: string;
  }>;
};

const statusMessages: Record<string, string> = {
  saved: "Orçamento guardado com sucesso.",
  "line-added": "Linha adicionada com sucesso.",
  "line-deleted": "Linha eliminada com sucesso.",
};

export default async function BudgetPage({ searchParams }: BudgetPageProps) {
  const params = await searchParams;
  const currentMonth = normaliseMonth(getMonthIdForDate());
  const month = normaliseMonth(params.month ?? currentMonth);
  const previousMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);
  const canGoPrevious = previousMonth >= FIRST_MONTH;
  const statusMessage = params.status ? statusMessages[params.status] : undefined;
  const overviewResult = await getSupabaseBudgetOverview(month)
    .then((overview) => ({ overview, error: null }))
    .catch((error: unknown) => ({
      overview: null,
      error: error instanceof Error ? error.message : "Não foi possível carregar o orçamento.",
    }));

  return (
    <div className="relative left-1/2 w-[calc(100vw-32px)] max-w-[1800px] -translate-x-1/2 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-700">{UI_TEXT.budget.monthlyBudget}</p>
          <h1 className="text-2xl font-semibold text-slate-950">{formatMonthLabel(month)}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={canGoPrevious ? `/orcamento?month=${previousMonth}` : `/orcamento?month=${FIRST_MONTH}`}
            aria-disabled={!canGoPrevious}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{UI_TEXT.budget.previousMonth}</span>
          </Link>

          <form className="flex items-center gap-2" action="/orcamento">
            <label htmlFor="month" className="sr-only">
              {UI_TEXT.budget.month}
            </label>
            <input
              id="month"
              name="month"
              type="month"
              min={FIRST_MONTH}
              defaultValue={month}
              className="h-10 rounded-md border-slate-300 bg-white text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-600"
            />
            <button className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              Ir
            </button>
          </form>

          <Link
            href={`/orcamento?month=${nextMonth}`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{UI_TEXT.budget.nextMonth}</span>
          </Link>

          <Link
            href={`/orcamento?month=${currentMonth}`}
            className="inline-flex h-10 items-center rounded-md bg-brand-700 px-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-900"
          >
            {UI_TEXT.budget.currentMonth}
          </Link>
        </div>
      </div>

      {statusMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {statusMessage}
        </div>
      ) : null}

      {params.erro ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{params.erro}</div>
      ) : null}

      {overviewResult.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {overviewResult.error}
        </div>
      ) : null}

      {overviewResult.overview ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <SummaryCard
              label={UI_TEXT.summary.currentLiquidity}
              value={formatEuroCents(overviewResult.overview.liquidityCurrentCents)}
            />
            <SummaryCard
              label={UI_TEXT.summary.finalLiquidity}
              value={formatEuroCents(overviewResult.overview.liquidityFinalCents)}
            />
            <SummaryCard
              label={UI_TEXT.summary.forecasts}
              value={formatEuroCents(overviewResult.overview.remainingExpenseForecastsCents)}
            />
            <SummaryCard
              label={UI_TEXT.summary.creditCardDebt}
              value={formatEuroCents(overviewResult.overview.creditCardDebtCents)}
            />
            <SummaryCard
              label={UI_TEXT.summary.investments}
              value={formatEuroCents(overviewResult.overview.investmentTotalCents)}
            />
            <SummaryCard
              label={UI_TEXT.summary.netWorth}
              value={formatEuroCents(overviewResult.overview.netWorthCents)}
            />
          </div>

          <MonthlyBudgetTable
            overview={overviewResult.overview}
            editable
            saveBudgetAction={saveMonthlyBudgetAction}
            addCustomItemAction={addCustomBudgetItemAction}
            deleteCustomItemAction={deleteCustomBudgetItemAction}
            setDirectDebitExcludedAction={setDirectDebitForecastExclusionAction}
            setCreditCardStatementOverrideAction={setCreditCardStatementOverrideAction}
            setSalaryMonthOverrideAction={setSalaryMonthOverrideAction}
          />
        </>
      ) : null}
    </div>
  );
}
