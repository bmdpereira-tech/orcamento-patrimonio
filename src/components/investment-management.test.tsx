import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InvestmentAssetOverview } from "@/server/budget/investments";
import { InvestmentManagement } from "./investment-management";

const routerRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh }),
}));

const metrics = {
  investmentAssetId: "asset-a",
  totalContributedCents: 1000_00,
  totalRedeemedCents: 200_00,
  netInvestedCents: 800_00,
  latestValuation: {
    id: "valuation-a",
    investmentAssetId: "asset-a",
    valuationDate: "2026-10-31",
    marketValueCents: 950_00,
    note: "Fecho",
  },
  marketValueCents: 950_00,
  gainLossCents: 150_00,
  simpleReturn: 0.15,
  xirr: 0.1234,
};

const asset: InvestmentAssetOverview = {
  id: "asset-a",
  name: "Core Equity",
  description: "ETF global",
  startMonth: "2026-07",
  sortOrder: 10,
  cashFlows: [
    {
      id: "flow-a",
      investmentAssetId: "asset-a",
      flowType: "contribution",
      flowDate: "2026-08-15",
      amountCents: 1000_00,
      note: "Entrega inicial",
    },
  ],
  valuations: [
    {
      id: "valuation-a",
      investmentAssetId: "asset-a",
      valuationDate: "2026-10-31",
      marketValueCents: 950_00,
      note: "Fecho",
    },
  ],
  metrics,
  timeline: [
    {
      kind: "cash-flow",
      id: "flow-a",
      investmentAssetId: "asset-a",
      date: "2026-08-15",
      flowType: "contribution",
      amountCents: 1000_00,
      note: "Entrega inicial",
    },
    {
      kind: "valuation",
      id: "valuation-a",
      investmentAssetId: "asset-a",
      date: "2026-10-31",
      marketValueCents: 950_00,
      note: "Fecho",
    },
  ],
};

function renderManagement({
  assets = [asset],
  createAssetAction = vi.fn(async () => ({ ok: true as const, status: "created", asset })),
  updateAssetAction = vi.fn(async () => ({ ok: true as const, status: "updated", asset })),
  archiveAssetAction = vi.fn(async () => ({
    ok: true as const,
    status: "archived",
    asset: { ...asset, archivedFromMonth: "2026-10" },
  })),
  reactivateAssetAction = vi.fn(async () => ({ ok: true as const, status: "reactivated", asset })),
  deleteAssetAction = vi.fn(async () => ({ ok: true as const, status: "delete-blocked" })),
  createCashFlowAction = vi.fn(async () => ({ ok: true as const, status: "created", cashFlow: asset.cashFlows[0] })),
  updateCashFlowAction = vi.fn(async () => ({ ok: true as const, status: "updated", cashFlow: asset.cashFlows[0] })),
  deleteCashFlowAction = vi.fn(async () => ({ ok: true as const, status: "deleted" })),
  createValuationAction = vi.fn(async () => ({ ok: true as const, status: "created", valuation: asset.valuations[0] })),
  updateValuationAction = vi.fn(async () => ({ ok: true as const, status: "updated", valuation: asset.valuations[0] })),
  deleteValuationAction = vi.fn(async () => ({ ok: true as const, status: "deleted" })),
}: {
  assets?: InvestmentAssetOverview[];
  createAssetAction?: ReturnType<typeof vi.fn>;
  updateAssetAction?: ReturnType<typeof vi.fn>;
  archiveAssetAction?: ReturnType<typeof vi.fn>;
  reactivateAssetAction?: ReturnType<typeof vi.fn>;
  deleteAssetAction?: ReturnType<typeof vi.fn>;
  createCashFlowAction?: ReturnType<typeof vi.fn>;
  updateCashFlowAction?: ReturnType<typeof vi.fn>;
  deleteCashFlowAction?: ReturnType<typeof vi.fn>;
  createValuationAction?: ReturnType<typeof vi.fn>;
  updateValuationAction?: ReturnType<typeof vi.fn>;
  deleteValuationAction?: ReturnType<typeof vi.fn>;
} = {}) {
  render(
    <InvestmentManagement
      overview={{ asOfDate: "2026-10-31", assets, globalMetrics: { ...metrics, investmentAssetId: "global" } }}
      createAssetAction={createAssetAction}
      updateAssetAction={updateAssetAction}
      archiveAssetAction={archiveAssetAction}
      reactivateAssetAction={reactivateAssetAction}
      deleteAssetAction={deleteAssetAction}
      createCashFlowAction={createCashFlowAction}
      updateCashFlowAction={updateCashFlowAction}
      deleteCashFlowAction={deleteCashFlowAction}
      createValuationAction={createValuationAction}
      updateValuationAction={updateValuationAction}
      deleteValuationAction={deleteValuationAction}
    />,
  );

  return {
    createAssetAction,
    updateAssetAction,
    archiveAssetAction,
    reactivateAssetAction,
    deleteAssetAction,
    createCashFlowAction,
    updateCashFlowAction,
    deleteCashFlowAction,
    createValuationAction,
    updateValuationAction,
    deleteValuationAction,
  };
}

function submittedFormData(action: unknown, callIndex = 0) {
  const mock = action as { mock: { calls: Array<[FormData]> } };
  const formData = mock.mock.calls[callIndex]?.[0];

  if (!formData) {
    throw new Error("Action was not called with FormData.");
  }

  return formData;
}

afterEach(() => {
  vi.restoreAllMocks();
  routerRefresh.mockClear();
});

describe("InvestmentManagement", () => {
  it("renders global and investment metrics with detail collapsed by default", () => {
    renderManagement();

    expect(screen.getByRole("heading", { name: "Resumo global" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Core Equity" })).toBeTruthy();
    expect(screen.getAllByText("1 000,00 €").length).toBeGreaterThan(0);
    expect(screen.getAllByText("15,00%").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Ver detalhe de Core Equity" }).getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(screen.queryByLabelText("Valor do fluxo 15/08/2026")).toBeNull();
  });

  it("expands and collapses detail independently per investment", () => {
    const secondAsset: InvestmentAssetOverview = {
      ...asset,
      id: "asset-b",
      name: "Asia + EM",
      metrics: {
        ...metrics,
        investmentAssetId: "asset-b",
        latestValuation: {
          id: "valuation-b",
          investmentAssetId: "asset-b",
          valuationDate: "2026-11-30",
          marketValueCents: 1200_00,
          note: null,
        },
      },
      cashFlows: [
        {
          id: "flow-b",
          investmentAssetId: "asset-b",
          flowType: "contribution",
          flowDate: "2026-09-15",
          amountCents: 500_00,
          note: null,
        },
      ],
      valuations: [
        {
          id: "valuation-b",
          investmentAssetId: "asset-b",
          valuationDate: "2026-11-30",
          marketValueCents: 1200_00,
          note: null,
        },
      ],
      timeline: [
        {
          kind: "cash-flow",
          id: "flow-b",
          investmentAssetId: "asset-b",
          date: "2026-09-15",
          flowType: "contribution",
          amountCents: 500_00,
          note: null,
        },
      ],
    };

    renderManagement({ assets: [asset, secondAsset] });

    fireEvent.click(screen.getByRole("button", { name: "Ver detalhe de Core Equity" }));

    expect(screen.getByLabelText("Valor do fluxo 15/08/2026")).toBeTruthy();
    expect(screen.queryByLabelText("Valor do fluxo 15/09/2026")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Ver detalhe de Asia + EM" }));

    expect(screen.getByLabelText("Valor do fluxo 15/08/2026")).toBeTruthy();
    expect(screen.getByLabelText("Valor do fluxo 15/09/2026")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ocultar detalhe de Core Equity" }));

    expect(screen.queryByLabelText("Valor do fluxo 15/08/2026")).toBeNull();
    expect(screen.getByLabelText("Valor do fluxo 15/09/2026")).toBeTruthy();
  });

  it("does not render note fields or note values in the active UI", () => {
    renderManagement();

    expect(screen.queryByText("Nota")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver detalhe de Core Equity" }));

    expect(screen.queryByText("Nota")).toBeNull();
    expect(screen.queryByDisplayValue("Entrega inicial")).toBeNull();
    expect(screen.queryByDisplayValue("Fecho")).toBeNull();
  });

  it("uses compact detail controls without clipped select text", () => {
    renderManagement();

    fireEvent.click(screen.getByRole("button", { name: "Ver detalhe de Core Equity" }));

    expect(screen.getByLabelText("Data do fluxo 15/08/2026").className).toContain("h-7");
    expect(screen.getByLabelText("Valor do fluxo 15/08/2026").className).toContain("h-7");
    expect(screen.getByLabelText("Tipo do fluxo 15/08/2026").className).toContain("min-h-8");
    expect(screen.getByLabelText("Tipo do fluxo 15/08/2026").className).toContain("leading-5");
    expect(screen.getAllByText("Valorização").length).toBeGreaterThan(0);
  });

  it("creates investments, cash-flows and valuations with positive values", async () => {
    const { createAssetAction, createCashFlowAction, createValuationAction } = renderManagement();

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Asia + EM" } });
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Mercados emergentes" } });
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2025-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar investimento" }));

    await waitFor(() => expect(createAssetAction).toHaveBeenCalledTimes(1));
    expect(submittedFormData(createAssetAction).get("name")).toBe("Asia + EM");
    expect(submittedFormData(createAssetAction).get("startMonth")).toBe("2025-01");

    fireEvent.change(screen.getByLabelText("Fluxo"), { target: { value: "redemption" } });
    fireEvent.change(screen.getAllByLabelText("Valor")[0] as HTMLInputElement, { target: { value: "250,00" } });
    fireEvent.click(screen.getByRole("button", { name: "Fluxo" }));

    await waitFor(() => expect(createCashFlowAction).toHaveBeenCalledTimes(1));
    expect(submittedFormData(createCashFlowAction).get("flowType")).toBe("redemption");
    expect(submittedFormData(createCashFlowAction).get("amount")).toBe("250,00");

    fireEvent.change(screen.getAllByLabelText("Valor")[1] as HTMLInputElement, { target: { value: "950,00" } });
    fireEvent.click(screen.getByRole("button", { name: "Valorização" }));

    await waitFor(() => expect(createValuationAction).toHaveBeenCalledTimes(1));
    expect(submittedFormData(createValuationAction).get("amount")).toBe("950,00");
  });

  it("edits and deletes cash-flow and valuation records", async () => {
    const { updateCashFlowAction, deleteCashFlowAction, updateValuationAction, deleteValuationAction } =
      renderManagement();

    fireEvent.click(screen.getByRole("button", { name: "Ver detalhe de Core Equity" }));

    fireEvent.change(screen.getByLabelText("Valor do fluxo 15/08/2026"), { target: { value: "1 050,00" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Guardar" })[1] as HTMLButtonElement);

    await waitFor(() => expect(updateCashFlowAction).toHaveBeenCalledTimes(1));
    expect(submittedFormData(updateCashFlowAction).get("amount")).toBe("1 050,00");

    fireEvent.click(screen.getAllByRole("button", { name: "Eliminar" })[1] as HTMLButtonElement);
    await waitFor(() => expect(deleteCashFlowAction).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("Valor da valorização 31/10/2026"), { target: { value: "975,00" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Guardar" })[2] as HTMLButtonElement);

    await waitFor(() => expect(updateValuationAction).toHaveBeenCalledTimes(1));
    expect(submittedFormData(updateValuationAction).get("amount")).toBe("975,00");

    fireEvent.click(screen.getAllByRole("button", { name: "Eliminar" })[2] as HTMLButtonElement);
    await waitFor(() => expect(deleteValuationAction).toHaveBeenCalledTimes(1));
  });

  it("archives, reactivates and reports safe-delete blocks", async () => {
    const { archiveAssetAction, deleteAssetAction } = renderManagement();

    fireEvent.click(screen.getByRole("button", { name: "Arquivar" }));
    await waitFor(() => expect(archiveAssetAction).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getAllByRole("button", { name: "Eliminar" })[0] as HTMLButtonElement);
    await waitFor(() => expect(deleteAssetAction).toHaveBeenCalledTimes(1));
    expect(screen.getByText("O investimento tem fluxos ou valorizações e não foi eliminado. Podes arquivá-lo.")).toBeTruthy();

    const reactivateAssetAction = vi.fn(async () => ({ ok: true as const, status: "reactivated", asset }));
    renderManagement({
      assets: [{ ...asset, archivedFromMonth: "2026-10" }],
      reactivateAssetAction,
    });

    fireEvent.click(screen.getByRole("button", { name: "Reactivar" }));
    await waitFor(() => expect(reactivateAssetAction).toHaveBeenCalledTimes(1));
  });

  it("uses the historical confirmation modal before applying past financial changes", async () => {
    const createCashFlowAction = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        requiresConfirmation: true,
        firstAffectedMonth: "2026-08",
        monthLabel: "Agosto de 2026",
        affectsFollowingMonths: true,
        message:
          "Esta alteração afecta Agosto de 2026 e pode recalcular os saldos transportados dos meses seguintes. Pretende continuar?",
      })
      .mockResolvedValueOnce({ ok: true, status: "created", cashFlow: asset.cashFlows[0] });

    renderManagement({ createCashFlowAction });

    fireEvent.change(screen.getAllByLabelText("Data")[0] as HTMLInputElement, { target: { value: "2026-08-15" } });
    fireEvent.change(screen.getAllByLabelText("Valor")[0] as HTMLInputElement, { target: { value: "100,00" } });
    fireEvent.click(screen.getByRole("button", { name: "Fluxo" }));

    expect(await screen.findByRole("dialog", { name: "Confirmar alteração histórica" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar alteração" }));

    await waitFor(() => expect(createCashFlowAction).toHaveBeenCalledTimes(2));
    expect(submittedFormData(createCashFlowAction, 1).get("confirmHistoricalImpact")).toBe("true");
  });
});
