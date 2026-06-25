import { APP_LOCALE, FIRST_MONTH } from "./constants";

export { FIRST_MONTH };

export type MonthId = `${number}-${number}`;

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function parseMonthId(monthId: string) {
  if (!MONTH_PATTERN.test(monthId)) {
    throw new Error(`Mês inválido: ${monthId}`);
  }

  const [year, month] = monthId.split("-").map(Number);
  return { year, month };
}

export function normaliseMonth(monthId?: string | null): MonthId {
  if (!monthId || !MONTH_PATTERN.test(monthId)) {
    return FIRST_MONTH as MonthId;
  }

  return monthId < FIRST_MONTH ? (FIRST_MONTH as MonthId) : (monthId as MonthId);
}

export function addMonths(monthId: string, delta: number): MonthId {
  const { year, month } = parseMonthId(monthId);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");

  return `${nextYear}-${nextMonth}` as MonthId;
}

export function formatMonthLabel(monthId: string) {
  const { year, month } = parseMonthId(monthId);
  const label = new Intl.DateTimeFormat(APP_LOCALE, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function daysInMonth(monthId: string) {
  const { year, month } = parseMonthId(monthId);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function toMonthStartDate(monthId: string) {
  const { year, month } = parseMonthId(monthId);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function getMonthIdForDate(date = new Date()): MonthId {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}` as MonthId;
}
