import { describe, expect, it } from "vitest";
import {
  FIRST_MONTH,
  addMonths,
  daysInMonth,
  formatMonthLabel,
  getMonthIdForDate,
  normaliseMonth,
  toMonthStartDate,
} from "./months";

describe("month helpers", () => {
  it("normalises invalid or previous months to July 2026", () => {
    expect(normaliseMonth()).toBe(FIRST_MONTH);
    expect(normaliseMonth("2026-06")).toBe(FIRST_MONTH);
    expect(normaliseMonth("not-a-month")).toBe(FIRST_MONTH);
  });

  it("adds months deterministically", () => {
    expect(addMonths("2026-07", 1)).toBe("2026-08");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2027-01", -1)).toBe("2026-12");
  });

  it("formats month labels in Portuguese", () => {
    expect(formatMonthLabel("2026-07")).toBe("Julho de 2026");
  });

  it("keeps month start dates explicit", () => {
    expect(toMonthStartDate("2026-07")).toBe("2026-07-01");
    expect(daysInMonth("2026-07")).toBe(31);
  });

  it("gets a month id from a date", () => {
    expect(getMonthIdForDate(new Date(2026, 8, 25))).toBe("2026-09");
  });
});
