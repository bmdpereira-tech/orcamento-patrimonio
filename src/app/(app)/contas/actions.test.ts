import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { archiveAccountAction, updateAccountAction } from "./actions";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  archiveAccount: vi.fn(),
  createAccount: vi.fn(),
  deleteAccountWhenAllowed: vi.fn(),
  getAccountById: vi.fn(),
  getAccountFinancialImpactMonth: vi.fn(),
  reactivateAccount: vi.fn(),
  updateAccount: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/server/budget/accounts", () => ({
  archiveAccount: mocks.archiveAccount,
  createAccount: mocks.createAccount,
  deleteAccountWhenAllowed: mocks.deleteAccountWhenAllowed,
  getAccountById: mocks.getAccountById,
  getAccountFinancialImpactMonth: mocks.getAccountFinancialImpactMonth,
  isAccountType: (value: string) =>
    ["bank_account", "credit_card", "savings", "investment_cash", "cash", "other"].includes(value),
  reactivateAccount: mocks.reactivateAccount,
  updateAccount: mocks.updateAccount,
}));

function accountFormData(id = "account-a") {
  const formData = new FormData();
  formData.set("id", id);
  formData.set("name", "Santander");
  formData.set("shortName", "Santander");
  formData.set("accountType", "bank_account");
  formData.set("startMonth", "2026-07");
  formData.set("sortOrder", "10");
  formData.set("showInBudget", "on");
  formData.set("includeInNetWorth", "on");
  formData.set("archiveFromMonth", "2026-08");

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

describe("account server actions historical protection", () => {
  it("does not require confirmation for name-only account edits", async () => {
    mocks.getAccountFinancialImpactMonth.mockResolvedValue(null);

    await expect(updateAccountAction(accountFormData())).resolves.toEqual({ ok: true, status: "updated" });

    expect(mocks.updateAccount).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(1, "/contas");
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, "/orcamento");
  });

  it("rejects historical account archive without writing", async () => {
    await expect(archiveAccountAction(accountFormData())).resolves.toMatchObject({
      ok: false,
      requiresConfirmation: true,
      firstAffectedMonth: "2026-08",
    });
    expect(mocks.archiveAccount).not.toHaveBeenCalled();
  });

  it("archives a historical account after explicit confirmation", async () => {
    const formData = accountFormData();
    formData.set("confirmHistoricalImpact", "true");

    await expect(archiveAccountAction(formData)).resolves.toEqual({ ok: true, status: "archived" });

    expect(mocks.archiveAccount).toHaveBeenCalledWith("account-a", "2026-08");
  });
});
