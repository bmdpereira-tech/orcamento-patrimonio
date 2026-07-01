import { assertCents, formatEuroCents, parseEuroCents, sumCents, type Cents } from "./money";

export const IGCP_STORAGE_KEY = "orcamento.igcp.rows.v1";
export const IGCP_WITHHOLDING_FACTOR = 0.72;

export const IGCP_MONTHS = [
  { key: "january", label: "Janeiro", monthNumber: 1 },
  { key: "february", label: "Fevereiro", monthNumber: 2 },
  { key: "march", label: "Março", monthNumber: 3 },
  { key: "april", label: "Abril", monthNumber: 4 },
  { key: "may", label: "Maio", monthNumber: 5 },
  { key: "june", label: "Junho", monthNumber: 6 },
  { key: "july", label: "Julho", monthNumber: 7 },
  { key: "august", label: "Agosto", monthNumber: 8 },
  { key: "september", label: "Setembro", monthNumber: 9 },
  { key: "october", label: "Outubro", monthNumber: 10 },
  { key: "november", label: "Novembro", monthNumber: 11 },
  { key: "december", label: "Dezembro", monthNumber: 12 },
] as const;

export type IgcpMonthKey = (typeof IGCP_MONTHS)[number]["key"];
export type IgcpEditableField = "subscriptionDate" | "subscriptionAmount" | "currentAmount" | "annualRate";

export type IgcpSubscriptionRow = {
  id: string;
  subscriptionDate: string;
  subscriptionAmount: string;
  currentAmount: string;
  annualRate: string;
};

export type IgcpCalculatedRow = {
  row: IgcpSubscriptionRow;
  subscriptionAmountCents: Cents | null;
  currentAmountCents: Cents | null;
  annualRate: number | null;
  quarterlyInterestCents: Cents | null;
  interestByMonth: Record<IgcpMonthKey, Cents>;
  rawInterestByMonth: Record<IgcpMonthKey, number>;
  errors: Partial<Record<IgcpEditableField, string>>;
  isComplete: boolean;
};

type IgcpDateParts = {
  day: number;
  month: number;
  year: number;
};

function createInitialRow({
  id,
  subscriptionDate,
  subscriptionAmountCents,
  currentAmountCents,
  annualRate,
}: {
  id: string;
  subscriptionDate: string;
  subscriptionAmountCents: Cents;
  currentAmountCents: Cents;
  annualRate: number;
}): IgcpSubscriptionRow {
  return {
    id,
    subscriptionDate,
    subscriptionAmount: formatEuroCents(subscriptionAmountCents),
    currentAmount: formatEuroCents(currentAmountCents),
    annualRate: formatIgcpAnnualRate(annualRate) ?? "",
  };
}

export const INITIAL_IGCP_ROWS: IgcpSubscriptionRow[] = [
  createInitialRow({
    id: "igcp-initial-1",
    subscriptionDate: "03/10/2022",
    subscriptionAmountCents: 1000_00,
    currentAmountCents: 1095_18,
    annualRate: 0.03638,
  }),
  createInitialRow({
    id: "igcp-initial-2",
    subscriptionDate: "02/11/2022",
    subscriptionAmountCents: 13_000_00,
    currentAmountCents: 14_250_08,
    annualRate: 0.03695,
  }),
  createInitialRow({
    id: "igcp-initial-3",
    subscriptionDate: "02/11/2022",
    subscriptionAmountCents: 2500_00,
    currentAmountCents: 2740_40,
    annualRate: 0.03695,
  }),
  createInitialRow({
    id: "igcp-initial-4",
    subscriptionDate: "03/11/2022",
    subscriptionAmountCents: 2500_00,
    currentAmountCents: 2740_40,
    annualRate: 0.03695,
  }),
  createInitialRow({
    id: "igcp-initial-5",
    subscriptionDate: "02/01/2023",
    subscriptionAmountCents: 1500_00,
    currentAmountCents: 1635_09,
    annualRate: 0.03638,
  }),
  createInitialRow({
    id: "igcp-initial-6",
    subscriptionDate: "01/02/2023",
    subscriptionAmountCents: 1500_00,
    currentAmountCents: 1635_45,
    annualRate: 0.03695,
  }),
  createInitialRow({
    id: "igcp-initial-7",
    subscriptionDate: "03/04/2023",
    subscriptionAmountCents: 2000_00,
    currentAmountCents: 2166_14,
    annualRate: 0.03638,
  }),
  createInitialRow({
    id: "igcp-initial-8",
    subscriptionDate: "03/04/2023",
    subscriptionAmountCents: 5000_00,
    currentAmountCents: 5415_35,
    annualRate: 0.03638,
  }),
  createInitialRow({
    id: "igcp-initial-9",
    subscriptionDate: "02/05/2023",
    subscriptionAmountCents: 5000_00,
    currentAmountCents: 5413_40,
    annualRate: 0.03695,
  }),
];

export function createBlankIgcpRow(id: string): IgcpSubscriptionRow {
  return {
    id,
    subscriptionDate: "",
    subscriptionAmount: "",
    currentAmount: "",
    annualRate: "",
  };
}

export function parseIgcpDate(input: string): IgcpDateParts | null {
  const rawValue = input.trim();
  const portugueseDateMatch = rawValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const isoDateMatch = rawValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (!portugueseDateMatch && !isoDateMatch) {
    return null;
  }

  const year = Number(portugueseDateMatch?.[3] ?? isoDateMatch?.[1]);
  const month = Number(portugueseDateMatch?.[2] ?? isoDateMatch?.[2]);
  const day = Number(portugueseDateMatch?.[1] ?? isoDateMatch?.[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { day, month, year };
}

export function formatIgcpDate(input: string) {
  const date = parseIgcpDate(input);

  if (!date) {
    return null;
  }

  return `${String(date.day).padStart(2, "0")}/${String(date.month).padStart(2, "0")}/${date.year}`;
}

export function parseOptionalIgcpMoneyCents(input: string): Cents | null {
  if (!input.trim()) {
    return null;
  }

  try {
    return parseEuroCents(input);
  } catch {
    return null;
  }
}

export function parseIgcpAnnualRate(input: string): number | null {
  const compactValue = input.trim().replace(/\s+/g, "");

  if (!compactValue) {
    return null;
  }

  const hasPercent = compactValue.endsWith("%");
  const numericPart = hasPercent ? compactValue.slice(0, -1) : compactValue;
  const value = Number(numericPart.replace(",", "."));

  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return hasPercent || value > 1 ? value / 100 : value;
}

export function formatIgcpAnnualRate(rate: number) {
  if (!Number.isFinite(rate) || rate < 0) {
    return null;
  }

  return `${(rate * 100).toFixed(3)}%`;
}

export function calculateIgcpQuarterlyNetInterestCents(currentAmountCents: Cents, annualRate: number) {
  return assertCents(Math.round((currentAmountCents * annualRate * IGCP_WITHHOLDING_FACTOR) / 4));
}

function calculateIgcpQuarterlyNetInterestRawCents(currentAmountCents: Cents, annualRate: number) {
  return (currentAmountCents * annualRate * IGCP_WITHHOLDING_FACTOR) / 4;
}

function createEmptyInterestByMonth() {
  return Object.fromEntries(IGCP_MONTHS.map((month) => [month.key, 0])) as Record<IgcpMonthKey, Cents>;
}

function createEmptyRawInterestByMonth() {
  return Object.fromEntries(IGCP_MONTHS.map((month) => [month.key, 0])) as Record<IgcpMonthKey, number>;
}

function isInterestMonth(subscriptionMonth: number, month: number) {
  return (month - subscriptionMonth + 12) % 3 === 0;
}

export function getIgcpFieldErrors(row: IgcpSubscriptionRow): Partial<Record<IgcpEditableField, string>> {
  const errors: Partial<Record<IgcpEditableField, string>> = {};

  if (row.subscriptionDate.trim() && !parseIgcpDate(row.subscriptionDate)) {
    errors.subscriptionDate = "Data inválida";
  }

  if (row.subscriptionAmount.trim() && parseOptionalIgcpMoneyCents(row.subscriptionAmount) === null) {
    errors.subscriptionAmount = "Montante inválido";
  }

  if (row.currentAmount.trim() && parseOptionalIgcpMoneyCents(row.currentAmount) === null) {
    errors.currentAmount = "Montante inválido";
  }

  if (row.annualRate.trim() && parseIgcpAnnualRate(row.annualRate) === null) {
    errors.annualRate = "Taxa inválida";
  }

  return errors;
}

export function normaliseIgcpFieldValue(field: IgcpEditableField, value: string) {
  if (!value.trim()) {
    return "";
  }

  switch (field) {
    case "subscriptionDate":
      return formatIgcpDate(value);
    case "subscriptionAmount":
    case "currentAmount": {
      const parsed = parseOptionalIgcpMoneyCents(value);

      return parsed === null ? null : formatEuroCents(parsed);
    }
    case "annualRate": {
      const parsed = parseIgcpAnnualRate(value);

      return parsed === null ? null : formatIgcpAnnualRate(parsed);
    }
  }
}

export function calculateIgcpRow(row: IgcpSubscriptionRow): IgcpCalculatedRow {
  const subscriptionDate = parseIgcpDate(row.subscriptionDate);
  const subscriptionAmountCents = parseOptionalIgcpMoneyCents(row.subscriptionAmount);
  const currentAmountCents = parseOptionalIgcpMoneyCents(row.currentAmount);
  const annualRate = parseIgcpAnnualRate(row.annualRate);
  const errors = getIgcpFieldErrors(row);
  const isComplete =
    subscriptionDate !== null &&
    subscriptionAmountCents !== null &&
    currentAmountCents !== null &&
    annualRate !== null &&
    Object.keys(errors).length === 0;
  const quarterlyInterestCents = isComplete
    ? calculateIgcpQuarterlyNetInterestCents(currentAmountCents, annualRate)
    : null;
  const quarterlyInterestRawCents = isComplete
    ? calculateIgcpQuarterlyNetInterestRawCents(currentAmountCents, annualRate)
    : null;
  const interestByMonth = createEmptyInterestByMonth();
  const rawInterestByMonth = createEmptyRawInterestByMonth();

  if (subscriptionDate && quarterlyInterestCents !== null) {
    for (const month of IGCP_MONTHS) {
      if (isInterestMonth(subscriptionDate.month, month.monthNumber)) {
        interestByMonth[month.key] = quarterlyInterestCents;
        rawInterestByMonth[month.key] = quarterlyInterestRawCents ?? 0;
      }
    }
  }

  return {
    row,
    subscriptionAmountCents,
    currentAmountCents,
    annualRate,
    quarterlyInterestCents,
    interestByMonth,
    rawInterestByMonth,
    errors,
    isComplete,
  };
}

function floorPositiveCents(value: number) {
  return assertCents(Math.trunc(value + Number.EPSILON));
}

function adjustMonthlyRoundedInterest(rows: IgcpCalculatedRow[], monthKey: IgcpMonthKey, targetTotalCents: Cents) {
  const roundedTotalCents = sumCents(rows.map((row) => row.interestByMonth[monthKey]));
  let differenceCents = targetTotalCents - roundedTotalCents;

  if (differenceCents === 0) {
    return;
  }

  const direction = differenceCents > 0 ? 1 : -1;
  const candidates = rows
    .filter((row) => row.rawInterestByMonth[monthKey] > 0)
    .map((row) => {
      const rawValue = row.rawInterestByMonth[monthKey];
      const floorValue = Math.floor(rawValue);
      const ceilValue = Math.ceil(rawValue);

      return {
        row,
        rawValue,
        floorValue,
        ceilValue,
        fractionalValue: rawValue - floorValue,
      };
    })
    .filter((candidate) =>
      direction > 0
        ? candidate.row.interestByMonth[monthKey] < candidate.ceilValue
        : candidate.row.interestByMonth[monthKey] > candidate.floorValue,
    )
    .sort((left, right) =>
      direction > 0
        ? right.fractionalValue - left.fractionalValue
        : left.fractionalValue - right.fractionalValue,
    );

  const fallbackCandidates = rows.filter((row) => row.interestByMonth[monthKey] > 0).map((row) => ({ row }));
  const adjustableRows = candidates.length > 0 ? candidates : fallbackCandidates;
  let candidateIndex = 0;

  while (differenceCents !== 0 && adjustableRows.length > 0) {
    const candidate = adjustableRows[candidateIndex % adjustableRows.length];
    candidate.row.interestByMonth[monthKey] = assertCents(candidate.row.interestByMonth[monthKey] + direction);
    differenceCents -= direction;
    candidateIndex += 1;
  }
}

export function calculateIgcpTable(rows: readonly IgcpSubscriptionRow[]) {
  const calculatedRows = rows.map((row) => {
    const calculatedRow = calculateIgcpRow(row);

    return {
      ...calculatedRow,
      interestByMonth: { ...calculatedRow.interestByMonth },
    };
  });
  const totalSubscriptionAmountCents = sumCents(
    calculatedRows.map((row) => row.subscriptionAmountCents ?? 0),
  );
  const totalCurrentAmountCents = sumCents(calculatedRows.map((row) => row.currentAmountCents ?? 0));

  for (const month of IGCP_MONTHS) {
    const rawTotalCents = calculatedRows.reduce(
      (total, row) => total + row.rawInterestByMonth[month.key],
      0,
    );

    adjustMonthlyRoundedInterest(calculatedRows, month.key, floorPositiveCents(rawTotalCents));
  }

  const interestByMonth = Object.fromEntries(
    IGCP_MONTHS.map((month) => [
      month.key,
      sumCents(calculatedRows.map((row) => row.interestByMonth[month.key])),
    ]),
  ) as Record<IgcpMonthKey, Cents>;

  return {
    rows: calculatedRows,
    totals: {
      subscriptionAmountCents: totalSubscriptionAmountCents,
      currentAmountCents: totalCurrentAmountCents,
      interestByMonth,
      accumulatedGainCents: sumCents([totalCurrentAmountCents, -totalSubscriptionAmountCents]),
    },
    hasInvalidFields: calculatedRows.some((row) => Object.keys(row.errors).length > 0),
  };
}

export function canPersistIgcpRows(rows: readonly IgcpSubscriptionRow[]) {
  return rows.every((row) => Object.keys(getIgcpFieldErrors(row)).length === 0);
}

export function parseStoredIgcpRows(rawValue: string): IgcpSubscriptionRow[] | null {
  try {
    const parsed: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) {
      return null;
    }

    const rows = parsed.map((item): IgcpSubscriptionRow | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Partial<Record<keyof IgcpSubscriptionRow, unknown>>;

      if (
        typeof row.id !== "string" ||
        typeof row.subscriptionDate !== "string" ||
        typeof row.subscriptionAmount !== "string" ||
        typeof row.currentAmount !== "string" ||
        typeof row.annualRate !== "string"
      ) {
        return null;
      }

      return {
        id: row.id,
        subscriptionDate: row.subscriptionDate,
        subscriptionAmount: row.subscriptionAmount,
        currentAmount: row.currentAmount,
        annualRate: row.annualRate,
      };
    });

    if (rows.some((row) => row === null)) {
      return null;
    }

    return rows as IgcpSubscriptionRow[];
  } catch {
    return null;
  }
}
