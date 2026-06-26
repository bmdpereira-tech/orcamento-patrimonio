import { formatMonthLabel, type MonthId } from "./months";

export const HISTORICAL_IMPACT_TIME_ZONE = "Europe/Lisbon";

export type HistoricalImpactCheck = {
  firstAffectedMonth?: MonthId | null;
  confirmHistoricalImpact?: boolean;
  referenceDate?: Date;
};

export type HistoricalImpactDecision =
  | {
      requiresConfirmation: false;
      currentMonth: MonthId;
    }
  | {
      requiresConfirmation: true;
      firstAffectedMonth: MonthId;
      currentMonth: MonthId;
      monthLabel: string;
      message: string;
      affectsFollowingMonths: true;
    };

export type HistoricalImpactRequiredActionResult = {
  ok: false;
  requiresConfirmation: true;
  firstAffectedMonth: MonthId;
  monthLabel: string;
  message: string;
  affectsFollowingMonths: true;
};

export type HistoricalActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; requiresConfirmation?: false }
  | HistoricalImpactRequiredActionResult;

export function getMonthIdInTimeZone(
  date = new Date(),
  timeZone = HISTORICAL_IMPACT_TIME_ZONE,
): MonthId {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone,
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  if (!year || !month) {
    throw new Error("Não foi possível determinar o mês actual.");
  }

  return `${year}-${month}` as MonthId;
}

export function buildHistoricalImpactMessage(firstAffectedMonth: MonthId) {
  return `Esta alteração afecta ${formatMonthLabel(firstAffectedMonth)} e pode recalcular os saldos transportados dos meses seguintes. Pretende continuar?`;
}

export function evaluateHistoricalImpact({
  firstAffectedMonth,
  confirmHistoricalImpact = false,
  referenceDate = new Date(),
}: HistoricalImpactCheck): HistoricalImpactDecision {
  const currentMonth = getMonthIdInTimeZone(referenceDate);

  if (!firstAffectedMonth || confirmHistoricalImpact || firstAffectedMonth >= currentMonth) {
    return { requiresConfirmation: false, currentMonth };
  }

  return {
    requiresConfirmation: true,
    firstAffectedMonth,
    currentMonth,
    monthLabel: formatMonthLabel(firstAffectedMonth),
    message: buildHistoricalImpactMessage(firstAffectedMonth),
    affectsFollowingMonths: true,
  };
}

export function toHistoricalImpactActionResult(
  decision: HistoricalImpactDecision,
): HistoricalImpactRequiredActionResult | null {
  if (!decision.requiresConfirmation) {
    return null;
  }

  return {
    ok: false,
    requiresConfirmation: true,
    firstAffectedMonth: decision.firstAffectedMonth,
    monthLabel: decision.monthLabel,
    message: decision.message,
    affectsFollowingMonths: decision.affectsFollowingMonths,
  };
}

export function isHistoricalImpactActionResult(
  result: { ok: boolean; requiresConfirmation?: boolean },
): result is HistoricalImpactRequiredActionResult {
  return result.ok === false && result.requiresConfirmation === true;
}

export function minMonth(
  ...months: Array<MonthId | null | undefined>
): MonthId | null {
  const validMonths = months.filter((month): month is MonthId => Boolean(month));

  if (validMonths.length === 0) {
    return null;
  }

  return validMonths.reduce((earliest, month) => (month < earliest ? month : earliest));
}
