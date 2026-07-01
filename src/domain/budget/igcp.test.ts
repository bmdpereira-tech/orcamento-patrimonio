import { describe, expect, it } from "vitest";
import {
  calculateIgcpQuarterlyNetInterestCents,
  calculateIgcpTable,
  INITIAL_IGCP_ROWS,
  parseIgcpAnnualRate,
} from "./igcp";

describe("IGCP calculations", () => {
  it("normalises annual rates from percentage and decimal inputs", () => {
    expect(parseIgcpAnnualRate("3.638%")).toBeCloseTo(0.03638);
    expect(parseIgcpAnnualRate("3,638%")).toBeCloseTo(0.03638);
    expect(parseIgcpAnnualRate("3.638")).toBeCloseTo(0.03638);
    expect(parseIgcpAnnualRate("0.03638")).toBeCloseTo(0.03638);
  });

  it("calculates quarterly net interest after 28% withholding", () => {
    expect(calculateIgcpQuarterlyNetInterestCents(1095_18, 0.03638)).toBe(717);
  });

  it("preloads the reference rows and initial totals", () => {
    const table = calculateIgcpTable(INITIAL_IGCP_ROWS);

    expect(table.rows).toHaveLength(9);
    expect(table.totals.subscriptionAmountCents).toBe(34_000_00);
    expect(table.totals.currentAmountCents).toBe(37_091_49);
    expect(table.totals.accumulatedGainCents).toBe(3091_49);
  });

  it("distributes subscription interest by quarterly cycle", () => {
    const table = calculateIgcpTable(INITIAL_IGCP_ROWS);
    const octoberSubscription = table.rows[0];
    const novemberSubscription = table.rows[1];

    expect(octoberSubscription.interestByMonth.january).toBe(717);
    expect(octoberSubscription.interestByMonth.april).toBe(717);
    expect(octoberSubscription.interestByMonth.july).toBe(717);
    expect(octoberSubscription.interestByMonth.october).toBe(717);
    expect(octoberSubscription.interestByMonth.february).toBe(0);
    expect(novemberSubscription.interestByMonth.february).toBe(9478);
    expect(novemberSubscription.interestByMonth.may).toBe(9478);
    expect(novemberSubscription.interestByMonth.august).toBe(9478);
    expect(novemberSubscription.interestByMonth.november).toBe(9478);
  });

  it("calculates the initial monthly totals", () => {
    const { totals } = calculateIgcpTable(INITIAL_IGCP_ROWS);

    expect(totals.interestByMonth.january).toBe(6752);
    expect(totals.interestByMonth.february).toBe(17_811);
    expect(totals.interestByMonth.march).toBe(0);
    expect(totals.interestByMonth.april).toBe(6752);
    expect(totals.interestByMonth.may).toBe(17_811);
    expect(totals.interestByMonth.june).toBe(0);
    expect(totals.interestByMonth.july).toBe(6752);
    expect(totals.interestByMonth.august).toBe(17_811);
    expect(totals.interestByMonth.september).toBe(0);
    expect(totals.interestByMonth.october).toBe(6752);
    expect(totals.interestByMonth.november).toBe(17_811);
    expect(totals.interestByMonth.december).toBe(0);
  });
});
