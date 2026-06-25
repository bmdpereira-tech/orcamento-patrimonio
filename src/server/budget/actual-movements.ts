import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normaliseActualMovementInput,
  type ActualMovement,
  type ActualMovementInput,
  type ActualMovementType,
} from "@/domain/budget/actual-movements";
import { assertCents } from "@/domain/budget/money";
import { addMonths, FIRST_MONTH, toMonthStartDate, type MonthId } from "@/domain/budget/months";
import { createSupabaseAdminClient } from "@/server/supabase/client";

type ActualMovementRow = {
  id: string;
  account_id: string;
  movement_date: string;
  description: string;
  amount_cents: number;
  movement_type: ActualMovementType;
  created_at: string;
  updated_at: string;
};

export type ActualMovementFilters = {
  month: MonthId;
  accountId?: string;
};

function mapActualMovement(row: ActualMovementRow): ActualMovement {
  return {
    id: row.id,
    accountId: row.account_id,
    movementDate: row.movement_date,
    description: row.description,
    amountCents: assertCents(row.amount_cents),
    movementType: row.movement_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toActualMovementPayload(input: ActualMovementInput) {
  const movement = normaliseActualMovementInput(input);

  return {
    account_id: movement.accountId,
    movement_date: movement.movementDate,
    description: movement.description,
    amount_cents: movement.amountCents,
    movement_type: movement.movementType,
  };
}

function applyMovementFilters(
  client: SupabaseClient,
  filters: ActualMovementFilters,
) {
  const startDate = toMonthStartDate(filters.month);
  const nextMonthStartDate = toMonthStartDate(addMonths(filters.month, 1));
  let query = client
    .from("actual_movements")
    .select("id,account_id,movement_date,description,amount_cents,movement_type,created_at,updated_at")
    .gte("movement_date", startDate)
    .lt("movement_date", nextMonthStartDate)
    .order("movement_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.accountId) {
    query = query.eq("account_id", filters.accountId);
  }

  return query;
}

export async function listActualMovements(
  filters: ActualMovementFilters,
  client: SupabaseClient = createSupabaseAdminClient(),
) {
  const { data, error } = await applyMovementFilters(client, filters);

  if (error) {
    throw new Error(`Não foi possível carregar os movimentos: ${error.message}`);
  }

  return ((data ?? []) as ActualMovementRow[]).map(mapActualMovement);
}

export async function listActualMovementsUntilMonth(
  month: MonthId,
  client: SupabaseClient = createSupabaseAdminClient(),
) {
  const { data, error } = await client
    .from("actual_movements")
    .select("id,account_id,movement_date,description,amount_cents,movement_type,created_at,updated_at")
    .gte("movement_date", toMonthStartDate(FIRST_MONTH))
    .lt("movement_date", toMonthStartDate(addMonths(month, 1)));

  if (error) {
    throw new Error(`Não foi possível carregar os movimentos realizados: ${error.message}`);
  }

  return ((data ?? []) as ActualMovementRow[]).map(mapActualMovement);
}

export async function createActualMovement(input: ActualMovementInput) {
  const client = createSupabaseAdminClient();
  const { error } = await client.from("actual_movements").insert(toActualMovementPayload(input));

  if (error) {
    throw new Error(`Não foi possível criar o movimento: ${error.message}`);
  }
}

export async function updateActualMovement(id: string, input: ActualMovementInput) {
  const client = createSupabaseAdminClient();
  const { error } = await client.from("actual_movements").update(toActualMovementPayload(input)).eq("id", id);

  if (error) {
    throw new Error(`Não foi possível actualizar o movimento: ${error.message}`);
  }
}

export async function deleteActualMovement(id: string) {
  const client = createSupabaseAdminClient();
  const { error } = await client.from("actual_movements").delete().eq("id", id);

  if (error) {
    throw new Error(`Não foi possível eliminar o movimento: ${error.message}`);
  }
}
