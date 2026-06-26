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
  it("keeps the budget month normalisation limited to July 2026", () => {
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
    expect(getMonthIdForDate(new Date("2026-09-25T10:00:00.000Z"))).toBe("2026-09");
  });

  it("uses Europe/Lisbon when getting the current month", () => {
    expect(getMonthIdForDate(new Date("2026-08-31T22:30:00.000Z"))).toBe("2026-08");
    expect(getMonthIdForDate(new Date("2026-08-31T23:30:00.000Z"))).toBe("2026-09");
  });
});
