import { daysInMonth, type MonthId } from "./months";
import { assertCents, sumCents, type Cents } from "./money";

export type InvestmentCashFlowType = "contribution" | "redemption";

export type InvestmentCashFlow = {
  id?: string;
  investmentAssetId: string;
  flowType: InvestmentCashFlowType;
  flowDate: string;
  amountCents: Cents;
  note?: string | null;
};

export type InvestmentValuation = {
  id?: string;
  investmentAssetId: string;
  valuationDate: string;
  marketValueCents: Cents;
  note?: string | null;
};

export type DatedCashFlow = {
  date: string;
  amountCents: Cents;
};

export type InvestmentMetrics = {
  investmentAssetId: string;
  totalContributedCents: Cents;
  totalRedeemedCents: Cents;
  netInvestedCents: Cents;
  latestValuation: InvestmentValuation | null;
  marketValueCents: Cents | null;
  gainLossCents: Cents | null;
  simpleReturn: number | null;
  xirr: number | null;
};

export type InvestmentValueSnapshot = {
  investmentAssetId: string;
  valuation: InvestmentValuation | null;
  marketValueCents: Cents | null;
};

export type InvestmentValueTotal = {
  snapshots: InvestmentValueSnapshot[];
  totalMarketValueCents: Cents | null;
  missingValuationAssetIds: string[];
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const XIRR_TOLERANCE = 1e-7;
const XIRR_MAX_ITERATIONS = 100;

function assertIsoDate(date: string) {
  if (!ISO_DATE_PATTERN.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00.000Z`))) {
    throw new Error(`Data inválida: ${date}`);
  }

  return date;
}

function dateToUtcDay(date: string) {
  assertIsoDate(date);
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);

  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function daysBetween(startDate: string, endDate: string) {
  return dateToUtcDay(endDate) - dateToUtcDay(startDate);
}

function compareByDate(left: string, right: string) {
  assertIsoDate(left);
  assertIsoDate(right);

  return left.localeCompare(right);
}

export function getMonthEndDate(month: MonthId) {
  return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}

export function getSignedInvestmentCashFlowAmount(flow: Pick<InvestmentCashFlow, "flowType" | "amountCents">) {
  assertCents(flow.amountCents);

  return flow.flowType === "contribution" ? assertCents(-flow.amountCents) : flow.amountCents;
}

function getCashFlowsForAssetUntil(
  investmentAssetId: string,
  cashFlows: readonly InvestmentCashFlow[],
  asOfDate: string,
) {
  assertIsoDate(asOfDate);

  return cashFlows
    .filter((flow) => flow.investmentAssetId === investmentAssetId && compareByDate(flow.flowDate, asOfDate) <= 0)
    .sort((left, right) => compareByDate(left.flowDate, right.flowDate));
}

export function getLatestEligibleInvestmentValuation(
  investmentAssetId: string,
  valuations: readonly InvestmentValuation[],
  asOfDate: string,
) {
  assertIsoDate(asOfDate);

  return (
    valuations
      .filter(
        (valuation) =>
          valuation.investmentAssetId === investmentAssetId &&
          compareByDate(valuation.valuationDate, asOfDate) <= 0,
      )
      .sort((left, right) => compareByDate(right.valuationDate, left.valuationDate))[0] ?? null
  );
}

export function getInvestmentValueForMonth(
  investmentAssetId: string,
  valuations: readonly InvestmentValuation[],
  month: MonthId,
) {
  return getLatestEligibleInvestmentValuation(investmentAssetId, valuations, getMonthEndDate(month));
}

export function calculateInvestmentValueTotal(
  investmentAssetIds: readonly string[],
  valuations: readonly InvestmentValuation[],
  asOfDate: string,
): InvestmentValueTotal {
  const snapshots = investmentAssetIds.map((investmentAssetId): InvestmentValueSnapshot => {
    const valuation = getLatestEligibleInvestmentValuation(investmentAssetId, valuations, asOfDate);

    return {
      investmentAssetId,
      valuation,
      marketValueCents: valuation?.marketValueCents ?? null,
    };
  });
  const missingValuationAssetIds = snapshots
    .filter((snapshot) => snapshot.marketValueCents === null)
    .map((snapshot) => snapshot.investmentAssetId);

  return {
    snapshots,
    totalMarketValueCents:
      missingValuationAssetIds.length === 0
        ? sumCents(snapshots.map((snapshot) => snapshot.marketValueCents ?? 0))
        : null,
    missingValuationAssetIds,
  };
}

export function calculateInvestmentValueTotalForMonth(
  investmentAssetIds: readonly string[],
  valuations: readonly InvestmentValuation[],
  month: MonthId,
) {
  return calculateInvestmentValueTotal(investmentAssetIds, valuations, getMonthEndDate(month));
}

function toDatedCashFlows(cashFlows: readonly InvestmentCashFlow[]) {
  return cashFlows.map((flow): DatedCashFlow => ({
    date: flow.flowDate,
    amountCents: getSignedInvestmentCashFlowAmount(flow),
  }));
}

function getXnpv(rate: number, cashFlows: readonly DatedCashFlow[]) {
  if (rate <= -1) {
    return Number.NaN;
  }

  const firstDate = cashFlows[0]?.date;

  if (!firstDate) {
    return Number.NaN;
  }

  return cashFlows.reduce((total, flow) => {
    const years = daysBetween(firstDate, flow.date) / 365;

    return total + flow.amountCents / (1 + rate) ** years;
  }, 0);
}

function getXnpvDerivative(rate: number, cashFlows: readonly DatedCashFlow[]) {
  if (rate <= -1) {
    return Number.NaN;
  }

  const firstDate = cashFlows[0]?.date;

  if (!firstDate) {
    return Number.NaN;
  }

  return cashFlows.reduce((total, flow) => {
    const years = daysBetween(firstDate, flow.date) / 365;

    if (years === 0) {
      return total;
    }

    return total - (years * flow.amountCents) / (1 + rate) ** (years + 1);
  }, 0);
}

function dedupeAndSortDatedCashFlows(cashFlows: readonly DatedCashFlow[]) {
  return cashFlows
    .filter((flow) => flow.amountCents !== 0)
    .map((flow) => ({
      date: assertIsoDate(flow.date),
      amountCents: assertCents(flow.amountCents),
    }))
    .sort((left, right) => compareByDate(left.date, right.date));
}

function calculateXirrWithNewton(cashFlows: readonly DatedCashFlow[]) {
  for (const initialGuess of [0.1, 0, -0.25, 0.25, 0.5, 1]) {
    let rate = initialGuess;

    for (let iteration = 0; iteration < XIRR_MAX_ITERATIONS; iteration += 1) {
      const value = getXnpv(rate, cashFlows);
      const derivative = getXnpvDerivative(rate, cashFlows);

      if (!Number.isFinite(value) || !Number.isFinite(derivative) || Math.abs(derivative) < 1e-12) {
        break;
      }

      const nextRate = rate - value / derivative;

      if (!Number.isFinite(nextRate) || nextRate <= -0.999_999) {
        break;
      }

      if (Math.abs(nextRate - rate) < XIRR_TOLERANCE) {
        return nextRate;
      }

      rate = nextRate;
    }
  }

  return null;
}

function calculateXirrWithBisection(cashFlows: readonly DatedCashFlow[]) {
  const sampleRates = [-0.999_999, -0.99, -0.9, -0.75, -0.5, -0.25, -0.1, 0, 0.1, 0.25, 0.5, 1, 2, 5, 10, 50, 100];
  let previousRate = sampleRates[0] ?? -0.999_999;
  let previousValue = getXnpv(previousRate, cashFlows);

  if (Number.isFinite(previousValue) && Math.abs(previousValue) < XIRR_TOLERANCE) {
    return previousRate;
  }

  for (const currentRate of sampleRates.slice(1)) {
    const currentValue = getXnpv(currentRate, cashFlows);

    if (!Number.isFinite(previousValue) || !Number.isFinite(currentValue)) {
      previousRate = currentRate;
      previousValue = currentValue;
      continue;
    }

    if (Math.abs(currentValue) < XIRR_TOLERANCE) {
      return currentRate;
    }

    if (Math.sign(previousValue) !== Math.sign(currentValue)) {
      let lowRate = previousRate;
      let highRate = currentRate;
      let lowValue = previousValue;

      for (let iteration = 0; iteration < XIRR_MAX_ITERATIONS; iteration += 1) {
        const middleRate = (lowRate + highRate) / 2;
        const middleValue = getXnpv(middleRate, cashFlows);

        if (!Number.isFinite(middleValue)) {
          return null;
        }

        if (Math.abs(middleValue) < XIRR_TOLERANCE || Math.abs(highRate - lowRate) < XIRR_TOLERANCE) {
          return middleRate;
        }

        if (Math.sign(lowValue) === Math.sign(middleValue)) {
          lowRate = middleRate;
          lowValue = middleValue;
        } else {
          highRate = middleRate;
        }
      }

      return (lowRate + highRate) / 2;
    }

    previousRate = currentRate;
    previousValue = currentValue;
  }

  return null;
}

export function calculateXirr(cashFlows: readonly DatedCashFlow[]) {
  const sortedCashFlows = dedupeAndSortDatedCashFlows(cashFlows);
  const hasPositiveFlow = sortedCashFlows.some((flow) => flow.amountCents > 0);
  const hasNegativeFlow = sortedCashFlows.some((flow) => flow.amountCents < 0);

  if (sortedCashFlows.length < 2 || !hasPositiveFlow || !hasNegativeFlow) {
    return null;
  }

  return calculateXirrWithNewton(sortedCashFlows) ?? calculateXirrWithBisection(sortedCashFlows);
}

export function calculateInvestmentMetrics({
  investmentAssetId,
  cashFlows,
  valuations,
  asOfDate,
}: {
  investmentAssetId: string;
  cashFlows: readonly InvestmentCashFlow[];
  valuations: readonly InvestmentValuation[];
  asOfDate: string;
}): InvestmentMetrics {
  assertIsoDate(asOfDate);
  const eligibleCashFlows = getCashFlowsForAssetUntil(investmentAssetId, cashFlows, asOfDate);
  const latestValuation = getLatestEligibleInvestmentValuation(investmentAssetId, valuations, asOfDate);
  const totalContributedCents = sumCents(
    eligibleCashFlows
      .filter((flow) => flow.flowType === "contribution")
      .map((flow) => flow.amountCents),
  );
  const totalRedeemedCents = sumCents(
    eligibleCashFlows
      .filter((flow) => flow.flowType === "redemption")
      .map((flow) => flow.amountCents),
  );
  const netInvestedCents = assertCents(totalContributedCents - totalRedeemedCents);
  const marketValueCents = latestValuation?.marketValueCents ?? null;
  const gainLossCents =
    marketValueCents === null
      ? null
      : assertCents(marketValueCents + totalRedeemedCents - totalContributedCents);
  const xirrFlows = [
    ...toDatedCashFlows(eligibleCashFlows),
    ...(marketValueCents === null ? [] : [{ date: asOfDate, amountCents: marketValueCents }]),
  ];

  return {
    investmentAssetId,
    totalContributedCents,
    totalRedeemedCents,
    netInvestedCents,
    latestValuation,
    marketValueCents,
    gainLossCents,
    simpleReturn:
      gainLossCents === null || totalContributedCents === 0 ? null : gainLossCents / totalContributedCents,
    xirr: calculateXirr(xirrFlows),
  };
}

export function calculateGlobalInvestmentMetrics({
  investmentAssetIds,
  cashFlows,
  valuations,
  asOfDate,
}: {
  investmentAssetIds: readonly string[];
  cashFlows: readonly InvestmentCashFlow[];
  valuations: readonly InvestmentValuation[];
  asOfDate: string;
}): InvestmentMetrics {
  assertIsoDate(asOfDate);
  const metrics = investmentAssetIds.map((investmentAssetId) =>
    calculateInvestmentMetrics({
      investmentAssetId,
      cashFlows,
      valuations,
      asOfDate,
    }),
  );
  const totalContributedCents = sumCents(metrics.map((metric) => metric.totalContributedCents));
  const totalRedeemedCents = sumCents(metrics.map((metric) => metric.totalRedeemedCents));
  const netInvestedCents = assertCents(totalContributedCents - totalRedeemedCents);
  const valueTotal = calculateInvestmentValueTotal(investmentAssetIds, valuations, asOfDate);
  const marketValueCents = valueTotal.totalMarketValueCents;
  const gainLossCents =
    marketValueCents === null
      ? null
      : assertCents(marketValueCents + totalRedeemedCents - totalContributedCents);
  const terminalFlows = valueTotal.snapshots.flatMap((snapshot): DatedCashFlow[] =>
    snapshot.marketValueCents === null ? [] : [{ date: asOfDate, amountCents: snapshot.marketValueCents }],
  );
  const eligibleCashFlows = cashFlows.filter(
    (flow) => investmentAssetIds.includes(flow.investmentAssetId) && compareByDate(flow.flowDate, asOfDate) <= 0,
  );

  return {
    investmentAssetId: "global",
    totalContributedCents,
    totalRedeemedCents,
    netInvestedCents,
    latestValuation: null,
    marketValueCents,
    gainLossCents,
    simpleReturn:
      gainLossCents === null || totalContributedCents === 0 ? null : gainLossCents / totalContributedCents,
    xirr: calculateXirr([...toDatedCashFlows(eligibleCashFlows), ...terminalFlows]),
  };
}
