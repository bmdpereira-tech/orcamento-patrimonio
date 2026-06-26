import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LiquidityAccount } from "../domain/budget/accounts";
import type { MonthlyCreditCardPayment } from "../domain/budget/credit-card-payments";
import { parseEuroCents, type Cents } from "../domain/budget/money";
import type { MonthId } from "../domain/budget/months";
import {
  buildBudgetOverview,
  createEmptySnapshot,
  type MonthlyCustomBudgetItem,
} from "../domain/budget/monthly-view";
import type { MonthlyDirectDebitOccurrence } from "../domain/budget/recurring-rules";
import type { MonthlySalaryForecast } from "../domain/budget/salary";
import { MonthlyBudgetTable } from "./monthly-budget-table";

const accountA: LiquidityAccount = {
  id: "account-a",
  name: "Conta A",
  shortName: "Conta A",
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
  linkedPaymentAccountId: "account-a",
  startMonth: "2026-07",
  showInBudget: true,
  includeInNetWorth: true,
  sortOrder: 20,
};
const accountB: LiquidityAccount = {
  id: "account-b",
  name: "Conta B",
  shortName: "Conta B",
  isCreditCard: false,
  startMonth: "2026-07",
  showInBudget: true,
  includeInNetWorth: true,
  sortOrder: 30,
};
const accounts: LiquidityAccount[] = [accountA];

const directDebitOccurrences: MonthlyDirectDebitOccurrence[] = [
  {
    ruleId: "electricity",
    month: "2026-07",
    description: "Electricidade",
    accountId: "account-a",
    accountName: "Conta A",
    accountSortOrder: 10,
    amountCents: 120_00,
    chargeDay: 1,
    excludedFromForecast: false,
  },
  {
    ruleId: "water",
    month: "2026-07",
    description: "Água",
    accountId: "account-a",
    accountName: "Conta A",
    accountSortOrder: 10,
    amountCents: 35_00,
    chargeDay: 31,
    excludedFromForecast: false,
  },
  {
    ruleId: "chatgpt",
    month: "2026-07",
    description: "ChatGPT",
    accountId: "cc-santander",
    accountName: "CC Santander",
    accountSortOrder: 20,
    amountCents: 23_00,
    chargeDay: 10,
    excludedFromForecast: false,
  },
];

function createSalaryForecast({
  month = "2026-07",
  amountCents = 3_000_00,
  reflectedInCurrentBalance = false,
}: {
  month?: MonthId;
  amountCents?: Cents;
  reflectedInCurrentBalance?: boolean;
} = {}): MonthlySalaryForecast {
  return {
    month,
    version: {
      id: "salary-version",
      effectiveFromMonth: "2026-07",
      amountCents,
      accountId: "account-a",
      vacationBonusCents: 4_500_00,
      vacationBonusMonth: 7,
      christmasBonusCents: 4_250_00,
      christmasBonusMonth: 12,
    },
    accountId: "account-a",
    accountName: "Conta A",
    baseAmountCents: amountCents,
    amountBeforeStatusCents: amountCents,
    amountCents: reflectedInCurrentBalance ? 0 : amountCents,
    reflectedInCurrentBalance,
    status: reflectedInCurrentBalance ? "received" : "planned",
  };
}

function expectCheckboxChecked(element: HTMLElement, checked: boolean) {
  expect((element as HTMLInputElement).checked).toBe(checked);
}

function createOverview({
  currentBalanceCents = 75_00,
  currentBalanceByAccountId = {},
  directDebitsCents = 0,
  dayToDayCents = 0,
  salaryCents = 0,
  salaryForecast = null,
  creditCardPayments = [],
  customItems = [],
  overviewAccounts = accounts,
  occurrences = [],
  month = "2026-07",
}: {
  currentBalanceCents?: Cents;
  currentBalanceByAccountId?: Partial<Record<string, Cents>>;
  directDebitsCents?: Cents;
  dayToDayCents?: Cents;
  salaryCents?: Cents;
  salaryForecast?: MonthlySalaryForecast | null;
  creditCardPayments?: MonthlyCreditCardPayment[];
  customItems?: MonthlyCustomBudgetItem[];
  overviewAccounts?: LiquidityAccount[];
  occurrences?: MonthlyDirectDebitOccurrence[];
  month?: MonthId;
} = {}) {
  return buildBudgetOverview({
    month,
    accounts: overviewAccounts,
    investmentAssets: [],
    snapshots: overviewAccounts.map((account) => ({
        ...createEmptySnapshot(account.id),
        initialBalanceCents: 100_00,
        ...(() => {
          const accountCurrentBalanceCents = currentBalanceByAccountId[account.id] ?? currentBalanceCents;
          const accountDirectDebitsCents = account.id === "account-a" ? directDebitsCents : 0;
          const accountDayToDayCents = account.id === "account-a" ? dayToDayCents : 0;
          const accountSalaryCents = account.id === "account-a" ? salaryCents : 0;

          return {
            realisedMovementsCents: accountCurrentBalanceCents - 100_00,
            currentBalanceCents: accountCurrentBalanceCents,
            directDebitsCents: accountDirectDebitsCents,
            dayToDayCents: accountDayToDayCents,
            salaryCents: accountSalaryCents,
            subtotalBeforeSalaryCents:
              accountCurrentBalanceCents + accountDirectDebitsCents + accountDayToDayCents,
            finalBalanceCents:
              accountCurrentBalanceCents + accountDirectDebitsCents + accountDayToDayCents + accountSalaryCents,
          };
        })(),
    })),
    customItems,
    directDebitOccurrences: occurrences,
    creditCardPayments,
    salaryForecast,
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

  it("renders direct debits as automatic read-only values", () => {
    render(<MonthlyBudgetTable overview={createOverview({ currentBalanceCents: 100_00, directDebitsCents: -45_00 })} editable />);

    expect(screen.queryByLabelText("Débitos directos — Conta A")).toBeNull();
    expect(within(screen.getByRole("row", { name: /Débitos directos/ })).getAllByText("(45,00 €)").length).toBeGreaterThan(0);
    expect(within(screen.getByRole("row", { name: /Saldo final/ })).getAllByText("55,00 €").length).toBeGreaterThan(0);
  });

  it("shows zero direct debits as a dash", () => {
    render(<MonthlyBudgetTable overview={createOverview({ directDebitsCents: 0 })} editable />);

    expect(within(screen.getByRole("row", { name: /Débitos directos/ })).getAllByText("–").length).toBeGreaterThan(0);
  });

  it("renders day-to-day and credit card payments as read-only automatic lines", () => {
    render(
      <MonthlyBudgetTable
        overview={createOverview({
          overviewAccounts: [accountA, creditCardAccount],
          currentBalanceByAccountId: {
            "account-a": 1_000_00,
            "cc-santander": -125_00,
          },
          dayToDayCents: -50_00,
        })}
        editable
      />,
    );

    expect(screen.queryByLabelText("Day to day — Conta A")).toBeNull();
    expect(screen.queryByLabelText("Pagamentos de cartões — Conta A")).toBeNull();
    expect(within(screen.getByRole("row", { name: /Day to day/ })).getAllByText("(50,00 €)").length).toBeGreaterThan(0);
    expect(within(screen.getByRole("row", { name: /Pagamentos de cartões/ })).getByText("(125,00 €)")).toBeTruthy();
    expect(within(screen.getByRole("row", { name: /Pagamentos de cartões/ })).getByText("125,00 €")).toBeTruthy();
    expect(within(screen.getByRole("row", { name: /Saldo final/ })).getAllByText("825,00 €").length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: "Pagamentos de cartões do mês" })).toBeNull();
    expectCheckboxChecked(screen.getByLabelText("Usar valor do extracto — CC Santander"), false);
    expect((screen.getByLabelText("Valor do extracto — CC Santander") as HTMLInputElement).disabled).toBe(true);
  });

  it("renders salary as a read-only automatic income applied to the configured account", () => {
    render(
      <MonthlyBudgetTable
        overview={createOverview({
          currentBalanceCents: 100_00,
          salaryCents: 3_000_00,
          salaryForecast: createSalaryForecast({ amountCents: 3_000_00 }),
        })}
        editable
      />,
    );

    expect(screen.queryByLabelText("Salário — Conta A")).toBeNull();
    expect(within(screen.getByRole("row", { name: /Salário/ })).getAllByText("3 000,00 €").length).toBeGreaterThan(0);
    expect(within(screen.getByRole("row", { name: /Saldo final/ })).getAllByText("3 100,00 €").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Salário do mês" })).toBeTruthy();
    expect(screen.queryByLabelText("Valor excepcional do salário")).toBeNull();
    expect(screen.queryByLabelText("Usar valor excepcional do salário")).toBeNull();
    expect(screen.getByTestId("monthly-salary-control").className).toContain("max-w-2xl");
  });

  it("marks salary as already reflected only for the selected month", async () => {
    const setSalaryMonthOverrideAction = vi.fn(async (formData: FormData) => ({
      ok: true as const,
      override: {
        month: String(formData.get("month")),
        reflectedInCurrentBalance: String(formData.get("reflectedInCurrentBalance")) === "true",
      },
    }));
    const { rerender } = render(
      <MonthlyBudgetTable
        overview={createOverview({
          currentBalanceCents: 100_00,
          salaryCents: 3_000_00,
          salaryForecast: createSalaryForecast({ amountCents: 3_000_00 }),
        })}
        editable
        setSalaryMonthOverrideAction={setSalaryMonthOverrideAction}
      />,
    );

    const checkbox = screen.getByLabelText("Já reflectido no saldo actual");
    fireEvent.click(checkbox);

    expectCheckboxChecked(checkbox, true);
    expect(within(screen.getByRole("row", { name: /Salário/ })).getAllByText("–").length).toBeGreaterThan(0);
    expect(within(screen.getByRole("row", { name: /Saldo final/ })).getAllByText("100,00 €").length).toBeGreaterThan(0);
    await waitFor(() => expect(setSalaryMonthOverrideAction).toHaveBeenCalledTimes(1));
    expect((setSalaryMonthOverrideAction.mock.calls[0]?.[0] as FormData).get("reflectedInCurrentBalance")).toBe(
      "true",
    );
    expect((setSalaryMonthOverrideAction.mock.calls[0]?.[0] as FormData).has("amount")).toBe(false);

    rerender(
      <MonthlyBudgetTable
        overview={createOverview({
          month: "2026-08",
          currentBalanceCents: 100_00,
          salaryCents: 3_000_00,
          salaryForecast: createSalaryForecast({ month: "2026-08", amountCents: 3_000_00 }),
        })}
        editable
        setSalaryMonthOverrideAction={setSalaryMonthOverrideAction}
      />,
    );

    expectCheckboxChecked(screen.getByLabelText("Já reflectido no saldo actual"), false);
    expect(within(screen.getByRole("row", { name: /Salário/ })).getAllByText("3 000,00 €").length).toBeGreaterThan(0);
  });

  it("enables, updates and autosaves a credit card statement override in a future month", async () => {
    vi.useFakeTimers();
    const setCreditCardStatementOverrideAction = vi.fn(async (formData: FormData) => ({
      ok: true as const,
      override: {
        creditCardAccountId: String(formData.get("creditCardAccountId")),
        month: String(formData.get("month")),
        statementAmountCents: parseEuroCents(formData.get("statementAmount")),
      },
    }));

    render(
      <MonthlyBudgetTable
        overview={createOverview({
          month: "2026-12",
          overviewAccounts: [accountA, creditCardAccount],
          currentBalanceByAccountId: {
            "account-a": 1_000_00,
            "cc-santander": -125_00,
          },
        })}
        editable
        setCreditCardStatementOverrideAction={setCreditCardStatementOverrideAction}
      />,
    );

    const overrideInput = screen.getByLabelText("Valor do extracto — CC Santander") as HTMLInputElement;
    const overrideCheckbox = screen.getByLabelText("Usar valor do extracto — CC Santander");

    expect(overrideInput.disabled).toBe(true);
    fireEvent.click(overrideCheckbox);

    expectCheckboxChecked(overrideCheckbox, true);
    expect(overrideInput.disabled).toBe(false);
    expect(overrideInput.value).toBe("125,00");
    expect(setCreditCardStatementOverrideAction).toHaveBeenCalledTimes(1);
    expect((setCreditCardStatementOverrideAction.mock.calls[0]?.[0] as FormData).get("month")).toBe("2026-12");
    await act(async () => {
      await Promise.resolve();
    });

    setCreditCardStatementOverrideAction.mockClear();
    fireEvent.change(overrideInput, {
      target: { value: "80,00" },
    });

    expect(within(screen.getByRole("row", { name: /Pagamentos de cartões/ })).getByText("(80,00 €)")).toBeTruthy();
    expect(within(screen.getByRole("row", { name: /Pagamentos de cartões/ })).getByText("80,00 €")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(650);
    });

    expect(setCreditCardStatementOverrideAction).toHaveBeenCalledTimes(1);
    expect((setCreditCardStatementOverrideAction.mock.calls[0]?.[0] as FormData).get("creditCardAccountId")).toBe(
      "cc-santander",
    );
    expect((setCreditCardStatementOverrideAction.mock.calls[0]?.[0] as FormData).get("month")).toBe("2026-12");
    expect((setCreditCardStatementOverrideAction.mock.calls[0]?.[0] as FormData).get("statementAmount")).toBe(
      "80,00",
    );
  });

  it("does not accept negative credit card statement overrides", async () => {
    vi.useFakeTimers();
    const setCreditCardStatementOverrideAction = vi.fn(async (formData: FormData) => ({
      ok: true as const,
      override: {
        creditCardAccountId: String(formData.get("creditCardAccountId")),
        month: String(formData.get("month")),
        statementAmountCents: parseEuroCents(formData.get("statementAmount")),
      },
    }));

    render(
      <MonthlyBudgetTable
        overview={createOverview({
          overviewAccounts: [accountA, creditCardAccount],
          currentBalanceByAccountId: {
            "account-a": 1_000_00,
            "cc-santander": -125_00,
          },
        })}
        editable
        setCreditCardStatementOverrideAction={setCreditCardStatementOverrideAction}
      />,
    );

    const overrideInput = screen.getByLabelText("Valor do extracto — CC Santander") as HTMLInputElement;
    fireEvent.click(screen.getByLabelText("Usar valor do extracto — CC Santander"));
    expect(setCreditCardStatementOverrideAction).toHaveBeenCalledTimes(1);
    await act(async () => {
      await Promise.resolve();
    });
    setCreditCardStatementOverrideAction.mockClear();

    fireEvent.change(overrideInput, { target: { value: "-10,00" } });

    expect(overrideInput.value).toBe("125,00");
    expect(screen.getByText("O valor do extracto não pode ser negativo.")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(650);
    });
    expect(setCreditCardStatementOverrideAction).not.toHaveBeenCalled();
  });

  it("loads a persisted card override and keeps another month automatic", () => {
    const persistedOverride: MonthlyCreditCardPayment = {
      month: "2026-07",
      creditCardAccountId: "cc-santander",
      creditCardName: "CC Santander",
      paymentAccountId: "account-a",
      paymentAccountName: "Conta A",
      currentBalanceCents: -125_00,
      automaticPaymentCents: 125_00,
      overrideAmountCents: 80_00,
      paymentAmountCents: 80_00,
      usesOverride: true,
    };
    const { rerender } = render(
      <MonthlyBudgetTable
        overview={createOverview({
          overviewAccounts: [accountA, creditCardAccount],
          currentBalanceByAccountId: {
            "account-a": 1_000_00,
            "cc-santander": -125_00,
          },
          creditCardPayments: [persistedOverride],
        })}
        editable
      />,
    );

    expectCheckboxChecked(screen.getByLabelText("Usar valor do extracto — CC Santander"), true);
    expect((screen.getByLabelText("Valor do extracto — CC Santander") as HTMLInputElement).value).toBe("80,00");
    expect(within(screen.getByRole("row", { name: /Pagamentos de cartões/ })).getByText("(80,00 €)")).toBeTruthy();

    rerender(
      <MonthlyBudgetTable
        overview={createOverview({
          month: "2026-08",
          overviewAccounts: [accountA, creditCardAccount],
          currentBalanceByAccountId: {
            "account-a": 1_000_00,
            "cc-santander": -125_00,
          },
        })}
        editable
      />,
    );

    expectCheckboxChecked(screen.getByLabelText("Usar valor do extracto — CC Santander"), false);
    expect((screen.getByLabelText("Valor do extracto — CC Santander") as HTMLInputElement).disabled).toBe(true);
    expect(within(screen.getByRole("row", { name: /Pagamentos de cartões/ })).getByText("(125,00 €)")).toBeTruthy();
  });

  it("treats a zero credit card override as a saved value and clearing returns to automatic", async () => {
    const setCreditCardStatementOverrideAction = vi.fn(async (formData: FormData) => ({
      ok: true as const,
      override: {
        creditCardAccountId: String(formData.get("creditCardAccountId")),
        month: String(formData.get("month")),
        statementAmountCents: String(formData.get("statementAmount")).trim() === "" ? null : 0,
      },
    }));

    render(
      <MonthlyBudgetTable
        overview={createOverview({
          overviewAccounts: [accountA, creditCardAccount],
          currentBalanceByAccountId: {
            "account-a": 1_000_00,
            "cc-santander": -125_00,
          },
        })}
        editable
        setCreditCardStatementOverrideAction={setCreditCardStatementOverrideAction}
      />,
    );

    const overrideInput = screen.getByLabelText("Valor do extracto — CC Santander");
    const overrideCheckbox = screen.getByLabelText("Usar valor do extracto — CC Santander");
    fireEvent.click(overrideCheckbox);
    await waitFor(() => expect(setCreditCardStatementOverrideAction).toHaveBeenCalledTimes(1));
    setCreditCardStatementOverrideAction.mockClear();

    fireEvent.change(overrideInput, { target: { value: "0,00" } });
    fireEvent.blur(overrideInput);

    expect(within(screen.getByRole("row", { name: /Pagamentos de cartões/ })).getAllByText("–").length).toBeGreaterThan(0);
    await waitFor(() => expect(setCreditCardStatementOverrideAction).toHaveBeenCalledTimes(1));
    expect((setCreditCardStatementOverrideAction.mock.calls[0]?.[0] as FormData).get("statementAmount")).toBe(
      "0,00",
    );

    fireEvent.click(overrideCheckbox);

    expect(within(screen.getByRole("row", { name: /Pagamentos de cartões/ })).getByText("(125,00 €)")).toBeTruthy();
    await waitFor(() => expect(setCreditCardStatementOverrideAction).toHaveBeenCalledTimes(2));
    expect((setCreditCardStatementOverrideAction.mock.calls[1]?.[0] as FormData).get("statementAmount")).toBe("");
  });

  it("disables card override controls without a linked payment account", () => {
    render(
      <MonthlyBudgetTable
        overview={createOverview({
          overviewAccounts: [accountA, { ...creditCardAccount, linkedPaymentAccountId: undefined }],
          currentBalanceByAccountId: {
            "account-a": 1_000_00,
            "cc-santander": -125_00,
          },
        })}
        editable
      />,
    );

    expect((screen.getByLabelText("Valor do extracto — CC Santander") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Usar valor do extracto — CC Santander") as HTMLInputElement).disabled).toBe(true);
    expect(within(screen.getByRole("row", { name: /Pagamentos de cartões/ })).getAllByText("–").length).toBeGreaterThan(0);
  });

  it("lists applicable monthly direct debits grouped by account and sorted by amount", () => {
    render(
      <MonthlyBudgetTable
        overview={createOverview({
          overviewAccounts: [accountA, creditCardAccount, accountB],
          occurrences: directDebitOccurrences,
        })}
        editable
      />,
    );

    const checklist = screen.getByRole("heading", { name: "Débitos directos do mês" }).closest("aside");
    const checklistText = checklist?.textContent ?? "";

    expect(checklistText.indexOf("Conta A")).toBeLessThan(checklistText.indexOf("CC Santander"));
    expect(checklistText.indexOf("Electricidade")).toBeLessThan(checklistText.indexOf("Água"));
    expectCheckboxChecked(screen.getByLabelText("Excluir Electricidade da previsão deste mês"), false);
    expectCheckboxChecked(screen.getByLabelText("Excluir ChatGPT da previsão deste mês"), false);
  });

  it("uses unchecked direct debits in the forecast, including credit card columns", () => {
    render(
      <MonthlyBudgetTable
        overview={createOverview({
          currentBalanceCents: 100_00,
          overviewAccounts: [accountA, creditCardAccount],
          occurrences: directDebitOccurrences,
        })}
        editable
      />,
    );

    const directDebitRow = screen.getByRole("row", { name: /Débitos directos/ });
    expect(within(directDebitRow).getByText("(155,00 €)")).toBeTruthy();
    expect(within(directDebitRow).getByText("(23,00 €)")).toBeTruthy();
    expect(within(screen.getByRole("row", { name: /Saldo final/ })).getByText("(55,00 €)")).toBeTruthy();
  });

  it("excludes and re-includes a monthly direct debit immediately", async () => {
    const setDirectDebitExcludedAction = vi.fn(async (formData: FormData) => ({
      ok: true as const,
      state: {
        recurringRuleId: String(formData.get("recurringRuleId")),
        month: String(formData.get("month")),
        excludedFromForecast: String(formData.get("excludedFromForecast")) === "true",
      },
    }));

    render(
      <MonthlyBudgetTable
        overview={createOverview({
          currentBalanceCents: 100_00,
          occurrences: directDebitOccurrences,
        })}
        editable
        setDirectDebitExcludedAction={setDirectDebitExcludedAction}
      />,
    );

    const checkbox = screen.getByLabelText("Excluir Electricidade da previsão deste mês");
    fireEvent.click(checkbox);

    expect(
      within(screen.getByRole("row", { name: /Débitos directos/ })).getAllByText("(35,00 €)").length,
    ).toBeGreaterThan(0);
    expect(within(screen.getByRole("row", { name: /Saldo final/ })).getAllByText("65,00 €").length).toBeGreaterThan(0);
    await waitFor(() => expect(setDirectDebitExcludedAction).toHaveBeenCalledTimes(1));
    expect((setDirectDebitExcludedAction.mock.calls[0]?.[0] as FormData).get("excludedFromForecast")).toBe("true");

    fireEvent.click(checkbox);

    expect(
      within(screen.getByRole("row", { name: /Débitos directos/ })).getAllByText("(155,00 €)").length,
    ).toBeGreaterThan(0);
    await waitFor(() => expect(setDirectDebitExcludedAction).toHaveBeenCalledTimes(2));
    expect((setDirectDebitExcludedAction.mock.calls[1]?.[0] as FormData).get("excludedFromForecast")).toBe("false");
  });

  it("loads a persisted monthly exclusion and keeps another month independent", () => {
    const { rerender } = render(
      <MonthlyBudgetTable
        overview={createOverview({
          occurrences: [{ ...directDebitOccurrences[0], excludedFromForecast: true }],
        })}
        editable
      />,
    );

    expectCheckboxChecked(screen.getByLabelText("Excluir Electricidade da previsão deste mês"), true);
    expect(within(screen.getByRole("row", { name: /Débitos directos/ })).getAllByText("–").length).toBeGreaterThan(0);

    rerender(
      <MonthlyBudgetTable
        overview={createOverview({
          month: "2026-08",
          occurrences: [{ ...directDebitOccurrences[0], month: "2026-08", excludedFromForecast: false }],
        })}
        editable
      />,
    );

    expectCheckboxChecked(screen.getByLabelText("Excluir Electricidade da previsão deste mês"), false);
    expect(
      within(screen.getByRole("row", { name: /Débitos directos/ })).getAllByText("(120,00 €)").length,
    ).toBeGreaterThan(0);
  });

  it("removes a deleted direct debit from the checklist, direct debit row and final balance", () => {
    const occurrence = {
      ...directDebitOccurrences[0],
      ruleId: "teste",
      month: "2026-10" as const,
      description: "Teste",
      amountCents: 120_00,
      excludedFromForecast: false,
    };
    const { rerender } = render(
      <MonthlyBudgetTable
        overview={createOverview({
          currentBalanceCents: 100_00,
          month: "2026-10",
          occurrences: [occurrence],
        })}
        editable
      />,
    );

    expectCheckboxChecked(screen.getByLabelText("Excluir Teste da previsão deste mês"), false);
    expect(
      within(screen.getByRole("row", { name: /Débitos directos/ })).getAllByText("(120,00 €)").length,
    ).toBeGreaterThan(0);
    expect(within(screen.getByRole("row", { name: /Saldo final/ })).getAllByText("(20,00 €)").length).toBeGreaterThan(0);

    rerender(
      <MonthlyBudgetTable
        overview={createOverview({
          currentBalanceCents: 100_00,
          month: "2026-10",
          occurrences: [],
        })}
        editable
      />,
    );

    expect(screen.queryByLabelText("Excluir Teste da previsão deste mês")).toBeNull();
    expect(within(screen.getByRole("row", { name: /Débitos directos/ })).getAllByText("–").length).toBeGreaterThan(0);
    expect(within(screen.getByRole("row", { name: /Saldo final/ })).getAllByText("100,00 €").length).toBeGreaterThan(0);
  });

  it("keeps the latest checkbox state when changes resolve out of order", async () => {
    const resolvers: Array<(value: { ok: true; state: { recurringRuleId: string; month: string; excludedFromForecast: boolean } }) => void> = [];
    const setDirectDebitExcludedAction = vi.fn(
      () =>
        new Promise<{ ok: true; state: { recurringRuleId: string; month: string; excludedFromForecast: boolean } }>(
          (resolve) => {
            resolvers.push(resolve);
          },
        ),
    );

    render(
      <MonthlyBudgetTable
        overview={createOverview({ occurrences: [directDebitOccurrences[0]] })}
        editable
        setDirectDebitExcludedAction={setDirectDebitExcludedAction}
      />,
    );

    const checkbox = screen.getByLabelText("Excluir Electricidade da previsão deste mês");
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);

    expectCheckboxChecked(checkbox, false);

    resolvers[1]?.({
      ok: true,
      state: { recurringRuleId: "electricity", month: "2026-07", excludedFromForecast: false },
    });
    await waitFor(() => expect(screen.getByText("Guardado")).toBeTruthy());

    resolvers[0]?.({
      ok: true,
      state: { recurringRuleId: "electricity", month: "2026-07", excludedFromForecast: true },
    });

    expectCheckboxChecked(checkbox, false);
  });

  it("reverts the checkbox and avoids false success on save error", async () => {
    const setDirectDebitExcludedAction = vi.fn(async () => ({
      ok: false as const,
      error: "Falhou",
    }));

    render(
      <MonthlyBudgetTable
        overview={createOverview({ occurrences: [directDebitOccurrences[0]] })}
        editable
        setDirectDebitExcludedAction={setDirectDebitExcludedAction}
      />,
    );

    const checkbox = screen.getByLabelText("Excluir Electricidade da previsão deste mês");
    fireEvent.click(checkbox);

    await waitFor(() => expect(screen.getByText("Erro ao guardar")).toBeTruthy());
    expect(screen.getByText("Falhou")).toBeTruthy();
    expectCheckboxChecked(checkbox, false);
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
