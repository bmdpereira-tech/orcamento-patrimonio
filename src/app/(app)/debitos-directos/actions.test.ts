import { describe, expect, it, vi, beforeEach } from "vitest";
import { deleteRecurringRuleAction } from "./actions";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  archiveRecurringRule: vi.fn(),
  createRecurringRule: vi.fn(),
  deleteRecurringRuleWhenAllowed: vi.fn(),
  reactivateRecurringRule: vi.fn(),
  setRecurringRuleActive: vi.fn(),
  updateRecurringRule: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/server/budget/recurring-rules", () => ({
  archiveRecurringRule: mocks.archiveRecurringRule,
  createRecurringRule: mocks.createRecurringRule,
  deleteRecurringRuleWhenAllowed: mocks.deleteRecurringRuleWhenAllowed,
  reactivateRecurringRule: mocks.reactivateRecurringRule,
  setRecurringRuleActive: mocks.setRecurringRuleActive,
  updateRecurringRule: mocks.updateRecurringRule,
}));

function deleteFormData(id: string) {
  const formData = new FormData();
  formData.set("id", id);

  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
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
    mocks.deleteRecurringRuleWhenAllowed.mockResolvedValue({ deleted: true, reason: null });

    await expect(deleteRecurringRuleAction(deleteFormData("rule-a"))).resolves.toEqual({ ok: true });

    expect(mocks.deleteRecurringRuleWhenAllowed).toHaveBeenCalledWith("rule-a");
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(1, "/debitos-directos");
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, "/orcamento");
  });

  it("returns Supabase delete errors without revalidating stale pages", async () => {
    mocks.deleteRecurringRuleWhenAllowed.mockRejectedValue(new Error("Não foi possível eliminar o débito directo."));

    await expect(deleteRecurringRuleAction(deleteFormData("rule-a"))).resolves.toEqual({
      ok: false,
      error: "Não foi possível eliminar o débito directo.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
