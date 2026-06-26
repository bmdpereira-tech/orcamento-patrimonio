import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isActiveInMonth } from "@/domain/budget/accounts";
import { assertCents } from "@/domain/budget/money";
import { FIRST_MONTH, toMonthStartDate, type MonthId } from "@/domain/budget/months";
import {
  validateSalaryVersionInput,
  type SalaryMonthOverride,
  type SalaryStatus,
  type SalaryVersion,
  type SalaryVersionInput,
} from "@/domain/budget/salary";
import { createSupabaseAdminClient } from "@/server/supabase/client";
import { listManagedAccounts } from "./accounts";

type SalaryVersionRow = {
  id: string;
  effective_from_month: string;
  amount_cents: number;
  account_id: string;
  vacation_bonus_cents: number;
  vacation_bonus_month: number;
  christmas_bonus_cents: number;
  christmas_bonus_month: number;
  created_at?: string;
  updated_at?: string;
};

type SalaryMonthOverrideRow = {
  id: string;
  month: string;
  status: SalaryStatus | null;
  created_at?: string;
  updated_at?: string;
};

export type SalaryMonthStateInput = {
  month: MonthId;
  reflectedInCurrentBalance: boolean;
};

const SALARY_VERSION_SELECT =
  "id,effective_from_month,amount_cents,account_id,vacation_bonus_cents,vacation_bonus_month,christmas_bonus_cents,christmas_bonus_month,created_at,updated_at";
const SALARY_MONTH_OVERRIDE_SELECT = "id,month,status,created_at,updated_at";

function mapSalaryVersion(row: SalaryVersionRow): SalaryVersion {
  return {
    id: row.id,
    effectiveFromMonth: row.effective_from_month.slice(0, 7) as MonthId,
    amountCents: assertCents(row.amount_cents),
    accountId: row.account_id,
    vacationBonusCents: assertCents(row.vacation_bonus_cents),
    vacationBonusMonth: row.vacation_bonus_month,
    christmasBonusCents: assertCents(row.christmas_bonus_cents),
    christmasBonusMonth: row.christmas_bonus_month,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSalaryMonthOverride(row: SalaryMonthOverrideRow): SalaryMonthOverride {
  return {
    id: row.id,
    month: row.month.slice(0, 7) as MonthId,
    status: row.status ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSalaryVersions(client: SupabaseClient = createSupabaseAdminClient()) {
  const { data, error } = await client
    .from("salary_versions")
    .select(SALARY_VERSION_SELECT)
    .order("effective_from_month", { ascending: false });

  if (error) {
    throw new Error(`Não foi possível carregar a configuração de salário: ${error.message}`);
  }

  return ((data ?? []) as SalaryVersionRow[]).map(mapSalaryVersion);
}

export async function listSalaryVersionsUntil(
  month: MonthId,
  client: SupabaseClient = createSupabaseAdminClient(),
) {
  const { data, error } = await client
    .from("salary_versions")
    .select(SALARY_VERSION_SELECT)
    .gte("effective_from_month", toMonthStartDate(FIRST_MONTH as MonthId))
    .lte("effective_from_month", toMonthStartDate(month))
    .order("effective_from_month", { ascending: false });

  if (error) {
    throw new Error(`Não foi possível carregar a configuração de salário: ${error.message}`);
  }

  return ((data ?? []) as SalaryVersionRow[]).map(mapSalaryVersion);
}

export async function listSalaryMonthOverridesUntil(
  month: MonthId,
  client: SupabaseClient = createSupabaseAdminClient(),
) {
  const { data, error } = await client
    .from("salary_month_overrides")
    .select(SALARY_MONTH_OVERRIDE_SELECT)
    .gte("month", toMonthStartDate(FIRST_MONTH as MonthId))
    .lte("month", toMonthStartDate(month));

  if (error) {
    throw new Error(`Não foi possível carregar os ajustes mensais de salário: ${error.message}`);
  }

  return ((data ?? []) as SalaryMonthOverrideRow[]).map(mapSalaryMonthOverride);
}

export async function saveSalaryVersion(input: SalaryVersionInput) {
  validateSalaryVersionInput(input);
  const client = createSupabaseAdminClient();
  const accounts = await listManagedAccounts(client);
  const account = accounts.find((candidate) => candidate.id === input.accountId);

  if (!account) {
    throw new Error("Indique a conta de recebimento.");
  }

  if (account.isCreditCard) {
    throw new Error("A conta de recebimento não pode ser um cartão de crédito.");
  }

  if (account.archivedFromMonth || !isActiveInMonth(account, input.effectiveFromMonth) || account.showInBudget === false) {
    throw new Error("A conta de recebimento seleccionada já não está activa.");
  }

  const { data, error } = await client
    .from("salary_versions")
    .upsert(
      {
        effective_from_month: toMonthStartDate(input.effectiveFromMonth),
        amount_cents: input.amountCents,
        account_id: input.accountId,
        vacation_bonus_cents: input.vacationBonusCents,
        vacation_bonus_month: input.vacationBonusMonth,
        christmas_bonus_cents: input.christmasBonusCents,
        christmas_bonus_month: input.christmasBonusMonth,
      },
      { onConflict: "effective_from_month" },
    )
    .select(SALARY_VERSION_SELECT)
    .single();

  if (error) {
    throw new Error(`Não foi possível guardar a configuração de salário: ${error.message}`);
  }

  return mapSalaryVersion(data as SalaryVersionRow);
}

export async function saveSalaryMonthState(input: SalaryMonthStateInput) {
  const client = createSupabaseAdminClient();
  const status: SalaryStatus = input.reflectedInCurrentBalance ? "received" : "planned";

  if (status === "planned") {
    const { error } = await client
      .from("salary_month_overrides")
      .delete()
      .eq("month", toMonthStartDate(input.month));

    if (error) {
      throw new Error(`Não foi possível limpar o ajuste mensal de salário: ${error.message}`);
    }

    return {
      month: input.month,
      status,
      reflectedInCurrentBalance: false,
    };
  }

  const { data, error } = await client
    .from("salary_month_overrides")
    .upsert(
      {
        month: toMonthStartDate(input.month),
        amount_cents: null,
        account_id: null,
        status,
      },
      { onConflict: "month" },
    )
    .select(SALARY_MONTH_OVERRIDE_SELECT)
    .single();

  if (error) {
    throw new Error(`Não foi possível guardar o ajuste mensal de salário: ${error.message}`);
  }

  const override = mapSalaryMonthOverride(data as SalaryMonthOverrideRow);

  return {
    ...override,
    reflectedInCurrentBalance: override.status === "received" || override.status === "cancelled",
  };
}
