import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isActiveInMonth } from "@/domain/budget/accounts";
import {
  PAYMENT_ACCOUNT_MISSING_MESSAGE,
  PAYMENT_ACCOUNT_SELF_MESSAGE,
  validateCreditCardStatementOverrideAmount,
  type CreditCardStatementOverride,
} from "@/domain/budget/credit-card-payments";
import { assertCents, type Cents } from "@/domain/budget/money";
import { FIRST_MONTH, toMonthStartDate, type MonthId } from "@/domain/budget/months";
import { createSupabaseAdminClient } from "@/server/supabase/client";
import { listManagedAccounts } from "./accounts";

type CreditCardStatementOverrideRow = {
  id: string;
  credit_card_account_id: string;
  month: string;
  statement_amount_cents: number;
  created_at?: string;
  updated_at?: string;
};

const CREDIT_CARD_STATEMENT_OVERRIDE_SELECT =
  "id,credit_card_account_id,month,statement_amount_cents,created_at,updated_at";

function mapCreditCardStatementOverride(row: CreditCardStatementOverrideRow): CreditCardStatementOverride {
  return {
    id: row.id,
    creditCardAccountId: row.credit_card_account_id,
    month: row.month.slice(0, 7) as MonthId,
    statementAmountCents: assertCents(row.statement_amount_cents),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function validateCreditCardPaymentAccount(
  client: SupabaseClient,
  creditCardAccountId: string,
  month: MonthId,
) {
  const accounts = await listManagedAccounts(client);
  const card = accounts.find((account) => account.id === creditCardAccountId);

  if (!card || !card.isCreditCard) {
    throw new Error("Cartão inválido.");
  }

  if (!isActiveInMonth(card, month) || card.showInBudget === false) {
    throw new Error("Cartão inválido.");
  }

  if (!card.linkedPaymentAccountId) {
    throw new Error(PAYMENT_ACCOUNT_MISSING_MESSAGE);
  }

  if (card.linkedPaymentAccountId === card.id) {
    throw new Error(PAYMENT_ACCOUNT_SELF_MESSAGE);
  }

  const paymentAccount = accounts.find((account) => account.id === card.linkedPaymentAccountId);

  if (!paymentAccount || !isActiveInMonth(paymentAccount, month) || paymentAccount.showInBudget === false) {
    throw new Error(PAYMENT_ACCOUNT_MISSING_MESSAGE);
  }

  return card;
}

export async function listCreditCardStatementOverridesUntil(
  month: MonthId,
  client: SupabaseClient = createSupabaseAdminClient(),
) {
  const { data, error } = await client
    .from("credit_card_statement_overrides")
    .select(CREDIT_CARD_STATEMENT_OVERRIDE_SELECT)
    .gte("month", toMonthStartDate(FIRST_MONTH as MonthId))
    .lte("month", toMonthStartDate(month));

  if (error) {
    throw new Error(`Não foi possível carregar os extractos dos cartões: ${error.message}`);
  }

  return ((data ?? []) as CreditCardStatementOverrideRow[]).map(mapCreditCardStatementOverride);
}

export async function setCreditCardStatementOverride({
  creditCardAccountId,
  month,
  statementAmountCents,
}: {
  creditCardAccountId: string;
  month: MonthId;
  statementAmountCents: Cents;
}) {
  validateCreditCardStatementOverrideAmount(statementAmountCents);
  const client = createSupabaseAdminClient();
  await validateCreditCardPaymentAccount(client, creditCardAccountId, month);

  const { data, error } = await client
    .from("credit_card_statement_overrides")
    .upsert(
      {
        credit_card_account_id: creditCardAccountId,
        month: toMonthStartDate(month),
        statement_amount_cents: statementAmountCents,
      },
      { onConflict: "credit_card_account_id,month" },
    )
    .select(CREDIT_CARD_STATEMENT_OVERRIDE_SELECT)
    .single();

  if (error) {
    throw new Error(`Não foi possível guardar o valor do extracto: ${error.message}`);
  }

  return mapCreditCardStatementOverride(data as CreditCardStatementOverrideRow);
}

export async function clearCreditCardStatementOverride({
  creditCardAccountId,
  month,
}: {
  creditCardAccountId: string;
  month: MonthId;
}) {
  const client = createSupabaseAdminClient();
  await validateCreditCardPaymentAccount(client, creditCardAccountId, month);

  const { error } = await client
    .from("credit_card_statement_overrides")
    .delete()
    .eq("credit_card_account_id", creditCardAccountId)
    .eq("month", toMonthStartDate(month));

  if (error) {
    throw new Error(`Não foi possível repor o valor automático: ${error.message}`);
  }
}
