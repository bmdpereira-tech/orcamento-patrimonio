import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LiquidityAccount } from "../domain/budget/accounts";
import type { Cents } from "../domain/budget/money";
import {
  buildBudgetOverview,
  createEmptySnapshot,
  type MonthlyCustomBudgetItem,
} from "../domain/budget/monthly-view";
import { MonthlyBudgetTable } from "./monthly-budget-table";

const accounts: LiquidityAccount[] = [
  {
    id: "account-a",
    name: "Conta A",
    shortName: "Conta A",
    isCreditCard: false,
    startMonth: "2026-07",
    showInBudget: true,
    includeInNetWorth: true,
    sortOrder: 10,
  },
];

function createOverview({
  currentBalanceCents = 75_00,
  customItems = [],
}: {
  currentBalanceCents?: Cents;
  customItems?: MonthlyCustomBudgetItem[];
} = {}) {
  return buildBudgetOverview({
    month: "2026-07",
    accounts,
    investmentAssets: [],
    snapshots: [
      {
        ...createEmptySnapshot("account-a"),
        initialBalanceCents: 100_00,
        realisedMovementsCents: currentBalanceCents - 100_00,
        currentBalanceCents,
        finalBalanceCents: currentBalanceCents,
      },
    ],
    customItems,
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("MonthlyBudgetTable", () => {
  it("renders current balance as editable and realised movements as read-only", () => {
    render(<MonthlyBudgetTable overview={createOverview()} editable />);

    expect(screen.queryByLabelText("Movimentos realizados — Conta A")).toBeNull();
    expect(screen.getByLabelText("Saldo actual — Conta A")).toBeTruthy();
    expect(screen.getByLabelText("Saldo inicial — Conta A")).toBeTruthy();
  });

  it("removes the global save button and the custom line type selector", () => {
    render(
      <MonthlyBudgetTable
        overview={createOverview({
          customItems: [
            {
              id: "custom-a",
              month: "2026-07",
              description: "Ajuste",
              sortOrder: 10,
              valuesByAccountId: { "account-a": -25_00 },
            },
          ],
        })}
        editable
        addCustomItemAction={async () => ({
          ok: true,
          item: {
            id: "custom-b",
            month: "2026-07",
            description: "Nova linha",
            sortOrder: 20,
            valuesByAccountId: {},
          },
        })}
      />,
    );

    expect(screen.queryByRole("button", { name: "Guardar alterações" })).toBeNull();
    expect(screen.queryByLabelText(/Tipo da linha/)).toBeNull();
    expect(screen.getByRole("button", { name: "Adicionar linha" })).toBeTruthy();
  });

  it("uses custom line values directly as signed amounts", () => {
    render(
      <MonthlyBudgetTable
        overview={createOverview({
          currentBalanceCents: 100_00,
          customItems: [
            {
              id: "custom-a",
              month: "2026-07",
              description: "Ajuste",
              sortOrder: 10,
              valuesByAccountId: { "account-a": -25_00 },
            },
          ],
        })}
        editable
      />,
    );

    expect(within(screen.getByRole("row", { name: /Saldo final/ })).getAllByText("75,00 €").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Ajuste — Conta A"), { target: { value: "25,00" } });

    expect(within(screen.getByRole("row", { name: /Saldo final/ })).getAllByText("125,00 €").length).toBeGreaterThan(0);
  });

  it("autosaves on blur without the global submit button", async () => {
    const saveBudgetAction = vi.fn<(formData: FormData) => Promise<{ ok: true }>>(async () => ({ ok: true }));

    render(<MonthlyBudgetTable overview={createOverview()} editable saveBudgetAction={saveBudgetAction} />);

    const input = screen.getByLabelText("Saldo actual — Conta A");
    fireEvent.change(input, { target: { value: "80,00" } });
    fireEvent.blur(input);

    await waitFor(() => expect(saveBudgetAction).toHaveBeenCalledTimes(1));
    expect((saveBudgetAction.mock.calls[0]?.[0] as FormData).get("cell:current-balance:account-a")).toBe("80,00");
    expect(screen.getByText("Guardado")).toBeTruthy();
  });

  it("debounces autosave and keeps only the latest value", async () => {
    vi.useFakeTimers();
    const saveBudgetAction = vi.fn<(formData: FormData) => Promise<{ ok: true }>>(async () => ({ ok: true }));

    render(<MonthlyBudgetTable overview={createOverview()} editable saveBudgetAction={saveBudgetAction} />);

    const input = screen.getByLabelText("Saldo actual — Conta A");
    fireEvent.change(input, { target: { value: "80,00" } });
    fireEvent.change(input, { target: { value: "90,50" } });

    expect(screen.getByText("A guardar…")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(649);
    });
    expect(saveBudgetAction).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(saveBudgetAction).toHaveBeenCalledTimes(1);
    expect((saveBudgetAction.mock.calls[0]?.[0] as FormData).get("cell:current-balance:account-a")).toBe("90,50");
  });

  it("shows an autosave error state", async () => {
    vi.useFakeTimers();
    const saveBudgetAction = vi.fn<(formData: FormData) => Promise<{ ok: false; error: string }>>(async () => ({
      ok: false,
      error: "Falhou",
    }));

    render(<MonthlyBudgetTable overview={createOverview()} editable saveBudgetAction={saveBudgetAction} />);

    fireEvent.change(screen.getByLabelText("Saldo actual — Conta A"), { target: { value: "80,00" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(650);
    });

    expect(screen.getByText("Erro ao guardar")).toBeTruthy();
  });

  it("creates a custom line with the returned id and deletes it by id only", async () => {
    const addCustomItemAction = vi.fn<
      (formData: FormData) => Promise<{
        ok: true;
        item: MonthlyCustomBudgetItem;
      }>
    >(async () => ({
      ok: true as const,
      item: {
        id: "server-id",
        month: "2026-07" as const,
        description: "Nova linha",
        sortOrder: 10,
        valuesByAccountId: {},
      },
    }));
    const deleteCustomItemAction = vi.fn<(formData: FormData) => Promise<{ ok: true }>>(async () => ({
      ok: true,
    }));

    render(
      <MonthlyBudgetTable
        overview={createOverview()}
        editable
        addCustomItemAction={addCustomItemAction}
        deleteCustomItemAction={deleteCustomItemAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Adicionar linha" }));

    await waitFor(() => expect(addCustomItemAction).toHaveBeenCalledTimes(1));
    expect(screen.getByDisplayValue("Nova linha")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Nova linha" }));

    await waitFor(() => expect(deleteCustomItemAction).toHaveBeenCalledTimes(1));
    expect((deleteCustomItemAction.mock.calls[0]?.[0] as FormData).get("customItemId")).toBe("server-id");
    expect(screen.queryByDisplayValue("Nova linha")).toBeNull();
  });
});
