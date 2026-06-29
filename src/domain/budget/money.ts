import { APP_CURRENCY, APP_LOCALE } from "./constants";

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
  const formatted = new Intl.NumberFormat(APP_LOCALE, {
    style: "currency",
    currency: APP_CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: "always",
  } as unknown as Intl.NumberFormatOptions)
    .format(absoluteValue / 100)
    .replace(/\u00a0/g, " ");

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

class CurrencyExpressionParser {
  private readonly source: string;
  private index = 0;

  constructor(input: string) {
    this.source = input.replace(/\s+/g, "");
  }

  parse() {
    if (!this.source) {
      return 0;
    }

    const value = this.parseExpression();

    if (value === null || this.index !== this.source.length || !Number.isFinite(value)) {
      return null;
    }

    return value;
  }

  private parseExpression(): number | null {
    let value = this.parseTerm();

    if (value === null) {
      return null;
    }

    while (this.peek() === "+" || this.peek() === "-") {
      const operator = this.consume();
      const nextValue = this.parseTerm();

      if (nextValue === null) {
        return null;
      }

      value = operator === "+" ? value + nextValue : value - nextValue;
    }

    return value;
  }

  private parseTerm(): number | null {
    let value = this.parseFactor();

    if (value === null) {
      return null;
    }

    while (this.peek() === "*" || this.peek() === "/") {
      const operator = this.consume();
      const nextValue = this.parseFactor();

      if (nextValue === null || (operator === "/" && nextValue === 0)) {
        return null;
      }

      value = operator === "*" ? value * nextValue : value / nextValue;
    }

    return value;
  }

  private parseFactor(): number | null {
    if (this.peek() === "+") {
      this.consume();
      return this.parseFactor();
    }

    if (this.peek() === "-") {
      this.consume();
      const value = this.parseFactor();

      return value === null ? null : -value;
    }

    if (this.peek() === "(") {
      this.consume();
      const value = this.parseExpression();

      if (value === null || this.peek() !== ")") {
        return null;
      }

      this.consume();
      return value;
    }

    return this.parseNumber();
  }

  private parseNumber(): number | null {
    const start = this.index;
    let hasDigit = false;
    let hasDecimalSeparator = false;
    let decimalDigitCount = 0;

    while (this.index < this.source.length) {
      const character = this.source[this.index];

      if (character >= "0" && character <= "9") {
        hasDigit = true;

        if (hasDecimalSeparator) {
          decimalDigitCount += 1;
        }

        this.index += 1;
        continue;
      }

      if (character === "," || character === ".") {
        if (hasDecimalSeparator) {
          return null;
        }

        hasDecimalSeparator = true;
        this.index += 1;
        continue;
      }

      break;
    }

    if (!hasDigit || decimalDigitCount > 2) {
      return null;
    }

    const rawNumber = this.source.slice(start, this.index).replace(",", ".");
    const value = Number(rawNumber);

    return Number.isFinite(value) ? value : null;
  }

  private peek() {
    return this.source[this.index] ?? "";
  }

  private consume() {
    const character = this.peek();
    this.index += 1;
    return character;
  }
}

export function evaluateCurrencyExpressionCents(input: string): Cents | null {
  const value = new CurrencyExpressionParser(input).parse();

  if (value === null) {
    return null;
  }

  const cents = Math.round(value * 100);

  if (!Number.isSafeInteger(cents)) {
    return null;
  }

  return assertCents(Object.is(cents, -0) ? 0 : cents);
}
