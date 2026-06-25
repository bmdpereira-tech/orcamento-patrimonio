import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteRecurringRuleWhenAllowed } from "./recurring-rules";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  listManagedAccounts: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/server/supabase/client", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

vi.mock("./accounts", () => ({
  listManagedAccounts: mocks.listManagedAccounts,
}));

const ruleRow = {
  id: "rule-a",
  description: "Teste",
  amount_cents: 120_00,
  account_id: "santander",
  frequency: "monthly",
  start_month: "2026-09-01",
  end_month: "2026-10-01",
  active: true,
  charge_day: 15,
  archived_at: null,
  sort_order: 10,
};

function createDeleteClient({
  monthStateDeleteError = null,
  ruleDeleteData = { id: "rule-a" },
  ruleDeleteError = null,
}: {
  monthStateDeleteError?: { message: string } | null;
  ruleDeleteData?: { id: string } | null;
  ruleDeleteError?: { message: string } | null;
} = {}) {
  const selectRuleSingle = vi.fn(async () => ({ data: ruleRow, error: null }));
  const selectRuleEq = vi.fn(() => ({ single: selectRuleSingle }));
  const selectRule = vi.fn(() => ({ eq: selectRuleEq }));
  const overrideEq = vi.fn(async () => ({ count: 0, error: null }));
  const selectOverrides = vi.fn(() => ({ eq: overrideEq }));
  const monthStateDeleteEq = vi.fn(async () => ({ error: monthStateDeleteError }));
  const deleteMonthStates = vi.fn(() => ({ eq: monthStateDeleteEq }));
  const deleteRuleSingle = vi.fn(async () => ({ data: ruleDeleteData, error: ruleDeleteError }));
  const deleteRuleSelect = vi.fn(() => ({ single: deleteRuleSingle }));
  const deleteRuleEq = vi.fn(() => ({ select: deleteRuleSelect }));
  const deleteRule = vi.fn(() => ({ eq: deleteRuleEq }));
  const client = {
    from: vi.fn((table: string) => {
      if (table === "recurring_rules") {
        return { select: selectRule, delete: deleteRule };
      }

      if (table === "recurring_occurrence_overrides") {
        return { select: selectOverrides };
      }

      if (table === "recurring_rule_month_states") {
        return { delete: deleteMonthStates };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return {
    client,
    monthStateDeleteEq,
    deleteRule,
    deleteRuleEq,
    deleteRuleSelect,
    deleteRuleSingle,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recurring rule server service", () => {
  it("deletes monthly states before deleting and confirming the rule", async () => {
    const client = createDeleteClient();
    mocks.createSupabaseAdminClient.mockReturnValue(client.client);

    await expect(deleteRecurringRuleWhenAllowed("rule-a", "2026-08")).resolves.toEqual({
      deleted: true,
      reason: null,
    });

    expect(client.monthStateDeleteEq).toHaveBeenCalledWith("recurring_rule_id", "rule-a");
    expect(client.deleteRuleEq).toHaveBeenCalledWith("id", "rule-a");
    expect(client.deleteRuleSelect).toHaveBeenCalledWith("id");
    expect(client.monthStateDeleteEq.mock.invocationCallOrder[0]).toBeLessThan(
      client.deleteRule.mock.invocationCallOrder[0],
    );
  });

  it("keeps the rule when monthly state deletion fails", async () => {
    const client = createDeleteClient({ monthStateDeleteError: { message: "FK failure" } });
    mocks.createSupabaseAdminClient.mockReturnValue(client.client);

    await expect(deleteRecurringRuleWhenAllowed("rule-a", "2026-08")).rejects.toThrow(
      "Não foi possível eliminar os estados mensais do débito directo: FK failure",
    );
    expect(client.deleteRule).not.toHaveBeenCalled();
  });

  it("does not report success without confirmation of the deleted rule row", async () => {
    const client = createDeleteClient({ ruleDeleteData: null });
    mocks.createSupabaseAdminClient.mockReturnValue(client.client);

    await expect(deleteRecurringRuleWhenAllowed("rule-a", "2026-08")).rejects.toThrow(
      "Não foi possível confirmar a eliminação do débito directo.",
    );
    expect(client.deleteRuleSingle).toHaveBeenCalledTimes(1);
  });
});
