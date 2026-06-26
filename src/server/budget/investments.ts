import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { APP_TIME_ZONE } from "@/domain/budget/constants";
import {
  calculateGlobalInvestmentMetrics,
  calculateInvestmentMetrics,
  type InvestmentCashFlow,
  type InvestmentCashFlowType,
  type InvestmentMetrics,
  type InvestmentValuation,
} from "@/domain/budget/investments";
import { assertCents, type Cents } from "@/domain/budget/money";
import { getMonthIdForDate, toMonthStartDate, type MonthId } from "@/domain/budget/months";
import { createSupabaseAdminClient } from "@/server/supabase/client";

export type ManagedInvestmentAsset = {
  id: string;
  name: string;
  description?: string | null;
  startMonth: MonthId;
  archivedFromMonth?: MonthId;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type ManagedInvestmentCashFlow = InvestmentCashFlow & {
  id: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ManagedInvestmentValuation = InvestmentValuation & {
  id: string;
  createdAt?: string;
  updatedAt?: string;
};

export type InvestmentAssetInput = {
  name: string;
  description?: string | null;
  startMonth: MonthId;
  sortOrder: number;
};

export type InvestmentCashFlowInput = {
  investmentAssetId: string;
  flowType: InvestmentCashFlowType;
  flowDate: string;
  amountCents: Cents;
  note?: string | null;
};

export type InvestmentValuationInput = {
  investmentAssetId: string;
  valuationDate: string;
  marketValueCents: Cents;
  note?: string | null;
};

export type InvestmentTimelineEntry =
  | {
      kind: "cash-flow";
      id: string;
      investmentAssetId: string;
      date: string;
      flowType: InvestmentCashFlowType;
      amountCents: Cents;
      note?: string | null;
    }
  | {
      kind: "valuation";
      id: string;
      investmentAssetId: string;
      date: string;
      marketValueCents: Cents;
      note?: string | null;
    };

export type InvestmentAssetOverview = ManagedInvestmentAsset & {
  cashFlows: ManagedInvestmentCashFlow[];
  valuations: ManagedInvestmentValuation[];
  metrics: InvestmentMetrics;
  timeline: InvestmentTimelineEntry[];
};

export type InvestmentOverview = {
  asOfDate: string;
  assets: InvestmentAssetOverview[];
  globalMetrics: InvestmentMetrics;
};

type InvestmentAssetRow = {
  id: string;
  name: string;
  description: string | null;
  start_month: string;
  archived_from_month: string | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

type InvestmentCashFlowRow = {
  id: string;
  investment_asset_id: string;
  flow_type: InvestmentCashFlowType;
  flow_date: string;
  amount_cents: number;
  note: string | null;
  created_at?: string;
  updated_at?: string;
};

type InvestmentValuationRow = {
  id: string;
  investment_asset_id: string;
  valuation_date: string;
  market_value_cents: number;
  note: string | null;
  created_at?: string;
  updated_at?: string;
};

const INVESTMENT_ASSET_SELECT =
  "id,name,description,start_month,archived_from_month,sort_order,created_at,updated_at";
const INVESTMENT_CASH_FLOW_SELECT =
  "id,investment_asset_id,flow_type,flow_date,amount_cents,note,created_at,updated_at";
const INVESTMENT_VALUATION_SELECT =
  "id,investment_asset_id,valuation_date,market_value_cents,note,created_at,updated_at";
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function getTodayId(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Não foi possível determinar a data actual.");
  }

  return `${year}-${month}-${day}`;
}

function normaliseOptionalText(value?: string | null) {
  const text = value?.trim();

  return text ? text : null;
}

function assertRequiredText(value: string, message: string) {
  const text = value.trim();

  if (!text) {
    throw new Error(message);
  }

  return text;
}

function assertIsoDate(value: string, fieldLabel: string) {
  if (!ISO_DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    throw new Error(`Indique uma data válida para ${fieldLabel}.`);
  }

  return value;
}

function assertPositiveCents(amountCents: Cents, message: string) {
  assertCents(amountCents);

  if (amountCents <= 0) {
    throw new Error(message);
  }

  return amountCents;
}

function assertNonNegativeCents(amountCents: Cents, message: string) {
  assertCents(amountCents);

  if (amountCents < 0) {
    throw new Error(message);
  }

  return amountCents;
}

function mapInvestmentAsset(row: InvestmentAssetRow): ManagedInvestmentAsset {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    startMonth: row.start_month.slice(0, 7) as MonthId,
    archivedFromMonth: row.archived_from_month ? (row.archived_from_month.slice(0, 7) as MonthId) : undefined,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInvestmentCashFlow(row: InvestmentCashFlowRow): ManagedInvestmentCashFlow {
  return {
    id: row.id,
    investmentAssetId: row.investment_asset_id,
    flowType: row.flow_type,
    flowDate: row.flow_date,
    amountCents: assertCents(row.amount_cents),
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInvestmentValuation(row: InvestmentValuationRow): ManagedInvestmentValuation {
  return {
    id: row.id,
    investmentAssetId: row.investment_asset_id,
    valuationDate: row.valuation_date,
    marketValueCents: assertCents(row.market_value_cents),
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toInvestmentAssetPayload(input: InvestmentAssetInput) {
  const sortOrder = Number(input.sortOrder);

  if (!Number.isInteger(sortOrder)) {
    throw new Error("A ordem deve ser um número inteiro.");
  }

  return {
    name: assertRequiredText(input.name, "Indique o nome do investimento."),
    description: normaliseOptionalText(input.description),
    start_month: toMonthStartDate(input.startMonth),
    sort_order: sortOrder,
  };
}

function toInvestmentCashFlowPayload(input: InvestmentCashFlowInput) {
  if (!input.investmentAssetId) {
    throw new Error("Investimento inválido.");
  }

  if (input.flowType !== "contribution" && input.flowType !== "redemption") {
    throw new Error("Escolha um tipo de fluxo válido.");
  }

  return {
    investment_asset_id: input.investmentAssetId,
    flow_type: input.flowType,
    flow_date: assertIsoDate(input.flowDate, "o fluxo"),
    amount_cents: assertPositiveCents(input.amountCents, "O montante do fluxo deve ser positivo."),
    note: normaliseOptionalText(input.note),
  };
}

function toInvestmentValuationPayload(input: InvestmentValuationInput) {
  if (!input.investmentAssetId) {
    throw new Error("Investimento inválido.");
  }

  return {
    investment_asset_id: input.investmentAssetId,
    valuation_date: assertIsoDate(input.valuationDate, "a valorização"),
    market_value_cents: assertNonNegativeCents(
      input.marketValueCents,
      "O valor de mercado não pode ser negativo.",
    ),
    note: normaliseOptionalText(input.note),
  };
}

function buildTimeline(
  cashFlows: readonly ManagedInvestmentCashFlow[],
  valuations: readonly ManagedInvestmentValuation[],
): InvestmentTimelineEntry[] {
  return [
    ...cashFlows.map((flow): InvestmentTimelineEntry => ({
      kind: "cash-flow",
      id: flow.id,
      investmentAssetId: flow.investmentAssetId,
      date: flow.flowDate,
      flowType: flow.flowType,
      amountCents: flow.amountCents,
      note: flow.note,
    })),
    ...valuations.map((valuation): InvestmentTimelineEntry => ({
      kind: "valuation",
      id: valuation.id,
      investmentAssetId: valuation.investmentAssetId,
      date: valuation.valuationDate,
      marketValueCents: valuation.marketValueCents,
      note: valuation.note,
    })),
  ].sort((left, right) => left.date.localeCompare(right.date) || left.kind.localeCompare(right.kind));
}

function sortAssets(assets: readonly ManagedInvestmentAsset[]) {
  return [...assets].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
}

function isDuplicateValuationError(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "23505" ||
    message.includes("duplicate") ||
    message.includes("investment_valuations_investment_asset_id_valuation_date_key")
  );
}

function investmentValuationErrorMessage(error: { code?: string; message?: string }) {
  if (isDuplicateValuationError(error)) {
    return "Já existe uma valorização deste investimento nessa data.";
  }

  return error.message ?? "Erro desconhecido.";
}

async function countRows(client: SupabaseClient, table: string, column: string, value: string) {
  const { count, error } = await client.from(table).select("id", { count: "exact", head: true }).eq(column, value);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function listInvestmentOverview({
  asOfDate = getTodayId(),
  client = createSupabaseAdminClient(),
}: {
  asOfDate?: string;
  client?: SupabaseClient;
} = {}): Promise<InvestmentOverview> {
  const calculationDate = assertIsoDate(asOfDate, "o resumo");
  const [{ data: assetRows, error: assetError }, { data: cashFlowRows, error: cashFlowError }, {
    data: valuationRows,
    error: valuationError,
  }] = await Promise.all([
    client.from("investment_assets").select(INVESTMENT_ASSET_SELECT).order("sort_order").order("name"),
    client
      .from("investment_cash_flows")
      .select(INVESTMENT_CASH_FLOW_SELECT)
      .order("flow_date")
      .order("created_at"),
    client
      .from("investment_valuations")
      .select(INVESTMENT_VALUATION_SELECT)
      .order("valuation_date")
      .order("created_at"),
  ]);

  if (assetError) {
    throw new Error(`Não foi possível carregar os investimentos: ${assetError.message}`);
  }

  if (cashFlowError) {
    throw new Error(`Não foi possível carregar os fluxos de investimento: ${cashFlowError.message}`);
  }

  if (valuationError) {
    throw new Error(`Não foi possível carregar as valorizações: ${valuationError.message}`);
  }

  const assets = sortAssets(((assetRows ?? []) as InvestmentAssetRow[]).map(mapInvestmentAsset));
  const cashFlows = ((cashFlowRows ?? []) as InvestmentCashFlowRow[]).map(mapInvestmentCashFlow);
  const valuations = ((valuationRows ?? []) as InvestmentValuationRow[]).map(mapInvestmentValuation);
  const overviews = assets.map((asset): InvestmentAssetOverview => {
    const assetCashFlows = cashFlows.filter((flow) => flow.investmentAssetId === asset.id);
    const assetValuations = valuations.filter((valuation) => valuation.investmentAssetId === asset.id);

    return {
      ...asset,
      cashFlows: assetCashFlows,
      valuations: assetValuations,
      metrics: calculateInvestmentMetrics({
        investmentAssetId: asset.id,
        cashFlows,
        valuations,
        asOfDate: calculationDate,
      }),
      timeline: buildTimeline(assetCashFlows, assetValuations),
    };
  });

  return {
    asOfDate: calculationDate,
    assets: overviews,
    globalMetrics: calculateGlobalInvestmentMetrics({
      investmentAssetIds: assets.map((asset) => asset.id),
      cashFlows,
      valuations,
      asOfDate: calculationDate,
    }),
  };
}

export async function createInvestmentAsset(input: InvestmentAssetInput) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("investment_assets")
    .insert(toInvestmentAssetPayload(input))
    .select(INVESTMENT_ASSET_SELECT)
    .single();

  if (error) {
    throw new Error(`Não foi possível criar o investimento: ${error.message}`);
  }

  return mapInvestmentAsset(data as InvestmentAssetRow);
}

export async function updateInvestmentAsset(input: InvestmentAssetInput & { id: string }) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("investment_assets")
    .update(toInvestmentAssetPayload(input))
    .eq("id", input.id)
    .select(INVESTMENT_ASSET_SELECT)
    .single();

  if (error) {
    throw new Error(`Não foi possível actualizar o investimento: ${error.message}`);
  }

  return mapInvestmentAsset(data as InvestmentAssetRow);
}

export async function getInvestmentAssetById(id: string, client: SupabaseClient = createSupabaseAdminClient()) {
  const { data, error } = await client.from("investment_assets").select(INVESTMENT_ASSET_SELECT).eq("id", id).single();

  if (error) {
    throw new Error(`Não foi possível encontrar o investimento: ${error.message}`);
  }

  return mapInvestmentAsset(data as InvestmentAssetRow);
}

export async function archiveInvestmentAsset(
  id: string,
  archiveFromMonth: MonthId = getMonthIdForDate(),
) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("investment_assets")
    .update({ archived_from_month: toMonthStartDate(archiveFromMonth) })
    .eq("id", id)
    .select(INVESTMENT_ASSET_SELECT)
    .single();

  if (error) {
    throw new Error(`Não foi possível arquivar o investimento: ${error.message}`);
  }

  return mapInvestmentAsset(data as InvestmentAssetRow);
}

export async function reactivateInvestmentAsset(id: string) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("investment_assets")
    .update({ archived_from_month: null })
    .eq("id", id)
    .select(INVESTMENT_ASSET_SELECT)
    .single();

  if (error) {
    throw new Error(`Não foi possível reactivar o investimento: ${error.message}`);
  }

  return mapInvestmentAsset(data as InvestmentAssetRow);
}

export async function investmentAssetHasRecords(id: string, client: SupabaseClient = createSupabaseAdminClient()) {
  const [cashFlowCount, valuationCount] = await Promise.all([
    countRows(client, "investment_cash_flows", "investment_asset_id", id),
    countRows(client, "investment_valuations", "investment_asset_id", id),
  ]);

  return cashFlowCount + valuationCount > 0;
}

export async function deleteInvestmentAssetWhenAllowed(id: string) {
  const client = createSupabaseAdminClient();
  const hasRecords = await investmentAssetHasRecords(id, client);

  if (hasRecords) {
    return false;
  }

  const { data, error } = await client.from("investment_assets").delete().eq("id", id).select("id").single();

  if (error) {
    throw new Error(`Não foi possível eliminar o investimento: ${error.message}`);
  }

  if (!(data as { id?: string } | null)?.id) {
    throw new Error("Não foi possível confirmar a eliminação do investimento.");
  }

  return true;
}

export async function createInvestmentCashFlow(input: InvestmentCashFlowInput) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("investment_cash_flows")
    .insert(toInvestmentCashFlowPayload(input))
    .select(INVESTMENT_CASH_FLOW_SELECT)
    .single();

  if (error) {
    throw new Error(`Não foi possível criar o fluxo de investimento: ${error.message}`);
  }

  return mapInvestmentCashFlow(data as InvestmentCashFlowRow);
}

export async function updateInvestmentCashFlow(input: InvestmentCashFlowInput & { id: string }) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("investment_cash_flows")
    .update(toInvestmentCashFlowPayload(input))
    .eq("id", input.id)
    .select(INVESTMENT_CASH_FLOW_SELECT)
    .single();

  if (error) {
    throw new Error(`Não foi possível actualizar o fluxo de investimento: ${error.message}`);
  }

  return mapInvestmentCashFlow(data as InvestmentCashFlowRow);
}

export async function getInvestmentCashFlowById(
  id: string,
  client: SupabaseClient = createSupabaseAdminClient(),
) {
  const { data, error } = await client
    .from("investment_cash_flows")
    .select(INVESTMENT_CASH_FLOW_SELECT)
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(`Não foi possível encontrar o fluxo de investimento: ${error.message}`);
  }

  return mapInvestmentCashFlow(data as InvestmentCashFlowRow);
}

export async function deleteInvestmentCashFlow(id: string) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client.from("investment_cash_flows").delete().eq("id", id).select("id").single();

  if (error) {
    throw new Error(`Não foi possível eliminar o fluxo de investimento: ${error.message}`);
  }

  if (!(data as { id?: string } | null)?.id) {
    throw new Error("Não foi possível confirmar a eliminação do fluxo de investimento.");
  }
}

export async function createInvestmentValuation(input: InvestmentValuationInput) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("investment_valuations")
    .insert(toInvestmentValuationPayload(input))
    .select(INVESTMENT_VALUATION_SELECT)
    .single();

  if (error) {
    throw new Error(`Não foi possível criar a valorização: ${investmentValuationErrorMessage(error)}`);
  }

  return mapInvestmentValuation(data as InvestmentValuationRow);
}

export async function updateInvestmentValuation(input: InvestmentValuationInput & { id: string }) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("investment_valuations")
    .update(toInvestmentValuationPayload(input))
    .eq("id", input.id)
    .select(INVESTMENT_VALUATION_SELECT)
    .single();

  if (error) {
    throw new Error(`Não foi possível actualizar a valorização: ${investmentValuationErrorMessage(error)}`);
  }

  return mapInvestmentValuation(data as InvestmentValuationRow);
}

export async function getInvestmentValuationById(
  id: string,
  client: SupabaseClient = createSupabaseAdminClient(),
) {
  const { data, error } = await client
    .from("investment_valuations")
    .select(INVESTMENT_VALUATION_SELECT)
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(`Não foi possível encontrar a valorização: ${error.message}`);
  }

  return mapInvestmentValuation(data as InvestmentValuationRow);
}

export async function deleteInvestmentValuation(id: string) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client.from("investment_valuations").delete().eq("id", id).select("id").single();

  if (error) {
    throw new Error(`Não foi possível eliminar a valorização: ${error.message}`);
  }

  if (!(data as { id?: string } | null)?.id) {
    throw new Error("Não foi possível confirmar a eliminação da valorização.");
  }
}
