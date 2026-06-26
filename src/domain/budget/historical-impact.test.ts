import { describe, expect, it } from "vitest";
import {
  buildHistoricalImpactMessage,
  evaluateHistoricalImpact,
  getMonthIdInTimeZone,
  minMonth,
  toHistoricalImpactActionResult,
} from "./historical-impact";

describe("historical impact protection", () => {
  const referenceDate = new Date("2026-09-15T10:00:00Z");

  it("requires confirmation when the first affected month is before the Lisbon current month", () => {
    expect(
      evaluateHistoricalImpact({
        firstAffectedMonth: "2026-08",
        referenceDate,
      }),
    ).toMatchObject({
      requiresConfirmation: true,
      firstAffectedMonth: "2026-08",
      currentMonth: "2026-09",
      affectsFollowingMonths: true,
      message:
        "Esta alteração afecta Agosto de 2026 e pode recalcular os saldos transportados dos meses seguintes. Pretende continuar?",
    });
  });

  it("does not require confirmation for the current month, future months or explicit confirmations", () => {
    expect(
      evaluateHistoricalImpact({
        firstAffectedMonth: "2026-09",
        referenceDate,
      }).requiresConfirmation,
    ).toBe(false);
    expect(
      evaluateHistoricalImpact({
        firstAffectedMonth: "2026-10",
        referenceDate,
      }).requiresConfirmation,
    ).toBe(false);
    expect(
      evaluateHistoricalImpact({
        firstAffectedMonth: "2026-08",
        confirmHistoricalImpact: true,
        referenceDate,
      }).requiresConfirmation,
    ).toBe(false);
  });

  it("does not require confirmation for changes without financial impact", () => {
    expect(
      evaluateHistoricalImpact({
        firstAffectedMonth: null,
        referenceDate,
      }).requiresConfirmation,
    ).toBe(false);
  });

  it("uses Europe/Lisbon when deriving the current month", () => {
    expect(getMonthIdInTimeZone(new Date("2026-08-31T22:30:00Z"))).toBe("2026-08");
    expect(getMonthIdInTimeZone(new Date("2026-08-31T23:30:00Z"))).toBe("2026-09");
  });

  it("builds an action result for Server Actions", () => {
    const result = toHistoricalImpactActionResult(
      evaluateHistoricalImpact({
        firstAffectedMonth: "2026-08",
        referenceDate,
      }),
    );

    expect(result).toEqual({
      ok: false,
      requiresConfirmation: true,
      firstAffectedMonth: "2026-08",
      monthLabel: "Agosto de 2026",
      message: buildHistoricalImpactMessage("2026-08"),
      affectsFollowingMonths: true,
    });
  });

  it("selects the earliest affected month", () => {
    expect(minMonth("2026-09", "2026-07", null, undefined)).toBe("2026-07");
    expect(minMonth(null, undefined)).toBeNull();
  });
});
