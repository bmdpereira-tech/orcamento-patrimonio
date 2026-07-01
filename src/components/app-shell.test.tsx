import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

vi.mock("@/app/actions/auth", () => ({
  logoutAction: vi.fn(),
}));

describe("AppShell", () => {
  it("renders a compact desktop header with IGCP in the main navigation", () => {
    const { container } = render(
      <AppShell>
        <div>Conteúdo</div>
      </AppShell>,
    );

    const headerContainer = container.querySelector("header > div");
    const igcpLink = screen.getByRole("link", { name: "IGCP" });
    const navigation = screen.getByRole("navigation", { name: "Navegação principal" });

    expect(headerContainer?.className).toContain("lg:flex-row");
    expect(navigation.className).not.toContain("grid");
    expect(igcpLink.getAttribute("href")).toBe("/igcp");
    expect(navigation.textContent).toContain("IGCP");
    expect(navigation.textContent).not.toContain("%");
    expect(navigation.textContent).not.toContain("Terminar sessão");
    expect(screen.getByRole("button", { name: "Terminar sessão" })).toBeTruthy();
    expect(screen.getByText("Conteúdo")).toBeTruthy();
  });
});
