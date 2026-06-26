import { describe, expect, it } from "vitest";
import type { LiquidityAccount } from "./accounts";
import {
  buildCreditCardPaymentAmountMap,
  buildMonthlyCreditCardPayments,
  calculateAutomaticCreditCardPayment,
  PAYMENT_ACCOUNT_MISSING_MESSAGE,
  PAYMENT_ACCOUNT_SELF_MESSAGE,
  validateCreditCardStatementOverrideAmount,
} from "./credit-card-payments";
import { createEmptySnapshot, type MonthlyAccountSnapshot } from "./monthly-view";

const paymentAccount: LiquidityAccount = {
  id: "santander",
  name: "Santander",
  shortName: "Santander",
  accountType: "bank_account",
  isCreditCard: false,
  startMonth: "2026-07",
  showInBudget: true,
  includeInNetWorth: true,
  sortOrder: 10,
};
const secondPaymentAccount: LiquidityAccount = {
  id: "activobank",
  name: "ActivoBank",
  shortName: "ActivoBank",
  accountType: "bank_account",
  isCreditCard: false,
  startMonth: "2026-07",
  showInBudget: true,
  includeInNetWorth: true,
  sortOrder: 20,
};
const cardAccount: LiquidityAccount = {
  id: "cc-santander",
  name: "CC Santander",
  shortName: "CC Santander",
  accountType: "credit_card",
  isCreditCard: true,
  linkedPaymentAccountId: "santander",
  startMonth: "2026-07",
  showInBudget: true,
  includeInNetWorth: true,
  sortOrder: 30,
};
const secondCardAccount: LiquidityAccount = {
  id: "cc-activobank",
  name: "CC ActivoBank",
  shortName: "CC ActivoBank",
  accountType: "credit_card",
  isCreditCard: true,
  linkedPaymentAccountId: "activobank",
  startMonth: "2026-07",
  showInBudget: true,
  includeInNetWorth: true,
  sortOrder: 40,
};

function snapshot(accountId: string, currentBalanceCents: number): MonthlyAccountSnapshot {
  return {
    ...createEmptySnapshot(accountId),
    currentBalanceCents,
    directDebitsCents: -999_00,
    dayToDayCents: -888_00,
    manualForecastsCents: -777_00,
  };
}

describe("credit card payment calculations", () => {
  it("calculates the automatic payment from the current card debt only", () => {
    expect(calculateAutomaticCreditCardPayment(-125_00)).toBe(125_00);
    expect(calculateAutomaticCreditCardPayment(0)).toBe(0);
    expect(calculateAutomaticCreditCardPayment(42_00)).toBe(0);
  });

  it("distributes an automatic card payment as a zero-sum transfer", () => {
    const payments = buildMonthlyCreditCardPayments({
      accounts: [paymentAccount, cardAccount],
      snapshots: [snapshot("santander", 1_000_00), snapshot("cc-santander", -125_00)],
      month: "2026-07",
    });
    const amounts = buildCreditCardPaymentAmountMap(payments);

    expect(payments[0]?.paymentAmountCents).toBe(125_00);
    expect(amounts.get("santander")).toBe(-125_00);
    expect(amounts.get("cc-santander")).toBe(125_00);
    expect([...amounts.values()].reduce((total, amount) => total + amount, 0)).toBe(0);
  });

  it("sums multiple cards paid by the same account", () => {
    const anotherCard = { ...secondCardAccount, id: "cc-extra", linkedPaymentAccountId: "santander" };
    const payments = buildMonthlyCreditCardPayments({
      accounts: [paymentAccount, cardAccount, anotherCard],
      snapshots: [
        snapshot("santander", 1_000_00),
        snapshot("cc-santander", -125_00),
        snapshot("cc-extra", -50_00),
      ],
      month: "2026-07",
    });
    const amounts = buildCreditCardPaymentAmountMap(payments);

    expect(amounts.get("santander")).toBe(-175_00);
    expect(amounts.get("cc-santander")).toBe(125_00);
    expect(amounts.get("cc-extra")).toBe(50_00);
  });

  it("keeps payments isolated by linked payment account", () => {
    const payments = buildMonthlyCreditCardPayments({
      accounts: [paymentAccount, secondPaymentAccount, cardAccount, secondCardAccount],
      snapshots: [
        snapshot("santander", 1_000_00),
        snapshot("activobank", 500_00),
        snapshot("cc-santander", -125_00),
        snapshot("cc-activobank", -50_00),
      ],
      month: "2026-07",
    });
    const amounts = buildCreditCardPaymentAmountMap(payments);

    expect(amounts.get("santander")).toBe(-125_00);
    expect(amounts.get("activobank")).toBe(-50_00);
    expect(amounts.get("cc-santander")).toBe(125_00);
    expect(amounts.get("cc-activobank")).toBe(50_00);
  });

  it("does not calculate silently when the payment account is missing", () => {
    const payments = buildMonthlyCreditCardPayments({
      accounts: [paymentAccount, { ...cardAccount, linkedPaymentAccountId: undefined }],
      snapshots: [snapshot("cc-santander", -125_00)],
      month: "2026-07",
    });
    const amounts = buildCreditCardPaymentAmountMap(payments);

    expect(payments[0]?.warning).toBe(PAYMENT_ACCOUNT_MISSING_MESSAGE);
    expect(payments[0]?.paymentAmountCents).toBe(0);
    expect(amounts.size).toBe(0);
  });

  it("does not calculate when the payment account is the same card", () => {
    const selfPaidCard = { ...cardAccount, linkedPaymentAccountId: "cc-santander" };
    const payments = buildMonthlyCreditCardPayments({
      accounts: [paymentAccount, selfPaidCard],
      snapshots: [snapshot("cc-santander", -125_00)],
      month: "2026-07",
    });

    expect(payments[0]?.warning).toBe(PAYMENT_ACCOUNT_SELF_MESSAGE);
    expect(buildCreditCardPaymentAmountMap(payments).size).toBe(0);
  });

  it("uses positive and zero statement overrides instead of the automatic value", () => {
    const positiveOverride = buildMonthlyCreditCardPayments({
      accounts: [paymentAccount, cardAccount],
      snapshots: [snapshot("cc-santander", -125_00)],
      month: "2026-07",
      overrides: [
        { creditCardAccountId: "cc-santander", month: "2026-07", statementAmountCents: 80_00 },
      ],
    });
    const zeroOverride = buildMonthlyCreditCardPayments({
      accounts: [paymentAccount, cardAccount],
      snapshots: [snapshot("cc-santander", -125_00)],
      month: "2026-07",
      overrides: [
        { creditCardAccountId: "cc-santander", month: "2026-07", statementAmountCents: 0 },
      ],
    });

    expect(positiveOverride[0]?.usesOverride).toBe(true);
    expect(positiveOverride[0]?.paymentAmountCents).toBe(80_00);
    expect(zeroOverride[0]?.usesOverride).toBe(true);
    expect(zeroOverride[0]?.paymentAmountCents).toBe(0);
  });

  it("falls back to automatic when an override is absent or from another month", () => {
    const payments = buildMonthlyCreditCardPayments({
      accounts: [paymentAccount, cardAccount],
      snapshots: [snapshot("cc-santander", -125_00)],
      month: "2026-07",
      overrides: [
        { creditCardAccountId: "cc-santander", month: "2026-08", statementAmountCents: 80_00 },
      ],
    });

    expect(payments[0]?.usesOverride).toBe(false);
    expect(payments[0]?.paymentAmountCents).toBe(125_00);
  });

  it("ignores forecast fields when calculating the automatic statement payment", () => {
    const [payment] = buildMonthlyCreditCardPayments({
      accounts: [paymentAccount, cardAccount],
      snapshots: [snapshot("cc-santander", -125_00)],
      month: "2026-07",
    });

    expect(payment?.automaticPaymentCents).toBe(125_00);
  });

  it("rejects negative overrides", () => {
    expect(() => validateCreditCardStatementOverrideAmount(-1)).toThrow(
      "O valor do extracto não pode ser negativo.",
    );
  });
});
