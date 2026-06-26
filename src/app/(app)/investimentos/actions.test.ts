import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createInvestmentAssetAction,
  createInvestmentCashFlowAction,
  createInvestmentValuationAction,
  deleteInvestmentAssetAction,
  deleteInvestmentCashFlowAction,
  updateInvestmentCashFlowAction,
  updateInvestmentValuationAction,
} from "./actions";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  archiveInvestmentAsset: vi.fn(),
  createInvestmentAsset: vi.fn(),
  createInvestmentCashFlow: vi.fn(),
  createInvestmentValuation: vi.fn(),
  deleteInvestmentAssetWhenAllowed: vi.fn(),
  deleteInvestmentCashFlow: vi.fn(),
  deleteInvestmentValuation: vi.fn(),
  getInvestmentCashFlowById: vi.fn(),
  getInvestmentValuationById: vi.fn(),
  reactivateInvestmentAsset: vi.fn(),
  updateInvestmentAsset: vi.fn(),
  updateInvestmentCashFlow: vi.fn(),
  updateInvestmentValuation: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/server/budget/investments", () => ({
  archiveInvestmentAsset: mocks.archiveInvestmentAsset,
  createInvestmentAsset: mocks.createInvestmentAsset,
  createInvestmentCashFlow: mocks.createInvestmentCashFlow,
  createInvestmentValuation: mocks.createInvestmentValuation,
  deleteInvestmentAssetWhenAllowed: mocks.deleteInvestmentAssetWhenAllowed,
  deleteInvestmentCashFlow: mocks.deleteInvestmentCashFlow,
  deleteInvestmentValuation: mocks.deleteInvestmentValuation,
  getInvestmentCashFlowById: mocks.getInvestmentCashFlowById,
  getInvestmentValuationById: mocks.getInvestmentValuationById,
  reactivateInvestmentAsset: mocks.reactivateInvestmentAsset,
  updateInvestmentAsset: mocks.updateInvestmentAsset,
  updateInvestmentCashFlow: mocks.updateInvestmentCashFlow,
  updateInvestmentValuation: mocks.updateInvestmentValuation,
}));

function assetFormData() {
  const formData = new FormData();
  formData.set("name", "Core Equity");
  formData.set("description", "ETF global");
  formData.set("startMonth", "2025-01");
  formData.set("sortOrder", "10");

  return formData;
}

function idFormData(id = "asset-a") {
  const formData = new FormData();
  formData.set("id", id);

  return formData;
}

function cashFlowFormData({
  id = "flow-a",
  flowDate = "2026-10-01",
  amount = "1000,00",
  flowType = "contribution",
  note = "Entrega mensal",
} = {}) {
  const formData = new FormData();
  formData.set("id", id);
  formData.set("investmentAssetId", "asset-a");
  formData.set("flowType", flowType);
  formData.set("flowDate", flowDate);
  formData.set("amount", amount);
  formData.set("note", note);

  return formData;
}

function valuationFormData({
  id = "valuation-a",
  valuationDate = "2026-10-01",
  amount = "1500,00",
  note = "Fecho",
} = {}) {
  const formData = new FormData();
  formData.set("id", id);
  formData.set("investmentAssetId", "asset-a");
  formData.set("valuationDate", valuationDate);
  formData.set("amount", amount);
  formData.set("note", note);

  return formData;
}

const asset = {
  id: "asset-a",
  name: "Core Equity",
  description: "ETF global",
  startMonth: "2025-01",
  sortOrder: 10,
};

const cashFlow = {
  id: "flow-a",
  investmentAssetId: "asset-a",
  flowType: "contribution",
  flowDate: "2026-10-01",
  amountCents: 1000_00,
  note: "Entrega mensal",
};

const valuation = {
  id: "valuation-a",
  investmentAssetId: "asset-a",
  valuationDate: "2026-10-01",
  marketValueCents: 1500_00,
  note: "Fecho",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-15T10:00:00.000Z"));
  mocks.createInvestmentAsset.mockResolvedValue(asset);
  mocks.createInvestmentCashFlow.mockResolvedValue(cashFlow);
  mocks.createInvestmentValuation.mockResolvedValue(valuation);
  mocks.updateInvestmentCashFlow.mockResolvedValue(cashFlow);
  mocks.updateInvestmentValuation.mockResolvedValue(valuation);
  mocks.getInvestmentCashFlowById.mockResolvedValue(cashFlow);
  mocks.getInvestmentValuationById.mockResolvedValue(valuation);
  mocks.deleteInvestmentAssetWhenAllowed.mockResolvedValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("investment server actions", () => {
  it("creates an investment asset and revalidates the investments page", async () => {
    await expect(createInvestmentAssetAction(assetFormData())).resolves.toEqual({
      ok: true,
      asset,
      status: "created",
    });

    expect(mocks.createInvestmentAsset).toHaveBeenCalledWith({
      name: "Core Equity",
      description: "ETF global",
      startMonth: "2025-01",
      sortOrder: 10,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/investimentos");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/orcamento");
  });

  it("does not delete an investment with flows or valuations", async () => {
    mocks.deleteInvestmentAssetWhenAllowed.mockResolvedValue(false);

    await expect(deleteInvestmentAssetAction(idFormData())).resolves.toEqual({
      ok: true,
      status: "delete-blocked",
    });

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/investimentos");
  });

  it("rejects a historical cash-flow creation before writing", async () => {
    await expect(createInvestmentCashFlowAction(cashFlowFormData({ flowDate: "2025-05-15" }))).resolves.toMatchObject({
      ok: false,
      requiresConfirmation: true,
      firstAffectedMonth: "2025-05",
    });

    expect(mocks.createInvestmentCashFlow).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("creates a historical cash-flow after explicit confirmation", async () => {
    const formData = cashFlowFormData({ flowDate: "2025-05-15" });
    formData.set("confirmHistoricalImpact", "true");

    await expect(createInvestmentCashFlowAction(formData)).resolves.toEqual({
      ok: true,
      cashFlow,
      status: "created",
    });

    expect(mocks.createInvestmentCashFlow).toHaveBeenCalledWith({
      investmentAssetId: "asset-a",
      flowType: "contribution",
      flowDate: "2025-05-15",
      amountCents: 1000_00,
      note: "Entrega mensal",
    });
  });

  it("accepts a 2025 redemption after historical confirmation", async () => {
    const formData = cashFlowFormData({
      flowDate: "2025-10-10",
      flowType: "redemption",
      amount: "200,00",
      note: "Resgate parcial",
    });
    formData.set("confirmHistoricalImpact", "true");

    await expect(createInvestmentCashFlowAction(formData)).resolves.toEqual({
      ok: true,
      cashFlow,
      status: "created",
    });

    expect(mocks.createInvestmentCashFlow).toHaveBeenCalledWith({
      investmentAssetId: "asset-a",
      flowType: "redemption",
      flowDate: "2025-10-10",
      amountCents: 200_00,
      note: "Resgate parcial",
    });
  });

  it("allows note-only edits to historical cash-flows without confirmation", async () => {
    mocks.getInvestmentCashFlowById.mockResolvedValue({
      ...cashFlow,
      flowDate: "2026-08-15",
      note: "Nota antiga",
    });

    await expect(
      updateInvestmentCashFlowAction(
        cashFlowFormData({ flowDate: "2026-08-15", amount: "1000,00", note: "Nota nova" }),
      ),
    ).resolves.toMatchObject({
      ok: true,
      status: "updated",
    });

    expect(mocks.updateInvestmentCashFlow).toHaveBeenCalledTimes(1);
  });

  it("requires confirmation when editing a historical cash-flow amount", async () => {
    mocks.getInvestmentCashFlowById.mockResolvedValue({
      ...cashFlow,
      flowDate: "2026-08-15",
      amountCents: 900_00,
    });

    await expect(
      updateInvestmentCashFlowAction(cashFlowFormData({ flowDate: "2026-08-15", amount: "1000,00" })),
    ).resolves.toMatchObject({
      ok: false,
      requiresConfirmation: true,
      firstAffectedMonth: "2026-08",
    });

    expect(mocks.updateInvestmentCashFlow).not.toHaveBeenCalled();
  });

  it("requires confirmation when deleting a historical cash-flow", async () => {
    mocks.getInvestmentCashFlowById.mockResolvedValue({ ...cashFlow, flowDate: "2026-08-15" });

    await expect(deleteInvestmentCashFlowAction(idFormData("flow-a"))).resolves.toMatchObject({
      ok: false,
      requiresConfirmation: true,
      firstAffectedMonth: "2026-08",
    });

    expect(mocks.deleteInvestmentCashFlow).not.toHaveBeenCalled();
  });

  it("validates cash-flow amounts as positive", async () => {
    await expect(createInvestmentCashFlowAction(cashFlowFormData({ amount: "0,00" }))).resolves.toEqual({
      ok: false,
      error: "O montante do fluxo deve ser positivo.",
    });

    expect(mocks.createInvestmentCashFlow).not.toHaveBeenCalled();
  });

  it("creates future valuation records without historical confirmation", async () => {
    await expect(createInvestmentValuationAction(valuationFormData({ valuationDate: "2026-10-20" }))).resolves.toEqual({
      ok: true,
      valuation,
      status: "created",
    });

    expect(mocks.createInvestmentValuation).toHaveBeenCalledWith({
      investmentAssetId: "asset-a",
      valuationDate: "2026-10-20",
      marketValueCents: 1500_00,
      note: "Fecho",
    });
  });

  it("accepts a 2025 valuation after historical confirmation", async () => {
    const formData = valuationFormData({ valuationDate: "2025-12-31", amount: "950,00" });
    formData.set("confirmHistoricalImpact", "true");

    await expect(createInvestmentValuationAction(formData)).resolves.toEqual({
      ok: true,
      valuation,
      status: "created",
    });

    expect(mocks.createInvestmentValuation).toHaveBeenCalledWith({
      investmentAssetId: "asset-a",
      valuationDate: "2025-12-31",
      marketValueCents: 950_00,
      note: "Fecho",
    });
  });

  it("returns Supabase valuation errors without revalidating", async () => {
    mocks.createInvestmentValuation.mockRejectedValue(
      new Error("Não foi possível criar a valorização: Já existe uma valorização deste investimento nessa data."),
    );

    await expect(createInvestmentValuationAction(valuationFormData())).resolves.toEqual({
      ok: false,
      error: "Não foi possível criar a valorização: Já existe uma valorização deste investimento nessa data.",
    });

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("requires confirmation when editing a historical valuation amount", async () => {
    mocks.getInvestmentValuationById.mockResolvedValue({
      ...valuation,
      valuationDate: "2026-08-31",
      marketValueCents: 1400_00,
    });

    await expect(
      updateInvestmentValuationAction(valuationFormData({ valuationDate: "2026-08-31", amount: "1500,00" })),
    ).resolves.toMatchObject({
      ok: false,
      requiresConfirmation: true,
      firstAffectedMonth: "2026-08",
    });

    expect(mocks.updateInvestmentValuation).not.toHaveBeenCalled();
  });
});
