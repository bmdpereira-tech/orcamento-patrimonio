import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LiquidityAccount } from "../domain/budget/accounts";
import { buildBudgetOverview, createEmptySnapshot } from "../domain/budget/monthly-view";
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

describe("MonthlyBudgetTable", () => {
  it("renders current balance as editable and realised movements as read-only", () => {
    const overview = buildBudgetOverview({
      month: "2026-07",
      accounts,
      investmentAssets: [],
      snapshots: [
        {
          ...createEmptySnapshot("account-a"),
          initialBalanceCents: 100_00,
          realisedMovementsCents: -25_00,
          currentBalanceCents: 75_00,
          finalBalanceCents: 75_00,
        },
      ],
    });

    render(
      <form>
        <MonthlyBudgetTable overview={overview} editable />
      </form>,
    );

    expect(screen.queryByLabelText("Movimentos realizados — Conta A")).toBeNull();
    expect(screen.getByLabelText("Saldo actual — Conta A")).toBeTruthy();
    expect(screen.getByLabelText("Saldo inicial — Conta A")).toBeTruthy();
  });

  it("shows the add custom line button in the forecasts section", () => {
    const overview = buildBudgetOverview({
      month: "2026-07",
      accounts,
      investmentAssets: [],
      snapshots: [createEmptySnapshot("account-a")],
    });

    render(
      <form>
        <MonthlyBudgetTable overview={overview} editable addCustomItemAction={async () => {}} />
      </form>,
    );

    expect(screen.getByRole("button", { name: "Adicionar linha" })).toBeTruthy();
  });
});
