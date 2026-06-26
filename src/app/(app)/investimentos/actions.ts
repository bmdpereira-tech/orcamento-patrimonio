"use server";

import { revalidatePath } from "next/cache";
import { minMonth, type HistoricalActionResult } from "@/domain/budget/historical-impact";
import type { InvestmentCashFlowType } from "@/domain/budget/investments";
import { parseEuroCents } from "@/domain/budget/money";
import { getMonthIdForDate, type MonthId } from "@/domain/budget/months";
import { getHistoricalImpactActionResult } from "@/server/budget/historical-impact";
import {
  archiveInvestmentAsset,
  createInvestmentAsset,
  createInvestmentCashFlow,
  createInvestmentValuation,
  deleteInvestmentAssetWhenAllowed,
  deleteInvestmentCashFlow,
  deleteInvestmentValuation,
  getInvestmentCashFlowById,
  getInvestmentValuationById,
  reactivateInvestmentAsset,
  updateInvestmentAsset,
  updateInvestmentCashFlow,
  updateInvestmentValuation,
  type InvestmentAssetInput,
  type InvestmentCashFlowInput,
  type InvestmentValuationInput,
  type ManagedInvestmentAsset,
  type ManagedInvestmentCashFlow,
  type ManagedInvestmentValuation,
} from "@/server/budget/investments";

type AssetActionResult = HistoricalActionResult<{ asset: ManagedInvestmentAsset; status: string }>;
type DeleteAssetActionResult = HistoricalActionResult<{ status: string }>;
type CashFlowActionResult = HistoricalActionResult<{ cashFlow: ManagedInvestmentCashFlow; status: string }>;
type ValuationActionResult = HistoricalActionResult<{ valuation: ManagedInvestmentValuation; status: string }>;
type DeleteRecordActionResult = HistoricalActionResult<{ status: string }>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getOptionalText(formData: FormData, key: string) {
  const value = getText(formData, key);

  return value ? value : null;
}

function parseSortOrder(formData: FormData) {
  const sortOrder = Number(getText(formData, "sortOrder") || "0");

  if (!Number.isInteger(sortOrder)) {
    throw new Error("A ordem deve ser um número inteiro.");
  }

  return sortOrder;
}

function parseDate(formData: FormData, key: string, label: string) {
  const value = getText(formData, key);

  if (!value) {
    throw new Error(`Indique a data de ${label}.`);
  }

  if (!DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    throw new Error(`Indique uma data válida para ${label}.`);
  }

  return value;
}

function monthFromDate(date: string) {
  return date.slice(0, 7) as MonthId;
}

function parseMonth(formData: FormData, key: string, fallback: MonthId) {
  const value = getText(formData, key);

  if (!value) {
    return fallback;
  }

  if (!MONTH_PATTERN.test(value)) {
    throw new Error("Indique um mês de início válido.");
  }

  return value as MonthId;
}

function parsePositiveAmount(formData: FormData, key: string, message: string) {
  const amountCents = parseEuroCents(getText(formData, key));

  if (amountCents <= 0) {
    throw new Error(message);
  }

  return amountCents;
}

function parseNonNegativeAmount(formData: FormData, key: string, message: string) {
  const amountCents = parseEuroCents(getText(formData, key));

  if (amountCents < 0) {
    throw new Error(message);
  }

  return amountCents;
}

function parseFlowType(formData: FormData): InvestmentCashFlowType {
  const flowType = getText(formData, "flowType");

  if (flowType !== "contribution" && flowType !== "redemption") {
    throw new Error("Escolha entrega ou resgate.");
  }

  return flowType;
}

function parseAssetInput(formData: FormData): InvestmentAssetInput {
  const name = getText(formData, "name");

  if (!name) {
    throw new Error("Indique o nome do investimento.");
  }

  return {
    name,
    description: getOptionalText(formData, "description"),
    startMonth: parseMonth(formData, "startMonth", getMonthIdForDate()),
    sortOrder: parseSortOrder(formData),
  };
}

function parseCashFlowInput(formData: FormData): InvestmentCashFlowInput {
  const investmentAssetId = getText(formData, "investmentAssetId");

  if (!investmentAssetId) {
    throw new Error("Investimento inválido.");
  }

  return {
    investmentAssetId,
    flowType: parseFlowType(formData),
    flowDate: parseDate(formData, "flowDate", "fluxo"),
    amountCents: parsePositiveAmount(formData, "amount", "O montante do fluxo deve ser positivo."),
    note: getOptionalText(formData, "note"),
  };
}

function parseValuationInput(formData: FormData): InvestmentValuationInput {
  const investmentAssetId = getText(formData, "investmentAssetId");

  if (!investmentAssetId) {
    throw new Error("Investimento inválido.");
  }

  return {
    investmentAssetId,
    valuationDate: parseDate(formData, "valuationDate", "valorização"),
    marketValueCents: parseNonNegativeAmount(
      formData,
      "amount",
      "O valor de mercado não pode ser negativo.",
    ),
    note: getOptionalText(formData, "note"),
  };
}

function revalidateInvestmentViews() {
  revalidatePath("/investimentos");
  revalidatePath("/orcamento");
}

function firstAffectedRecordMonth(previousDate: string, nextDate: string, changed: boolean) {
  return changed ? minMonth(monthFromDate(previousDate), monthFromDate(nextDate)) : null;
}

export async function createInvestmentAssetAction(formData: FormData): Promise<AssetActionResult> {
  try {
    const asset = await createInvestmentAsset(parseAssetInput(formData));
    revalidateInvestmentViews();
    return { ok: true, asset, status: "created" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível criar o investimento.",
    };
  }
}

export async function updateInvestmentAssetAction(formData: FormData): Promise<AssetActionResult> {
  try {
    const id = getText(formData, "id");

    if (!id) {
      throw new Error("Investimento inválido.");
    }

    const asset = await updateInvestmentAsset({ ...parseAssetInput(formData), id });
    revalidateInvestmentViews();
    return { ok: true, asset, status: "updated" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível actualizar o investimento.",
    };
  }
}

export async function archiveInvestmentAssetAction(formData: FormData): Promise<AssetActionResult> {
  try {
    const id = getText(formData, "id");

    if (!id) {
      throw new Error("Investimento inválido.");
    }

    const asset = await archiveInvestmentAsset(id);
    revalidateInvestmentViews();
    return { ok: true, asset, status: "archived" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível arquivar o investimento.",
    };
  }
}

export async function reactivateInvestmentAssetAction(formData: FormData): Promise<AssetActionResult> {
  try {
    const id = getText(formData, "id");

    if (!id) {
      throw new Error("Investimento inválido.");
    }

    const asset = await reactivateInvestmentAsset(id);
    revalidateInvestmentViews();
    return { ok: true, asset, status: "reactivated" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível reactivar o investimento.",
    };
  }
}

export async function deleteInvestmentAssetAction(formData: FormData): Promise<DeleteAssetActionResult> {
  try {
    const id = getText(formData, "id");

    if (!id) {
      throw new Error("Investimento inválido.");
    }

    const deleted = await deleteInvestmentAssetWhenAllowed(id);
    revalidateInvestmentViews();

    return { ok: true, status: deleted ? "deleted" : "delete-blocked" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível eliminar o investimento.",
    };
  }
}

export async function createInvestmentCashFlowAction(formData: FormData): Promise<CashFlowActionResult> {
  try {
    const input = parseCashFlowInput(formData);
    const impactResult = getHistoricalImpactActionResult({
      firstAffectedMonth: monthFromDate(input.flowDate),
      formData,
    });

    if (impactResult) {
      return impactResult;
    }

    const cashFlow = await createInvestmentCashFlow(input);
    revalidateInvestmentViews();
    return { ok: true, cashFlow, status: "created" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível criar o fluxo de investimento.",
    };
  }
}

export async function updateInvestmentCashFlowAction(formData: FormData): Promise<CashFlowActionResult> {
  try {
    const id = getText(formData, "id");

    if (!id) {
      throw new Error("Fluxo de investimento inválido.");
    }

    const existing = await getInvestmentCashFlowById(id);
    const input = parseCashFlowInput(formData);
    const changedFinancially =
      existing.investmentAssetId !== input.investmentAssetId ||
      existing.flowType !== input.flowType ||
      existing.flowDate !== input.flowDate ||
      existing.amountCents !== input.amountCents;
    const impactResult = getHistoricalImpactActionResult({
      firstAffectedMonth: firstAffectedRecordMonth(existing.flowDate, input.flowDate, changedFinancially),
      formData,
    });

    if (impactResult) {
      return impactResult;
    }

    const cashFlow = await updateInvestmentCashFlow({ ...input, id });
    revalidateInvestmentViews();
    return { ok: true, cashFlow, status: "updated" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível actualizar o fluxo de investimento.",
    };
  }
}

export async function deleteInvestmentCashFlowAction(formData: FormData): Promise<DeleteRecordActionResult> {
  try {
    const id = getText(formData, "id");

    if (!id) {
      throw new Error("Fluxo de investimento inválido.");
    }

    const existing = await getInvestmentCashFlowById(id);
    const impactResult = getHistoricalImpactActionResult({
      firstAffectedMonth: monthFromDate(existing.flowDate),
      formData,
    });

    if (impactResult) {
      return impactResult;
    }

    await deleteInvestmentCashFlow(id);
    revalidateInvestmentViews();
    return { ok: true, status: "deleted" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível eliminar o fluxo de investimento.",
    };
  }
}

export async function createInvestmentValuationAction(formData: FormData): Promise<ValuationActionResult> {
  try {
    const input = parseValuationInput(formData);
    const impactResult = getHistoricalImpactActionResult({
      firstAffectedMonth: monthFromDate(input.valuationDate),
      formData,
    });

    if (impactResult) {
      return impactResult;
    }

    const valuation = await createInvestmentValuation(input);
    revalidateInvestmentViews();
    return { ok: true, valuation, status: "created" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível criar a valorização.",
    };
  }
}

export async function updateInvestmentValuationAction(formData: FormData): Promise<ValuationActionResult> {
  try {
    const id = getText(formData, "id");

    if (!id) {
      throw new Error("Valorização inválida.");
    }

    const existing = await getInvestmentValuationById(id);
    const input = parseValuationInput(formData);
    const changedFinancially =
      existing.investmentAssetId !== input.investmentAssetId ||
      existing.valuationDate !== input.valuationDate ||
      existing.marketValueCents !== input.marketValueCents;
    const impactResult = getHistoricalImpactActionResult({
      firstAffectedMonth: firstAffectedRecordMonth(
        existing.valuationDate,
        input.valuationDate,
        changedFinancially,
      ),
      formData,
    });

    if (impactResult) {
      return impactResult;
    }

    const valuation = await updateInvestmentValuation({ ...input, id });
    revalidateInvestmentViews();
    return { ok: true, valuation, status: "updated" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível actualizar a valorização.",
    };
  }
}

export async function deleteInvestmentValuationAction(formData: FormData): Promise<DeleteRecordActionResult> {
  try {
    const id = getText(formData, "id");

    if (!id) {
      throw new Error("Valorização inválida.");
    }

    const existing = await getInvestmentValuationById(id);
    const impactResult = getHistoricalImpactActionResult({
      firstAffectedMonth: monthFromDate(existing.valuationDate),
      formData,
    });

    if (impactResult) {
      return impactResult;
    }

    await deleteInvestmentValuation(id);
    revalidateInvestmentViews();
    return { ok: true, status: "deleted" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível eliminar a valorização.",
    };
  }
}
