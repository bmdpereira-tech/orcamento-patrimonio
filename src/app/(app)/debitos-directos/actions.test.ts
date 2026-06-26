import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRecurringRuleAction, deleteRecurringRuleAction, setRecurringRuleActiveAction } from "./actions";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(() => ({})),
  revalidatePath: vi.fn(),
  archiveRecurringRule: vi.fn(),
  createRecurringRule: vi.fn(),
  deleteRecurringRuleWhenAllowed: vi.fn(),
  getRecurringRuleById: vi.fn(),
  getRecurringRuleFinancialImpactMonth: vi.fn(),
  reactivateRecurringRule: vi.fn(),
  setRecurringRuleActive: vi.fn(),
  updateRecurringRule: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/server/supabase/client", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

vi.mock("@/server/budget/recurring-rules", () => ({
  archiveRecurringRule: mocks.archiveRecurringRule,
  createRecurringRule: mocks.createRecurringRule,
  deleteRecurringRuleWhenAllowed: mocks.deleteRecurringRuleWhenAllowed,
  getRecurringRuleById: mocks.getRecurringRuleById,
  getRecurringRuleFinancialImpactMonth: mocks.getRecurringRuleFinancialImpactMonth,
  reactivateRecurringRule: mocks.reactivateRecurringRule,
  setRecurringRuleActive: mocks.setRecurringRuleActive,
  updateRecurringRule: mocks.updateRecurringRule,
}));

function deleteFormData(id: string) {
  const formData = new FormData();
  formData.set("id", id);

  return formData;
}

function activeFormData(id: string, active: boolean) {
  const formData = new FormData();
  formData.set("id", id);
  formData.set("active", String(active));

  return formData;
}

function recurringRuleFormData({ startMonth = "2026-07" } = {}) {
  const formData = new FormData();
  formData.set("description", "Electricidade");
  formData.set("accountId", "santander");
  formData.set("amount", "120,00");
  formData.set("chargeDay", "15");
  formData.set("startMonth", startMonth);
  formData.set("endMonth", "");
  formData.set("active", "true");
  formData.set("sortOrder", "10");

  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("direct debit server actions", () => {
  it("validates the delete id before calling the server service", async () => {
    await expect(deleteRecurringRuleAction(deleteFormData(""))).resolves.toEqual({
      ok: false,
      error: "Débito directo inválido.",
    });
    expect(mocks.deleteRecurringRuleWhenAllowed).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates direct debit and budget pages after successful delete", async () => {
    mocks.getRecurringRuleById.mockResolvedValue({ startMonth: "2026-07" });
    mocks.deleteRecurringRuleWhenAllowed.mockResolvedValue({ deleted: true, reason: null });

    await expect(deleteRecurringRuleAction(deleteFormData("rule-a"))).resolves.toEqual({ ok: true });

    expect(mocks.deleteRecurringRuleWhenAllowed).toHaveBeenCalledWith("rule-a", undefined, {
      allowHistoricalImpact: false,
    });
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(1, "/debitos-directos");
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, "/orcamento");
  });

  it("returns Supabase delete errors without revalidating stale pages", async () => {
    mocks.getRecurringRuleById.mockResolvedValue({ startMonth: "2026-07" });
    mocks.deleteRecurringRuleWhenAllowed.mockRejectedValue(new Error("Não foi possível eliminar o débito directo."));

    await expect(deleteRecurringRuleAction(deleteFormData("rule-a"))).resolves.toEqual({
      ok: false,
      error: "Não foi possível eliminar o débito directo.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a direct historical delete without explicit confirmation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T10:00:00Z"));
    mocks.getRecurringRuleById.mockResolvedValue({ startMonth: "2026-08" });

    await expect(deleteRecurringRuleAction(deleteFormData("rule-a"))).resolves.toMatchObject({
      ok: false,
      requiresConfirmation: true,
      firstAffectedMonth: "2026-08",
      affectsFollowingMonths: true,
    });
    expect(mocks.deleteRecurringRuleWhenAllowed).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("deletes a historical rule only after explicit confirmation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T10:00:00Z"));
    mocks.getRecurringRuleById.mockResolvedValue({ startMonth: "2026-08" });
    mocks.deleteRecurringRuleWhenAllowed.mockResolvedValue({ deleted: true, reason: null });
    const formData = deleteFormData("rule-a");
    formData.set("confirmHistoricalImpact", "true");

    await expect(deleteRecurringRuleAction(formData)).resolves.toEqual({ ok: true });

    expect(mocks.deleteRecurringRuleWhenAllowed).toHaveBeenCalledWith("rule-a", undefined, {
      allowHistoricalImpact: true,
    });
  });

  it("rejects a retroactive direct debit rule creation before writing", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T10:00:00Z"));

    await expect(createRecurringRuleAction(recurringRuleFormData({ startMonth: "2026-08" }))).resolves.toMatchObject({
      ok: false,
      requiresConfirmation: true,
      firstAffectedMonth: "2026-08",
    });
    expect(mocks.createRecurringRule).not.toHaveBeenCalled();
  });

  it("does not request historical confirmation when the active state is unchanged", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T10:00:00Z"));
    mocks.getRecurringRuleById.mockResolvedValue({
      id: "rule-a",
      startMonth: "2026-08",
      active: false,
    });
    mocks.setRecurringRuleActive.mockResolvedValue({
      id: "rule-a",
      startMonth: "2026-08",
      active: false,
    });

    await expect(setRecurringRuleActiveAction(activeFormData("rule-a", false))).resolves.toMatchObject({
      ok: true,
      rule: {
        id: "rule-a",
        active: false,
      },
    });

    expect(mocks.setRecurringRuleActive).toHaveBeenCalledWith("rule-a", false);
  });
});
