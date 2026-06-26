import { describe, expect, it } from "vitest";
import type { LiquidityAccount } from "./accounts";
import { monthlySourceAmountKey } from "./monthly-snapshots";
import {
  buildSalarySourceAmountMap,
  calculateMonthlySalaryForecast,
  validateSalaryVersionInput,
  type SalaryMonthOverride,
  type SalaryVersion,
} from "./salary";

const accounts: LiquidityAccount[] = [
  {
    id: "santander",
    name: "Santander",
    isCreditCard: false,
    startMonth: "2026-07",
    showInBudget: true,
    includeInNetWorth: true,
    sortOrder: 10,
  },
  {
    id: "activo",
    name: "ActivoBank",
    isCreditCard: false,
    startMonth: "2026-07",
    showInBudget: true,
    includeInNetWorth: true,
    sortOrder: 20,
  },
];

const baseVersion: SalaryVersion = {
  id: "salary-2026-07",
  effectiveFromMonth: "2026-07",
  amountCents: 3_000_00,
  accountId: "santander",
  vacationBonusCents: 4_500_00,
  vacationBonusMonth: 7,
  christmasBonusCents: 4_250_00,
  christmasBonusMonth: 12,
};

describe("salary forecast", () => {
  it("uses the normal salary outside subsidy months", () => {
    const forecast = calculateMonthlySalaryForecast({
      versions: [baseVersion],
      accounts,
      month: "2026-08",
    });

    expect(forecast.accountId).toBe("santander");
    expect(forecast.amountCents).toBe(3_000_00);
  });

  it("uses the vacation subsidy instead of adding it to the normal salary", () => {
    const forecast = calculateMonthlySalaryForecast({
      versions: [baseVersion],
      accounts,
      month: "2026-07",
    });

    expect(forecast.baseAmountCents).toBe(4_500_00);
    expect(forecast.amountCents).toBe(4_500_00);
  });

  it("uses the Christmas subsidy instead of adding it to the normal salary", () => {
    const forecast = calculateMonthlySalaryForecast({
      versions: [baseVersion],
      accounts,
      month: "2026-12",
    });

    expect(forecast.baseAmountCents).toBe(4_250_00);
    expect(forecast.amountCents).toBe(4_250_00);
  });

  it("applies the value only to the configured receiving account", () => {
    const sourceAmounts = buildSalarySourceAmountMap({
      versions: [baseVersion],
      months: ["2026-08"],
    });

    expect(sourceAmounts.get(monthlySourceAmountKey("2026-08", "salary", "santander"))).toBe(3_000_00);
    expect(sourceAmounts.get(monthlySourceAmountKey("2026-08", "salary", "activo"))).toBeUndefined();
  });

  it("excludes only the selected month when marked as already reflected", () => {
    const overrides: SalaryMonthOverride[] = [{ month: "2026-09", status: "received" }];
    const sourceAmounts = buildSalarySourceAmountMap({
      versions: [baseVersion],
      overrides,
      months: ["2026-08", "2026-09", "2026-10"],
    });

    expect(sourceAmounts.get(monthlySourceAmountKey("2026-08", "salary", "santander"))).toBe(3_000_00);
    expect(sourceAmounts.get(monthlySourceAmountKey("2026-09", "salary", "santander"))).toBeUndefined();
    expect(sourceAmounts.get(monthlySourceAmountKey("2026-10", "salary", "santander"))).toBe(3_000_00);
  });

  it("ignores stale monthly override amounts and keeps the configured salary", () => {
    const stalePositiveOverride = { month: "2026-08", amountCents: 3_250_00 } as unknown as SalaryMonthOverride;
    const staleZeroOverride = { month: "2026-09", amountCents: 0 } as unknown as SalaryMonthOverride;
    const positiveForecast = calculateMonthlySalaryForecast({
      versions: [baseVersion],
      overrides: [stalePositiveOverride],
      month: "2026-08",
    });
    const zeroForecast = calculateMonthlySalaryForecast({
      versions: [baseVersion],
      overrides: [staleZeroOverride],
      month: "2026-09",
    });

    expect(positiveForecast.amountCents).toBe(3_000_00);
    expect(zeroForecast.amountCents).toBe(3_000_00);
  });

  it("uses the latest version effective before the selected month", () => {
    const newerVersion: SalaryVersion = {
      ...baseVersion,
      id: "salary-2026-10",
      effectiveFromMonth: "2026-10",
      amountCents: 3_300_00,
      accountId: "activo",
    };

    expect(
      calculateMonthlySalaryForecast({
        versions: [newerVersion, baseVersion],
        month: "2026-09",
      }).accountId,
    ).toBe("santander");
    expect(
      calculateMonthlySalaryForecast({
        versions: [baseVersion, newerVersion],
        month: "2026-10",
      }).amountCents,
    ).toBe(3_300_00);
  });

  it("rejects configuring both subsidies in the same month", () => {
    expect(() =>
      validateSalaryVersionInput({
        effectiveFromMonth: "2026-07",
        accountId: "santander",
        amountCents: 3_000_00,
        vacationBonusCents: 4_500_00,
        vacationBonusMonth: 7,
        christmasBonusCents: 4_250_00,
        christmasBonusMonth: 7,
      }),
    ).toThrow("não podem estar configurados para o mesmo mês");
  });
});
