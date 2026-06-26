import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAccountDisplayName,
  getActiveInvestmentAssets,
  getBudgetVisibleLiquidityAccounts,
  type InvestmentAsset,
} from "@/domain/budget/accounts";
import {
  buildMonthlyCreditCardPayments,
} from "@/domain/budget/credit-card-payments";
import {
  buildDailyBudgetSourceAmountMap,
  calculateDailyBudgetForecast,
} from "@/domain/budget/daily-budget";
import { assertCents, type Cents } from "@/domain/budget/money";
import { FIRST_MONTH, toMonthStartDate, type MonthId } from "@/domain/budget/months";
import {
  buildMonthlyDirectDebitOccurrences,
  buildRecurringDebitSourceAmountMap,
  monthRangeUntil,
} from "@/domain/budget/recurring-rules";
import {
  buildSnapshotsForMonth,
  monthlySourceAmountKey,
  type AccountMonthState,
  type MonthlySystemSourceType,
} from "@/domain/budget/monthly-snapshots";
import {
  buildBudgetOverview,
  EDITABLE_BUDGET_ROW_KEYS,
  type BudgetOverview,
  type BudgetRowKey,
  type EditableBudgetRowKey,
  type MonthlyCustomBudgetItem,
} from "@/domain/budget/monthly-view";
import { createSupabaseAdminClient } from "@/server/supabase/client";
import { listManagedAccounts } from "./accounts";
import { listCreditCardStatementOverridesUntil } from "./credit-card-payments";
import { listDailyBudgetVersionsUntil } from "./daily-budget";
import { listRecurringRuleMonthStatesUntil, listRecurringRules } from "./recurring-rules";

type AccountMonthStateRow = {
  account_id: string;
  month: string;
  initial_balance_override_cents: number | null;
  current_balance_override_cents: number | null;
};

type BudgetItemRow = {
  id: string;
  month: string;
  description: string;
  category: string;
  source_type: string;
  sort_order: number | null;
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
  rowKey: BudgetRowKey;
  sourceType: SystemBudgetSourceType;
  description: string;
  category: "expense" | "income" | "transfer" | "credit_card_payment" | "investment" | "other";
  status: "planned" | "done" | "cancelled";
};

export type CustomBudgetItemSaveInput = {
  id: string;
  description: string;
  sortOrder: number;
  valuesByAccountId: Record<string, Cents>;
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
  return EDITABLE_BUDGET_ROW_KEYS.some((editableRowKey) => editableRowKey === rowKey);
}

function isPersistedSystemBudgetDefinition(
  definition: SystemBudgetDefinition,
): definition is SystemBudgetDefinition & { rowKey: EditableBudgetRowKey } {
  return EDITABLE_BUDGET_ROW_KEYS.some((rowKey) => rowKey === definition.rowKey);
}

function isMonthlySystemSourceType(sourceType: string): sourceType is MonthlySystemSourceType {
  return SYSTEM_SOURCE_TYPES.some((systemSourceType) => systemSourceType === sourceType);
}

async function fetchAccountMonthStates(client: SupabaseClient, month: MonthId) {
  const { data, error } = await client
    .from("account_month_states")
    .select("account_id,month,initial_balance_override_cents,current_balance_override_cents")
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
      currentBalanceOverrideCents:
        state.current_balance_override_cents === null ? null : assertCents(state.current_balance_override_cents),
    }),
  );
}

async function fetchBudgetItems(client: SupabaseClient, month: MonthId) {
  const { data: items, error: itemsError } = await client
    .from("budget_items")
    .select("id,month,description,category,source_type,sort_order")
    .gte("month", toMonthStartDate(FIRST_MONTH as MonthId))
    .lte("month", toMonthStartDate(month));

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

    if (
      !item ||
      !isMonthlySystemSourceType(item.source_type) ||
      item.source_type === "direct_debits" ||
      item.source_type === "day_to_day" ||
      item.source_type === "credit_card_payments"
    ) {
      continue;
    }

    const month = item.month.slice(0, 7) as MonthId;
    const key = monthlySourceAmountKey(month, item.source_type, allocation.account_id);
    amountBySource.set(key, assertCents(allocation.amount_cents));
  }

  return amountBySource;
}

function buildCustomBudgetItems(items: readonly BudgetItemRow[], allocations: readonly BudgetAllocationRow[]) {
  const allocationsByItemId = new Map<string, BudgetAllocationRow[]>();

  for (const allocation of allocations) {
    const itemAllocations = allocationsByItemId.get(allocation.budget_item_id) ?? [];
    itemAllocations.push(allocation);
    allocationsByItemId.set(allocation.budget_item_id, itemAllocations);
  }

  return items
    .filter((item) => item.source_type === "manual")
    .map((item): MonthlyCustomBudgetItem => {
      const valuesByAccountId = Object.fromEntries(
        (allocationsByItemId.get(item.id) ?? []).map((allocation) => [
          allocation.account_id,
          assertCents(allocation.amount_cents),
        ]),
      );

      return {
        id: item.id,
        month: item.month.slice(0, 7) as MonthId,
        description: item.description,
        sortOrder: item.sort_order ?? 0,
        valuesByAccountId,
      };
    });
}

export async function getSupabaseBudgetOverview(
  month: MonthId,
  { referenceDate = new Date() }: { referenceDate?: Date } = {},
): Promise<BudgetOverview> {
  const client = createSupabaseAdminClient();
  const [
    accounts,
    states,
    budgetData,
    investmentAssets,
    recurringRules,
    recurringRuleMonthStates,
    dailyBudgetVersions,
    creditCardStatementOverrides,
  ] = await Promise.all([
    listManagedAccounts(client),
    fetchAccountMonthStates(client, month),
    fetchBudgetItems(client, month),
    fetchInvestmentAssets(client, month),
    listRecurringRules(client),
    listRecurringRuleMonthStatesUntil(month, client),
    listDailyBudgetVersionsUntil(month, client),
    listCreditCardStatementOverridesUntil(month, client),
  ]);
  const activeAccounts = getBudgetVisibleLiquidityAccounts(accounts, month);
  const sourceAmounts = buildSourceAmountMap(budgetData.items, budgetData.allocations);
  const months = monthRangeUntil(month);
  const recurringDebitAmounts = buildRecurringDebitSourceAmountMap(
    recurringRules,
    months,
    recurringRuleMonthStates,
  );
  const dailyBudgetAmounts = buildDailyBudgetSourceAmountMap({
    versions: dailyBudgetVersions,
    months,
    referenceDate,
  });

  for (const [key, amountCents] of recurringDebitAmounts) {
    sourceAmounts.set(key, amountCents);
  }

  for (const [key, amountCents] of dailyBudgetAmounts) {
    sourceAmounts.set(key, amountCents);
  }

  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const directDebitOccurrences = buildMonthlyDirectDebitOccurrences(
    recurringRules,
    month,
    recurringRuleMonthStates,
  ).map((occurrence) => {
    const account = accountsById.get(occurrence.accountId);

    return {
      ...occurrence,
      accountName: account ? getAccountDisplayName(account) : "Conta arquivada",
      accountSortOrder: account?.sortOrder ?? Number.MAX_SAFE_INTEGER,
    };
  });
  const customItems = buildCustomBudgetItems(budgetData.items, budgetData.allocations);
  const snapshots = buildSnapshotsForMonth({
    month,
    accounts,
    states,
    sourceAmounts,
    customItems,
    creditCardStatementOverrides,
  });
  const dailyBudgetForecast = calculateDailyBudgetForecast({
    versions: dailyBudgetVersions,
    accounts,
    month,
    referenceDate,
  });
  const creditCardPayments = buildMonthlyCreditCardPayments({
    accounts: activeAccounts,
    snapshots,
    month,
    overrides: creditCardStatementOverrides,
  });
  const selectedCustomItems = customItems.filter((item) => item.month === month);

  return buildBudgetOverview({
    month,
    accounts: activeAccounts,
    investmentAssets,
    snapshots,
    customItems: selectedCustomItems,
    directDebitOccurrences,
    dailyBudgetForecast,
    creditCardPayments,
  });
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
        sort_order: 0,
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
      sort_order: 0,
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
  customItems = [],
}: {
  month: MonthId;
  values: Record<EditableBudgetRowKey, Record<string, Cents>>;
  customItems?: readonly CustomBudgetItemSaveInput[];
}) {
  const client = createSupabaseAdminClient();
  const accounts = await listManagedAccounts(client);
  const activeAccounts = getBudgetVisibleLiquidityAccounts(accounts, month);
  const accountIds = activeAccounts.map((account) => account.id);
  const monthDate = toMonthStartDate(month);

  const accountStateRows = accountIds.map((accountId) => {
    const row: {
      account_id: string;
      month: string;
      current_balance_override_cents: Cents;
      initial_balance_override_cents?: Cents;
    } = {
      account_id: accountId,
      month: monthDate,
      current_balance_override_cents: values["current-balance"]?.[accountId] ?? 0,
    };

    if (month === FIRST_MONTH) {
      row.initial_balance_override_cents = values["initial-balance"]?.[accountId] ?? 0;
    }

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

  for (const definition of SYSTEM_BUDGET_DEFINITIONS.filter(isPersistedSystemBudgetDefinition)) {
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

  for (const item of customItems) {
    const { error: itemError } = await client
      .from("budget_items")
      .update({
        description: item.description,
        sort_order: item.sortOrder,
      })
      .eq("id", item.id)
      .eq("month", monthDate)
      .eq("source_type", "manual");

    if (itemError) {
      throw new Error(`Não foi possível guardar "${item.description}": ${itemError.message}`);
    }

    const allocations = accountIds.map((accountId) => ({
      budget_item_id: item.id,
      account_id: accountId,
      amount_cents: item.valuesByAccountId[accountId] ?? 0,
    }));

    if (allocations.length === 0) {
      continue;
    }

    const { error: allocationsError } = await client.from("budget_allocations").upsert(allocations, {
      onConflict: "budget_item_id,account_id",
    });

    if (allocationsError) {
      throw new Error(`Não foi possível guardar os valores de "${item.description}": ${allocationsError.message}`);
    }
  }
}

export async function addCustomBudgetItem(month: MonthId): Promise<MonthlyCustomBudgetItem> {
  const client = createSupabaseAdminClient();
  const monthDate = toMonthStartDate(month);
  const { data: existingItems, error: selectError } = await client
    .from("budget_items")
    .select("sort_order")
    .eq("month", monthDate)
    .eq("source_type", "manual")
    .order("sort_order", { ascending: false })
    .limit(1);

  if (selectError) {
    throw new Error(`Não foi possível preparar a nova linha: ${selectError.message}`);
  }

  const maxSortOrder = (existingItems?.[0] as { sort_order: number | null } | undefined)?.sort_order ?? 0;
  const { data: inserted, error } = await client
    .from("budget_items")
    .insert({
      month: monthDate,
      description: "Nova linha",
      category: "other",
      status: "planned",
      source_type: "manual",
      sort_order: maxSortOrder + 10,
    })
    .select("id,month,description,sort_order")
    .single();

  if (error) {
    throw new Error(`Não foi possível adicionar a linha: ${error.message}`);
  }

  const item = inserted as Pick<BudgetItemRow, "id" | "month" | "description" | "sort_order">;

  return {
    id: item.id,
    month: item.month.slice(0, 7) as MonthId,
    description: item.description,
    sortOrder: item.sort_order ?? maxSortOrder + 10,
    valuesByAccountId: {},
  };
}

export async function deleteCustomBudgetItem(month: MonthId, id: string) {
  const client = createSupabaseAdminClient();
  const { error } = await client
    .from("budget_items")
    .delete()
    .eq("id", id)
    .eq("month", toMonthStartDate(month))
    .eq("source_type", "manual");

  if (error) {
    throw new Error(`Não foi possível eliminar a linha: ${error.message}`);
  }
}
