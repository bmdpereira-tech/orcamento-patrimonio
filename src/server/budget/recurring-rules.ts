import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { assertCents } from "@/domain/budget/money";
import { FIRST_MONTH, getMonthIdForDate, toMonthStartDate, type MonthId } from "@/domain/budget/months";
import {
  canDeleteRecurringRule,
  validateRecurringRuleAccountSelection,
  validateRecurringRuleInput,
  type RecurringRule,
  type RecurringRuleFrequency,
  type RecurringRuleInput,
  type RecurringRuleMonthState,
} from "@/domain/budget/recurring-rules";
import { createSupabaseAdminClient } from "@/server/supabase/client";
import { listManagedAccounts } from "./accounts";

type RecurringRuleRow = {
  id: string;
  description: string;
  amount_cents: number;
  account_id: string;
  frequency: RecurringRuleFrequency;
  start_month: string;
  end_month: string | null;
  active: boolean;
  charge_day: number;
  archived_at: string | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

type RecurringRuleMonthStateRow = {
  id: string;
  recurring_rule_id: string;
  month_start: string;
  excluded_from_forecast: boolean;
  created_at?: string;
  updated_at?: string;
};

const RECURRING_RULE_SELECT =
  "id,description,amount_cents,account_id,frequency,start_month,end_month,active,charge_day,archived_at,sort_order,created_at,updated_at";
const RECURRING_RULE_MONTH_STATE_SELECT =
  "id,recurring_rule_id,month_start,excluded_from_forecast,created_at,updated_at";

function mapRecurringRule(row: RecurringRuleRow): RecurringRule {
  return {
    id: row.id,
    description: row.description,
    accountId: row.account_id,
    amountCents: assertCents(row.amount_cents),
    chargeDay: row.charge_day,
    frequency: row.frequency,
    startMonth: row.start_month.slice(0, 7) as MonthId,
    endMonth: row.end_month ? (row.end_month.slice(0, 7) as MonthId) : undefined,
    active: row.active,
    archivedAt: row.archived_at ?? undefined,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRecurringRuleMonthState(row: RecurringRuleMonthStateRow): RecurringRuleMonthState {
  return {
    id: row.id,
    recurringRuleId: row.recurring_rule_id,
    month: row.month_start.slice(0, 7) as MonthId,
    excludedFromForecast: row.excluded_from_forecast,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sortRecurringRules(rules: readonly RecurringRule[]) {
  return [...rules].sort((left, right) => {
    const archivedWeight = Number(Boolean(left.archivedAt)) - Number(Boolean(right.archivedAt));

    return (
      archivedWeight ||
      left.sortOrder - right.sortOrder ||
      left.description.localeCompare(right.description)
    );
  });
}

function toRecurringRulePayload(input: RecurringRuleInput) {
  validateRecurringRuleInput(input);

  return {
    description: input.description.trim(),
    account_id: input.accountId,
    amount_cents: input.amountCents,
    charge_day: input.chargeDay,
    frequency: input.frequency ?? "monthly",
    start_month: toMonthStartDate(input.startMonth),
    end_month: input.endMonth ? toMonthStartDate(input.endMonth) : null,
    active: input.active,
    sort_order: input.sortOrder,
  };
}

async function validateRuleAccount(
  client: SupabaseClient,
  accountId: string,
  previousAccountId?: string,
) {
  const accounts = await listManagedAccounts(client);
  validateRecurringRuleAccountSelection({ accounts, accountId, previousAccountId });
}

export async function listRecurringRules(client: SupabaseClient = createSupabaseAdminClient()) {
  const { data, error } = await client
    .from("recurring_rules")
    .select(RECURRING_RULE_SELECT)
    .order("sort_order")
    .order("description");

  if (error) {
    throw new Error(`Não foi possível carregar os débitos directos: ${error.message}`);
  }

  return sortRecurringRules(((data ?? []) as RecurringRuleRow[]).map(mapRecurringRule));
}

export async function createRecurringRule(input: RecurringRuleInput) {
  const client = createSupabaseAdminClient();
  await validateRuleAccount(client, input.accountId);

  const { data, error } = await client
    .from("recurring_rules")
    .insert(toRecurringRulePayload(input))
    .select(RECURRING_RULE_SELECT)
    .single();

  if (error) {
    throw new Error(`Não foi possível criar o débito directo: ${error.message}`);
  }

  return mapRecurringRule(data as RecurringRuleRow);
}

export async function updateRecurringRule(input: RecurringRuleInput & { id: string }) {
  const client = createSupabaseAdminClient();
  const existingRule = await getRecurringRuleById(client, input.id);
  await validateRuleAccount(client, input.accountId, existingRule.accountId);

  const { data, error } = await client
    .from("recurring_rules")
    .update(toRecurringRulePayload(input))
    .eq("id", input.id)
    .select(RECURRING_RULE_SELECT)
    .single();

  if (error) {
    throw new Error(`Não foi possível actualizar o débito directo: ${error.message}`);
  }

  return mapRecurringRule(data as RecurringRuleRow);
}

export async function setRecurringRuleActive(id: string, active: boolean) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("recurring_rules")
    .update({ active })
    .eq("id", id)
    .select(RECURRING_RULE_SELECT)
    .single();

  if (error) {
    throw new Error(`Não foi possível alterar o estado do débito directo: ${error.message}`);
  }

  return mapRecurringRule(data as RecurringRuleRow);
}

export async function archiveRecurringRule(id: string) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("recurring_rules")
    .update({ active: false, archived_at: new Date().toISOString() })
    .eq("id", id)
    .select(RECURRING_RULE_SELECT)
    .single();

  if (error) {
    throw new Error(`Não foi possível arquivar o débito directo: ${error.message}`);
  }

  return mapRecurringRule(data as RecurringRuleRow);
}

export async function reactivateRecurringRule(id: string) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("recurring_rules")
    .update({ active: true, archived_at: null })
    .eq("id", id)
    .select(RECURRING_RULE_SELECT)
    .single();

  if (error) {
    throw new Error(`Não foi possível reactivar o débito directo: ${error.message}`);
  }

  return mapRecurringRule(data as RecurringRuleRow);
}

export async function listRecurringRuleMonthStatesUntil(
  month: MonthId,
  client: SupabaseClient = createSupabaseAdminClient(),
) {
  const { data, error } = await client
    .from("recurring_rule_month_states")
    .select(RECURRING_RULE_MONTH_STATE_SELECT)
    .gte("month_start", toMonthStartDate(FIRST_MONTH as MonthId))
    .lte("month_start", toMonthStartDate(month));

  if (error) {
    throw new Error(`Não foi possível carregar os estados mensais dos débitos directos: ${error.message}`);
  }

  return ((data ?? []) as RecurringRuleMonthStateRow[]).map(mapRecurringRuleMonthState);
}

export async function setRecurringRuleMonthExcluded({
  recurringRuleId,
  month,
  excludedFromForecast,
}: {
  recurringRuleId: string;
  month: MonthId;
  excludedFromForecast: boolean;
}) {
  const client = createSupabaseAdminClient();
  const monthStart = toMonthStartDate(month);

  if (!excludedFromForecast) {
    const { error } = await client
      .from("recurring_rule_month_states")
      .delete()
      .eq("recurring_rule_id", recurringRuleId)
      .eq("month_start", monthStart);

    if (error) {
      throw new Error(`Não foi possível actualizar a previsão do débito directo: ${error.message}`);
    }

    return { recurringRuleId, month, excludedFromForecast: false };
  }

  const { data, error } = await client
    .from("recurring_rule_month_states")
    .upsert(
      {
        recurring_rule_id: recurringRuleId,
        month_start: monthStart,
        excluded_from_forecast: true,
      },
      { onConflict: "recurring_rule_id,month_start" },
    )
    .select(RECURRING_RULE_MONTH_STATE_SELECT)
    .single();

  if (error) {
    throw new Error(`Não foi possível actualizar a previsão do débito directo: ${error.message}`);
  }

  return mapRecurringRuleMonthState(data as RecurringRuleMonthStateRow);
}

async function getRecurringRuleById(client: SupabaseClient, id: string) {
  const { data, error } = await client
    .from("recurring_rules")
    .select(RECURRING_RULE_SELECT)
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(`Não foi possível encontrar o débito directo: ${error.message}`);
  }

  return mapRecurringRule(data as RecurringRuleRow);
}

async function recurringRuleHasOccurrenceOverrides(client: SupabaseClient, id: string) {
  const { count, error } = await client
    .from("recurring_occurrence_overrides")
    .select("id", { count: "exact", head: true })
    .eq("recurring_rule_id", id);

  if (error) {
    throw new Error(`Não foi possível verificar excepções do débito directo: ${error.message}`);
  }

  return (count ?? 0) > 0;
}

async function deleteRecurringRuleMonthStates(client: SupabaseClient, id: string) {
  const { error } = await client
    .from("recurring_rule_month_states")
    .delete()
    .eq("recurring_rule_id", id);

  if (error) {
    throw new Error(`Não foi possível eliminar os estados mensais do débito directo: ${error.message}`);
  }
}

export async function deleteRecurringRuleWhenAllowed(
  id: string,
  referenceMonth: MonthId = getMonthIdForDate(),
) {
  const client = createSupabaseAdminClient();
  const [rule, hasOccurrenceOverrides] = await Promise.all([
    getRecurringRuleById(client, id),
    recurringRuleHasOccurrenceOverrides(client, id),
  ]);
  const permission = canDeleteRecurringRule({ rule, referenceMonth, hasOccurrenceOverrides });

  if (!permission.allowed) {
    return { deleted: false, reason: permission.reason };
  }

  await deleteRecurringRuleMonthStates(client, id);

  const { data, error } = await client.from("recurring_rules").delete().eq("id", id).select("id").single();

  if (error) {
    throw new Error(`Não foi possível eliminar o débito directo: ${error.message}`);
  }

  if (!(data as { id?: string } | null)?.id) {
    throw new Error("Não foi possível confirmar a eliminação do débito directo.");
  }

  return { deleted: true, reason: null };
}
