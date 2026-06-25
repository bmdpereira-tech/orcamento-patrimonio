import { daysInMonth, addMonths, FIRST_MONTH, type MonthId } from "./months";
import { assertCents, sumCents, type Cents } from "./money";
import { monthlySourceAmountKey } from "./monthly-snapshots";

export type RecurringRuleFrequency = "monthly" | "quarterly" | "semiannual" | "annual";

export type RecurringRule = {
  id: string;
  description: string;
  accountId: string;
  amountCents: Cents;
  chargeDay: number;
  frequency: RecurringRuleFrequency;
  startMonth: MonthId;
  endMonth?: MonthId;
  active: boolean;
  archivedAt?: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type RecurringRuleAccountCandidate = {
  id: string;
  archivedFromMonth?: MonthId;
};

export type RecurringRuleMonthState = {
  id?: string;
  recurringRuleId: string;
  month: MonthId;
  excludedFromForecast: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type MonthlyDirectDebitOccurrence = {
  ruleId: string;
  month: MonthId;
  description: string;
  accountId: string;
  accountName?: string;
  accountSortOrder?: number;
  amountCents: Cents;
  chargeDay: number;
  excludedFromForecast: boolean;
};

export type RecurringRuleInput = {
  description: string;
  accountId: string;
  amountCents: Cents;
  chargeDay: number;
  frequency?: RecurringRuleFrequency;
  startMonth: MonthId;
  endMonth?: MonthId;
  active: boolean;
  sortOrder: number;
};

export function monthRangeUntil(targetMonth: MonthId, startMonth: MonthId = FIRST_MONTH as MonthId) {
  const months: MonthId[] = [];
  let cursor = startMonth;

  while (cursor <= targetMonth) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }

  return months;
}

export function validateRecurringRuleInput(input: RecurringRuleInput) {
  if (!input.description.trim()) {
    throw new Error("Indique uma descrição.");
  }

  if (!input.accountId.trim()) {
    throw new Error("Seleccione uma conta.");
  }

  if (input.amountCents <= 0) {
    throw new Error("O montante deve ser superior a zero.");
  }

  assertCents(input.amountCents);

  if (!Number.isInteger(input.chargeDay) || input.chargeDay < 1 || input.chargeDay > 31) {
    throw new Error("O dia de cobrança deve estar entre 1 e 31.");
  }

  if (!input.startMonth) {
    throw new Error("Indique o mês de início.");
  }

  if (input.endMonth && input.endMonth < input.startMonth) {
    throw new Error("A data de fim não pode ser anterior à data de início.");
  }
}

export function validateRecurringRuleAccountSelection({
  accounts,
  accountId,
  previousAccountId,
}: {
  accounts: readonly RecurringRuleAccountCandidate[];
  accountId: string;
  previousAccountId?: string;
}) {
  const account = accounts.find((candidate) => candidate.id === accountId);

  if (!account) {
    throw new Error("A conta seleccionada já não está disponível. Escolha outra conta.");
  }

  if (account.archivedFromMonth && account.id !== previousAccountId) {
    throw new Error("A conta seleccionada já não está activa. Escolha outra conta.");
  }
}

export function isRecurringRuleApplicableToMonth(rule: RecurringRule, month: MonthId) {
  return (
    rule.frequency === "monthly" &&
    rule.active &&
    !rule.archivedAt &&
    month >= rule.startMonth &&
    (!rule.endMonth || month <= rule.endMonth)
  );
}

export function getRecurringRuleChargeDate(rule: Pick<RecurringRule, "chargeDay">, month: MonthId) {
  const day = Math.min(rule.chargeDay, daysInMonth(month));

  return `${month}-${String(day).padStart(2, "0")}`;
}

export function recurringRuleMonthStateKey(ruleId: string, month: MonthId) {
  return `${ruleId}:${month}`;
}

export function buildRecurringRuleMonthStateMap(states: readonly RecurringRuleMonthState[]) {
  return new Map(states.map((state) => [recurringRuleMonthStateKey(state.recurringRuleId, state.month), state]));
}

export function isRecurringRuleExcludedFromForecast(
  ruleId: string,
  month: MonthId,
  statesByRuleMonth: ReadonlyMap<string, RecurringRuleMonthState> = new Map(),
) {
  return statesByRuleMonth.get(recurringRuleMonthStateKey(ruleId, month))?.excludedFromForecast === true;
}

export function isRecurringRuleForecastedInMonth(
  rule: RecurringRule,
  month: MonthId,
  statesByRuleMonth: ReadonlyMap<string, RecurringRuleMonthState> = new Map(),
) {
  return isRecurringRuleApplicableToMonth(rule, month) && !isRecurringRuleExcludedFromForecast(rule.id, month, statesByRuleMonth);
}

export function sumRecurringDebitsByAccount(
  rules: readonly RecurringRule[],
  month: MonthId,
  statesByRuleMonth: ReadonlyMap<string, RecurringRuleMonthState> = new Map(),
) {
  const totals = new Map<string, Cents>();

  for (const rule of rules) {
    if (!isRecurringRuleForecastedInMonth(rule, month, statesByRuleMonth)) {
      continue;
    }

    const currentTotal = totals.get(rule.accountId) ?? 0;
    totals.set(rule.accountId, sumCents([currentTotal, -Math.abs(rule.amountCents)]));
  }

  return totals;
}

export function buildRecurringDebitSourceAmountMap(
  rules: readonly RecurringRule[],
  months: readonly MonthId[],
  states: readonly RecurringRuleMonthState[] = [],
) {
  const amountBySource = new Map<string, Cents>();
  const statesByRuleMonth = buildRecurringRuleMonthStateMap(states);

  for (const month of months) {
    const totals = sumRecurringDebitsByAccount(rules, month, statesByRuleMonth);

    for (const [accountId, amountCents] of totals) {
      amountBySource.set(monthlySourceAmountKey(month, "direct_debits", accountId), amountCents);
    }
  }

  return amountBySource;
}

export function buildMonthlyDirectDebitOccurrences(
  rules: readonly RecurringRule[],
  month: MonthId,
  states: readonly RecurringRuleMonthState[] = [],
): MonthlyDirectDebitOccurrence[] {
  const statesByRuleMonth = buildRecurringRuleMonthStateMap(states);

  return rules
    .filter((rule) => isRecurringRuleApplicableToMonth(rule, month))
    .map((rule) => ({
      ruleId: rule.id,
      month,
      description: rule.description,
      accountId: rule.accountId,
      amountCents: rule.amountCents,
      chargeDay: rule.chargeDay,
      excludedFromForecast: isRecurringRuleExcludedFromForecast(rule.id, month, statesByRuleMonth),
    }));
}

export function canDeleteRecurringRule({
  rule,
  referenceMonth,
  hasOccurrenceOverrides = false,
}: {
  rule: Pick<RecurringRule, "startMonth">;
  referenceMonth: MonthId;
  hasOccurrenceOverrides?: boolean;
}) {
  if (hasOccurrenceOverrides) {
    return {
      allowed: false,
      reason: "Este débito directo tem excepções mensais associadas. Arquive-o para preservar o histórico.",
    };
  }

  if (rule.startMonth <= referenceMonth) {
    return {
      allowed: false,
      reason: "Este débito directo já pode afectar meses históricos. Arquive-o para preservar os dados.",
    };
  }

  return { allowed: true, reason: null };
}
