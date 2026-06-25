import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getActiveLiquidityAccounts,
  getBudgetVisibleLiquidityAccounts,
  type AccountType,
  type LiquidityAccount,
} from "@/domain/budget/accounts";
import { FIRST_MONTH, normaliseMonth, toMonthStartDate, type MonthId } from "@/domain/budget/months";
import { createSupabaseAdminClient } from "@/server/supabase/client";

export const ACCOUNT_TYPES: readonly { value: AccountType; label: string }[] = [
  { value: "bank_account", label: "Conta bancária" },
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "savings", label: "Poupança" },
  { value: "investment_cash", label: "Liquidez de investimento" },
  { value: "cash", label: "Numerário" },
  { value: "other", label: "Outra" },
];

export type ManagedAccount = LiquidityAccount & {
  accountType: AccountType;
  shortName: string;
  showInBudget: boolean;
  includeInNetWorth: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type AccountRow = {
  id: string;
  name: string;
  short_name: string | null;
  account_type: AccountType | null;
  is_credit_card: boolean;
  linked_payment_account_id: string | null;
  start_month: string;
  archived_from_month: string | null;
  show_in_budget: boolean | null;
  include_in_net_worth: boolean | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export type AccountInput = {
  id?: string;
  name: string;
  shortName?: string;
  accountType: AccountType;
  isCreditCard: boolean;
  linkedPaymentAccountId?: string | null;
  startMonth: MonthId;
  sortOrder: number;
  showInBudget: boolean;
  includeInNetWorth: boolean;
};

const ACCOUNT_SELECT =
  "id,name,short_name,account_type,is_credit_card,linked_payment_account_id,start_month,archived_from_month,show_in_budget,include_in_net_worth,sort_order,created_at,updated_at";

export function isAccountType(value: string): value is AccountType {
  return ACCOUNT_TYPES.some((type) => type.value === value);
}

export function getAccountTypeLabel(type: AccountType) {
  return ACCOUNT_TYPES.find((accountType) => accountType.value === type)?.label ?? "Outra";
}

function mapAccount(row: AccountRow): ManagedAccount {
  const accountType = row.account_type ?? (row.is_credit_card ? "credit_card" : "bank_account");
  const startMonth = row.start_month.slice(0, 7) as MonthId;
  const archivedFromMonth = row.archived_from_month ? (row.archived_from_month.slice(0, 7) as MonthId) : undefined;

  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name?.trim() || row.name,
    accountType,
    isCreditCard: row.is_credit_card,
    linkedPaymentAccountId: row.linked_payment_account_id ?? undefined,
    startMonth,
    archivedFromMonth,
    showInBudget: row.show_in_budget ?? true,
    includeInNetWorth: row.include_in_net_worth ?? true,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listManagedAccounts(client: SupabaseClient = createSupabaseAdminClient()) {
  const { data, error } = await client.from("accounts").select(ACCOUNT_SELECT).order("sort_order").order("name");

  if (error) {
    throw new Error(`Não foi possível carregar as contas: ${error.message}`);
  }

  return ((data ?? []) as AccountRow[]).map(mapAccount);
}

export async function listActiveBudgetAccounts(month: MonthId, client: SupabaseClient = createSupabaseAdminClient()) {
  const accounts = await listManagedAccounts(client);

  return getBudgetVisibleLiquidityAccounts(accounts, month);
}

export function getActiveManagedAccounts(accounts: readonly ManagedAccount[], month: MonthId) {
  return getActiveLiquidityAccounts(accounts, month) as ManagedAccount[];
}

function toAccountPayload(input: AccountInput) {
  const shortName = input.shortName?.trim() || input.name.trim();

  return {
    name: input.name.trim(),
    short_name: shortName,
    account_type: input.accountType,
    is_credit_card: input.isCreditCard,
    linked_payment_account_id: input.isCreditCard ? input.linkedPaymentAccountId || null : null,
    start_month: toMonthStartDate(input.startMonth),
    sort_order: input.sortOrder,
    show_in_budget: input.showInBudget,
    include_in_net_worth: input.includeInNetWorth,
  };
}

export async function createAccount(input: AccountInput) {
  const client = createSupabaseAdminClient();
  const { error } = await client.from("accounts").insert(toAccountPayload(input));

  if (error) {
    throw new Error(`Não foi possível criar a conta: ${error.message}`);
  }
}

export async function updateAccount(input: AccountInput & { id: string }) {
  const client = createSupabaseAdminClient();
  const { error } = await client.from("accounts").update(toAccountPayload(input)).eq("id", input.id);

  if (error) {
    throw new Error(`Não foi possível actualizar a conta: ${error.message}`);
  }
}

export async function archiveAccount(id: string, archiveFromMonth: MonthId = FIRST_MONTH as MonthId) {
  const client = createSupabaseAdminClient();
  const month = normaliseMonth(archiveFromMonth);
  const { error } = await client
    .from("accounts")
    .update({ archived_from_month: toMonthStartDate(month) })
    .eq("id", id);

  if (error) {
    throw new Error(`Não foi possível arquivar a conta: ${error.message}`);
  }
}

export async function reactivateAccount(id: string) {
  const client = createSupabaseAdminClient();
  const { error } = await client.from("accounts").update({ archived_from_month: null }).eq("id", id);

  if (error) {
    throw new Error(`Não foi possível reactivar a conta: ${error.message}`);
  }
}

async function countRows(client: SupabaseClient, table: string, column: string, value: string) {
  const { count, error } = await client.from(table).select("id", { count: "exact", head: true }).eq(column, value);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function accountHasDependencies(id: string) {
  const client = createSupabaseAdminClient();
  const checks = await Promise.all([
    countRows(client, "account_month_states", "account_id", id),
    countRows(client, "budget_allocations", "account_id", id),
    countRows(client, "recurring_rules", "account_id", id),
    countRows(client, "daily_budget_versions", "account_id", id),
    countRows(client, "salary_versions", "account_id", id),
    countRows(client, "salary_month_overrides", "account_id", id),
    countRows(client, "credit_card_statement_overrides", "credit_card_account_id", id),
    countRows(client, "actual_movements", "account_id", id),
  ]);

  return checks.some((count) => count > 0);
}

export async function deleteAccountWhenAllowed(id: string) {
  const hasDependencies = await accountHasDependencies(id);

  if (hasDependencies) {
    return false;
  }

  const client = createSupabaseAdminClient();
  const { error } = await client.from("accounts").delete().eq("id", id);

  if (error) {
    throw new Error(`Não foi possível eliminar a conta: ${error.message}`);
  }

  return true;
}
