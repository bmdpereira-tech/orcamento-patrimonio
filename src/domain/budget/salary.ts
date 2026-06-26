import { getAccountDisplayName, type LiquidityAccount } from "./accounts";
import { assertCents, type Cents } from "./money";
import type { MonthId } from "./months";
import { monthlySourceAmountKey } from "./monthly-snapshots";

export type SalaryStatus = "planned" | "received" | "cancelled";

export type SalaryVersion = {
  id?: string;
  effectiveFromMonth: MonthId;
  amountCents: Cents;
  accountId: string;
  vacationBonusCents: Cents;
  vacationBonusMonth: number;
  christmasBonusCents: Cents;
  christmasBonusMonth: number;
  createdAt?: string;
  updatedAt?: string;
};

export type SalaryVersionInput = {
  effectiveFromMonth: MonthId;
  amountCents: Cents;
  accountId: string;
  vacationBonusCents: Cents;
  vacationBonusMonth: number;
  christmasBonusCents: Cents;
  christmasBonusMonth: number;
};

export type SalaryMonthOverride = {
  id?: string;
  month: MonthId;
  status?: SalaryStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type MonthlySalaryForecast = {
  month: MonthId;
  version: SalaryVersion | null;
  accountId: string | null;
  accountName?: string;
  baseAmountCents: Cents;
  amountBeforeStatusCents: Cents;
  amountCents: Cents;
  reflectedInCurrentBalance: boolean;
  status: SalaryStatus | null;
};

export function validateSalaryVersionInput(input: SalaryVersionInput) {
  if (!input.accountId.trim()) {
    throw new Error("Indique a conta de recebimento.");
  }

  if (!input.effectiveFromMonth) {
    throw new Error("Indique o mês de entrada em vigor.");
  }

  for (const [label, amount] of [
    ["O salário mensal", input.amountCents],
    ["O subsídio de férias", input.vacationBonusCents],
    ["O subsídio de Natal", input.christmasBonusCents],
  ] as const) {
    if (amount < 0) {
      throw new Error(`${label} não pode ser negativo.`);
    }

    assertCents(amount);
  }

  for (const [label, month] of [
    ["mês do subsídio de férias", input.vacationBonusMonth],
    ["mês do subsídio de Natal", input.christmasBonusMonth],
  ] as const) {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error(`Indique um ${label} válido.`);
    }
  }

  if (input.vacationBonusMonth === input.christmasBonusMonth) {
    throw new Error("Os subsídios de férias e de Natal não podem estar configurados para o mesmo mês.");
  }
}

export function salaryMonthOverrideKey(month: MonthId) {
  return month;
}

export function buildSalaryMonthOverrideMap(overrides: readonly SalaryMonthOverride[]) {
  return new Map(overrides.map((override) => [salaryMonthOverrideKey(override.month), override]));
}

export function findApplicableSalaryVersion(versions: readonly SalaryVersion[], month: MonthId) {
  return [...versions]
    .filter((version) => version.effectiveFromMonth <= month)
    .sort((left, right) => right.effectiveFromMonth.localeCompare(left.effectiveFromMonth))[0] ?? null;
}

export function getMonthNumber(month: MonthId) {
  return Number(month.slice(5, 7));
}

export function calculateBaseSalaryAmount(version: SalaryVersion, month: MonthId) {
  const monthNumber = getMonthNumber(month);

  if (monthNumber === version.vacationBonusMonth) {
    return version.vacationBonusCents;
  }

  if (monthNumber === version.christmasBonusMonth) {
    return version.christmasBonusCents;
  }

  return version.amountCents;
}

function isStatusExcludedFromForecast(status?: SalaryStatus) {
  return status === "received" || status === "cancelled";
}

export function calculateMonthlySalaryForecast({
  versions,
  overrides = [],
  accounts = [],
  month,
}: {
  versions: readonly SalaryVersion[];
  overrides?: readonly SalaryMonthOverride[];
  accounts?: readonly LiquidityAccount[];
  month: MonthId;
}): MonthlySalaryForecast {
  const version = findApplicableSalaryVersion(versions, month);
  const override = buildSalaryMonthOverrideMap(overrides).get(salaryMonthOverrideKey(month));
  const accountId = version?.accountId ?? null;
  const account = accountId ? accounts.find((candidate) => candidate.id === accountId) : undefined;
  const baseAmountCents = version ? calculateBaseSalaryAmount(version, month) : 0;
  const reflectedInCurrentBalance = isStatusExcludedFromForecast(override?.status);

  return {
    month,
    version,
    accountId,
    accountName: account ? getAccountDisplayName(account) : undefined,
    baseAmountCents,
    amountBeforeStatusCents: baseAmountCents,
    amountCents: reflectedInCurrentBalance ? 0 : baseAmountCents,
    reflectedInCurrentBalance,
    status: override?.status ?? null,
  };
}

export function buildSalarySourceAmountMap({
  versions,
  overrides = [],
  months,
}: {
  versions: readonly SalaryVersion[];
  overrides?: readonly SalaryMonthOverride[];
  months: readonly MonthId[];
}) {
  const amountBySource = new Map<string, Cents>();

  for (const month of months) {
    const forecast = calculateMonthlySalaryForecast({ versions, overrides, month });

    if (!forecast.accountId || forecast.amountCents === 0) {
      continue;
    }

    amountBySource.set(monthlySourceAmountKey(month, "salary", forecast.accountId), forecast.amountCents);
  }

  return amountBySource;
}
