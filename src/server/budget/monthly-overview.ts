import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getActiveInvestmentAssets,
  getBudgetVisibleLiquidityAccounts,
  type InvestmentAsset,
} from "@/domain/budget/accounts";
import { buildActualMovementAmountMap } from "@/domain/budget/actual-movements";
import { assertCents, type Cents } from "@/domain/budget/money";
import { FIRST_MONTH, toMonthStartDate, type MonthId } from "@/domain/budget/months";
import {
  buildSnapshotsForMonth,
  monthlySourceAmountKey,
  type AccountMonthState,
  type MonthlySystemSourceType,
} from "@/domain/budget/monthly-snapshots";
import {
  buildBudgetOverview,
  type BudgetOverview,
  type BudgetRowKey,
  type EditableBudgetRowKey,
} from "@/domain/budget/monthly-view";
import { createSupabaseAdminClient } from "@/server/supabase/client";
import { listActualMovementsUntilMonth } from "./actual-movements";
import { listManagedAccounts } from "./accounts";

type AccountMonthStateRow = {
  account_id: string;
  month: string;
  initial_balance_override_cents: number | null;
};

type BudgetItemRow = {
  id: string;
  month: string;
  source_type: MonthlySystemSourceType;
};

type BudgetAllocationRow = {
  budget_item_id: string;
  account_id: string;
  amount_cents: number;
};

type InvestmentAssetRow = {
  id: string;
  name: string;
  start_month: string;
  archived_from_month: string | null;
  sort_order: number;
};

type InvestmentMonthValueRow = {
  investment_asset_id: string;
  month: string;
  value_cents: number;
};

export type SystemBudgetSourceType =
  | "direct_debits"
  | "day_to_day"
  | "credit_card_payments"
  | "salary";

export type SystemBudgetDefinition = {
  rowKey: EditableBudgetRowKey;
  sourceType: SystemBudgetSourceType;
  description: string;
  category: "expense" | "income" | "transfer" | "credit_card_payment" | "investment" | "other";
  status: "planned" | "done" | "cancelled";
};

export const SYSTEM_BUDGET_DEFINITIONS: readonly SystemBudgetDefinition[] = [
  {
    rowKey: "direct-debits",
    sourceType: "direct_debits",
    description: "Débitos directos",
    category: "expense",
    status: "planned",
  },
  {
    rowKey: "day-to-day",
    sourceType: "day_to_day",
    description: "Day to day",
    category: "expense",
    status: "planned",
  },
  {
    rowKey: "credit-card-payments",
    sourceType: "credit_card_payments",
    description: "Pagamentos de cartões",
    category: "credit_card_payment",
    status: "planned",
  },
  {
    rowKey: "salary",
    sourceType: "salary",
    description: "Salário",
    category: "income",
    status: "planned",
  },
];

const SYSTEM_SOURCE_TYPES = SYSTEM_BUDGET_DEFINITIONS.map((definition) => definition.sourceType);

export function isSystemEditableRowKey(rowKey: BudgetRowKey): rowKey is EditableBudgetRowKey {
  return (
    rowKey === "initial-balance" ||
    SYSTEM_BUDGET_DEFINITIONS.some((definition) => definition.rowKey === rowKey)
  );
}

async function fetchAccountMonthStates(client: SupabaseClient, month: MonthId) {
  const { data, error } = await client
    .from("account_month_states")
    .select("account_id,month,initial_balance_override_cents")
    .gte("month", toMonthStartDate(FIRST_MONTH as MonthId))
    .lte("month", toMonthStartDate(month));

  if (error) {
    throw new Error(`Não foi possível carregar os saldos mensais: ${error.message}`);
  }

  return ((data ?? []) as AccountMonthStateRow[]).map(
    (state): AccountMonthState => ({
      accountId: state.account_id,
      month: state.month.slice(0, 7) as MonthId,
      initialBalanceOverrideCents:
        state.initial_balance_override_cents === null ? null : assertCents(state.initial_balance_override_cents),
    }),
  );
}

async function fetchSystemBudgetItems(client: SupabaseClient, month: MonthId) {
  const { data: items, error: itemsError } = await client
    .from("budget_items")
    .select("id,month,source_type")
    .gte("month", toMonthStartDate(FIRST_MONTH as MonthId))
    .lte("month", toMonthStartDate(month))
    .in("source_type", SYSTEM_SOURCE_TYPES);

  if (itemsError) {
    throw new Error(`Não foi possível carregar as linhas do orçamento: ${itemsError.message}`);
  }

  const itemRows = (items ?? []) as BudgetItemRow[];
  const itemIds = itemRows.map((item) => item.id);

  if (itemIds.length === 0) {
    return { items: itemRows, allocations: [] as BudgetAllocationRow[] };
  }

  const { data: allocations, error: allocationsError } = await client
    .from("budget_allocations")
    .select("budget_item_id,account_id,amount_cents")
    .in("budget_item_id", itemIds);

  if (allocationsError) {
    throw new Error(`Não foi possível carregar os valores do orçamento: ${allocationsError.message}`);
  }

  return { items: itemRows, allocations: (allocations ?? []) as BudgetAllocationRow[] };
}

async function fetchInvestmentAssets(client: SupabaseClient, month: MonthId) {
  const [{ data: assets, error: assetsError }, { data: values, error: valuesError }] = await Promise.all([
    client
      .from("investment_assets")
      .select("id,name,start_month,archived_from_month,sort_order")
      .order("sort_order")
      .order("name"),
    client
      .from("investment_month_values")
      .select("investment_asset_id,month,value_cents")
      .eq("month", toMonthStartDate(month)),
  ]);

  if (assetsError) {
    throw new Error(`Não foi possível carregar os activos de investimento: ${assetsError.message}`);
  }

  if (valuesError) {
    throw new Error(`Não foi possível carregar os valores de investimento: ${valuesError.message}`);
  }

  const valueByAssetId = new Map(
    ((values ?? []) as InvestmentMonthValueRow[]).map((value) => [
      value.investment_asset_id,
      assertCents(value.value_cents),
    ]),
  );

  const mappedAssets: InvestmentAsset[] = ((assets ?? []) as InvestmentAssetRow[]).map((asset) => ({
    id: asset.id,
    name: asset.name,
    startMonth: asset.start_month.slice(0, 7) as MonthId,
    archivedFromMonth: asset.archived_from_month ? (asset.archived_from_month.slice(0, 7) as MonthId) : undefined,
    sortOrder: asset.sort_order,
    monthlyValuesCents: valueByAssetId.has(asset.id) ? { [month]: valueByAssetId.get(asset.id) ?? 0 } : undefined,
  }));

  return getActiveInvestmentAssets(mappedAssets, month);
}

function buildSourceAmountMap(items: readonly BudgetItemRow[], allocations: readonly BudgetAllocationRow[]) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const amountBySource = new Map<string, Cents>();

  for (const allocation of allocations) {
    const item = itemById.get(allocation.budget_item_id);

    if (!item) {
      continue;
    }

    const month = item.month.slice(0, 7) as MonthId;
    const key = monthlySourceAmountKey(month, item.source_type, allocation.account_id);
    amountBySource.set(key, assertCents(allocation.amount_cents));
  }

  return amountBySource;
}

export async function getSupabaseBudgetOverview(month: MonthId): Promise<BudgetOverview> {
  const client = createSupabaseAdminClient();
  const [accounts, states, systemBudgetData, investmentAssets, actualMovements] = await Promise.all([
    listManagedAccounts(client),
    fetchAccountMonthStates(client, month),
    fetchSystemBudgetItems(client, month),
    fetchInvestmentAssets(client, month),
    listActualMovementsUntilMonth(month, client),
  ]);
  const activeAccounts = getBudgetVisibleLiquidityAccounts(accounts, month);
  const sourceAmounts = buildSourceAmountMap(systemBudgetData.items, systemBudgetData.allocations);
  const actualMovementAmounts = buildActualMovementAmountMap(actualMovements);
  const snapshots = buildSnapshotsForMonth({ month, accounts, states, sourceAmounts, actualMovementAmounts });

  return buildBudgetOverview({ month, accounts: activeAccounts, investmentAssets, snapshots });
}

async function ensureSystemBudgetItem(
  client: SupabaseClient,
  month: MonthId,
  definition: SystemBudgetDefinition,
) {
  const monthDate = toMonthStartDate(month);
  const { data: existingRows, error: selectError } = await client
    .from("budget_items")
    .select("id")
    .eq("month", monthDate)
    .eq("source_type", definition.sourceType)
    .limit(1);

  if (selectError) {
    throw new Error(`Não foi possível procurar a linha "${definition.description}": ${selectError.message}`);
  }

  const existing = existingRows?.[0] as { id: string } | undefined;

  if (existing) {
    const { error: updateError } = await client
      .from("budget_items")
      .update({
        description: definition.description,
        category: definition.category,
        status: definition.status,
      })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(`Não foi possível actualizar a linha "${definition.description}": ${updateError.message}`);
    }

    return existing.id;
  }

  const { data: inserted, error: insertError } = await client
    .from("budget_items")
    .insert({
      month: monthDate,
      description: definition.description,
      category: definition.category,
      status: definition.status,
      source_type: definition.sourceType,
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Não foi possível criar a linha "${definition.description}": ${insertError.message}`);
  }

  return (inserted as { id: string }).id;
}

export async function saveMonthlyBudgetValues({
  month,
  values,
}: {
  month: MonthId;
  values: Record<EditableBudgetRowKey, Record<string, Cents>>;
}) {
  const client = createSupabaseAdminClient();
  const accounts = await listManagedAccounts(client);
  const activeAccounts = getBudgetVisibleLiquidityAccounts(accounts, month);
  const accountIds = activeAccounts.map((account) => account.id);
  const monthDate = toMonthStartDate(month);

  if (month === FIRST_MONTH) {
    const accountStateRows = accountIds.map((accountId) => {
      const row: {
        account_id: string;
        month: string;
        initial_balance_override_cents: Cents;
      } = {
        account_id: accountId,
        month: monthDate,
        initial_balance_override_cents: values["initial-balance"]?.[accountId] ?? 0,
      };

      return row;
    });

    if (accountStateRows.length > 0) {
      const { error } = await client.from("account_month_states").upsert(accountStateRows, {
        onConflict: "account_id,month",
      });

      if (error) {
        throw new Error(`Não foi possível guardar os saldos mensais: ${error.message}`);
      }
    }
  }

  for (const definition of SYSTEM_BUDGET_DEFINITIONS) {
    const budgetItemId = await ensureSystemBudgetItem(client, month, definition);
    const allocations = accountIds.map((accountId) => ({
      budget_item_id: budgetItemId,
      account_id: accountId,
      amount_cents: values[definition.rowKey]?.[accountId] ?? 0,
    }));

    if (allocations.length === 0) {
      continue;
    }

    const { error } = await client.from("budget_allocations").upsert(allocations, {
      onConflict: "budget_item_id,account_id",
    });

    if (error) {
      throw new Error(`Não foi possível guardar "${definition.description}": ${error.message}`);
    }
  }
}
