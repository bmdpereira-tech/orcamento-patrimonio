"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  filterMonthsForLiquidityPeriod,
  filterMonthsForHistoryPeriod,
  type HistoryPeriod,
  type InvestmentXirrHistory,
  type MonthlyLiquidityHistoryPoint,
} from "@/domain/budget/monthly-history";
import { formatEuroCents } from "@/domain/budget/money";
import { FIRST_MONTH, formatMonthLabel, type MonthId } from "@/domain/budget/months";
import { cn } from "@/lib/cn";

type HistoryDashboardProps = {
  currentMonth: MonthId;
  liquidity: {
    referenceMonth: MonthId;
    months: MonthId[];
    points: MonthlyLiquidityHistoryPoint[];
  };
  investments: InvestmentXirrHistory;
};

const investmentPeriodOptions: readonly { value: HistoryPeriod; label: string }[] = [
  { value: "last-12", label: "12 meses" },
  { value: "ytd", label: "YTD" },
  { value: "current-year", label: "Ano em curso" },
];
const liquidityPeriodOptions: readonly { value: HistoryPeriod; label: string }[] = [
  { value: "last-12", label: "12 meses" },
  { value: "ytd", label: "YTD" },
  { value: "current-year", label: "Ano" },
];

const investmentLineColors = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#ea580c",
  "#4f46e5",
] as const;

function formatCompactEuroCents(amountCents: number) {
  if (!Number.isFinite(amountCents)) {
    return "–";
  }

  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amountCents / 100);
}

function formatEuroChartValue(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numberValue) ? formatEuroCents(Math.round(numberValue * 100)) : "–";
}

function formatPercentChartValue(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return "–";
  }

  return `${new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numberValue)}%`;
}

function PeriodSelector({
  value,
  onChange,
  ariaLabel,
  options,
}: {
  value: HistoryPeriod;
  onChange: (value: HistoryPeriod) => void;
  ariaLabel: string;
  options: readonly { value: HistoryPeriod; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-8 rounded px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50",
            value === option.value && "bg-brand-700 text-white hover:bg-brand-700",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function monthShortLabel(month: MonthId) {
  const [year, monthNumber] = month.split("-");
  const date = new Date(Date.UTC(Number(year), Number(monthNumber) - 1, 1));

  return new Intl.DateTimeFormat("pt-PT", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function filterLiquidityPoints({
  points,
  months,
  period,
  referenceMonth,
}: {
  points: readonly MonthlyLiquidityHistoryPoint[];
  months: readonly MonthId[];
  period: HistoryPeriod;
  referenceMonth: MonthId;
}) {
  const selectedMonths = new Set(filterMonthsForLiquidityPeriod(months, period, referenceMonth));

  return points.filter((point) => selectedMonths.has(point.month));
}

function buildLiquidityChartData(points: readonly MonthlyLiquidityHistoryPoint[]) {
  return points.map((point) => ({
    month: point.month,
    label: monthShortLabel(point.month),
    fullLabel: formatMonthLabel(point.month),
    variacaoMensal: point.variacaoMensalCents / 100,
    saldoFinalTotal: point.saldoFinalTotalCents / 100,
    variacaoMensalCents: point.variacaoMensalCents,
    saldoFinalTotalCents: point.saldoFinalTotalCents,
  }));
}

type LiquidityChartPoint = ReturnType<typeof buildLiquidityChartData>[number];

function getVariationAxisDomain(points: readonly LiquidityChartPoint[]) {
  if (points.length === 0) {
    return [-1, 1] as [number, number];
  }

  const values = points.map((point) => point.variacaoMensal);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);

  return min === 0 && max === 0 ? ([-1, 1] as [number, number]) : ([min, max] as [number, number]);
}

function buildInvestmentChartData({
  history,
  period,
  currentMonth,
}: {
  history: InvestmentXirrHistory;
  period: HistoryPeriod;
  currentMonth: MonthId;
}) {
  const selectedMonths = filterMonthsForHistoryPeriod(history.months, period, currentMonth);

  return selectedMonths.map((month) => {
    const row: Record<string, string | number | null> = {
      month,
      label: monthShortLabel(month),
      fullLabel: formatMonthLabel(month),
    };

    for (const series of history.series) {
      const point = series.points.find((candidate) => candidate.month === month);
      row[series.id] = point?.xirr === null || point?.xirr === undefined ? null : point.xirr * 100;
    }

    return row;
  });
}

export function HistoryDashboard({ currentMonth, liquidity, investments }: HistoryDashboardProps) {
  const [liquidityPeriod, setLiquidityPeriod] = useState<HistoryPeriod>("last-12");
  const [investmentPeriod, setInvestmentPeriod] = useState<HistoryPeriod>("last-12");
  const liquidityPoints = useMemo(
    () =>
      filterLiquidityPoints({
        points: liquidity.points,
        months: liquidity.months,
        period: liquidityPeriod,
        referenceMonth: liquidity.referenceMonth,
      }),
    [liquidity.months, liquidity.points, liquidity.referenceMonth, liquidityPeriod],
  );
  const liquidityChartData = useMemo(() => buildLiquidityChartData(liquidityPoints), [liquidityPoints]);
  const variationAxisDomain = useMemo(() => getVariationAxisDomain(liquidityChartData), [liquidityChartData]);
  const investmentChartData = useMemo(
    () =>
      buildInvestmentChartData({
        history: investments,
        period: investmentPeriod,
        currentMonth,
      }),
    [currentMonth, investmentPeriod, investments],
  );

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <h2 className="text-base font-semibold text-slate-950">Liquidez e saldo mensal</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
            <form action="/historico" className="flex items-end gap-2">
              <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                Mês de referência
                <input
                  type="month"
                  name="liquidityMonth"
                  min={FIRST_MONTH}
                  defaultValue={liquidity.referenceMonth}
                  className="h-8 rounded-md border-slate-300 bg-white text-sm font-normal normal-case text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-600"
                />
              </label>
              <button
                type="submit"
                className="inline-flex h-8 items-center rounded-md bg-brand-700 px-3 text-xs font-semibold text-white shadow-sm hover:bg-brand-900"
              >
                Ir
              </button>
            </form>
            <PeriodSelector
              value={liquidityPeriod}
              onChange={setLiquidityPeriod}
              ariaLabel="Período do histórico de liquidez"
              options={liquidityPeriodOptions}
            />
          </div>
        </div>

        {liquidityChartData.length === 0 ? (
          <p className="text-sm text-slate-700">Ainda não existem meses disponíveis para apresentar.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="h-[320px] min-w-[720px]" role="img" aria-label="Gráfico de barras de variação mensal e linha de saldo final">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={liquidityChartData} margin={{ top: 12, right: 20, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    tickFormatter={(value) => formatCompactEuroCents(Math.round(Number(value) * 100))}
                    tickLine={false}
                    axisLine={false}
                    width={82}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={variationAxisDomain}
                    tickFormatter={(value) => formatCompactEuroCents(Math.round(Number(value) * 100))}
                    tickLine={false}
                    axisLine={false}
                    width={82}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      formatEuroChartValue(value),
                      name === "variacaoMensal" || name === "Variação mensal" ? "Variação mensal" : "Saldo final",
                    ]}
                    labelFormatter={(label) => String(label)}
                  />
                  <Legend />
                  <Bar yAxisId="right" dataKey="variacaoMensal" name="Variação mensal" radius={[4, 4, 0, 0]}>
                    {liquidityChartData.map((point) => (
                      <Cell
                        key={point.month}
                        fill={point.variacaoMensalCents >= 0 ? "#16a34a" : "#dc2626"}
                      />
                    ))}
                  </Bar>
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="saldoFinalTotal"
                    name="Saldo final"
                    stroke="#0f172a"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-slate-950">Rentabilidade dos investimentos (XIRR)</h2>
          <PeriodSelector
            value={investmentPeriod}
            onChange={setInvestmentPeriod}
            ariaLabel="Período do histórico de investimentos"
            options={investmentPeriodOptions}
          />
        </div>

        {investmentChartData.length === 0 || investments.series.length === 0 ? (
          <p className="text-sm text-slate-700">Ainda não existem dados de investimentos para apresentar.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="h-[340px] min-w-[760px]" role="img" aria-label="Gráfico de linhas da XIRR mensal por investimento">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={investmentChartData} margin={{ top: 12, right: 18, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis
                    tickFormatter={(value) => `${new Intl.NumberFormat("pt-PT", {
                      maximumFractionDigits: 0,
                    }).format(Number(value))}%`}
                    tickLine={false}
                    axisLine={false}
                    width={64}
                  />
                  <Tooltip
                    formatter={(value, name) => [formatPercentChartValue(value), name]}
                    labelFormatter={(label) => String(label)}
                  />
                  <Legend />
                  {investments.series.map((series, index) => (
                    <Line
                      key={series.id}
                      type="monotone"
                      dataKey={series.id}
                      name={series.name}
                      stroke={series.isGlobal ? "#0f172a" : investmentLineColors[index % investmentLineColors.length]}
                      strokeWidth={series.isGlobal ? 3 : 2}
                      dot={{ r: series.isGlobal ? 3 : 2 }}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
