import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  saveMonthlyBudgetAction,
  setCreditCardStatementOverrideAction,
  setDirectDebitForecastExclusionAction,
  setSalaryMonthOverrideAction,
} from "./actions";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  clearCreditCardStatementOverride: vi.fn(),
  getMonthlyBudgetFinancialChangeMonth: vi.fn(),
  saveMonthlyBudgetValues: vi.fn(),
  setCreditCardStatementOverride: vi.fn(),
  setRecurringRuleMonthExcluded: vi.fn(),
  saveSalaryMonthState: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/server/budget/monthly-overview", () => ({
  getMonthlyBudgetFinancialChangeMonth: mocks.getMonthlyBudgetFinancialChangeMonth,
  saveMonthlyBudgetValues: mocks.saveMonthlyBudgetValues,
}));

vi.mock("@/server/budget/credit-card-payments", () => ({
  clearCreditCardStatementOverride: mocks.clearCreditCardStatementOverride,
  setCreditCardStatementOverride: mocks.setCreditCardStatementOverride,
}));

vi.mock("@/server/budget/recurring-rules", () => ({
  setRecurringRuleMonthExcluded: mocks.setRecurringRuleMonthExcluded,
}));

vi.mock("@/server/budget/salary", () => ({
  saveSalaryMonthState: mocks.saveSalaryMonthState,
}));

function budgetFormData(month = "2026-08") {
  const formData = new FormData();
  formData.set("month", month);
  formData.append("accountId", "account-a");
  formData.set("cell:initial-balance:account-a", "100,00");
  formData.set("cell:realised-movements:account-a", "-20,00");
  formData.append("customItemId", "custom-a");
  formData.set("custom:custom-a:description", "Ajuste");
  formData.set("custom:custom-a:sortOrder", "10");
  formData.set("custom:custom-a:account:account-a", "0,00");

  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-15T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("budget server actions historical protection", () => {
  it("rejects historical monthly budget saves before writing", async () => {
    mocks.getMonthlyBudgetFinancialChangeMonth.mockResolvedValue("2026-08");

    await expect(saveMonthlyBudgetAction(budgetFormData())).resolves.toMatchObject({
      ok: false,
      requiresConfirmation: true,
      firstAffectedMonth: "2026-08",
    });
    expect(mocks.saveMonthlyBudgetValues).not.toHaveBeenCalled();
  });

  it("saves historical monthly budget values after explicit confirmation", async () => {
    mocks.getMonthlyBudgetFinancialChangeMonth.mockResolvedValue("2026-08");
    const formData = budgetFormData();
    formData.set("confirmHistoricalImpact", "true");

    await expect(saveMonthlyBudgetAction(formData)).resolves.toEqual({ ok: true });

    expect(mocks.saveMonthlyBudgetValues).toHaveBeenCalledTimes(1);
    expect(mocks.saveMonthlyBudgetValues).toHaveBeenCalledWith(
      expect.objectContaining({
        month: "2026-08",
        values: {
          "initial-balance": { "account-a": 100_00 },
          "realised-movements": { "account-a": -20_00 },
        },
      }),
    );
  });

  it("does not request confirmation when the server detects no financial change", async () => {
    mocks.getMonthlyBudgetFinancialChangeMonth.mockResolvedValue(null);

    await expect(saveMonthlyBudgetAction(budgetFormData())).resolves.toEqual({ ok: true });

    expect(mocks.saveMonthlyBudgetValues).toHaveBeenCalledTimes(1);
  });

  it("rejects direct debit, card and salary monthly changes in past months without confirmation", async () => {
    const directDebitFormData = new FormData();
    directDebitFormData.set("recurringRuleId", "rule-a");
    directDebitFormData.set("month", "2026-08");
    directDebitFormData.set("excludedFromForecast", "true");

    const cardFormData = new FormData();
    cardFormData.set("creditCardAccountId", "card-a");
    cardFormData.set("month", "2026-08");
    cardFormData.set("statementAmount", "100,00");

    const salaryFormData = new FormData();
    salaryFormData.set("month", "2026-08");
    salaryFormData.set("reflectedInCurrentBalance", "true");

    await expect(setDirectDebitForecastExclusionAction(directDebitFormData)).resolves.toMatchObject({
      ok: false,
      requiresConfirmation: true,
      firstAffectedMonth: "2026-08",
    });
    await expect(setCreditCardStatementOverrideAction(cardFormData)).resolves.toMatchObject({
      ok: false,
      requiresConfirmation: true,
      firstAffectedMonth: "2026-08",
    });
    await expect(setSalaryMonthOverrideAction(salaryFormData)).resolves.toMatchObject({
      ok: false,
      requiresConfirmation: true,
      firstAffectedMonth: "2026-08",
    });
    expect(mocks.setRecurringRuleMonthExcluded).not.toHaveBeenCalled();
    expect(mocks.setCreditCardStatementOverride).not.toHaveBeenCalled();
    expect(mocks.saveSalaryMonthState).not.toHaveBeenCalled();
  });
});
