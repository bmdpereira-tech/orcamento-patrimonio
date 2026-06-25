import type { Cents } from "./money";
import type { MonthId } from "./months";

export type LiquidityAccount = {
  id: string;
  name: string;
  shortName?: string;
  accountType?: AccountType;
  isCreditCard: boolean;
  linkedPaymentAccountId?: string;
  startMonth: MonthId;
  archivedFromMonth?: MonthId;
  showInBudget?: boolean;
  includeInNetWorth?: boolean;
  sortOrder: number;
};

export type AccountType = "bank_account" | "credit_card" | "savings" | "investment_cash" | "cash" | "other";

export type InvestmentAsset = {
  id: string;
  name: string;
  startMonth: MonthId;
  archivedFromMonth?: MonthId;
  sortOrder: number;
  monthlyValuesCents?: Partial<Record<MonthId, Cents>>;
};

export const INITIAL_LIQUIDITY_ACCOUNTS: readonly LiquidityAccount[] = [
  {
    id: "santander",
    name: "Santander",
    shortName: "Santander",
    accountType: "bank_account",
    isCreditCard: false,
    startMonth: "2026-07",
    showInBudget: true,
    includeInNetWorth: true,
    sortOrder: 10,
  },
  {
    id: "cc-santander",
    name: "CC Santander",
    shortName: "CC Santander",
    accountType: "credit_card",
    isCreditCard: true,
    linkedPaymentAccountId: "santander",
    startMonth: "2026-07",
    showInBudget: true,
    includeInNetWorth: true,
    sortOrder: 20,
  },
  {
    id: "activobank",
    name: "ActivoBank",
    shortName: "ActivoBank",
    accountType: "bank_account",
    isCreditCard: false,
    startMonth: "2026-07",
    showInBudget: true,
    includeInNetWorth: true,
    sortOrder: 30,
  },
  {
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
  },
  {
    id: "t212-cash",
    name: "T212 Cash",
    shortName: "T212 Cash",
    accountType: "investment_cash",
    isCreditCard: false,
    startMonth: "2026-07",
    showInBudget: true,
    includeInNetWorth: true,
    sortOrder: 50,
  },
  {
    id: "n26",
    name: "N26",
    shortName: "N26",
    accountType: "bank_account",
    isCreditCard: false,
    startMonth: "2026-07",
    showInBudget: true,
    includeInNetWorth: true,
    sortOrder: 60,
  },
  {
    id: "igcp",
    name: "IGCP",
    shortName: "IGCP",
    accountType: "savings",
    isCreditCard: false,
    startMonth: "2026-07",
    showInBudget: true,
    includeInNetWorth: true,
    sortOrder: 70,
  },
];

export const INITIAL_INVESTMENT_ASSETS: readonly InvestmentAsset[] = [
  {
    id: "trading-212-investimentos",
    name: "Trading 212 — Investimentos",
    startMonth: "2026-07",
    sortOrder: 10,
  },
];

export function isActiveInMonth(
  item: Pick<LiquidityAccount | InvestmentAsset, "startMonth" | "archivedFromMonth">,
  month: MonthId,
) {
  return item.startMonth <= month && (!item.archivedFromMonth || month < item.archivedFromMonth);
}

export function sortByDisplayOrder<T extends { sortOrder: number; name: string }>(items: readonly T[]) {
  return [...items].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
}

export function getActiveLiquidityAccounts(
  accounts: readonly LiquidityAccount[],
  month: MonthId,
): LiquidityAccount[] {
  return sortByDisplayOrder(accounts.filter((account) => isActiveInMonth(account, month)));
}

export function getBudgetVisibleLiquidityAccounts(
  accounts: readonly LiquidityAccount[],
  month: MonthId,
): LiquidityAccount[] {
  return getActiveLiquidityAccounts(accounts, month).filter((account) => account.showInBudget !== false);
}

export function getAccountDisplayName(account: LiquidityAccount) {
  return account.shortName?.trim() || account.name;
}

export function getActiveInvestmentAssets(
  assets: readonly InvestmentAsset[],
  month: MonthId,
): InvestmentAsset[] {
  return sortByDisplayOrder(assets.filter((asset) => isActiveInMonth(asset, month)));
}
