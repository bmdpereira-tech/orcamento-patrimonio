import { describe, expect, it } from "vitest";
import {
  buildMonthlyDirectDebitOccurrences,
  buildRecurringDebitSourceAmountMap,
  buildRecurringRuleMonthStateMap,
  canDeleteRecurringRule,
  getRecurringRuleChangeFirstAffectedMonth,
  getRecurringRuleChargeDate,
  isRecurringRuleApplicableToMonth,
  isRecurringRuleForecastedInMonth,
  sumRecurringDebitsByAccount,
  validateRecurringRuleAccountSelection,
  validateRecurringRuleInput,
  type RecurringRule,
  type RecurringRuleInput,
} from "./recurring-rules";

const baseRule: RecurringRule = {
  id: "electricity",
  description: "Electricidade",
  accountId: "santander",
  amountCents: 120_00,
  chargeDay: 31,
  frequency: "monthly",
  startMonth: "2026-07",
  active: true,
  sortOrder: 10,
};

const baseInput: RecurringRuleInput = {
  description: "Electricidade",
  accountId: "santander",
  amountCents: 120_00,
  chargeDay: 15,
  frequency: "monthly",
  startMonth: "2026-07",
  active: true,
  sortOrder: 10,
};

describe("recurring direct debit rules", () => {
  it("validates required fields and ranges", () => {
    expect(() => validateRecurringRuleInput({ ...baseInput, description: "" })).toThrow("Indique uma descrição.");
    expect(() => validateRecurringRuleInput({ ...baseInput, accountId: "" })).toThrow("Seleccione uma conta.");
    expect(() => validateRecurringRuleInput({ ...baseInput, amountCents: 0 })).toThrow(
      "O montante deve ser superior a zero.",
    );
    expect(() => validateRecurringRuleInput({ ...baseInput, chargeDay: 32 })).toThrow(
      "O dia de cobrança deve estar entre 1 e 31.",
    );
    expect(() => validateRecurringRuleInput({ ...baseInput, endMonth: "2026-06" })).toThrow(
      "A data de fim não pode ser anterior à data de início.",
    );
  });

  it("includes a rule in the start and end months only", () => {
    const rule = { ...baseRule, endMonth: "2026-09" as const };

    expect(isRecurringRuleApplicableToMonth(rule, "2026-06")).toBe(false);
    expect(isRecurringRuleApplicableToMonth(rule, "2026-07")).toBe(true);
    expect(isRecurringRuleApplicableToMonth(rule, "2026-09")).toBe(true);
    expect(isRecurringRuleApplicableToMonth(rule, "2026-10")).toBe(false);
  });

  it("keeps open-ended rules active in future months", () => {
    expect(isRecurringRuleApplicableToMonth(baseRule, "2027-01")).toBe(true);
  });

  it("excludes inactive and archived rules, then includes reactivated rules", () => {
    expect(isRecurringRuleApplicableToMonth({ ...baseRule, active: false }, "2026-07")).toBe(false);
    expect(isRecurringRuleApplicableToMonth({ ...baseRule, archivedAt: "2026-07-10T00:00:00Z" }, "2026-07")).toBe(
      false,
    );
    expect(isRecurringRuleApplicableToMonth({ ...baseRule, active: true, archivedAt: undefined }, "2026-07")).toBe(
      true,
    );
  });

  it("sums multiple rules by account and applies the negative sign", () => {
    const totals = sumRecurringDebitsByAccount(
      [
        baseRule,
        { ...baseRule, id: "water", description: "Água", amountCents: 35_00 },
        { ...baseRule, id: "gym", description: "Ginásio", accountId: "n26", amountCents: 50_00 },
      ],
      "2026-07",
    );

    expect(totals.get("santander")).toBe(-155_00);
    expect(totals.get("n26")).toBe(-50_00);
  });

  it("excludes a rule from the forecast only when the month state is manually marked", () => {
    const states = buildRecurringRuleMonthStateMap([
      {
        recurringRuleId: baseRule.id,
        month: "2026-07",
        excludedFromForecast: true,
      },
    ]);

    expect(isRecurringRuleForecastedInMonth(baseRule, "2026-07", states)).toBe(false);
    expect(isRecurringRuleForecastedInMonth(baseRule, "2026-08", states)).toBe(true);
    expect(sumRecurringDebitsByAccount([baseRule], "2026-07", states).get("santander")).toBeUndefined();
    expect(sumRecurringDebitsByAccount([baseRule], "2026-08", states).get("santander")).toBe(-120_00);
  });

  it("builds the direct debit source amount map for monthly snapshots", () => {
    const amounts = buildRecurringDebitSourceAmountMap([baseRule], ["2026-06", "2026-07", "2026-08"]);

    expect(amounts.get("2026-06:direct_debits:santander")).toBeUndefined();
    expect(amounts.get("2026-07:direct_debits:santander")).toBe(-120_00);
    expect(amounts.get("2026-08:direct_debits:santander")).toBe(-120_00);
  });

  it("builds the source amount map without monthly excluded rules", () => {
    const amounts = buildRecurringDebitSourceAmountMap(
      [baseRule, { ...baseRule, id: "water", description: "Água", amountCents: 35_00 }],
      ["2026-07"],
      [{ recurringRuleId: baseRule.id, month: "2026-07", excludedFromForecast: true }],
    );

    expect(amounts.get("2026-07:direct_debits:santander")).toBe(-35_00);
  });

  it("builds the monthly checklist only from existing rules and ignores orphan states", () => {
    const orphanStates = [
      { recurringRuleId: "deleted", month: "2026-09" as const, excludedFromForecast: true },
      { recurringRuleId: "deleted", month: "2026-10" as const, excludedFromForecast: false },
    ];

    expect(buildMonthlyDirectDebitOccurrences([], "2026-09", orphanStates)).toEqual([]);
    expect(buildMonthlyDirectDebitOccurrences([], "2026-10", orphanStates)).toEqual([]);
    expect(buildRecurringDebitSourceAmountMap([], ["2026-09", "2026-10"], orphanStates).size).toBe(0);
  });

  it("drops a September to October rule from every monthly result after deletion", () => {
    const testRule = {
      ...baseRule,
      id: "teste",
      description: "Teste",
      startMonth: "2026-09" as const,
      endMonth: "2026-10" as const,
    };
    const states = [
      { recurringRuleId: "teste", month: "2026-09" as const, excludedFromForecast: true },
      { recurringRuleId: "teste", month: "2026-10" as const, excludedFromForecast: false },
    ];

    expect(buildMonthlyDirectDebitOccurrences([testRule], "2026-09", states)).toMatchObject([
      { ruleId: "teste", excludedFromForecast: true },
    ]);
    expect(buildRecurringDebitSourceAmountMap([testRule], ["2026-09"], states).size).toBe(0);
    expect(buildMonthlyDirectDebitOccurrences([testRule], "2026-10", states)).toMatchObject([
      { ruleId: "teste", excludedFromForecast: false },
    ]);
    expect(buildRecurringDebitSourceAmountMap([testRule], ["2026-10"], states).get("2026-10:direct_debits:santander")).toBe(
      -120_00,
    );

    expect(buildMonthlyDirectDebitOccurrences([], "2026-09", states)).toEqual([]);
    expect(buildMonthlyDirectDebitOccurrences([], "2026-10", states)).toEqual([]);
    expect(buildRecurringDebitSourceAmountMap([], ["2026-09", "2026-10"], states).size).toBe(0);
  });

  it("uses the last valid day of February for day 31", () => {
    expect(getRecurringRuleChargeDate(baseRule, "2027-02")).toBe("2027-02-28");
  });

  it("does not use the charge day to exclude a rule automatically", () => {
    const dayOneRule = { ...baseRule, id: "day-one", chargeDay: 1 };
    const dayThirtyOneRule = { ...baseRule, id: "day-thirty-one", chargeDay: 31 };

    expect(isRecurringRuleForecastedInMonth(dayOneRule, "2026-07")).toBe(true);
    expect(isRecurringRuleForecastedInMonth(dayThirtyOneRule, "2026-07")).toBe(true);
    expect(sumRecurringDebitsByAccount([dayOneRule, dayThirtyOneRule], "2026-07").get("santander")).toBe(-240_00);
  });

  it("validates account selection by activity only, not by account type", () => {
    expect(() =>
      validateRecurringRuleAccountSelection({
        accounts: [
          { id: "santander" },
          { id: "cc-santander" },
          { id: "archived", archivedFromMonth: "2026-08" },
        ],
        accountId: "cc-santander",
      }),
    ).not.toThrow();

    expect(() =>
      validateRecurringRuleAccountSelection({
        accounts: [{ id: "archived", archivedFromMonth: "2026-08" }],
        accountId: "archived",
      }),
    ).toThrow("A conta seleccionada já não está activa. Escolha outra conta.");

    expect(() =>
      validateRecurringRuleAccountSelection({
        accounts: [{ id: "archived", archivedFromMonth: "2026-08" }],
        accountId: "archived",
        previousAccountId: "archived",
      }),
    ).not.toThrow();
  });

  it("allows deletion only before a rule can affect history and without overrides", () => {
    expect(canDeleteRecurringRule({ rule: baseRule, referenceMonth: "2026-06" })).toEqual({
      allowed: true,
      reason: null,
    });
    expect(canDeleteRecurringRule({ rule: baseRule, referenceMonth: "2026-07" })).toEqual({
      allowed: true,
      reason: null,
    });
    expect(canDeleteRecurringRule({ rule: baseRule, referenceMonth: "2026-08" })).toEqual({
      allowed: false,
      reason: "Este débito directo já pode afectar meses históricos. Arquive-o para preservar os dados.",
    });
    expect(canDeleteRecurringRule({ rule: baseRule, referenceMonth: "2026-06", hasOccurrenceOverrides: true })).toEqual({
      allowed: false,
      reason: "Este débito directo tem excepções mensais associadas. Arquive-o para preservar o histórico.",
    });
  });

  it("detects only financial changes as historical-impact candidates", () => {
    const previous = { ...baseRule, endMonth: "2026-12" as const };

    expect(
      getRecurringRuleChangeFirstAffectedMonth({
        previous,
        next: {
          description: "Luz",
          accountId: "santander",
          amountCents: 120_00,
          chargeDay: 1,
          frequency: "monthly",
          startMonth: "2026-07",
          endMonth: "2026-12",
          active: true,
          sortOrder: 20,
        },
      }),
    ).toBeNull();
    expect(
      getRecurringRuleChangeFirstAffectedMonth({
        previous,
        next: { ...baseInput, amountCents: 135_00, endMonth: "2026-12" },
      }),
    ).toBe("2026-07");
    expect(
      getRecurringRuleChangeFirstAffectedMonth({
        previous,
        next: { ...baseInput, endMonth: "2026-09" },
      }),
    ).toBe("2026-10");
  });
});
