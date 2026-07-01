import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import IgcpPage from "./page";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("IgcpPage", () => {
  it("renders the autonomous IGCP table", () => {
    render(<IgcpPage />);

    expect(screen.getByRole("heading", { name: "Juros trimestrais previstos" })).toBeTruthy();
    expect(screen.getByText("Juro previsto TRIMESTRAL - líquido de retenção na fonte 28%")).toBeTruthy();
    expect(screen.getByTestId("igcp-total-subscription").textContent).toBe("34 000,00 €");
  });
});
