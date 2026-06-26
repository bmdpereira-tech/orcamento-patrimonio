import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isActiveInMonth } from "@/domain/budget/accounts";
import {
  validateDailyBudgetVersionInput,
  type DailyBudgetVersion,
  type DailyBudgetVersionInput,
} from "@/domain/budget/daily-budget";
import { assertCents } from "@/domain/budget/money";
import { FIRST_MONTH, toMonthStartDate, type MonthId } from "@/domain/budget/months";
import { createSupabaseAdminClient } from "@/server/supabase/client";
import { listManagedAccounts } from "./accounts";

type DailyBudgetVersionRow = {
  id: string;
  effective_from_month: string;
  daily_amount_cents: number;
  account_id: string;
  created_at?: string;
  updated_at?: string;
};

const DAILY_BUDGET_VERSION_SELECT =
  "id,effective_from_month,daily_amount_cents,account_id,created_at,updated_at";

function mapDailyBudgetVersion(row: DailyBudgetVersionRow): DailyBudgetVersion {
  return {
    id: row.id,
    effectiveFromMonth: row.effective_from_month.slice(0, 7) as MonthId,
    dailyAmountCents: assertCents(row.daily_amount_cents),
    accountId: row.account_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listDailyBudgetVersions(client: SupabaseClient = createSupabaseAdminClient()) {
  const { data, error } = await client
    .from("daily_budget_versions")
    .select(DAILY_BUDGET_VERSION_SELECT)
    .order("effective_from_month", { ascending: false });

  if (error) {
    throw new Error(`Não foi possível carregar a configuração Day to day: ${error.message}`);
  }

  return ((data ?? []) as DailyBudgetVersionRow[]).map(mapDailyBudgetVersion);
}

export async function listDailyBudgetVersionsUntil(
  month: MonthId,
  client: SupabaseClient = createSupabaseAdminClient(),
) {
  const { data, error } = await client
    .from("daily_budget_versions")
    .select(DAILY_BUDGET_VERSION_SELECT)
    .gte("effective_from_month", toMonthStartDate(FIRST_MONTH as MonthId))
    .lte("effective_from_month", toMonthStartDate(month))
    .order("effective_from_month", { ascending: false });

  if (error) {
    throw new Error(`Não foi possível carregar a configuração Day to day: ${error.message}`);
  }

  return ((data ?? []) as DailyBudgetVersionRow[]).map(mapDailyBudgetVersion);
}

export async function saveDailyBudgetVersion(input: DailyBudgetVersionInput) {
  validateDailyBudgetVersionInput(input);
  const client = createSupabaseAdminClient();
  const accounts = await listManagedAccounts(client);
  const account = accounts.find((candidate) => candidate.id === input.accountId);

  if (!account) {
    throw new Error("Indique uma conta.");
  }

  if (account.archivedFromMonth || !isActiveInMonth(account, input.effectiveFromMonth)) {
    throw new Error("A conta seleccionada já não está activa.");
  }

  const { data, error } = await client
    .from("daily_budget_versions")
    .upsert(
      {
        effective_from_month: toMonthStartDate(input.effectiveFromMonth),
        daily_amount_cents: input.dailyAmountCents,
        account_id: input.accountId,
      },
      { onConflict: "effective_from_month" },
    )
    .select(DAILY_BUDGET_VERSION_SELECT)
    .single();

  if (error) {
    throw new Error(`Não foi possível guardar a configuração Day to day: ${error.message}`);
  }

  return mapDailyBudgetVersion(data as DailyBudgetVersionRow);
}
