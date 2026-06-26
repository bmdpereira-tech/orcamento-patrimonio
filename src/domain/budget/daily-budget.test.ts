import { describe, expect, it } from "vitest";
import type { LiquidityAccount } from "./accounts";
import {
  buildDailyBudgetSourceAmountMap,
  calculateDailyBudgetDays,
  calculateDailyBudgetForecast,
  findApplicableDailyBudgetVersion,
  getMonthIdInPortugal,
  validateDailyBudgetVersionInput,
  type DailyBudgetVersion,
} from "./daily-budget";
import { monthlySourceAmountKey } from "./monthly-snapshots";

const bankAccount: LiquidityAccount = {
  id: "santander",
  name: "Santander",
  shortName: "Santander",
  accountType: "bank_account",
  isCreditCard: false,
  startMonth: "2026-07",
  showInBudget: true,
  includeInNetWorth: true,
  sortOrder: 10,
};
const creditCardAccount: LiquidityAccount = {
  id: "cc-santander",
  name: "CC Santander",
  shortName: "CC Santander",
  accountType: "credit_card",
  isCreditCard: true,
  startMonth: "2026-07",
  showInBudget: true,
  includeInNetWorth: true,
  sortOrder: 20,
};
const versions: DailyBudgetVersion[] = [
  {
    id: "july",
    effectiveFromMonth: "2026-07",
    dailyAmountCents: 10_00,
    accountId: "santander",
  },
  {
    id: "september",
    effectiveFromMonth: "2026-09",
    dailyAmountCents: 15_00,
    accountId: "cc-santander",
  },
];

describe("daily budget calculations", () => {
  it("validates account, month and non-negative daily amount", () => {
    expect(() =>
      validateDailyBudgetVersionInput({
        effectiveFromMonth: "2026-07",
        dailyAmountCents: 10_00,
        accountId: "",
      }),
    ).toThrow("Indique uma conta.");
    expect(() =>
      validateDailyBudgetVersionInput({
        effectiveFromMonth: "" as never,
        dailyAmountCents: 10_00,
        accountId: "santander",
      }),
    ).toThrow("Indique o mês de entrada em vigor.");
    expect(() =>
      validateDailyBudgetVersionInput({
        effectiveFromMonth: "2026-07",
        dailyAmountCents: -1,
        accountId: "santander",
      }),
    ).toThrow("O plafond diário não pode ser negativo.");
  });

  it("uses the latest version whose effective month is not after the selected month", () => {
    expect(findApplicableDailyBudgetVersion(versions, "2026-06")).toBeNull();
    expect(findApplicableDailyBudgetVersion(versions, "2026-08")?.id).toBe("july");
    expect(findApplicableDailyBudgetVersion(versions, "2026-09")?.id).toBe("september");
    expect(findApplicableDailyBudgetVersion(versions, "2026-12")?.id).toBe("september");
  });

  it("counts current month days including today in Europe/Lisbon", () => {
    expect(
      calculateDailyBudgetDays({
        month: "2026-07",
        referenceDate: new Date("2026-07-10T11:00:00.000Z"),
      }),
    ).toBe(22);
  });

  it("counts all days in a future month and zero days in a past month", () => {
    const referenceDate = new Date("2026-07-10T11:00:00.000Z");

    expect(calculateDailyBudgetDays({ month: "2026-08", referenceDate })).toBe(31);
    expect(calculateDailyBudgetDays({ month: "2026-06", referenceDate })).toBe(0);
  });

  it("handles common and leap Februaries", () => {
    const referenceDate = new Date("2026-01-10T11:00:00.000Z");

    expect(calculateDailyBudgetDays({ month: "2026-02", referenceDate })).toBe(28);
    expect(calculateDailyBudgetDays({ month: "2028-02", referenceDate })).toBe(29);
  });

  it("uses Europe/Lisbon around UTC month boundaries", () => {
    const referenceDate = new Date("2026-06-30T23:30:00.000Z");

    expect(getMonthIdInPortugal(referenceDate)).toBe("2026-07");
    expect(calculateDailyBudgetDays({ month: "2026-07", referenceDate })).toBe(31);
  });

  it("builds a negative forecast on the configured account, including credit cards", () => {
    const forecast = calculateDailyBudgetForecast({
      versions,
      accounts: [bankAccount, creditCardAccount],
      month: "2026-09",
      referenceDate: new Date("2026-09-10T11:00:00.000Z"),
    });

    expect(forecast.accountId).toBe("cc-santander");
    expect(forecast.accountName).toBe("CC Santander");
    expect(forecast.consideredDays).toBe(21);
    expect(forecast.amountCents).toBe(-315_00);
  });

  it("returns zero forecast without a configured version", () => {
    const forecast = calculateDailyBudgetForecast({
      versions: [],
      month: "2026-09",
      referenceDate: new Date("2026-09-10T11:00:00.000Z"),
    });

    expect(forecast.accountId).toBeNull();
    expect(forecast.consideredDays).toBe(0);
    expect(forecast.amountCents).toBe(0);
  });

  it("builds source amounts only for configured non-zero forecasts", () => {
    const sourceAmounts = buildDailyBudgetSourceAmountMap({
      versions,
      months: ["2026-06", "2026-07"],
      referenceDate: new Date("2026-07-30T11:00:00.000Z"),
    });

    expect(sourceAmounts.get(monthlySourceAmountKey("2026-06", "day_to_day", "santander"))).toBeUndefined();
    expect(sourceAmounts.get(monthlySourceAmountKey("2026-07", "day_to_day", "santander"))).toBe(-20_00);
  });
});
