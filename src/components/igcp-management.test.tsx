import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IGCP_STORAGE_KEY } from "@/domain/budget/igcp";
import { IgcpManagement } from "./igcp-management";

function input(label: string) {
  return screen.getByLabelText(label) as HTMLInputElement;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("IgcpManagement", () => {
  it("renders the IGCP table with initial rows, totals and accumulated gain", () => {
    render(<IgcpManagement />);

    expect(screen.getByRole("heading", { name: "Juros trimestrais previstos" })).toBeTruthy();
    expect(input("Data subscrição da linha 1").value).toBe("03/10/2022");
    expect(input("Montante subscrição da linha 1").value).toBe("1 000,00 €");
    expect(screen.getByTestId("igcp-total-subscription").textContent).toBe("34 000,00 €");
    expect(screen.getByTestId("igcp-total-current").textContent).toBe("37 091,49 €");
    expect(screen.getByTestId("igcp-total-january").textContent).toBe("67,52 €");
    expect(screen.getByTestId("igcp-total-february").textContent).toBe("178,11 €");
    expect(screen.getByTestId("igcp-total-march").textContent).toBe("–");
    expect(screen.getByTestId("igcp-accumulated-gain").textContent).toBe("3 091,49 €");
  });

  it("adds and removes rows without changing the initial totals", () => {
    render(<IgcpManagement />);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar linha" }));

    expect(input("Data subscrição da linha 10").value).toBe("");
    expect(screen.getByTestId("igcp-total-subscription").textContent).toBe("34 000,00 €");

    fireEvent.click(screen.getByRole("button", { name: "Remover linha 10" }));

    expect(screen.queryByLabelText("Data subscrição da linha 10")).toBeNull();
    expect(screen.getByTestId("igcp-total-current").textContent).toBe("37 091,49 €");
  });

  it("recalculates interest and totals when editable fields are committed", async () => {
    render(<IgcpManagement />);

    const currentAmount = input("Montante à data da linha 1");

    fireEvent.change(currentAmount, { target: { value: "2000" } });
    fireEvent.blur(currentAmount);

    await waitFor(() => expect(currentAmount.value).toBe("2 000,00 €"));
    expect(screen.getByTestId("igcp-interest-igcp-initial-1-january").textContent).toBe("13,10 €");
    expect(screen.getByTestId("igcp-interest-igcp-initial-1-april").textContent).toBe("13,10 €");
    expect(screen.getByTestId("igcp-total-january").textContent).toBe("73,45 €");
    expect(screen.getByTestId("igcp-total-current").textContent).toBe("37 996,31 €");
  });

  it("accepts decimal annual rates and normalises them on commit", async () => {
    render(<IgcpManagement />);

    const annualRate = input("Taxa juro anual da linha 1");

    fireEvent.change(annualRate, { target: { value: "0.03638" } });
    fireEvent.keyDown(annualRate, { key: "Enter" });

    await waitFor(() => expect(annualRate.value).toBe("3.638%"));
    expect(screen.getByTestId("igcp-interest-igcp-initial-1-october").textContent).toBe("7,17 €");
  });

  it("shows validation errors and does not persist invalid edits", async () => {
    render(<IgcpManagement />);

    await waitFor(() => expect(window.localStorage.getItem(IGCP_STORAGE_KEY)).toContain("03/10/2022"));

    const currentAmount = input("Montante à data da linha 1");
    fireEvent.change(currentAmount, { target: { value: "abc" } });
    fireEvent.blur(currentAmount);

    expect(screen.getByText("Montante inválido")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Campos inválidos por guardar");
    expect(window.localStorage.getItem(IGCP_STORAGE_KEY)).not.toContain("abc");
  });

  it("loads previously persisted IGCP rows from localStorage", async () => {
    window.localStorage.setItem(
      IGCP_STORAGE_KEY,
      JSON.stringify([
        {
          id: "stored-row",
          subscriptionDate: "01/03/2024",
          subscriptionAmount: "100,00 €",
          currentAmount: "102,00 €",
          annualRate: "4.000%",
        },
      ]),
    );

    render(<IgcpManagement />);

    await waitFor(() => expect(input("Data subscrição da linha 1").value).toBe("01/03/2024"));
    expect(screen.getByTestId("igcp-total-subscription").textContent).toBe("100,00 €");
    expect(screen.getByTestId("igcp-interest-stored-row-march").textContent).toBe("0,73 €");
    expect(screen.getByTestId("igcp-total-january").textContent).toBe("–");
  });
});
