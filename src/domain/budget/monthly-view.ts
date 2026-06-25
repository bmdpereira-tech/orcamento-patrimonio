import {
  getAccountDisplayName,
  getActiveInvestmentAssets,
  getBudgetVisibleLiquidityAccounts,
  INITIAL_INVESTMENT_ASSETS,
  INITIAL_LIQUIDITY_ACCOUNTS,
  type InvestmentAsset,
  type LiquidityAccount,
} from "./accounts";
import { type Cents, sumCents } from "./money";
import type { MonthId } from "./months";
import type { MonthlyDirectDebitOccurrence } from "./recurring-rules";

export type MonthlyAccountSnapshot = {
  accountId: string;
  initialBalanceCents: Cents;
  realisedMovementsCents: Cents;
  currentBalanceCents: Cents;
  directDebitsCents: Cents;
  dayToDayCents: Cents;
  creditCardPaymentsCents: Cents;
  manualForecastsCents: Cents;
  subtotalBeforeSalaryCents: Cents;
  salaryCents: Cents;
  finalBalanceCents: Cents;
};

export type MonthlyCustomBudgetItem = {
  id: string;
  month: MonthId;
  description: string;
  sortOrder: number;
  valuesByAccountId: Record<string, Cents>;
};

export type MonthlyCustomBudgetItemMutation =
  | {
      type: "create";
      item: MonthlyCustomBudgetItem;
    }
  | {
      type: "update";
      item: MonthlyCustomBudgetItem;
    }
  | {
      type: "delete";
      id: string;
    };

export type BudgetRowKey =
  | "initial-balance"
  | "realised-movements"
  | "current-balance"
  | "direct-debits"
  | "day-to-day"
  | "credit-card-payments"
  | "subtotal-before-salary"
  | "salary"
  | "final-balance";

export type BudgetRowTone = "regular" | "section-end" | "subtotal" | "salary" | "final";

export type EditableBudgetRowKey =
  | "initial-balance"
  | "current-balance"
  | "day-to-day"
  | "credit-card-payments"
  | "salary";

export type BudgetTableRow = {
  key: BudgetRowKey | `custom:${string}`;
  rowKey?: BudgetRowKey;
  customItem?: MonthlyCustomBudgetItem;
  label: string;
  valuesByAccountId: Record<string, Cents>;
  totalCents: Cents;
  tone: BudgetRowTone;
};

export type BudgetTableSection = {
  key: string;
  label: string;
  rows: BudgetTableRow[];
};

export type BudgetTableColumn =
  | {
      key: string;
      type: "account";
      account: LiquidityAccount;
      label: string;
    }
  | {
      key: "total";
      type: "total";
      label: "Total";
    };

export type BudgetOverview = {
  month: MonthId;
  accounts: LiquidityAccount[];
  investmentAssets: InvestmentAsset[];
  snapshots: MonthlyAccountSnapshot[];
  customItems: MonthlyCustomBudgetItem[];
  directDebitOccurrences: MonthlyDirectDebitOccurrence[];
  tableColumns: BudgetTableColumn[];
  tableSections: BudgetTableSection[];
  liquidityCurrentCents: Cents;
  liquidityFinalCents: Cents;
  remainingExpenseForecastsCents: Cents;
  creditCardDebtCents: Cents;
  investmentTotalCents: Cents;
  netWorthCents: Cents;
};

const rowDefinitions: readonly {
  key: BudgetRowKey;
  label: string;
  tone: BudgetRowTone;
  selector: (snapshot: MonthlyAccountSnapshot) => Cents;
}[] = [
  {
    key: "initial-balance",
    label: "Saldo inicial",
    tone: "regular",
    selector: (snapshot) => snapshot.initialBalanceCents,
  },
  {
    key: "realised-movements",
    label: "Movimentos realizados",
    tone: "regular",
    selector: (snapshot) => snapshot.realisedMovementsCents,
  },
  {
    key: "current-balance",
    label: "Saldo actual",
    tone: "section-end",
    selector: (snapshot) => snapshot.currentBalanceCents,
  },
  {
    key: "direct-debits",
    label: "Débitos directos",
    tone: "regular",
    selector: (snapshot) => snapshot.directDebitsCents,
  },
  {
    key: "day-to-day",
    label: "Day to day",
    tone: "regular",
    selector: (snapshot) => snapshot.dayToDayCents,
  },
  {
    key: "credit-card-payments",
    label: "Pagamentos de cartões",
    tone: "section-end",
    selector: (snapshot) => snapshot.creditCardPaymentsCents,
  },
  {
    key: "subtotal-before-salary",
    label: "Subtotal antes do salário",
    tone: "subtotal",
    selector: (snapshot) => snapshot.subtotalBeforeSalaryCents,
  },
  {
    key: "salary",
    label: "Salário",
    tone: "salary",
    selector: (snapshot) => snapshot.salaryCents,
  },
  {
    key: "final-balance",
    label: "Saldo final",
    tone: "final",
    selector: (snapshot) => snapshot.finalBalanceCents,
  },
];

export const EDITABLE_BUDGET_ROW_KEYS: readonly EditableBudgetRowKey[] = [
  "initial-balance",
  "current-balance",
  "day-to-day",
  "credit-card-payments",
  "salary",
];

export function createEmptySnapshot(accountId: string): MonthlyAccountSnapshot {
  return {
    accountId,
    initialBalanceCents: 0,
    realisedMovementsCents: 0,
    currentBalanceCents: 0,
    directDebitsCents: 0,
    dayToDayCents: 0,
    creditCardPaymentsCents: 0,
    manualForecastsCents: 0,
    subtotalBeforeSalaryCents: 0,
    salaryCents: 0,
    finalBalanceCents: 0,
  };
}

export function createBudgetTableColumns(accounts: readonly LiquidityAccount[]): BudgetTableColumn[] {
  return [
    ...accounts.map(
      (account): BudgetTableColumn => ({
        key: account.id,
        type: "account",
        account,
        label: getAccountDisplayName(account),
      }),
    ),
    {
      key: "total",
      type: "total",
      label: "Total",
    },
  ];
}

export function sumAccountSnapshots(
  accounts: readonly LiquidityAccount[],
  snapshots: readonly MonthlyAccountSnapshot[],
  selector: (snapshot: MonthlyAccountSnapshot) => Cents,
) {
  const snapshotsByAccount = new Map(snapshots.map((snapshot) => [snapshot.accountId, snapshot]));

  return sumCents(
    accounts.map((account) => {
      const snapshot = snapshotsByAccount.get(account.id) ?? createEmptySnapshot(account.id);
      return selector(snapshot);
    }),
  );
}

export function calculateInvestmentTotal(assets: readonly InvestmentAsset[], month: MonthId) {
  return sumCents(assets.map((asset) => asset.monthlyValuesCents?.[month] ?? 0));
}

export function calculateNetWorth(liquidityFinalCents: Cents, investmentTotalCents: Cents) {
  return sumCents([liquidityFinalCents, investmentTotalCents]);
}

export function calculateNetWorthLiquidity(
  accounts: readonly LiquidityAccount[],
  snapshots: readonly MonthlyAccountSnapshot[],
) {
  return sumAccountSnapshots(
    accounts.filter((account) => account.includeInNetWorth !== false),
    snapshots,
    (snapshot) => snapshot.finalBalanceCents,
  );
}

export function calculateCreditCardDebt(
  accounts: readonly LiquidityAccount[],
  snapshots: readonly MonthlyAccountSnapshot[],
) {
  const snapshotsByAccount = new Map(snapshots.map((snapshot) => [snapshot.accountId, snapshot]));

  return sumCents(
    accounts
      .filter((account) => account.isCreditCard)
      .map((account) => {
        const snapshot = snapshotsByAccount.get(account.id) ?? createEmptySnapshot(account.id);
        return snapshot.currentBalanceCents < 0 ? Math.abs(snapshot.currentBalanceCents) : 0;
      }),
  );
}

export function calculateRemainingExpenseForecasts(snapshots: readonly MonthlyAccountSnapshot[]) {
  return sumCents(
    snapshots.map((snapshot) => {
      const forecastTotal = sumCents([
        snapshot.directDebitsCents,
        snapshot.dayToDayCents,
        snapshot.creditCardPaymentsCents,
        snapshot.manualForecastsCents,
      ]);

      return forecastTotal < 0 ? Math.abs(forecastTotal) : 0;
    }),
  );
}

export function getCustomBudgetItemSignedAmount(item: MonthlyCustomBudgetItem, accountId: string) {
  return item.valuesByAccountId[accountId] ?? 0;
}

export function calculateCustomBudgetItemTotal(item: MonthlyCustomBudgetItem) {
  return sumCents(Object.keys(item.valuesByAccountId).map((accountId) => getCustomBudgetItemSignedAmount(item, accountId)));
}

export function applyCustomBudgetItemMutation(
  items: readonly MonthlyCustomBudgetItem[],
  mutation: MonthlyCustomBudgetItemMutation,
) {
  if (mutation.type === "create") {
    return [...items, mutation.item];
  }

  if (mutation.type === "update") {
    return items.map((item) => (item.id === mutation.item.id ? mutation.item : item));
  }

  return items.filter((item) => item.id !== mutation.id);
}

export function buildBudgetTableSections(
  accounts: readonly LiquidityAccount[],
  snapshots: readonly MonthlyAccountSnapshot[],
  customItems: readonly MonthlyCustomBudgetItem[] = [],
): BudgetTableSection[] {
  const snapshotsByAccount = new Map(snapshots.map((snapshot) => [snapshot.accountId, snapshot]));

  const buildRow = (definition: (typeof rowDefinitions)[number]): BudgetTableRow => {
    const valuesByAccountId = Object.fromEntries(
      accounts.map((account) => {
        const snapshot = snapshotsByAccount.get(account.id) ?? createEmptySnapshot(account.id);
        return [account.id, definition.selector(snapshot)];
      }),
    );

    return {
      key: definition.key,
      rowKey: definition.key,
      label: definition.label,
      valuesByAccountId,
      totalCents: sumCents(Object.values(valuesByAccountId)),
      tone: definition.tone,
    };
  };

  const rows = rowDefinitions.map(buildRow);
  const customRows: BudgetTableRow[] = [...customItems]
    .sort((left, right) => left.sortOrder - right.sortOrder || left.description.localeCompare(right.description))
    .map((item) => {
      const valuesByAccountId = Object.fromEntries(
        accounts.map((account) => [account.id, getCustomBudgetItemSignedAmount(item, account.id)]),
      );

      return {
        key: `custom:${item.id}`,
        customItem: item,
        label: item.description,
        valuesByAccountId,
        totalCents: sumCents(Object.values(valuesByAccountId)),
        tone: "regular",
      };
    });

  return [
    {
      key: "current-position",
      label: "Posição actual",
      rows: rows.slice(0, 3),
    },
    {
      key: "monthly-forecasts",
      label: "Previsões do mês",
      rows: [...rows.slice(3, 6), ...customRows],
    },
    {
      key: "before-salary",
      label: "Posição antes do salário",
      rows: rows.slice(6, 7),
    },
    {
      key: "salary",
      label: "Salário",
      rows: rows.slice(7, 8),
    },
    {
      key: "final-position",
      label: "Posição final",
      rows: rows.slice(8),
    },
  ];
}

export function buildBudgetOverview({
  month,
  accounts,
  investmentAssets,
  snapshots,
  customItems = [],
  directDebitOccurrences = [],
}: {
  month: MonthId;
  accounts: readonly LiquidityAccount[];
  investmentAssets: readonly InvestmentAsset[];
  snapshots: readonly MonthlyAccountSnapshot[];
  customItems?: readonly MonthlyCustomBudgetItem[];
  directDebitOccurrences?: readonly MonthlyDirectDebitOccurrence[];
}): BudgetOverview {
  const liquidityCurrentCents = sumAccountSnapshots(accounts, snapshots, (snapshot) => snapshot.currentBalanceCents);
  const liquidityFinalCents = sumAccountSnapshots(accounts, snapshots, (snapshot) => snapshot.finalBalanceCents);
  const investmentTotalCents = calculateInvestmentTotal(investmentAssets, month);
  const netWorthLiquidityCents = calculateNetWorthLiquidity(accounts, snapshots);

  return {
    month,
    accounts: [...accounts],
    investmentAssets: [...investmentAssets],
    snapshots: [...snapshots],
    customItems: [...customItems],
    directDebitOccurrences: [...directDebitOccurrences],
    tableColumns: createBudgetTableColumns(accounts),
    tableSections: buildBudgetTableSections(accounts, snapshots, customItems),
    liquidityCurrentCents,
    liquidityFinalCents,
    remainingExpenseForecastsCents: calculateRemainingExpenseForecasts(snapshots),
    creditCardDebtCents: calculateCreditCardDebt(accounts, snapshots),
    investmentTotalCents,
    netWorthCents: calculateNetWorth(netWorthLiquidityCents, investmentTotalCents),
  };
}

export function getBudgetOverview(month: MonthId): BudgetOverview {
  const accounts = getBudgetVisibleLiquidityAccounts(INITIAL_LIQUIDITY_ACCOUNTS, month);
  const investmentAssets = getActiveInvestmentAssets(INITIAL_INVESTMENT_ASSETS, month);
  const snapshots = accounts.map((account) => createEmptySnapshot(account.id));

  return buildBudgetOverview({ month, accounts, investmentAssets, snapshots });
}
