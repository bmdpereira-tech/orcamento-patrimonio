import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveDailyBudgetVersionAction, saveSalaryVersionAction } from "./actions";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  saveDailyBudgetVersion: vi.fn(),
  saveSalaryVersion: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/server/budget/daily-budget", () => ({
  saveDailyBudgetVersion: mocks.saveDailyBudgetVersion,
}));

vi.mock("@/server/budget/salary", () => ({
  saveSalaryVersion: mocks.saveSalaryVersion,
}));

function dailyFormData(effectiveFromMonth = "2026-08") {
  const formData = new FormData();
  formData.set("accountId", "santander");
  formData.set("effectiveFromMonth", effectiveFromMonth);
  formData.set("dailyAmount", "50,00");

  return formData;
}

function salaryFormData(effectiveFromMonth = "2026-08") {
  const formData = new FormData();
  formData.set("accountId", "santander");
  formData.set("effectiveFromMonth", effectiveFromMonth);
  formData.set("amount", "3000,00");
  formData.set("vacationBonus", "4500,00");
  formData.set("vacationBonusMonth", "7");
  formData.set("christmasBonus", "4250,00");
  formData.set("christmasBonusMonth", "12");

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

describe("settings server actions historical protection", () => {
  it("rejects retroactive Day to day configuration without writing", async () => {
    await expect(saveDailyBudgetVersionAction(dailyFormData())).resolves.toMatchObject({
      ok: false,
      requiresConfirmation: true,
      firstAffectedMonth: "2026-08",
    });
    expect(mocks.saveDailyBudgetVersion).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("saves retroactive Day to day configuration after explicit confirmation", async () => {
    const formData = dailyFormData();
    formData.set("confirmHistoricalImpact", "true");

    await expect(saveDailyBudgetVersionAction(formData)).resolves.toEqual({ ok: true });

    expect(mocks.saveDailyBudgetVersion).toHaveBeenCalledWith({
      accountId: "santander",
      effectiveFromMonth: "2026-08",
      dailyAmountCents: 50_00,
    });
  });

  it("does not require confirmation for current or future salary configuration", async () => {
    await expect(saveSalaryVersionAction(salaryFormData("2026-09"))).resolves.toEqual({ ok: true });
    await expect(saveSalaryVersionAction(salaryFormData("2026-10"))).resolves.toEqual({ ok: true });

    expect(mocks.saveSalaryVersion).toHaveBeenCalledTimes(2);
  });

  it("rejects retroactive salary configuration without writing", async () => {
    await expect(saveSalaryVersionAction(salaryFormData())).resolves.toMatchObject({
      ok: false,
      requiresConfirmation: true,
      firstAffectedMonth: "2026-08",
    });
    expect(mocks.saveSalaryVersion).not.toHaveBeenCalled();
  });
});
