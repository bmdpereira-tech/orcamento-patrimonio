import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ManagedAccount } from "@/server/budget/accounts";
import type { RecurringRule } from "@/domain/budget/recurring-rules";
import { RecurringRulesManagement } from "./recurring-rules-management";

const accounts: ManagedAccount[] = [
  {
    id: "santander",
    name: "Santander",
    shortName: "Santander",
    accountType: "bank_account",
    isCreditCard: false,
    startMonth: "2026-07",
    showInBudget: true,
    includeInNetWorth: true,
    sortOrder: 10,
  },
  {
    id: "cc-santander",
    name: "CC Santander",
    shortName: "CC Santander",
    accountType: "credit_card",
    isCreditCard: true,
    startMonth: "2026-07",
    showInBudget: true,
    includeInNetWorth: true,
    sortOrder: 20,
  },
  {
    id: "n26",
    name: "N26",
    shortName: "N26",
    accountType: "bank_account",
    isCreditCard: false,
    startMonth: "2026-07",
    showInBudget: true,
    includeInNetWorth: true,
    sortOrder: 30,
  },
  {
    id: "archived-account",
    name: "Conta arquivada",
    shortName: "Arquivada",
    accountType: "bank_account",
    isCreditCard: false,
    startMonth: "2026-07",
    archivedFromMonth: "2026-08",
    showInBudget: true,
    includeInNetWorth: true,
    sortOrder: 40,
  },
];

const rule: RecurringRule = {
  id: "rule-a",
  description: "Electricidade",
  accountId: "santander",
  amountCents: 120_00,
  chargeDay: 15,
  frequency: "monthly",
  startMonth: "2026-07",
  active: true,
  sortOrder: 10,
};

function renderManagement({
  rules = [rule],
  createAction = vi.fn(async () => ({ ok: true as const, rule })),
  updateAction = vi.fn(async () => ({ ok: true as const, rule })),
  setActiveAction = vi.fn(async () => ({ ok: true as const, rule: { ...rule, active: false } })),
  archiveAction = vi.fn(async () => ({
    ok: true as const,
    rule: { ...rule, active: false, archivedAt: "2026-07-01T00:00:00Z" },
  })),
  reactivateAction = vi.fn(async () => ({ ok: true as const, rule: { ...rule, active: true } })),
  deleteAction = vi.fn(async () => ({ ok: true as const })),
}: {
  rules?: RecurringRule[];
  createAction?: (formData: FormData) => Promise<{ ok: true; rule: RecurringRule } | { ok: false; error: string }>;
  updateAction?: (formData: FormData) => Promise<{ ok: true; rule: RecurringRule } | { ok: false; error: string }>;
  setActiveAction?: (formData: FormData) => Promise<{ ok: true; rule: RecurringRule } | { ok: false; error: string }>;
  archiveAction?: (formData: FormData) => Promise<{ ok: true; rule: RecurringRule } | { ok: false; error: string }>;
  reactivateAction?: (formData: FormData) => Promise<{ ok: true; rule: RecurringRule } | { ok: false; error: string }>;
  deleteAction?: (formData: FormData) => Promise<{ ok: true } | { ok: false; error: string }>;
} = {}) {
  render(
    <RecurringRulesManagement
      accounts={accounts}
      rules={rules}
      createAction={createAction}
      updateAction={updateAction}
      setActiveAction={setActiveAction}
      archiveAction={archiveAction}
      reactivateAction={reactivateAction}
      deleteAction={deleteAction}
    />,
  );

  return { createAction, updateAction, setActiveAction, archiveAction, reactivateAction, deleteAction };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("RecurringRulesManagement", () => {
  it("shows every active account, including credit cards, and hides archived accounts for creation", () => {
    renderManagement({ rules: [] });

    const createAccountSelect = screen.getByLabelText("Conta");

    expect(createAccountSelect.textContent).toContain("Santander");
    expect(createAccountSelect.textContent).toContain("CC Santander");
    expect(createAccountSelect.textContent).toContain("N26");
    expect(createAccountSelect.textContent).not.toContain("Arquivada");
  });

  it("creates a direct debit rule", async () => {
    const createAction = vi.fn(async (formData: FormData) => ({
      ok: true as const,
      rule: {
        ...rule,
        id: "created",
        description: String(formData.get("description")),
        accountId: String(formData.get("accountId")),
      },
    }));

    renderManagement({ rules: [], createAction });

    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Electricidade" } });
    fireEvent.change(screen.getByLabelText("Conta"), { target: { value: "cc-santander" } });
    fireEvent.change(screen.getByLabelText("Montante"), { target: { value: "120,00" } });
    fireEvent.change(screen.getByLabelText("Dia"), { target: { value: "15" } });
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-07" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar débito directo" }));

    await waitFor(() => expect(createAction).toHaveBeenCalledTimes(1));
    expect((createAction.mock.calls[0]?.[0] as FormData).get("amount")).toBe("120,00");
    expect((createAction.mock.calls[0]?.[0] as FormData).get("accountId")).toBe("cc-santander");
    expect(screen.getByDisplayValue("Electricidade")).toBeTruthy();
  });

  it("autosaves description, amount, account and day edits with the latest values", async () => {
    vi.useFakeTimers();
    const updateAction = vi.fn(async (formData: FormData) => ({
      ok: true as const,
      rule: {
        ...rule,
        description: String(formData.get("description")),
        accountId: String(formData.get("accountId")),
        amountCents: 135_00,
        chargeDay: Number(formData.get("chargeDay")),
      },
    }));

    renderManagement({ updateAction });

    const descriptionInput = screen.getByLabelText("Descrição de Electricidade");
    const amountInput = screen.getByLabelText("Montante de Electricidade");
    const accountSelect = screen.getByLabelText("Conta de Electricidade");
    const dayInput = screen.getByLabelText("Dia de cobrança de Electricidade");

    fireEvent.change(descriptionInput, { target: { value: "Luz" } });
    fireEvent.change(amountInput, { target: { value: "135,00" } });
    fireEvent.change(accountSelect, { target: { value: "cc-santander" } });
    fireEvent.change(dayInput, { target: { value: "31" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(650);
    });

    expect(updateAction).toHaveBeenCalledTimes(1);
    const formData = updateAction.mock.calls[0]?.[0] as FormData;
    expect(formData.get("description")).toBe("Luz");
    expect(formData.get("amount")).toBe("135,00");
    expect(formData.get("accountId")).toBe("cc-santander");
    expect(formData.get("chargeDay")).toBe("31");
  });

  it("keeps an existing archived account visible on its own rule", () => {
    renderManagement({ rules: [{ ...rule, accountId: "archived-account" }] });

    expect(screen.getByLabelText("Conta de Electricidade").textContent).toContain("Arquivada");
  });

  it("deactivates, archives and reactivates rules", async () => {
    const setActiveAction = vi.fn<(formData: FormData) => Promise<{ ok: true; rule: RecurringRule }>>(async () => ({
      ok: true,
      rule: { ...rule, active: false },
    }));
    const archiveAction = vi.fn<(formData: FormData) => Promise<{ ok: true; rule: RecurringRule }>>(async () => ({
      ok: true as const,
      rule: { ...rule, active: false, archivedAt: "2026-07-01T00:00:00Z" },
    }));
    const reactivateAction = vi.fn<(formData: FormData) => Promise<{ ok: true; rule: RecurringRule }>>(async () => ({
      ok: true,
      rule: { ...rule, active: true },
    }));

    renderManagement({
      rules: [
        rule,
        { ...rule, id: "archived", description: "Ginásio", archivedAt: "2026-07-01T00:00:00Z", active: false },
      ],
      setActiveAction,
      archiveAction,
      reactivateAction,
    });

    fireEvent.click(screen.getByLabelText("Activo"));
    await waitFor(() => expect(setActiveAction).toHaveBeenCalledTimes(1));
    expect((setActiveAction.mock.calls[0]?.[0] as FormData).get("active")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Arquivar" }));
    await waitFor(() => expect(archiveAction).toHaveBeenCalledTimes(1));

    const [reactivateButton] = screen.getAllByRole("button", { name: "Reactivar" });
    fireEvent.click(reactivateButton);
    await waitFor(() => expect(reactivateAction).toHaveBeenCalledTimes(1));
  });

  it("removes a bank account rule locally after successful delete", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const deleteAction = vi.fn(async () => ({ ok: true as const }));

    renderManagement({ deleteAction });

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(deleteAction).toHaveBeenCalledTimes(1));
    expect(screen.queryByDisplayValue("Electricidade")).toBeNull();
  });

  it("removes a credit card rule locally after successful delete", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const deleteAction = vi.fn(async (formData: FormData) => {
      expect(formData.get("id")).toBe("card-rule");

      return { ok: true as const };
    });

    renderManagement({
      rules: [{ ...rule, id: "card-rule", description: "ChatGPT", accountId: "cc-santander" }],
      deleteAction,
    });

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(deleteAction).toHaveBeenCalledTimes(1));
    expect(screen.queryByDisplayValue("ChatGPT")).toBeNull();
  });

  it("shows a clear delete blocking message", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const deleteAction = vi.fn(async () => ({
      ok: false as const,
      error: "Este débito directo já pode afectar meses históricos. Arquive-o para preservar os dados.",
    }));

    renderManagement({ deleteAction });

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(deleteAction).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Erro ao guardar")).toBeTruthy();
    expect(
      screen.getByText("Este débito directo já pode afectar meses históricos. Arquive-o para preservar os dados."),
    ).toBeTruthy();
    expect(screen.getByDisplayValue("Electricidade")).toBeTruthy();
  });
});
