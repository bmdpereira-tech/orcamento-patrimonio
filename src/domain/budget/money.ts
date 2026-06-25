export type Cents = number;

export function assertCents(amountCents: number): Cents {
  if (!Number.isSafeInteger(amountCents)) {
    throw new Error("Os montantes monetários devem ser inteiros em cêntimos.");
  }

  return amountCents;
}

export function sumCents(amounts: readonly Cents[]) {
  return amounts.reduce((total, amount) => assertCents(total + amount), 0);
}

export function formatEuroCents(amountCents: Cents) {
  assertCents(amountCents);

  if (amountCents === 0) {
    return "–";
  }

  const absoluteValue = Math.abs(amountCents);
  const euros = Math.trunc(absoluteValue / 100);
  const cents = String(absoluteValue % 100).padStart(2, "0");
  const groupedEuros = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const formatted = `${groupedEuros},${cents} €`;

  return amountCents < 0 ? `(${formatted})` : formatted;
}

export function formatEditableEuroCents(amountCents: Cents) {
  assertCents(amountCents);

  const sign = amountCents < 0 ? "-" : "";
  const absoluteValue = Math.abs(amountCents);
  const euros = Math.trunc(absoluteValue / 100);
  const cents = String(absoluteValue % 100).padStart(2, "0");

  return `${sign}${euros},${cents}`;
}

export function parseEuroCents(input: FormDataEntryValue | string | null | undefined): Cents {
  if (input === null || input === undefined) {
    return 0;
  }

  const rawValue = String(input).trim();

  if (!rawValue) {
    return 0;
  }

  const isParenthesisedNegative = rawValue.startsWith("(") && rawValue.endsWith(")");
  const withoutCurrency = rawValue
    .replace(/[€\s]/g, "")
    .replace(/^\((.*)\)$/, "$1")
    .trim();
  const hasExplicitNegativeSign = withoutCurrency.startsWith("-");
  const unsignedValue = withoutCurrency.replace(/^[+-]/, "");
  const lastCommaIndex = unsignedValue.lastIndexOf(",");
  const lastDotIndex = unsignedValue.lastIndexOf(".");
  const decimalSeparatorIndex = Math.max(lastCommaIndex, lastDotIndex);
  const integerPart =
    decimalSeparatorIndex >= 0 ? unsignedValue.slice(0, decimalSeparatorIndex) : unsignedValue;
  const decimalPart =
    decimalSeparatorIndex >= 0 ? unsignedValue.slice(decimalSeparatorIndex + 1) : "";
  const normalisedIntegerPart = integerPart.replace(/[.,]/g, "");

  if (!/^\d+$/.test(normalisedIntegerPart || "0") || !/^\d{0,2}$/.test(decimalPart)) {
    throw new Error(`Montante inválido: ${rawValue}`);
  }

  const euros = Number(normalisedIntegerPart || "0");
  const cents = Number(decimalPart.padEnd(2, "0") || "0");
  const sign = isParenthesisedNegative || hasExplicitNegativeSign ? -1 : 1;

  return assertCents(sign * (euros * 100 + cents));
}
