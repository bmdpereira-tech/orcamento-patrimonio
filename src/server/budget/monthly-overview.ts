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
import {
  getInvestmentValueForMonth,
  getMonthEndDate,
  type InvestmentValuation,
} from "@/domain/budget/investments";
import { assertCents, type Cents } from "@/domain/budget/money";
import { FIRST_MONTH, toMonthStartDate, type MonthId } from "@/domain/budget/months";
import {
  buildMonthlyDirectDebitOccurrences,
  buildRecurringDebitSourceAmountMap,
  monthRangeUntil,
} from "@/domain/budget/recurring-rules";
import {
  buildSalarySourceAmountMap,
  calculateMonthlySalaryForecast,
} from "@/domain/budget/salary";
import {
  buildSnapshotsForMonth,
  monthlySourceAmountKey,
  type AccountMonthState,
  type MonthlySystemSourceType,
} from "@/domain/budget/monthly-snapshots";
import {
  buildBudgetOverview,
  type BudgetOverview,
  type EditableBudgetRowKey,
  type MonthlyCustomBudgetItem,
} from "@/domain/budget/monthly-view";
import { createSupabaseAdminClient } from "@/server/supabase/client";
import { listManagedAccounts } from "./accounts";
import { listCreditCardStatementOverridesUntil } from "./credit-card-payments";
import { listDailyBudgetVersionsUntil } from "./daily-budget";
import { listRecurringRuleMonthStatesUntil, listRecurringRules } from "./recurring-rules";
import { listSalaryMonthOverridesUntil, listSalaryVersionsUntil } from "./salary";

type AccountMonthStateRow = {
  account_id: string;
  month: string;
  initial_balance_override_cents: number | null;
  current_balance_override_cents: number | null;
  realised_movements_override_cents?: number | null;
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

type InvestmentValuationRow = {
  investment_asset_id: string;
  valuation_date: string;
  market_value_cents: number;
};

export type CustomBudgetItemSaveInput = {
  id: string;
  description: string;
  sortOrder: number;
  valuesByAccountId: Record<string, Cents>;
};

const IGNORED_AUTOMATIC_SOURCE_TYPES: readonly MonthlySystemSourceType[] = [
  "direct_debits",
  "day_to_day",
  "credit_card_payments",
  "salary",
];

function isMonthlySystemSourceType(sourceType: string): sourceType is MonthlySystemSourceType {
  return IGNORED_AUTOMATIC_SOURCE_TYPES.some((systemSourceType) => systemSourceType === sourceType);
}

async function fetchAccountMonthStates(client: SupabaseClient, month: MonthId) {
  const { data, error } = await client
    .from("account_month_states")
    .select("account_id,month,initial_balance_override_cents,current_balance_override_cents,realised_movements_override_cents")
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
      realisedMovementsOverrideCents:
        state.realised_movements_override_cents === null || state.realised_movements_override_cents === undefined
          ? null
          : assertCents(state.realised_movements_override_cents),
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

export function attachInvestmentValuationsForMonth({
  assets,
  valuations,
  month,
}: {
  assets: readonly InvestmentAsset[];
  valuations: readonly InvestmentValuation[];
  month: MonthId;
}) {
  return getActiveInvestmentAssets(assets, month).map((asset): InvestmentAsset => {
    const valuation = getInvestmentValueForMonth(asset.id, valuations, month);

    return {
      ...asset,
      monthlyValuesCents: valuation ? { [month]: valuation.marketValueCents } : undefined,
    };
  });
}

async function fetchInvestmentAssets(client: SupabaseClient, month: MonthId) {
  const monthEndDate = getMonthEndDate(month);
  const [{ data: assets, error: assetsError }, { data: valuations, error: valuationsError }] = await Promise.all([
    client
      .from("investment_assets")
      .select("id,name,start_month,archived_from_month,sort_order")
      .order("sort_order")
      .order("name"),
    client
      .from("investment_valuations")
      .select("investment_asset_id,valuation_date,market_value_cents")
      .lte("valuation_date", monthEndDate),
  ]);

  if (assetsError) {
    throw new Error(`Não foi possível carregar os activos de investimento: ${assetsError.message}`);
  }

  if (valuationsError) {
    throw new Error(`Não foi possível carregar os valores de investimento: ${valuationsError.message}`);
  }

  const mappedAssets: InvestmentAsset[] = ((assets ?? []) as InvestmentAssetRow[]).map((asset) => ({
    id: asset.id,
    name: asset.name,
    startMonth: asset.start_month.slice(0, 7) as MonthId,
    archivedFromMonth: asset.archived_from_month ? (asset.archived_from_month.slice(0, 7) as MonthId) : undefined,
    sortOrder: asset.sort_order,
  }));
  const mappedValuations: InvestmentValuation[] = ((valuations ?? []) as InvestmentValuationRow[]).map(
    (valuation) => ({
      investmentAssetId: valuation.investment_asset_id,
      valuationDate: valuation.valuation_date,
      marketValueCents: assertCents(valuation.market_value_cents),
    }),
  );

  return attachInvestmentValuationsForMonth({
    assets: mappedAssets,
    valuations: mappedValuations,
    month,
  });
}

function buildSourceAmountMap(items: readonly BudgetItemRow[], allocations: readonly BudgetAllocationRow[]) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const amountBySource = new Map<string, Cents>();

  for (const allocation of allocations) {
    const item = itemById.get(allocation.budget_item_id);

    if (
      !item ||
      !isMonthlySystemSourceType(item.source_type) ||
      IGNORED_AUTOMATIC_SOURCE_TYPES.includes(item.source_type)
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

function buildManualAllocationAmountMap({
  monthDate,
  items,
  allocations,
}: {
  monthDate: string;
  items: readonly BudgetItemRow[];
  allocations: readonly BudgetAllocationRow[];
}) {
  const manualItemIds = new Set(
    items
      .filter((item) => item.month === monthDate && item.source_type === "manual")
      .map((item) => item.id),
  );
  const amountByItemAndAccount = new Map<string, Cents>();

  for (const allocation of allocations) {
    if (!manualItemIds.has(allocation.budget_item_id)) {
      continue;
    }

    amountByItemAndAccount.set(
      `${allocation.budget_item_id}:${allocation.account_id}`,
      assertCents(allocation.amount_cents),
    );
  }

  return { manualItemIds, amountByItemAndAccount };
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
    salaryVersions,
    salaryMonthOverrides,
  ] = await Promise.all([
    listManagedAccounts(client),
    fetchAccountMonthStates(client, month),
    fetchBudgetItems(client, month),
    fetchInvestmentAssets(client, month),
    listRecurringRules(client),
    listRecurringRuleMonthStatesUntil(month, client),
    listDailyBudgetVersionsUntil(month, client),
    listCreditCardStatementOverridesUntil(month, client),
    listSalaryVersionsUntil(month, client),
    listSalaryMonthOverridesUntil(month, client),
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
  const salaryAmounts = buildSalarySourceAmountMap({
    versions: salaryVersions,
    overrides: salaryMonthOverrides,
    months,
  });

  for (const [key, amountCents] of recurringDebitAmounts) {
    sourceAmounts.set(key, amountCents);
  }

  for (const [key, amountCents] of dailyBudgetAmounts) {
    sourceAmounts.set(key, amountCents);
  }

  for (const [key, amountCents] of salaryAmounts) {
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
  const salaryForecast = calculateMonthlySalaryForecast({
    versions: salaryVersions,
    overrides: salaryMonthOverrides,
    accounts,
    month,
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
    salaryForecast,
  });
}

export async function getMonthlyBudgetFinancialChangeMonth({
  month,
  values,
  customItems = [],
}: {
  month: MonthId;
  values: Record<EditableBudgetRowKey, Record<string, Cents>>;
  customItems?: readonly CustomBudgetItemSaveInput[];
}) {
  const client = createSupabaseAdminClient();
  const monthDate = toMonthStartDate(month);
  const [existingOverview, budgetData] = await Promise.all([
    getSupabaseBudgetOverview(month),
    fetchBudgetItems(client, month),
  ]);
  const accountIds = existingOverview.accounts.map((account) => account.id);
  const snapshotByAccountId = new Map(
    existingOverview.snapshots.map((snapshot) => [snapshot.accountId, snapshot]),
  );

  for (const accountId of accountIds) {
    const existingSnapshot = snapshotByAccountId.get(accountId);
    const existingRealisedMovements = existingSnapshot?.realisedMovementsCents ?? 0;
    const nextRealisedMovements = values["realised-movements"]?.[accountId] ?? 0;

    if (existingRealisedMovements !== nextRealisedMovements) {
      return month;
    }

    if (month === FIRST_MONTH) {
      const existingInitialBalance = existingSnapshot?.initialBalanceCents ?? 0;
      const nextInitialBalance = values["initial-balance"]?.[accountId] ?? 0;

      if (existingInitialBalance !== nextInitialBalance) {
        return month;
      }
    }
  }

  const { manualItemIds, amountByItemAndAccount } = buildManualAllocationAmountMap({
    monthDate,
    items: budgetData.items,
    allocations: budgetData.allocations,
  });
  const incomingItemIds = new Set(customItems.map((item) => item.id));

  for (const item of customItems) {
    for (const accountId of accountIds) {
      const existingAmount = amountByItemAndAccount.get(`${item.id}:${accountId}`) ?? 0;
      const nextAmount = item.valuesByAccountId[accountId] ?? 0;

      if (existingAmount !== nextAmount) {
        return month;
      }
    }
  }

  for (const itemId of manualItemIds) {
    if (incomingItemIds.has(itemId)) {
      continue;
    }

    for (const accountId of accountIds) {
      if ((amountByItemAndAccount.get(`${itemId}:${accountId}`) ?? 0) !== 0) {
        return month;
      }
    }
  }

  return null;
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
      realised_movements_override_cents: Cents;
      current_balance_override_cents: null;
      initial_balance_override_cents?: Cents;
    } = {
      account_id: accountId,
      month: monthDate,
      realised_movements_override_cents: values["realised-movements"]?.[accountId] ?? 0,
      current_balance_override_cents: null,
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
