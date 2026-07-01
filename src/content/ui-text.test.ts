import { describe, expect, it } from "vitest";
import { PRIMARY_UI_TITLES, UI_TEXT } from "./ui-text";

describe("Portuguese UI text", () => {
  it("uses the expected Portuguese labels with accents", () => {
    expect(UI_TEXT.appName).toBe("Orçamento");
    expect(UI_TEXT.appSubtitle).toBe("Liquidez e património");
    expect(UI_TEXT.navigation.history).toBe("Histórico");
    expect(UI_TEXT.navigation.recurring).toBe("Débitos directos");
    expect(UI_TEXT.navigation.igcp).toBe("IGCP");
    expect(UI_TEXT.navigation.settings).toBe("Configurações");
    expect(UI_TEXT.summary.forecasts).toBe("Previsões");
    expect(UI_TEXT.summary.creditCardDebt).toBe("Dívida dos cartões");
    expect(UI_TEXT.summary.netWorth).toBe("Património líquido");
    expect(UI_TEXT.budget.monthlyTable).toBe("Tabela mensal");
  });

  it("keeps the main user-facing titles accented", () => {
    expect(PRIMARY_UI_TITLES).toContain("Orçamento");
    expect(PRIMARY_UI_TITLES).toContain("Património líquido");
    expect(PRIMARY_UI_TITLES).toContain("IGCP");
    expect(PRIMARY_UI_TITLES).toContain("Mês actual");
    expect(PRIMARY_UI_TITLES).not.toContain("Orcamento");
    expect(PRIMARY_UI_TITLES).not.toContain("Patrimonio");
    expect(PRIMARY_UI_TITLES).not.toContain("Mes actual");
  });
});
