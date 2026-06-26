import { getAccountDisplayName, type LiquidityAccount } from "./accounts";
import { assertCents, sumCents, type Cents } from "./money";
import { daysInMonth, type MonthId } from "./months";
import { monthlySourceAmountKey } from "./monthly-snapshots";

export const PORTUGAL_TIME_ZONE = "Europe/Lisbon";

export type DailyBudgetVersion = {
  id?: string;
  effectiveFromMonth: MonthId;
  dailyAmountCents: Cents;
  accountId: string;
  createdAt?: string;
  updatedAt?: string;
};

export type DailyBudgetVersionInput = {
  effectiveFromMonth: MonthId;
  dailyAmountCents: Cents;
  accountId: string;
};

export type DailyBudgetForecast = {
  month: MonthId;
  version: DailyBudgetVersion | null;
  accountId: string | null;
  accountName?: string;
  dailyAmountCents: Cents;
  consideredDays: number;
  amountCents: Cents;
};

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

export function getMonthIdInPortugal(date: Date, timeZone = PORTUGAL_TIME_ZONE): MonthId {
  const { year, month } = getDatePartsInTimeZone(date, timeZone);

  return `${year}-${String(month).padStart(2, "0")}` as MonthId;
}

export function getDayOfMonthInPortugal(date: Date, timeZone = PORTUGAL_TIME_ZONE) {
  return getDatePartsInTimeZone(date, timeZone).day;
}

export function validateDailyBudgetVersionInput(input: DailyBudgetVersionInput) {
  if (!input.accountId.trim()) {
    throw new Error("Indique uma conta.");
  }

  if (!input.effectiveFromMonth) {
    throw new Error("Indique o mês de entrada em vigor.");
  }

  if (input.dailyAmountCents < 0) {
    throw new Error("O plafond diário não pode ser negativo.");
  }

  assertCents(input.dailyAmountCents);
}

export function findApplicableDailyBudgetVersion(
  versions: readonly DailyBudgetVersion[],
  month: MonthId,
) {
  return [...versions]
    .filter((version) => version.effectiveFromMonth <= month)
    .sort((left, right) => right.effectiveFromMonth.localeCompare(left.effectiveFromMonth))[0] ?? null;
}

export function calculateDailyBudgetDays({
  month,
  referenceDate,
  timeZone = PORTUGAL_TIME_ZONE,
}: {
  month: MonthId;
  referenceDate: Date;
  timeZone?: string;
}) {
  const currentMonth = getMonthIdInPortugal(referenceDate, timeZone);

  if (month < currentMonth) {
    return 0;
  }

  if (month > currentMonth) {
    return daysInMonth(month);
  }

  return daysInMonth(month) - getDayOfMonthInPortugal(referenceDate, timeZone) + 1;
}

export function calculateDailyBudgetForecast({
  versions,
  accounts = [],
  month,
  referenceDate,
  timeZone = PORTUGAL_TIME_ZONE,
}: {
  versions: readonly DailyBudgetVersion[];
  accounts?: readonly LiquidityAccount[];
  month: MonthId;
  referenceDate: Date;
  timeZone?: string;
}): DailyBudgetForecast {
  const version = findApplicableDailyBudgetVersion(versions, month);
  const consideredDays = version ? calculateDailyBudgetDays({ month, referenceDate, timeZone }) : 0;
  const account = version ? accounts.find((candidate) => candidate.id === version.accountId) : undefined;

  return {
    month,
    version,
    accountId: version?.accountId ?? null,
    accountName: account ? getAccountDisplayName(account) : undefined,
    dailyAmountCents: version?.dailyAmountCents ?? 0,
    consideredDays,
    amountCents: version ? assertCents(-sumCents(Array.from({ length: consideredDays }, () => version.dailyAmountCents))) : 0,
  };
}

export function buildDailyBudgetSourceAmountMap({
  versions,
  months,
  referenceDate,
  timeZone = PORTUGAL_TIME_ZONE,
}: {
  versions: readonly DailyBudgetVersion[];
  months: readonly MonthId[];
  referenceDate: Date;
  timeZone?: string;
}) {
  const amountBySource = new Map<string, Cents>();

  for (const month of months) {
    const forecast = calculateDailyBudgetForecast({ versions, month, referenceDate, timeZone });

    if (!forecast.accountId || forecast.amountCents === 0) {
      continue;
    }

    amountBySource.set(monthlySourceAmountKey(month, "day_to_day", forecast.accountId), forecast.amountCents);
  }

  return amountBySource;
}
