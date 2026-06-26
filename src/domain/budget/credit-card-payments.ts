import {
  getAccountDisplayName,
  isActiveInMonth,
  type LiquidityAccount,
} from "./accounts";
import { assertCents, sumCents, type Cents } from "./money";
import type { MonthId } from "./months";
import type { MonthlyAccountSnapshot } from "./monthly-view";

export const PAYMENT_ACCOUNT_MISSING_MESSAGE = "Defina a conta de pagamento deste cartão na tab Contas.";
export const PAYMENT_ACCOUNT_SELF_MESSAGE = "A conta de pagamento não pode ser o próprio cartão.";

export type CreditCardStatementOverride = {
  id?: string;
  creditCardAccountId: string;
  month: MonthId;
  statementAmountCents: Cents;
  createdAt?: string;
  updatedAt?: string;
};

export type MonthlyCreditCardPayment = {
  month: MonthId;
  creditCardAccountId: string;
  creditCardName: string;
  paymentAccountId?: string;
  paymentAccountName?: string;
  currentBalanceCents: Cents;
  automaticPaymentCents: Cents;
  overrideAmountCents?: Cents;
  paymentAmountCents: Cents;
  usesOverride: boolean;
  warning?: string;
};

export function validateCreditCardStatementOverrideAmount(amountCents: Cents) {
  if (amountCents < 0) {
    throw new Error("O valor do extracto não pode ser negativo.");
  }

  assertCents(amountCents);
}

export function calculateAutomaticCreditCardPayment(currentBalanceCents: Cents) {
  return currentBalanceCents < 0 ? assertCents(Math.abs(currentBalanceCents)) : 0;
}

export function creditCardStatementOverrideKey(cardAccountId: string, month: MonthId) {
  return `${cardAccountId}:${month}`;
}

export function buildCreditCardStatementOverrideMap(
  overrides: readonly CreditCardStatementOverride[],
) {
  return new Map(
    overrides.map((override) => [
      creditCardStatementOverrideKey(override.creditCardAccountId, override.month),
      override,
    ]),
  );
}

export function buildMonthlyCreditCardPayments({
  accounts,
  snapshots,
  month,
  overrides = [],
}: {
  accounts: readonly LiquidityAccount[];
  snapshots: readonly MonthlyAccountSnapshot[];
  month: MonthId;
  overrides?: readonly CreditCardStatementOverride[];
}): MonthlyCreditCardPayment[] {
  const activeAccounts = accounts.filter((account) => isActiveInMonth(account, month));
  const accountById = new Map(activeAccounts.map((account) => [account.id, account]));
  const snapshotByAccountId = new Map(snapshots.map((snapshot) => [snapshot.accountId, snapshot]));
  const overrideByCardMonth = buildCreditCardStatementOverrideMap(overrides);

  return activeAccounts
    .filter((account) => account.isCreditCard)
    .map((card): MonthlyCreditCardPayment => {
      const snapshot = snapshotByAccountId.get(card.id);
      const currentBalanceCents = snapshot?.currentBalanceCents ?? 0;
      const automaticPaymentCents = calculateAutomaticCreditCardPayment(currentBalanceCents);
      const override = overrideByCardMonth.get(creditCardStatementOverrideKey(card.id, month));
      const paymentAccountId = card.linkedPaymentAccountId;
      const paymentAccount = paymentAccountId ? accountById.get(paymentAccountId) : undefined;
      const warning =
        !paymentAccountId || !paymentAccount
          ? PAYMENT_ACCOUNT_MISSING_MESSAGE
          : paymentAccountId === card.id
            ? PAYMENT_ACCOUNT_SELF_MESSAGE
            : undefined;
      const paymentAmountCents = warning
        ? 0
        : override
          ? override.statementAmountCents
          : automaticPaymentCents;

      return {
        month,
        creditCardAccountId: card.id,
        creditCardName: getAccountDisplayName(card),
        paymentAccountId,
        paymentAccountName: paymentAccount ? getAccountDisplayName(paymentAccount) : undefined,
        currentBalanceCents,
        automaticPaymentCents,
        overrideAmountCents: override?.statementAmountCents,
        paymentAmountCents,
        usesOverride: Boolean(override),
        warning,
      };
    });
}

export function buildCreditCardPaymentAmountMap(payments: readonly MonthlyCreditCardPayment[]) {
  const amountsByAccount = new Map<string, Cents>();

  for (const payment of payments) {
    if (payment.warning || !payment.paymentAccountId || payment.paymentAmountCents === 0) {
      continue;
    }

    const currentPaymentAccountAmount = amountsByAccount.get(payment.paymentAccountId) ?? 0;
    const currentCardAmount = amountsByAccount.get(payment.creditCardAccountId) ?? 0;

    amountsByAccount.set(
      payment.paymentAccountId,
      sumCents([currentPaymentAccountAmount, -payment.paymentAmountCents]),
    );
    amountsByAccount.set(
      payment.creditCardAccountId,
      sumCents([currentCardAmount, payment.paymentAmountCents]),
    );
  }

  return amountsByAccount;
}
